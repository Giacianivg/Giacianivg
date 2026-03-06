'use strict';

require('dotenv').config();
const express = require('express');
const { calculateQuotation, formatWhatsAppMessage } = require('./quotation');
const LUNA_SYSTEM_PROMPT = require('./luna-system-prompt');
const { getConversationHistory, appendMessage, recordEvent, getClientProfile, upsertClient } = require('./sheets');

const app = express();
app.use(express.json());

const {
  WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN,
  ANTHROPIC_API_KEY,
  EQUIPE_WHATSAPP_NUMBER,
  PORT = 3000,
} = process.env;

const WA_API = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// ---------------------------------------------------------------------------
// Deduplicação de mensagens — evita reprocessamento por retry do Meta
// ---------------------------------------------------------------------------
const processedIds = new Map(); // messageId → timestamp
const DEDUP_TTL_MS = 60_000;   // 60s — janela segura para retries do Meta

function isDuplicate(messageId) {
  const now = Date.now();
  // Limpa entradas expiradas
  for (const [id, ts] of processedIds) {
    if (now - ts > DEDUP_TTL_MS) processedIds.delete(id);
  }
  if (processedIds.has(messageId)) return true;
  processedIds.set(messageId, now);
  return false;
}

// ---------------------------------------------------------------------------
// WhatsApp — enviar mensagem via Meta Cloud API
// ---------------------------------------------------------------------------
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[whatsapp] Credenciais não configuradas — mensagem não enviada');
    return;
  }
  try {
    const res = await fetch(WA_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[whatsapp] Erro ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error('[whatsapp] Falha ao enviar:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Anthropic — chamar Claude com histórico de conversa
// ---------------------------------------------------------------------------
async function callClaude(messages, clientContext = '', attempt = 0) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');

  const system = clientContext
    ? `${clientContext}\n\n${LUNA_SYSTEM_PROMPT}`
    : LUNA_SYSTEM_PROMPT;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        messages,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic ${res.status}: ${body}`);
    }

    const data = await res.json();
    return data.content[0].text;
  } catch (err) {
    // Retry once on transient network errors (TLS disconnect, socket drop)
    const isTransient = err.message?.includes('fetch failed') || err.name === 'TimeoutError';
    if (attempt === 0 && isTransient) {
      console.warn('[claude] Erro de rede, tentando novamente:', err.message);
      await new Promise(r => setTimeout(r, 1000));
      return callClaude(messages, clientContext, 1);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Memória em RAM — fallback enquanto Google Sheets não está configurado
// Cada entrada expira após 2h (TTL). Resets em cold start (ok para MVP).
// ---------------------------------------------------------------------------
const conversationMemory = new Map(); // phone → { messages: [], ts: number }
const MEMORY_TTL_MS = 2 * 60 * 60 * 1000; // 2h

// Contexto de escalonamentos aguardando resposta da equipe
// phone → { history, question, nome, ts }
const pendingTeamQueries = new Map();

function memoryGet(phone) {
  const entry = conversationMemory.get(phone);
  if (!entry) return [];
  if (Date.now() - entry.ts > MEMORY_TTL_MS) {
    conversationMemory.delete(phone);
    return [];
  }
  return entry.messages;
}

function memorySet(phone, messages) {
  conversationMemory.set(phone, { messages: messages.slice(-20), ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Contexto dinâmico do cliente — injetado no system prompt a cada chamada
// ---------------------------------------------------------------------------

function getCurrentDateContext() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dias[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
}

function buildClientContext(nome, isFirstMessage) {
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'CONTEXTO DO CLIENTE ATUAL',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Data atual: ${getCurrentDateContext()}`,
    '→ Use esta data para interpretar "amanhã", "domingo", "semana que vem", etc.',
    '→ NUNCA repita perguntas sobre informações que o cliente já forneceu nesta conversa.',
  ];
  if (nome) {
    lines.push(`Nome: ${nome}`);
    lines.push('→ SEMPRE use o nome do cliente nas respostas de forma natural.');
    lines.push('→ NÃO pergunte o nome novamente — você já sabe.');
  } else {
    lines.push('Nome: (não informado ainda)');
    if (isFirstMessage) {
      lines.push('→ Esta é a PRIMEIRA mensagem. Pergunte o nome do cliente de forma casual.');
      lines.push('→ Quando ele responder o nome, inclua [NOME: NomeInformado] no final da sua resposta.');
    } else {
      lines.push('→ O nome foi solicitado anteriormente. NÃO peça de novo.');
      lines.push('→ Se o cliente mencionou o nome em mensagens anteriores, use-o.');
    }
  }
  return lines.join('\n');
}

// Verifica se o nome parece um nome real (sem emojis, números ou caracteres estranhos)
function looksLikeRealName(name) {
  if (!name || name === 'Hóspede') return false;
  // Emojis (blocos unicode comuns)
  if (/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/u.test(name)) return false;
  // Números
  if (/\d/.test(name)) return false;
  // Muito curto (menos de 3 letras reais)
  if (name.replace(/\s/g, '').length < 3) return false;
  // Caracteres não esperados em nomes (permite letras, acentos, espaço, hífen, apóstrofo)
  if (/[^a-záàâãéèêíïóôõöúüçñA-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇÑ\s'\-]/u.test(name)) return false;
  return true;
}

// Extrai o nome capturado do sinal [NOME: ...] na resposta da Luna
function parseNomeSignal(response) {
  const match = response.match(/\[NOME:\s*([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Processamento de sinais na resposta da Luna
// ---------------------------------------------------------------------------

function parseCotarParams(signal) {
  const match = signal.match(/\[COTAR:\s*([^\]]+)\]/);
  if (!match) return null;
  const params = {};
  match[1].split(',').forEach(part => {
    const [k, v] = part.split('=').map(s => s.trim());
    if (k && v) params[k] = v;
  });
  return params;
}

function parseConfirmarParams(signal) {
  const match = signal.match(/\[CONFIRMAR:\s*([^\]]+)\]/);
  if (!match) return null;
  const params = {};
  match[1].split(',').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = part.slice(eqIdx + 1).trim();
      params[k] = v;
    }
  });
  return params;
}

async function handleCotar(params, from, contactName) {
  await recordEvent(from, contactName, 'COTAR', params);
  const q = calculateQuotation(params);

  if (q.error) {
    if (q.escalar) {
      await sendWhatsApp(from, 'Para grupos, vou te conectar com nossa equipe agora! 🌙');
      if (EQUIPE_WHATSAPP_NUMBER) {
        await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, `🔔 Solicitação de grupo recebida de ${from}`);
      }
    } else {
      const msg = q.suggestion ? `${q.error} 🌙 ${q.suggestion}` : q.error;
      await sendWhatsApp(from, msg);
    }
    return;
  }

  await sendWhatsApp(from, formatWhatsAppMessage(q));
}

async function handleEscalar(userMsg, from, rawSignal, contactName) {
  if (userMsg) await sendWhatsApp(from, userMsg);

  const detail = rawSignal.includes(':')
    ? rawSignal.replace(/^\[ESCALAR:\s*/, '').replace(/\]$/, '').trim()
    : '';

  await recordEvent(from, contactName, 'ESCALAR', { detail });

  if (EQUIPE_WHATSAPP_NUMBER) {
    const motivo = detail || 'Dúvida ou solicitação especial';
    const notif = [
      `🔔 *Hóspede aguarda resposta*`,
      `Nome: ${contactName} | Tel: wa.me/${from}`,
      `Assunto: ${motivo}`,
      ``,
      `💬 Responda aqui no WhatsApp que Luna repassa automaticamente!`,
    ].join('\n');
    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, notif);

    // Armazena contexto para resposta da equipe
    const ctx = pendingTeamQueries.get('__ctx__');
    if (ctx && ctx.from === from) {
      pendingTeamQueries.set(from, { history: ctx.history, question: ctx.question, nome: contactName, ts: Date.now() });
      pendingTeamQueries.delete('__ctx__');
    }
  }
}

// ---------------------------------------------------------------------------
// handleTeamReply — equipe respondeu → Luna reformula e envia ao hóspede
// ---------------------------------------------------------------------------
async function handleTeamReply(teamMessage) {
  // Pega o guest pendente mais recente
  let latestPhone = null;
  let latestEntry = null;
  for (const [phone, entry] of pendingTeamQueries) {
    if (!latestEntry || entry.ts > latestEntry.ts) {
      latestPhone = phone;
      latestEntry = entry;
    }
  }

  if (!latestPhone) {
    // Sem guest pendente — equipe pode estar testando ou enviando nota interna
    console.log('[team] Mensagem sem guest pendente:', teamMessage);
    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, '✅ Mensagem recebida. Sem hóspede aguardando no momento.');
    return;
  }

  // Luna reformula a resposta da equipe de forma natural para o hóspede
  const teamContext = buildClientContext(latestEntry.nome, false) +
    `\n\nRESPOSTA DA EQUIPE (USE ESTA INFO): "${teamMessage}"\n→ Reformule de forma natural como Luna. Não mencione "equipe respondeu" — só transmita a informação.`;

  const messages = [...(latestEntry.history || []), { role: 'user', content: latestEntry.question }];
  const response = await callClaude(messages, teamContext);
  const cleanResponse = response.replace(/\[NOME:\s*[^\]]+\]/, '').trim();

  await sendWhatsApp(latestPhone, cleanResponse);

  // Atualiza memória do hóspede
  const updated = [...(latestEntry.history || []),
    { role: 'user', content: latestEntry.question },
    { role: 'assistant', content: cleanResponse }];
  memorySet(latestPhone, updated);

  pendingTeamQueries.delete(latestPhone);
  console.log(`[team] Respondeu ${latestPhone} (${latestEntry.nome}): ${cleanResponse.substring(0, 80)}`);
}

