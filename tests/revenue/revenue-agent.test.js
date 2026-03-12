'use strict';

/**
 * Unit tests — Revenue Agent (Maxwell)
 * PLU-24 / DEC-018
 * Run: node --test tests/revenue/revenue-agent.test.js
 *
 * Testa lógica pura sem Supabase (OWN_PRICES, getOwnPrice).
 * analyzeCompetitorPricing e suggestPrice requerem DB — testados via demand-signals.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { OWN_PRICES, getOwnPrice } = require('../../services/revenue-intelligence/revenue-agent');

// ─── OWN_PRICES ───────────────────────────────────────────────────────────────

describe('OWN_PRICES — estrutura de dados', () => {
  it('tem 4 room_types: standard, casal, familia, grupo', () => {
    assert.ok(OWN_PRICES.standard);
    assert.ok(OWN_PRICES.casal);
    assert.ok(OWN_PRICES.familia);
    assert.ok(OWN_PRICES.grupo);
  });

  it('cada room_type tem baixa, media, alta', () => {
    Object.values(OWN_PRICES).forEach(rt => {
      assert.ok(typeof rt.baixa === 'number', 'baixa deve ser número');
      assert.ok(typeof rt.media === 'number', 'media deve ser número');
      assert.ok(typeof rt.alta  === 'number', 'alta deve ser número');
    });
  });

  it('preços são positivos', () => {
    Object.entries(OWN_PRICES).forEach(([type, seasons]) => {
      Object.entries(seasons).forEach(([season, price]) => {
        assert.ok(price > 0, `${type}.${season} deve ser > 0`);
      });
    });
  });

  it('alta >= media >= baixa para cada room_type', () => {
    Object.entries(OWN_PRICES).forEach(([type, seasons]) => {
      assert.ok(seasons.alta >= seasons.media, `${type}: alta deve ser >= media`);
      assert.ok(seasons.media >= seasons.baixa, `${type}: media deve ser >= baixa`);
    });
  });

  it('casal: baixa=300, alta=400', () => {
    assert.equal(OWN_PRICES.casal.baixa, 300);
    assert.equal(OWN_PRICES.casal.alta, 400);
  });
});

// ─── getOwnPrice ──────────────────────────────────────────────────────────────

describe('getOwnPrice', () => {
  it('casal alta → 400', () => {
    assert.equal(getOwnPrice('casal', 'alta'), 400);
  });
  it('casal baixa → 300', () => {
    assert.equal(getOwnPrice('casal', 'baixa'), 300);
  });
  it('standard alta → 380', () => {
    assert.equal(getOwnPrice('standard', 'alta'), 380);
  });
  it('familia alta → 500', () => {
    assert.equal(getOwnPrice('familia', 'alta'), 500);
  });
  it('grupo alta → 800', () => {
    assert.equal(getOwnPrice('grupo', 'alta'), 800);
  });
  it('room_type desconhecido → usa casal como fallback', () => {
    const price = getOwnPrice('inexistente', 'baixa');
    assert.equal(price, OWN_PRICES.casal.baixa);
  });
  it('season desconhecida → usa baixa como fallback', () => {
    const price = getOwnPrice('casal', 'xyz');
    assert.equal(price, OWN_PRICES.casal.baixa);
  });
});
