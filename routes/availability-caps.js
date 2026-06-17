'use strict';

/**
 * Ala Inventory Caps API — DEC-023 / F2
 *
 * Teto de venda por ala (A/B/C) e período, sem escolher quartos físicos.
 *   GET   /api/availability/caps?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   PATCH /api/availability/caps   body: { ala, from, to, available_count, note? }
 *
 * Semântica de período: [from, to) — checkout/fim EXCLUÍDO (mesma convenção de
 * availability-block.js e da diária da pousada). Datas como YYYY-MM-DD ou DD/MM/YYYY.
 *
 * Regra (DEC-023): vender = max(0, cap − reservados_físicos). O teto NUNCA derruba
 * reserva confirmada; quando cap < reservados, a resposta sinaliza em `warnings`.
 */

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const { toDB, dateRange } = require('../services/utils/dates');

const router = Router();

const VALID_ALAS = ['A', 'B', 'C'];

// Totais por ala vindos da tabela rooms (sem hardcode) — { A: 8, B: 7, C: 5 }
async function getAlaTotals() {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('code')
    .eq('active', true);
  if (error) throw error;
  const totals = {};
  for (const r of data || []) {
    const ala = (r.code || '').charAt(0);
    if (VALID_ALAS.includes(ala)) totals[ala] = (totals[ala] || 0) + 1;
  }
  return totals;
}

// GET /api/availability/caps?from=YYYY-MM-DD&to=YYYY-MM-DD
// Retorna totais por ala + linhas (ala/data) que têm teto OU reserva.
// Datas sem nenhum dos dois = ala cheia (default): consumidor usa `totals`.
router.get('/', async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return fail(res, 'missing_params', 'from and to (YYYY-MM-DD) are required');
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

  let totals;
  try {
    totals = await getAlaTotals();
  } catch (e) {
    return serverError(res, e);
  }

  const { data, error } = await supabaseAdmin
    .from('vw_ala_sellable')
    .select('ala, date, total_rooms, cap, reserved, sellable, has_cap, note')
    .gte('date', fromISO)
    .lt('date', toISO)
    .order('date', { ascending: true })
    .order('ala', { ascending: true });

  if (error) return serverError(res, error);

  return ok(res, { from: fromISO, to: toISO, totals, rows: data || [] });
});

// PATCH /api/availability/caps  → aplica teto por ala/período
router.patch('/', async (req, res) => {
  const { ala, from, to, available_count, note } = req.body;

  if (!ala || !from || !to || available_count === undefined || available_count === null) {
    return fail(res, 'missing_fields', 'ala, from, to and available_count are required');
  }
  if (!VALID_ALAS.includes(ala)) {
    return fail(res, 'invalid_ala', `ala must be one of: ${VALID_ALAS.join(', ')}`);
  }

  const count = Number(available_count);
  if (!Number.isInteger(count) || count < 0) {
    return fail(res, 'invalid_count', 'available_count must be an integer >= 0');
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

  // Teto não pode exceder o total físico da ala (abrir tudo = total)
  let totals;
  try {
    totals = await getAlaTotals();
  } catch (e) {
    return serverError(res, e);
  }
  const total = totals[ala] || 0;
  if (count > total) {
    return fail(res, 'count_exceeds_total',
      `available_count (${count}) não pode exceder o total da ala ${ala} (${total})`);
  }

  const dates = dateRange(fromISO, toISO);
  if (dates.length === 0) {
    return fail(res, 'empty_range', 'período não contém datas');
  }

  const rows = dates.map(date => ({
    ala,
    date,
    available_count: count,
    note: note || null,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await supabaseAdmin
    .from('ala_inventory_caps')
    .upsert(rows, { onConflict: 'ala,date', ignoreDuplicates: false });

  if (upsertErr) return serverError(res, upsertErr);

  // Avisos: datas em que o teto ficou ABAIXO do já reservado (não derruba reserva)
  const { data: sellRows, error: sellErr } = await supabaseAdmin
    .from('vw_ala_sellable')
    .select('date, reserved, cap')
    .eq('ala', ala)
    .gte('date', fromISO)
    .lt('date', toISO);

  if (sellErr) return serverError(res, sellErr);

  const warnings = (sellRows || [])
    .filter(r => r.reserved > r.cap)
    .map(r => ({ date: r.date, reserved: r.reserved, cap: r.cap }));

  return ok(res, {
    ala,
    from: fromISO,
    to: toISO,
    available_count: count,
    total,
    applied: dates.length,
    warnings,
  });
});

module.exports = router;
