'use strict';

const { Router } = require('express');
const { ok, fail, serverError } = require('../../services/utils/response');
const { calculateLeadScore } = require('../../services/scoring/lead-scorer');

const router = Router();

// GET /api/scoring/leads/:id/score
// Recalculates and returns the lead score + breakdown
router.get('/leads/:id/score', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await calculateLeadScore(id);
    return ok(res, { leadId: result.leadId, score: result.score, label: result.label, breakdown: result.breakdown });
  } catch (err) {
    if (err.message && err.message.startsWith('Lead not found')) {
      return fail(res, 'not_found', 'Lead not found', 404);
    }
    return serverError(res, err);
  }
});

module.exports = router;
