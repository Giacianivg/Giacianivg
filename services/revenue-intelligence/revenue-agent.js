'use strict';

/**
 * Revenue Agent (Maxwell) — PLU-24 / DEC-018
 *
 * Revenue Manager virtual da Pousada Luz da Lua.
 * Consome competitor_prices, detecta padrões e gera alertas acionáveis.
 *
 * Maxwell NUNCA altera preços. Sugere → Vitor aprova.
 */

const { supabaseAdmin } = require('../supabase/client');
const {
  getSeason,
  getEventForDate,
  getEventsInRange,
  computePricePosition,
  computeSuggestedPrice,
  detectPriceChanges,
} = require('./demand-signals');
const { insertAlert } = require('./alert-generator');

// ─── Preços base da Pousada Luz da Lua por room_type ─────────────────────────

const OWN_PRICES = {
  standard: { baixa: 280, media: 300, alta: 380 },
  casal:    { baixa: 300, media: 300, alta: 400 },
  familia:  { baixa: 350, media: 400, alta: 500 },
  grupo:    { baixa: 600, media: 700, alta: 800 },
};

function getOwnPrice(roomType, season) {
  const rt = OWN_PRICES[roomType] || OWN_PRICES.casal;
  return rt[season] || rt.baixa;
}

// ─── Helper: hoje e ontem em ISO ──────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, n) {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── analyzeCompetitorPricing ─────────────────────────────────────────────────

/**
 * Analisa posicionamento competitivo para uma data e tipo de quarto.
 * @param {string} date      - YYYY-MM-DD
 * @param {string} roomType  - standard | casal | familia | grupo
 * @returns {{ our_price, avg_regional, diff_pct, position, recommendation, sample_count }}
 */
async function analyzeCompetitorPricing(date, roomType = 'casal') {
  const { data, error } = await supabaseAdmin
    .from('competitor_prices')
    .select('price, competitor_name')
    .eq('date', date)
    .eq('room_type', roomType)
    .eq('availability', true);

  if (error) throw new Error(`analyzeCompetitorPricing: ${error.message}`);

  const validPrices = (data || []).filter(p => p.price > 0).map(p => p.price);
  const season      = getSeason(date);
  const ourPrice    = getOwnPrice(roomType, season);
  const position    = computePricePosition(ourPrice, validPrices);

  let recommendation = 'Mantainho preço atual.';
  if (position.position === 'acima') {
    recommendation = `Considere reduzir ${position.diff_pct}% para alinhar com a média regional (R$${position.avg}).`;
  } else if (position.position === 'abaixo') {
    recommendation = `Oportunidade: você está ${Math.abs(position.diff_pct)}% abaixo. Pode subir até R$${position.avg} sem perder competitividade.`;
  }

  return {
    date,
    room_type:    roomType,
    season,
    our_price:    ourPrice,
    avg_regional: position.avg,
    diff_pct:     position.diff_pct,
    position:     position.position,
    sample_count: validPrices.length,
    recommendation,
  };
}

// ─── detectDemandSignals ──────────────────────────────────────────────────────

/**
 * Detecta sinais de demanda para um período.
 * @param {string} from - YYYY-MM-DD
 * @param {string} to   - YYYY-MM-DD
 * @returns {{ events, high_demand_dates, price_changes }}
 */
async function detectDemandSignals(from, to) {
  const events = getEventsInRange(from, to);

  // Busca preços hoje e ontem para detectar variações
  const yesterday = addDaysISO(todayISO(), -1);
  const [todayData, yesterdayData] = await Promise.all([
    supabaseAdmin
      .from('competitor_prices')
      .select('competitor_name, price, room_type, date')
      .gte('date', from)
      .lte('date', to)
      .eq('source', 'apify'),
    supabaseAdmin
      .from('competitor_prices')
      .select('competitor_name, price, room_type, date')
      .eq('date', yesterday)
      .eq('source', 'apify'),
  ]);

  const priceChanges = detectPriceChanges(
    todayData.data || [],
    yesterdayData.data || []
  );

  // Datas com média regional alta (>R$350 para casal)
  const byDate = {};
  (todayData.data || []).forEach(p => {
    if (p.room_type !== 'casal' || !p.price) return;
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push(p.price);
  });
  const highDemandDates = Object.entries(byDate)
    .filter(([, prices]) => {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      return avg > 350;
    })
    .map(([date]) => date);

  return { events, high_demand_dates: highDemandDates, price_changes: priceChanges };
}

