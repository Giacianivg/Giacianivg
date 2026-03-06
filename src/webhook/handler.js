'use strict';

require('dotenv').config();
const express = require('express');
const { calculateQuotation, formatWhatsAppMessage } = require('./quotation');
const LUNA_SYSTEM_PROMPT = require('./luna-system-prompt');
const { getConversationHistory, appendMessage, recordEvent } = require('./sheets');

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
async function callClaude(messages) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: LUNA_SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content[0].text;
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
    const notif = `🔔 *Escalonamento Luna*\nCliente: ${contactName} | ${from}${detail ? `\n${detail}` : ''}`;
    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, notif);
  }
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
// POST /webhook — Recebimento de mensagens WhatsApp
// CRÍTICO: responder 200 IMEDIATAMENTE — Meta cancela se não receber em <5s
// ---------------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Objetos não-whatsapp: responder 200 imediatamente e sair
  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(200);
  }

  const value = body.entry?.[0]?.changes?.[0]?.value;

  // Status de entrega, leitura, etc. — sem mensagem de texto
  if (!value?.messages?.length) {
    return res.sendStatus(200);
  }

  const message = value.messages[0];
  const from = message.from;
  const contactName = value.contacts?.[0]?.profile?.name || 'Hóspede';

  // Mensagem não-texto
  if (message.type !== 'text') {
    await sendWhatsApp(from, 'Por favor, envie uma mensagem de texto 🌙');
    return res.sendStatus(200);
  }

  const text = message.text.body;
  console.log(`[webhook] ${from} (${contactName}): ${text.substring(0, 60)}`);

  // ---------------------------------------------------------------------------
  // Processar ANTES de responder 200 — Vercel congela execução após res.send()
  // Timeout de 4.5s: Meta exige resposta em <5s; Claude tipicamente leva 1-3s
  // ---------------------------------------------------------------------------
  const TIMEOUT_MS = 4500;

  try {
    await Promise.race([
      (async () => {
        const history = await getConversationHistory(from);
        history.push({ role: 'user', content: text });

        const response = await callClaude(history);
        console.log(`[webhook] Luna → ${from}: ${response.substring(0, 80)}`);

        // Gravar histórico e enviar resposta em paralelo (não bloqueiam o 200)
        await Promise.all([
          (async () => {
            await appendMessage(from, contactName, 'user', text);
            await appendMessage(from, contactName, 'assistant', response);
          })(),
          processResponse(response, from, contactName),
        ]);
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    console.error('[webhook] Erro:', err.message);
    if (err.message !== 'timeout') {
      try {
        await sendWhatsApp(from, 'Estamos com uma instabilidade momentânea. Nossa equipe entrará em contato em breve! 🌙');
      } catch (e) {
        console.error('[webhook] Falha ao enviar mensagem de erro:', e.message);
      }
    }
  }

  // 200 sempre enviado ao final — Meta não rejeita nem tenta reenviar
  return res.sendStatus(200);
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
