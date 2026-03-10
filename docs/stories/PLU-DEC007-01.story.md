# PLU-DEC007-01 — Blackboard Memory: Estado Compartilhado entre Agentes

**Epic:** EPIC-PLU-08 Dashboard de Operacoes e Metricas
**DEC:** DEC-007 — BLACKBOARD_MEMORY (Aprovado 2026-03-10)
**Status:** Ready
**Points:** 5
**Priority:** Alta
**Created:** 2026-03-10
**Author:** Orion (@aios-master)

---

## Description

Agentes operam no vacuo — sem contexto real do negocio. Event Bus emite eventos mas
ninguem persiste o estado. Command Center mostra atividade mas nao dados reais.

Esta story implementa o Blackboard: camada de estado compartilhado com backend Supabase,
integrada ao Event Bus existente, exposta via API REST para o Command Center consumir.

**Decisao arquitetural CTO:** Blackboard NAO e singleton in-memory.
Em Vercel serverless, singletons nao persistem entre invocacoes.
Solucao: Supabase como fonte de verdade + cache local de 60s + writes async.

---

## Acceptance Criteria

### AC-1: Migration 007 — Tabela blackboard_state
**Given** o dev roda a migration
**When** `database/migrations/007_blackboard_state.sql` e aplicada no Supabase
**Then** a tabela `blackboard_state` existe com colunas `key TEXT PK`, `value JSONB`, `updated_at TIMESTAMPTZ`
**And** as 4 chaves iniciais existem: `leads`, `reservas`, `financeiro`, `alertas`
**And** migrations 001-006 permanecem intactas

### AC-2: blackboard.js — Leitura com cache 60s
**Given** o sistema chama `await blackboard.get('leads')`
**When** o cache tem menos de 60 segundos
**Then** retorna o valor do cache sem ir ao Supabase
**When** o cache expirou (>60s) ou esta vazio
**Then** busca todas as chaves do Supabase, atualiza o cache, retorna o valor solicitado

### AC-3: blackboard.js — Escrita async (fire-and-forget)
**Given** o sistema chama `blackboard.set('leads', { total: 5, ... })`
**When** o metodo e invocado
**Then** atualiza o cache local imediatamente (sincrono)
**And** persiste no Supabase de forma async (sem await no caller)
**And** erros de escrita sao logados mas NAO propagados ao caller
**And** o tempo de execucao do caller nao e afetado

### AC-4: blackboard.js — getState() completo
**Given** o sistema chama `await blackboard.getState()`
**When** o metodo e invocado
**Then** retorna objeto com todas as chaves: `{ leads, reservas, financeiro, alertas }`
**And** usa cache quando disponivel (< 60s)

### AC-5: Event Bus — listener lead_received
**Given** o Event Bus emite `lead_received`
**When** o evento e processado
**Then** `blackboard.set('leads', { ...atual, total: +1, ativos: +1, ultimo_update: now })`
**And** a escrita e async (nao bloqueia o Event Bus)

### AC-6: Event Bus — listener booking_confirmed
**Given** o Event Bus emite `booking_confirmed`
**When** o evento e processado
**Then** `blackboard.set('reservas', { ...atual, hoje: +1, mes: +1 })`
**And** a escrita e async

### AC-7: Event Bus — listener message_received
**Given** o Event Bus emite `message_received`
**When** o evento e processado
**Then** `blackboard.set('leads', { ...atual, ultimo_update: now })`
**And** a escrita e async

### AC-8: API GET /api/blackboard/state
**Given** o client faz GET /api/blackboard/state com token valido
**When** a requisicao e processada
**Then** retorna `{ ok: true, state: { leads, reservas, financeiro, alertas }, ts: timestamp }`
**And** status HTTP 200
**When** Supabase falha
**Then** retorna `{ ok: false, error: "mensagem" }` com status 500
**And** nao expoe stack trace

### AC-9: server.js — rota montada
**Given** o servidor CRM inicia
**When** `server.js` carrega
**Then** a rota `/api/blackboard` esta montada e acessivel
**And** as demais rotas existentes continuam funcionando

