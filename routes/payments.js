'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { createPaymentLink } = require('../services/payments/infinitepay');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

const router = Router();

// POST /api/payments/pix — gera um link de pagamento InfinitePay p/ uma reserva
// (troca MP→InfinitePay; nome mantido por compat). A confirmação chega pelo
// webhook público /api/public/infinitepay-webhook (verificado via payment_check).
// Body: { reservation_id, amount?, description? }  (amount default = sinal de 30%)
router.post('/pix', async (req, res) => {
  const { reservation_id, amount, description } = req.body;
  if (!reservation_id) return fail(res, 'missing_fields', 'reservation_id required');

  const { data: r, error: rErr } = await supabaseAdmin
    .from('reservations')
    .select('id, reservation_number, deposit_amount, hold_expires_at')
    .eq('id', reservation_id).maybeSingle();
  if (rErr) return serverError(res, rErr);
  if (!r) return notFound(res, 'Reservation');

  const value = amount !== undefined ? Number(amount) : Number(r.deposit_amount);
  if (!(value > 0)) return fail(res, 'invalid_amount', 'amount deve ser > 0');

  const base = process.env.PUBLIC_BASE_URL
    ? process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
    : `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;

  let link;
  try {
    link = await createPaymentLink({
      orderNsu:    r.reservation_number,
      amount:      value,
      description: description || `Sinal reserva ${r.reservation_number}`,
      redirectUrl: `${base}/landing/reserva-confirmada.html?order=${encodeURIComponent(r.reservation_number)}`,
      webhookUrl:  `${base}/api/public/infinitepay-webhook`,
    });
  } catch (err) {
    return serverError(res, err);
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      reservation_id,
      payment_type: 'deposit',
      amount:       value,
      method:       'pix',
      status:       'pending',
      external_id:  String(r.reservation_number),
      qr_code_url:  link.url,
      expires_at:   r.hold_expires_at,
    })
    .select('id')
    .single();

  if (error) return serverError(res, error);

  return ok(res, { payment_id: data.id, checkout_url: link.url, order_nsu: link.order_nsu }, 201);
});

// POST /api/payments/manual
// Pagamento recebido no balcão (PIX/dinheiro/cartão) — registrado já confirmado.
// Body: { reservation_id, amount, method, payment_type? }
router.post('/manual', async (req, res) => {
  const { reservation_id, amount, method, payment_type } = req.body;

  if (!reservation_id || amount === undefined || !method) {
    return fail(res, 'missing_fields', 'reservation_id, amount e method são obrigatórios');
  }
  if (Number(amount) <= 0) return fail(res, 'invalid_amount', 'amount deve ser > 0');

  const validMethods = ['pix', 'cash', 'card', 'transfer'];
  if (!validMethods.includes(method)) {
    return fail(res, 'invalid_method', `method deve ser um de: ${validMethods.join(', ')}`);
  }

  const validTypes = ['deposit', 'balance', 'full'];
  const type = payment_type || 'balance';
  if (!validTypes.includes(type)) {
    return fail(res, 'invalid_payment_type', `payment_type deve ser um de: ${validTypes.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      reservation_id,
      payment_type: type,
      amount:       Number(amount),
      method,
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .select('id, amount, method, payment_type, confirmed_at')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { payment: data }, 201);
});

// GET /api/payments/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, reservations(reservation_number, checkin_date, checkout_date, room_type)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return notFound(res, 'Payment');
  return ok(res, { payment: data });
});

// Webhook de pagamento: agora é ÚNICO e PÚBLICO (não-autenticado, pois o
// provedor não envia JWT) — vive em routes/public.js → POST /api/public/infinitepay-webhook.
// O antigo /api/payments/webhook (MercadoPago) foi removido na troca de provedor.

module.exports = router;
