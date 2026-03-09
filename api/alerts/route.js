'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { ok, fail, serverError } = require('../../services/utils/response');

const router = Router();

// Priority order for sorting: lower number = higher priority
const ALERT_PRIORITY = {
  hot_lead: 1,
  quote_expiring: 2,
  checkin_soon: 3,
  stalled: 4,
  no_response: 5,
};

// GET /api/alerts/active
// Returns all leads with an active alert, sorted by priority then score DESC
router.get('/active', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, whatsapp_number, alert_type, alert_message, score, score_label, alert_updated_at')
      .not('alert_type', 'is', null);

    if (error) return serverError(res, error);

    const alerts = (data || [])
      .map(lead => ({
        lead_id: lead.id,
        name: lead.name,
        phone: lead.whatsapp_number,
        alert_type: lead.alert_type,
        alert_message: lead.alert_message,
        score: lead.score,
        score_label: lead.score_label,
        alert_updated_at: lead.alert_updated_at,
      }))
      .sort((a, b) => {
        const priorityA = ALERT_PRIORITY[a.alert_type] || 99;
        const priorityB = ALERT_PRIORITY[b.alert_type] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        // Same priority: sort by score DESC
        return (b.score || 0) - (a.score || 0);
      });

    return ok(res, { alerts, count: alerts.length });
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/alerts/:leadId/dismiss
// Clears alert fields for a lead
router.post('/:leadId/dismiss', async (req, res) => {
  try {
    const { leadId } = req.params;

    // Verify lead exists
    const { data: existing, error: findError } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .single();

    if (findError || !existing) {
      return fail(res, 'not_found', 'Lead not found', 404);
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .update({
        alert_type: null,
        alert_message: null,
        alert_updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (error) return serverError(res, error);

    return ok(res, { success: true, lead_id: leadId });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
