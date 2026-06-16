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

  const [
    { data: reservation, error: resErr },
    { data: charges, error: chErr },
    { data: payments, error: payErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select(`id, reservation_number, room_type, checkin_date, checkout_date, guests,
               total_amount, deposit_amount, status, channel, checkin_at, checkout_at, vehicle_plate,
               leads!fk_res_lead(id, whatsapp_number, name)`)
      .eq('id', reservationId)
      .single(),
    supabaseAdmin
      .from('room_charges')
      .select('id, room_code, quantity, unit_price, total, charged_at, staff_note, products(id, name, category, unit)')
      .eq('reservation_id', reservationId)
      .order('charged_at', { ascending: true }),
    supabaseAdmin
      .from('payments')
      .select('amount, payment_type')
      .eq('reservation_id', reservationId)
      .eq('status', 'confirmed')
      .in('payment_type', ['balance', 'full']),
  ]);

  if (resErr || !reservation) return notFound(res, 'Reservation');
  if (chErr) return serverError(res, chErr);
  if (payErr) return serverError(res, payErr);

  const list = charges || [];
  const charges_total = list.reduce((s, c) => s + Number(c.total || 0), 0);
  const room_total    = Number(reservation.total_amount || 0);
  const deposit       = Number(reservation.deposit_amount || 0);
  // Sinal vive em reservations.deposit_amount; aqui só os pagamentos de saldo
  // confirmados (balcão/PIX), para o balance_due refletir o que já foi recebido.
  const payments_confirmed = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  return ok(res, {
    reservation,
    charges: list,
    totals: {
      room_total,
      charges_total,
      grand_total:  room_total + charges_total,
      deposit_paid: deposit,
      payments_confirmed,
      balance_due:  room_total + charges_total - deposit - payments_confirmed,
    },
  });
});

// POST /api/room-charges — lançar consumo (trigger baixa estoque)
router.post('/', async (req, res) => {
  const { reservation_id, product_id, quantity, room_code, staff_note, unit_price, from_frigobar } = req.body;

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
      from_frigobar: from_frigobar === true,
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

  // Janela do dia no fuso da pousada (America/Sao_Paulo, UTC-3 fixo desde 2019).
  // Em UTC, consumo lançado após 21h BRT caía no dia seguinte e sumia do relatório.
  const from = `${date}T00:00:00.000-03:00`;
  const to   = `${date}T23:59:59.999-03:00`;

  const { data, error } = await supabaseAdmin
    .from('room_charges')
    .select(`id, room_code, quantity, unit_price, total, charged_at, staff_note,
             products(name, category, unit),
             reservations(reservation_number, room_type, leads!fk_res_lead(name)),
             counter_tabs(customer_name, status)`)
    .gte('charged_at', from)
    .lte('charged_at', to)
    .order('charged_at', { ascending: true });

  if (error) return serverError(res, error);

  const charges = data || [];
  const byRoom = {};
  for (const c of charges) {
    // Venda de balcão (sem quarto) entra agrupada como "Balcão — <cliente>".
    const room = c.room_code
      || c.reservations?.room_type
      || (c.counter_tabs ? `Balcão — ${c.counter_tabs.customer_name}` : '—');
    const guest = c.reservations?.leads?.name || c.counter_tabs?.customer_name || '—';
    if (!byRoom[room]) byRoom[room] = { room, guest, items: [], total: 0 };
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

// ── PDV (Ponto de Venda) ──────────────────────────────────────────────────────

// POST /api/room-charges/pos-sale — venda do PDV (carrinho + destino + pagamento)
// Body: { items:[{product_id, quantity}], destination:'room'|'counter',
//         payment:'now'|'later', reservation_id?, room_code?, customer_name?, method? }
router.post('/pos-sale', async (req, res) => {
  const { items, destination, payment, reservation_id, room_code, customer_name, method } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'empty_cart', 'Carrinho vazio');
  }
  if (!['room', 'counter'].includes(destination)) {
    return fail(res, 'invalid_destination', "destination deve ser 'room' ou 'counter'");
  }
  if (!['now', 'later'].includes(payment)) {
    return fail(res, 'invalid_payment', "payment deve ser 'now' ou 'later'");
  }

  const { data, error } = await supabaseAdmin.rpc('pos_register_sale', {
    p_items:          items,
    p_destination:    destination,
    p_payment:        payment,
    p_reservation_id: reservation_id || null,
    p_room_code:      room_code || null,
    p_customer_name:  customer_name || null,
    p_method:         method || null,
  });

  if (error) return serverError(res, error);
  if (!data?.success) return fail(res, data?.error || 'sale_failed', data?.message || 'Falha ao registrar venda');
  return ok(res, data, 201);
});

// GET /api/room-charges/counter-tabs?status=aberta — comandas de balcão
router.get('/counter-tabs', async (req, res) => {
  const { status } = req.query;

  let query = supabaseAdmin
    .from('counter_tabs')
    .select('id, customer_name, status, created_at, paid_at, room_charges(total), payments(amount, status)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return serverError(res, error);

  const tabs = (data || []).map(t => {
    const charges_total = (t.room_charges || []).reduce((s, c) => s + Number(c.total || 0), 0);
    const paid = (t.payments || [])
      .filter(p => p.status === 'confirmed')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      id: t.id,
      customer_name: t.customer_name,
      status: t.status,
      created_at: t.created_at,
      paid_at: t.paid_at,
      charges_total,
      paid,
      balance_due: charges_total - paid,
    };
  });

  return ok(res, { tabs, count: tabs.length });
});

// GET /api/room-charges/counter-tabs/:id — detalhe da comanda avulsa
router.get('/counter-tabs/:id', async (req, res) => {
  const [{ data: tab, error: tabErr }, { data: charges, error: chErr }, { data: payments, error: payErr }] =
    await Promise.all([
      supabaseAdmin.from('counter_tabs').select('*').eq('id', req.params.id).single(),
      supabaseAdmin
        .from('room_charges')
        .select('id, quantity, unit_price, total, charged_at, products(name, category, unit)')
        .eq('counter_tab_id', req.params.id)
        .order('charged_at', { ascending: true }),
      supabaseAdmin
        .from('payments')
        .select('amount, method, status, confirmed_at')
        .eq('counter_tab_id', req.params.id)
        .eq('status', 'confirmed'),
    ]);

  if (tabErr || !tab) return notFound(res, 'Counter tab');
  if (chErr) return serverError(res, chErr);
  if (payErr) return serverError(res, payErr);

  const list = charges || [];
  const charges_total = list.reduce((s, c) => s + Number(c.total || 0), 0);
  const paid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  return ok(res, {
    tab,
    charges: list,
    totals: { charges_total, paid, balance_due: charges_total - paid },
  });
});

// POST /api/room-charges/counter-tabs/:id/pay — quita comanda de balcão fiada
// Body: { method: 'pix'|'cash'|'card'|'transfer' }
router.post('/counter-tabs/:id/pay', async (req, res) => {
  const { method } = req.body;
  if (!['pix', 'cash', 'card', 'transfer'].includes(method)) {
    return fail(res, 'invalid_method', 'method deve ser pix, cash, card ou transfer');
  }

  const { data, error } = await supabaseAdmin.rpc('counter_tab_pay', {
    p_tab_id: req.params.id,
    p_method: method,
  });

  if (error) return serverError(res, error);
  if (!data?.success) return fail(res, data?.error || 'pay_failed', data?.message || 'Falha ao quitar comanda');
  return ok(res, data);
});

module.exports = router;
