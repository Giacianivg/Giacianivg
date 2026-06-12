'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

const router = Router();

// Campos editáveis via PATCH /:id
const EDITABLE_FIELDS = [
  'status', 'channel', 'notes', 'room_type', 'guests',
  'total_amount', 'deposit_amount', 'balance_amount',
  'checkin_date', 'checkout_date', 'vehicle_plate',
];

const VALID_STATUSES = ['pending', 'confirmed', 'checkedin', 'checkedout', 'cancelled'];

// GET /api/reservations?status=pending&checkin_from=YYYY-MM-DD&channel=booking&search=nome
router.get('/', async (req, res) => {
  const {
    status, checkin_from, checkin_to, room_type, channel,
    search, limit = 100, offset = 0,
  } = req.query;

  let query = supabaseAdmin
    .from('reservations')
    .select(`
      id, reservation_number, room_type, checkin_date, checkout_date,
      guests, total_amount, deposit_amount, balance_amount,
      status, channel, notes, checkin_at, checkout_at, created_at, vehicle_plate,
      leads!fk_res_lead!inner(id, whatsapp_number, name)
    `)
    .order('checkin_date', { ascending: true })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status)       query = query.eq('status', status);
  if (checkin_from) query = query.gte('checkin_date', checkin_from);
  if (checkin_to)   query = query.lte('checkin_date', checkin_to);
  if (room_type)    query = query.eq('room_type', room_type);
  if (channel)      query = query.eq('channel', channel);

  const { data, error } = await query;
  if (error) return serverError(res, error);

  // client-side name search (Supabase doesn't support join filter easily)
  const list = search
    ? data.filter(r => (r.leads?.name || '').toLowerCase().includes(search.toLowerCase()))
    : data;

  return ok(res, { reservations: list, count: list.length });
});

// GET /api/reservations/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select(`
      *,
      leads!fk_res_lead(id, whatsapp_number, name, email),
      payments!fk_pay_reservation(id, amount, status, method, payment_type, confirmed_at, created_at)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return notFound(res, 'Reservation');
  return ok(res, { reservation: data });
});

// PATCH /api/reservations/:id/checkin
router.patch('/:id/checkin', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update({ status: 'checkedin', checkin_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('id, reservation_number, status, checkin_at, room_type')
    .single();

  if (error || !data) return notFound(res, 'Reservation');
  return ok(res, { reservation: data });
});

// PATCH /api/reservations/:id/checkout
router.patch('/:id/checkout', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update({ status: 'checkedout', checkout_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('id, reservation_number, status, checkout_at, room_type')
    .single();

  if (error || !data) return notFound(res, 'Reservation');
  return ok(res, { reservation: data });
});

// PATCH /api/reservations/:id  — edição geral
router.patch('/:id', async (req, res) => {
  const updates = {};
  for (const k of EDITABLE_FIELDS) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }

  if (!Object.keys(updates).length) {
    return fail(res, 'no_fields', 'No valid fields to update');
  }

  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return fail(res, 'invalid_status', `Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update(updates)
    .eq('id', req.params.id)
    .select(`
      id, reservation_number, room_type, checkin_date, checkout_date,
      guests, total_amount, deposit_amount, balance_amount,
      status, channel, notes, checkin_at, checkout_at, vehicle_plate
    `)
    .single();

  if (error || !data) return notFound(res, 'Reservation');
  return ok(res, { reservation: data });
});

// GET /api/reservations/:id/swap-options — quartos livres para o período restante
router.get('/:id/swap-options', async (req, res) => {
  const { data: r, error: resErr } = await supabaseAdmin
    .from('reservations')
    .select('id, room_type, checkin_date, checkout_date, status')
    .eq('id', req.params.id)
    .single();

  if (resErr || !r) return notFound(res, 'Reservation');
  if (['checkedout', 'completed', 'cancelled'].includes(r.status)) {
    return fail(res, 'reservation_closed', 'Reserva já encerrada.');
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const from = r.checkin_date > today ? r.checkin_date : today;
  const nights = Math.round((new Date(r.checkout_date) - new Date(from)) / 86400000);
  if (nights <= 0) return fail(res, 'stay_finished', 'A estadia termina hoje — não há noites para mover.');

  const [{ data: rooms, error: roomsErr }, { data: avail, error: availErr }] = await Promise.all([
    supabaseAdmin.from('rooms').select('code, name, max_guests').eq('active', true).order('sort_order'),
    supabaseAdmin.from('availability')
      .select('room_type')
      .gte('date', from).lt('date', r.checkout_date)
      .eq('status', 'available'),
  ]);

  if (roomsErr || availErr) return serverError(res, roomsErr || availErr);

  const freeNights = {};
  for (const a of avail || []) freeNights[a.room_type] = (freeNights[a.room_type] || 0) + 1;

  const options = (rooms || [])
    .filter(room => room.code !== r.room_type && freeNights[room.code] >= nights)
    .map(room => ({ code: room.code, name: room.name, max_guests: room.max_guests }));

  return ok(res, { options, from, nights, current_room: r.room_type });
});

// POST /api/reservations/:id/swap-room — troca de quarto via RPC atômica
router.post('/:id/swap-room', async (req, res) => {
  const { new_room } = req.body;
  if (!new_room) return fail(res, 'missing_field', 'new_room é obrigatório');

  const { data, error } = await supabaseAdmin.rpc('swap_room_atomic', {
    p_reservation_id: req.params.id,
    p_new_room: String(new_room).toUpperCase(),
  });

  if (error) return serverError(res, error);
  if (!data.success) {
    const status = data.error === 'no_availability' || data.error === 'locked' ? 409 : 422;
    return fail(res, data.error, data.message, status);
  }

  return ok(res, { old_room: data.old_room, new_room: data.new_room, from_date: data.from_date });
});

module.exports = router;
