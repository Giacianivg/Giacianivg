'use strict';

/**
 * Tests for dynamic pricing engine — Fase 1.5
 * Tests pure functions (curva de pickup, fatores) and the synchronous
 * quote-adjustment path via __setCacheForTests (no Supabase I/O).
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../services/pricing/dynamic-pricing');
const {
  expectedOccupancy,
  pacingFactor,
  lastMinuteFactor,
  competitionFactor,
  computeDateMultiplier,
  clampPrice,
  median,
  getQuoteAdjustment,
  __setCacheForTests,
  invalidateCache,
  DEFAULT_SETTINGS,
} = pricing;

// ── expectedOccupancy — curva de pickup ──────────────────────────────────────
describe('[PRICING] expectedOccupancy — curva de pickup', () => {
  test('dia do check-in (0 dias) → 100% da meta', () => {
    assert.equal(expectedOccupancy(0, 70), 70);
  });

  test('30 dias antes → 65% da meta', () => {
    assert.equal(expectedOccupancy(30, 70), 70 * 0.65);
  });

  test('90 dias antes → 30% da meta', () => {
    assert.equal(expectedOccupancy(90, 70), 70 * 0.30);
  });

  test('além de 90 dias usa o último ponto da curva', () => {
    assert.equal(expectedOccupancy(180, 70), 70 * 0.30);
  });

  test('interpolação linear entre pontos (22 dias = meio de 14→30)', () => {
    const expected = 70 * (0.80 + ((22 - 14) / (30 - 14)) * (0.65 - 0.80));
    assert.equal(expectedOccupancy(22, 70), expected);
  });

  test('daysAhead negativo é tratado como 0', () => {
    assert.equal(expectedOccupancy(-5, 70), 70);
  });
});

// ── pacingFactor — ritmo de vendas ───────────────────────────────────────────
describe('[PRICING] pacingFactor — ritmo vs curva', () => {
  test('na curva (ratio 1.0) → sem ajuste', () => {
    assert.equal(pacingFactor(45.5, 45.5), 1);
  });

  test('50% abaixo da curva → desconto de 25% (slope 0.5)', () => {
    assert.equal(pacingFactor(25, 50), 0.75);
  });

  test('ocupação zero → desconto máximo de -30%', () => {
    assert.equal(pacingFactor(0, 50), 0.70);
  });

  test('40% acima da curva → aumento de 20% (slope 0.5)', () => {
    assert.equal(pacingFactor(70, 50), 1 + 0.4 * 0.5);
  });

  test('muito acima da curva → clampa no aumento máximo de +40%', () => {
    assert.equal(pacingFactor(100, 10), 1.40);
  });

  test('expectedPct 0 → fator neutro (evita divisão por zero)', () => {
    assert.equal(pacingFactor(50, 0), 1);
  });
});

// ── lastMinuteFactor — desconto de antecedência ──────────────────────────────
describe('[PRICING] lastMinuteFactor — última hora', () => {
  test('menos de 7 dias com ocupação < 50% → desconto de -15%', () => {
    assert.equal(lastMinuteFactor(3, 30), 0.85);
  });

  test('exatamente 7 dias → sem desconto extra', () => {
    assert.equal(lastMinuteFactor(7, 30), 1);
  });

  test('menos de 7 dias mas ocupação >= 50% → sem desconto extra', () => {
    assert.equal(lastMinuteFactor(3, 50), 1);
    assert.equal(lastMinuteFactor(3, 80), 1);
  });
});

// ── competitionFactor — posicionamento vs concorrentes ───────────────────────
describe('[PRICING] competitionFactor — concorrência', () => {
  test('sem mediana de concorrentes → fator neutro', () => {
    assert.equal(competitionFactor(300, null, true), 1);
    assert.equal(competitionFactor(300, 0, true), 1);
  });

  test('sem preço projetado → fator neutro', () => {
    assert.equal(competitionFactor(0, 300, true), 1);
    assert.equal(competitionFactor(null, 300, true), 1);
  });

  test('abaixo da meta → mira 7,5% abaixo do mediano', () => {
    // nosso 300, mediano 300 → desired 277.5 → adj 0.925
    assert.equal(competitionFactor(300, 300, true), 0.925);
  });

  test('abaixo da meta com concorrente muito mais barato → corta no máximo 15%', () => {
    assert.equal(competitionFactor(300, 150, true), 0.85);
  });

  test('acima da meta e dentro do teto de 10% sobre o mediano → neutro', () => {
    assert.equal(competitionFactor(320, 300, false), 1); // cap = 330
  });

  test('acima da meta e acima do teto → reduz até o teto (mediano +10%)', () => {
    // nosso 400, cap 330 → adj 0.825 → clampa em 0.85
    assert.equal(competitionFactor(400, 300, false), 0.85);
    // nosso 350, cap 330 → adj 330/350 ≈ 0.9429 (dentro do clamp)
    assert.ok(Math.abs(competitionFactor(350, 300, false) - 330 / 350) < 1e-9);
  });
});

// ── median / clampPrice — utilitários ────────────────────────────────────────
describe('[PRICING] median e clampPrice', () => {
  test('median: vazio/null → null', () => {
    assert.equal(median([]), null);
    assert.equal(median(null), null);
  });

  test('median: quantidade ímpar → valor central', () => {
    assert.equal(median([300, 100, 200]), 200);
  });

  test('median: quantidade par → média dos centrais', () => {
    assert.equal(median([100, 200, 300, 400]), 250);
  });

  test('clampPrice respeita piso e teto das settings', () => {
    const s = { price_floor: 155, price_ceiling: 550 };
    assert.equal(clampPrice(100, s), 155);
    assert.equal(clampPrice(600, s), 550);
    assert.equal(clampPrice(300, s), 300);
  });

  test('clampPrice arredonda para inteiro', () => {
    const s = { price_floor: 155, price_ceiling: 550 };
    assert.equal(clampPrice(299.6, s), 300);
  });
});

// ── computeDateMultiplier — combinação de fatores ────────────────────────────
describe('[PRICING] computeDateMultiplier', () => {
  test('override do dono vence o algoritmo e marca locked', () => {
    const r = computeDateMultiplier({
      daysAhead: 30,
      occupancyPct: 10,
      competitorMedian: 250,
      referencePrice: 300,
      override: { multiplier: 1.2, note: 'feriado municipal' },
    });
    assert.equal(r.multiplier, 1.2);
    assert.equal(r.locked, true);
    assert.ok(r.explanation.includes('travado manualmente'));
    assert.ok(r.explanation.includes('feriado municipal'));
  });

  test('na curva, sem concorrentes → multiplicador 1.0', () => {
    const expected = expectedOccupancy(30, DEFAULT_SETTINGS.target_occupancy);
    const r = computeDateMultiplier({
      daysAhead: 30,
      occupancyPct: expected,
      competitorMedian: null,
      referencePrice: 300,
    });
    assert.equal(r.multiplier, 1);
    assert.equal(r.locked, false);
  });

  test('data fraca de última hora combina ritmo + last-minute', () => {
    // 3 dias antes, ocupação 0% vs esperada ~66.5% → pacing 0.70, lastMin 0.85
    const r = computeDateMultiplier({
      daysAhead: 3,
      occupancyPct: 0,
      competitorMedian: null,
      referencePrice: 300,
    });
    assert.equal(r.multiplier, Math.round(0.70 * 0.85 * 10000) / 10000);
    assert.ok(r.explanation.includes('desconto extra'));
  });

  test('multiplicador combinado nunca sai de [0.50, 1.50]', () => {
    const low = computeDateMultiplier({
      daysAhead: 3,
      occupancyPct: 0,
      competitorMedian: 100, // empurra ainda mais para baixo
      referencePrice: 300,
    });
    assert.ok(low.multiplier >= 0.50, `multiplier ${low.multiplier} < 0.50`);

    const high = computeDateMultiplier({
      daysAhead: 60,
      occupancyPct: 100,
      competitorMedian: 1000,
      referencePrice: 300,
    });
    assert.ok(high.multiplier <= 1.50, `multiplier ${high.multiplier} > 1.50`);
  });

  test('factors expõem os componentes para auditoria', () => {
    const r = computeDateMultiplier({
      daysAhead: 14,
      occupancyPct: 20,
      competitorMedian: 280,
      referencePrice: 300,
    });
    assert.ok(Number.isFinite(r.factors.pacing));
    assert.ok(Number.isFinite(r.factors.lastMinute));
    assert.ok(Number.isFinite(r.factors.competition));
    assert.equal(r.factors.daysAhead, 14);
    assert.equal(r.factors.competitorMedian, 280);
  });
});

// ── getQuoteAdjustment — gate do pricing_mode ────────────────────────────────
describe('[PRICING] getQuoteAdjustment — modo off/auto', () => {
  afterEach(() => invalidateCache());

  test('sem cache (cold start) → null, cotação não muda', () => {
    invalidateCache();
    // _cacheTs=0 dispara refresh em background (falha sem env) e retorna null
    assert.equal(getQuoteAdjustment('2026-07-01'), null);
  });

  test('pricing_mode off → null mesmo com multiplicador calculado', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'off' },
      multipliersByDate: { '2026-07-01': { multiplier: 0.8, locked: false, factors: {} } },
    });
    assert.equal(getQuoteAdjustment('2026-07-01'), null);
  });

  test('pricing_mode auto → retorna multiplicador, piso e teto', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'auto' },
      multipliersByDate: { '2026-07-01': { multiplier: 0.8, locked: false, factors: { pacing: 0.8 } } },
    });
    const adj = getQuoteAdjustment('2026-07-01');
    assert.equal(adj.multiplier, 0.8);
    assert.equal(adj.floor, DEFAULT_SETTINGS.price_floor);
    assert.equal(adj.ceiling, DEFAULT_SETTINGS.price_ceiling);
    assert.equal(adj.locked, false);
  });

  test('data fora do calendário → null', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'auto' },
      multipliersByDate: { '2026-07-01': { multiplier: 0.8, locked: false, factors: {} } },
    });
    assert.equal(getQuoteAdjustment('2027-01-01'), null);
  });
});

// ── Integração com o engine de cotação ───────────────────────────────────────
describe('[PRICING] integração engine.calculateQuotation', () => {
  const { calculateQuotation } = require('../services/quotation/engine');

  afterEach(() => invalidateCache());

  test('modo off → cotação idêntica à atual (baixa ALA_A R$600)', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'off' },
      multipliersByDate: {
        '2026-04-14': { multiplier: 0.8, locked: false, factors: {} },
        '2026-04-15': { multiplier: 0.8, locked: false, factors: {} },
      },
    });
    const q = calculateQuotation({
      data_entrada: '14/04/2026', // terça, baixa temporada
      data_saida:   '16/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined);
    assert.equal(q.totalFinal, 600); // 2 × R$300, sem ajuste
    assert.equal(q.dynamicPricing, false);
  });

  test('modo auto com desconto → noites de R$300 viram R$240 (×0.8)', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'auto' },
      multipliersByDate: {
        '2026-04-14': { multiplier: 0.8, locked: false, factors: {} },
        '2026-04-15': { multiplier: 0.8, locked: false, factors: {} },
      },
    });
    const q = calculateQuotation({
      data_entrada: '14/04/2026',
      data_saida:   '16/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined);
    assert.equal(q.totalFinal, 480); // 2 × R$240
    assert.equal(q.dynamicPricing, true);
  });

  test('resultado é clampado no piso (multiplicador agressivo demais)', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'auto', price_floor: 250 },
      multipliersByDate: {
        '2026-04-14': { multiplier: 0.5, locked: false, factors: {} },
        '2026-04-15': { multiplier: 0.5, locked: false, factors: {} },
      },
    });
    const q = calculateQuotation({
      data_entrada: '14/04/2026',
      data_saida:   '16/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined);
    // 300 × 0.5 = 150 → clampa no piso de 250 por noite
    assert.equal(q.totalFinal, 500);
  });

  test('resultado é clampado no teto (alta temporada com aumento)', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'auto', price_ceiling: 450 },
      multipliersByDate: {
        '2026-07-01': { multiplier: 1.4, locked: false, factors: {} },
        '2026-07-02': { multiplier: 1.4, locked: false, factors: {} },
      },
    });
    const q = calculateQuotation({
      data_entrada: '01/07/2026', // julho = alta (R$400 base)
      data_saida:   '03/07/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined);
    // 400 × 1.4 = 560 → clampa no teto de 450 por noite
    assert.equal(q.totalFinal, 900);
  });

  test('noites sem entrada no calendário ficam no preço base', () => {
    __setCacheForTests({
      settings: { ...DEFAULT_SETTINGS, pricing_mode: 'auto' },
      multipliersByDate: {
        '2026-04-14': { multiplier: 0.8, locked: false, factors: {} },
        // 2026-04-15 ausente de propósito
      },
    });
    const q = calculateQuotation({
      data_entrada: '14/04/2026',
      data_saida:   '16/04/2026',
      tipo:         'ALA_A',
      pessoas:      '2',
    });
    assert.equal(q.error, undefined);
    assert.equal(q.totalFinal, 240 + 300); // 1ª noite ajustada, 2ª no base
  });
});
