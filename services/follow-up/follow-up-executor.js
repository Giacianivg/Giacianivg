'use strict';

const { supabaseAdmin } = require('../supabase/client');
const { templates } = require('./templates');

/**
 * Attempt to load the WhatsApp send-message helper.
 * Returns null if the module does not exist, so the executor degrades gracefully.
 */
function tryLoadSendMessage() {
  try {
    return require('../whatsapp/send-message');
  } catch (_) {
    return null;
  }
}

/**
 * Processes all scheduled follow-ups whose scheduled_for <= NOW().
 *
 * For each pending follow-up:
 *  - If the lead replied after the follow-up was created → cancel it
 *  - Otherwise → render template, attempt send, mark sent or failed
 *
 * @returns {{ sent: number, cancelled: number, failed: number }}
 */
async function processScheduledFollowUps() {
  const now = new Date().toISOString();

  // 1. Fetch due follow-ups
  const { data: dueFollowUps, error: fetchError } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now);

  if (fetchError) {
    console.error('[follow-up-executor] Error fetching due follow-ups:', fetchError.message);
    return { sent: 0, cancelled: 0, failed: 0 };
  }

  if (!dueFollowUps || dueFollowUps.length === 0) {
    return { sent: 0, cancelled: 0, failed: 0 };
  }

  const sendMessage = tryLoadSendMessage();
  if (!sendMessage) {
    console.warn('[follow-up-executor] send-message module not found — follow-ups will be marked as failed');
  }

  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const followUp of dueFollowUps) {
    try {
      // 2. Check if lead replied after this follow-up was created
      const { data: convState } = await supabaseAdmin
        .from('conversation_states')
        .select('updated_at')
        .eq('lead_id', followUp.lead_id)
        .single();

      if (convState && convState.updated_at > followUp.created_at) {
        // Lead is active — cancel this follow-up
        await supabaseAdmin
          .from('scheduled_follow_ups')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', followUp.id);
        cancelled++;
        continue;
      }

      // 3. Build template message
      const templateFn = templates[followUp.template_name];
      if (!templateFn) {
        console.error(`[follow-up-executor] Unknown template: ${followUp.template_name}`);
        await supabaseAdmin
          .from('scheduled_follow_ups')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', followUp.id);
        failed++;
        continue;
      }

      // 4. Fetch lead data for template rendering
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('name')
        .eq('id', followUp.lead_id)
        .single();

      const templateData = {
        name: lead ? lead.name : null,
        checkIn: followUp.metadata && followUp.metadata.checkIn ? followUp.metadata.checkIn : null,
        checkOut: followUp.metadata && followUp.metadata.checkOut ? followUp.metadata.checkOut : null,
      };

      const message = templateFn(templateData);

      // 5. Attempt send
      if (!sendMessage) {
        await supabaseAdmin
          .from('scheduled_follow_ups')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', followUp.id);
        failed++;
        continue;
      }

      await sendMessage(followUp.phone, message);

      await supabaseAdmin
        .from('scheduled_follow_ups')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', followUp.id);

      sent++;
    } catch (err) {
      console.error(`[follow-up-executor] Error processing follow-up ${followUp.id}:`, err.message);
      await supabaseAdmin
        .from('scheduled_follow_ups')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', followUp.id);
      failed++;
    }
  }

  return { sent, cancelled, failed };
}

module.exports = { processScheduledFollowUps };
