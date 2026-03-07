# PLU-07.1: Luna → Supabase — Persistência de Leads e Conversas

**Status:** Draft
**Epic:** EPIC-PLU-07 — Integração Luna ↔ CRM
**Points:** 5
**Priority:** Critica
**Executor:** @dev
**Quality Gate:** @architect
**Depends on:** PLU-06.2

---

## User Story

**Como** sistema Luna (webhook),
**quero** persistir automaticamente cada conversa e cada lead no Supabase,
**para** substituir o Google Sheets como fonte de verdade e permitir que o CRM tenha dados em tempo real.

---

## Acceptance Criteria

- [ ] AC-01: A cada mensagem recebida do hóspede, `POST /api/leads/upsert` é chamado — retorna `lead_id`
- [ ] AC-02: A cada mensagem (hóspede + Luna), `POST /api/conversations` é chamado com `lead_id`, `role`, `content`, `message_id`
- [ ] AC-03: `message_id` da Meta API usado como chave de idempotência em `conversations` — retry não duplica
- [ ] AC-04: Google Sheets continua sendo escrito em paralelo durante período de transição (feature flag `SHEETS_ENABLED=true`)
- [ ] AC-05: Falha na chamada ao CRM não bloqueia resposta ao hóspede — ambos são fire-and-forget assíncronos
- [ ] AC-06: `lead.name` atualizado quando Luna captura nome via [NOME: X]
- [ ] AC-07: `lead.status` atualizado para `'quoted'` quando Luna emite [COTAR], `'negotiating'` quando [CONFIRMAR]

---

## Technical Notes

### Webhook Integration Points
```javascript
// services/whatsapp/webhook.js — additions

// After parsing incoming message:
const leadId = await upsertLead(from, contactName);  // fire-and-forget safe

// After Claude response:
await Promise.allSettled([
  recordConversation(leadId, 'user',      userMessage, messageId),
  recordConversation(leadId, 'assistant', lunaResponse, null),
  sheets.appendHistory(from, contactName, userMessage, lunaResponse),  // if SHEETS_ENABLED
]);
```

### Lead Status Transitions
```
new → active    (first message)
active → quoted  ([COTAR] emitted)
quoted → negotiating ([CONFIRMAR] emitted)
negotiating → reserved  (PLU-07.3 — reservation created)
```

### CRM Service Layer
```javascript
// services/crm/index.js — thin wrapper over API calls
async function upsertLead(whatsapp, name) { ... }
async function recordConversation(leadId, role, content, messageId) { ... }
async function updateLeadStatus(leadId, status) { ... }
```

### Feature Flag
```
SHEETS_ENABLED=true   # write to Sheets (default during transition)
SHEETS_ENABLED=false  # Supabase only (after PLU-06.6 migration validated)
```

---

## Tasks

- [ ] T1: `services/crm/index.js` — módulo CRM com `upsertLead`, `recordConversation`, `updateLeadStatus`
- [ ] T2: Integrar `upsertLead` no fluxo de entrada do webhook (após parse da mensagem)
- [ ] T3: Integrar `recordConversation` para mensagens user e assistant após resposta Claude
- [ ] T4: Implementar feature flag `SHEETS_ENABLED` para escrita paralela ao Sheets
- [ ] T5: Atualizar `lead.status` nos pontos [COTAR] e [CONFIRMAR]
- [ ] T6: Atualizar `lead.name` quando [NOME: X] é detectado
- [ ] T7: Testes: verificar que falha CRM não afeta resposta ao hóspede
- [ ] T8: Adicionar `SHEETS_ENABLED` ao `.env.example`

---

## Quality Gate — @architect

- [ ] QG-01: Todas as chamadas CRM são `fire-and-forget` — nenhuma dentro do caminho crítico de resposta (antes do `sendWhatsApp`)
- [ ] QG-02: `services/crm/index.js` é a única camada que conhece as URLs da API CRM — sem chamadas diretas espalhadas no webhook
- [ ] QG-03: Feature flag `SHEETS_ENABLED` permite rollback instantâneo para Sheets sem deploy
- [ ] QG-04: Latência do webhook não aumenta com a integração CRM (medida em testes de carga)

---

## File List

- `services/crm/index.js` — novo
- `services/whatsapp/webhook.js` — modificado (integração CRM)
- `.env.example` — modificado (`SHEETS_ENABLED`, `CRM_API_URL`)

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
