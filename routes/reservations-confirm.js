'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const { toDB } = require('../services/utils/dates');
const { getMinNightsForISO } = require('../services/quotation/engine');

const router = Router();

// POST /api/reservations/confirm
// Critical path: calls create_reservation_atomic RPC — never direct INSERT
router.post('/', async (req, res) => {
  const {
    leadId, lead_id,
    whatsapp,
    roomType, room_type,
    checkin,
    checkout,
    guests,
    totalAmount,  total_amount,
    depositAmount, deposit_amount,
    proposalId,   proposal_id,
  } = req.body;

  // Accept both camelCase and snake_case
  const pLeadId        = leadId        || lead_id;
  const pRoomType      = roomType      || room_type;
  const pTotalAmount   = totalAmount   ?? total_amount;
  const pDepositAmount = depositAmount ?? deposit_amount;
  const pProposalId    = proposalId    || proposal_id || null;

  if (!pLeadId || !whatsapp || !pRoomType || !checkin || !checkout || !guests || pTotalAmount === undefined) {
    return fail(res, 'missing_fields', 'leadId, whatsapp, roomType, checkin, checkout, guests, totalAmount required');
  }

  // Normaliza máscara/espaços — a coluna é varchar(20) e o resto do sistema usa só dígitos
  const whatsappDigits = String(whatsapp).replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(whatsappDigits)) {
    return fail(res, 'invalid_whatsapp',
      `Número de WhatsApp inválido: "${whatsapp}". Use código do país + DDD + número, ex: 5519999999999`);
  }

  let checkinISO, checkoutISO;
  try {
    checkinISO  = toDB(checkin);
    checkoutISO = toDB(checkout);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  // Estadia mínima — fonte única special_periods (mesma regra da cotação).
  // Datas normais aceitam diária única; períodos especiais exigem o min_nights.
  const nights = Math.round((new Date(checkoutISO) - new Date(checkinISO)) / 86400000);
  if (nights <= 0) {
    return fail(res, 'invalid_date', 'Check-out deve ser posterior ao check-in.', 422);
  }
  const minNights = getMinNightsForISO(checkinISO);
  if (nights < minNights) {
    return fail(res, 'min_nights',
      `A data de check-in está em um período com estadia mínima de ${minNights} noites.`, 422);
  }

  const deposit = pDepositAmount ?? Math.round(Number(pTotalAmount) * 0.30);

  const { data, error } = await supabaseAdmin.rpc('create_reservation_atomic', {
    p_lead_id:        pLeadId,
    p_whatsapp:       whatsappDigits,
    p_room_type:      pRoomType,
    p_checkin:        checkinISO,
    p_checkout:       checkoutISO,
    p_guests:         Number(guests),
    p_total_amount:   Number(pTotalAmount),
    p_deposit_amount: deposit,
    p_proposal_id:    pProposalId,
  });

  if (error) return serverError(res, error);

  // RPC returns { success, reservation_number, reservation_id, error, message }
  if (!data.success) {
    const status = data.error === 'no_availability' ? 409 : 422;
    return fail(res, data.error, data.message, status);
  }

  return ok(res, {
    reservation_number: data.reservation_number,
    reservation_id:     data.reservation_id,
    room_type:          data.room_type,
    voucher_id:         data.voucher_id || null, // gerado automaticamente pela RPC (migration 024)
    checkin_date:       checkinISO,
    checkout_date:      checkoutISO,
  }, 201);
});

module.exports = router;
