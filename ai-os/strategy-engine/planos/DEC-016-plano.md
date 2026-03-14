# DEC-016 — Plano de Execução
## AI-OS v2: Task Queue + Observabilidade + Memória Semântica

**DEC:** DEC-016
**Score:** 82.2 — Aprovado pelo Board em 2026-03-12
**Execução:** após Páscoa (2026-04-07+)
**Executor:** @dev (Dex)
**Supervisor:** @cto-agent (Aria) — veto técnico ativo

---

## Sequência Obrigatória

```
FASE 1 (Task Queue)
  → 179/179 ✅
  → story PLU-13 Done
  → Founder aprova FASE 2
FASE 2 (Observabilidade)
  → 179/179 ✅
  → story PLU-14 Done
  → Founder aprova FASE 3
FASE 3 (pgvector)
  → 179/179 ✅
  → story PLU-15 Done
  → Deploy @devops
```

---

## FASE 1 — Task Queue com Redis/Upstash

**Story:** PLU-13 (a criar — @pm)
**Complexidade:** Baixa | **Estimativa:** 2 dias @dev
**Custo:** R$0 (Upstash free: 10k requests/day, 256MB)

### Arquitetura

```
Eva (@secretary)
  → cria task { id, squad, context, priority }
  → RPUSH tasks:queue JSON
  → TTL: 24h (tarefas não se perdem entre sessões)

Squad Executor
  → BLPOP tasks:queue (blocking pop)
  → executa task
  → HSET tasks:results:{id} { status, output, duration }

Orion (@aios-master)
  → consulta tasks:results para contexto
  → Ray verifica execution_results no Redis
```

### Arquivos a criar (SEGUROS — sem tocar arquivos críticos)

```
services/ai-os/task-queue.js        ← cliente Redis/Upstash
services/ai-os/task-producer.js     ← Eva cria tasks
services/ai-os/task-consumer.js     ← squad consome tasks
routes/ai-activity.js               ← JÁ EXISTE — adicionar endpoints de task queue
```

### Variáveis de ambiente a adicionar

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Critérios de Aceite

- [ ] Eva consegue criar task e persiste no Redis
- [ ] Squad consegue consumir task da fila
- [ ] Task não se perde se sessão encerrar
- [ ] Resultado acessível por ID
- [ ] 179/179 testes passando

---

## FASE 2 — Observabilidade (dashboard.html)

**Story:** PLU-14 (a criar — @pm)
**Complexidade:** Média | **Estimativa:** 3 dias @dev
**Custo:** R$0 (usa dashboard.html existente)
**Pré-requisito:** FASE 1 concluída

### Widgets a adicionar em `public/dashboard.html`

```
┌─────────────────────────────────────────┐
│ AI-OS Monitor                           │
├───────────┬────────────┬────────────────┤
│ Tasks     │ Aprovadas  │ Rejeitadas     │
│ Rodadas   │ LGTM       │ REPROVAR       │
│ hoje: N   │ N          │ N              │
├───────────┴────────────┴────────────────┤
│ Tempo médio por agente (bar chart)      │
│ Dex: 45s | Gage: 12s | Morgan: 30s      │
├─────────────────────────────────────────┤
│ Tokens por squad (esta semana)          │
│ Eng: 12k | Ops: 8k | Mkt: 6k           │
├─────────────────────────────────────────┤
│ Impacto em receita (tasks concluídas)   │
│ R$ estimado atribuído por squad         │
└─────────────────────────────────────────┘
```

### Arquivos a modificar/criar

```
routes/ai-activity.js           ← JÁ EXISTE — adicionar /metrics endpoint
public/dashboard.html           ← adicionar seção AI-OS Monitor (N2 NECESSÁRIO — tocar arquivo existente)
services/ai-os/metrics.js       ← NOVO — coleta e agrega métricas
```

> ⚠️ **N2 NECESSÁRIO** para modificar `public/dashboard.html`
> Confirmar com Vitor antes de iniciar FASE 2.

