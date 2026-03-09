'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const { toDB } = require('../services/utils/dates');

const router = Router();

// GET /api/availability/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns grouped calendar with all rooms per date
router.get('/', async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return fail(res, 'missing_params', 'from and to query params are required (YYYY-MM-DD)');
  }

  let fromISO, toISO;
  try {
    fromISO = toDB(from);
    toISO   = toDB(to);
  } catch (e) {
    return fail(res, 'invalid_date', e.message);
  }

  if (fromISO >= toISO) {
    return fail(res, 'invalid_range', 'to must be after from');
  }

  const { data, error } = await supabaseAdmin
    .from('vw_occupancy_calendar')
    .select('*')
    .gte('date', fromISO)
    .lt('date', toISO)
    .order('date');

  if (error) return serverError(res, error);

  // Group by date
  const byDate = {};
  for (const row of (data || [])) {
    if (!byDate[row.date]) byDate[row.date] = {};
    const roomData = { status: row.status };
    if (row.reservation_number) roomData.reservation_number = row.reservation_number;
    if (row.guest_name)         roomData.guest_name = row.guest_name;
    if (row.block_reason)       roomData.block_reason = row.block_reason;
    byDate[row.date][row.room_type] = roomData;
  }

  const calendar = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rooms]) => ({ date, rooms }));

  return ok(res, { calendar, from: fromISO, to: toISO });
});

module.exports = router;
