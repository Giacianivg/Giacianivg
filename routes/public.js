'use strict';

/**
 * API pública do site institucional (DEC-025 Bloco 2) — SOMENTE LEITURA.
 *
 * Montada ANTES do gate de auth do server.js (rotas públicas, sem JWT).
 * Proteção: rate limiter próprio (store isolado) + Turnstile (access token).
 * Reusa o motor de cotação e vw_ala_sellable — não recalcula preço nem inventário.
 *
 * Endpoints:
 *   POST /api/public/session       → troca token Turnstile por access token (15 min)
 *   GET  /api/public/offers        → alas que cabem + disponíveis + cotação real
 *   GET  /api/public/quote         → cotação de uma ala específica
 *   GET  /api/public/availability  → disponibilidade de uma ala (sellable)
 */

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');
const { toDB, fromDB, dateRange } = require('../services/utils/dates');
const { calculateQuotation } = require('../services/quotation/engine');
const { buildOffers } = require('../services/quotation/public-offers');
const { verifyTurnstile, issueAccessToken, verifyAccessToken } = require('../services/security/turnstile');

const router = Router();

const ALA_OF = { ALA_A: 'A', ALA_B: 'B', ALA_C_CASAL: 'C' };

// ── Rate limiter próprio (store isolado, mais estrito que o gate interno) ──────
const _store = new Map();
function publicRateLimit(windowMs = 60_000, max = 40) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = `pub:${req.ip || 'unknown'}`;
    const now = Date.now();
    let rec = _store.get(key);
    if (!rec || now > rec.resetAt) rec = { count: 1, resetAt: now + windowMs };
    else rec.count++;
    _store.set(key, rec);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rec.count));
    if (rec.count > max) {
      return fail(res, 'rate_limit', 'Muitas requisições. Tente novamente em instantes.', 429);
    }
    next();
  };
}
router.use(publicRateLimit());

// ── Exige access token válido (emitido após Turnstile). Liberado em teste. ────
function requirePublicAccess(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  if (verifyAccessToken(req.headers['x-pub-token'])) return next();
  return fail(res, 'access_required', 'Verificação necessária. Recarregue a página e tente de novo.', 401);
}

// Normaliza/valida datas (aceita YYYY-MM-DD do date picker ou DD/MM/YYYY).
function parseRange(q) {
  const checkin  = toDB(q.checkin);
  const checkout = toDB(q.checkout);
  if (!checkin || !checkout) return { error: ['missing_params', 'checkin e checkout são obrigatórios', 422] };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (checkin < today)     return { error: ['past_date', 'A data de entrada não pode estar no passado.', 422] };
  if (checkout <= checkin) return { error: ['invalid_range', 'O check-out deve ser depois do check-in.', 422] };
  const nights = dateRange(checkin, checkout).length;
  if (nights > 60) return { error: ['range_too_long', 'Período muito longo — fale conosco para estadias estendidas.', 422] };
  return { checkin, checkout, nights };
}

// POST /api/public/session — Turnstile → access token curto
router.post('/session', async (req, res) => {
  const token = (req.body && req.body.turnstile_token) || req.headers['cf-turnstile-token'];
  const valid = await verifyTurnstile(token, req.ip);
  if (!valid) return fail(res, 'captcha_failed', 'Verificação anti-robô falhou. Tente novamente.', 403);
  return ok(res, { access_token: issueAccessToken(), expires_in: 900 });
});

