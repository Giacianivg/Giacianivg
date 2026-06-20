'use strict';

/**
 * Testa o manifest OFICIAL do Mercado Pago em validateWebhookSignature
 * (DEC-025 Bloco 4 — preparação sem credencial).
 * Fixa o secret ANTES de importar para forjar assinaturas válidas.
 * Run: node --test tests/payments/webhook-signature.test.js
 */

process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test-mp-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { validateWebhookSignature } = require('../../services/payments/mercadopago');

function header(dataId, requestId, ts, secret = 'test-mp-secret') {
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('validateWebhookSignature — manifest oficial MP', () => {
  it('assinatura válida passa', () => {
    assert.equal(validateWebhookSignature(header('123456', 'req-abc', '1700000000'), 'req-abc', '123456'), true);
  });

  it('data.id é tratado em minúsculas', () => {
    assert.equal(validateWebhookSignature(header('abcDEF', 'req-1', '1700000001'), 'req-1', 'ABCdef'), true);
  });

  it('request-id divergente falha', () => {
    assert.equal(validateWebhookSignature(header('999', 'req-real', '1700000002'), 'req-fake', '999'), false);
  });

  it('secret errado falha', () => {
    const forged = header('5', 'r', '170', 'outro-secret');
    assert.equal(validateWebhookSignature(forged, 'r', '5'), false);
  });

  it('header ausente ou sem v1 falha', () => {
    assert.equal(validateWebhookSignature(undefined, 'r', '1'), false);
    assert.equal(validateWebhookSignature('ts=1', 'r', '1'), false);
  });
});
