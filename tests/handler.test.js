'use strict';

/**
 * Testes unitários do webhook handler — PLU-01.1
 * Executa com: node --test tests/handler.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Configura variáveis de ambiente antes de importar o handler
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token-123';
process.env.MAKE_WEBHOOK_URL = 'https://hook.make.com/test-webhook';
process.env.PORT = '4001';

let server;
let baseUrl;

before(async () => {
  const app = require('../services/whatsapp/webhook');
  server = app.listen(0); // porta aleatória para testes
  await new Promise((resolve) => server.on('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

after(() => {
  server?.close();
});

// ---------------------------------------------------------------------------
// T-WAP-01: Webhook responde 200 ao challenge de verificação da Meta
// ---------------------------------------------------------------------------
test('T-WAP-01: GET /webhook com token correto retorna 200 e o challenge', async () => {
  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'test-verify-token-123',
    'hub.challenge': 'challenge_abc123',
  });

  const res = await fetch(`${baseUrl}/webhook?${params}`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(body, 'challenge_abc123');
});

test('T-WAP-01b: GET /webhook com token errado retorna 403', async () => {
  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'token-errado',
    'hub.challenge': 'challenge_abc123',
  });

  const res = await fetch(`${baseUrl}/webhook?${params}`);
  assert.equal(res.status, 403);
});

test('T-WAP-01c: GET /webhook sem hub.mode retorna 403', async () => {
  const params = new URLSearchParams({
    'hub.verify_token': 'test-verify-token-123',
    'hub.challenge': 'challenge_abc123',
  });

  const res = await fetch(`${baseUrl}/webhook?${params}`);
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// POST /webhook — Resposta imediata 200 (AC1 da história)
// ---------------------------------------------------------------------------
test('POST /webhook retorna 200 imediatamente (objeto whatsapp_business_account)', async () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'business-account-id',
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone-number-id' },
              messages: [
                {
                  id: 'msg-001',
                  from: '5519999999999',
                  timestamp: '1708000000',
                  type: 'text',
                  text: { body: 'Olá, quero fazer uma reserva!' },
                },
              ],
              contacts: [{ profile: { name: 'João Silva' } }],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
});

test('POST /webhook retorna 200 para objeto desconhecido (ignorado silenciosamente)', async () => {
  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object: 'page', entry: [] }),
  });

  assert.equal(res.status, 200);
});

test('POST /webhook retorna 200 para evento sem mensagem (status de entrega)', async () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'business-account-id',
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone-number-id' },
              statuses: [{ id: 'msg-001', status: 'delivered' }],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
test('GET /health retorna 200 com status ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'pousada-whatsapp-webhook');
});

// ---------------------------------------------------------------------------
// POST /quote — Endpoint de cotação
// ---------------------------------------------------------------------------
test('POST /quote retorna cotação correta para ALA_A 2 noites', async () => {
  const res = await fetch(`${baseUrl}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 2, tipo: 'ALA_A' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.nights, 2);
  assert.equal(body.data.totalFinal, 600);
  assert.ok(body.data.message.includes('CONFIRMAR'));
  assert.ok(body.data.message.includes('Circuito das Águas Paulista'));
});

test('POST /quote retorna desconto 10% para 7 noites', async () => {
  const res = await fetch(`${baseUrl}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_entrada: '10/03/2026', data_saida: '17/03/2026', pessoas: 2, tipo: 'ALA_A' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.desconto, 10);
  assert.equal(body.data.totalFinal, 1890);
});

test('POST /quote retorna escalar=true para ALA_C_GRUPO', async () => {
  const res = await fetch(`${baseUrl}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 8, tipo: 'ALA_C_GRUPO' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.escalar, true);
});

test('POST /quote retorna 400 para datas inválidas', async () => {
  const res = await fetch(`${baseUrl}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_entrada: '15/03/2026', data_saida: '10/03/2026', pessoas: 2, tipo: 'ALA_A' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.ok(body.error);
});