async function handleConfirmar(userMsg, from, params, contactName) {
  if (userMsg) await sendWhatsApp(from, userMsg);

  const p = params || {};
  await recordEvent(from, contactName, 'CONFIRMAR', p);

  if (EQUIPE_WHATSAPP_NUMBER) {
    const sinal = p.total
      ? `R$${Math.round(parseFloat(p.total.replace(/[^0-9.,]/g, '').replace(',', '.')) * 0.3)}`
      : 'a calcular';
    const notif = [
      '🔔 *Nova reserva solicitada!*',
      `Hóspede: ${p.nome || contactName || 'N/A'} | Tel: ${from}`,
      `Período: ${p.entrada || '?'} → ${p.saida || '?'}`,
      `Tipo: ${p.tipo || 'N/A'} | Hóspedes: ${p.pessoas || 'N/A'}`,
      `Total: ${p.total || 'N/A'} | Sinal (30%): ${sinal}`,
      '➡️ 1. Verificar disponibilidade no motor-reserva',
      '➡️ 2. Confirmar e solicitar sinal ao hóspede',
    ].join('\n');
    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, notif);
  }
}

// Detecta sinais na resposta e despacha para os handlers corretos
async function processResponse(response, from, contactName) {
  // [COTAR: ...]
  const cotarMatch = response.match(/\[COTAR:[^\]]+\]/);
  if (cotarMatch) {
    const userMsg = response.replace(/\[COTAR:[^\]]+\]/, '').trim();
    if (userMsg) await sendWhatsApp(from, userMsg);
    const params = parseCotarParams(cotarMatch[0]);
    if (params) await handleCotar(params, from, contactName);
    return;
  }

  // [ESCALAR] ou [ESCALAR: ...]
  const escalarMatch = response.match(/\[ESCALAR[^\]]*\]/);
  if (escalarMatch) {
    const userMsg = response.replace(/\[ESCALAR[^\]]*\]/, '').trim();
    await handleEscalar(
      userMsg || 'Vou chamar nossa equipe para te ajudar! 🌙',
      from,
      escalarMatch[0],
      contactName,
    );
    return;
  }

  // [CONFIRMAR: ...]
  const confirmarMatch = response.match(/\[CONFIRMAR:[^\]]+\]/);
  if (confirmarMatch) {
    const userMsg = response.replace(/\[CONFIRMAR:[^\]]+\]/, '').trim();
    const params = parseConfirmarParams(confirmarMatch[0]);
    await handleConfirmar(userMsg, from, params, contactName);
    return;
  }

  // Resposta normal sem sinais
  await sendWhatsApp(from, response);
}

