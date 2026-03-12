'use strict';

/**
 * Vouchers API — Pousada Luz da Lua
 * PLU-12.1 | DEC-016
 *
 * GET  /api/vouchers                    → lista com filtros
 * POST /api/vouchers                    → criar voucher
 * GET  /api/vouchers/:id                → detalhe
 * PATCH /api/vouchers/:id               → atualizar (status, notes)
 * GET  /api/vouchers/:id/download       → PDF (público via download_token)
 */

const { Router } = require('express');
const { supabaseAdmin }       = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');

// Lazy-load pdf-lib: evita falha de cold start no Vercel se o módulo demorar a carregar
function getVoucherGenerator() {
  return require('../services/voucher/voucher-generator');
}

const router = Router();

const VALID_SOURCES = ['direct', 'booking', 'expedia', 'whatsapp'];
const VALID_STATUSES = ['active', 'cancelled'];

// ─── GET /api/vouchers ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { source, status, search, limit = '50', offset = '0' } = req.query;

  let query = supabaseAdmin
    .from('vouchers')
    .select('id, guest_name, room_type, check_in, check_out, guests, source, total_amount, status, download_token, created_at')
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (source  && VALID_SOURCES.includes(source))   query = query.eq('source', source);
  if (status  && VALID_STATUSES.includes(status))  query = query.eq('status', status);
  if (search) query = query.ilike('guest_name', `%${search}%`);

  const { data, error } = await query;
  if (error) return serverError(res, error);
  const vouchers = data || [];
  return ok(res, { vouchers, count: vouchers.length, limit: Number(limit), offset: Number(offset) });
});

// ─── POST /api/vouchers ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { reservation_id, guest_name, room_type, check_in, check_out, guests, source, total_amount, notes } = req.body;

  if (!guest_name || !room_type || !check_in || !check_out || !guests) {
    return fail(res, 'missing_fields', 'guest_name, room_type, check_in, check_out, guests são obrigatórios');
  }
  if (source && !VALID_SOURCES.includes(source)) {
    return fail(res, 'invalid_source', `source deve ser: ${VALID_SOURCES.join(', ')}`);
  }

  const payload = {
    guest_name,
    room_type,
    check_in,
    check_out,
    guests:       Number(guests),
    source:       source || 'direct',
    total_amount: total_amount != null ? Number(total_amount) : null,
    notes:        notes || null,
  };
  if (reservation_id) payload.reservation_id = reservation_id;

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .insert(payload)
    .select('id, download_token, status, created_at')
    .single();

  if (error) return serverError(res, error);

  const baseUrl = process.env.BASE_URL || 'https://webhook-six-topaz.vercel.app';
  return ok(res, {
    id:           data.id,
    download_token: data.download_token,
    download_url: `${baseUrl}/api/vouchers/${data.id}/download?token=${data.download_token}`,
    status:       data.status,
    created_at:   data.created_at,
  }, 201);
});

// ─── GET /api/vouchers/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return notFound(res, 'Voucher');

  const baseUrl = process.env.BASE_URL || 'https://webhook-six-topaz.vercel.app';
  return ok(res, {
    ...data,
    download_url: `${baseUrl}/api/vouchers/${data.id}/download?token=${data.download_token}`,
  });
});

// ─── PATCH /api/vouchers/:id ──────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (status && !VALID_STATUSES.includes(status)) {
    return fail(res, 'invalid_status', `status deve ser: ${VALID_STATUSES.join(', ')}`);
  }

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('vouchers')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchErr || !current) return notFound(res, 'Voucher');

  const updates = { updated_at: new Date().toISOString() };
  if (status !== undefined) updates.status = status;
  if (notes  !== undefined) updates.notes  = notes;

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .update(updates)
    .eq('id', id)
    .select('id, status, notes, updated_at')
    .single();

  if (error) return serverError(res, error);
  return ok(res, { voucher: data });
});

// ─── GET /api/vouchers/:id/download ──────────────────────────────────────────
// Endpoint PÚBLICO — autenticação via download_token (sem JWT)
router.get('/:id/download', async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(403).json({ success: false, error: 'forbidden', message: 'Token de download obrigatório' });
  }

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, error: 'not_found', message: 'Voucher não encontrado' });
  }

  if (data.download_token !== token) {
    return res.status(403).json({ success: false, error: 'forbidden', message: 'Token inválido' });
  }

  try {
    const { generateVoucherPDF } = getVoucherGenerator();
    const pdfBuffer = await generateVoucherPDF(data);
    const filename  = `voucher-${data.guest_name.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[vouchers/download] PDF generation error:', err);
    return res.status(500).json({ success: false, error: 'pdf_error', message: 'Erro ao gerar PDF' });
  }
});

module.exports = router;
