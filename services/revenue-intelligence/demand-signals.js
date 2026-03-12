'use strict';

/**
 * Demand Signals — PLU-24 / DEC-018
 *
 * Funções puras de análise de demanda regional.
 * Não fazem chamadas ao banco — recebem dados como parâmetros.
 * Exportadas separadamente para facilitar testes unitários.
 */

// ─── Calendário de eventos / feriados 2026 ────────────────────────────────────

const EVENTS = [
  { from: '2026-02-13', to: '2026-02-18', label: 'Carnaval',           season: 'alta' },
  { from: '2026-03-28', to: '2026-04-06', label: 'Páscoa',             season: 'alta' },
  { from: '2026-06-04', to: '2026-06-07', label: 'EBAA + Corpus',      season: 'alta' },
  { from: '2026-09-05', to: '2026-09-07', label: 'Independência',      season: 'alta' },
  { from: '2026-10-10', to: '2026-10-12', label: 'Aparecida',          season: 'alta' },
  { from: '2026-11-20', to: '2026-11-22', label: 'Consciência Negra',  season: 'alta' },
  { from: '2026-12-24', to: '2027-01-02', label: 'Natal/Réveillon',    season: 'alta' },
];

// ─── Estações ─────────────────────────────────────────────────────────────────

/**
 * Retorna a estação da data: 'alta' | 'media' | 'baixa'
 */
function getSeason(dateISO) {
  const ev = getEventForDate(dateISO);
  if (ev) return 'alta';
  const [y, m] = dateISO.split('-').map(Number);
  if (m === 1 || m === 7 || m === 12) return 'alta';
  const dow = new Date(dateISO + 'T12:00:00').getDay();
  if (dow === 0 || dow === 6) return 'media';
  return 'baixa';
}

/**
 * Retorna o evento que cobre a data (ou null).
 */
function getEventForDate(dateISO) {
  return EVENTS.find(e => dateISO >= e.from && dateISO <= e.to) || null;
}

/**
 * Retorna eventos no período [from, to] (inclusive).
 */
function getEventsInRange(from, to) {
  return EVENTS.filter(e => e.from <= to && e.to >= from);
}

// ─── Fatores de precificação ──────────────────────────────────────────────────

/**
 * Retorna o fator de sazonalidade para o preço sugerido.
 */
function getSeasonFactor(season) {
  return { alta: 1.30, media: 1.10, baixa: 1.00 }[season] || 1.00;
}

/**
 * Estima o fator de ocupação regional com base na temporada.
 * Sem dados reais de ocupação, usa heurística pela estação.
 * @param {string} season - 'alta' | 'media' | 'baixa'
 * @returns {{ factor: number, occupancy_pct: number }}
 */
function estimateOccupancyFactor(season) {
  const map = {
    alta:  { factor: 1.20, occupancy_pct: 85 },
    media: { factor: 1.10, occupancy_pct: 65 },
    baixa: { factor: 1.00, occupancy_pct: 45 },
  };
  return map[season] || map.baixa;
}

// ─── Análise de variação de preços ───────────────────────────────────────────

/**
 * Detecta variações de preço entre dois conjuntos de dados do mesmo concorrente.
 * @param {Array} currentPrices  - preços de hoje [{ competitor_name, price, date, room_type }]
 * @param {Array} previousPrices - preços de ontem
 * @returns {Array} mudanças: [{ competitor_name, prev_price, curr_price, change_pct, direction }]
 */
function detectPriceChanges(currentPrices, previousPrices) {
  const changes = [];
  const prevMap = {};

  previousPrices.forEach(p => {
    const key = `${p.competitor_name}::${p.room_type}`;
    prevMap[key] = p.price;
  });

  currentPrices.forEach(curr => {
    const key = `${curr.competitor_name}::${curr.room_type}`;
    const prev = prevMap[key];
    if (!prev || !curr.price) return;

    const changePct = Math.round(((curr.price - prev) / prev) * 100);
    if (Math.abs(changePct) >= 10) {
      changes.push({
        competitor_name: curr.competitor_name,
        prev_price:  prev,
        curr_price:  curr.price,
        change_pct:  changePct,
        direction:   changePct > 0 ? 'up' : 'down',
        room_type:   curr.room_type,
        date:        curr.date,
      });
    }
  });

  return changes;
}

/**
 * Calcula posicionamento de preço próprio vs média regional.
 * @param {number} ourPrice
 * @param {number[]} competitorPrices
 * @returns {{ avg, diff_pct, position: 'acima'|'abaixo'|'alinhado'|'sem_dados' }}
 */
function computePricePosition(ourPrice, competitorPrices) {
  const valid = competitorPrices.filter(p => p > 0);
  if (!valid.length) return { avg: null, diff_pct: null, position: 'sem_dados' };

  const avg     = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  const diffPct = ourPrice && avg ? Math.round(((ourPrice - avg) / avg) * 100) : null;

  let position = 'alinhado';
  if (diffPct !== null) {
    if (diffPct > 15)  position = 'acima';
    if (diffPct < -15) position = 'abaixo';
  }

  return { avg, diff_pct: diffPct, position };
}

/**
 * Sugere o preço ideal dado contexto de mercado.
 * @param {number} avgRegional - média dos concorrentes
 * @param {string} season      - 'alta' | 'media' | 'baixa'
 * @param {number} sampleCount - quantos concorrentes deram dados
 * @returns {{ suggested_price, fator_sazonalidade, fator_ocupacao, confidence_pct }}
 */
function computeSuggestedPrice(avgRegional, season, sampleCount) {
  if (!avgRegional) return null;

  const fatorSazon = getSeasonFactor(season);
  const { factor: fatorOcup, occupancy_pct } = estimateOccupancyFactor(season);

  const suggested = Math.round((avgRegional * fatorSazon * fatorOcup) / 10) * 10;
  const confidence = Math.min(100, Math.round((sampleCount / 10) * 100));

  return {
    suggested_price:     suggested,
    fator_sazonalidade:  fatorSazon,
    fator_ocupacao:      fatorOcup,
    occupancy_pct,
    confidence_pct:      confidence,
  };
}

module.exports = {
  EVENTS,
  getSeason,
  getEventForDate,
  getEventsInRange,
  getSeasonFactor,
  estimateOccupancyFactor,
  detectPriceChanges,
  computePricePosition,
  computeSuggestedPrice,
};
