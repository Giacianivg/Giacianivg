'use strict';

/**
 * Ala Inventory Caps API — DEC-023 / F2
 *
 * Teto de venda por ala (A/B/C) e período, sem escolher quartos físicos.
 *   GET   /api/availability/caps?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   PATCH /api/availability/caps   body: { ala, from, to, available_count, note? }
 *
 * Semântica de período: from..to INCLUSIVO (cada dia do calendário recebe o teto),
 * aceitando dia único (from === to). Mesma convenção do recurso irmão de preço
 * travado (room_price_overrides), que também é acionado por arraste na linha da ala.
 * Datas como YYYY-MM-DD ou DD/MM/YYYY.
 *
 * Regra (DEC-023): vender = max(0, cap − reservados_físicos). O teto NUNCA derruba
 * reserva confirmada; quando cap < reservados, a resposta sinaliza em `warnings`.
 */

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const { toDB } = require('../services/utils/dates');

const router = Router();

// Datas inclusivas from..to (YYYY-MM-DD), em UTC para evitar shift de fuso —
// mesma convenção de routes/pricing.js (room_price_overrides), o recurso irmão
// que também é acionado por "arraste na linha da ala" no calendário.
function inclusiveDateRange(fromISO, toISO) {
  const out = [];
  const d = new Date(fromISO + 'T00:00:00Z');
  const end = new Date(toISO + 'T00:00:00Z');
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

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
  if (fromISO > toISO) {
    return fail(res, 'invalid_range', 'from must be <= to');
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
    .lte('date', toISO)
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
  if (fromISO > toISO) {
    return fail(res, 'invalid_range', 'from must be <= to');
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

  const dates = inclusiveDateRange(fromISO, toISO);
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
    .lte('date', toISO);

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
