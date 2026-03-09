'use strict';

const { supabaseAdmin } = require('../supabase/client');

/**
 * Stage score mapping
 */
const STAGE_SCORES = {
  GREETING: 5,
  COLLECT_NAME: 10,
  ASK_DATES: 20,
  ASK_GUESTS: 30,
  SHOW_ROOMS: 45,
  SEND_QUOTE: 60,
  CONFIRM_BOOKING: 90,
  HANDOFF_HUMAN: 40,
};

/**
 * Determine score label from numeric score
 * @param {number} score
 * @returns {string}
 */
function getScoreLabel(score) {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 25) return 'nurture';
  return 'cold';
}

/**
 * Parse DD/MM/YYYY date string to a Date object
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseBrazilianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Calculate lead score based on funnel state and collected data.
 *
 * @param {string} leadId - UUID of the lead
 * @param {object} [supabaseClient] - Optional Supabase client (defaults to supabaseAdmin)
 * @returns {Promise<{ leadId: string, score: number, label: string, breakdown: Array<{criterion: string, points: number}> }>}
 */
async function calculateLeadScore(leadId, supabaseClient) {
  const client = supabaseClient || supabaseAdmin;

  // Fetch lead
  const { data: lead, error: leadError } = await client
    .from('leads')
    .select('id, whatsapp_number, name, funnel_stage')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Fetch conversation state
  const { data: convState } = await client
    .from('conversation_states')
    .select('state, data, metadata, updated_at')
    .eq('lead_id', leadId)
    .single();

  const breakdown = [];
  let score = 0;

  // --- Stage score ---
  if (convState && convState.state) {
    const stagePoints = STAGE_SCORES[convState.state] || 0;
    if (stagePoints > 0) {
      score += stagePoints;
      breakdown.push({ criterion: `stage:${convState.state}`, points: stagePoints });
    }
  }

  // --- Data fields score ---
  const data = (convState && convState.data) || {};

  if (data.nome) {
    score += 5;
    breakdown.push({ criterion: 'data:nome', points: 5 });
  }

  if (data.data_entrada) {
    score += 10;
    breakdown.push({ criterion: 'data:data_entrada', points: 10 });
  }

  if (data.data_saida) {
    score += 5;
    breakdown.push({ criterion: 'data:data_saida', points: 5 });
  }

  if (data.pessoas !== undefined && data.pessoas !== null) {
    score += 5;
    breakdown.push({ criterion: 'data:pessoas', points: 5 });

    if (Number(data.pessoas) >= 3) {
      score += 8;
      breakdown.push({ criterion: 'data:pessoas>=3', points: 8 });
    }
  }

  // --- Check-in urgency bonus ---
  if (data.data_entrada) {
    const checkIn = parseBrazilianDate(data.data_entrada);
    if (checkIn) {
      const now = new Date();
      const diffMs = checkIn.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 0 && diffDays < 7) {
        score += 15;
        breakdown.push({ criterion: 'checkin:urgent(<7days)', points: 15 });
      } else if (diffDays >= 7 && diffDays <= 30) {
        score += 8;
        breakdown.push({ criterion: 'checkin:soon(7-30days)', points: 8 });
      }
    }
  }

  // --- Inactivity penalties ---
  if (convState && convState.updated_at) {
    const updatedAt = new Date(convState.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    if (diffDays > 7) {
      score -= 25;
      breakdown.push({ criterion: 'penalty:inactive>7days', points: -25 });
    } else if (diffHours > 72) {
      score -= 15;
      breakdown.push({ criterion: 'penalty:inactive>72h', points: -15 });
    }
  }

  // --- Attempts penalty ---
  const metadata = (convState && convState.metadata) || {};
  let totalAttempts = 0;
  for (const key of Object.keys(metadata)) {
    if (key.startsWith('attempts_')) {
      totalAttempts += Number(metadata[key]) || 0;
    }
  }
  if (totalAttempts > 3) {
    score -= 10;
    breakdown.push({ criterion: 'penalty:attempts>3', points: -10 });
  }

  // --- Apply ceiling/floor ---
  score = Math.max(0, Math.min(100, score));
  const label = getScoreLabel(score);

  // --- Persist to leads table ---
  await client
    .from('leads')
    .update({
      score,
      score_label: label,
      score_updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  return { leadId, score, label, breakdown };
}

module.exports = { calculateLeadScore };
