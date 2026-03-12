'use strict';

/**
 * AI Activity Routes — Pousada Luz da Lua
 *
 * Substitui a versão com eventBus/queue in-memory (sempre vazio no Vercel)
 * por leitura direta do Supabase para dados reais.
 *
 * GET  /api/ai/status      → status dos agentes + contagens do dia
 * GET  /api/ai/events      → stream de atividade real (conv + leads + follow-ups)
 * GET  /api/ai/decisions   → fila de decisões (session-scoped)
 * POST /api/ai/decisions/:id/approve
 * POST /api/ai/decisions/:id/reject
 * POST /api/ai/test        → dispara evento de teste
 */

const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../services/supabase/client');

// ─── Agents definition (static — reflexo do AI-OS) ─────────────────────────
const AGENTS = [
  { name: 'Luna (WhatsApp Bot)', status: 'active', icon: '🌙', listens: ['message_received', 'booking_confirmed', 'escalation'] },
  { name: 'CRM Agent',           status: 'active', icon: '📋', listens: ['lead_received', 'lead_scored', 'conversation_update'] },
  { name: 'Follow-up Cron',      status: 'active', icon: '⏰', listens: ['schedule_tick', 'lead_inactive', 'post_stay'] },
  { name: 'Lead Scorer',         status: 'active', icon: '📊', listens: ['conversation_update', 'message_received'] },
  { name: 'CEO Agent',           status: 'idle',   icon: '👑', listens: ['kpi_alert', 'revenue_drop', 'occupancy_low'] },
  { name: 'CMO Agent',           status: 'idle',   icon: '📣', listens: ['lead_source_change', 'campaign_request'] },
];

// ─── GET /api/ai/status ─────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [convRes, leadRes, fuRes] = await Promise.all([
      supabaseAdmin.from('conversations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00.000Z`),
      supabaseAdmin.from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00.000Z`),
      supabaseAdmin.from('scheduled_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('updated_at', `${today}T00:00:00.000Z`),
    ]);

    const events_today = (convRes.count || 0) + (leadRes.count || 0) + (fuRes.count || 0);

    return res.json({
      ok: true,
      system: 'Luz da Lua AI OS v1.0',
      agents: AGENTS,
      events_today,
      stats: {
        messages_today:  convRes.count || 0,
        leads_today:     leadRes.count || 0,
        followups_today: fuRes.count   || 0,
      },
    });
  } catch (err) {
    // Fallback: return static data if Supabase unavailable
    return res.json({ ok: true, system: 'Luz da Lua AI OS v1.0', agents: AGENTS, events_today: 0, stats: {} });
  }
});

// ─── GET /api/ai/events ─────────────────────────────────────────────────────
// Pulls real activity from Supabase instead of in-memory eventBus
router.get('/events', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  try {
    const [convRes, leadRes, fuRes] = await Promise.all([
      supabaseAdmin.from('conversations')
        .select('id, phone, role, content, created_at')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(12),
      supabaseAdmin.from('leads')
        .select('id, name, phone, source, score, created_at')
        .order('created_at', { ascending: false })
        .limit(6),
      supabaseAdmin.from('scheduled_follow_ups')
        .select('id, phone, follow_up_type, status, updated_at')
        .in('status', ['sent', 'responded'])
        .order('updated_at', { ascending: false })
        .limit(6),
    ]);

    const events = [];

    for (const msg of (convRes.data || [])) {
      events.push({
        event: 'message_received',
        time:  msg.created_at,
        data:  { phone: msg.phone, preview: (msg.content || '').slice(0, 80) },
      });
    }

    for (const lead of (leadRes.data || [])) {
      events.push({
        event: lead.score > 0 ? 'lead_scored' : 'lead_received',
        time:  lead.created_at,
        data:  { name: lead.name || 'Visitante', phone: lead.phone, score: lead.score, source: lead.source },
      });
    }

    for (const fu of (fuRes.data || [])) {
      events.push({
        event: fu.status === 'responded' ? 'followup_responded' : 'followup_sent',
        time:  fu.updated_at,
        data:  { phone: fu.phone, type: fu.follow_up_type },
      });
    }

    events.sort((a, b) => new Date(b.time) - new Date(a.time));
    return res.json({ ok: true, events: events.slice(0, limit) });
  } catch (err) {
    return res.json({ ok: true, events: [] });
  }
});

// ─── POST /api/ai/test ──────────────────────────────────────────────────────
router.post('/test', (req, res) => {
  const { event, data } = req.body;
  if (!event) return res.status(400).json({ ok: false, error: 'event obrigatório' });
  // Log to console only (no in-memory bus in serverless)
  console.log('[ai/test] event:', event, data);
  res.json({ ok: true, event, data, time: new Date().toISOString() });
});

// ─── Decision queue (session-scoped, intentional for manual approvals) ──────
const decisionQueue = [];
let _idSeq = 1;

router.get('/decisions', (req, res) => {
  const { status } = req.query;
  const decisions = status === 'pending'
    ? decisionQueue.filter(d => d.status === 'pending')
    : decisionQueue;
  res.json({ ok: true, decisions, pending: decisionQueue.filter(d => d.status === 'pending').length });
});

router.post('/decisions/:id/approve', (req, res) => {
  const d = decisionQueue.find(x => x.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ ok: false, error: 'Decisão não encontrada' });
  d.status      = 'approved';
  d.approved_at = new Date().toISOString();
  res.json({ ok: true, decision: d });
});

router.post('/decisions/:id/reject', (req, res) => {
  const d = decisionQueue.find(x => x.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ ok: false, error: 'Decisão não encontrada' });
  const { reason } = req.body;
  d.status      = 'rejected';
  d.rejected_at = new Date().toISOString();
  d.reason      = reason;
  res.json({ ok: true, decision: d });
});

module.exports = router;
