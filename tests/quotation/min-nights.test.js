'use strict';

/**
 * Regressão do bug "reserva de 1 diária bloqueada".
 * Regra canônica (fonte única special_periods.min_nights):
 *   - Datas normais → mínimo 1 noite (diária única permitida).
 *   - Datas em período especial → respeita o min_nights cadastrado (seeds = 2).
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const { calculateQuotation, invalidatePricingCache, getMinNightsForISO } = require('../../services/quotation/engine');

describe('[QUOTATION] estadia mínima — special_periods como fonte única', () => {
  // Garante uso do DEFAULT_CONFIG (espelha os seeds da migration 018).
  beforeEach(() => invalidatePricingCache());

  test('1 noite em data normal é permitida (diária única)', () => {
    const q = calculateQuotation({
      data_entrada: '14/04/2026', // terça, baixa temporada, fora de qualquer período especial
      data_saida:   '15/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined, 'data normal não pode exigir mínimo de 2 noites');
    assert.equal(q.nights, 1);
    assert.equal(q.totalFinal, 300); // 1 × R$300 (baixa)
  });

  test('1 noite em feriado (min_nights=2) é bloqueada e sugere 2', () => {
    const q = calculateQuotation({
      data_entrada: '14/02/2026', // dentro do Carnaval (02-13..02-18)
      data_saida:   '15/02/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.ok(q.error, 'feriado com min_nights=2 deve bloquear 1 noite');
    assert.equal(q.minNights, 2);
    assert.match(q.error, /Carnaval/);
    assert.match(q.suggestion, /2 noites/);
  });

  test('2 noites em feriado (min_nights=2) é permitida', () => {
    const q = calculateQuotation({
      data_entrada: '14/02/2026',
      data_saida:   '16/02/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined);
    assert.equal(q.nights, 2);
  });

  test('1 noite no Natal/Réveillon (range que cruza o ano) é bloqueada', () => {
    const q = calculateQuotation({
      data_entrada: '31/12/2026', // dentro de 12-24..01-02
      data_saida:   '01/01/2027',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.ok(q.error);
    assert.equal(q.minNights, 2);
  });
});

describe('[QUOTATION] getMinNightsForISO — usado pela criação de reserva (CRM)', () => {
  beforeEach(() => invalidatePricingCache());

  test('data normal → 1', () => {
    assert.equal(getMinNightsForISO('2026-04-14'), 1);
  });

  test('feriado (Carnaval) → 2', () => {
    assert.equal(getMinNightsForISO('2026-02-14'), 2);
  });

  test('Natal/Réveillon (range cruzando o ano) → 2', () => {
    assert.equal(getMinNightsForISO('2026-12-31'), 2);
    assert.equal(getMinNightsForISO('2027-01-01'), 2);
  });

  test('entrada inválida → 1 (default seguro)', () => {
    assert.equal(getMinNightsForISO('lixo'), 1);
    assert.equal(getMinNightsForISO(''), 1);
  });
});
