# Conversation State Machine Architecture — PLU-01.3

**Author:** Aria (Architect)
**Date:** 2026-03-08
**Status:** Design Document
**Complexity:** Medium
**Risk Level:** Low (isolated feature, no breaking changes)

---

## 1. Problem Statement

**Current Issue:**
- Luna doesn't persist conversation state across messages
- Each message processed independently → Claude lacks context
- Results in:
  - ❌ Repeated questions (frustrates users)
  - ❌ Non-linear conversation flow
  - ❌ Unstable reservation funnel
  - ❌ High escalation rate

**Target State:**
- ✅ State persisted per phone number
- ✅ Linear flow through 7-state funnel
- ✅ Context injected into Claude prompts
- ✅ Automatic fallback to human at boundaries

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      WhatsApp (Meta)                           │
│                    (incoming messages)                         │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ↓ POST /webhook
┌────────────────────────────────────────────────────────────────┐
│              services/whatsapp/webhook.js                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Parse message                                         │  │
│  │ 2. Dedup (processedIds map)                             │  │
│  │ 3. Load ConversationStateMachine                        │  │
│  │ 4. Get prompt injection (state context)                │  │
│  │ 5. Call Claude with context + history                 │  │
│  │ 6. Parse signals ([COTAR], [CONFIRMAR], [ESCALAR])    │  │
│  │ 7. Transition state                                    │  │
│  │ 8. Send response to user                               │  │
│  │ 9. Record conversation (async)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────┬───────┘
       │                                                  │
       ↓                                                  ↓
┌────────────────────────┐  ┌──────────────────────────────────┐
│ Supabase (DB)          │  │ Claude API                       │
│ ─────────────────────  │  │ ──────────────────────────────── │
│ conversation_states    │  │ Model: haiku-4-5-20251001      │
│  • lead_id (PK)       │  │ max_tokens: 600                 │
│  • phone              │  │ system: prompt_injection + rules │
│  • state (enum)       │  │ messages: history + current      │
│  • data (jsonb)       │  │                                  │
│  • metadata (jsonb)   │  │ Response: text + signals        │
│  • TTL (24h)          │  │                                  │
└────────────────────────┘  └──────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 ConversationStateMachine Class

**Location:** `services/state-machine/index.js`

**Responsibilities:**
- Load state from Supabase by phone
- Validate state transitions
- Update collected context data
- Generate prompt injection for Claude
- Persist state changes

**Public Interface:**
```javascript
class ConversationStateMachine {
  // Constructor
  constructor(lead_id, phone, supabaseClient)

  // Core methods
  async load()                           // Load from DB, init if new
  async transition(nextState)            // Validate + persist
  async updateContext(dataChanges)       // Merge into state.data
  getPromptInjection()                   // Format for Claude
  async expire(reason)                   // Mark as expired

  // Getters
  get currentState()
  get collectedData()
  get metadata()
  get isExpired()
  get isTerminal()
}
```

**Internal State Structure:**
```javascript
{
  lead_id: UUID,
  phone: '5519987654321',
  state: 'ASK_DATES',                    // Current state
  data: {
    // Fields collected so far (progressively filled)
    nome: 'João Silva',
    data_entrada: '15/03/2026',
    data_saida: '17/03/2026',
    pessoas: 2,
    tipo_quarto: null,                   // Not yet collected
    quote: null,
  },
  metadata: {
    attempts_asking_dates: 2,             // Track repetition
    last_question_ts: 1709906400000,
    escalation_reason: null,
    attempts_total: 8,
  },
  created_at: 1709900000000,
  updated_at: 1709906400000,
  expires_at: 1709986800000,             // now + 24h
}
```

### 3.2 State Transition Graph

