'use strict';

// Listener externo: verifica leads no estado SEND_QUOTE há > 30 min sem follow-up agendado
// NÃO modifica a FSM — é um listener externo

const { supabaseAdmin } = require('../supabase/client');
const { scheduleFollowUps } = require('./follow-up-scheduler');

async function checkForAbandonedQuotes() {
  // Busca leads em SEND_QUOTE com updated_at > 30 minutos atrás
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: staleLeads, error } = await supabaseAdmin
    .from('conversation_states')
    .select('lead_id, phone, updated_at')
    .eq('state', 'SEND_QUOTE')
    .lt('updated_at', thirtyMinAgo);

  if (error || !staleLeads) return { checked: 0, scheduled: 0 };

  let scheduled = 0;
  for (const lead of staleLeads) {
    // Verifica se já tem follow-up pendente
    const { data: existing } = await supabaseAdmin
      .from('scheduled_follow_ups')
      .select('id')
      .eq('lead_id', lead.lead_id)
      .eq('status', 'pending')
      .limit(1);

    if (!existing || existing.length === 0) {
      await scheduleFollowUps(lead.lead_id, lead.phone, 'quote_sent');
      scheduled++;
    }
  }

  return { checked: staleLeads.length, scheduled };
}

function startQuoteEventListener() {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
  console.log('[quote-event-listener] Started — interval: 5 minutes');
  return setInterval(async () => {
    try {
      const result = await checkForAbandonedQuotes();
      if (result.scheduled > 0) {
        console.log('[quote-event-listener]', result);
      }
    } catch (err) {
      console.error('[quote-event-listener] Error:', err.message);
    }
  }, INTERVAL_MS);
}

module.exports = { checkForAbandonedQuotes, startQuoteEventListener };
