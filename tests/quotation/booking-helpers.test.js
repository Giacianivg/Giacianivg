'use strict';

/**
 * Testes dos helpers puros da reserva online (DEC-025 Bloco 3).
 * Run: node --test tests/quotation/booking-helpers.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWhatsapp, isValidName, computeDeposit, holdExpiryISO, HOLD_MINUTES } = require('../../services/quotation/booking-helpers');

describe('normalizeWhatsapp', () => {
  it('extrai dígitos de máscara válida', () => {
    assert.equal(normalizeWhatsapp('(19) 99840-0306'), '19998400306');
  });
  it('aceita 10 a 15 dígitos', () => {
    assert.equal(normalizeWhatsapp('1133334444'), '1133334444');
    assert.equal(normalizeWhatsapp('551999840030699'), '551999840030699');
  });
  it('rejeita curto, vazio, nulo e longo demais', () => {
    for (const v of ['123', '', null, undefined, '1'.repeat(16)]) {
      assert.equal(normalizeWhatsapp(v), null);
    }
  });
});

describe('isValidName', () => {
  it('aceita nome com 2+ caracteres', () => {
    assert.equal(isValidName('Vitor'), true);
    assert.equal(isValidName('Jô'), true);
  });
  it('rejeita vazio, curto, não-string e longo demais', () => {
    assert.equal(isValidName(''), false);
    assert.equal(isValidName(' '), false);
    assert.equal(isValidName('a'), false);
    assert.equal(isValidName(42), false);
    assert.equal(isValidName('x'.repeat(121)), false);
  });
});

describe('computeDeposit', () => {
  it('30% arredondado', () => {
    assert.equal(computeDeposit(1000), 300);
    assert.equal(computeDeposit(600), 180);
    assert.equal(computeDeposit(333), 100); // 99.9 → 100
  });
});

describe('holdExpiryISO', () => {
  it('retorna agora + HOLD_MINUTES em ISO', () => {
    const base = Date.parse('2026-08-10T12:00:00.000Z');
    const exp = holdExpiryISO(base);
    assert.equal(exp, new Date(base + HOLD_MINUTES * 60_000).toISOString());
  });
  it('default usa 30 min', () => {
    assert.equal(HOLD_MINUTES, 30);
  });
});
