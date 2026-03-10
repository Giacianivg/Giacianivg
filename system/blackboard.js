'use strict';

/**
 * Blackboard — estado compartilhado entre agentes AI-OS
 * DEC-007 aprovado 2026-03-10
 *
 * Fonte de verdade: Supabase (tabela blackboard_state)
 * Cache local: 60s (evita round-trip por request)
 * Writes: fire-and-forget — nunca bloqueiam webhook ou path crítico
 */

const { supabaseAdmin } = require('../services/supabase/client');

const CACHE_TTL_MS = 60_000;
const cache = { data: {}, ts: 0 };

function isCacheValid() {
  return Date.now() - cache.ts < CACHE_TTL_MS && Object.keys(cache.data).length > 0;
}

async function _loadFromSupabase() {
  const { data, error } = await supabaseAdmin
    .from('blackboard_state')
    .select('*');
  if (error) throw error;
  cache.data = Object.fromEntries(data.map(r => [r.key, r.value]));
  cache.ts = Date.now();
}

/**
 * Lê uma chave do blackboard (usa cache 60s).
 * @param {string} key - leads | reservas | financeiro | alertas
 * @returns {Promise<any>}
 */
async function get(key) {
  if (!isCacheValid()) {
    try {
      await _loadFromSupabase();
    } catch (err) {
      console.error('[blackboard] read error:', err.message);
    }
  }
  return cache.data[key];
}

/**
 * Escreve uma chave no blackboard.
 * Fire-and-forget — nunca bloqueia.
 * @param {string} key
 * @param {any} value
 */
function set(key, value) {
  cache.data[key] = value; // atualiza cache imediatamente
  supabaseAdmin
    .from('blackboard_state')
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .then(() => {})
    .catch(err => console.error('[blackboard] write error:', err.message));
}

/**
 * Retorna o estado completo do blackboard.
 * @returns {Promise<{leads, reservas, financeiro, alertas}>}
 */
async function getState() {
  if (!isCacheValid()) {
    try {
      await _loadFromSupabase();
    } catch (err) {
      console.error('[blackboard] getState error:', err.message);
    }
  }
  return { ...cache.data };
}

/**
 * Adiciona um alerta na fila (máx 50).
 * @param {object} alerta
 */
function pushAlerta(alerta) {
  const alertas = Array.isArray(cache.data.alertas) ? cache.data.alertas : [];
  set('alertas', [alerta, ...alertas].slice(0, 50));
}

module.exports = { get, set, getState, pushAlerta };
