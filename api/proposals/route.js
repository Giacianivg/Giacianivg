'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../../services/utils/response');
const { toDB } = require('../../services/utils/dates');

const router = Router();

const VALID_ROOM_TYPES = ['ALA_A', 'ALA_B', 'ALA_C_1', 'ALA_C_2', 'ALA_C_CASAL'];

// POST /api/proposals
router.post('/', async (req, res) => {
  const { lead_id, room_type, checkin, checkout, guests, total_amount, deposit_amount } = req.body;

  if (!lead_id || !room_type || !checkin || !checkout || !guests || total_amount === undefined) {
    return fail(res, 'missing_fields', 'lead_id, room_type, checkin, checkout, guests, total_amount required');
  }
  if (!VALID_ROOM_TYPES.includes(room_type)) {
    return fail(res, 'invalid_room_type', `Valid types: ${VALID_ROOM_TYPES.join(', ')}`);
  }

  let checkinISO, checkoutISO;
  try {
    checkinISO  = toDB(checkin);
    checkoutISO = toDB(checkout);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  const deposit = deposit_amount ?? Math.round(Number(total_amount) * 0.30);

  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .insert({
      lead_id,
      room_type,
      checkin_date:   checkinISO,
      checkout_date:  checkoutISO,
      guests:         Number(guests),
      total_amount:   Number(total_amount),
      deposit_amount: deposit,
      expires_at,
    })
    .select('id, proposal_number, status, expires_at')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { proposal_id: data.id, proposal_number: data.proposal_number, expires_at: data.expires_at }, 201);
});

// GET /api/proposals?lead_id=X&status=pending
router.get('/', async (req, res) => {
  const { lead_id, status } = req.query;

  let query = supabaseAdmin
    .from('proposals')
    .select('id, proposal_number, room_type, checkin_date, checkout_date, guests, total_amount, deposit_amount, status, expires_at, created_at')
    .order('created_at', { ascending: false });

  if (lead_id) query = query.eq('lead_id', lead_id);
  if (status)  query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return serverError(res, error);
  return ok(res, { proposals: data, count: data.length });
});

// GET /api/proposals/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('proposals')
    .select('*, leads(id, whatsapp_number, name)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return notFound(res, 'Proposal');
  return ok(res, { proposal: data });
});

// PATCH /api/proposals/:id/expire
router.patch('/:id/expire', async (req, res) => {
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('proposals')
    .select('status')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !current) return notFound(res, 'Proposal');
  if (['confirmed', 'expired'].includes(current.status)) {
    return fail(res, 'invalid_transition', `Cannot expire a proposal with status '${current.status}'`, 409);
  }

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .update({ status: 'expired' })
    .eq('id', req.params.id)
    .select('id, proposal_number, status')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { proposal: data });
});

module.exports = router;
