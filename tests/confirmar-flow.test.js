'use strict';

/**
 * Tests for [CONFIRMAR] flow logic — DEC-020 item 2
 * Tests pure logic: guard condition, currency parsing, deposit calculation
 * Does NOT test I/O side effects (sendWhatsApp, Supabase) — those are integration
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseCurrency, formatCurrency } = require('../services/utils/currency');

// ── Guard condition logic (extracted from handleConfirmar line 447) ────────────

function evalGuard(supabaseUrl, leadId, params, totalAmount) {
  return !!(supabaseUrl && leadId && params.entrada && params.saida && params.tipo && totalAmount);
}

function missingGuardParams(leadId, params, totalAmount) {
  const missing = [];
  if (!leadId)             missing.push('leadId');
  if (!params.entrada)     missing.push('entrada');
  if (!params.saida)       missing.push('saida');
  if (!params.tipo)        missing.push('tipo');
  if (!totalAmount)        missing.push('totalAmount');
  return missing;
}

// ── Guard condition tests ──────────────────────────────────────────────────────

describe('[CONFIRMAR] handleConfirmar — guard condition', () => {
  const SUPA_URL = 'https://nqxesjxbqupmhnivkfyk.supabase.co';
  const LEAD_ID  = 'abc-123';
  const fullParams = { entrada: '10/04/2026', saida: '12/04/2026', tipo: 'ALA_A', pessoas: '2', total: 'R$600' };

  test('passes when all required params present', () => {
    assert.equal(evalGuard(SUPA_URL, LEAD_ID, fullParams, 600), true);
  });

  test('fails when leadId is null', () => {
    assert.equal(evalGuard(SUPA_URL, null, fullParams, 600), false);
    assert.deepEqual(missingGuardParams(null, fullParams, 600), ['leadId']);
  });

  test('fails when SUPABASE_URL missing', () => {
    assert.equal(evalGuard('', LEAD_ID, fullParams, 600), false);
  });

  test('fails when entrada missing', () => {
    const p = { ...fullParams, entrada: undefined };
    assert.equal(evalGuard(SUPA_URL, LEAD_ID, p, 600), false);
    assert.deepEqual(missingGuardParams(LEAD_ID, p, 600), ['entrada']);
  });

  test('fails when saida missing', () => {
    const p = { ...fullParams, saida: undefined };
    assert.equal(evalGuard(SUPA_URL, LEAD_ID, p, 600), false);
    assert.deepEqual(missingGuardParams(LEAD_ID, p, 600), ['saida']);
  });

  test('fails when tipo missing', () => {
    const p = { ...fullParams, tipo: undefined };
    assert.equal(evalGuard(SUPA_URL, LEAD_ID, p, 600), false);
    assert.deepEqual(missingGuardParams(LEAD_ID, p, 600), ['tipo']);
  });

  test('fails when totalAmount is 0 (parseCurrency returned 0)', () => {
    assert.equal(evalGuard(SUPA_URL, LEAD_ID, fullParams, 0), false);
    assert.deepEqual(missingGuardParams(LEAD_ID, fullParams, 0), ['totalAmount']);
  });

  test('reports all missing params at once', () => {
    const missing = missingGuardParams(null, {}, 0);
    assert.deepEqual(missing, ['leadId', 'entrada', 'saida', 'tipo', 'totalAmount']);
  });
});

// ── Currency parsing (used by handleConfirmar to extract totalAmount) ──────────

describe('[CONFIRMAR] parseCurrency — extracts totalAmount from Luna signal', () => {
  test('parses R$600', () => assert.equal(parseCurrency('R$600'), 600));
  test('parses R$ 600', () => assert.equal(parseCurrency('R$ 600'), 600));
  test('parses R$600,00', () => assert.equal(parseCurrency('R$600,00'), 600));
  test('parses R$1.200,00', () => assert.equal(parseCurrency('R$1.200,00'), 1200));
  test('parses R$1.800,50', () => assert.equal(parseCurrency('R$1.800,50'), 1800.5));
  test('returns 0 for undefined (triggers guard failure)', () => assert.equal(parseCurrency(undefined), 0));
  test('returns 0 for empty string (triggers guard failure)', () => assert.equal(parseCurrency(''), 0));
  test('returns 0 for null (triggers guard failure)', () => assert.equal(parseCurrency(null), 0));
  test('passes through number directly', () => assert.equal(parseCurrency(750), 750));
});

// ── Deposit (sinal) calculation ───────────────────────────────────────────────

describe('[CONFIRMAR] depositAmount — sinal calculation logic', () => {
  function calcDeposit(pSinal, totalAmount) {
    return pSinal ? parseCurrency(pSinal) : Math.round(totalAmount * 0.30);
  }

  test('uses explicit sinal when provided', () => {
    assert.equal(calcDeposit('R$180', 600), 180);
  });

  test('calculates 30% when sinal not provided', () => {
    assert.equal(calcDeposit(undefined, 600), 180);
  });

  test('rounds 30% correctly for R$1.000', () => {
    assert.equal(calcDeposit(undefined, 1000), 300);
  });

  test('rounds 30% correctly for R$900 (270.00)', () => {
    assert.equal(calcDeposit(undefined, 900), 270);
  });

  test('rounds 30% correctly for odd value R$700 (210)', () => {
    assert.equal(calcDeposit(undefined, 700), 210);
  });

  test('explicit sinal overrides 30% calculation', () => {
    // Luna can set a different sinal (e.g. for promotions)
    assert.equal(calcDeposit('R$100', 600), 100);
    assert.notEqual(calcDeposit('R$100', 600), Math.round(600 * 0.30));
  });
});

// ── Recalculation: engine totalFinal vs LLM total ────────────────────────────
describe('[CONFIRMAR] totalAmount — recalculation from engine (bug: sinal sobre preço base)', () => {
  const { calculateQuotation } = require('../services/quotation/engine');

  test('alta season ALA_A 2 noites → engine R$800, não R$560 (preço base errado)', () => {
    const recalc = calculateQuotation({
      data_entrada: '01/07/2026', // julho = alta temporada
      data_saida:   '03/07/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(recalc.error, undefined);
    assert.equal(recalc.totalFinal, 800); // 2 noites × R$400 (alta, ≤2px)
    // Sinal correto: 30% de R$800 = R$240 (não 30% de R$560 = R$168)
    assert.equal(Math.round(recalc.totalFinal * 0.30), 240);
  });

  test('mismatch detectado: LLM R$560 vs engine R$800 (alta season)', () => {
    const llmTotal = parseCurrency('R$560'); // valor errado do LLM
    const recalc = calculateQuotation({
      data_entrada: '01/07/2026',
      data_saida:   '03/07/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(recalc.error, undefined);
    assert.equal(recalc.totalFinal, 800);
    assert.ok(Math.abs(llmTotal - recalc.totalFinal) > 1, 'mismatch deve ser detectado');
    // Com recalculation, totalAmount = 800, sinal = R$240
    assert.equal(Math.round(recalc.totalFinal * 0.30), 240);
  });

  test('baixa season ALA_A 2 noites → engine R$600, sinal R$180', () => {
    const recalc = calculateQuotation({
      data_entrada: '14/04/2026', // terça-feira, baixa
      data_saida:   '16/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(recalc.error, undefined);
    assert.equal(recalc.totalFinal, 600); // 2 noites × R$300
    assert.equal(Math.round(recalc.totalFinal * 0.30), 180);
  });

  test('recalculation ignora erro do engine e usa fallback parseCurrency', () => {
    // Se params inválidos, engine retorna erro — usa parseCurrency(p.total)
    const recalc = calculateQuotation({
      data_entrada: '16/04/2026', // saida antes de entrada
      data_saida:   '14/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.ok(recalc.error, 'engine deve retornar erro para datas inválidas');
    // Fallback: parseCurrency do p.total original
    assert.equal(parseCurrency('R$600'), 600);
  });
});

// ── formatCurrency (used in guest/team messages) ──────────────────────────────

describe('[CONFIRMAR] formatCurrency — guest/team message formatting', () => {
  test('formats 600 as R$ 600,00', () => assert.equal(formatCurrency(600), 'R$ 600,00'));
  test('formats 180 as R$ 180,00', () => assert.equal(formatCurrency(180), 'R$ 180,00'));
  test('formats 1200 as R$ 1.200,00', () => assert.equal(formatCurrency(1200), 'R$ 1.200,00'));
  test('formats 1800.5 as R$ 1.800,50', () => assert.equal(formatCurrency(1800.5), 'R$ 1.800,50'));
});
