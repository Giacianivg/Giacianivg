'use strict';

/**
 * Branding da pousada lido da tabela `settings` (Supabase), com cache de 5
 * minutos e fallback nos valores atuais da Pousada Luz da Lua.
 *
 * getBranding() é SÍNCRONO: retorna o cache (ou os defaults) imediatamente e
 * dispara um refresh em background quando o cache expira. Isso preserva a
 * assinatura síncrona dos templates de follow-up e evita mudar call sites.
 * Consequência: a primeira chamada após cold start usa os defaults; chamadas
 * seguintes usam o valor do banco. Como os seeds são idênticos aos defaults,
 * o comportamento é byte-idêntico para a Luz da Lua.
 */

const DEFAULTS = {
  inn_name:       'Pousada Luz da Lua',
  inn_short_name: 'Luz da Lua',
  city:           'Socorro-SP',
  tagline:        'Natureza e Aconchego',
  region_label:   'Circuito das Águas Paulista',
  site_url:       'pousadaluzdaluasp.com.br',
  public_phone:   '(19) 99840-0306',
};

const BRANDING_KEYS = Object.keys(DEFAULTS);
const CACHE_TTL_MS = 5 * 60 * 1000;

let _cache = null;
let _cacheTs = 0;
let _refreshing = false;
let _warnedOnce = false;

async function fetchFromDb() {
  // require tardio evita ciclo de dependência e custo quando nunca usado
  const { supabaseAdmin } = require('../supabase/client');
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', BRANDING_KEYS);

  if (error) throw new Error(error.message);

  const fromDb = {};
  for (const row of data || []) {
    if (row.value != null && String(row.value).trim() !== '') {
      fromDb[row.key] = String(row.value).trim();
    }
  }
  return { ...DEFAULTS, ...fromDb };
}

function refreshInBackground() {
  if (_refreshing) return;
  _refreshing = true;
  fetchFromDb()
    .then(result => { _cache = result; _cacheTs = Date.now(); })
    .catch(err => {
      if (!_warnedOnce) {
        _warnedOnce = true;
        console.warn('[branding] settings indisponível, usando defaults:', err.message);
      }
      _cacheTs = Date.now(); // evita retry a cada chamada
    })
    .finally(() => { _refreshing = false; });
}

/**
 * Retorna o branding atual (cache ou defaults). Nunca lança, nunca bloqueia.
 * @returns {object} { inn_name, inn_short_name, city, tagline, region_label, site_url, public_phone }
 */
function getBranding() {
  if (_cache === null || Date.now() - _cacheTs >= CACHE_TTL_MS) {
    refreshInBackground();
  }
  return _cache || DEFAULTS;
}

/**
 * Refresh explícito (await) — útil em fluxos já assíncronos (voucher, cron).
 * Em caso de falha mantém cache/defaults.
 */
async function loadBranding() {
  try {
    _cache = await fetchFromDb();
    _cacheTs = Date.now();
  } catch (err) {
    if (!_warnedOnce) {
      _warnedOnce = true;
      console.warn('[branding] settings indisponível, usando defaults:', err.message);
    }
  }
  return _cache || DEFAULTS;
}

/** Invalida o cache (testes / após salvar settings). */
function invalidateCache() {
  _cache = null;
  _cacheTs = 0;
}

module.exports = { getBranding, loadBranding, invalidateCache, DEFAULTS };
