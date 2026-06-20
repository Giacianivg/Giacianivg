'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

const router = Router();

// "Hoje" em America/Sao_Paulo (servidor Vercel roda em UTC) — DEC-024 F2.
function todayBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Helper: get today + next N days availability for given availability_codes
async function fetchOccupancyWindow(availCodes, days = 30) {
  if (!availCodes || availCodes.length === 0) return {};

  const from = todayBR();
  const to   = new Date(new Date(from).getTime() + days * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('availability')
    .select('date, room_type, status')
    .in('room_type', availCodes)
    .gte('date', from)
    .lt('date', to)
    .order('date', { ascending: true });

  if (error) return { error };

  // Group by date: a date is "available" only if ALL availability_codes are available for it
  const byDate = {};
  for (const row of (data || [])) {
    if (!byDate[row.date]) byDate[row.date] = {};
    byDate[row.date][row.room_type] = row.status;
  }

  const result = {};
  for (const [date, roomMap] of Object.entries(byDate)) {
    const statuses = availCodes.map(code => roomMap[code] || 'unknown');
    const anyAvail = statuses.some(s => s === 'available');
    const allAvail = statuses.every(s => s === 'available');
    result[date] = allAvail ? 'available' : anyAvail ? 'partial' : 'blocked';
  }
  return { dates: result };
}

// GET /api/rooms
// List all rooms with today's status
router.get('/', async (req, res) => {
  try {
    const { data: rooms, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) return serverError(res, error);

    const today = todayBR();

    // Fetch today's availability for all rooms in one query
    const allCodes = rooms.flatMap(r => r.availability_codes || []);
    let todayMap = {};

    if (allCodes.length > 0) {
      const { data: avail } = await supabaseAdmin
        .from('availability')
        .select('room_type, status')
        .in('room_type', allCodes)
        .eq('date', today);

      for (const row of (avail || [])) {
        todayMap[row.room_type] = row.status;
      }
    }

    const enriched = rooms.map(room => {
      const codes = room.availability_codes || [];
      let todayStatus = 'unknown';

      if (room.code === 'ALA_C_GRUPO') {
        todayStatus = 'on_request';
      } else if (codes.length === 0) {
        todayStatus = 'unknown';
      } else {
        const statuses = codes.map(c => todayMap[c] || 'unknown');
        const allAvail  = statuses.every(s => s === 'available');
        const anyAvail  = statuses.some(s => s === 'available');
        todayStatus = allAvail ? 'available' : anyAvail ? 'partial' : 'blocked';
      }

      return { ...room, today_status: todayStatus };
    });

    return ok(res, { rooms: enriched, count: enriched.length, date: today });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/rooms/:code
// Room detail + 30-day availability window
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const { data: room, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) return serverError(res, error);
    if (!room)  return notFound(res, `Room ${code}`);

    const { dates, error: availError } = await fetchOccupancyWindow(room.availability_codes, 30);
    if (availError) return serverError(res, availError);

    return ok(res, { room, availability_30d: dates || {} });
  } catch (err) {
    return serverError(res, err);
  }
});

// PUT /api/rooms/:code
// Update room metadata (name, description, prices, amenities, active)
router.put('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const { data: existing, error: findError } = await supabaseAdmin
      .from('rooms')
      .select('id, code')
      .eq('code', code)
      .maybeSingle();

    if (findError) return serverError(res, findError);
    if (!existing)  return notFound(res, `Room ${code}`);

    const ALLOWED = [
      'name', 'description', 'max_guests',
      'base_price_baixa', 'base_price_media', 'base_price_alta',
      'amenities', 'active', 'sort_order', 'frigobar_status',
    ];

    if (req.body.frigobar_status !== undefined &&
        !['ok', 'manutencao', 'sem_frigobar'].includes(req.body.frigobar_status)) {
      return fail(res, 'invalid_frigobar_status', 'frigobar_status deve ser: ok, manutencao ou sem_frigobar');
    }

    const patch = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    if (Object.keys(patch).length === 0) {
      return fail(res, 'no_changes', 'No updatable fields provided');
    }

    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('rooms')
      .update(patch)
      .eq('code', code)
      .select()
      .single();

    if (updateError) return serverError(res, updateError);
    return ok(res, { room: updated });
  } catch (err) {
    return serverError(res, err);
  }
});

// ─── Frigobar ────────────────────────────────────────────────────────────────

// GET /api/rooms/:code/frigobar — itens carregados no frigobar do quarto
router.get('/:code/frigobar', async (req, res) => {
  const code = req.params.code.toUpperCase();

  const [{ data: room, error: roomErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabaseAdmin.from('rooms').select('code, name, frigobar_status').eq('code', code).maybeSingle(),
    supabaseAdmin
      .from('frigobar_items')
      .select('id, quantity, loaded_at, products(id, name, category, unit, price, stock_quantity)')
      .eq('room_code', code)
      .gt('quantity', 0)
      .order('loaded_at', { ascending: true }),
  ]);

  if (roomErr) return serverError(res, roomErr);
  if (!room)   return notFound(res, `Room ${code}`);
  if (itemsErr) return serverError(res, itemsErr);

  return ok(res, { room_code: code, frigobar_status: room.frigobar_status, items: items || [] });
});

// POST /api/rooms/:code/frigobar/load — abastece do estoque central (RPC atômica)
router.post('/:code/frigobar/load', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { product_id, quantity } = req.body;
  if (!product_id || !quantity) return fail(res, 'missing_fields', 'product_id e quantity são obrigatórios');

  const { data, error } = await supabaseAdmin.rpc('frigobar_load', {
    p_room: code, p_product: product_id, p_qty: Number(quantity),
  });
  if (error) return serverError(res, error);
  if (!data.success) return fail(res, data.error, data.message, 422);
  return ok(res, { loaded: true });
});

// POST /api/rooms/:code/frigobar/unload — devolve ao estoque central (RPC atômica)
router.post('/:code/frigobar/unload', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { product_id, quantity } = req.body;
  if (!product_id || !quantity) return fail(res, 'missing_fields', 'product_id e quantity são obrigatórios');

  const { data, error } = await supabaseAdmin.rpc('frigobar_unload', {
    p_room: code, p_product: product_id, p_qty: Number(quantity),
  });
  if (error) return serverError(res, error);
  if (!data.success) return fail(res, data.error, data.message, 422);
  return ok(res, { unloaded: true });
});

module.exports = router;
