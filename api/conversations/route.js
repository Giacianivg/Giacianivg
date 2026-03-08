'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../../services/supabase/client');
const { ok, fail, serverError } = require('../../services/utils/response');

const router = Router();

// GET /api/conversations?lead_id=X&limit=100
// Fetch conversation history for a lead
router.get('/', async (req, res) => {
  const { lead_id, limit = 100 } = req.query;

  if (!lead_id) {
    return fail(res, 'missing_fields', 'lead_id is required');
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, lead_id, role, content, created_at')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: true })
    .limit(Math.min(parseInt(limit) || 100, 500));

  if (error) return serverError(res, error);
  return ok(res, { conversations: data || [] });
});

// POST /api/conversations
// Body: { lead_id, role ('user'|'assistant'|'system'), content, message_id? }
// Idempotent via message_id
router.post('/', async (req, res) => {
  const { lead_id, role, content, message_id, source } = req.body;

  if (!lead_id || !role || !content) {
    return fail(res, 'missing_fields', 'lead_id, role, and content are required');
  }
  if (!['user', 'assistant', 'system'].includes(role)) {
    return fail(res, 'invalid_role', 'role must be user, assistant, or system');
  }

  const payload = { lead_id, role, content, source: source || 'webhook' };
  if (message_id) payload.message_id = message_id;

  // Use upsert on message_id when provided for idempotency
  const query = message_id
    ? supabaseAdmin.from('conversations').upsert(payload, { onConflict: 'message_id', ignoreDuplicates: true })
    : supabaseAdmin.from('conversations').insert(payload);

  const { data, error } = await query.select('id').single();

  if (error) return serverError(res, error);
  return ok(res, { conversation_id: data.id }, 201);
});

module.exports = router;
