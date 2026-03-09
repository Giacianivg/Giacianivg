'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { ok, fail, serverError } = require('../../services/utils/response');

const router = Router();

// GET /api/follow-ups/pending
// Returns pending follow-ups ordered by scheduled_for ASC, joined with lead info
router.get('/pending', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .select(`
      id,
      lead_id,
      phone,
      follow_up_type,
      template_name,
      scheduled_for,
      status,
      metadata,
      created_at,
      updated_at,
      leads (
        id,
        name,
        whatsapp_number,
        funnel_stage
      )
    `)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true });

  if (error) return serverError(res, error);

  const follow_ups = (data || []).map(item => ({
    ...item,
    lead_name: item.leads ? item.leads.name : null,
    lead_funnel_stage: item.leads ? item.leads.funnel_stage : null,
  }));

  return ok(res, { follow_ups, count: follow_ups.length });
});

// GET /api/follow-ups?lead_id=UUID&status=pending&limit=50&offset=0
// Returns follow-ups with optional filters
router.get('/', async (req, res) => {
  const { lead_id, status, limit = 50, offset = 0 } = req.query;

  let query = supabaseAdmin
    .from('scheduled_follow_ups')
    .select(`
      id,
      lead_id,
      phone,
      follow_up_type,
      template_name,
      scheduled_for,
      sent_at,
      status,
      metadata,
      created_at,
      updated_at,
      leads (
        id,
        name,
        whatsapp_number,
        funnel_stage
      )
    `)
    .order('scheduled_for', { ascending: true })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (lead_id) query = query.eq('lead_id', lead_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) return serverError(res, error);

  return ok(res, { follow_ups: data || [], count: (data || []).length });
});

// DELETE /api/follow-ups/:id/cancel
// Cancels a single pending follow-up
router.delete('/:id/cancel', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select('id, status')
    .single();

  if (error || !data) return fail(res, 'not_found', 'Follow-up not found or already processed', 404);
  return ok(res, { follow_up: data });
});

module.exports = router;
