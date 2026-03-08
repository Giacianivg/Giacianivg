# Story PLU-01.3: Conversation State Manager — Persistência & Controle de Funil

**Status:** InReview
**Epic:** PLU-01 — Sales Funnel Automation
**Points:** 8
**Created:** 2026-03-08

---

## 📖 Description

Implementar um **Conversation State Manager** para controlar o estado da conversa por telefone e evitar que Luna repita perguntas, mantendo o fluxo de reserva linear e determinístico.

**Problema atual:**
- Bot não mantém estado entre mensagens
- Cada mensagem depende apenas do texto atual
- Claude precisa deduzir contexto sempre → fluxo instável
- Perguntas repetidas frustra o hóspede

**Objetivo:**
- Persistir estado por telefone em Supabase
- Transições determinísticas entre 7 estados
- Contexto injetado em Claude (sabe qual etapa do funil estamos)
- Fallback automático para humano quando necessário

---

## ✅ Acceptance Criteria

### Estado Salvo por Telefone
- [x] Criar tabela `conversation_states` em Supabase com campos:
  - `lead_id` (PK, UUID)
  - `phone` (string, unique + indexed)
  - `state` (enum: GREETING | ASK_DATES | ASK_GUESTS | SHOW_ROOMS | SEND_QUOTE | CONFIRM_BOOKING | HANDOFF_HUMAN)
  - `data` (jsonb): `{ nome?, data_entrada?, data_saida?, pessoas?, tipo_quarto?, quote? }`
  - `metadata` (jsonb): `{ attempts?, last_question_ts?, escalation_reason? }`
  - `created_at`, `updated_at`, `expires_at` (24h TTL)
- [x] Índices: `phone`, `created_at`
- [x] RLS policy: Apenas serviço pode ler/escrever

### Contexto Persistido
- [x] Carregar estado ao processar mensagem em webhook
- [x] Claude recebe injeção: "Estado atual: ASK_DATES. Coletados: {nome, ...}"
- [x] Histórico de conversa + estado = contexto completo
- [x] Quando estado = CONFIRM_BOOKING → pede só confirmação (não repete datas)

### Transição Entre Estados
- [x] Criar classe `ConversationStateMachine` com:
  - `async load(phone)` — carrega do DB
  - `async transition(nextState)` — valida + persiste
  - `async updateContext(data)` — merge com dados coletados
  - `getPromptInjection()` — retorna contexto p/ Claude
  - Validações: GREETING → ASK_DATES → ... → HANDOFF_HUMAN
- [x] Estados permitidos (outros bloqueados):
  - GREETING → [ASK_DATES]
  - ASK_DATES → [ASK_GUESTS, HANDOFF_HUMAN]
  - ASK_GUESTS → [SHOW_ROOMS, ASK_DATES, HANDOFF_HUMAN]
  - SHOW_ROOMS → [SEND_QUOTE, ASK_GUESTS, HANDOFF_HUMAN]
  - SEND_QUOTE → [CONFIRM_BOOKING, ASK_GUESTS, HANDOFF_HUMAN]
  - CONFIRM_BOOKING → [HANDOFF_HUMAN]
  - HANDOFF_HUMAN → [] (terminal)
- [x] Sinais de Luna parseados → transição automática:
  - [COTAR: ...] → SEND_QUOTE
  - [CONFIRMAR: ...] → HANDOFF_HUMAN
  - [ESCALAR: ...] → HANDOFF_HUMAN

### Fallback para Humano
- [x] Se usuário pedir escalação em qualquer estado → HANDOFF_HUMAN
- [x] Se `attempts >= 3` na mesma pergunta → HANDOFF_HUMAN (com aviso ao usuário)
- [x] Estado HANDOFF_HUMAN marca `expires_at = now + 48h` (janela para equipe responder)
- [x] Se estado expirou → pode voltar a GREETING

---

## 🎯 Scope

### In Scope
- ✅ Supabase schema + migration
- ✅ `ConversationStateMachine` class
- ✅ Integração com webhook.js (carrega state, injeta contexto, valida transição)
- ✅ Testes unitários para máquina de estados
- ✅ Testes de integração (webhook → DB → Claude → transição)

### Out of Scope
- ❌ UI para visualizar states (pode ser PLU-06+)
- ❌ Admin endpoint para forçar state change (segurança primeiro)
- ❌ Analytics/metrics sobre estados (PLU-06+)

---

## 📦 File List

| File | Type | Status |
|------|------|--------|
| `database/migrations/001_create_conversation_states.sql` | New | DONE |
| `services/state-machine/index.js` | New | DONE |
| `services/whatsapp/webhook.js` | Edit | DONE (FSM integrated) |
| `tests/state-machine.test.js` | New | DONE (90/90 tests passing) |
| `docs/architecture/conversation-state-machine.md` | New | DONE |
| `docs/database/conversation-states-schema.md` | New | DONE |
| `.eslintrc.json` | Edit | DONE (ES2022 support) |
| `package.json` | Edit | DONE (test runner updated) |

---

## 📋 Subtasks / Dev Notes

### Phase 1: Database Schema (0.5h)
```sql
-- Create conversation_states table
CREATE TABLE conversation_states (
  lead_id UUID PRIMARY KEY REFERENCES leads(id),
  phone VARCHAR(20) UNIQUE NOT NULL,
  state TEXT CHECK (state IN ('GREETING', 'ASK_DATES', ...)),
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_conversation_states_phone ON conversation_states(phone);
CREATE INDEX idx_conversation_states_created_at ON conversation_states(created_at);

-- RLS: Only internal service (webhook) can read/write
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal_service_only" ON conversation_states
  USING (current_setting('x-internal-key') = '[INTERNAL_API_KEY]');
```

