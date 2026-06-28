'use strict';

/**
 * Tests for the OCR layer (Compras — Fase 2, abstração trocável + fallback).
 * Camadas testadas: normalize (regras de negócio, formato BR), adapter Anthropic
 * (extractJson + mapError tipado), porta (friendlyMessage não vaza billing).
 * A chamada HTTP real ao provedor não é testada aqui.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReceipt, num } = require('../services/financial/ocr/normalize');
const anthropic = require('../services/financial/ocr/providers/anthropic');
const { friendlyMessage, getProvider } = require('../services/financial/ocr');

describe('normalize.num — formato brasileiro (regressão)', () => {
  test('"1.950,00" → 1950', () => assert.equal(num('1.950,00'), 1950));
  test('"1.950" (só milhar) → 1950, NÃO 1.95', () => assert.equal(num('1.950'), 1950));
  test('"R$ 1.950,00" → 1950', () => assert.equal(num('R$ 1.950,00'), 1950));
  test('"84,50" → 84.5', () => assert.equal(num('84,50'), 84.5));
  test('"84.50" → 84.5', () => assert.equal(num('84.50'), 84.5));
  test('"1950" → 1950', () => assert.equal(num('1950'), 1950));
  test('"12.000,00" → 12000', () => assert.equal(num('12.000,00'), 12000));
  test('número 1950 → 1950', () => assert.equal(num(1950), 1950));
  test('zero/negativo/lixo → null', () => {
    assert.equal(num('0'), null);
    assert.equal(num('abc'), null);
    assert.equal(num(null), null);
  });
});

describe('normalizeReceipt — campos crus → InvoiceImportData', () => {
  test('cupom legível vira despesa simples / fonte foto / confiança baixa', () => {
    const r = normalizeReceipt({ total: '1.950,00', date: '2026-06-20', supplier: 'Feira do Zé',
      confidence: { total: 'high', date: 'high', supplier: 'high' } });
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'simple');
    assert.equal(r.source, 'photo_receipt');
    assert.equal(r.source_confidence, 'low');
    assert.equal(r.header.total_amount, 1950);
    assert.equal(r.header.issue_date, '2026-06-20');
    assert.equal(r.header.supplier_name, 'Feira do Zé');
    assert.deepEqual(r.uncertain_fields, []);
    assert.ok(r.warnings.some(w => /confira|foto/i.test(w)));
  });

  test('campo nulo / confiança baixa entra em uncertain_fields', () => {
    const r = normalizeReceipt({ total: 30, date: null, supplier: 'X',
      confidence: { total: 'low', date: 'low', supplier: 'high' } });
    assert.ok(r.uncertain_fields.includes('total_amount'));
    assert.ok(r.uncertain_fields.includes('issue_date'));
    assert.ok(!r.uncertain_fields.includes('supplier_name'));
  });
});

describe('adapter Anthropic — extractJson', () => {
  test('JSON puro', () => assert.deepEqual(anthropic.extractJson('{"total":"10,00"}'), { total: '10,00' }));
  test('JSON em bloco ```json', () => {
    assert.deepEqual(anthropic.extractJson('ok\n```json\n{"total":"5,50"}\n```'), { total: '5,50' });
  });
  test('sem JSON → null', () => assert.equal(anthropic.extractJson('não tem'), null));
});

describe('adapter Anthropic — mapError (erro tipado)', () => {
  test('saldo baixo → no_credit', () => {
    assert.equal(anthropic.mapError(400, { error: { message: 'Your credit balance is too low' } }).errorType, 'no_credit');
  });
  test('imagem inválida → bad_image', () => {
    assert.equal(anthropic.mapError(400, { error: { message: 'could not process image format' } }).errorType, 'bad_image');
  });
  test('401 → auth', () => assert.equal(anthropic.mapError(401, {}).errorType, 'auth'));
  test('429 → provider_down', () => assert.equal(anthropic.mapError(429, {}).errorType, 'provider_down'));
  test('500 → provider_down', () => assert.equal(anthropic.mapError(503, {}).errorType, 'provider_down'));
});

describe('porta OCR — friendlyMessage NÃO vaza detalhe interno', () => {
  test('no_credit → mensagem genérica (sem billing)', () => {
    const m = friendlyMessage('no_credit');
    assert.match(m, /indispon[íi]vel|manualmente/i);
    assert.doesNotMatch(m, /credit|billing|saldo|cr[ée]dito/i);
  });
  test('provider_down e not_configured também genéricos', () => {
    assert.equal(friendlyMessage('provider_down'), friendlyMessage('not_configured'));
  });
  test('bad_image → mensagem específica de imagem', () => {
    assert.match(friendlyMessage('bad_image'), /foto/i);
  });
});

describe('porta OCR — seleção de provedor (trocável)', () => {
  test('default é anthropic', () => assert.equal(getProvider().name, 'anthropic'));
});