**States (7 total):**
```
GREETING (initial)
  ↓ Only if user responds
ASK_DATES
  ↓ After dates provided OR if asks for escalation
ASK_GUESTS
  ↓ After guest count provided
SHOW_ROOMS
  ↓ After room type validated
SEND_QUOTE
  ↓ After quote calculated & sent
CONFIRM_BOOKING
  ↓ After user confirms interest
HANDOFF_HUMAN (terminal)
  ↓ Team takes over (TTL = 48h)
```

**Transition Rules:**
```javascript
TRANSITIONS = {
  GREETING: ['ASK_DATES'],
  ASK_DATES: ['ASK_GUESTS', 'HANDOFF_HUMAN'],
  ASK_GUESTS: ['SHOW_ROOMS', 'ASK_DATES'],  // Can go back
  SHOW_ROOMS: ['SEND_QUOTE', 'ASK_GUESTS'],
  SEND_QUOTE: ['CONFIRM_BOOKING', 'ASK_GUESTS'],
  CONFIRM_BOOKING: ['HANDOFF_HUMAN'],
  HANDOFF_HUMAN: [],                         // Terminal
}
```

**Invalid Transition Handling:**
```javascript
// Example: User says "I want a quote" while in ASK_DATES
// → Invalid transition blocked
// → Claude prompted to stay in ASK_DATES ("Preciso das datas primeiro...")
```

### 3.3 Signal Parsing & Auto-Transition

**Signals from Claude (extracted from response text):**

```
[COTAR: tipo=ALA_A, data_entrada=15/03/2026, data_saida=17/03/2026, pessoas=2]
  → transition('SEND_QUOTE')
  → updateContext({ tipo_quarto, data_entrada, data_saida, pessoas })

[CONFIRMAR: nome=João Silva, entrada=15/03/2026, saida=17/03/2026, tipo=ALA_A, pessoas=2, total=1200]
  → transition('HANDOFF_HUMAN')
  → createProposal(details)

[ESCALAR: motivo=Grupo > 8 pessoas]
  → transition('HANDOFF_HUMAN')
  → notifyTeam()

[NOME: João Silva]
  → updateContext({ nome: 'João Silva' })
  → stay in current state (don't transition)
```

### 3.4 Prompt Injection Mechanism

**Injected into Claude system prompt:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION STATE CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data: 08/03/2026, sábado 14:30
Telefone: 5519987654321
Estado: ASK_DATES (etapa 2/7)

✅ Já coletado:
  • Nome: João Silva

⏳ Aguardando:
  • Data entrada: (required)
  • Data saída: (required)

❌ NÃO REPITA essas perguntas — já respondidas
❌ NÃO PERGUNTE sobre datas se já foram fornecidas
✅ Use estado para guiar conversação linearmente
✅ Se usuário insistir em voltar, explique fluxo natural
✅ Em 3 tentativas sem resposta → [ESCALAR: motivo=Não respondeu datas]

Próximo passo: Confirmar check-in e check-out
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. Data Flow — Message to Response

### Step-by-Step Flow

```
1. MESSAGE ARRIVES
   ├─ from: '5519987654321'
   ├─ text: 'Quero reservar para 15 a 17 de março'
   └─ timestamp: 1709906400

2. WEBHOOK HANDLER (services/whatsapp/webhook.js)
   ├─ Dedup check: isDuplicate(messageId)?
   ├─ Load lead: getClientProfile(phone)
   ├─ Create/load FSM: new ConversationStateMachine(lead_id, phone)
   ├─ State: 'ASK_DATES' (current)
   └─ Collected data: { nome: 'João Silva' }

3. CONTEXT BUILDING
   ├─ getPromptInjection() → formatted string
   ├─ Append to system prompt (after LUNA_SYSTEM_PROMPT)
   └─ Result: system = context + rules + Luna identity

4. CLAUDE CALL
   ├─ messages: [{role: 'user', content: text}] + history
   ├─ system: prompt with context
   ├─ model: claude-haiku-4-5-20251001
   └─ response: "Ótimo! Então você quer ficar de 15 a 17 de março...
                Quantas pessoas vão? [waiting for response]"

5. SIGNAL PARSING
   ├─ Extract [COTAR], [CONFIRMAR], [ESCALAR], [NOME]
   ├─ Parse parameters
   └─ No signals in this response

6. STATE TRANSITION
   ├─ Valid transitions: ['ASK_GUESTS', 'HANDOFF_HUMAN']
   ├─ No signal → stay in ASK_DATES
   ├─ updateContext({ data_entrada: '15/03/2026', data_saida: '17/03/2026' })
   ├─ Call transition('ASK_DATES') — no-op (already there)
   └─ Persist to DB

7. RESPONSE SENT
   ├─ sendWhatsApp(from, response)
   └─ User sees: "Ótimo! Então você quer ficar..."

8. ASYNC RECORDING
   ├─ appendMessage(phone, 'user', text)
   ├─ appendMessage(phone, 'assistant', response)
   └─ recordEvent(phone, 'state_update', { state, data })
```

