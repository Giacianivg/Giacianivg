'use strict';

/**
 * Persistência de histórico de conversas no Supabase (tabela `conversations`).
 *
 * Quando o lead volta, Luna consulta as mensagens anteriores do mesmo número
 * e responde com contexto acumulado — não começa do zero.
 *
 * Complementa o histórico em RAM (memoryGet/memorySet) que tem TTL de 2h.
 * Supabase é persistente entre cold starts e entre sessões.
 */

const MAX_HISTORY_MESSAGES = 20; // últimas 20 mensagens (10 trocas)

/**
 * Salva um par de mensagens (user + assistant) no histórico persistente.
 * Fire-and-forget seguro — não bloqueia o envio da resposta ao hóspede.
 *
 * @param {object} supabaseAdmin
 * @param {string} leadId
 * @param {string} phone
 * @param {string} userContent
 * @param {string} assistantContent
 * @returns {Promise<void>}
 */
async function saveMessages(supabaseAdmin, leadId, phone, userContent, assistantContent) {
  if (!leadId || !phone || !userContent || !assistantContent) return;

  const { error } = await supabaseAdmin
    .from('conversations')
    .insert([
      { lead_id: leadId, whatsapp_number: phone, role: 'user',      content: userContent },
      { lead_id: leadId, whatsapp_number: phone, role: 'assistant', content: assistantContent },
    ]);

  if (error) {
    console.warn('[history] saveMessages failed:', error.message);
  }
}

/**
 * Busca o histórico recente de um número no Supabase.
 * Retorna mensagens em ordem cronológica (mais antiga → mais recente),
 * no formato { role, content } compatível com a API Claude.
 *
 * @param {object} supabaseAdmin
 * @param {string} phone
 * @param {number} [limit=20]
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
async function getRecentHistory(supabaseAdmin, phone, limit = MAX_HISTORY_MESSAGES) {
  if (!phone) return [];

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('role, content, created_at')
    .eq('whatsapp_number', phone)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return [];

  // Retorna em ordem cronológica (Claude espera: mais antiga primeiro)
  return data.reverse().map(r => ({ role: r.role, content: r.content }));
}

module.exports = { saveMessages, getRecentHistory, MAX_HISTORY_MESSAGES };
