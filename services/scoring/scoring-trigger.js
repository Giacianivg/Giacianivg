'use strict';

const { supabaseAdmin } = require('../supabase/client');
const { calculateLeadScore } = require('./lead-scorer');

/**
 * Trigger a score update for a lead identified by phone number.
 * Silently returns null if the lead is not found.
 *
 * @param {string} phone - WhatsApp phone number (e.g. '5519999999999')
 * @returns {Promise<{ leadId: string, score: number, label: string, breakdown: Array } | null>}
 */
async function triggerScoreUpdate(phone) {
  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('whatsapp_number', phone)
    .single();

  if (error || !lead) {
    return null;
  }

  return calculateLeadScore(lead.id);
}

module.exports = { triggerScoreUpdate };
