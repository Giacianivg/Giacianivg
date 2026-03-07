'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../../services/supabase/client');
const { ok, fail, serverError } = require('../../../services/utils/response');
const { toDB, dateRange } = require('../../../services/utils/dates');

const router = Router();

// PATCH /api/availability/block
// Body: { room_type, from, to, reason }
// Cannot block dates with status='reserved'
router.patch('/', async (req, res) => {
  const { room_type, from, to, reason } = req.body;

  if (!room_type || !from || !to || !reason) {
    return fail(res, 'missing_fields', 'room_type, from, to, and reason are required');
  }

  let fromISO, toISO;
  try {
    fromISO = toDB(from);
    toISO   = toDB(to);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  // Check none of the dates are reserved
  const { data: reserved, error: checkErr } = await supabaseAdmin
    .from('availability')
    .select('date, status')
    .eq('room_type', room_type)
    .eq('status', 'reserved')
    .gte('date', fromISO)
    .lt('date', toISO);

  if (checkErr) return serverError(res, checkErr);

  if (reserved.length > 0) {
    return fail(res, 'dates_reserved',
      `Cannot block reserved dates: ${reserved.map(r => r.date).join(', ')}. Use release_reservation to cancel first.`,
      409
    );
  }

  const dates = dateRange(fromISO, toISO);
  const { error } = await supabaseAdmin
    .from('availability')
    .update({ status: 'blocked', block_reason: reason })
    .eq('room_type', room_type)
    .in('date', dates);

  if (error) return serverError(res, error);

  return ok(res, { blocked: dates.length, room_type, from: fromISO, to: toISO, reason });
});

module.exports = router;