// ---------------------------------------------------------------------------
// GET /webhook — Verificação do webhook pela Meta
// ---------------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (WHATSAPP_VERIFY_TOKEN || '').trim()) {
    console.log('[webhook] Verificação Meta OK');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook] Verificação Meta FALHOU — token inválido ou mode incorreto');
  return res.sendStatus(403);
});

// ---------------------------------------------------------------------------
// processMessage — processamento assíncrono após 200 já enviado ao Meta
// ---------------------------------------------------------------------------
async function processMessage(from, contactName, text) {
  console.log(`[process] iniciando para ${from}`);
  try {
    // Carrega histórico e perfil em paralelo — timeout de 5s para não atrasar o Claude
    const sheetsTimeout = ms => new Promise(resolve => setTimeout(resolve, ms));
    const [sheetsHistory, clientProfile] = await Promise.all([
      Promise.race([getConversationHistory(from), sheetsTimeout(5000).then(() => [])]),
      Promise.race([getClientProfile(from), sheetsTimeout(5000).then(() => ({ nome: null, isNew: true }))]),
    ]);

    // Usa histórico do Sheets se disponível, senão usa memória RAM
    const fullHistory = sheetsHistory.length > 0 ? sheetsHistory : memoryGet(from);

    // Determina o nome conhecido: preferência ao armazenado; fallback ao perfil do WhatsApp
    // Só usa o nome do WhatsApp se parecer um nome real (sem emojis, números, etc.)
    let knownName = clientProfile.nome;
    if (!knownName && looksLikeRealName(contactName)) {
      knownName = contactName;
      upsertClient(from, contactName).catch(() => {});
    }

    const isFirstMessage = fullHistory.length === 0;
    const clientContext = buildClientContext(knownName, isFirstMessage);

    const history = fullHistory.slice(-10);
    history.push({ role: 'user', content: text });

    const response = await callClaude(history, clientContext);

    // Captura [NOME: ...] se Luna identificou o nome nesta mensagem
    const nomeCapturado = parseNomeSignal(response);
    const cleanResponse = response.replace(/\[NOME:\s*[^\]]+\]/, '').trim();

    if (nomeCapturado) {
      upsertClient(from, nomeCapturado).catch(() => {});
    }

    const displayName = nomeCapturado || knownName || contactName;
    console.log(`[webhook] Luna → ${from} (${displayName}): ${cleanResponse.substring(0, 80)}`);

    // Salva no Sheets (se configurado) e atualiza memória RAM
    const updatedHistory = [...fullHistory, { role: 'user', content: text }, { role: 'assistant', content: cleanResponse }];
    memorySet(from, updatedHistory);

    // Disponibiliza contexto para handleEscalar (caso Luna use [ESCALAR])
    pendingTeamQueries.set('__ctx__', { from, history: fullHistory, question: text });

    await Promise.all([
      (async () => {
        await appendMessage(from, displayName, 'user', text);
        await appendMessage(from, displayName, 'assistant', cleanResponse);
      })(),
      processResponse(cleanResponse, from, displayName),
    ]);
  } catch (err) {
    const cause = err.cause?.message || err.cause?.code || '';
    console.error(`[webhook] Erro ao processar mensagem: ${err.message}${cause ? ` (causa: ${cause})` : ''}`);
    try {
      await sendWhatsApp(from, 'Estamos com uma instabilidade momentânea. Nossa equipe entrará em contato em breve! 🌙');
    } catch (e) {
      console.error('[webhook] Falha ao enviar mensagem de erro:', e.message);
    }
  }
}

