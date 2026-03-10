'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

const router = Router();

// Helper: get today + next N days availability for given availability_codes
async function fetchOccupancyWindow(availCodes, days = 30) {
  if (!availCodes || availCodes.length === 0) return {};

  const today = new Date();
  const from  = today.toISOString().slice(0, 10);
  const to    = new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);

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
      .order('sort_order', { ascending: true });

    if (error) return serverError(res, error);

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

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
      'amenities', 'active', 'sort_order',
    ];

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

module.exports = router;
