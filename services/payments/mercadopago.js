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
  const tx = data.point_of_interaction?.transaction_data || {};
  return {
    payment_id:     data.id,
    pix_link:       tx.ticket_url || null,
    pix_qr_code:    tx.qr_code || null,          // copia-e-cola
    pix_qr_base64:  tx.qr_code_base64 || null,   // imagem do QR (data URI base64) p/ exibir na tela
    expires_at:     data.date_of_expiration,
    status:         data.status,
  };
}

// ---------------------------------------------------------------------------
// Validate webhook x-signature header — formato OFICIAL do Mercado Pago.
//   header x-signature: "ts=TIMESTAMP,v1=HASH"
//   manifest:           "id:{data.id};request-id:{x-request-id};ts:{ts};"
//   v1 = HMAC-SHA256(manifest, WEBHOOK_SECRET)  (data.id em minúsculas)
// Ref: docs MP "Validar origem da notificação". Testar em sandbox (Bloco 4).
// ---------------------------------------------------------------------------
function validateWebhookSignature(xSignature, xRequestId, dataId) {
  if (!WEBHOOK_SECRET) {
    console.warn('[mp] MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature validation');
    return true; // graceful: dev/sandbox sem secret
  }
  if (!xSignature || dataId == null) return false;

  const parts = {};
  for (const part of String(xSignature).split(',')) {
    const idx = part.indexOf('=');
    if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  // data.id em minúsculas; request-id pode faltar em alguns eventos → string vazia.
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${xRequestId || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex');

  if (v1.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
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