### Critérios de Aceite

- [ ] Dashboard exibe tasks rodadas hoje
- [ ] Métricas de aprovação/rejeição por Ray visíveis
- [ ] Tempo de execução por agente (últimas 24h)
- [ ] Tokens gastos por squad (últimos 7 dias)
- [ ] 179/179 testes passando

---

## FASE 3 — Memória Semântica com pgvector

**Story:** PLU-15 (a criar — @pm)
**Complexidade:** Média | **Estimativa:** 4 dias @dev
**Custo:** R$0 (pgvector incluso no Supabase)
**Pré-requisito:** FASE 2 concluída

### Migration necessária

```sql
-- database/migrations/013_pgvector_semantic_memory.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE conversation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message_text TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI/Anthropic embeddings
  role TEXT NOT NULL,       -- 'guest' | 'luna'
  metadata JSONB,           -- { campaign, room_type, converted, stay_length }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON conversation_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Queries Luna vai poder responder:
-- "Qual campanha trouxe hóspedes que ficaram mais noites?"
-- "Hóspedes que perguntam sobre pets têm maior chance de converter?"
-- "Qual mensagem de follow-up teve maior taxa de resposta?"
```

### Serviços a criar

```
services/ai-os/semantic-memory.js   ← NOVO
  → embedConversation(phone, messages[]) → upsert embeddings
  → similarConversations(query, k=5) → matches semânticos
  → patternInsights(question) → análise por campanha/tipo

services/luna/memory-context.js     ← NOVO
  → getLunaContext(phone) → últimas 5 conversas similares
  → injetado no system-prompt dinâmicamente
```

> ⚠️ **NÃO MODIFICAR** `services/whatsapp/webhook.js` diretamente.
> Luna recebe contexto via injeção no system-prompt (N2 para qualquer mudança no webhook).

### Casos de Uso Liberados após FASE 3

```
Founder pergunta ao @cmo-agent:
"Qual campanha trouxe hóspedes que ficaram mais noites?"
→ Query semântica no pgvector → resposta em segundos

Luna recebe hóspede que perguntas sobre ALA_C:
→ semantic-memory busca conversas similares anteriores
→ identifica padrão: "ALA_C + família = 80% converte em 3 mensagens"
→ ajusta tom de resposta automaticamente

@cfo-agent analisa sazonalidade:
→ query: embeddings de conversas de julho vs dezembro
→ identifica: "julho = hóspedes perguntam sobre pets 3x mais"
→ recomenda: adicionar pet-friendly na campanha julho
```

### Critérios de Aceite

- [ ] Extension pgvector habilitada no Supabase
- [ ] Migration 013 aplicada sem conflito
- [ ] Embeddings de conversas gravados após cada chat
- [ ] Query semântica retorna resultados relevantes
- [ ] Luna usa contexto semântico (injeção no prompt, não no webhook)
- [ ] 179/179 testes passando

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Upstash free tier limitado (10k req/day) | Baixa | TTL nas tasks + flush diário |
| pgvector extension não habilitada no tier | Baixa | Supabase habilita por padrão |
| Custo de embeddings (API Anthropic) | Média | Usar embeddings locais (sentence-transformers) ou batching |
| Webhook performance com busca semântica | Média | Luna busca semântica ASYNC, não no crítico path dos 5s |

---

## Checklist Pré-Execução por Fase

```
ANTES DE INICIAR CADA FASE:
[ ] 179/179 npm test passando
[ ] Fase anterior Done (story marcada)
[ ] Vitor confirmou "executar fase N"
[ ] Story criada por @pm com AC completo
[ ] @cto-agent revisou arquitetura
```

---

*Gerado por Orion (@aios-master) | DEC-016 | 2026-03-12*
*Próximo passo: Vitor confirma → @pm cria PLU-13 → aguardar pós-Páscoa*
