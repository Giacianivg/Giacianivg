'use strict';

require('dotenv').config();
const express = require('express');
const { calculateQuotation, formatWhatsAppMessage } = require('./quotation');

const app = express();
app.use(express.json());

const {
  WHATSAPP_VERIFY_TOKEN,
  MAKE_WEBHOOK_URL,
  PORT = 3000,
} = process.env;

// ---------------------------------------------------------------------------
// GET /webhook — Verificação do webhook pela Meta
// A Meta envia uma requisição GET para confirmar posse do endpoint.
// ---------------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || '').trim()) {
    console.log('[webhook] Verificação Meta OK — challenge aceito');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook] Verificação Meta FALHOU — token inválido ou mode incorreto');
  return res.sendStatus(403);
});

// ---------------------------------------------------------------------------
// POST /webhook — Recebimento de mensagens do WhatsApp
// CRÍTICO: responder 200 IMEDIATAMENTE antes de qualquer processamento.
// A Meta cancela o delivery e retenta se não receber 200 em <5s.
// ---------------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  // Resposta imediata à Meta — obrigatório para evitar retry/bloqueio
  res.sendStatus(200);

  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    return; // Ignorar eventos não relacionados ao WhatsApp
  }

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignorar eventos sem mensagens (status de entrega, leitura, etc.)
    if (!value?.messages?.length) {
      return;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const payload = {
      messageId: message.id,
      from: message.from,               // Número do remetente (E.164: 5519...)
      name: contact?.profile?.name ?? 'Hóspede',
      timestamp: message.timestamp,
      type: message.type,               // 'text', 'image', 'audio', etc.
      text: message.type === 'text' ? message.text?.body : null,
      phoneNumberId: value.metadata?.phone_number_id,
      businessAccountId: entry?.id,
    };

    console.log(`[webhook] Mensagem recebida de ${payload.from} (${payload.name}) — tipo: ${payload.type}`);

    // Encaminhar para Make.com para orquestração Claude + Airtable
    await forwardToMake(payload);
  } catch (err) {
    // Log do erro sem lançar — a resposta 200 já foi enviada à Meta
    console.error('[webhook] Erro ao processar mensagem:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Encaminhar payload para Make.com via HTTP POST
// ---------------------------------------------------------------------------
async function forwardToMake(payload) {
  if (!MAKE_WEBHOOK_URL) {
    console.warn('[webhook] MAKE_WEBHOOK_URL não configurado — mensagem não encaminhada');
    return;
  }

  const response = await fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Make.com retornou status ${response.status}`);
  }

  console.log(`[webhook] Payload encaminhado ao Make.com com sucesso (status ${response.status})`);
}

// ---------------------------------------------------------------------------
// POST /quote — Cálculo de cotação chamado pelo Make.com
// Recebe { data_entrada, data_saida, pessoas, tipo } e retorna cotação calculada
// com mensagem WhatsApp formatada pronta para envio.
// ---------------------------------------------------------------------------
app.post('/quote', (req, res) => {
  const { data_entrada, data_saida, pessoas, tipo } = req.body;

  const result = calculateQuotation({ data_entrada, data_saida, pessoas, tipo });

  if (result.error) {
    const status = result.escalar ? 200 : 400;
    return res.status(status).json({ success: false, ...result });
  }

  const message = formatWhatsAppMessage(result);
  console.log(`[quote] Cotação gerada: ${tipo} ${data_entrada}→${data_saida} R$${result.totalFinal}`);

  return res.json({ success: true, data: { ...result, message } });
});

// ---------------------------------------------------------------------------
// Health check — Vercel e monitoramento externo
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pousada-whatsapp-webhook', ts: Date.now() });
});

// ---------------------------------------------------------------------------
// Política de Privacidade — exigida pelo Meta Developers para apps WhatsApp
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
<p>Os dados coletados são utilizados exclusivamente para:</p>
<ul>
<li>Responder dúvidas e solicitações de reserva</li>
<li>Enviar cotações e confirmações de hospedagem</li>
<li>Melhorar o atendimento ao hóspede</li>
</ul>

<h2>3. Compartilhamento</h2>
<p>Não compartilhamos dados pessoais com terceiros, exceto serviços necessários para o funcionamento do atendimento (Meta/WhatsApp, conforme os Termos de Serviço da Meta).</p>

<h2>4. Armazenamento</h2>
<p>As conversas são armazenadas de forma segura e podem ser excluídas mediante solicitação enviada para o número de atendimento da pousada.</p>

<h2>5. Contato</h2>
<p>Dúvidas sobre esta política: envie mensagem via WhatsApp para (19) 99840-0306.</p>
</body>
</html>`);
});


// ---------------------------------------------------------------------------
// Inicialização do servidor
// Vercel (serverless): exporta o app Express diretamente — NÃO chama listen()
// Local (node handler.js): chama listen() normalmente
// ---------------------------------------------------------------------------
if (require.main === module) {
  // Executado diretamente: node handler.js
  app.listen(PORT, () => {
    console.log(`[webhook] Servidor rodando na porta ${PORT}`);
    console.log(`[webhook] Endpoints: GET /webhook | POST /webhook | GET /health`);
  });
}

// Exporta o app Express diretamente para o Vercel (@vercel/node) e para os testes
module.exports = app;
