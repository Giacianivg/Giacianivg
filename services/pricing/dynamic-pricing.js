'use strict';

/**
 * Motor de Precificação Dinâmica — Fase 1.5
 * Objetivo: ocupação de 70%/mês maximizando receita.
 *
 * Calcula um MULTIPLICADOR por data (próximos 90 dias) com 3 fatores:
 *   1. Ritmo  — ocupação real da data vs curva de pickup esperada para a meta:
 *               abaixo da curva → desconto progressivo até -30%
 *               acima da curva  → aumento progressivo até +40%
 *   2. Antecedência — menos de 7 dias com ocupação < 50% → desconto extra
 *   3. Concorrência — com dados em competitor_prices: posiciona 5-10% abaixo
 *               do mediano quando abaixo da meta, até 10% acima quando acima
 *
 * Preço final = preço base do quarto × multiplicador, SEMPRE clampado em
 * [price_floor, price_ceiling] (settings).
 *
 * pricing_mode (settings): 'off' (padrão) → getQuoteAdjustment retorna null e
 * NADA muda na cotação da Luna. 'auto' → engine.js aplica o multiplicador.
 *
 * Override do dono (price_overrides): quando a data tem linha lá, o
 * multiplicador manual vence o algoritmo.
 *
 * Padrão de cache: igual a settings/branding.js — leitura síncrona do cache
 * com refresh em background (TTL 5 min), nunca bloqueia a cotação.
 */

const DEFAULT_SETTINGS = {
  price_floor: 155,
  price_ceiling: 550,
  target_occupancy: 70,
  pricing_mode: 'off',
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);

// Curva de pickup: fração da meta que já deveria estar vendida X dias antes
// do check-in. Ex.: 30 dias antes, uma data saudável já tem 65% da meta.
const PICKUP_CURVE = [
  [0, 1.00],
  [3, 0.95],
  [7, 0.90],
  [14, 0.80],
  [30, 0.65],
  [60, 0.45],
  [90, 0.30],
];

// Limites dos fatores (spec Fase 1.5)
const PACING_MIN = 0.70;        // desconto máximo de ritmo: -30%
const PACING_MAX = 1.40;        // aumento máximo de ritmo: +40%
const PACING_SLOPE = 0.5;       // progressividade (50% do desvio da curva)
const LAST_MINUTE_FACTOR = 0.85; // desconto extra de -15% (<7 dias, ocupação <50%)
const COMPETITION_MIN = 0.85;   // ajuste de concorrência nunca corta mais de 15%
const COMPETITION_MAX = 1.15;   // nem sobe mais de 15%
const MULTIPLIER_MIN = 0.50;    // sanidade global do multiplicador combinado
const MULTIPLIER_MAX = 1.50;

const RESERVATION_ACTIVE_STATUSES = ['confirmed', 'checked_in', 'completed'];

// ─── Funções puras (testáveis sem banco) ─────────────────────────────────────

/**
 * Ocupação esperada (%) para uma data a `daysAhead` dias, dado o alvo mensal.
 * Interpolação linear sobre PICKUP_CURVE; além de 90 dias usa o último ponto.
 */
function expectedOccupancy(daysAhead, targetOccupancy) {
  const d = Math.max(0, daysAhead);
  let frac = PICKUP_CURVE[PICKUP_CURVE.length - 1][1];
  for (let i = 0; i < PICKUP_CURVE.length - 1; i++) {
    const [d0, f0] = PICKUP_CURVE[i];
    const [d1, f1] = PICKUP_CURVE[i + 1];
    if (d <= d1) {
      frac = f0 + ((d - d0) / (d1 - d0)) * (f1 - f0);
      break;
    }
  }
  return targetOccupancy * frac;
}

/**
 * Fator de ritmo: razão entre ocupação real e esperada.
 * ratio 1.0 = na curva → 1.0 | abaixo → desconto até -30% | acima → até +40%.
 */
function pacingFactor(occupancyPct, expectedPct) {
  if (expectedPct <= 0) return 1;
  const ratio = occupancyPct / expectedPct;
  if (ratio >= 1) return Math.min(1 + (ratio - 1) * PACING_SLOPE, PACING_MAX);
  return Math.max(1 - (1 - ratio) * PACING_SLOPE, PACING_MIN);
}

/** Desconto agressivo extra: menos de 7 dias e ocupação abaixo de 50%. */
function lastMinuteFactor(daysAhead, occupancyPct) {
  return (daysAhead < 7 && occupancyPct < 50) ? LAST_MINUTE_FACTOR : 1;
}

/**
 * Fator de concorrência. ourProjectedPrice = preço de referência × fatores já
 * aplicados. Abaixo da meta → mira 7,5% abaixo do mediano dos concorrentes
 * (meio da faixa 5-10%); acima da meta → permite até 10% acima do mediano.
 * Ajuste limitado a ±15% para não dominar os demais fatores.
 */