// ---------------------------------------------------------------------------
// POST /webhook — Recebimento de mensagens WhatsApp
// CRÍTICO: responder 200 IMEDIATAMENTE — Meta cancela se não receber em <5s
//          Todo processamento é fire-and-forget após o 200
// ---------------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Objetos não-whatsapp
  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(200);
  }

  const value = body.entry?.[0]?.changes?.[0]?.value;

  // Status de entrega, leitura, etc. — sem mensagem
  if (!value?.messages?.length) {
    return res.sendStatus(200);
  }

  const message = value.messages[0];

  // Deduplicação: ignora retries do Meta para a mesma mensagem
  if (isDuplicate(message.id)) {
    console.log(`[webhook] Duplicata ignorada: ${message.id}`);
    return res.sendStatus(200);
  }

  const from = message.from;
  const contactName = value.contacts?.[0]?.profile?.name || 'Hóspede';

  // Mensagem da equipe → modo relay: reformula e envia ao hóspede pendente
  const teamNumber = (EQUIPE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (teamNumber && from === teamNumber && message.type === 'text') {
    const teamText = message.text?.body || '';
    console.log(`[team] Mensagem da equipe: ${teamText.substring(0, 60)}`);
    try {
      await handleTeamReply(teamText);
    } catch (err) {
      console.error('[team] Erro ao processar resposta da equipe:', err.message);
    }
    return res.sendStatus(200);
  }

  // Mensagem não-texto
  if (message.type !== 'text') {
    res.sendStatus(200);
    sendWhatsApp(from, 'Por favor, envie uma mensagem de texto 🌙').catch(
      err => console.error('[webhook] Falha mensagem não-texto:', err.message)
    );
    return;
  }

  const text = message.text.body;
  console.log(`[webhook] ${from} (${contactName}): ${text.substring(0, 60)}`);

  // Processa ANTES de enviar 200 — Vercel mata o Lambda após res.sendStatus()
  // Claude responde em ~600ms, bem dentro do limite de 5s da Meta
  // Safety timeout de 4.5s garante que Meta sempre recebe o 200
  try {
    await Promise.race([
      processMessage(from, contactName, text),
      new Promise(resolve => setTimeout(resolve, 4500)),
    ]);
  } catch (err) {
    console.error('[webhook] Erro no processamento:', err.message);
  }

  res.sendStatus(200);
});

