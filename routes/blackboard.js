'use strict';

/**
 * GET /api/blackboard/state
 * Retorna o estado completo do Blackboard (leads, reservas, financeiro, alertas).
 * Autenticado via requireCrmAuth (montado em server.js).
 * DEC-007 aprovado 2026-03-10
 */

const { Router } = require('express');
const blackboard  = require('../system/blackboard');

const router = Router();

router.get('/state', async (req, res) => {
  try {
    const state = await blackboard.getState();
    res.json({ ok: true, state, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
