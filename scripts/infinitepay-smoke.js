'use strict';

/**
 * Smoke test manual da InfinitePay — cria um link de pagamento REAL de R$ 1,00
 * (a InfinitePay não tem sandbox: é dinheiro de verdade). Use para o primeiro
 * teste ponta-a-ponta antes de ativar o checkout em produção, e estorne/cancele
 * manualmente depois.
 *
 * Pré-requisito: INFINITEPAY_HANDLE definido no ambiente (.env).
 *
 * Uso:
 *   node -r dotenv/config scripts/infinitepay-smoke.js
 *   # ou, se já exporta o handle no shell:
 *   INFINITEPAY_HANDLE=seu_handle node scripts/infinitepay-smoke.js
 *
 * Opcional — verificar um pagamento depois de pagar:
 *   node -r dotenv/config scripts/infinitepay-smoke.js --check <order_nsu> <transaction_nsu> <slug>
 */

const { createPaymentLink, verifyPayment } = require('../services/payments/infinitepay');

async function main() {
  if (!process.env.INFINITEPAY_HANDLE) {
    console.error('✗ Defina INFINITEPAY_HANDLE no ambiente (.env) antes de rodar.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const [, orderNsu, transactionNsu, slug] = args;
    const v = await verifyPayment({ orderNsu, transactionNsu, slug });
    console.log('payment_check →', JSON.stringify(v, null, 2));
    return;
  }

  const orderNsu = `SMOKE-${Date.now()}`;
  const base = process.env.PUBLIC_BASE_URL || 'https://www.pousadaluzdaluasp.com.br';

  const link = await createPaymentLink({
    orderNsu,
    amount: 1, // R$ 1,00 (vira 100 centavos)
    description: 'Teste InfinitePay — R$ 1 (smoke, estornar depois)',
    redirectUrl: `${base}/landing/reserva-confirmada.html?order=${orderNsu}`,
    webhookUrl:  `${base}/api/public/infinitepay-webhook`,
  });

  console.log('✓ Link de R$ 1 criado.');
  console.log('  order_nsu :', link.order_nsu);
  console.log('  slug      :', link.slug);
  console.log('  checkout  :', link.url);
  console.log('\nAbra o checkout, pague R$ 1, e confirme com:');
  console.log(`  node -r dotenv/config scripts/infinitepay-smoke.js --check ${link.order_nsu} <transaction_nsu> ${link.slug}`);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