---

## 5. Database Schema

### Table: `conversation_states`

```sql
CREATE TABLE conversation_states (
  -- Primary Key
  lead_id UUID PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,

  -- State Identification
  phone VARCHAR(20) NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'GREETING'
    CHECK (state IN ('GREETING', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS',
                     'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN')),

  -- Context Data (progressively collected)
  data JSONB NOT NULL DEFAULT '{}',
    -- Contains: { nome, data_entrada, data_saida, pessoas, tipo_quarto, quote, ... }

  -- Metadata for Control
  metadata JSONB NOT NULL DEFAULT '{}',
    -- Contains: { attempts_*, last_question_ts, escalation_reason, ... }

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Constraint: expiry must be in future
  CONSTRAINT expires_in_future CHECK (expires_at > NOW())
);

-- Indexes for queries
CREATE INDEX idx_conversation_states_phone ON conversation_states(phone);
CREATE INDEX idx_conversation_states_state ON conversation_states(state);
CREATE INDEX idx_conversation_states_created ON conversation_states(created_at DESC);
CREATE INDEX idx_conversation_states_expires ON conversation_states(expires_at);

-- RLS: Only internal service (webhook) can access
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal_only" ON conversation_states
  USING (auth.jwt_matches_claim('role', 'service'));
```

---

## 6. Integration Points

### 6.1 Webhook Integration

**File:** `services/whatsapp/webhook.js` — POST /webhook handler

**Changes:**
```javascript
// BEFORE:
const messages = await getConversationHistory(from);  // Last 10 from DB
const response = await callClaude(messages);

// AFTER:
const fsm = new ConversationStateMachine(leadId, from, supabaseClient);
await fsm.load();

const contextInjection = fsm.getPromptInjection();
const response = await callClaude(messages, `${contextInjection}\n\n${LUNA_SYSTEM_PROMPT}`);

const signals = parseSignals(response);
if (signals.COTAR) {
  await fsm.updateContext({ tipo_quarto: signals.COTAR.tipo, ... });
  await fsm.transition('SEND_QUOTE');
}
```

### 6.2 Proposal/Reservation Creation

**File:** `api/reservations/confirm/route.js`

**Integration:**
```javascript
// When user confirms booking
const fsm = new ConversationStateMachine(leadId, phone, supabaseClient);
await fsm.load();

if (fsm.currentState !== 'CONFIRM_BOOKING') {
  throw new Error('Invalid state for booking confirmation');
}

// Create reservation from collected data
const reservation = await createReservation({
  lead_id: leadId,
  check_in: fsm.collectedData.data_entrada,
  check_out: fsm.collectedData.data_saida,
  room_type: fsm.collectedData.tipo_quarto,
  guests: fsm.collectedData.pessoas,
  quote_id: fsm.collectedData.quote.id,
});

// Move to HANDOFF_HUMAN
await fsm.transition('HANDOFF_HUMAN');
```

