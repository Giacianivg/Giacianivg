'use strict';

const { supabaseAdmin } = require('../supabase/client');

const STAGE_PROBABILITIES = {
  GREETING: 0.05,
  COLLECT_NAME: 0.10,
  ASK_DATES: 0.20,
  ASK_GUESTS: 0.30,
  SHOW_ROOMS: 0.45,
  SEND_QUOTE: 0.60,
  CONFIRM_BOOKING: 0.90,
  HANDOFF_HUMAN: 0.35,
};

/**
 * Parse a DD/MM/YYYY date string and return a JS Date (UTC midnight).
 * Returns null if the string is falsy or unparseable.
 */
function parseDMY(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

/**
 * Return the number of nights between two ISO date strings (DATE columns).
 * Returns 0 if either is missing or result is negative.
 */
function nightsBetween(checkinISO, checkoutISO) {
  if (!checkinISO || !checkoutISO) return 0;
  const ms = new Date(checkoutISO) - new Date(checkinISO);
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
}

/**
 * Calculate pipeline revenue metrics.
 *
 * @param {object} [supabaseClient] - Optional Supabase client override (useful for tests).
 * @returns {Promise<object>} Revenue metrics object.
 */
async function getPipelineRevenue(supabaseClient) {
  const db = supabaseClient || supabaseAdmin;

  // 1. Fetch all active conversation_states (exclude HANDOFF_HUMAN)
  const { data: states, error: statesErr } = await db
    .from('conversation_states')
    .select('lead_id, phone, state, data')
    .eq('is_test', false)
    .neq('state', 'HANDOFF_HUMAN');

  if (statesErr) throw new Error(`Failed to fetch conversation_states: ${statesErr.message}`);

  const activeStates = states || [];

  // 2. Fetch ADR reference: last 10 confirmed reservations
  const { data: confirmedReservations, error: resErr } = await db
    .from('reservations')
    .select('total_amount, checkin_date, checkout_date')
    .eq('is_test', false)
    .in('status', ['confirmed', 'checked_in', 'completed'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (resErr) throw new Error(`Failed to fetch reservations: ${resErr.message}`);

  // Calculate ADR (average daily rate)
  let adr = 300; // sensible default if no history
  if (confirmedReservations && confirmedReservations.length > 0) {
    const validRates = confirmedReservations
      .map((r) => {
        const nights = nightsBetween(r.checkin_date, r.checkout_date);
        return nights > 0 ? Number(r.total_amount) / nights : null;
      })
      .filter((v) => v !== null && v > 0);

    if (validRates.length > 0) {
      adr = validRates.reduce((s, v) => s + v, 0) / validRates.length;
    }
  }

  // 3. Fetch confirmed revenue for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: recentConfirmed, error: recentErr } = await db
    .from('reservations')
    .select('total_amount')
    .eq('is_test', false)
    .in('status', ['confirmed', 'checked_in', 'completed'])
    .gte('created_at', thirtyDaysAgo);

  if (recentErr) throw new Error(`Failed to fetch recent confirmed reservations: ${recentErr.message}`);

  const confirmed_revenue = (recentConfirmed || []).reduce(
    (sum, r) => sum + Number(r.total_amount),
    0
  );

  // 4. For each active lead, determine potential and weighted value
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const in60Days = now + 60 * 24 * 60 * 60 * 1000;

  // Batch-fetch latest proposals for all active leads (status sent or viewed)
  const leadIds = activeStates.map((s) => s.lead_id).filter(Boolean);

  let proposalsByLead = {};
  if (leadIds.length > 0) {
    const { data: proposals, error: propErr } = await db
      .from('proposals')
      .select('lead_id, final_amount, created_at')
      .eq('is_test', false)
      .in('lead_id', leadIds)
      .in('status', ['sent', 'viewed'])
      .order('created_at', { ascending: false });

    if (propErr) throw new Error(`Failed to fetch proposals: ${propErr.message}`);

    // Keep only the most recent proposal per lead
    for (const p of proposals || []) {
      if (!proposalsByLead[p.lead_id]) {
        proposalsByLead[p.lead_id] = p;
      }
    }
  }

  // 5. Compute per-lead metrics
  let total_pipeline = 0;
  let weighted_pipeline = 0;
  let forecast_30d = 0;
  let forecast_60d = 0;
  const by_stage = {};

  for (const s of activeStates) {
    const stage = s.state;
    const probability = STAGE_PROBABILITIES[stage] ?? 0;

    // Determine potential amount
    let potential;
    const proposal = proposalsByLead[s.lead_id];
    if (proposal && Number(proposal.final_amount) > 0) {
      potential = Number(proposal.final_amount);
    } else {
      // Fallback: ADR × 2 nights
      potential = adr * 2;
    }

    const weighted = potential * probability;

    total_pipeline += potential;
    weighted_pipeline += weighted;

    // Forecast: check data_entrada (DD/MM/YYYY) from conversation state data
    const checkinDate = parseDMY(s.data && s.data.data_entrada);
    if (checkinDate) {
      const ts = checkinDate.getTime();
      if (ts >= now && ts <= in30Days) forecast_30d += weighted;
      if (ts >= now && ts <= in60Days) forecast_60d += weighted;
    }

    // Aggregate by stage
    if (!by_stage[stage]) {
      by_stage[stage] = { count: 0, potential: 0, weighted: 0 };
    }
    by_stage[stage].count += 1;
    by_stage[stage].potential += potential;
    by_stage[stage].weighted += weighted;
  }

  const leads_count = activeStates.length;
  const avg_deal_size = leads_count > 0 ? total_pipeline / leads_count : 0;

  return {
    total_pipeline,
    weighted_pipeline,
    confirmed_revenue,
    by_stage,
    forecast_30d,
    forecast_60d,
    leads_count,
    avg_deal_size,
  };
}

module.exports = { getPipelineRevenue, STAGE_PROBABILITIES };