function competitionFactor(ourProjectedPrice, competitorMedian, belowTarget) {
  if (!competitorMedian || !ourProjectedPrice || ourProjectedPrice <= 0) return 1;
  let desired;
  if (belowTarget) {
    desired = competitorMedian * 0.925; // 7,5% abaixo do mediano
  } else {
    const cap = competitorMedian * 1.10; // até 10% acima do mediano
    if (ourProjectedPrice <= cap) return 1;
    desired = cap;
  }
  const adj = desired / ourProjectedPrice;
  return Math.min(Math.max(adj, COMPETITION_MIN), COMPETITION_MAX);
}

/** Mediana simples. */
function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Clampa o preço final no piso/teto configurados. */
function clampPrice(price, settings) {
  const s = settings || DEFAULT_SETTINGS;
  return Math.min(Math.max(Math.round(price), s.price_floor), s.price_ceiling);
}

/**
 * Calcula o multiplicador de uma data e os fatores explicados.
 * @param {object} input - { daysAhead, occupancyPct, competitorMedian, referencePrice, override, settings }
 * @returns {object} { multiplier, locked, factors, explanation }
 */
function computeDateMultiplier(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input.settings || {}) };
  const { daysAhead, occupancyPct, competitorMedian, referencePrice, override } = input;

  if (override && Number.isFinite(Number(override.multiplier))) {
    const m = Number(override.multiplier);
    return {
      multiplier: m,
      locked: true,
      factors: { override: m, note: override.note || null },
      explanation: `Preço travado manualmente pelo dono (${fmtPct(m)})${override.note ? ` — ${override.note}` : ''}.`,
    };
  }

  const expectedPct = expectedOccupancy(daysAhead, settings.target_occupancy);
  const pacing = pacingFactor(occupancyPct, expectedPct);
  const lastMin = lastMinuteFactor(daysAhead, occupancyPct);
  const belowTarget = occupancyPct < expectedPct;
  const projected = (referencePrice || 0) * pacing * lastMin;
  const competition = competitionFactor(projected, competitorMedian, belowTarget);

  const raw = pacing * lastMin * competition;
  const multiplier = Math.min(Math.max(raw, MULTIPLIER_MIN), MULTIPLIER_MAX);

  const parts = [];
  parts.push(`Ocupação ${Math.round(occupancyPct)}% vs ${Math.round(expectedPct)}% esperada para a meta de ${settings.target_occupancy}% → ${pacing < 1 ? 'desconto' : pacing > 1 ? 'aumento' : 'sem ajuste'} de ritmo (${fmtPct(pacing)})`);
  if (lastMin < 1) parts.push(`Faltam menos de 7 dias com ocupação baixa → desconto extra (${fmtPct(lastMin)})`);
  if (competition !== 1 && competitorMedian) parts.push(`Concorrentes na mediana de R$ ${Math.round(competitorMedian)} → ajuste de posicionamento (${fmtPct(competition)})`);
  if (competition === 1 && competitorMedian) parts.push(`Concorrentes na mediana de R$ ${Math.round(competitorMedian)} — já bem posicionado`);

  return {
    multiplier: round4(multiplier),
    locked: false,
    factors: {
      pacing: round4(pacing),
      lastMinute: round4(lastMin),
      competition: round4(competition),
      occupancyPct: round2(occupancyPct),
      expectedPct: round2(expectedPct),
      competitorMedian: competitorMedian || null,
      daysAhead,
    },
    explanation: parts.join('. ') + '.',
  };
}

function round4(n) { return Math.round(n * 10000) / 10000; }
function round2(n) { return Math.round(n * 100) / 100; }
function fmtPct(mult) {
  const pct = Math.round((mult - 1) * 100);
  return pct === 0 ? '0%' : (pct > 0 ? `+${pct}%` : `${pct}%`);
}

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Acesso a dados ──────────────────────────────────────────────────────────

/**
 * Busca todos os insumos e monta o calendário de multiplicadores.
 * @param {number} days - horizonte (padrão 90)
 * @returns {Promise<{settings, days: Array}>}
 */
