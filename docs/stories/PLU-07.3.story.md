# PLU-07.3: Fluxo [CONFIRMAR] — Cria Reserva + Envia Link PIX Sinal

**Status:** Draft
**Epic:** EPIC-PLU-07 — Integração Luna ↔ CRM
**Points:** 8
**Priority:** Critica
**Executor:** @dev
**Quality Gate:** @architect
**Depends on:** PLU-06.5, PLU-07.1, PLU-07.2

---

## User Story

**Como** hóspede que confirmou interesse em reservar,
**quero** receber um link PIX para pagar o sinal imediatamente no WhatsApp,
**para** garantir minha reserva sem precisar esperar contato humano para receber dados bancários.

---

## Acceptance Criteria

- [ ] AC-01: Quando Luna emite `[CONFIRMAR: nome=X, entrada=DD/MM/YYYY, saida=DD/MM/YYYY, tipo=ALA_X, pessoas=N, total=R$VALOR, sinal=R$SINAL]`, webhook executa o fluxo completo de reserva
- [ ] AC-02: Fluxo: upsert lead → verificar disponibilidade → chamar `create_reservation_atomic` RPC → criar pagamento PIX → enviar link ao hóspede
- [ ] AC-03: Se disponibilidade perdida entre [COTAR] e [CONFIRMAR] (race condition), Luna responde ao hóspede com mensagem de desculpas + escalada para equipe
- [ ] AC-04: Hóspede recebe mensagem com: resumo da reserva, valor do sinal, link PIX clicável, prazo de 24h para pagamento
- [ ] AC-05: Equipe recebe notificação WhatsApp com: dados da reserva, `reservation_number`, status "aguardando sinal PIX"
- [ ] AC-06: Após pagamento PIX confirmado (via webhook MercadoPago → PLU-06.5), equipe recebe confirmação de pagamento e hóspede recebe mensagem de boas-vindas
- [ ] AC-07: `reservation_number` no formato `RES-YYYY-NNNNN` incluído em todas as comunicações
- [ ] AC-08: Fluxo completo (AC-02) executado em background após `res.sendStatus(200)` — nunca atrasa resposta Meta

---

## Technical Notes

### [CONFIRMAR] Full Flow
```javascript
// services/whatsapp/webhook.js — handleConfirmar() rewrite

async function handleConfirmar(from, params, contactName) {
  // Step 1: Upsert lead
  const leadId = await crmService.upsertLead(from, params.nome || contactName);

  // Step 2: Create reservation via RPC
  const reservationResult = await fetch(`${CRM_API_URL}/api/reservations/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      leadId,
      whatsapp:       from,
      roomType:       params.tipo,
      checkin:        params.entrada,
      checkout:       params.saida,
      guests:         parseInt(params.pessoas),
      totalAmount:    parseCurrency(params.total),
      depositAmount:  parseCurrency(params.sinal),
    }),
  }).then(r => r.json());

  if (!reservationResult.success) {
    // Handle no_availability or other errors
    await handleConfirmarError(from, reservationResult.error, contactName);
    return;
  }

  // Step 3: Create PIX payment
  const pixResult = await fetch(`${CRM_API_URL}/api/payments/pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      reservationId: reservationResult.reservation_id,
      amount:        parseCurrency(params.sinal),
      description:   `Sinal reserva ${reservationResult.reservation_number} — Pousada Luz da Lua`,
    }),
  }).then(r => r.json());

  // Step 4: Notify guest
  await sendWhatsApp(from, buildGuestConfirmationMessage({
    ...reservationResult,
    ...pixResult,
    params,
  }));

  // Step 5: Notify team
  if (EQUIPE_WHATSAPP_NUMBER) {
    await sendWhatsApp(EQUIPE_WHATSAPP_NUMBER, buildTeamReservationMessage({
      ...reservationResult,
      guestWhatsapp: from,
      guestName: params.nome || contactName,
    }));
  }
}
```

### Guest Confirmation Message
```
*Reserva recebida!* Falta só o sinal para garantir.

*Reserva:* RES-2026-00001
*Quarto:* Ala B (até 5 pessoas)
*Entrada:* 10/04/2026 | *Saída:* 12/04/2026
*Total:* R$ 600,00 | *Sinal (30%):* R$ 180,00

Pague o sinal via PIX:
[link clicável]

Prazo: 24 horas. Após o pagamento confirmarei sua reserva!
```

### Error Handling: Race Condition
```javascript
// no_availability error from RPC:
// Luna sends apology + escalates to team
// Team manually resolves or offers alternatives
```

### parseCurrency helper
```javascript
// "R$180,00" → 180.00
// "R$ 180" → 180.00
function parseCurrency(str) {
  return parseFloat(str.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
}
```

---

## Tasks

- [ ] T1: Reescrever `handleConfirmar()` no webhook com fluxo completo (5 steps acima)
- [ ] T2: `buildGuestConfirmationMessage()` — mensagem formatada para hóspede com link PIX
- [ ] T3: `buildTeamReservationMessage()` — notificação para equipe com `reservation_number`
- [ ] T4: `handleConfirmarError()` — mensagem de desculpas + escalada quando `no_availability`
- [ ] T5: `parseCurrency()` — utilitário em `services/utils/currency.js`
- [ ] T6: Testes E2E do fluxo completo: sucesso, no_availability, PIX timeout
- [ ] T7: Teste de carga: fluxo completo dentro de 4s (deixando 1s de margem para Meta)

---

## Quality Gate — @architect

- [ ] QG-01: Todo o fluxo `handleConfirmar` executa após `res.sendStatus(200)` — verificado por teste de timing
- [ ] QG-02: `create_reservation_atomic` é a ÚNICA forma de criar reserva — sem INSERT direto
- [ ] QG-03: Race condition `no_availability` tratado graciosamente — hóspede nunca recebe stack trace
- [ ] QG-04: `parseCurrency()` cobre formatos "R$180", "R$ 180,00", "180.00", "180" — testado com fixtures
- [ ] QG-05: `SERVICE_ROLE_KEY` nunca exposto no payload de resposta ao hóspede

---

## File List

- `services/whatsapp/webhook.js` — modificado (handleConfirmar completo)
- `services/utils/currency.js` — novo
- `tests/confirmar-flow.test.js` — novo

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
