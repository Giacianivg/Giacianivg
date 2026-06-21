'use strict';

/**
 * Cloudflare Turnstile (captcha) + token de acesso curto para a porta pública.
 * DEC-025 Bloco 2.
 *
 * Fluxo: o site resolve o desafio Turnstile no navegador → troca o token por um
 * access token assinado (HMAC, 15 min) em POST /api/public/session → usa esse
 * access token (header x-pub-token) nas leituras (quote/availability/offers).
 * Assim o hóspede verifica UMA vez e navega/cota livremente por 15 min.
 *
 * Degradação graciosa: sem TURNSTILE_SECRET_KEY, verifyTurnstile() retorna true
 * (captcha desativado) — o local/dev funciona antes de a chave ser configurada,
 * exatamente como o padrão do webhook do Mercado Pago.
 */

const crypto = require('crypto');

const SECRET       = process.env.TURNSTILE_SECRET_KEY;
const TOKEN_SECRET = process.env.PUBLIC_TOKEN_SECRET
  || process.env.INTERNAL_API_KEY
  || crypto.randomBytes(32).toString('hex'); // por-boot se nada configurado (tokens de 15 min)
const TOKEN_TTL_MS = 15 * 60 * 1000;
const VERIFY_URL   = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let _warned = false;

/**
 * Verifica o token do Turnstile com a Cloudflare.
 * @returns {Promise<boolean>} true se válido (ou se o captcha não está configurado)
 */
async function verifyTurnstile(token, ip) {
  if (!SECRET) {
    if (!_warned) {
      _warned = true;
      console.warn('[turnstile] TURNSTILE_SECRET_KEY ausente — captcha DESATIVADO (dev). Configure na Vercel para ativar.');
    }
    return true; // graceful: não configurado
  }
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: SECRET, response: String(token) });
    if (ip) body.append('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('[turnstile] erro ao verificar:', e.message);
    return false;
  }
}

/** Emite um access token assinado (exp.HMAC) válido por 15 min. */
function issueAccessToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

/** Valida o access token: formato, assinatura (timing-safe) e expiração. */
function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig    = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(expStr).digest('hex');
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/** true quando o captcha está realmente configurado (secret presente). */
function isCaptchaConfigured() {
  return Boolean(SECRET);
}

module.exports = { verifyTurnstile, issueAccessToken, verifyAccessToken, isCaptchaConfigured, TOKEN_TTL_MS };