### 6.3 Expiry & Cleanup

**Background job (can be cron-based):**
```javascript
// Every 6 hours
async function cleanupExpiredStates() {
  const expired = await supabaseClient
    .from('conversation_states')
    .select('*')
    .lt('expires_at', 'now()');

  for (const record of expired.data) {
    // Archive to history table (optional)
    // Delete from active states
    await supabaseClient
      .from('conversation_states')
      .delete()
      .eq('lead_id', record.lead_id);
  }
}
```

---

## 7. Error Handling & Edge Cases

### 7.1 Invalid Transitions

```javascript
// User says "I want a quote" while in GREETING
// Claude should NOT generate [COTAR] signal in GREETING state
// If it does, webhook blocks the transition:

await fsm.transition('SEND_QUOTE');
// → Throws: InvalidTransition("GREETING → SEND_QUOTE not allowed")
// → Catch: Re-prompt with "Antes preciso saber suas datas..."
```

### 7.2 Repeated Attempts

```javascript
// After 3 failed attempts to answer a question:
metadata.attempts_asking_dates === 3
  → Automatically: updateContext({ escalation_reason: 'Não forneceu datas após 3 tentativas' })
  → Call: fsm.transition('HANDOFF_HUMAN')
  → Send: "Vou conectar você com nossa equipe..."
```

### 7.3 State Expiry

```javascript
// User inactive > 24h
fsm.isExpired === true
  → Show option: "Quer começar nova reserva?" or "Continuar anterior?"
  → If new: transition('GREETING')
  → If continue: reload expired state
```

---

## 8. Performance & Scalability

| Metric | Target | Strategy |
|--------|--------|----------|
| State load latency | < 50ms | Index on phone (unique) |
| State update latency | < 100ms | Direct write, no joins |
| Memory per conversation | < 1KB | Minimal state, JSONB only |
| Concurrent conversations | 100+ | Supabase handles scaling |
| TTL cleanup | 6h interval | Background job or edge function |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```javascript
describe('ConversationStateMachine', () => {
  // State loading
  test('Load from empty → GREETING', () => {});
  test('Load from DB → correct state', () => {});

  // Transitions
  test('Valid transition → success', () => {});
  test('Invalid transition → error', () => {});
  test('Block backward transitions', () => {});

  // Context
  test('updateContext → merge data', () => {});
  test('getPromptInjection → correct format', () => {});

  // Expiry
  test('isExpired → true if past expires_at', () => {});
  test('Expired state resets to GREETING', () => {});
});
```

### 9.2 Integration Tests

```javascript
describe('Webhook + FSM Integration', () => {
  // Full flows
  test('Message 1 (nome) → ASK_DATES', () => {});
  test('Message 2 (datas) → ASK_GUESTS', () => {});
  test('[COTAR] signal → SEND_QUOTE', () => {});
  test('[CONFIRMAR] signal → HANDOFF_HUMAN', () => {});
  test('3 failed attempts → auto HANDOFF_HUMAN', () => {});
});
```

---

## 10. Deployment Checklist

- [ ] Schema migration created + tested locally
- [ ] ConversationStateMachine class deployed
- [ ] Webhook updated + tested with new FSM
- [ ] Prompt injection verified (Claude receives context)
- [ ] Signal parsing works for all 3 signals
- [ ] State transitions validated (no invalid jumps)
- [ ] Expiry cleanup job configured
- [ ] Monitoring: log state transitions + failures
- [ ] Rollback plan: can disable FSM and fall back to history-only

---

## 11. Future Enhancements (Out of Scope)

- Analytics: Dashboard of state flows + bottlenecks
- Admin: Force state reset for specific lead
- Retry logic: Resume interrupted flows
- Multi-language: State names + prompts

---

**Next Phase:** @dev implements following this architecture
**Review Cycle:** @qa validates against this design
**Sign-Off:** @architect reviews implementation alignment

— Aria 🏛️
