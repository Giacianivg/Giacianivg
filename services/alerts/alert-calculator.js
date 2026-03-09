'use strict';

const { supabaseAdmin } = require('../supabase/client');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hoursAgo(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000;
}

function parseDDMMYYYY(str) {
  if (!str) return null;
  const [day, month, year] = str.split('/');
  return new Date(`${year}-${month}-${day}`);
}

function daysUntil(date) {
  return (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// Alert priority definitions (evaluated in order, first match wins)
// Priority 1 = highest
// ---------------------------------------------------------------------------

const ALERT_PRIORITIES = {
  hot_lead: 1,
  quote_expiring: 2,
  checkin_soon: 3,
  stalled: 4,
  no_response: 5,
};

// ---------------------------------------------------------------------------
// calculateLeadAlert
// ---------------------------------------------------------------------------

/**
 * Evaluate alert priority for a lead and persist it to the leads table.
 *
 * @param {string} leadId
 * @param {object} [supabaseClient] — optional override (used in tests)
 * @returns {{ type: string|null, message: string|null, priority: number }}
 */
async function calculateLeadAlert(leadId, supabaseClient) {
  const db = supabaseClient || supabaseAdmin;

  // 1. Fetch conversation_states for this lead
  const { data: convState, error: convErr } = await db
    .from('conversation_states')
    .select('state, data, updated_at, created_at')
    .eq('lead_id', leadId)
    .single();

  // 2. Fetch lead for score and created_at
  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('id, score, created_at')
    .eq('id', leadId)
    .single();

  if (leadErr || !lead) {
    return { type: null, message: null, priority: 0 };
  }

  const state = convState ? convState.state : null;
  const stateData = convState ? (convState.data || {}) : {};
  const stateUpdatedAt = convState ? convState.updated_at : null;
  const score = lead.score || 0;

  let alertType = null;
  let alertMessage = null;

  // --- Priority 1: hot_lead ---
  // score > 75 AND inactive > 2h
  if (
    score > 75 &&
    stateUpdatedAt &&
    hoursAgo(stateUpdatedAt) > 2
  ) {
    const hours = Math.floor(hoursAgo(stateUpdatedAt));
    alertType = 'hot_lead';
    alertMessage = `🔥 Lead quente sem resposta há ${hours}h`;
  }

  // --- Priority 2: quote_expiring ---
  // state = 'SEND_QUOTE' AND inactive > 1h
  if (!alertType && state === 'SEND_QUOTE' && stateUpdatedAt && hoursAgo(stateUpdatedAt) > 1) {
    const hours = Math.floor(hoursAgo(stateUpdatedAt));
    alertType = 'quote_expiring';
    alertMessage = `⏰ Cotação enviada há ${hours}h sem retorno`;
  }

  // --- Priority 3: checkin_soon ---
  // data_entrada in < 7 days AND state != 'CONFIRM_BOOKING' AND state != 'HANDOFF_HUMAN'
  if (!alertType && stateData.data_entrada) {
    const checkinDate = parseDDMMYYYY(stateData.data_entrada);
    if (checkinDate) {
      const days = daysUntil(checkinDate);
      if (
        days >= 0 &&
        days < 7 &&
        state !== 'CONFIRM_BOOKING' &&
        state !== 'HANDOFF_HUMAN'
      ) {
        const daysRounded = Math.ceil(days);
        alertType = 'checkin_soon';
        alertMessage = `📅 Check-in em ${daysRounded} dias — sem confirmação`;
      }
    }
  }

  // --- Priority 4: stalled ---
  // updated_at > 48h ago AND state is not 'HANDOFF_HUMAN'
  if (!alertType && stateUpdatedAt && hoursAgo(stateUpdatedAt) > 48 && state !== 'HANDOFF_HUMAN') {
    const hours = Math.floor(hoursAgo(stateUpdatedAt));
    alertType = 'stalled';
    alertMessage = `💤 Parado em ${state} há ${hours}h`;
  }

  // --- Priority 5: no_response ---
  // lead created > 30 min ago AND never had a message with role='user' in conversations
  if (!alertType) {
    const leadCreatedAt = lead.created_at;
    const minutesSinceCreated = leadCreatedAt
      ? (Date.now() - new Date(leadCreatedAt).getTime()) / 60000
      : 0;

    if (minutesSinceCreated > 30) {
      // Check if lead has any user messages
      const { data: userMessages } = await db
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .eq('role', 'user')
        .single();

      if (!userMessages) {
        alertType = 'no_response';
        alertMessage = '👻 Nunca respondeu';
      }
    }
  }

  // Persist alert to leads table
  await db
    .from('leads')
    .update({
      alert_type: alertType,
      alert_message: alertMessage,
      alert_updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  const priority = alertType ? (ALERT_PRIORITIES[alertType] || 0) : 0;

  return { type: alertType, message: alertMessage, priority };
}

module.exports = { calculateLeadAlert };
