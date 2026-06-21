'use strict';

/**
 * InfinitePay — Checkout Integrado (link de pagamento hospedado).
 * Substitui o Mercado Pago (ver services/payments/_archived/mercadopago.js).
 *
 * Modelo: POST /links cria um checkout HOSPEDADO (PIX grátis ou cartão). O
 * hóspede é REDIRECIONADO para a URL retornada e volta via redirect_url. A
 * confirmação chega por webhook — que NÃO é assinado pela InfinitePay — então
 * NUNCA confirmamos uma reserva sem antes verificar com payment_check (a
 * verdade server-side). Toda quantia trafega em CENTAVOS.
 *
 * Doc: https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-da-infinitepay
 */

const API = 'https://api.checkout.infinitepay.io';

// O handle (InfiniteTag) identifica o recebedor. Sem auth header documentada.
function getHandle() {
  const h = process.env.INFINITEPAY_HANDLE;
  if (!h) throw new Error('INFINITEPAY_HANDLE not configured');
  return String(h).replace(/^\$/, ''); // handle sem o símbolo "$"
}

// reais → centavos (a API trabalha SEMPRE em centavos: R$ 10,00 = 1000)
function toCents(reais) { return Math.round(Number(reais) * 100); }

// capture_method da InfinitePay → enum da tabela `payments` (pix|card|cash|transfer)
function mapCaptureMethod(cm) {
  if (cm === 'pix') return 'pix';
  if (cm === 'credit_card' || cm === 'card') return 'card';
  return 'pix';
}

/**
 * Cria um link de pagamento hospedado.
 * @param {object} p
 * @param {string|number} p.orderNsu   - identificador do pedido no nosso sistema (único)
 * @param {number} p.amount            - valor em REAIS (convertido p/ centavos aqui)
 * @param {string} p.description
 * @param {string} p.redirectUrl       - p/ onde o hóspede volta após pagar
 * @param {string} [p.webhookUrl]      - p/ onde a InfinitePay notifica o pagamento
 * @param {object} [p.customer]        - { name, email, phone_number }
 * @returns {Promise<{ url:string, order_nsu:string, slug:string|null }>}
 */
async function createPaymentLink({ orderNsu, amount, description, redirectUrl, webhookUrl, customer }) {
  const body = {
    handle:       getHandle(),
    redirect_url: redirectUrl,
    order_nsu:    String(orderNsu),
    items: [{ quantity: 1, price: toCents(amount), description: description || `Reserva ${orderNsu}` }],
  };
  if (webhookUrl) body.webhook_url = webhookUrl;
  if (customer)   body.customer    = customer;

  const res = await fetch(`${API}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`InfinitePay /links ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (!data || !data.url) throw new Error('InfinitePay /links: resposta sem "url"');

  // o parâmetro "lenc" da URL identifica a fatura (slug) — útil p/ payment_check
  let slug = null;
  try { slug = new URL(data.url).searchParams.get('lenc'); } catch (_) { /* url atípica */ }

  return { url: data.url, order_nsu: String(orderNsu), slug };
}

/**
 * Verifica server-side se um pagamento foi liquidado. Fonte da verdade: como o
 * webhook não é assinado, NUNCA confirmamos uma reserva sem este check.
 * @returns {Promise<{ paid:boolean, amount:number|null, paid_amount:number|null, capture_method:string|null }>}
 */
async function verifyPayment({ orderNsu, transactionNsu, slug }) {
  const body = { handle: getHandle(), order_nsu: String(orderNsu) };
  if (transactionNsu) body.transaction_nsu = String(transactionNsu);
  if (slug)           body.slug            = String(slug);

  const res = await fetch(`${API}/payment_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`InfinitePay /payment_check ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    paid:           !!data.paid,
    amount:         data.amount ?? null,
    paid_amount:    data.paid_amount ?? null,
    capture_method: data.capture_method || null,
  };
}

module.exports = { createPaymentLink, verifyPayment, toCents, mapCaptureMethod };
