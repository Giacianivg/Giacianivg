'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, serverError } = require('../services/utils/response');

const router = Router();

const ACTIVE_STATUSES = ['pending', 'deposit_paid', 'confirmed', 'checked_in', 'checkedin', 'checkedout', 'completed'];

// ─── Helper: month key from ISO date string ───────────────────────────────────
function monthKey(isoDate) {
  return isoDate ? isoDate.slice(0, 7) : null; // "YYYY-MM"
}

// GET /api/financial/summary
// KPIs principais: receita confirmada, pendente, ticket médio, breakdown por quarto
router.get('/summary', async (req, res) => {
  try {
    // All non-cancelled reservations
    const { data: reservations, error: resErr } = await supabaseAdmin
      .from('reservations')
      .select('id, room_type, total_amount, deposit_amount, balance_amount, status, checkin_date, checkout_date, created_at')
      .eq('is_test', false)
      .in('status', ACTIVE_STATUSES);

    if (resErr) return serverError(res, resErr);

    // Confirmed payments (received cash)
    const { data: payments, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('amount, status, confirmed_at')
      .eq('is_test', false)
      .eq('status', 'confirmed');

    if (payErr) return serverError(res, payErr);

    const resos = reservations || [];
    const pays  = payments || [];

    // KPIs
    const total_reservas   = resos.length;
    const receita_total    = resos.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const depositos_pagos  = resos
      .filter(r => ['deposit_paid', 'confirmed', 'checked_in', 'completed'].includes(r.status))
      .reduce((s, r) => s + Number(r.deposit_amount || 0), 0);
    const saldo_pendente   = resos
      .filter(r => ['deposit_paid', 'confirmed'].includes(r.status))
      .reduce((s, r) => s + Number(r.balance_amount || 0), 0);
    const receita_confirmada = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
    const ticket_medio     = total_reservas > 0 ? receita_total / total_reservas : 0;

    // Reservas concluídas vs ativas
    const completadas  = resos.filter(r => r.status === 'completed').length;
    const em_andamento = resos.filter(r => ['confirmed', 'checked_in'].includes(r.status)).length;
    const pendentes    = resos.filter(r => r.status === 'pending').length;

    // Breakdown por quarto
    const por_quarto = {};
    for (const r of resos) {
      if (!por_quarto[r.room_type]) por_quarto[r.room_type] = { count: 0, total: 0 };
      por_quarto[r.room_type].count++;
      por_quarto[r.room_type].total += Number(r.total_amount || 0);
    }

    // Meses recentes (últimos 6) para mini-sparkline
    const por_mes = {};
    for (const r of resos) {
      const mk = monthKey(r.checkin_date);
      if (!mk) continue;
      if (!por_mes[mk]) por_mes[mk] = { count: 0, total: 0 };
      por_mes[mk].count++;
      por_mes[mk].total += Number(r.total_amount || 0);
    }

    const mes_keys = Object.keys(por_mes).sort().slice(-6);
    const recentes_por_mes = mes_keys.map(k => ({ month: k, ...por_mes[k] }));

    return ok(res, {
      kpis: {
        total_reservas,
        receita_total:       Math.round(receita_total * 100) / 100,
        depositos_pagos:     Math.round(depositos_pagos * 100) / 100,
        saldo_pendente:      Math.round(saldo_pendente * 100) / 100,
        receita_confirmada:  Math.round(receita_confirmada * 100) / 100,
        ticket_medio:        Math.round(ticket_medio * 100) / 100,
        completadas,
        em_andamento,
        pendentes,
      },
      por_quarto,
      recentes_por_mes,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/monthly?year=2026
// Receita mensal agrupada por mês de check-in
router.get('/monthly', async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const from = `${year}-01-01`;
    const to   = `${year}-12-31`;

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('total_amount, deposit_amount, status, checkin_date')
      .eq('is_test', false)
      .in('status', ACTIVE_STATUSES)
      .gte('checkin_date', from)
      .lte('checkin_date', to);

    if (error) return serverError(res, error);

    // Build 12-month array
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      months[key] = { month: key, count: 0, total_amount: 0, depositos: 0 };
    }

    for (const r of (data || [])) {
      const mk = monthKey(r.checkin_date);
      if (!mk || !months[mk]) continue;
      months[mk].count++;
      months[mk].total_amount += Number(r.total_amount || 0);
      if (['deposit_paid', 'confirmed', 'checked_in', 'completed'].includes(r.status)) {
        months[mk].depositos += Number(r.deposit_amount || 0);
      }
    }

    const result = Object.values(months).map(m => ({
      ...m,
      total_amount: Math.round(m.total_amount * 100) / 100,
      depositos:    Math.round(m.depositos    * 100) / 100,
    }));

    return ok(res, { year, months: result });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/recent?limit=20
// Últimas reservas com detalhe financeiro
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        id, reservation_number, room_type, checkin_date, checkout_date,
        guests, total_amount, deposit_amount, balance_amount, status, created_at,
        leads(name, whatsapp_number)
      `)
      .eq('is_test', false)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return serverError(res, error);
    return ok(res, { reservations: data || [], count: (data || []).length });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
