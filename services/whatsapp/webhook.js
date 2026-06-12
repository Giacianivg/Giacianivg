'use strict';

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { calculateQuotation, formatWhatsAppMessage } = require('../quotation/engine');
const LUNA_SYSTEM_PROMPT = require('../luna/system-prompt');
const { getConversationHistory, appendMessage, recordEvent, getClientProfile, upsertClient } = require('../../database/sheets');
const crmService = require('../crm/index');
const { parseCurrency, formatCurrency } = require('../utils/currency');
const ConversationStateMachine = require('../state-machine/index');
const { supabaseAdmin } = require('../supabase/client');
const { getTrainingContext } = require('../luna/config-loader');
const { saveMessages, getRecentHistory } = require('../conversations/history');


const SHEETS_ENABLED = process.env.SHEETS_ENABLED !== 'false';

// Palavras que reiniciam a conversa (qualquer saudação após silêncio ou comando explícito)
const RESET_PATTERN = /^(oi|ola|olá|hey|hi|menu|reiniciar|recomeçar|recomecar|inicio|início|começar|comecar|start)[\s!?.]*$/iu;

// ─── Structured logging ────────────────────────────────────────────────────────
function log(level, event, data) {
  const entry = { ts: new Date().toISOString(), level, svc: 'webhook', event, ...data };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

const app = express();

// ─── X-Hub-Signature-256 Validation Middleware (QA-01) ─────────────────────────
// Meta sends X-Hub-Signature header: sha256=<hex>
// We validate against WHATSAPP_ACCESS_TOKEN as the secret
// Captura o raw body antes do parse — necessário para validar HMAC-SHA256 da Meta
// JSON.stringify(req.body) não é confiável: pode reordenar chaves ou diferir em whitespace
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.use((req, res, next) => {
  // Skip validation for GET requests (challenge verification)
  if (req.method === 'GET') return next();

  // Only validate /webhook POST requests
  if (req.method !== 'POST' || req.path !== '/webhook') return next();

  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    log('warn', 'security_no_secret', { msg: 'WHATSAPP_APP_SECRET not configured — skipping validation' });
    return next();
  }

  if (!signature) {
    log('warn', 'security_missing_signature', { ip: req.ip });
    return res.status(403).json({ error: 'missing_signature' });
  }

  // Usa rawBody (bytes originais da Meta) — nunca JSON.stringify(req.body)
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  if (signature.length !== expectedSignature.length) {
    return res.status(403).json({ error: 'invalid_signature' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    log('warn', 'security_invalid_signature', { ip: req.ip, sig_prefix: signature.slice(0, 16) });
    return res.status(403).json({ error: 'invalid_signature' });
  }

  next();
});

const {
  WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_APP_SECRET,
  ANTHROPIC_API_KEY,
  EQUIPE_WHATSAPP_NUMBER,
  OPENAI_API_KEY,
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
// Meta Media API — baixar imagem/áudio pelo mediaId
// ---------------------------------------------------------------------------
async function downloadMediaFromMeta(mediaId) {
  // Passo 1: buscar URL temporária da mídia
  const urlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!urlRes.ok) throw new Error(`Meta media URL fetch failed: ${urlRes.status}`);
  const { url, mime_type: mimeType } = await urlRes.json();

  // Passo 2: baixar bytes da mídia
  const mediaRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!mediaRes.ok) throw new Error(`Meta media download failed: ${mediaRes.status}`);
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return { buffer, mimeType };
}

// ---------------------------------------------------------------------------
// Claude Vision — extrai valor PIX do comprovante
// Retorna o valor numérico em centavos (ex: 168.00) ou 0 se não identificado
// ---------------------------------------------------------------------------
async function extractPixValueWithVision(imageBuffer, mimeType) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');

  const base64 = imageBuffer.toString('base64');
  const safeMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : 'image/jpeg';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64 } },
          {
            type: 'text',
            text: 'Este é um comprovante de pagamento PIX. Extraia APENAS o valor pago em reais. Responda SOMENTE com o número sem "R$" e sem texto — apenas o valor numérico (exemplo: 168.00 ou 168). Se não conseguir identificar, responda 0.',
          },
        ],
      }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Vision API failed: ${res.status}`);
  const data = await res.json();
  const raw = data.content[0].text.trim().replace(',', '.');
  return parseFloat(raw) || 0;
}

// ---------------------------------------------------------------------------
// Supabase — busca o sinal esperado para o hóspede (reserva pending mais recente)
// ---------------------------------------------------------------------------
async function getExpectedDepositForGuest(phone) {
  if (!process.env.SUPABASE_URL) return null;
  try {
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('whatsapp_number', phone)
      .maybeSingle();
    if (!lead) return null;

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .select('id, deposit_amount')
      .eq('lead_id', lead.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!reservation) return null;

    return reservation.deposit_amount;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenAI Whisper — transcreve áudio ogg/mp4 para texto
// ---------------------------------------------------------------------------
async function transcribeAudioWithWhisper(audioBuffer, mimeType) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');

  const ext = mimeType?.includes('mp4') ? 'mp4' : mimeType?.includes('mpeg') ? 'mp3' : 'ogg';
  const audioMime = mimeType || 'audio/ogg';

  // Node 18+ tem FormData nativo
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: audioMime });
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper API failed: ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.text || '';
}

// ---------------------------------------------------------------------------
// handlePixComprovante — valida comprovante PIX recebido como imagem
// ---------------------------------------------------------------------------
async function handlePixComprovante(from, contactName, mediaId, messageId, timestamp) {
  log('info', 'pix_comprovante_received', { phone: from, mediaId, reqId: messageId });

  if (!mediaId) {
    await sendWhatsApp(from, 'Não consegui ler a imagem. Pode tentar enviar novamente? 🌙');
    return;
  }

  // Busca sinal esperado em paralelo ao download
  const [mediaResult, expectedAmount] = await Promise.all([
    downloadMediaFromMeta(mediaId).catch(err => { throw err; }),
    getExpectedDepositForGuest(from),
  ]);

  let extractedValue;
  try {
    extractedValue = await extractPixValueWithVision(mediaResult.buffer, mediaResult.mimeType);
  } catch (err) {
    log('error', 'pix_vision_failed', { phone: from, error: err.message });
    await sendWhatsApp(from, 'Não consegui ler o comprovante. Você pode confirmar o valor pago por mensagem de texto? 🌙');
    return;
  }

  if (!extractedValue || extractedValue <= 0) {
    await sendWhatsApp(from, 'Não identifiquei o valor no comprovante. Pode confirmar o valor pago por mensagem de texto? 🌙');
    return;
  }

  // Compara com sinal esperado (tolerância R$1)
  if (expectedAmount && Math.abs(extractedValue - expectedAmount) > 1) {
    log('warn', 'pix_amount_mismatch', { phone: from, expected: expectedAmount, received: extractedValue });
    await sendWhatsApp(
      from,
      `Opa! O comprovante mostra ${formatCurrency(extractedValue)} mas o sinal é ${formatCurrency(expectedAmount)}. Pode verificar e enviar o comprovante correto? 😊`
    );
    return;
  }

  // Valor correto — confirma ao hóspede e notifica equipe
  const confirmMsg = expectedAmount
    ? `Comprovante recebido! ✅ Valor de ${formatCurrency(extractedValue)} confirmado. Nossa equipe vai verificar e finalizar sua reserva em breve! 🌙`
    : `Comprovante recebido! ✅ Nossa equipe vai verificar e confirmar sua reserva em breve! 🌙`;
  await sendWhatsApp(from, confirmMsg);

  if (EQUIPE_WHATSAPP_NUMBER) {
    const teamLines = [
      `💳 *Comprovante PIX recebido*`,
      `👤 ${contactName} | wa.me/${from}`,
      expectedAmount
        ? `💰 Esperado: ${formatCurrency(expectedAmount)} | Recebido: ${formatCurrency(extractedValue)} ✅`
        : `💰 Valor: ${formatCurrency(extractedValue)}`,
      `→ Confirmar manualmente e atualizar reserva`,
    ];
    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, teamLines.join('\n'));
  }

  log('info', 'pix_validated', { phone: from, expected: expectedAmount, received: extractedValue });
}

// ---------------------------------------------------------------------------
// handleAudioMessage — transcreve áudio via Whisper e processa como texto
// ---------------------------------------------------------------------------
async function handleAudioMessage(from, contactName, mediaId, messageId, timestamp) {
  if (!OPENAI_API_KEY) {
    log('warn', 'audio_no_openai_key', { phone: from });
    await sendWhatsApp(from, 'Recebi seu áudio! Por favor, envie como mensagem de texto também para que eu possa responder. 🌙');
    return;
  }

  if (!mediaId) {
    await sendWhatsApp(from, 'Não consegui processar o áudio. Pode enviar como mensagem de texto? 🌙');
    return;
  }

  log('info', 'audio_received', { phone: from, mediaId, reqId: messageId });

  let transcription;
  try {
    const { buffer, mimeType } = await downloadMediaFromMeta(mediaId);
    transcription = await transcribeAudioWithWhisper(buffer, mimeType);
  } catch (err) {
    log('error', 'audio_transcription_failed', { phone: from, error: err.message });
    await sendWhatsApp(from, 'Não consegui transcrever o áudio. Pode enviar como mensagem de texto? 🌙');
    return;
  }

  if (!transcription || !transcription.trim()) {
    await sendWhatsApp(from, 'Não entendi o áudio. Pode enviar como mensagem de texto? 🌙');
    return;
  }

  log('info', 'audio_transcribed', { phone: from, preview: transcription.substring(0, 80) });

  // Processa transcrição como mensagem de texto normal — hóspede não percebe diferença
  await processMessage(from, contactName, transcription.trim(), messageId, timestamp);
}

// ---------------------------------------------------------------------------
// Anthropic — chamar Claude com histórico de conversa
// ---------------------------------------------------------------------------
async function callClaude(messages, clientContext = '', attempt = 0) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');

  const system = clientContext
    ? `${LUNA_SYSTEM_PROMPT}\n\n${clientContext}`
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
        model: 'claude-sonnet-4-20250514',
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
  // Smart split: divide apenas na vírgula seguida de "chave=" — preserva formato
  // monetário brasileiro (ex: total=R$1.800,00 não é cortado no ponto decimal)
  match[1].split(/,\s*(?=\w+=)/).forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = part.slice(eqIdx + 1).trim();
      params[k] = v;
    }
  });
  return params;
}

function parseEscalarParams(rawSignal) {
  if (!rawSignal.includes(':')) return { motivo: null };
  const inner = rawSignal.replace(/^\[ESCALAR:\s*/, '').replace(/\]$/, '').trim();
  if (!inner.includes('=')) return { motivo: inner || null };
  const params = {};
  // Split by comma only when immediately followed by a key= pattern
  const parts = inner.split(/,\s*(?=\w+=)/);
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      params[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
    }
  }
  return params;
}

async function handleCotar(params, from, contactName, leadId) {
  if (SHEETS_ENABLED) await recordEvent(from, contactName, 'COTAR', params);
  if (leadId) crmService.updateLeadStatus(leadId, 'proposal').catch(() => {});

  // Check real availability if CRM configured — fallback gracefully on timeout/error
  let availabilityContext = '';
  if (process.env.SUPABASE_URL) {
    try {
      const avail = await Promise.race([
        crmService.checkAvailability(params.tipo, params.data_entrada, params.data_saida),
        new Promise(resolve => setTimeout(() => resolve({ available: null }), 3000)),
      ]);
      if (avail.available === false) {
        const alternatives = await crmService.fetchAlternativeDates(params.tipo, params.data_entrada).catch(() => []);
        if (alternatives.length > 0) {
          const altStr = alternatives
            .map(a => `• ${a.checkin.split('-').reverse().join('/')} a ${a.checkout.split('-').reverse().join('/')}`)
            .join('\n');
          availabilityContext = `DISPONIBILIDADE: ${params.tipo} não está disponível para as datas solicitadas.\nPróximas datas livres:\n${altStr}\nOfereça essas alternativas ao hóspede de forma natural, sem mencionar "sistema" ou "banco de dados".`;
        } else {
          availabilityContext = `DISPONIBILIDADE: ${params.tipo} não está disponível para as datas solicitadas. Informe o hóspede e sugira entrar em contato com a equipe.`;
        }
      }
    } catch {
      // Fallback: proceed without availability check
    }
  }

  if (availabilityContext) {
    // Luna needs to handle the unavailability — re-invoke Claude with context
    // For now, send the availability context info directly
    await sendWhatsApp(from, 'Ops! As datas solicitadas não estão disponíveis. Vou verificar outras opções para você... 🌙');
    return;
  }

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
  log('info', 'quotation_sent', { phone: from, roomType: params.tipo, total: q.totalFinal, nights: q.nights });
}

async function handleEscalar(userMsg, from, rawSignal, contactName, leadId) {
  if (userMsg) await sendWhatsApp(from, userMsg);

  const escalParams = parseEscalarParams(rawSignal);
  const motivo = escalParams.motivo || 'Dúvida ou solicitação especial';
  const nomeHospede = escalParams.nome || contactName;
  log('warn', 'escalation_triggered', { phone: from, motivo, leadId });
  const interesse = escalParams.interesse;

  // Update lead status to negotiation when escalated
  if (leadId) crmService.updateLeadStatus(leadId, 'negotiation').catch(() => {});

  await recordEvent(from, contactName, 'ESCALAR', escalParams);

  if (EQUIPE_WHATSAPP_NUMBER) {
    const notifLines = [
      `🏨 *ATENDIMENTO ESCALADO — LUNA*`,
      ``,
      `👤 Hóspede: ${nomeHospede}`,
      `📱 WhatsApp: wa.me/${from}`,
      ``,
      `📋 Motivo: ${motivo}`,
    ];
    if (interesse) notifLines.push(`💡 Interesse: ${interesse}`);
    notifLines.push('');
    notifLines.push(`💬 Responda aqui que Luna repassa automaticamente!`);

    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, notifLines.join('\n'));

    // Armazena contexto para resposta da equipe
    const ctx = pendingTeamQueries.get('__ctx__');
    if (ctx && ctx.from === from) {
      pendingTeamQueries.set(from, { history: ctx.history, question: ctx.question, nome: nomeHospede, ts: Date.now() });
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

async function handleConfirmar(userMsg, from, params, contactName, leadId, quotedTotal) {
  if (userMsg) await sendWhatsApp(from, userMsg);

  const p = params || {};
  if (SHEETS_ENABLED) await recordEvent(from, contactName, 'CONFIRMAR', p);

  // Usa quotedTotal salvo na FSM no momento do [COTAR] — fonte autoritativa.
  // Evita que Luna recalcule com preço base quando pede nome após a cotação.
  let totalAmount = quotedTotal || parseCurrency(p.total);
  if (!quotedTotal && p.entrada && p.saida && p.tipo && p.pessoas) {
    const recalc = calculateQuotation({
      data_entrada: p.entrada,
      data_saida:   p.saida,
      tipo:         p.tipo,
      pessoas:      p.pessoas,
    });
    if (!recalc.error) {
      if (totalAmount && Math.abs(totalAmount - recalc.totalFinal) > 1) {
        log('warn', 'confirmar_total_mismatch', {
          phone: from, llmTotal: totalAmount, engineTotal: recalc.totalFinal,
        });
      }
      totalAmount = recalc.totalFinal;
    }
  }
  const depositAmount = p.sinal ? parseCurrency(p.sinal) : Math.round(totalAmount * 0.30);
  const guestName     = p.nome || contactName;

  // Full CRM flow when Supabase is configured
  if (process.env.SUPABASE_URL && leadId && p.entrada && p.saida && p.tipo && totalAmount) {
    try {
      if (leadId) crmService.updateLeadStatus(leadId, 'negotiation').catch(() => {});

      // 1. Create reservation via atomic RPC
      const reservation = await crmService.createReservation({
        leadId,
        whatsapp:      from,
        roomType:      p.tipo,
        checkin:       p.entrada,
        checkout:      p.saida,
        guests:        parseInt(p.pessoas) || 2,
        totalAmount,
        depositAmount,
      });

      if (!reservation.success) {
        // Race condition: dates were taken
        if (reservation.error === 'no_availability') {
          log('warn', 'booking_conflict', { phone: from, roomType: p.tipo, checkin: p.entrada, checkout: p.saida });
          await sendWhatsApp(from,
            'Que pena! As datas escolhidas acabaram de ser reservadas por outro hóspede. ' +
            'Vou chamar nossa equipe para encontrar uma solução! 🌙'
          );
          if (EQUIPE_WHATSAPP_NUMBER) {
            await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER,
              `⚠️ *Conflito de disponibilidade*\n` +
              `Hóspede: ${guestName} | ${from}\n` +
              `Tentou reservar: ${p.tipo} de ${p.entrada} a ${p.saida}\n` +
              `Erro: datas indisponíveis — intervenção manual necessária`
            );
          }
          return;
        }
        throw new Error(reservation.message || reservation.error);
      }

      crmService.updateLeadStatus(leadId, 'confirmed').catch(() => {});
      log('info', 'booking_confirmed', { phone: from, reservationNumber: reservation.reservation_number, roomType: p.tipo });

      // 2. Register pending payment in DB (PIX manual — guest pays to fixed key)
      try {
        const { supabaseAdmin } = require('../supabase/client');
        await supabaseAdmin.from('payments').insert({
          reservation_id: reservation.reservation_id,
          amount:         depositAmount,
          method:         'pix',
          payment_type:   'deposit',
          status:         'pending',
        });
      } catch (err) {
        console.error('[confirmar] Payment record failed (non-blocking):', err.message);
      }

      // PIX key = equipe phone number
      const PIX_KEY = (EQUIPE_WHATSAPP_NUMBER || '').replace(/\D/g, '');

      // 3. Message to guest with static PIX key
      const guestLines = [
        `*Reserva recebida!* Falta só o sinal para garantir. 🌙`,
        ``,
        `*Reserva:* ${reservation.reservation_number}`,
        `*Quarto:* ${p.tipo} | *Hóspedes:* ${p.pessoas || 2}`,
        `*Entrada:* ${p.entrada} | *Saída:* ${p.saida}`,
        `*Total:* ${formatCurrency(totalAmount)} | *Sinal (30%):* ${formatCurrency(depositAmount)}`,
        ``,
        `*Pague o sinal via PIX:*`,
        `Chave: ${PIX_KEY}`,
        `Valor: ${formatCurrency(depositAmount)}`,
        ``,
        `Após o pagamento, envie o comprovante aqui e confirmo sua reserva!`,
      ];
      await sendWhatsApp(from, guestLines.join('\n'));

      // 4. Notify team
      if (EQUIPE_WHATSAPP_NUMBER) {
        const teamLines = [
          `🏨 *Nova reserva — ${reservation.reservation_number}*`,
          ``,
          `👤 ${guestName} | wa.me/${from}`,
          `🛏️ ${p.tipo} | ${p.pessoas || 2} hóspedes`,
          `📅 ${p.entrada} → ${p.saida}`,
          `💰 Total: ${formatCurrency(totalAmount)} | Sinal: ${formatCurrency(depositAmount)}`,
          ``,
          `✅ Chave PIX enviada ao hóspede (${PIX_KEY})`,
          `⏳ Aguardando comprovante de pagamento`,
        ];
        await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, teamLines.join('\n'));
      }
      return;

    } catch (err) {
      log('error', 'confirmar_crm_failed', { phone: from, error: err.message, roomType: p.tipo, checkin: p.entrada, checkout: p.saida });
      // Fall through to legacy flow
    }
  }

  // Log guard bypass (missing required params) to aid debugging
  if (process.env.SUPABASE_URL && (!leadId || !p.entrada || !p.saida || !p.tipo || !totalAmount)) {
    const missing = [];
    if (!leadId)      missing.push('leadId');
    if (!p.entrada)   missing.push('entrada');
    if (!p.saida)     missing.push('saida');
    if (!p.tipo)      missing.push('tipo');
    if (!totalAmount) missing.push('totalAmount');
    log('warn', 'confirmar_guard_bypass', { phone: from, missing: missing.join(',') });
  }

  // Legacy flow — Supabase not configured or error: notify team manually
  const sinal = p.sinal || (totalAmount ? formatCurrency(Math.round(totalAmount * 0.3)) : 'a calcular');
  if (EQUIPE_WHATSAPP_NUMBER) {
    const notif = [
      '🔔 *Nova reserva solicitada!*',
      `Hóspede: ${guestName} | Tel: ${from}`,
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
async function processResponse(response, from, contactName, leadId, quotedTotal) {
  // [COTAR: ...]
  const cotarMatch = response.match(/\[COTAR:[^\]]+\]/);
  if (cotarMatch) {
    const userMsg = response.replace(/\[COTAR:[^\]]+\]/, '').trim();
    if (userMsg) await sendWhatsApp(from, userMsg);
    const params = parseCotarParams(cotarMatch[0]);
    if (params) await handleCotar(params, from, contactName, leadId);
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
      leadId,
    );
    return;
  }

  // [CONFIRMAR: ...]
  const confirmarMatch = response.match(/\[CONFIRMAR:[^\]]+\]/);
  if (confirmarMatch) {
    const userMsg = response.replace(/\[CONFIRMAR:[^\]]+\]/, '').trim();
    const params = parseConfirmarParams(confirmarMatch[0]);
    await handleConfirmar(userMsg, from, params, contactName, leadId, quotedTotal);
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
async function processMessage(from, contactName, text, messageId, timestamp) {
  try {
    const sheetsTimeout = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Upsert lead in CRM (fire-and-forget safe — result used for downstream calls)
    const leadIdPromise = process.env.SUPABASE_URL
      ? crmService.upsertLead(from, looksLikeRealName(contactName) ? contactName : null)
      : Promise.resolve(null);

    // Load history from Sheets + client profile + Supabase history in parallel
    const [sheetsHistory, clientProfile, leadId, supabaseHistory] = await Promise.all([
      SHEETS_ENABLED
        ? Promise.race([getConversationHistory(from), sheetsTimeout(5000).then(() => [])])
        : Promise.resolve([]),
      SHEETS_ENABLED
        ? Promise.race([getClientProfile(from), sheetsTimeout(5000).then(() => ({ nome: null, isNew: true }))])
        : Promise.resolve({ nome: null, isNew: true }),
      leadIdPromise,
      // Supabase: histórico persistente (sobrevive cold starts — lead volta e Luna lembra)
      process.env.SUPABASE_URL
        ? Promise.race([getRecentHistory(supabaseAdmin, from), sheetsTimeout(3000).then(() => [])])
        : Promise.resolve([]),
    ]);

    // Load or initialize Conversation State Machine (for 7-state funnel control)
    let fsm = null;
    if (process.env.SUPABASE_URL && leadId) {
      try {
        fsm = new ConversationStateMachine(leadId, from, supabaseAdmin);
        await fsm.load();
        console.log(`[fsm] Loaded state for ${from}: ${fsm.currentState}`);

        // Reset keywords — saudação após silêncio ou comando explícito reinicia a conversa
        if (RESET_PATTERN.test(text.trim())) {
          const prevState = fsm.currentState;
          await fsm.reset();
          log('info', 'fsm_reset', { phone: from, trigger: text.trim(), prevState });
        }
      } catch (err) {
        console.warn(`[fsm] Failed to load state machine: ${err.message}`);
        fsm = null; // Fallback: continue without FSM
      }
    }

    // Prioridade: Supabase (persistente) > Sheets (legado) > RAM (fallback)
    const fullHistory = supabaseHistory.length > 0
      ? supabaseHistory
      : sheetsHistory.length > 0
        ? sheetsHistory
        : memoryGet(from);

    let knownName = clientProfile.nome;
    if (!knownName && looksLikeRealName(contactName)) {
      knownName = contactName;
      if (SHEETS_ENABLED) upsertClient(from, contactName).catch(() => {});
    }

    const isFirstMessage = fullHistory.length === 0;
    const clientContext = buildClientContext(knownName, isFirstMessage);

    // Inject state machine context if FSM loaded
    const stateContext = fsm
      ? fsm.getPromptInjection()
      : '';
    // Treinamento dinâmico (luna-training.html → luna_config → contexto)
    const trainingCtx = process.env.SUPABASE_URL
      ? await getTrainingContext(supabaseAdmin).catch(() => '')
      : '';

    // LOG TEMPORÁRIO — diagnóstico de treinamento (remover após confirmar)
    log('info', 'training_ctx_debug', {
      phone: from,
      trainingCtx_len: trainingCtx.length,
      trainingCtx_preview: trainingCtx.slice(0, 200) || '(vazio)',
    });

    // callClaude já appenda LUNA_SYSTEM_PROMPT internamente — passar só o contexto adicional
    const contextForClaude = [stateContext, clientContext, trainingCtx]
      .filter(Boolean)
      .join('\n\n');

    const history = fullHistory.slice(-10);
    history.push({ role: 'user', content: text });

    const response = await callClaude(history, contextForClaude);

    const nomeCapturado = parseNomeSignal(response);
    const cleanResponse = response.replace(/\[NOME:\s*[^\]]+\]/, '').trim();

    if (nomeCapturado) {
      if (SHEETS_ENABLED) upsertClient(from, nomeCapturado).catch(() => {});
      if (leadId) crmService.updateLeadName(leadId, nomeCapturado).catch(() => {});
      // Update FSM context with captured name
      if (fsm) {
        await fsm.updateContext({ nome: nomeCapturado }).catch(err =>
          console.warn(`[fsm] Failed to update name: ${err.message}`)
        );
        // If in COLLECT_NAME state and name captured → transition to ASK_DATES
        if (fsm.currentState === 'COLLECT_NAME') {
          try {
            await fsm.transition('ASK_DATES');
            console.log(`[fsm] Name captured, transitioned COLLECT_NAME → ASK_DATES`);
          } catch (err) {
            console.warn(`[fsm] Failed to transition from COLLECT_NAME: ${err.message}`);
          }
        }
      }
    }

    // Handle COLLECT_NAME state: auto-transition after 2 attempts without name (PLU-01.3.1)
    if (fsm && fsm.currentState === 'COLLECT_NAME' && !nomeCapturado) {
      try {
        const escalateFromCollectName = await fsm.trackAttempt('attempts_collect_name');
        // After 2 attempts (>= 2), auto-transition to ASK_DATES
        if (escalateFromCollectName) {
          console.log(`[fsm] COLLECT_NAME: 2+ attempts without name, auto-transitioning to ASK_DATES`);
          await fsm.transition('ASK_DATES');
        }
      } catch (err) {
        console.warn(`[fsm] Failed to track COLLECT_NAME attempt: ${err.message}`);
      }
    }

    // Parse signals and handle FSM transitions (PLU-01.3)
    if (fsm) {
      try {
        // Parse [COTAR: ...] signal
        const cotarSignal = parseCotarParams(cleanResponse);
        if (cotarSignal) {
          console.log(`[fsm] COTAR signal: ${JSON.stringify(cotarSignal)}`);
          // Calcular e persistir quotedTotal — fonte autoritativa para o [CONFIRMAR]
          const fsmQuote = calculateQuotation({
            data_entrada: cotarSignal.data_entrada,
            data_saida:   cotarSignal.data_saida,
            tipo:         cotarSignal.tipo,
            pessoas:      cotarSignal.pessoas,
          });
          const ctxUpdate = {
            data_entrada: cotarSignal.data_entrada,
            data_saida: cotarSignal.data_saida,
            pessoas: parseInt(cotarSignal.pessoas) || null,
            tipo_quarto: cotarSignal.tipo,
          };
          if (!fsmQuote.error) {
            ctxUpdate.quotedTotal = fsmQuote.totalFinal;
            console.log(`[fsm] quotedTotal saved: ${fsmQuote.totalFinal}`);
          }
          await fsm.updateContext(ctxUpdate);
          // Transition to SEND_QUOTE only if currently in valid state
          if (ConversationStateMachine.isValidTransition(fsm.currentState, 'SEND_QUOTE')) {
            await fsm.transition('SEND_QUOTE');
            console.log(`[fsm] Transitioned to SEND_QUOTE`);
          }
        }

        // Parse [CONFIRMAR: ...] signal
        const confirmarSignal = parseConfirmarParams(cleanResponse);
        if (confirmarSignal) {
          console.log(`[fsm] CONFIRMAR signal received`);
          if (ConversationStateMachine.isValidTransition(fsm.currentState, 'CONFIRM_BOOKING')) {
            await fsm.transition('CONFIRM_BOOKING');
            console.log(`[fsm] Transitioned to CONFIRM_BOOKING`);
          }
          if (ConversationStateMachine.isValidTransition(fsm.currentState, 'HANDOFF_HUMAN')) {
            await fsm.transition('HANDOFF_HUMAN');
            console.log(`[fsm] Transitioned to HANDOFF_HUMAN`);
          }
        }

        // Parse [ESCALAR: ...] signal
        const escalarSignal = parseEscalarParams(cleanResponse);
        if (escalarSignal && cleanResponse.includes('[ESCALAR')) {
          console.log(`[fsm] ESCALAR signal: ${JSON.stringify(escalarSignal)}`);
          await fsm.setEscalationReason(escalarSignal.motivo || 'Escalação solicitada');
          if (ConversationStateMachine.isValidTransition(fsm.currentState, 'HANDOFF_HUMAN')) {
            await fsm.transition('HANDOFF_HUMAN');
            console.log(`[fsm] Transitioned to HANDOFF_HUMAN (escalation)`);
          }
        }
      } catch (fsmErr) {
        console.warn(`[fsm] Signal processing error: ${fsmErr.message}`);
        // Non-blocking: FSM errors don't stop message sending
      }
    }

    const displayName = nomeCapturado || knownName || contactName;
    log('info', 'luna_response', { phone: from, name: displayName, reqId: messageId, preview: cleanResponse.substring(0, 80) });

    const updatedHistory = [...fullHistory, { role: 'user', content: text }, { role: 'assistant', content: cleanResponse }];
    memorySet(from, updatedHistory);

    pendingTeamQueries.set('__ctx__', { from, history: fullHistory, question: text });

    // Persist to Sheets + CRM + dispatch signal response — all in parallel
    await Promise.all([
      // Sheets (legacy — disabled when SHEETS_ENABLED=false)
      SHEETS_ENABLED
        ? (async () => {
            await appendMessage(from, displayName, 'user', text);
            await appendMessage(from, displayName, 'assistant', cleanResponse);
          })().catch(() => {})
        : Promise.resolve(),

      // CRM conversations (fire-and-forget — errors logged but don't block Luna response)
      leadId
        ? (() => {
            console.log(`[crm] Recording messages for lead ${leadId}, from ${from}`);
            console.log(`[crm] User timestamp: ${timestamp} (type: ${typeof timestamp})`);
            const userTs = timestamp ? parseInt(timestamp) : null;
            const assistantTs = userTs ? (userTs + 1) : Math.floor(Date.now() / 1000) + 1;
            console.log(`[crm] Parsed user timestamp: ${userTs}, assistant timestamp: ${assistantTs}`);

            return Promise.all([
              crmService.recordConversation(leadId, from, 'user', text, userTs).catch(err => {
                console.error('[crm] Failed to record client message:', err);
              }),
              crmService.recordConversation(leadId, from, 'assistant', cleanResponse, assistantTs).catch(err => {
                console.error('[crm] Failed to record Luna response:', err);
              }),
            ]);
          })()
        : (() => {
            console.log(`[crm] ⚠️  leadId is null — messages will NOT be saved to CRM`);
            return Promise.resolve();
          })(),

      // Signal dispatch (COTAR / ESCALAR / CONFIRMAR / plain text)
      // Passa quotedTotal da FSM para que handleConfirmar use o valor cotado original
      processResponse(cleanResponse, from, displayName, leadId, fsm?.collectedData?.quotedTotal),
    ]);

    // Auto-qualify lead after first Luna response (if no special signals)
    const hasSpecialSignal = /\[(COTAR|CONFIRMAR|ESCALAR)[^\]]*\]/.test(cleanResponse);
    if (leadId && !hasSpecialSignal && isFirstMessage) {
      crmService.updateLeadStatus(leadId, 'qualified').catch(() => {});
    }
  } catch (err) {
    const cause = err.cause?.message || err.cause?.code || '';
    log('error', 'process_error', { phone: from, reqId: messageId, error: err.message, cause: cause || undefined });
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

  // Imagem — verificação de comprovante PIX
  if (message.type === 'image') {
    res.sendStatus(200);
    handlePixComprovante(from, contactName, message.image?.id, message.id, message.timestamp)
      .catch(err => log('error', 'pix_handler_failed', { phone: from, error: err.message }));
    return;
  }

  // Áudio — transcrever com Whisper e processar como texto
  if (message.type === 'audio') {
    res.sendStatus(200);
    handleAudioMessage(from, contactName, message.audio?.id, message.id, message.timestamp)
      .catch(err => log('error', 'audio_handler_failed', { phone: from, error: err.message }));
    return;
  }

  // Outros tipos não suportados (video, document, sticker, etc.)
  if (message.type !== 'text') {
    res.sendStatus(200);
    sendWhatsApp(from, 'Por favor, envie uma mensagem de texto ou áudio 🌙').catch(
      err => console.error('[webhook] Falha mensagem não-texto:', err.message)
    );
    return;
  }

  const text = message.text.body;
  const timestamp = message.timestamp; // Timestamp real da mensagem do WhatsApp (Unix)
  const reqId = message.id;
  log('info', 'message_received', { phone: from, name: contactName, reqId, preview: text.substring(0, 60) });

  // Processa ANTES de enviar 200 — Vercel mata o Lambda após res.sendStatus()
  // Claude responde em ~600ms, bem dentro do limite de 5s da Meta
  // Safety timeout de 4.5s garante que Meta sempre recebe o 200
  const _procStart = Date.now();
  try {
    await Promise.race([
      processMessage(from, contactName, text, reqId, timestamp),
      new Promise(resolve => setTimeout(resolve, 4500)),
    ]);
    log('info', 'message_processed', { phone: from, reqId, durationMs: Date.now() - _procStart });
  } catch (err) {
    log('error', 'message_process_failed', { phone: from, reqId, error: err.message });
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
// GET /health/whatsapp — testa o token na Meta Graph API (DEC-021)
// Token inválido (401) derruba a Luna em silêncio — único canal de venda.
// Consumidores: cron diário (vercel.json), banner do frontdesk, monitor externo.
// ---------------------------------------------------------------------------
app.get('/health/whatsapp', async (_req, res) => {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return res.status(503).json({ status: 'error', token: 'not_configured', ts: Date.now() });
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}?fields=id`, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    });
    if (r.ok) return res.json({ status: 'ok', token: 'valid', ts: Date.now() });

    const body = await r.text();
    log('error', 'whatsapp_token_check_failed', { http: r.status, body: body.slice(0, 300) });
    if (r.status === 401 && EQUIPE_WHATSAPP_NUMBER) {
      // Best-effort: com o token morto este envio também falha — os canais
      // reais de alerta são o 503 (cron/monitor) e o banner do frontdesk
      sendWhatsApp(EQUIPE_WHATSAPP_NUMBER,
        '🚨 *ALERTA*: token do WhatsApp inválido (401). A Luna NÃO está respondendo aos hóspedes. ' +
        'Troque em business.facebook.com → System User → token "Nunca expira" e atualize WHATSAPP_ACCESS_TOKEN na Vercel.'
      ).catch(() => {});
    }
    return res.status(503).json({ status: 'error', token: 'invalid', http: r.status, ts: Date.now() });
  } catch (err) {
    log('error', 'whatsapp_token_check_error', { error: err.message });
    return res.status(503).json({ status: 'error', token: 'unreachable', detail: err.message, ts: Date.now() });
  }
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
    console.log(`[webhook] Anthropic API: ${ANTHROPIC_API_KEY ? 'configurada (claude-sonnet-4-20250514)' : 'NAO CONFIGURADA'}`);
    console.log(`[webhook] WhatsApp: ${WHATSAPP_ACCESS_TOKEN ? 'configurado' : 'NAO CONFIGURADO'}`);
  });
}

module.exports = app;
