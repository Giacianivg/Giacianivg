'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const { getFunnelData } = require('../services/analytics/funnel-analytics');

const router = Router();

/**
 * Parses the period query parameter into a number of days.
 * Accepts: "7d", "30d", "90d", or a plain integer string.
 * Defaults to 30 if invalid or missing.
 */
function parsePeriodDays(periodStr) {
  if (!periodStr) return 30;

  // Handle shorthand formats: "7d", "30d", "90d"
  const shorthand = String(periodStr).match(/^(\d+)d$/i);
  if (shorthand) {
    const days = parseInt(shorthand[1], 10);
    return isNaN(days) || days <= 0 ? 30 : days;
  }

  // Handle plain integer
  const plain = parseInt(periodStr, 10);
  return isNaN(plain) || plain <= 0 ? 30 : plain;
}

// ---------------------------------------------------------------------------
// GET /analytics/funnel/bottleneck
// Must be registered BEFORE /funnel to avoid Express route conflict.
// ---------------------------------------------------------------------------
router.get('/funnel/bottleneck', async (req, res) => {
  try {
    const result = await getFunnelData(30);

    const bottleneckStageName = result.bottleneck_stage;

    // Find the bottleneck stage entry from the stages array
    const bottleneckEntry = result.stages.find((s) => s.name === bottleneckStageName);

    const stalledLeads = bottleneckEntry
      ? bottleneckEntry.leads.filter((l) => {
          // Re-identify stalled leads: those with time_in_stage_hours > 24
          return l.time_in_stage_hours > 24;
        })
      : [];

    return ok(res, {
      bottleneck_stage: bottleneckStageName,
      stalled_leads: stalledLeads,
      count: stalledLeads.length,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /analytics/funnel?period=30d
// ---------------------------------------------------------------------------
router.get('/funnel', async (req, res) => {
  try {
    const periodDays = parsePeriodDays(req.query.period);
    const result = await getFunnelData(periodDays);

    return ok(res, { funnel: result });
  } catch (err) {
    return serverError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /analytics/revenue/pipeline — stub preserved from initial scaffold
// (to be implemented by revenue analytics feature)
// ---------------------------------------------------------------------------
router.get('/revenue/pipeline', async (req, res) => {
  try {
    const { getPipelineRevenue } = require('../services/analytics/revenue-analytics');
    const result = await getPipelineRevenue();
    return ok(res, { revenue: result });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
