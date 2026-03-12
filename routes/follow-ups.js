'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');

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

// POST /api/follow-ups/reactivation
// Schedules the full D+1/D+7/D+30/D+60/D+90 reactivation sequence for a guest
// Body: { lead_id, phone, checkout_date (ISO or DD/MM/YYYY) }
router.post('/reactivation', async (req, res) => {
  const { lead_id, phone, checkout_date } = req.body || {};

  if (!lead_id || !phone) {
    return fail(res, 'missing_fields', 'lead_id and phone are required', 400);
  }

  // Parse checkout_date — accepts ISO string or DD/MM/YYYY
  let base;
  if (checkout_date) {
    const dmy = String(checkout_date).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      base = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    } else {
      base = new Date(checkout_date);
    }
  } else {
    base = new Date();
  }

  if (isNaN(base.getTime())) {
    return fail(res, 'invalid_date', 'checkout_date is invalid', 400);
  }

  const addDays = (d, n) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);

  const sequence = [
    { days: 1,  template: 'reactivation_d1',  type: 'reactivation' },
    { days: 7,  template: 'reactivation_d7',  type: 'reactivation' },
    { days: 30, template: 'reactivation_d30', type: 'reactivation' },
    { days: 60, template: 'reactivation_d60', type: 'reactivation' },
    { days: 90, template: 'reactivation_d90', type: 'reactivation' },
  ];

  const rows = sequence.map(({ days, template, type }) => ({
    lead_id,
    phone,
    follow_up_type: type,
    template_name: template,
    scheduled_for: addDays(base, days).toISOString(),
    status: 'pending',
    metadata: { checkout_date: base.toISOString(), day_offset: days },
  }));

  const { data, error } = await supabaseAdmin
    .from('scheduled_follow_ups')
    .insert(rows)
    .select('id, template_name, scheduled_for');

  if (error) return serverError(res, error);

  return ok(res, { follow_ups: data, count: data.length });
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
