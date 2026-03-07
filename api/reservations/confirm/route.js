'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../../services/supabase/client');
const { ok, fail, serverError } = require('../../../services/utils/response');
const { toDB } = require('../../../services/utils/dates');

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

  let checkinISO, checkoutISO;
  try {
    checkinISO  = toDB(checkin);
    checkoutISO = toDB(checkout);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  const deposit = pDepositAmount ?? Math.round(Number(pTotalAmount) * 0.30);

  const { data, error } = await supabaseAdmin.rpc('create_reservation_atomic', {
    p_lead_id:        pLeadId,
    p_whatsapp:       whatsapp,
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
    checkin_date:       checkinISO,
    checkout_date:      checkoutISO,
  }, 201);
});

module.exports = router;
