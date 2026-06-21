'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const ip = require('../../services/payments/infinitepay');

// ── Mock de fetch ─────────────────────────────────────────────────────────────
let calls;
const realFetch = global.fetch;

function mockFetch(response) {
  calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return response;
  };
}
function jsonRes(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => { process.env.INFINITEPAY_HANDLE = '$pousada_luz'; });
afterEach(() => { global.fetch = realFetch; });

// ── toCents ───────────────────────────────────────────────────────────────────
test('toCents converte reais → centavos (com arredondamento)', () => {
  assert.strictEqual(ip.toCents(10), 1000);
  assert.strictEqual(ip.toCents(10.0), 1000);
  assert.strictEqual(ip.toCents(239.9), 23990);
  assert.strictEqual(ip.toCents(0.1 + 0.2), 30); // 0.30000000000000004 → 30
});

// ── mapCaptureMethod ────────────────────────────────────────────────────────────
test('mapCaptureMethod mapeia para o enum da tabela payments', () => {
  assert.strictEqual(ip.mapCaptureMethod('pix'), 'pix');
  assert.strictEqual(ip.mapCaptureMethod('credit_card'), 'card');
  assert.strictEqual(ip.mapCaptureMethod('card'), 'card');
  assert.strictEqual(ip.mapCaptureMethod('qualquer'), 'pix'); // default seguro
});

// ── createPaymentLink ───────────────────────────────────────────────────────────
test('createPaymentLink monta o corpo correto e retorna url + slug', async () => {
  mockFetch(jsonRes({ url: 'https://checkout.infinitepay.com.br/pousada_luz?lenc=ABC123' }));

  const out = await ip.createPaymentLink({
    orderNsu: 'RES-2026-0042',
    amount: 220,
    description: 'Sinal',
    redirectUrl: 'https://site/ok',
    webhookUrl: 'https://site/hook',
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.checkout.infinitepay.io/links');
  const b = calls[0].body;
  assert.strictEqual(b.handle, 'pousada_luz');            // sem o "$"
  assert.strictEqual(b.order_nsu, 'RES-2026-0042');       // string
  assert.strictEqual(b.redirect_url, 'https://site/ok');
  assert.strictEqual(b.webhook_url, 'https://site/hook');
  assert.deepStrictEqual(b.items, [{ quantity: 1, price: 22000, description: 'Sinal' }]); // centavos
  assert.strictEqual(out.url, 'https://checkout.infinitepay.com.br/pousada_luz?lenc=ABC123');
  assert.strictEqual(out.slug, 'ABC123');
  assert.strictEqual(out.order_nsu, 'RES-2026-0042');
});

test('createPaymentLink lança se INFINITEPAY_HANDLE não configurado', async () => {
  delete process.env.INFINITEPAY_HANDLE;
  await assert.rejects(
    () => ip.createPaymentLink({ orderNsu: 'X', amount: 1, redirectUrl: 'u' }),
    /INFINITEPAY_HANDLE not configured/,
  );
});

test('createPaymentLink lança em resposta não-ok', async () => {
  mockFetch(jsonRes({ error: 'bad' }, { ok: false, status: 422 }));
  await assert.rejects(
    () => ip.createPaymentLink({ orderNsu: 'X', amount: 1, redirectUrl: 'u' }),
    /InfinitePay \/links 422/,
  );
});

test('createPaymentLink lança se resposta sem url', async () => {
  mockFetch(jsonRes({ foo: 'bar' }));
  await assert.rejects(
    () => ip.createPaymentLink({ orderNsu: 'X', amount: 1, redirectUrl: 'u' }),
    /resposta sem "url"/,
  );
});

// ── verifyPayment ───────────────────────────────────────────────────────────────
test('verifyPayment monta o corpo e normaliza a resposta', async () => {
  mockFetch(jsonRes({ success: true, paid: true, amount: 22000, paid_amount: 22000, capture_method: 'pix' }));

  const v = await ip.verifyPayment({ orderNsu: 'RES-1', transactionNsu: 'TX-9', slug: 'ABC123' });

  assert.strictEqual(calls[0].url, 'https://api.checkout.infinitepay.io/payment_check');
  const b = calls[0].body;
  assert.strictEqual(b.handle, 'pousada_luz');
  assert.strictEqual(b.order_nsu, 'RES-1');
  assert.strictEqual(b.transaction_nsu, 'TX-9');
  assert.strictEqual(b.slug, 'ABC123');
  assert.deepStrictEqual(v, { paid: true, amount: 22000, paid_amount: 22000, capture_method: 'pix' });
});

test('verifyPayment retorna paid=false quando não liquidado', async () => {
  mockFetch(jsonRes({ success: true, paid: false }));
  const v = await ip.verifyPayment({ orderNsu: 'RES-1' });
  assert.strictEqual(v.paid, false);
  assert.strictEqual(v.paid_amount, null);
});
