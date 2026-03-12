'use strict';

/**
 * Alert Generator — PLU-24 / DEC-018
 *
 * Formata e persiste alertas de revenue intelligence em `revenue_alerts`.
 */

const { supabaseAdmin } = require('../supabase/client');

// ─── Alert type metadata ──────────────────────────────────────────────────────

const ALERT_META = {
  you_expensive:            { urgency: 'high',   emoji: '⚠️' },
  you_cheap_opportunity:    { urgency: 'medium', emoji: '💡' },
  competitor_price_drop:    { urgency: 'medium', emoji: '📉' },
  competitor_price_surge:   { urgency: 'info',   emoji: '📈' },
  high_demand_signal:       { urgency: 'high',   emoji: '🔥' },
  low_season_warning:       { urgency: 'low',    emoji: '🌙' },
};

// ─── Message formatters ───────────────────────────────────────────────────────

function formatMessage(type, data) {
  const fmtDate = d => {
    if (!d) return '?';
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  };
  const fmtBRL = v => `R$${Math.round(v)}`;

  switch (type) {
    case 'you_expensive':
      return `Você está ${data.diff_pct}% mais caro que a média regional em ${fmtDate(data.date)} (nós: ${fmtBRL(data.our_price)} · região: ${fmtBRL(data.avg_regional)})`;

    case 'you_cheap_opportunity':
      return `Oportunidade de aumento: você está ${Math.abs(data.diff_pct)}% abaixo da média em ${fmtDate(data.date)} (nós: ${fmtBRL(data.our_price)} · região: ${fmtBRL(data.avg_regional)})`;

    case 'competitor_price_drop':
      return `${data.competitor_name} baixou preço: ${fmtBRL(data.prev_price)}→${fmtBRL(data.curr_price)} (${data.change_pct}%) em ${fmtDate(data.date)}`;

    case 'competitor_price_surge':
      return `${data.competitor_name} subiu preço: ${fmtBRL(data.prev_price)}→${fmtBRL(data.curr_price)} (+${data.change_pct}%) em ${fmtDate(data.date)}`;

    case 'high_demand_signal':
      return `Alta demanda prevista: ${data.event_label || 'período especial'} — ocupação regional estimada ${data.occupancy_pct}%`;

    case 'low_season_warning':
      return `Baixa temporada em ${fmtDate(data.date)}: média regional ${fmtBRL(data.avg_regional)} — considere promoção`;

    default:
      return `Alerta de revenue: ${type}`;
  }
}

// ─── Deduplication: evita inserir alerta duplicado no mesmo dia ───────────────

async function isDuplicate(type, dateRef, roomType) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from('revenue_alerts')
    .select('id')
    .eq('alert_type', type)
    .eq('date_ref', dateRef || today)
    .gte('created_at', today + 'T00:00:00Z')
    .limit(1);

  return Array.isArray(data) && data.length > 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Insere um alerta de revenue no banco.
 * Evita duplicatas do mesmo tipo/data no mesmo dia.
 * @returns {string|null} id do alerta inserido ou null se duplicado
 */
async function insertAlert(type, data = {}, overrides = {}) {
  const meta    = ALERT_META[type] || { urgency: 'info', emoji: '📊' };
  const message = overrides.message || formatMessage(type, data);
  const dateRef = data.date || overrides.date_ref || null;

  if (dateRef && await isDuplicate(type, dateRef, data.room_type)) {
    return null; // já existe alerta para esta combinação hoje
  }

  const { data: row, error } = await supabaseAdmin
    .from('revenue_alerts')
    .insert({
      alert_type: type,
      urgency:    overrides.urgency || meta.urgency,
      message,
      data:       data,
      date_ref:   dateRef,
      room_type:  data.room_type || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[alert-generator] insert failed (${type}):`, error.message);
    return null;
  }

  console.log(`[alert-generator] ${meta.emoji} ${type} — ${message}`);
  return row?.id || null;
}

/**
 * Retorna alertas ativos (não dispensados) mais recentes.
 */
async function getActiveRevenueAlerts(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('revenue_alerts')
    .select('id, alert_type, urgency, message, data, date_ref, room_type, created_at')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[alert-generator] fetch failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Marca alerta como dispensado.
 */
async function dismissAlert(id) {
  const { error } = await supabaseAdmin
    .from('revenue_alerts')
    .update({ dismissed: true })
    .eq('id', id);
  return !error;
}

module.exports = {
  insertAlert,
  getActiveRevenueAlerts,
  dismissAlert,
  formatMessage,
  ALERT_META,
};