// GET /api/public/offers?checkin=&checkout=&guests=
router.get('/offers', requirePublicAccess, async (req, res) => {
  let parsed;
  try { parsed = parseRange(req.query); }
  catch (e) { return fail(res, 'invalid_date', e.message, 422); }
  if (parsed.error) return fail(res, ...parsed.error);
  const { checkin, checkout, nights } = parsed;

  const guests = parseInt(req.query.guests, 10);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    return fail(res, 'invalid_guests', 'Informe o número de hóspedes (1 a 20).', 422);
  }

  const [roomsRes, sellRes] = await Promise.all([
    supabaseAdmin.from('rooms').select('code, max_guests').eq('active', true),
    supabaseAdmin.from('vw_ala_sellable').select('ala, date, sellable')
      .in('ala', ['A', 'B', 'C']).gte('date', checkin).lt('date', checkout),
  ]);
  if (roomsRes.error) return serverError(res, roomsRes.error);
  if (sellRes.error)  return serverError(res, sellRes.error);

  // Agrega capacidade por ala a partir dos quartos físicos ativos (sem hardcode).
  const roomsByAla = {};
  for (const r of roomsRes.data || []) {
    const ala = String(r.code)[0];
    if (!['A', 'B', 'C'].includes(ala)) continue;
    if (!roomsByAla[ala]) roomsByAla[ala] = { maxGuests: 0, totalRooms: 0 };
    roomsByAla[ala].totalRooms++;
    const mg = Number(r.max_guests) || 0;
    if (mg > roomsByAla[ala].maxGuests) roomsByAla[ala].maxGuests = mg;
  }

  const sellableMap = new Map();
  for (const row of sellRes.data || []) sellableMap.set(`${row.ala}|${row.date}`, Number(row.sellable));

  const result = buildOffers({ checkin, checkout, guests, nights, roomsByAla, sellableMap });
  return ok(res, result);
});

// GET /api/public/quote?room_type=&checkin=&checkout=&guests=
router.get('/quote', requirePublicAccess, async (req, res) => {
  let parsed;
  try { parsed = parseRange(req.query); }
  catch (e) { return fail(res, 'invalid_date', e.message, 422); }
  if (parsed.error) return fail(res, ...parsed.error);

  const guests = parseInt(req.query.guests, 10);
  const tipo = String(req.query.room_type || '').toUpperCase();
  if (!guests || !tipo) return fail(res, 'missing_params', 'room_type e guests são obrigatórios.', 422);

  const quote = calculateQuotation({
    data_entrada: fromDB(parsed.checkin),
    data_saida:   fromDB(parsed.checkout),
    pessoas:      guests,
    tipo,
  });

  if (quote.error) {
    const code = quote.escalar ? 'requires_human' : 'quote_error';
    return fail(res, code, quote.suggestion || quote.error, 422);
  }
  return ok(res, { quote });
});

// GET /api/public/availability?room_type=&checkin=&checkout=
router.get('/availability', requirePublicAccess, async (req, res) => {
  let parsed;
  try { parsed = parseRange(req.query); }
  catch (e) { return fail(res, 'invalid_date', e.message, 422); }
  if (parsed.error) return fail(res, ...parsed.error);
  const { checkin, checkout } = parsed;

  const tipo = String(req.query.room_type || '').toUpperCase();
  const ala = ALA_OF[tipo];
  if (!ala) return fail(res, 'invalid_room_type', 'room_type deve ser ALA_A, ALA_B ou ALA_C_CASAL.', 422);

  const [roomsRes, sellRes] = await Promise.all([
    supabaseAdmin.from('rooms').select('code').eq('active', true),
    supabaseAdmin.from('vw_ala_sellable').select('date, sellable')
      .eq('ala', ala).gte('date', checkin).lt('date', checkout),
  ]);
  if (roomsRes.error) return serverError(res, roomsRes.error);
  if (sellRes.error)  return serverError(res, sellRes.error);

  const total = (roomsRes.data || []).filter(r => String(r.code)[0] === ala).length;
  const map = new Map((sellRes.data || []).map(r => [r.date, Number(r.sellable)]));
  const unavailable = dateRange(checkin, checkout).filter(d => (map.has(d) ? map.get(d) : total) < 1);

  return ok(res, { room_type: tipo, available: unavailable.length === 0, unavailable_dates: unavailable });
});

module.exports = router;
