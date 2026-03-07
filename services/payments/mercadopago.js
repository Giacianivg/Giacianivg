'use strict';

const crypto = require('crypto');

const ACCESS_TOKEN    = process.env.MERCADOPAGO_ACCESS_TOKEN;
const WEBHOOK_SECRET  = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const MP_API          = 'https://api.mercadopago.com';

// ---------------------------------------------------------------------------
// Create PIX payment
// ---------------------------------------------------------------------------
async function createPixPayment({ reservationId, amount, description, payerEmail }) {
  if (!ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured');

  const body = {
    transaction_amount: Number(amount),
    description: description || `Sinal reserva ${reservationId}`,
    payment_method_id: 'pix',
    payer: { email: payerEmail || 'hospede@pousadaluzdalua.com.br' },
    external_reference: String(reservationId),
    date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type':  'application/json',
      'X-Idempotency-Key': `${reservationId}-${Date.now()}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MercadoPago ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    payment_id:  data.id,
    pix_link:    data.point_of_interaction?.transaction_data?.ticket_url || null,
    pix_qr_code: data.point_of_interaction?.transaction_data?.qr_code    || null,
    expires_at:  data.date_of_expiration,
    status:      data.status,
  };
}

// ---------------------------------------------------------------------------
// Validate webhook x-signature header
// Format: "ts=TIMESTAMP,v1=HASH"
// HMAC-SHA256(ts + "." + data.id, WEBHOOK_SECRET)
// ---------------------------------------------------------------------------
function validateWebhookSignature(signatureHeader, paymentId) {
  if (!WEBHOOK_SECRET) {
    console.warn('[mp] MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature validation');
    return true; // Allow in dev without secret
  }
  if (!signatureHeader) return false;

  const parts = {};
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }

  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const payload  = `${ts}.${paymentId}`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

// ---------------------------------------------------------------------------
// Fetch payment status from MP API (for polling / verification)
// ---------------------------------------------------------------------------
async function getPaymentStatus(paymentId) {
  if (!ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured');
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`MercadoPago ${res.status}`);
  const data = await res.json();
  return { payment_id: data.id, status: data.status, paid_at: data.date_approved };
}

module.exports = { createPixPayment, validateWebhookSignature, getPaymentStatus };
