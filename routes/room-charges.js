'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

const router = Router();

// GET /api/room-charges?reservation_id=uuid — consumos de uma reserva
router.get('/', async (req, res) => {
  const { reservation_id } = req.query;
  if (!reservation_id) return fail(res, 'missing_field', 'reservation_id é obrigatório');

  const { data, error } = await supabaseAdmin
    .from('room_charges')
    .select('id, room_code, quantity, unit_price, total, charged_at, staff_note, products(id, name, category, unit)')
    .eq('reservation_id', reservation_id)
    .order('charged_at', { ascending: true });

  if (error) return serverError(res, error);

  const charges = data || [];
  const charges_total = charges.reduce((s, c) => s + Number(c.total || 0), 0);
  return ok(res, { charges, charges_total, count: charges.length });
});

// GET /api/room-charges/comanda/:reservationId — comanda completa (reserva + consumos + totais)
router.get('/comanda/:reservationId', async (req, res) => {
  const { reservationId } = req.params;

  const [{ data: reservation, error: resErr }, { data: charges, error: chErr }] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select(`id, reservation_number, room_type, checkin_date, checkout_date, guests,
               total_amount, deposit_amount, status, channel, checkin_at, checkout_at,
               leads!fk_res_lead(id, whatsapp_number, name)`)
      .eq('id', reservationId)
      .single(),
    supabaseAdmin
      .from('room_charges')
      .select('id, room_code, quantity, unit_price, total, charged_at, staff_note, products(id, name, category, unit)')
      .eq('reservation_id', reservationId)
      .order('charged_at', { ascending: true }),
  ]);

  if (resErr || !reservation) return notFound(res, 'Reservation');
  if (chErr) return serverError(res, chErr);

  const list = charges || [];
  const charges_total = list.reduce((s, c) => s + Number(c.total || 0), 0);
  const room_total    = Number(reservation.total_amount || 0);
  const deposit       = Number(reservation.deposit_amount || 0);

  return ok(res, {
    reservation,
    charges: list,
    totals: {
      room_total,
      charges_total,
      grand_total:  room_total + charges_total,
      deposit_paid: deposit,
      balance_due:  room_total + charges_total - deposit,
    },
  });
});

// POST /api/room-charges — lançar consumo (trigger baixa estoque)
router.post('/', async (req, res) => {
  const { reservation_id, product_id, quantity, room_code, staff_note, unit_price } = req.body;

  if (!reservation_id || !product_id || !quantity) {
    return fail(res, 'missing_fields', 'reservation_id, product_id e quantity são obrigatórios');
  }
  if (Number(quantity) <= 0) return fail(res, 'invalid_quantity', 'quantity deve ser > 0');

  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, name, price, active, stock_quantity')
    .eq('id', product_id)
    .single();

  if (prodErr || !product) return notFound(res, 'Product');
  if (!product.active) return fail(res, 'inactive_product', `Produto "${product.name}" está inativo`);

  const { data, error } = await supabaseAdmin
    .from('room_charges')
    .insert({
      reservation_id,
      product_id,
      quantity:   Number(quantity),
      unit_price: unit_price !== undefined ? Number(unit_price) : Number(product.price),
      room_code:  room_code || null,
      staff_note: staff_note || null,
    })
    .select('id, room_code, quantity, unit_price, total, charged_at, staff_note, products(id, name, category, unit)')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { charge: data }, 201);
});

// DELETE /api/room-charges/:id — estornar lançamento (trigger devolve estoque)
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('room_charges')
    .delete()
    .eq('id', req.params.id)
    .select('id')
    .single();

  if (error || !data) return notFound(res, 'Charge');
  return ok(res, { deleted: data.id });
});

// GET /api/room-charges/report/daily?date=YYYY-MM-DD — consumo do dia por quarto
router.get('/report/daily', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 'invalid_date', 'date deve ser YYYY-MM-DD');

  const from = `${date}T00:00:00.000Z`;
  const to   = `${date}T23:59:59.999Z`;

  const { data, error } = await supabaseAdmin
    .from('room_charges')
    .select(`id, room_code, quantity, unit_price, total, charged_at, staff_note,
             products(name, category, unit),
             reservations(reservation_number, room_type, leads!fk_res_lead(name))`)
    .gte('charged_at', from)
    .lte('charged_at', to)
    .order('charged_at', { ascending: true });

  if (error) return serverError(res, error);

  const charges = data || [];
  const byRoom = {};
  for (const c of charges) {
    const room = c.room_code || c.reservations?.room_type || '—';
    if (!byRoom[room]) byRoom[room] = { room, guest: c.reservations?.leads?.name || '—', items: [], total: 0 };
    byRoom[room].items.push({
      product:  c.products?.name || '—',
      category: c.products?.category || '—',
      quantity: Number(c.quantity),
      total:    Number(c.total),
      time:     c.charged_at,
    });
    byRoom[room].total += Number(c.total || 0);
  }

  const rooms = Object.values(byRoom).sort((a, b) => a.room.localeCompare(b.room));
  const grand_total = rooms.reduce((s, r) => s + r.total, 0);

  return ok(res, { date, rooms, grand_total, charge_count: charges.length });
});

module.exports = router;
