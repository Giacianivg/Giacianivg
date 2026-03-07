'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { createPixPayment, getPaymentStatus, validateWebhookSignature } = require('../../services/payments/mercadopago');
const { ok, fail, notFound, serverError } = require('../../services/utils/response');

const router = Router();

// POST /api/payments/pix
// Body: { reservation_id, amount, description, payer_email? }
router.post('/pix', async (req, res) => {
  const { reservation_id, amount, description, payer_email } = req.body;

  if (!reservation_id || amount === undefined) {
    return fail(res, 'missing_fields', 'reservation_id and amount required');
  }

  let pixData;
  try {
    pixData = await createPixPayment({ reservationId: reservation_id, amount, description, payerEmail: payer_email });
  } catch (err) {
    return serverError(res, err);
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      reservation_id,
      amount:         Number(amount),
      payment_method: 'pix',
      status:         pixData.status || 'pending',
      external_id:    String(pixData.payment_id),
      pix_link:       pixData.pix_link,
      pix_qr_code:    pixData.pix_qr_code,
      expires_at:     pixData.expires_at,
    })
    .select('id')
    .single();

  if (error) return serverError(res, error);

  return ok(res, {
    payment_id:  data.id,
    mp_id:       pixData.payment_id,
    pix_link:    pixData.pix_link,
    pix_qr_code: pixData.pix_qr_code,
    expires_at:  pixData.expires_at,
  }, 201);
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

// POST /api/payments/webhook — MercadoPago notifications
router.post('/webhook', async (req, res) => {
  // Validate signature first
  const signature = req.headers['x-signature'];
  const paymentId = req.body?.data?.id;

  if (!validateWebhookSignature(signature, paymentId)) {
    return fail(res, 'invalid_signature', 'Webhook signature validation failed', 401);
  }

  const { type, data } = req.body;

  // Only process payment notifications
  if (type !== 'payment' || !data?.id) {
    return res.sendStatus(200);
  }

  try {
    const mpStatus = await getPaymentStatus(data.id);

    // Find payment in DB by external_id
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, reservation_id, status')
      .eq('external_id', String(data.id))
      .single();

    if (!payment) {
      console.warn('[mp-webhook] Payment not found for mp_id:', data.id);
      return res.sendStatus(200);
    }

    // Idempotency: skip if already in final state
    if (['approved', 'cancelled', 'rejected'].includes(payment.status)) {
      return res.sendStatus(200);
    }

    const newStatus = mpStatus.status === 'approved' ? 'approved' : mpStatus.status;
    const updates = { status: newStatus };
    if (mpStatus.status === 'approved' && mpStatus.paid_at) {
      updates.paid_at = mpStatus.paid_at;
    }

    // Update payment status
    await supabaseAdmin.from('payments').update(updates).eq('id', payment.id);

    // On approval: confirm reservation
    if (mpStatus.status === 'approved') {
      await supabaseAdmin
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', payment.reservation_id);
      console.log(`[mp-webhook] Reservation ${payment.reservation_id} confirmed — PIX paid`);
    }
  } catch (err) {
    console.error('[mp-webhook] Error processing notification:', err.message);
    // Return 200 anyway to prevent MP retries on our errors
  }

  return res.sendStatus(200);
});

module.exports = router;
