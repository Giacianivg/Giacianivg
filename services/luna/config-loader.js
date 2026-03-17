'use strict';

/**
 * Carrega a configuração de treinamento da Luna do Supabase (luna_config).
 * Cache de 5 minutos para evitar queries desnecessárias por mensagem.
 *
 * O campo `system_prompt` em luna_config contém o que foi salvo via
 * luna-training.html — FAQs, informações atualizadas, scripts personalizados.
 * Esse conteúdo é injetado como contexto adicional no processamento de cada
 * mensagem do WhatsApp.
 */

let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Retorna o bloco de contexto de treinamento para injetar no prompt da Luna.
 * Retorna string vazia se não houver config salva ou se o conteúdo estiver vazio.
 *
 * @param {object} supabaseAdmin - Cliente Supabase admin
 * @returns {Promise<string>} Bloco de contexto formatado
 */
async function getTrainingContext(supabaseAdmin) {
  if (_cache !== null && Date.now() - _cacheTs < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('luna_config')
      .select('system_prompt, scripts, active_packages, version, updated_at')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      _cache = '';
      _cacheTs = Date.now();
      return '';
    }

    _cache = buildContext(data);
    _cacheTs = Date.now();
    return _cache;
  } catch {
    return '';
  }
}

/**
 * Formata os dados de luna_config em bloco de contexto legível pelo Haiku.
 * @param {object} config
 * @returns {string}
 */
function buildContext(config) {
  const parts = [];

  if (config.system_prompt?.trim()) {
    parts.push('════════════════════════════════════════');
    parts.push('TREINAMENTO ATUALIZADO (via CRM)');
    parts.push('════════════════════════════════════════');
    parts.push(config.system_prompt.trim());
  }

  const scripts = config.scripts || {};
  const scriptLines = [];
  if (scripts.saudacao?.trim()) scriptLines.push(`Saudação: ${scripts.saudacao.trim()}`);
  if (scripts.cotacao?.trim()) scriptLines.push(`Cotação: ${scripts.cotacao.trim()}`);
  if (scripts.objecao?.trim()) scriptLines.push(`Objeção: ${scripts.objecao.trim()}`);
  if (scripts.fechamento?.trim()) scriptLines.push(`Fechamento: ${scripts.fechamento.trim()}`);

  if (scriptLines.length > 0) {
    if (parts.length === 0) {
      parts.push('════════════════════════════════════════');
      parts.push('TREINAMENTO ATUALIZADO (via CRM)');
      parts.push('════════════════════════════════════════');
    }
    parts.push('');
    parts.push('Scripts configurados:');
    scriptLines.forEach(l => parts.push(`• ${l}`));
  }

  const packages = Array.isArray(config.active_packages) ? config.active_packages : [];
  const validPackages = packages.filter(p => p && (p.name || p.description));
  if (validPackages.length > 0) {
    if (parts.length === 0) {
      parts.push('════════════════════════════════════════');
      parts.push('TREINAMENTO ATUALIZADO (via CRM)');
      parts.push('════════════════════════════════════════');
    }
    parts.push('');
    parts.push('Pacotes ativos:');
    validPackages.forEach(p => {
      const desc = [p.name, p.description, p.price].filter(Boolean).join(' — ');
      parts.push(`• ${desc}`);
    });
  }

  return parts.join('\n');
}

/**
 * Invalida o cache (útil após salvar nova config via luna-training.html).
 */
function invalidateCache() {
  _cache = null;
  _cacheTs = 0;
}

module.exports = { getTrainingContext, buildContext, invalidateCache };
