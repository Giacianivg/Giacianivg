'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { ok, fail, serverError } = require('../../services/utils/response');
const { toDB } = require('../../services/utils/dates');

const router = Router();

const VALID_ROOM_TYPES = ['ALA_A', 'ALA_B', 'ALA_C_1', 'ALA_C_2', 'ALA_C_CASAL'];

// GET /api/availability?room_type=ALA_A&checkin=07/03/2026&checkout=09/03/2026
// Returns: { available: true/false, unavailable_dates: [] }
router.get('/', async (req, res) => {
  const { room_type, checkin, checkout } = req.query;

  if (!room_type || !checkin || !checkout) {
    return fail(res, 'missing_params', 'room_type, checkin, and checkout are required');
  }

  let roomTypes = [room_type];
  if (room_type === 'ALA_C_CASAL') {
    roomTypes = ['ALA_C_1', 'ALA_C_2'];
  } else if (!VALID_ROOM_TYPES.includes(room_type)) {
    return fail(res, 'invalid_room_type', `Valid types: ${VALID_ROOM_TYPES.join(', ')}`);
  }

  let checkinISO, checkoutISO;
  try {
    checkinISO  = toDB(checkin);
    checkoutISO = toDB(checkout);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  if (checkinISO >= checkoutISO) {
    return fail(res, 'invalid_range', 'checkout must be after checkin');
  }

  if (room_type === 'ALA_C_CASAL') {
    // For ALA_C_CASAL: at least one of ALA_C_1 or ALA_C_2 must be fully available
    let anyAvailable = false;
    for (const rt of roomTypes) {
      const { data, error } = await supabaseAdmin
        .from('availability')
        .select('date, status')
        .eq('room_type', rt)
        .gte('date', checkinISO)
        .lt('date', checkoutISO);

      if (error) return serverError(res, error);
      const allAvail = data.every(row => row.status === 'available');
      if (allAvail && data.length > 0) { anyAvailable = true; break; }
    }
    return ok(res, { available: anyAvailable, room_type });
  }

  const { data, error } = await supabaseAdmin
    .from('availability')
    .select('date, status')
    .eq('room_type', room_type)
    .gte('date', checkinISO)
    .lt('date', checkoutISO);

  if (error) return serverError(res, error);

  const unavailable = data.filter(r => r.status !== 'available').map(r => r.date);
  return ok(res, { available: unavailable.length === 0, room_type, unavailable_dates: unavailable });
});

module.exports = router;
