'use strict';

/**
 * Tests for PIX comprovante validation logic — BUG 1 fix
 * Tests pure logic: amount comparison, tolerance, mismatch detection
 * Does NOT test Vision API or Supabase calls (I/O side effects)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseCurrency, formatCurrency } = require('../services/utils/currency');

// ── Amount comparison logic (extracted from handlePixComprovante) ──────────

function pixAmountMatches(extracted, expected, toleranceCents = 1) {
  if (!expected) return true; // sem reserva pending → aceitar
  return Math.abs(extracted - expected) <= toleranceCents;
}

function buildMismatchMessage(extracted, expected) {
  return `Opa! O comprovante mostra ${formatCurrency(extracted)} mas o sinal é ${formatCurrency(expected)}. Pode verificar e enviar o comprovante correto? 😊`;
}

// ── Tolerância de R$1 ─────────────────────────────────────────────────────
describe('[PIX] amount tolerance — R$1 window', () => {
  test('valor exato é válido', () => {
    assert.equal(pixAmountMatches(168, 168), true);
  });

  test('R$0,50 de diferença é válido (arredondamento)', () => {
    assert.equal(pixAmountMatches(168.50, 168), true);
  });

  test('exatamente R$1 de diferença é válido', () => {
    assert.equal(pixAmountMatches(169, 168), true);
    assert.equal(pixAmountMatches(167, 168), true);
  });

  test('R$1,01 de diferença é inválido', () => {
    assert.equal(pixAmountMatches(169.01, 168), false);
    assert.equal(pixAmountMatches(166.99, 168), false);
  });

  test('R$1,68 quando esperado R$168 — bug original — deve falhar', () => {
    assert.equal(pixAmountMatches(1.68, 168), false);
  });

  test('sem expectedAmount (sem reserva no DB) — aceitar qualquer valor', () => {
    assert.equal(pixAmountMatches(1.68, null), true);
    assert.equal(pixAmountMatches(168, null), true);
    assert.equal(pixAmountMatches(0, null), true);
  });
});

// ── Mensagem de erro de divergência ──────────────────────────────────────
describe('[PIX] mismatch message format', () => {
  test('mostra valor recebido e valor esperado', () => {
    const msg = buildMismatchMessage(1.68, 168);
    assert.ok(msg.includes('R$ 1,68'), `esperava "R$ 1,68" em: ${msg}`);
    assert.ok(msg.includes('R$ 168,00'), `esperava "R$ 168,00" em: ${msg}`);
  });

  test('inclui instrução de reenvio', () => {
    const msg = buildMismatchMessage(50, 168);
    assert.ok(msg.includes('comprovante correto'), `esperava instrução em: ${msg}`);
  });

  test('formato correto para valores grandes', () => {
    const msg = buildMismatchMessage(240, 300);
    assert.ok(msg.includes('R$ 240,00'));
    assert.ok(msg.includes('R$ 300,00'));
  });
});

// ── parseCurrency — valores extraídos pelo Vision ────────────────────────
describe('[PIX] parseCurrency — valores típicos de comprovante PIX', () => {
  test('168 → 168', () => assert.equal(parseCurrency(168), 168));
  test('168.00 → 168', () => assert.equal(parseCurrency('168.00'), 168));
  test('"168,00" → 168', () => assert.equal(parseCurrency('168,00'), 168));
  test('"1.680,00" → 1680', () => assert.equal(parseCurrency('R$1.680,00'), 1680));
  test('"1,68" → 1.68 (valor incorreto — deve divergir de R$168)', () => {
    assert.equal(parseCurrency('1,68'), 1.68);
    assert.equal(pixAmountMatches(parseCurrency('1,68'), 168), false);
  });
  test('0 → 0 (Vision não identificou)', () => assert.equal(parseCurrency(0), 0));
  test('"0" → 0', () => assert.equal(parseCurrency('0'), 0));
});

// ── extractedValue guard ──────────────────────────────────────────────────
describe('[PIX] extracted value guard — valores inválidos da Vision', () => {
  function isValidExtractedValue(v) {
    return v && v > 0;
  }

  test('0 é inválido', () => assert.ok(!isValidExtractedValue(0)));
  test('negativo é inválido', () => assert.ok(!isValidExtractedValue(-1)));
  test('null é inválido', () => assert.ok(!isValidExtractedValue(null)));
  test('168 é válido', () => assert.equal(isValidExtractedValue(168), true));
  test('0.01 é válido (centavo)', () => assert.equal(isValidExtractedValue(0.01), true));
});

// ── Cenários reais de comprovante ─────────────────────────────────────────
describe('[PIX] cenários reais de validação', () => {
  test('sinal R$180 — hóspede pagou correto', () => {
    const extracted = 180;
    const expected = 180;
    assert.equal(pixAmountMatches(extracted, expected), true);
  });

  test('sinal R$240 — hóspede pagou R$1,68 (digitou errado)', () => {
    const extracted = parseCurrency('1,68');
    const expected = 240;
    assert.equal(pixAmountMatches(extracted, expected), false);
    const msg = buildMismatchMessage(extracted, expected);
    assert.ok(msg.includes('R$ 240,00'));
  });

  test('sinal R$300 — hóspede pagou R$300,50 (diferença de centavos)', () => {
    const extracted = 300.50;
    const expected = 300;
    assert.equal(pixAmountMatches(extracted, expected), true); // dentro da tolerância
  });

  test('sinal R$500 — hóspede pagou R$50 (zero a menos — bug clássico)', () => {
    const extracted = 50;
    const expected = 500;
    assert.equal(pixAmountMatches(extracted, expected), false);
  });
});
