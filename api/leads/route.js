'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { ok, fail, serverError } = require('../../services/utils/response');

const router = Router();

// POST /api/leads/upsert
// Body: { whatsapp_number, name?, status? }
// Returns: { lead_id }
router.post('/upsert', async (req, res) => {
  const { whatsapp_number, name, status = 'active' } = req.body;

  if (!whatsapp_number) {
    return fail(res, 'missing_field', 'whatsapp_number is required');
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      { whatsapp_number, name, status, updated_at: new Date().toISOString() },
      { onConflict: 'whatsapp_number', ignoreDuplicates: false }
    )
    .select('id, whatsapp_number, name, status')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { lead_id: data.id, lead: data }, 200);
});

module.exports = router;
