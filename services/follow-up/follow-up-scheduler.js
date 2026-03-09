'use strict';

const { supabaseAdmin } = require('../supabase/client');

/**
 * Schedules automated follow-ups for a lead based on the event type.
 *
 * For 'quote_sent':
 *   1. Cancels all pending follow-ups for the lead
 *   2. Inserts 3 new scheduled_follow_ups records (+1h, +24h, +72h)
 *
 * @param {string} leadId - UUID of the lead
 * @param {string} phone - WhatsApp phone number
 * @param {string} eventType - Event that triggered scheduling (e.g. 'quote_sent')
 * @returns {{ scheduled: number, cancelled: number }}
 */
async function scheduleFollowUps(leadId, phone, eventType) {
  if (eventType !== 'quote_sent') {
    return { scheduled: 0, cancelled: 0 };
  }

  // Step 1: Cancel all pending follow-ups for this lead
  const { data: cancelled, error: cancelError } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .select('id');

  if (cancelError) {
    console.error('[follow-up-scheduler] Error cancelling existing follow-ups:', cancelError.message);
  }

  const cancelledCount = cancelled ? cancelled.length : 0;

  // Step 2: Insert 3 new follow-up records
  const now = Date.now();
  const followUps = [
    {
      lead_id: leadId,
      phone,
      follow_up_type: 'quote_abandoned_1h',
      scheduled_for: new Date(now + 1 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      template_name: 'quote_abandoned_1h',
      metadata: {},
    },
    {
      lead_id: leadId,
      phone,
      follow_up_type: 'quote_abandoned_24h',
      scheduled_for: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      template_name: 'quote_abandoned_24h',
      metadata: {},
    },
    {
      lead_id: leadId,
      phone,
      follow_up_type: 'quote_abandoned_72h',
      scheduled_for: new Date(now + 72 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      template_name: 'quote_abandoned_72h',
      metadata: {},
    },
  ];

  const { error: insertError } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .insert(followUps);

  if (insertError) {
    console.error('[follow-up-scheduler] Error inserting follow-ups:', insertError.message);
    return { scheduled: 0, cancelled: cancelledCount };
  }

  return { scheduled: 3, cancelled: cancelledCount };
}

/**
 * Cancels all pending follow-ups for a lead (e.g. when lead booked or replied).
 *
 * @param {string} leadId - UUID of the lead
 * @returns {{ cancelled: number }}
 */
async function cancelFollowUps(leadId) {
  const { data: cancelled, error } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[follow-up-scheduler] Error cancelling follow-ups:', error.message);
    return { cancelled: 0 };
  }

  return { cancelled: cancelled ? cancelled.length : 0 };
}

module.exports = { scheduleFollowUps, cancelFollowUps };