// ---------------------------------------------------------------------------
// POST /quote — Cálculo de cotação (chamado internamente ou por integrações)
// ---------------------------------------------------------------------------
app.post('/quote', (req, res) => {
  const { data_entrada, data_saida, pessoas, tipo } = req.body;
  const result = calculateQuotation({ data_entrada, data_saida, pessoas, tipo });

  if (result.error) {
    const status = result.escalar ? 200 : 400;
    return res.status(status).json({ success: false, ...result });
  }

  const message = formatWhatsAppMessage(result);
  console.log(`[quote] ${tipo} ${data_entrada}→${data_saida} R$${result.totalFinal}`);
  return res.json({ success: true, data: { ...result, message } });
});

// ---------------------------------------------------------------------------
// POST /test-claude — diagnóstico: chama Claude de forma síncrona (remover após debug)
// ---------------------------------------------------------------------------
app.post('/test-claude', async (req, res) => {
  try {
    const start = Date.now();
    const response = await callClaude([{ role: 'user', content: 'Responda apenas: ok' }]);
    res.json({ ok: true, ms: Date.now() - start, response });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pousada-whatsapp-webhook', ts: Date.now() });
});

// ---------------------------------------------------------------------------
// GET /privacy — Exigido pelo Meta Developers para apps WhatsApp
// ---------------------------------------------------------------------------
app.get('/privacy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Política de Privacidade — Pousada Luz da Lua</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{color:#2c3e50}h2{color:#34495e;margin-top:30px}</style>
</head>
<body>
<h1>Política de Privacidade</h1>
<p><strong>Pousada Luz da Lua</strong> — Socorro, SP | Atualizado em: ${new Date().toLocaleDateString('pt-BR')}</p>

<h2>1. Coleta de Dados</h2>
<p>Coletamos apenas o número de telefone e mensagens enviadas via WhatsApp para fins de atendimento e reservas. Nenhum dado é coletado sem interação direta do usuário.</p>

<h2>2. Uso dos Dados</h2>
<p>Os dados coletados são utilizados exclusivamente para responder dúvidas, enviar cotações e confirmações de hospedagem.</p>

<h2>3. Compartilhamento</h2>
<p>Não compartilhamos dados pessoais com terceiros, exceto serviços necessários para o funcionamento do atendimento (Meta/WhatsApp).</p>

<h2>4. Armazenamento</h2>
<p>As conversas são armazenadas de forma segura e podem ser excluídas mediante solicitação pelo WhatsApp (19) 99840-0306.</p>

<h2>5. Contato</h2>
<p>Dúvidas: WhatsApp (19) 99840-0306.</p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[webhook] Servidor na porta ${PORT}`);
    console.log(`[webhook] Anthropic API: ${ANTHROPIC_API_KEY ? 'configurada' : 'NAO CONFIGURADA'}`);
    console.log(`[webhook] WhatsApp: ${WHATSAPP_ACCESS_TOKEN ? 'configurado' : 'NAO CONFIGURADO'}`);
  });
}

module.exports = app;
