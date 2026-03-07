# PLU-06.5: Integração MercadoPago PIX — Cobrança de Sinal

**Status:** Draft
**Epic:** EPIC-PLU-06 — Fundação CRM
**Points:** 8
**Priority:** Alta
**Executor:** @dev
**Quality Gate:** @architect
**Depends on:** PLU-06.4

---

## User Story

**Como** gestor da pousada,
**quero** que o sistema gere automaticamente um link PIX de sinal ao confirmar uma reserva,
**para** eliminar o processo manual de enviar chaves PIX e reduzir o tempo até o pagamento.

---

## Acceptance Criteria

- [ ] AC-01: `POST /api/payments/pix` recebe `{ reservation_id, amount, description }` e retorna `{ payment_id, pix_link, pix_qr_code, expires_at }`
- [ ] AC-02: Link PIX gerado via MercadoPago Payments API (não Checkout Pro)
- [ ] AC-03: `payment_id` e `pix_link` persistidos na tabela `payments` com `status = 'pending'`
- [ ] AC-04: `POST /api/payments/webhook` recebe notificação MercadoPago e atualiza `payments.status`
- [ ] AC-05: Quando pagamento aprovado (`status = 'approved'`): `payments.paid_at` preenchido e `reservations.status` atualizado para `confirmed`
- [ ] AC-06: `GET /api/payments/:id` retorna status atual do pagamento
- [ ] AC-07: Webhook MercadoPago valida assinatura `x-signature` antes de processar
- [ ] AC-08: Link PIX expira em 24h (configurável via `settings.pix_expiration_hours`)
- [ ] AC-09: Variáveis de ambiente documentadas em `.env.example`

---

## Technical Notes

### MercadoPago PIX Payment Creation
```javascript
// services/payments/mercadopago.js
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

async function createPixPayment({ reservationId, amount, description, payerEmail }) {
  const payment = new Payment(client);
  const response = await payment.create({
    body: {
      transaction_amount: amount,
      description,
      payment_method_id: 'pix',
      payer: { email: payerEmail || 'guest@pousadaluzdealua.com.br' },
      external_reference: reservationId,
      date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  return {
    payment_id:   response.id,
    pix_link:     response.point_of_interaction.transaction_data.ticket_url,
    pix_qr_code:  response.point_of_interaction.transaction_data.qr_code,
    expires_at:   response.date_of_expiration,
  };
}
```

### Webhook Signature Validation
```javascript
// POST /api/payments/webhook
// MercadoPago sends x-signature header: ts=TIMESTAMP,v1=HASH
// Validate: HMAC-SHA256(ts + "." + data.id, MERCADOPAGO_WEBHOOK_SECRET)
```

### Payment Status Flow
```
pending → approved  (PIX paid)
pending → cancelled (expired or manual cancel)
pending → rejected  (rare for PIX)
```

### Environment Variables
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...   # from MercadoPago dashboard
```

---

## Tasks

- [ ] T1: `npm install mercadopago` + setup `services/payments/mercadopago.js`
- [ ] T2: `POST /api/payments/pix` — criar pagamento PIX + persistir em `payments`
- [ ] T3: `GET /api/payments/:id` — retornar status com polling friendly (sem cache agressivo)
- [ ] T4: `POST /api/payments/webhook` — receber notificação, validar assinatura, atualizar status
- [ ] T5: Ao `status = approved`: atualizar `reservations.status = 'confirmed'` via transação
- [ ] T6: Adicionar variáveis ao `.env.example`
- [ ] T7: Testes unitários de validação de assinatura webhook
- [ ] T8: Testes de integração: criação PIX + simulação de webhook approval

---

## Quality Gate — @architect

- [ ] QG-01: `MERCADOPAGO_WEBHOOK_SECRET` nunca logado — validação descarta secret após uso
- [ ] QG-02: Webhook valida assinatura ANTES de qualquer update no banco
- [ ] QG-03: Webhook é idempotente — processar mesmo `payment_id` duas vezes não duplica updates
- [ ] QG-04: `accessToken` lido de env var, nunca hardcoded
- [ ] QG-05: Falha no MercadoPago não causa falha na reserva — pagamento é criado assincronamente

---

## File List

- `services/payments/mercadopago.js` — novo
- `api/payments/pix/route.js` — novo
- `api/payments/[id]/route.js` — novo
- `api/payments/webhook/route.js` — novo
- `.env.example` — modificado (MERCADOPAGO vars)
- `tests/payments.test.js` — novo

---

## Dev Agent Record

**Agent Model Used:** —
**Debug Log:** —
**Completion Notes:** —

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada | River (@sm) |
