# PLU-07.2: Luna Consulta Disponibilidade via API CRM

**Status:** Draft
**Epic:** EPIC-PLU-07 — Integração Luna ↔ CRM
**Points:** 5
**Priority:** Critica
**Executor:** @dev
**Quality Gate:** @architect
**Depends on:** PLU-06.2, PLU-06.3, PLU-07.1

---

## User Story

**Como** Luna (chatbot),
**quero** consultar disponibilidade real no Supabase antes de responder ao hóspede sobre datas,
**para** substituir a resposta genérica "sujeita a confirmação" por uma resposta precisa baseada em dados reais.

---

## Acceptance Criteria

- [ ] AC-01: Quando Luna emite `[COTAR: tipo=X, data_entrada=DD/MM/YYYY, data_saida=DD/MM/YYYY, pessoas=N]`, webhook chama `GET /api/availability` antes de calcular a cotação
- [ ] AC-02: Se `available: true` → cotação calculada normalmente e enviada ao hóspede
- [ ] AC-03: Se `available: false` → Luna recebe contexto de indisponibilidade e oferece datas alternativas (próximas 2 semanas livres via `GET /api/availability/calendar`)
- [ ] AC-04: Mensagem ao hóspede quando indisponível: não diz "sistema bloqueado", oferece alternativas concretas
- [ ] AC-05: Fallback: se API CRM estiver indisponível (timeout 3s), comportamento anterior ("sujeita a confirmação") é mantido — nunca bloqueia
- [ ] AC-06: Resposta de disponibilidade injetada no contexto de Luna (não no histórico público) antes de gerar resposta

---

## Technical Notes

### Availability Check in Webhook Flow
```javascript
// services/whatsapp/webhook.js — handleCotar() modification

async function handleCotar(from, params, history, contactName) {
  let availabilityContext = '';

  try {
    const avail = await checkAvailability(params.tipo, params.data_entrada, params.data_saida);
    if (!avail.available) {
      const alternatives = await fetchAlternativeDates(params.tipo, params.data_entrada);
      availabilityContext = buildUnavailableContext(alternatives);  // injected into Luna prompt
    }
  } catch (err) {
    // Fallback: log error, proceed without availability check
    console.error('[CRM] availability check failed, proceeding without:', err.message);
  }

  // Rebuild Claude context with availability info
  const enhancedHistory = availabilityContext
    ? [...history, { role: 'system', content: availabilityContext }]
    : history;

  // Call Claude with enhanced context
  const lunaResponse = await callClaude(enhancedHistory, params);
  // ... send to guest
}
```

### Availability Context Format
```javascript
// Injected as system message (not shown to guest):
// "DISPONIBILIDADE: ALA_A não está disponível de 10/04 a 12/04.
//  Próximas datas livres: 15/04-20/04, 22/04-28/04.
//  Ofereça essas alternativas ao hóspede."
```

### Alternative Dates Logic
```javascript
// GET /api/availability/calendar?from=DATE&to=DATE+14d
// Filter days where all nights in a 2-day window are 'available'
// Return first 3 available windows of requested duration
```

### CRM Service Extension
```javascript
// services/crm/index.js — new functions
async function checkAvailability(roomType, checkin, checkout) { ... }
async function fetchAlternativeDates(roomType, fromDate, nights = 2) { ... }
```

---

## Tasks

- [ ] T1: `services/crm/index.js` — adicionar `checkAvailability()` e `fetchAlternativeDates()`
- [ ] T2: `handleCotar()` no webhook — integrar consulta de disponibilidade antes de calcular cotação
- [ ] T3: Lógica de datas alternativas: buscar próximas 3 janelas livres no calendário
- [ ] T4: Injeção de contexto de disponibilidade no prompt de Luna (como system message interna)
- [ ] T5: Fallback: timeout 3s → comportamento anterior sem bloqueio
- [ ] T6: Atualizar system prompt de Luna para instruí-la a usar dados de disponibilidade quando fornecidos
- [ ] T7: Testes: available=true, available=false com alternativas, CRM timeout/fallback

---

## Quality Gate — @architect

- [ ] QG-01: Timeout de 3s na chamada CRM garantido — nunca bloqueia resposta ao hóspede
- [ ] QG-02: Contexto de disponibilidade injetado como `role: 'system'` — nunca aparece no chat do hóspede
- [ ] QG-03: `services/crm/index.js` é o único ponto de chamada — webhook não conhece URLs do CRM diretamente
- [ ] QG-04: Resposta completa ao hóspede (incluindo disponibilidade) entregue dentro de 5s (SLA Meta)

---

## File List

- `services/crm/index.js` — modificado (novas funções de disponibilidade)
- `services/whatsapp/webhook.js` — modificado (handleCotar com availability check)
- `services/luna/system-prompt.js` — modificado (instruções para usar contexto de disponibilidade)
- `tests/availability-integration.test.js` — novo

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
