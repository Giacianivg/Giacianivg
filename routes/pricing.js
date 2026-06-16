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

// Alas com preço absoluto editável (mesmas cotáveis da Luna; grupo é sob consulta)
const VALID_ALAS = ['ALA_A', 'ALA_B', 'ALA_C_CASAL'];

// Datas inclusivas de from..to (YYYY-MM-DD), em UTC para evitar shift de fuso
function inclusiveDateRange(from, to) {
  const out = [];
  const d = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

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

    // quote_base: preços-base por ala (baixa/media) + alta, para o calendário
    // exibir o preço real do motor (base × multiplicador) sem hardcode no front.
    // Mesma fonte da cotação da Luna: rooms (ALA_*) + settings.alta_base_price.
    const QUOTABLE = ['ALA_A', 'ALA_B', 'ALA_C_CASAL'];
    const [alaRes, altaRes] = await Promise.all([
      supabaseAdmin.from('rooms').select('code, base_price_baixa, base_price_media').in('code', QUOTABLE),
      supabaseAdmin.from('settings').select('value').eq('key', 'alta_base_price').maybeSingle(),
    ]);
    const quote_base = { alta: altaRes.data ? Number(altaRes.data.value) : 400 };
    for (const r of alaRes.data || []) {
      quote_base[r.code] = { baixa: Number(r.base_price_baixa), media: Number(r.base_price_media) };
    }

    return ok(res, {
      settings: calendar.settings,
      reference_price: calendar.referencePrice,
      total_rooms: calendar.totalRooms,
      rooms: rooms || [],
      quote_base,
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

// ─── Overrides de preço ABSOLUTO por ala/data (Bloco 4 / C′) ────────────────
// Lidos pelo calendário (visão do dono). A Luna só honra após edição futura do
// engine.js (gated em auto) — ver pendência em docs/STATUS.md.

// GET /api/pricing/room-overrides?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/room-overrides', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return fail(res, 'invalid_date', 'from e to (YYYY-MM-DD) são obrigatórios');
  }
  const { data, error } = await supabaseAdmin
    .from('room_price_overrides')
    .select('room_type, date, price, note')
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) return serverError(res, error);
  return ok(res, { overrides: data, count: data.length });
});

// PUT /api/pricing/room-overrides  { room_type, from, to, price, note? }
router.put('/room-overrides', async (req, res) => {
  const { room_type, from, to, price, note } = req.body;
  if (!VALID_ALAS.includes(room_type)) {
    return fail(res, 'invalid_room_type', `room_type deve ser um de: ${VALID_ALAS.join(', ')}`);
  }
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return fail(res, 'invalid_date', 'from e to (YYYY-MM-DD) são obrigatórios');
  }
  if (from > to) return fail(res, 'invalid_range', 'from deve ser <= to');
  const numPrice = Number(price);
  if (!Number.isFinite(numPrice) || numPrice <= 0) {
    return fail(res, 'invalid_price', 'price deve ser número positivo');
  }
  const dates = inclusiveDateRange(from, to);
  if (dates.length > 62) return fail(res, 'range_too_large', 'Período máximo de 62 dias por edição');

  const nowIso = new Date().toISOString();
  const rows = dates.map(date => ({ room_type, date, price: numPrice, note: note || null, updated_at: nowIso }));
  const { data, error } = await supabaseAdmin
    .from('room_price_overrides')
    .upsert(rows, { onConflict: 'room_type,date' })
    .select('room_type, date, price');
  if (error) return serverError(res, error);
  return ok(res, { saved: data.length, room_type, from, to, price: numPrice });
});

// DELETE /api/pricing/room-overrides  { room_type, from, to }
router.delete('/room-overrides', async (req, res) => {
  const { room_type, from, to } = req.body;
  if (!VALID_ALAS.includes(room_type)) {
    return fail(res, 'invalid_room_type', `room_type deve ser um de: ${VALID_ALAS.join(', ')}`);
  }
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return fail(res, 'invalid_date', 'from e to (YYYY-MM-DD) são obrigatórios');
  }
  const { data, error } = await supabaseAdmin
    .from('room_price_overrides')
    .delete()
    .eq('room_type', room_type)
    .gte('date', from)
    .lte('date', to)
    .select('date');
  if (error) return serverError(res, error);
  return ok(res, { removed: data.length, room_type, from, to });
});

module.exports = router;
