'use strict';

/**
 * Occupancy API — DEC-024 / F2 — FONTE ÚNICA de ocupação consumida por todas as telas.
 *
 *   GET /api/occupancy/board               → board do dia (check-ins/outs/in-house), fuso BR
 *   GET /api/occupancy/calendar?from=&to=  → status por quarto físico/dia (ocupado/bloqueado)
 *   GET /api/occupancy/rooms-today         → status canônico de cada quarto físico HOJE (fuso BR)
 *
 * Regras canônicas (DEC-024) vêm das views: vw_today_board, vw_room_day_status.
 * "Hoje" sempre em America/Sao_Paulo (servidor Vercel roda em UTC).
 */

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "Hoje" em America/Sao_Paulo como YYYY-MM-DD (en-CA dá o formato ISO de data)
function todayBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// GET /api/occupancy/board — board canônico do dia
router.get('/board', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('vw_today_board')
    .select('reservation_id, room_type, checkin_date, checkout_date, status, guests, guest_name, room_total, charges_total, balance_due, is_checkin_today, is_checkout_today, is_in_house');

  if (error) return serverError(res, error);

  const rows      = data || [];
  const checkins  = rows.filter(r => r.is_checkin_today);
  const checkouts = rows.filter(r => r.is_checkout_today);
  const inHouse   = rows.filter(r => r.is_in_house);

  return ok(res, {
    date:   todayBR(),
    counts: { checkins: checkins.length, checkouts: checkouts.length, in_house: inHouse.length },
    checkins,
    checkouts,
    in_house: inHouse,
  });
});

// GET /api/occupancy/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Status por quarto físico/dia (só linhas ocupadas/bloqueadas; ausência = livre).
router.get('/calendar', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return fail(res, 'invalid_date', 'from e to (YYYY-MM-DD) são obrigatórios');
  }
  if (from > to) return fail(res, 'invalid_range', 'from deve ser <= to');

  const { data, error } = await supabaseAdmin
    .from('vw_room_day_status')
    .select('room_code, date, status, reservation_id, guest_name, resv_status')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('room_code', { ascending: true });

  if (error) return serverError(res, error);
  return ok(res, { from, to, rows: data || [] });
});

// GET /api/occupancy/rooms-today — status canônico de cada quarto físico HOJE
router.get('/rooms-today', async (req, res) => {
  const today = todayBR();

  const [{ data: rooms, error: rErr }, { data: occ, error: oErr }] = await Promise.all([
    supabaseAdmin.from('rooms').select('code, name, sort_order').eq('active', true).order('sort_order'),
    supabaseAdmin.from('vw_room_day_status')
      .select('room_code, status, reservation_id, guest_name, resv_status')
      .eq('date', today),
  ]);

  if (rErr || oErr) return serverError(res, rErr || oErr);

  const byRoom = {};
  for (const o of (occ || [])) byRoom[o.room_code] = o;

  const list = (rooms || []).map(rm => {
    const o = byRoom[rm.code];
    return {
      code:           rm.code,
      name:           rm.name,
      status:         o ? o.status : 'available',   // occupied | blocked | available
      reservation_id: o?.reservation_id || null,
      guest_name:     o?.guest_name || null,
    };
  });

  return ok(res, { date: today, rooms: list });
});

// GET /api/occupancy/checkouts?days=1|7|30 — histórico de check-outs realizados
// Lê o MESMO registro canônico (reservations.status='checkedout' + checkout_at) e o
// saldo da vw_reservation_balance. Ordenado do mais recente para o mais antigo.
router.get('/checkouts', async (req, res) => {
  const daysMap = { 1: 1, 7: 7, 30: 30 };
  const days = daysMap[Number(req.query.days)] || 7;

  // Janela em fuso BR (UTC-3): início = hoje − (days−1) à meia-noite BR.
  const start = new Date(todayBR() + 'T00:00:00-03:00');
  start.setDate(start.getDate() - (days - 1));
  const cutoffISO = start.toISOString();

  const { data: resv, error } = await supabaseAdmin
    .from('reservations')
    .select('id, room_type, checkout_date, checkout_at, leads!fk_res_lead(name)')
    .eq('status', 'checkedout')
    .gte('checkout_at', cutoffISO)
    .order('checkout_at', { ascending: false });

  if (error) return serverError(res, error);

  const ids = (resv || []).map(r => r.id);
  const balById = {};
  if (ids.length) {
    const { data: bals, error: bErr } = await supabaseAdmin
      .from('vw_reservation_balance')
      .select('reservation_id, room_total, charges_total, deposit_paid, payments_confirmed')
      .in('reservation_id', ids);
    if (bErr) return serverError(res, bErr);
    for (const b of (bals || [])) balById[b.reservation_id] = b;
  }

  const checkouts = (resv || []).map(r => {
    const b = balById[r.id] || {};
    const paid = Number(b.deposit_paid || 0) + Number(b.payments_confirmed || 0);
    return {
      reservation_id: r.id,
      room_type:      r.room_type,
      guest_name:     r.leads?.name || null,
      checkout_date:  r.checkout_date,
      checkout_at:    r.checkout_at,
      total_paid:     paid,
      total:          Number(b.room_total || 0) + Number(b.charges_total || 0),
    };
  });

  return ok(res, { days, count: checkouts.length, checkouts });
});

module.exports = router;