async function buildCalendar(days = 90) {
  const { supabaseAdmin } = require('../supabase/client');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fromIso = toIso(today);
  const toDate = new Date(today.getTime() + days * 86_400_000);
  const toIsoStr = toIso(toDate);

  const [settingsRes, roomsRes, reservationsRes, competitorsRes, overridesRes] = await Promise.all([
    supabaseAdmin.from('settings').select('key, value').in('key', SETTINGS_KEYS),
    supabaseAdmin.from('rooms').select('code, base_price_media').eq('active', true),
    supabaseAdmin.from('reservations')
      .select('checkin_date, checkout_date')
      .in('status', RESERVATION_ACTIVE_STATUSES)
      .lt('checkin_date', toIsoStr)
      .gte('checkout_date', fromIso),
    supabaseAdmin.from('competitor_prices')
      .select('date, price, availability')
      .gte('date', fromIso)
      .lte('date', toIsoStr),
    supabaseAdmin.from('price_overrides').select('date, multiplier, note'),
  ]);

  const settings = { ...DEFAULT_SETTINGS };
  for (const row of settingsRes.data || []) {
    if (row.key === 'pricing_mode') settings.pricing_mode = String(row.value);
    else if (Number.isFinite(Number(row.value))) settings[row.key] = Number(row.value);
  }

  const rooms = roomsRes.data || [];
  const totalRooms = rooms.length || 1;
  const referencePrice = median(rooms.map(r => Number(r.base_price_media)).filter(Number.isFinite));

  // Ocupação por data: reservas ativas que cobrem a noite
  const occupiedByDate = {};
  for (const r of reservationsRes.data || []) {
    const start = new Date(r.checkin_date + 'T00:00:00');
    const end = new Date(r.checkout_date + 'T00:00:00');
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const iso = toIso(d);
      occupiedByDate[iso] = (occupiedByDate[iso] || 0) + 1;
    }
  }

  // Mediana de concorrentes por data (apenas preços válidos e disponíveis)
  const competitorPricesByDate = {};
  for (const c of competitorsRes.data || []) {
    if (c.availability === false || !(Number(c.price) > 0)) continue;
    (competitorPricesByDate[c.date] = competitorPricesByDate[c.date] || []).push(Number(c.price));
  }

  const overridesByDate = {};
  for (const o of overridesRes.data || []) overridesByDate[o.date] = o;

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const iso = toIso(d);
    const occupancyPct = ((occupiedByDate[iso] || 0) / totalRooms) * 100;
    const calc = computeDateMultiplier({
      daysAhead: i,
      occupancyPct,
      competitorMedian: median(competitorPricesByDate[iso]),
      referencePrice,
      override: overridesByDate[iso],
      settings,
    });
    result.push({ date: iso, ...calc });
  }

  return { settings, referencePrice, totalRooms, days: result };
}

// ─── Cache síncrono para o engine de cotação (padrão branding.js) ───────────

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;      // { settings, multipliersByDate: { iso: {multiplier, locked, factors} } }
let _cacheTs = 0;
let _refreshing = false;
let _warnedOnce = false;
let _testMode = false;

function refreshInBackground() {
  if (_refreshing) return;
  _refreshing = true;
  buildCalendar(90)
    .then(cal => {
      const multipliersByDate = {};
      for (const day of cal.days) {
        multipliersByDate[day.date] = {
          multiplier: day.multiplier,
          locked: day.locked,
          factors: day.factors,
        };
      }
      _cache = { settings: cal.settings, multipliersByDate };
      _cacheTs = Date.now();
    })
    .catch(err => {
      if (!_warnedOnce) {
        _warnedOnce = true;
        console.warn('[dynamic-pricing] calendário indisponível, motor inerte:', err.message);
      }
      _cacheTs = Date.now();
    })
    .finally(() => { _refreshing = false; });
}

/**
 * Ajuste para a cotação da Luna (chamado pelo engine, SÍNCRONO).
 * Retorna null quando pricing_mode != 'auto' ou sem dados → engine não muda nada.
 * @param {string} isoDate - YYYY-MM-DD da noite
 * @returns {null|{multiplier:number, floor:number, ceiling:number, locked:boolean, factors:object}}
 */
function getQuoteAdjustment(isoDate) {
  if (!_testMode && (Date.now() - _cacheTs >= CACHE_TTL_MS)) refreshInBackground();
  if (!_cache) return null;
  if (_cache.settings.pricing_mode !== 'auto') return null;
  const entry = _cache.multipliersByDate[isoDate];
  if (!entry) return null;
  return {
    multiplier: entry.multiplier,
    floor: _cache.settings.price_floor,
    ceiling: _cache.settings.price_ceiling,
    locked: entry.locked,
    factors: entry.factors,
  };
}

/**
 * Auditoria: grava cálculo em price_log (fire-and-forget, nunca lança).
 * @param {object} entry - { date, room_code, base_price, multiplier, final_price, factors, source }
 */
function logPriceCalc(entry) {
  if (_testMode || process.env.NODE_ENV === 'test') return;
  try {
    const { supabaseAdmin } = require('../supabase/client');
    supabaseAdmin
      .from('price_log')
      .insert({
        date: entry.date,
        room_code: entry.room_code,
        base_price: entry.base_price,
        multiplier: entry.multiplier,
        final_price: entry.final_price,
        factors: entry.factors || {},
        source: entry.source || 'quote',
      })
      .then(({ error }) => {
        if (error) console.warn('[dynamic-pricing] falha ao gravar price_log:', error.message);
      });
  } catch (err) {
    console.warn('[dynamic-pricing] falha ao gravar price_log:', err.message);
  }
}

/** Invalida o cache (após salvar settings/overrides no dashboard). */
function invalidateCache() {
  _cache = null;
  _cacheTs = 0;
  _testMode = false;
}

/** Hook de teste: injeta cache sem tocar o banco e desliga refresh/log. */
function __setCacheForTests(cache) {
  _testMode = true;
  _cache = cache;
  _cacheTs = Date.now();
}

module.exports = {
  // puras
  expectedOccupancy,
  pacingFactor,
  lastMinuteFactor,
  competitionFactor,
  computeDateMultiplier,
  clampPrice,
  median,
  // dados
  buildCalendar,
  // integração engine
  getQuoteAdjustment,
  logPriceCalc,
  invalidateCache,
  __setCacheForTests,
  DEFAULT_SETTINGS,
};
