'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');

const router = Router();

// GET /api/conversations?lead_id=X&limit=100
// GET /api/conversations?phone=551199...&limit=100
// Fetch conversation history for a lead (by lead_id or phone/whatsapp_number)
router.get('/', async (req, res) => {
  const { lead_id, phone, limit = 100 } = req.query;

  if (!lead_id && !phone) {
    return fail(res, 'missing_fields', 'lead_id or phone is required');
  }

  // Parse limit: default 100, max 10000 (show all conversations)
  const parsedLimit = Math.min(parseInt(limit) || 100, 10000);

  // Build query — prefer lead_id, fall back to whatsapp_number
  let query = supabaseAdmin
    .from('conversations')
    .select('id, lead_id, role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(parsedLimit);

  if (lead_id) {
    query = query.eq('lead_id', lead_id);
  } else {
    query = query.eq('whatsapp_number', phone);
  }

  // Fetch LAST N messages (most recent first), then reverse to show oldest first
  const { data: rawData, error } = await query;

  // Reverse to get chronological order (oldest first)
  const data = rawData ? rawData.reverse() : [];

  if (error) {
    console.error('[conversations] GET error:', error);
    return serverError(res, error);
  }

  const identifier = lead_id ? `lead ${lead_id}` : `phone ${phone}`;
  console.log(`[conversations] GET returned ${data?.length || 0} messages for ${identifier}`);
  if (data && data.length > 0) {
    console.log('[conversations] First message:', JSON.stringify(data[0], null, 2));
    console.log('[conversations] Last message:', JSON.stringify(data[data.length - 1], null, 2));
  }

  return ok(res, { conversations: data || [] });
});

// GET /api/conversations/debug/:lead_id
// Debug endpoint: shows raw database state without filtering
router.get('/debug/:lead_id', async (req, res) => {
  const { lead_id } = req.params;

  if (!lead_id) {
    return fail(res, 'missing_fields', 'lead_id is required');
  }

  // Count total messages
  const { count, error: countError } = await supabaseAdmin
    .from('conversations')
    .select('id', { count: 'exact' })
    .eq('lead_id', lead_id);

  if (countError) {
    console.error('[conversations/debug] Count error:', countError);
  }

  // Get the 10 most recent messages (DESC order)
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, lead_id, role, content, created_at')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[conversations/debug] Error:', error);
    return serverError(res, error);
  }

  console.log(`[conversations/debug] Total messages for ${lead_id}: ${count || 0}`);
  console.log('[conversations/debug] 10 most recent:', JSON.stringify(data, null, 2));

  return ok(res, {
    total_count: count || 0,
    last_10_messages: data || [],
    debug_info: {
      query_timestamp: new Date().toISOString(),
      lead_id,
    },
  });
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