### Phase 2: State Machine Class (1.5h)
```javascript
// services/state-machine/index.js
class ConversationStateMachine {
  // Constructor + load/save methods
  // transition() with validation
  // updateContext() to collect data
  // getPromptInjection() for Claude
}

module.exports = ConversationStateMachine;
```

### Phase 3: Webhook Integration (1h)
```javascript
// services/whatsapp/webhook.js — POST /webhook handler
const fsm = new ConversationStateMachine(leadId, phone);
await fsm.load();

const prompt = fsm.getPromptInjection();
const response = await callClaude(messages, prompt);
const signals = parseSignals(response);

// Auto-transition based on signals
await fsm.transition(nextState);
```

### Phase 4: Tests (2h)
- Unit: State transitions, validation
- Integration: Webhook → DB → Claude → transição

### Phase 5: Documentation (1h)
- Architecture doc: states, transitions, context injection
- API doc: ConversationStateMachine interface

---

## 🔗 Dependencies

**Prerequisite Stories:**
- ✅ PLU-01.1 — WhatsApp webhook (already done)
- ✅ PLU-01.2 — Claude integration base (already done)
- ✅ Google Sheets setup (optional — can use Supabase only)

**External Dependencies:**
- Supabase (already configured)
- Claude API (already configured)
- Node.js modules: none new (use existing)

**Blocks:**
- None — can start immediately

---

## 🎨 Architecture Notes

### Prompt Injection Example
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION STATE CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estado atual: ASK_GUESTS
Etapa do funil: 2/7 (Coletando informações)

Já coletado:
  • Nome: João Silva
  • Data entrada: 15/03/2026 (sexta)
  • Data saída: 17/03/2026 (domingo)

Próximo passo:
  → Número de hóspedes (máx 8 pessoas por quarto)

NÃO REPITA perguntas sobre: nome, datas
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

### State Diagram
```
[GREETING]
    ↓ (user message)
[ASK_DATES] ← collect entrada/saída
    ↓ (dates provided)
[ASK_GUESTS] ← collect people count
    ↓ (people provided)
[SHOW_ROOMS] ← validate room type
    ↓ (room chosen)
[SEND_QUOTE] ← calculate price
    ↓ [COTAR signal OR accept)
[CONFIRM_BOOKING] ← pedir confirmação final
    ↓ ([CONFIRMAR signal OR escalate)
[HANDOFF_HUMAN] ← equipe toma conta
    ↓ (TTL 48h)
[RESTART] ou [EXPIRED]
```

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
describe('ConversationStateMachine', () => {
  test('Load from empty — GREETING state', () => {});
  test('Transition GREETING → ASK_DATES', () => {});
  test('Block invalid transition', () => {});
  test('Update context — merge data', () => {});
  test('getPromptInjection — format correct', () => {});
  test('TTL expiration — returns EXPIRED', () => {});
});
```

### Integration Tests
```javascript
describe('Webhook + State Machine', () => {
  test('Mensagem 1 (nome) → ASK_DATES', () => {});
  test('Mensagem 2 (datas) → ASK_GUESTS', () => {});
  test('Claude [COTAR] signal → SEND_QUOTE', () => {});
  test('Claude [CONFIRMAR] signal → HANDOFF_HUMAN', () => {});
  test('Escalation attempts > 3 → HANDOFF_HUMAN', () => {});
});
```

---

## 🚀 Acceptance Criteria - Definition of Done

- [x] Database schema created + RLS configured
- [x] `ConversationStateMachine` class fully tested
- [x] Webhook integração 100% (carrega state, injeta, transiciona)
- [x] All unit tests passing (`npm test`) — 90/90 tests passing
- [x] All lint checks passing (`npm run lint`) — 0 errors, 6 warnings (pre-existing)
- [x] Type checking passing (`npm run typecheck`) — N/A (JavaScript project)
- [x] Integration tests (automated in test suite)
- [x] Architecture doc atualizado
- [x] No regressions em features existentes (WhatsApp relay, escalation, quotation)

---

## 📊 Business Value

| Métrica | Impacto |
|---------|---------|
| Repetição de perguntas | ↓ 95% (state controls flow) |
| Taxa conclusão reservas | ↑ 20% (linear flow, menos confusão) |
| Escalações prejudiciais | ↓ 30% (fallback automático em 3 tentativas) |
| Qualidade conversa | ↑ (contexto sempre presente) |

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| State corruption | RLS + atomic updates (Supabase transactions) |
| Timezone issues (TTL) | Always use UTC, client timezone for display only |
| Cold start (state loss) | 2h RAM cache for web failures + 24h DB TTL |
| Claude loops (infinite state) | Max 3 attempts per question → HANDOFF_HUMAN |

---

## 📚 Related Docs

- [Conversation State Machine Architecture](../architecture/conversation-state-machine.md) — Design details
- [PLU-01 Epic](../epics/PLU-01-sales-funnel.md) — Parent epic
- [CLAUDE.md](../../CLAUDE.md) — Project conventions

---

## 🔄 Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-03-08 | River | Story created — Draft |
| 2026-03-08 | Pax | Validated 10/10 — Status Draft→Ready |
| 2026-03-08 | Dex | Implementation complete — All 4 phases + 90/90 tests passing |

---

**Next Step:** @qa to review implementation and run QA gate
