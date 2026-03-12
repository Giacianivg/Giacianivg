'use strict';

/**
 * Competitor Prices API — PLU-23 / DEC-018
 *
 * GET  /api/competitor-prices?from=YYYY-MM-DD&to=YYYY-MM-DD[&room_type=casal]
 * GET  /api/competitor-prices/summary?date=YYYY-MM-DD[&room_type=casal]
 * POST /api/competitor-prices  → entrada manual (source='manual')
 */

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');

const router = Router();

const VALID_ROOM_TYPES = ['standard', 'casal', 'familia', 'grupo'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/competitor-prices?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { from, to, room_type, competitor } = req.query;

  if (!from || !to) {
    return fail(res, 'missing_params', 'from and to (YYYY-MM-DD) are required');
  }
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return fail(res, 'invalid_date', 'Dates must be YYYY-MM-DD');
  }
  if (from > to) {
    return fail(res, 'invalid_range', 'from must be <= to');
  }

  let query = supabaseAdmin
    .from('competitor_prices')
    .select('id, competitor_name, platform, date, price, room_type, availability, source, scraped_at')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('competitor_name', { ascending: true });

  if (room_type && VALID_ROOM_TYPES.includes(room_type)) {
    query = query.eq('room_type', room_type);
  }
  if (competitor) {
    query = query.ilike('competitor_name', `%${competitor}%`);
  }

  const { data, error } = await query;
  if (error) return serverError(res, error);

  return ok(res, { prices: data, count: data.length });
});

// GET /api/competitor-prices/summary?date=YYYY-MM-DD
router.get('/summary', async (req, res) => {
  const { date, room_type } = req.query;

  if (!date || !DATE_RE.test(date)) {
    return fail(res, 'invalid_date', 'date (YYYY-MM-DD) is required');
  }

  let query = supabaseAdmin
    .from('competitor_prices')
    .select('competitor_name, price, room_type, availability')
    .eq('date', date);

  if (room_type && VALID_ROOM_TYPES.includes(room_type)) {
    query = query.eq('room_type', room_type);
  }

  const { data, error } = await query;
  if (error) return serverError(res, error);

  const available = data.filter(p => p.availability && p.price > 0);
  const prices    = available.map(p => p.price);

  const summary = {
    date,
    room_type:       room_type || 'all',
    count:           prices.length,
    avg:             prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    min:             prices.length ? Math.min(...prices) : null,
    max:             prices.length ? Math.max(...prices) : null,
    competitors:     available.map(p => ({ name: p.competitor_name, price: p.price })),
  };

  return ok(res, { summary });
});

// POST /api/competitor-prices  → inserção manual
router.post('/', async (req, res) => {
  const { competitor_name, date, price, room_type, competitor_url } = req.body;

  if (!competitor_name || !date || !price) {
    return fail(res, 'missing_fields', 'competitor_name, date and price required');
  }
  if (!DATE_RE.test(date)) {
    return fail(res, 'invalid_date', 'date must be YYYY-MM-DD');
  }
  if (room_type && !VALID_ROOM_TYPES.includes(room_type)) {
    return fail(res, 'invalid_room_type', `room_type must be one of: ${VALID_ROOM_TYPES.join(', ')}`);
  }
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return fail(res, 'invalid_price', 'price must be a positive number');
  }

  const { data, error } = await supabaseAdmin
    .from('competitor_prices')
    .upsert({
      competitor_name,
      competitor_url: competitor_url || null,
      platform:       'booking',
      date,
      price:          numPrice,
      room_type:      room_type || 'casal',
      source:         'manual',
      scraped_at:     new Date().toISOString(),
    }, {
      onConflict: 'competitor_name,date,room_type,source',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) return serverError(res, error);
  return ok(res, { price: data }, 201);
});

module.exports = router;
