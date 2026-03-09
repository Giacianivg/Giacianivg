'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, notFound, serverError } = require('../services/utils/response');

const router = Router();

// GET /api/reservations?status=pending&checkin_from=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { status, checkin_from, checkin_to, room_type, limit = 50, offset = 0 } = req.query;

  let query = supabaseAdmin
    .from('reservations')
    .select(`
      id, reservation_number, room_type, checkin_date, checkout_date,
      guests, total_amount, deposit_amount, balance_amount,
      status, created_at,
      leads!inner(id, whatsapp_number, name)
    `)
    .order('checkin_date', { ascending: true })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status)       query = query.eq('status', status);
  if (checkin_from) query = query.gte('checkin_date', checkin_from);
  if (checkin_to)   query = query.lte('checkin_date', checkin_to);
  if (room_type)    query = query.eq('room_type', room_type);

  const { data, error } = await query;
  if (error) return serverError(res, error);
  return ok(res, { reservations: data, count: data.length });
});

// GET /api/reservations/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select(`
      *,
      leads(id, whatsapp_number, name, email),
      payments(id, amount, status, payment_method, paid_at, created_at)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return notFound(res, 'Reservation');
  return ok(res, { reservation: data });
});

module.exports = router;
