'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../../services/supabase/client');
const { ok, fail, serverError } = require('../../../services/utils/response');
const { toDB, dateRange } = require('../../../services/utils/dates');

const router = Router();

// PATCH /api/availability/unblock
// Body: { room_type, from, to }
// Only unblocks status='blocked' rows (not 'reserved' — use release_reservation for those)
router.patch('/', async (req, res) => {
  const { room_type, from, to } = req.body;

  if (!room_type || !from || !to) {
    return fail(res, 'missing_fields', 'room_type, from, and to are required');
  }

  let fromISO, toISO;
  try {
    fromISO = toDB(from);
    toISO   = toDB(to);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  const dates = dateRange(fromISO, toISO);

  // Only update rows that are currently 'blocked' — leave 'reserved' untouched
  const { data, error } = await supabaseAdmin
    .from('availability')
    .update({ status: 'available', block_reason: null })
    .eq('room_type', room_type)
    .eq('status', 'blocked')
    .in('date', dates)
    .select('date');

  if (error) return serverError(res, error);

  return ok(res, { unblocked: data.length, room_type, from: fromISO, to: toISO });
});

module.exports = router;
