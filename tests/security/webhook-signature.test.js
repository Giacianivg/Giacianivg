'use strict';

/**
 * Testes de segurança — X-Hub-Signature-256 (QA-01)
 * Validação da assinatura HMAC-SHA256 do webhook Meta/WhatsApp.
 *
 * Executa em processo isolado (node --test cria subprocesso por arquivo),
 * portanto process.env.WHATSAPP_APP_SECRET não vaza para outros test files.
 *
 * Executa com: node --test tests/security/webhook-signature.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const TEST_SECRET = 'test-app-secret-xyz-for-security-tests';

// Definir env vars ANTES de importar o módulo
process.env.WHATSAPP_APP_SECRET = TEST_SECRET;
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token-sec';
process.env.PORT = '0'; // porta definida pelo listen(0)

let server;
let baseUrl;

before(async () => {
  const app = require('../../services/whatsapp/webhook');
  server = app.listen(0); // porta aleatória — evita conflito com outros testes
  await new Promise((resolve) => server.on('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

after(() => {
  server?.close();
});

/**
 * Computa a assinatura HMAC-SHA256 igual à que o Meta enviaria.
 * Usa JSON.stringify(body) pois é o que o middleware reconstrói após express.json().
 */
function computeSignature(bodyObj, secret) {
  const rawBody = JSON.stringify(bodyObj);
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

// ---------------------------------------------------------------------------
// T-SEC-01: POST /webhook sem header X-Hub-Signature-256 → 403
// ---------------------------------------------------------------------------
test('T-SEC-01: POST /webhook sem X-Hub-Signature-256 retorna 403 missing_signature', async () => {
  const payload = { object: 'whatsapp_business_account', entry: [] };

  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'missing_signature');
});

// ---------------------------------------------------------------------------
// T-SEC-02: POST /webhook com assinatura inválida (formato correto, HMAC errado) → 403
// Nota: timingSafeEqual requer buffers do mesmo tamanho, por isso usamos
// sha256= + 64 zeros (formato válido, valor incorreto) para não lançar TypeError.
// ---------------------------------------------------------------------------
test('T-SEC-02: POST /webhook com HMAC incorreto retorna 403 invalid_signature', async () => {
  const payload = { object: 'whatsapp_business_account', entry: [] };

  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 64 zeros = hash inválido no formato correto (evita TypeError no timingSafeEqual)
      'x-hub-signature-256': 'sha256=' + '0'.repeat(64),
    },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'invalid_signature');
});

// ---------------------------------------------------------------------------
// T-SEC-03: POST /webhook com assinatura válida passa pelo middleware → 200
// Usa payload neutro (object: 'page') que o handler descarta com 200 silencioso.
// ---------------------------------------------------------------------------
test('T-SEC-03: POST /webhook com assinatura HMAC válida retorna 200', async () => {
  const payload = { object: 'page', entry: [] };
  const signature = computeSignature(payload, TEST_SECRET);

  const res = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// T-SEC-04: GET /webhook (challenge Meta) não exige assinatura → 200
// ---------------------------------------------------------------------------
test('T-SEC-04: GET /webhook bypassa validação de assinatura corretamente', async () => {
  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'test-verify-token-sec',
    'hub.challenge': 'challenge_sec_test_xyz',
  });

  const res = await fetch(`${baseUrl}/webhook?${params}`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(body, 'challenge_sec_test_xyz');
});

// ---------------------------------------------------------------------------
// T-SEC-05: POST /quote (não-webhook) não exige assinatura → 200
// Confirma que o middleware só valida /webhook, não outras rotas.
// ---------------------------------------------------------------------------
test('T-SEC-05: POST /quote sem assinatura não é bloqueado (middleware filtra só /webhook)', async () => {
  const res = await fetch(`${baseUrl}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data_entrada: '20/03/2026',
      data_saida: '22/03/2026',
      pessoas: 2,
      tipo: 'ALA_A',
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});
