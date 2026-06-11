'use strict';

/**
 * Pricing API — Fase 1.5 (Motor de Precificação Dinâmica)
 *
 * GET    /api/pricing/calendar?days=90      → calendário de multiplicadores + fatores
 * GET    /api/pricing/settings              → chaves do motor (floor/ceiling/meta/modo)
 * PUT    /api/pricing/settings              → edita chaves (dashboard)
 * PUT    /api/pricing/overrides/:date       → trava data com multiplicador manual
 * DELETE /api/pricing/overrides/:date       → remove trava
 * GET    /api/pricing/log?from=&to=&limit=  → auditoria (price_log)
 */

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const pricing = require('../services/pricing/dynamic-pricing');

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SETTINGS_RULES = {
  price_floor:      { type: 'number', min: 1, max: 100000 },
  price_ceiling:    { type: 'number', min: 1, max: 100000 },
  target_occupancy: { type: 'number', min: 1, max: 100 },
  pricing_mode:     { type: 'enum', values: ['off', 'auto'] },
};

// GET /api/pricing/calendar?days=90
router.get('/calendar', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 90, 1), 365);
    const calendar = await pricing.buildCalendar(days);

    // Exemplo de preço por dia: faixa min/max dos quartos ativos já clampada
    const { data: rooms, error } = await supabaseAdmin
      .from('rooms')
      .select('code, name, base_price_media')
      .eq('active', true)
      .order('sort_order');
    if (error) return serverError(res, error);

    const bases = (rooms || []).map(r => Number(r.base_price_media)).filter(Number.isFinite);
    const minBase = bases.length ? Math.min(...bases) : null;
    const maxBase = bases.length ? Math.max(...bases) : null;

    const daysOut = calendar.days.map(d => ({
      ...d,
      price_example: minBase !== null ? {
        min: pricing.clampPrice(minBase * d.multiplier, calendar.settings),
        max: pricing.clampPrice(maxBase * d.multiplier, calendar.settings),
      } : null,
    }));

    return ok(res, {
      settings: calendar.settings,
      reference_price: calendar.referencePrice,
      total_rooms: calendar.totalRooms,
      rooms: rooms || [],
      days: daysOut,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/pricing/settings
router.get('/settings', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value, description')
    .in('key', Object.keys(SETTINGS_RULES));
  if (error) return serverError(res, error);

  const settings = { ...pricing.DEFAULT_SETTINGS };
  for (const row of data || []) {
    settings[row.key] = row.key === 'pricing_mode' ? String(row.value) : Number(row.value);
  }
  return ok(res, { settings });
});

// PUT /api/pricing/settings
router.put('/settings', async (req, res) => {
  const updates = {};
  for (const [key, rule] of Object.entries(SETTINGS_RULES)) {
    const raw = req.body[key];
    if (raw === undefined) continue;
    if (rule.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num) || num < rule.min || num > rule.max) {
        return fail(res, 'invalid_value', `${key} deve ser número entre ${rule.min} e ${rule.max}`);
      }
      updates[key] = String(num);
    } else {
      if (!rule.values.includes(raw)) {
        return fail(res, 'invalid_value', `${key} deve ser um de: ${rule.values.join(', ')}`);
      }
      updates[key] = String(raw);
    }
  }

  if (Object.keys(updates).length === 0) {
    return fail(res, 'no_changes', 'Nenhuma chave válida informada');
  }

  // Consistência piso/teto considerando os valores que não mudaram
  const { data: current, error: curErr } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['price_floor', 'price_ceiling']);
  if (curErr) return serverError(res, curErr);

  const merged = { ...Object.fromEntries((current || []).map(r => [r.key, Number(r.value)])) };
  if (updates.price_floor !== undefined) merged.price_floor = Number(updates.price_floor);
  if (updates.price_ceiling !== undefined) merged.price_ceiling = Number(updates.price_ceiling);
  if (Number.isFinite(merged.price_floor) && Number.isFinite(merged.price_ceiling) &&
      merged.price_floor >= merged.price_ceiling) {
    return fail(res, 'invalid_range', 'price_floor deve ser menor que price_ceiling');
  }

  for (const [key, value] of Object.entries(updates)) {
    const { error } = await supabaseAdmin
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) return serverError(res, error);
  }

  pricing.invalidateCache();
  require('../services/quotation/engine').invalidatePricingCache();

  return ok(res, { updated: Object.keys(updates) });
});

// PUT /api/pricing/overrides/:date  { multiplier, note? }
router.put('/overrides/:date', async (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return fail(res, 'invalid_date', 'Data deve ser YYYY-MM-DD');

  const multiplier = Number(req.body.multiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 3) {
    return fail(res, 'invalid_multiplier', 'multiplier deve ser número entre 0 e 3');
  }

  const { data, error } = await supabaseAdmin
    .from('price_overrides')
    .upsert({
      date,
      multiplier,
      note: req.body.note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'date' })
    .select()
    .single();
  if (error) return serverError(res, error);

  pricing.logPriceCalc({
    date,
    room_code: 'ALL',
    base_price: 0,
    multiplier,
    final_price: 0,
    factors: { override: multiplier, note: req.body.note || null },
    source: 'manual',
  });
  pricing.invalidateCache();

  return ok(res, { override: data });
});

// DELETE /api/pricing/overrides/:date
router.delete('/overrides/:date', async (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return fail(res, 'invalid_date', 'Data deve ser YYYY-MM-DD');

  const { error } = await supabaseAdmin
    .from('price_overrides')
    .delete()
    .eq('date', date);
  if (error) return serverError(res, error);

  pricing.invalidateCache();
  return ok(res, { removed: date });
});

// GET /api/pricing/log?from=&to=&limit=
router.get('/log', async (req, res) => {
  const { from, to } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);

  let query = supabaseAdmin
    .from('price_log')
    .select('id, date, room_code, base_price, multiplier, final_price, factors, source, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (from && DATE_RE.test(from)) query = query.gte('date', from);
  if (to && DATE_RE.test(to)) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return serverError(res, error);

  return ok(res, { log: data, count: data.length });
});

module.exports = router;