// ─── suggestPrice ─────────────────────────────────────────────────────────────

/**
 * Sugere o preço ideal para uma data e tipo de quarto.
 * @returns {{ suggested_price, current_price, delta, reason, confidence_pct }}
 */
async function suggestPrice(date, roomType = 'casal') {
  const analysis = await analyzeCompetitorPricing(date, roomType);
  const season   = analysis.season;
  const event    = getEventForDate(date);

  if (!analysis.avg_regional) {
    return {
      date, room_type: roomType,
      suggested_price: analysis.our_price,
      current_price:   analysis.our_price,
      delta:           0,
      reason:          'Sem dados de concorrentes para esta data.',
      confidence_pct:  0,
    };
  }

  const suggestion = computeSuggestedPrice(analysis.avg_regional, season, analysis.sample_count);

  const parts = [`Concorrentes: R$${analysis.avg_regional}`];
  if (event) parts.push(`Evento: ${event.label}`);
  parts.push(`Temporada: ${season}`);
  parts.push(`Ocupação estimada: ${suggestion.occupancy_pct}%`);
  const reason = parts.join(' · ');

  return {
    date,
    room_type:       roomType,
    suggested_price: suggestion.suggested_price,
    current_price:   analysis.our_price,
    delta:           suggestion.suggested_price - analysis.our_price,
    reason,
    confidence_pct:  suggestion.confidence_pct,
  };
}

// ─── generateDailyReport ─────────────────────────────────────────────────────

/**
 * Gera relatório diário — chamado após o cron de scraping (PLU-23).
 * Analisa os próximos 14 dias e insere alertas para anomalias detectadas.
 * @returns {{ alerts_generated: number, errors: string[] }}
 */
async function generateDailyReport() {
  const from    = todayISO();
  const to      = addDaysISO(from, 14);
  const report  = { alerts_generated: 0, errors: [] };

  // 1. Detectar sinais de demanda
  let signals;
  try {
    signals = await detectDemandSignals(from, to);
  } catch (err) {
    report.errors.push(`detectDemandSignals: ${err.message}`);
    return report;
  }

  // 2. Alertar sobre variações de preço dos concorrentes
  for (const change of signals.price_changes) {
    const type = change.direction === 'down' ? 'competitor_price_drop' : 'competitor_price_surge';
    try {
      const id = await insertAlert(type, change);
      if (id) report.alerts_generated++;
    } catch (err) {
      report.errors.push(`insertAlert ${type}: ${err.message}`);
    }
  }

  // 3. Alertar sobre alta demanda (feriados + concorrentes caros)
  for (const ev of signals.events) {
    const dateRef = ev.from;
    try {
      const id = await insertAlert('high_demand_signal', {
        date:          dateRef,
        event_label:   ev.label,
        occupancy_pct: 85,
      });
      if (id) report.alerts_generated++;
    } catch (err) {
      report.errors.push(`insertAlert high_demand: ${err.message}`);
    }
  }

  // 4. Analisar posicionamento de preço para os próximos 7 dias (quarto casal)
  let d = from;
  for (let i = 0; i < 7; i++) {
    try {
      const analysis = await analyzeCompetitorPricing(d, 'casal');
      if (!analysis.avg_regional) { d = addDaysISO(d, 1); continue; }

      if (analysis.position === 'acima') {
        const id = await insertAlert('you_expensive', {
          date:         d,
          our_price:    analysis.our_price,
          avg_regional: analysis.avg_regional,
          diff_pct:     analysis.diff_pct,
          room_type:    'casal',
        });
        if (id) report.alerts_generated++;
      } else if (analysis.position === 'abaixo') {
        const id = await insertAlert('you_cheap_opportunity', {
          date:         d,
          our_price:    analysis.our_price,
          avg_regional: analysis.avg_regional,
          diff_pct:     analysis.diff_pct,
          room_type:    'casal',
        });
        if (id) report.alerts_generated++;
      }
    } catch (err) {
      report.errors.push(`analyzeDay ${d}: ${err.message}`);
    }
    d = addDaysISO(d, 1);
  }

  console.log(`[revenue-agent] Daily report — ${report.alerts_generated} alertas gerados`);
  return report;
}

module.exports = {
  analyzeCompetitorPricing,
  detectDemandSignals,
  suggestPrice,
  generateDailyReport,
  getOwnPrice,
  OWN_PRICES,
};
