'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');

const router = Router();

// POST /api/leads/upsert
// Body: { whatsapp_number, name?, funnel_stage? }
// Returns: { lead_id }
router.post('/upsert', async (req, res) => {
  const { whatsapp_number: rawNumber, name, funnel_stage = 'new' } = req.body;

  if (!rawNumber) {
    return fail(res, 'missing_field', 'whatsapp_number is required');
  }

  // O banco exige 10–15 dígitos (leads_whatsapp_fmt); normaliza máscara/espaços
  const whatsapp_number = String(rawNumber).replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(whatsapp_number)) {
    return fail(res, 'invalid_whatsapp',
      `Número de WhatsApp inválido: "${rawNumber}". Use código do país + DDD + número, ex: 5519999999999`);
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      { whatsapp_number, name, funnel_stage, updated_at: new Date().toISOString() },
      { onConflict: 'whatsapp_number', ignoreDuplicates: false }
    )
    .select('id, whatsapp_number, name, funnel_stage')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { lead_id: data.id, lead: data }, 200);
});

// GET /api/leads?funnel_stage=new&search=5519...&limit=50&offset=0
router.get('/', async (req, res) => {
  const { funnel_stage, search, limit = 50, offset = 0 } = req.query;

  let query = supabaseAdmin
    .from('leads')
    .select(`
      id,
      whatsapp_number,
      name,
      email,
      funnel_stage,
      created_at,
      updated_at,
      conversations(count)
    `)
    .order('updated_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (funnel_stage) query = query.eq('funnel_stage', funnel_stage);
  if (search) {
    // vírgula/parênteses quebram a sintaxe do .or() do PostgREST
    const term = String(search).replace(/[,()]/g, '').trim();
    if (term) query = query.or(`whatsapp_number.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) return serverError(res, error);

  // Map conversation count + phone alias for frontend
  const leads = (data || []).map(lead => ({
    ...lead,
    phone:              lead.whatsapp_number,   // alias esperado pelo dashboard
    conversation_count: lead.conversations?.length || 0,
  }));

  return ok(res, { leads, count: leads.length });
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select(`
      *,
      conversations(id, role, content, created_at),
      reservations(id, reservation_number, room_type, checkin_date, checkout_date, status, total_amount)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return fail(res, 'not_found', 'Lead not found', 404);
  return ok(res, { lead: data });
});

// PATCH /api/leads/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['name', 'email', 'funnel_stage', 'notes'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  // whatsapp_number (chave única do lead) — correção de contato com validação
  if (req.body.whatsapp_number !== undefined) {
    const digits = String(req.body.whatsapp_number).replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(digits)) {
      return fail(res, 'invalid_whatsapp',
        `Número de WhatsApp inválido: "${req.body.whatsapp_number}". Use país + DDD + número, ex: 5519999999999`);
    }
    updates.whatsapp_number = digits;
  }

  if (!Object.keys(updates).length) return fail(res, 'no_updates', 'No valid fields to update');

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, whatsapp_number, name, funnel_stage, updated_at')
    .single();

  if (error) {
    // 23505 = violação de unique (número já pertence a outro lead)
    if (error.code === '23505') {
      return fail(res, 'whatsapp_taken', 'Este número já está cadastrado em outro lead.', 409);
    }
    return serverError(res, error);
  }
  return ok(res, { lead: data });
});

module.exports = router;
