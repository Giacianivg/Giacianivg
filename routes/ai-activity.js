const express = require('express');
const router = express.Router();
const eventBus = require('../system/eventBus');
const { evaluate } = require('../system/decisionEngine');

// GET /api/ai/events — histórico de eventos
router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ ok: true, events: eventBus.getHistory(limit) });
});

// GET /api/ai/status — status do sistema
router.get('/status', (req, res) => {
  res.json({
    ok: true,
    system: 'Luz da Lua AI OS v1.0',
    agents: [
      { name: 'crmAgent', status: 'active', listens: ['lead_received', 'lead_scored', 'booking_confirmed'] }
    ],
    events_today: eventBus.getHistory(100).filter(e =>
      new Date(e.time).toDateString() === new Date().toDateString()
    ).length
  });
});

// POST /api/ai/test — dispara evento de teste
router.post('/test', (req, res) => {
  const { event, data } = req.body;
  if (!event) return res.status(400).json({ ok: false, error: 'event obrigatório' });
  eventBus.emit(event, { ...data, source: 'api-test' });
  res.json({ ok: true, event, data });
});

const queue = require('../ai/decisions/queue');

// GET /api/ai/decisions
router.get('/decisions', (req, res) => {
  const { status } = req.query;
  const decisions = status === 'pending' ? queue.getPending() : queue.getAll();
  res.json({ ok: true, decisions, pending: queue.getPending().length });
});

// POST /api/ai/decisions/:id/approve
router.post('/decisions/:id/approve', (req, res) => {
  const d = queue.approve(parseInt(req.params.id));
  if (!d) return res.status(404).json({ ok: false, error: 'Decisão não encontrada' });
  res.json({ ok: true, decision: d });
});

// POST /api/ai/decisions/:id/reject
router.post('/decisions/:id/reject', (req, res) => {
  const { reason } = req.body;
  const d = queue.reject(parseInt(req.params.id), reason);
  if (!d) return res.status(404).json({ ok: false, error: 'Decisão não encontrada' });
  res.json({ ok: true, decision: d });
});

module.exports = router;