### AC-10: Testes
**Given** a implementacao esta completa
**When** o dev roda `npm test`
**Then** 139/139 testes passam (zero regressoes)
**And** novos testes adicionados:
  - `blackboard.get() usa cache quando < 60s`
  - `blackboard.get() busca Supabase quando cache expirado`
  - `blackboard.set() atualiza cache imediato`
  - `blackboard.set() nao bloqueia (fire-and-forget)`
  - `GET /api/blackboard/state retorna estrutura correta`

---

## Scope

### IN
- `database/migrations/007_blackboard_state.sql` — nova tabela
- `system/blackboard.js` — implementacao completa com Supabase + cache
- `system/eventBus.js` — adicionar 3 listeners (lead, booking, message)
- `routes/blackboard.js` — endpoint GET /state
- `server.js` — montar rota /api/blackboard (aprovado no DEC-007)
- Testes unitarios para blackboard e rota

### OUT
- Nao integrar Command Center ao endpoint (DEC-008 — story futura)
- Nao popular retroativamente dados historicos (Blackboard parte do zero)
- Nao alterar logica existente do Event Bus — apenas adicionar listeners
- Nao tocar em `services/whatsapp/webhook.js` (exceto se CTO aprovar emit especifico)
- Nao alterar migrations 001-006

---

## Technical Notes

### Por que Supabase e nao in-memory

Vercel serverless: cada requisicao pode ser uma nova instancia Node.js.
Singleton in-memory vive apenas na instancia — dados perdidos entre requests.
Supabase persiste entre instancias, regioes e deploys.

### Estrutura de dados inicial

```js
// leads
{ total: 0, ativos: 0, score_medio: 0, ultimo_update: null }

// reservas
{ hoje: 0, semana: 0, mes: 0, ocupacao_pct: 0 }

// financeiro
{ mrr: 0, cac: 0, ticket_medio: 0 }

// alertas
[]
```

### Cache strategy

```
Request → cache < 60s? → retorna cache
                       → cache expirado → Supabase → atualiza cache → retorna
Write  → cache imediato (sync) + Supabase (async fire-and-forget)
```

### Supabase client

Usar `supabaseAdmin` (bypassa RLS) — importar de `services/supabase/client.js`.

### Integracao Event Bus

Adicionar ao final de `system/eventBus.js` (ou em arquivo de setup separado):

```js
const blackboard = require('./blackboard');

eventBus.on('lead_received', async (data) => { ... });
eventBus.on('booking_confirmed', async (data) => { ... });
eventBus.on('message_received', async () => { ... });
```

Todos os handlers devem ter try/catch — erro no listener nunca propaga ao Event Bus.

---

## Dependencies

- DEC-007 aprovado (2026-03-10)
- Supabase configurado e operacional (`services/supabase/client.js`)
- Event Bus ativo (`system/eventBus.js`)
- 139/139 testes passando no branch atual

---

## Risks

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Supabase indisponivel durante write | Baixo | Fire-and-forget com catch — sistema continua |
| Cache desatualizado (60s) | Baixo | Aceitavel para estado de negocio (nao e real-time critico) |
| Listener de evento lancar excecao | Medio | try/catch em todos os handlers do Event Bus |
| Migration 007 conflitar com schema | Baixo | IF NOT EXISTS na criacao da tabela |
| server.js com nova rota quebrar existentes | Baixo | Montar em path isolado /api/blackboard |

---

## Definition of Done

- [ ] Migration 007 aplicada no Supabase
- [ ] `system/blackboard.js` criado com cache + Supabase backend
- [ ] `blackboard.get()` usa cache corretamente
- [ ] `blackboard.set()` e fire-and-forget (nao bloqueia)
- [ ] 3 listeners adicionados ao Event Bus
- [ ] `routes/blackboard.js` criado
- [ ] `server.js` monta /api/blackboard
- [ ] GET /api/blackboard/state retorna estrutura correta
- [ ] 139/139 testes passando
- [ ] 5 novos testes adicionados

---

## File List

- `database/migrations/007_blackboard_state.sql` — criar
- `system/blackboard.js` — criar
- `system/eventBus.js` — modificar (adicionar listeners)
- `routes/blackboard.js` — criar
- `server.js` — modificar (montar rota)
- `tests/` — adicionar testes blackboard

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-10 | 1.0 | Story criada — escopo tecnico DEC-007 | Orion (@aios-master) |
