'use strict';

const { supabaseAdmin } = require('../supabase/client');

// ---------------------------------------------------------------------------
// State labels for display
// ---------------------------------------------------------------------------
const STATE_LABELS = {
  GREETING: 'Início',
  COLLECT_NAME: 'Coletando Nome',
  ASK_DATES: 'Buscando Datas',
  ASK_GUESTS: 'Verificando Hóspedes',
  SHOW_ROOMS: 'Apresentando Quartos',
  SEND_QUOTE: 'Cotação Enviada',
  CONFIRM_BOOKING: 'Confirmando Reserva',
  HANDOFF_HUMAN: 'Atendimento Humano',
};

// Ordered list of FSM states for funnel display
const FSM_ORDER = [
  'GREETING',
  'COLLECT_NAME',
  'ASK_DATES',
  'ASK_GUESTS',
  'SHOW_ROOMS',
  'SEND_QUOTE',
  'CONFIRM_BOOKING',
  'HANDOFF_HUMAN',
];

const STALLED_THRESHOLD_HOURS = 24;

/**
 * Returns the human-readable label for a given FSM state.
 * @param {string} state
 * @returns {string}
 */
function getLabelForState(state) {
  return STATE_LABELS[state] || state;
}

/**
 * Calculates the difference in hours between two ISO date strings.
 * @param {string} start
 * @param {string} end
 * @returns {number}
 */
function diffHours(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms / (1000 * 60 * 60);
}

/**
 * Fetches and aggregates funnel analytics for the given period.
 *
 * @param {number} periodDays - Number of days to look back (default 30)
 * @param {object} [supabaseClient] - Optional Supabase client; uses supabaseAdmin if omitted
 * @returns {Promise<object>} Funnel data with per-stage metrics and global KPIs
 */
async function getFunnelData(periodDays = 30, supabaseClient) {
  const client = supabaseClient || supabaseAdmin;

  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Fetch all conversation_states created within the period
  const { data: states, error } = await client
    .from('conversation_states')
    .select('lead_id, phone, state, data, created_at, updated_at, expires_at')
    .gte('created_at', since);

  if (error) {
    throw new Error(`Failed to fetch conversation_states: ${error.message}`);
  }

  const rows = states || [];

  // ---------------------------------------------------------------------------
  // Group rows by state
  // ---------------------------------------------------------------------------
  const groupedByState = {};
  for (const row of rows) {
    const s = row.state;
    if (!groupedByState[s]) {
      groupedByState[s] = [];
    }
    groupedByState[s].push(row);
  }

  // ---------------------------------------------------------------------------
  // Build per-stage metrics
  // ---------------------------------------------------------------------------
  const stages = FSM_ORDER.map((state) => {
    const stateRows = groupedByState[state] || [];
    const count = stateRows.length;

    const stalledRows = stateRows.filter((row) => {
      const updatedAt = new Date(row.updated_at).getTime();
      const hoursAgo = (Date.now() - updatedAt) / (1000 * 60 * 60);
      return hoursAgo > STALLED_THRESHOLD_HOURS;
    });

    const stalledCount = stalledRows.length;

    // avg_time_hours: mean of (updated_at - created_at) across all rows in this state
    const totalTimeHours = stateRows.reduce((acc, row) => {
      return acc + Math.abs(diffHours(row.created_at, row.updated_at));
    }, 0);
    const avgTimeHours = count > 0 ? totalTimeHours / count : 0;

    const dropOffRate = count > 0 ? stalledCount / count : 0;

    const leads = stateRows.map((row) => {
      const timeInStageHours = Math.abs(diffHours(row.created_at, row.updated_at));
      // score and score_label may not exist in conversation_states; they're on the leads table
      // The data JSONB may contain score info; fall back to null if absent
      const score = (row.data && row.data.score != null) ? row.data.score : null;
      const scoreLabel = (row.data && row.data.score_label) ? row.data.score_label : null;

      return {
        lead_id: row.lead_id,
        phone: row.phone,
        score,
        score_label: scoreLabel,
        time_in_stage_hours: parseFloat(timeInStageHours.toFixed(2)),
      };
    });

    return {
      name: state,
      label: getLabelForState(state),
      count,
      stalled_count: stalledCount,
      avg_time_hours: parseFloat(avgTimeHours.toFixed(2)),
      drop_off_rate: parseFloat(dropOffRate.toFixed(4)),
      leads,
    };
  });

  // Also handle any unknown states not in FSM_ORDER
  for (const [state, stateRows] of Object.entries(groupedByState)) {
    if (!FSM_ORDER.includes(state)) {
      const count = stateRows.length;
      const stalledCount = stateRows.filter((row) => {
        const hoursAgo = (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60);
        return hoursAgo > STALLED_THRESHOLD_HOURS;
      }).length;
      const totalTimeHours = stateRows.reduce((acc, row) => acc + Math.abs(diffHours(row.created_at, row.updated_at)), 0);
      const avgTimeHours = count > 0 ? totalTimeHours / count : 0;
      const dropOffRate = count > 0 ? stalledCount / count : 0;

      stages.push({
        name: state,
        label: getLabelForState(state),
        count,
        stalled_count: stalledCount,
        avg_time_hours: parseFloat(avgTimeHours.toFixed(2)),
        drop_off_rate: parseFloat(dropOffRate.toFixed(4)),
        leads: stateRows.map((row) => ({
          lead_id: row.lead_id,
          phone: row.phone,
          score: (row.data && row.data.score != null) ? row.data.score : null,
          score_label: (row.data && row.data.score_label) ? row.data.score_label : null,
          time_in_stage_hours: parseFloat(Math.abs(diffHours(row.created_at, row.updated_at)).toFixed(2)),
        })),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Global metrics
  // ---------------------------------------------------------------------------
  const totalActiveLeads = rows.length;

  const greetingCount = (groupedByState['GREETING'] || []).length;
  const confirmCount = (groupedByState['CONFIRM_BOOKING'] || []).length;
  const conversionRate = greetingCount > 0
    ? parseFloat((confirmCount / greetingCount).toFixed(4))
    : 0;

  const totalAllHours = rows.reduce((acc, row) => {
    return acc + Math.abs(diffHours(row.created_at, row.updated_at));
  }, 0);
  const avgFunnelTimeHours = totalActiveLeads > 0
    ? parseFloat((totalAllHours / totalActiveLeads).toFixed(2))
    : 0;

  // Bottleneck: stage with the highest stalled_count (among FSM_ORDER stages)
  let bottleneckStage = null;
  let maxStalled = -1;
  for (const stage of stages) {
    if (FSM_ORDER.includes(stage.name) && stage.stalled_count > maxStalled) {
      maxStalled = stage.stalled_count;
      bottleneckStage = stage.name;
    }
  }

  return {
    stages,
    total_active_leads: totalActiveLeads,
    conversion_rate: conversionRate,
    avg_funnel_time_hours: avgFunnelTimeHours,
    bottleneck_stage: bottleneckStage,
    period_days: periodDays,
  };
}

module.exports = { getFunnelData };
