# QA Gate Review — Fase 7
## Pousada Luz da Lua — Brownfield Discovery

**Versão:** 1.0
**Data:** 2026-02-24
**Autor:** @qa — Brownfield Discovery Fase 7
**Revisando:**
- `docs/prd/technical-debt-DRAFT.md` v0.3 (consolidado Fases 1-6)
- `docs/architecture/system-architecture.md` (Fase 1)
- `docs/data/DB-AUDIT.md` + `docs/data/SCHEMA.md` (Fase 2)
- `docs/reviews/db-specialist-review.md` (Fase 5)
- `docs/reviews/ux-specialist-review.md` (Fase 6)
- `docs/architecture/claude-system-prompt.md` (atualizado 2026-02-24)
- `docs/stories/PLU-01.1.story.md`, `PLU-01.2.story.md`, `PLU-01.3.story.md`

---

## Veredicto do QA Gate

> **APROVADO COM CONDIÇÕES**

O assessment Brownfield está **substancialmente completo** e pronto para avançar para a Fase 8 (consolidação final). Foram identificados **2 novos débitos de segurança** não cobertos pelas fases anteriores. As condições de aprovação são claras e acionáveis antes do lançamento MVP.

| Critério Gate | Status | Nota |
|---------------|--------|------|
| Todos os débitos validados | ✅ | 26 débitos únicos documentados |
| Nenhum gap crítico não documentado | ⚠️ | 2 gaps de segurança novos (QA-01, QA-02) |
| Dependências entre débitos mapeadas | ✅ | Ordem de resolução clara |
| Critério de aceite MVP definido | ✅ | Seção 4 deste documento |
| Perguntas de especialistas respondidas | ✅ | 5/5 @data-engineer + 4/4 @ux-design-expert |
| Decisões de negócio pendentes | ⚠️ | 3 itens operacionais para gestão |

**Condições para APROVAÇÃO PLENA (antes do lançamento):**
1. QA-01: Confirmar/implementar webhook signature validation no `handler.js`
2. QA-02: Implementar idempotency check no fluxo Make.com
3. UX-05: Implementar mensagem pós-CONFIRMAR com SLA no Make.com (system prompt já atualizado)
4. Gestão: Confirmar estacionamento (única FAQ ainda "a confirmar")

---

## 1. Resposta às Perguntas do @architect (Seção 6 do DRAFT)

---

### Pergunta 1: Os débitos críticos/altos cobrem os principais riscos de qualidade do MVP?

**Resposta: SIM — com adição de 2 novos débitos de segurança.**

O DRAFT v0.3 cobre adequadamente os riscos de:
- Integridade de dados (overbooking, deduplicação) ✅
- Segurança de acesso (PAT Airtable, secrets management) ✅
- Qualidade conversacional (fluxo Luna, templates, escalonamento) ✅
- Resiliência operacional (retry, rate limiting) ✅
- Observabilidade (logging, uptime) ✅

**Gaps identificados nesta revisão:**

| ID | Gap | Severidade |
|----|-----|-----------|
| **QA-01** ⭐ | Validação de assinatura do webhook Meta (X-Hub-Signature-256) — status desconhecido | 🔴 Crítico |
| **QA-02** ⭐ | Sem idempotency check no processamento de mensagens | ⚠️ Alto |

Detalhes na Seção 3.

---

### Pergunta 2: Há gaps de segurança além dos identificados (DT-07, DT-08, DB-03)?

**Resposta: SIM — 2 gaps adicionais.**

**QA-01 — Validação de Assinatura do Webhook (X-Hub-Signature-256):**
A Meta Cloud API assina cada webhook com HMAC-SHA256 usando o `App Secret`. O receptor deve validar a assinatura antes de processar qualquer payload. Sem essa validação, qualquer ator malicioso que descubra a URL do Vercel pode:
- Injetar mensagens falsas no sistema (spam de cotações, dados corrompidos no Airtable)
- Simular mensagens de hóspedes reais para testar vulnerabilidades
- Forçar custos de API (Claude + DeepSeek) ao enviar payloads em volume

O `handler.js` documentado menciona verificação no GET (challenge verification), mas não menciona explicitamente validação de assinatura no POST.

**Impacto:** Se não implementado → DT-07 (rate limiting) sozinho é insuficiente para prevenir payloads maliciosos, pois um atacante pode enviar até o limite antes do bloqueio.

**QA-02 — Idempotency no Processamento de Mensagens:**
A Meta Cloud API pode enviar o mesmo webhook **mais de uma vez** em caso de falha de rede ou timeout. Sem controle de idempotency (ex: deduplicação por `message_id`), um hóspede pode receber a mesma resposta do Luna duplicada — ou pior, ter dois registros no Airtable para a mesma mensagem.

**Cenário de risco:**
```
T=0s: Meta envia webhook message_id=abc123
T=0s: Vercel recebe, processa, responde 200... PORÉM
T=0.1s: Conexão cai antes do 200 chegar na Meta
T=5s: Meta reenvia o mesmo webhook (retry padrão = até 5x)
T=5s: Make.com processa novamente → 2 respostas para o hóspede
          → 2 registros no Airtable para a mesma mensagem
```

**Mitigação simples:** Armazenar `message_id` dos últimos 100 webhooks processados (em memória no Vercel ou em uma tabela Airtable dedicada `Webhooks Processados`). Verificar antes de processar.

---

### Pergunta 3: A falta de testes end-to-end no WhatsApp real é aceitável para lançar o MVP?

**Resposta: ACEITÁVEL com protocolo de smoke test obrigatório antes do lançamento.**

O projeto possui excelente cobertura de testes unitários/integração:
- 32/32 testes do system prompt (PLU-01.2) passando
- 20/20 cenários do fluxo de cotação (PLU-01.3) passando

No entanto, testes com WhatsApp real são necessários para validar:
- Latência real end-to-end (Meta → Vercel → Make.com → Claude → WhatsApp)
- Formatação WhatsApp de caracteres especiais (negrito `*`, emojis em diferentes dispositivos)
- Comportamento da Meta API em ambiente de produção (rate limits reais, retries)
- Recebimento correto de notificações pela equipe

**Protocolo de Smoke Test mínimo (antes do lançamento):**

| Teste | Descrição | Critério |
|-------|-----------|---------|
| ST-01 | Enviar "Oi" → receber saudação da Luna | Resposta em <15s com tom correto |
| ST-02 | Perguntar "Tem piscina?" → receber confirmação | Sem escalonamento desnecessário |
| ST-03 | Perguntar "Aceita pets?" → receber R$20/dia | Informação correta, sem "a confirmar" |
| ST-04 | Iniciar cotação: datas + 2 pessoas + Ala A | Cotação enviada com valores corretos |
| ST-05 | Responder "CONFIRMAR" → equipe recebe notificação | Notificação chegando em <30s |
| ST-06 | Perguntar "quero falar com alguém" | [ESCALAR] acionado, equipe notificada |
| ST-07 | Enviar foto/áudio | Receber resposta "envie mensagem de texto" |

**Estes 7 testes podem ser executados em 30-45 minutos** com o número real da pousada, antes da divulgação pública. Aceitável como gate de lançamento.

---

### Pergunta 4: Qual o critério de aceite mínimo para PLU-01.1 → PLU-01.2 → PLU-01.3 irem para produção?

**Resposta: Critérios de aceite mínimos definidos abaixo.**

### Critérios de Aceite — PLU-01.1 (WhatsApp Infrastructure)

- [ ] Webhook URL registrada no Meta Developers Portal e recebendo eventos
- [ ] Número (19) 99840-0306 migrado para WhatsApp Business API (modo produção)
- [ ] GET `/webhook` retorna challenge verification com sucesso
- [ ] POST `/webhook` recebe mensagem real e responde 200 em <3s
- [ ] QA-01: Validação de assinatura X-Hub-Signature-256 implementada
- [ ] Payload forwarded ao Make.com com sucesso (verificar no Make.com execution log)
- [ ] GET `/health` retornando 200

### Critérios de Aceite — PLU-01.2 (Chatbot Base)

- [ ] Base Airtable criada com **schema v1.1** (todos os campos ⭐ incluídos desde o início)
- [ ] PAT Airtable configurado com escopos mínimos (DB-03 resolvido)
- [ ] Make.com conectado ao Airtable, Anthropic API e WhatsApp API
- [ ] Luna responde FAQs confirmadas sem escalonamento: Wi-Fi ✅ Piscina ✅ Pets ✅
- [ ] [ESCALAR] acionado corretamente e notificação chegando à equipe
- [ ] Vercel env vars configuradas (não `.env` local — DT-08 resolvido)
- [ ] Smoke tests ST-01, ST-02, ST-03, ST-06, ST-07 passando

### Critérios de Aceite — PLU-01.3 (Full Funnel)

- [ ] Tabela `Disponibilidade` populada com próximos 90 dias
- [ ] Tabela `Tabela de Preços` populada para TODOS os períodos (sem gaps)
- [ ] DB-02: Upsert por telefone funcionando (sem duplicatas no Airtable)
- [ ] DB-01: Decrementação automática de disponibilidade ao confirmar reserva
- [ ] DB-12: Validação de mínimo de noites antes de gerar cotação
- [ ] UX-04: Mensagem "aguarde" enviada antes do processamento da cotação
- [ ] UX-05: Mensagem pós-CONFIRMAR com SLA "confirmação em até 2h (12h-22h)"
- [ ] UX-02: Escalonamento com variante por horário (dentro/fora do expediente)
- [ ] QA-02: Idempotency check implementado para message_id
- [ ] Smoke tests ST-04, ST-05 passando
- [ ] Follow-up automático testado (aguardar 45min sem resposta e verificar envio)

---

## 2. Validação da Completude do Assessment

### 2.1 Cobertura por Área

| Área | Débitos Documentados | Gaps Conhecidos | Status |
|------|---------------------|----------------|--------|
| Infraestrutura / Deploy | DT-01 a DT-04 (4 críticos P0) | Nenhum | ✅ Completo |
| Segurança | DT-07, DT-08, DB-03, **QA-01** ⭐ | QA-02 documentado | ✅ Completo |
| Integração / Resiliência | DT-05, DT-06, **QA-02** ⭐ | Nenhum | ✅ Completo |
| Dados / Schema | DB-01 a DB-12 | Nenhum | ✅ Completo |
| UX Conversacional | UX-01 a UX-05 | G4 (FAQs) resolvido 2026-02-24 | ✅ Completo |
| Observabilidade | DT-09, DT-10, DT-11 | Nenhum | ✅ Completo |
| Negócio | DT-12/DB-04/DB-05 (resolvidos) | Estacionamento pendente | ⚠️ Minor |

### 2.2 Decisões de Negócio — Status Final

| Decisão | Status | Data |
|---------|--------|------|
| Preços alta temporada | ✅ R$400 casal + R$150/pessoa adicional | 2026-02-24 |
| Regra período misto | ✅ Prorateio por noite (Option C) | 2026-02-24 |
| Mínimo de noites | ✅ Alta: 2 noites / FDS: 2 noites / Geral: 1 noite | 2026-02-24 |
| Capacidade real | ✅ 18 quartos (Ala A=8, B=7, C=3) | 2026-02-24 |
| Meta Business Manager | ⏳ CNPJ disponível — criar BM do zero | Ação humana pendente |
| Wi-Fi incluso | ✅ Confirmado, incluso na diária | 2026-02-24 |
| Piscina | ✅ Piscina externa disponível | 2026-02-24 |
| Pets | ✅ Aceito com R$20/dia por animal | 2026-02-24 |
| Horário recepção | ✅ 12h às 22h | 2026-02-24 |
| Estacionamento | ⏳ Ainda "a confirmar" — única FAQ pendente | Ação humana pendente |

### 2.3 Consistência entre Documentos

| Inconsistência | Localização | Ação |
|----------------|-------------|------|
| `{{link_reserva}}` em PLU-01.3 T3.3 sem correspondência no system prompt | PLU-01.3.story.md | Remover ou documentar como fase 2 |
| System prompt v1.0 tinha "17 quartos" vs. 18 real | claude-system-prompt.md | ✅ Corrigido para 18 |
| FAQs "a confirmar" (Wi-Fi, piscina, pets) | claude-system-prompt.md | ✅ Corrigido 2026-02-24 |

---

## 3. Novos Débitos de Segurança Identificados

### QA-01 — Validação de Assinatura do Webhook Meta

**Severidade:** 🔴 CRÍTICO
**Área:** Segurança
**Prioridade:** P1 — antes do lançamento
**Esforço:** 1h código (`handler.js`)
**Responsável:** @dev

**Problema:**
A Meta Cloud API assina todo webhook POST com `X-Hub-Signature-256: sha256={HMAC}` usando o `App Secret` da aplicação. Sem verificação desta assinatura no `handler.js`, o endpoint aceita requisições de qualquer origem.

**Verificação a fazer:**
```javascript
// Verificar se handler.js já implementa:
const crypto = require('crypto');
function validateSignature(payload, signature, appSecret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature), Buffer.from(expected)
  );
}
```

**Ação:** @dev deve revisar `src/webhook/handler.js` e confirmar se a validação está implementada. Se não, implementar antes do deploy de produção.

---

### QA-02 — Sem Idempotency Check no Processamento de Mensagens

**Severidade:** ⚠️ ALTO
**Área:** Resiliência / Integridade
**Prioridade:** P1 — PLU-01.3
**Esforço:** 2h (Make.com + Airtable ou in-memory)
**Responsável:** @dev

**Problema:**
Meta pode reenviar webhooks (retry) se não receber confirmação HTTP 200 a tempo. Sem controle de `message_id`, a mesma mensagem do hóspede pode ser processada mais de uma vez, resultando em:
- Hóspede recebendo a mesma resposta duplicada
- Múltiplos registros no Airtable para a mesma mensagem
- Cotações geradas em duplicata

**Solução recomendada:**
No início do cenário Make.com, antes de qualquer processamento:
```
1. Extrair {{message_id}} do payload Meta
2. Buscar em Airtable (tabela Webhooks Processados) WHERE message_id = {{message_id}}
3. SE encontrado → encerrar cenário (mensagem já processada)
4. SE não encontrado → registrar message_id → processar normalmente
```

Alternativa simples: usar uma variável de estado no Make.com com TTL de 24h (sem Airtable adicional).

---

## 4. Débitos Resolvidos Durante Esta Fase

As informações fornecidas pela gestão durante a Fase 7 resolveram 3 débitos UX pendentes:

| ID | Débito | Resolução | Data |
|----|--------|-----------|------|
| UX-G4a | FAQ Wi-Fi "a confirmar" | ✅ Wi-Fi incluso na diária | 2026-02-24 |
| UX-G4b | FAQ Piscina "a confirmar" | ✅ Piscina externa disponível | 2026-02-24 |
| UX-G4c | FAQ Pets "a confirmar" | ✅ Aceito com R$20/dia | 2026-02-24 |
| UX-G2 | Horário de atendimento indefinido | ✅ Recepção das 12h às 22h | 2026-02-24 |

System prompt atualizado com todas essas informações em `docs/architecture/claude-system-prompt.md`.

---

## 5. Inventário Final de Débitos

> Consolidado após Fases 1-7. Base para `technical-debt-assessment.md` (Fase 8).

### 5.1 Por Severidade e Sprint

| ID | Débito | Sev. | Sprint |
|----|--------|------|--------|
| **P0 — Bloqueadores (ações humanas)** | | | |
| DT-01 | Registrar webhook URL Meta | 🔴 | P0 — Agora |
| DT-02 | Migrar número WhatsApp Business API | 🔴 | P0 — Agora |
| DT-03 | Configurar cenários Make.com | 🔴 | P0 — Agora |
| DT-04 | Criar base Airtable com schema v1.1 | 🔴 | P0 — Agora |
| **P1 — Sprint MVP (técnico)** | | | |
| DB-02 | Upsert por telefone | 🔴 | P1 — PLU-01.2 |
| DB-01 | Automação decrementação disponibilidade | 🔴 | P1 — PLU-01.3 |
| UX-05 | Gap handoff pós-CONFIRMAR | 🔴 | P1 — PLU-01.3 |
| **QA-01** ⭐ | Webhook signature validation | 🔴 | P1 — antes lançamento |
| DB-03 | PAT Airtable escopos mínimos | ⚠️ | P1 — Setup |
| DB-06 | Tabela Reservas | ⚠️ | P1 — Setup |
| DB-07 | Campos estruturados cotação | ⚠️ | P1 — Setup |
| DB-12 | Validação mínimo de noites | ⚠️ | P1 — PLU-01.3 |
| DT-08 | Vercel env vars (não .env local) | ⚠️ | P1 — Deploy |
| UX-02 | Escalonamento com SLA por horário | ⚠️ | P1 — antes lançamento |
| UX-04 | Mensagem "aguarde" durante cotação | ⚠️ | P1 — PLU-01.3 |
| **QA-02** ⭐ | Idempotency webhook processing | ⚠️ | P1 — PLU-01.3 |
| DB-08 | Campo canal_origem | 📋 | P1 — Setup |
| UX-01 | Passo 2: uma pergunta por vez | 📋 | P1 — PLU-01.2 |
| **P2 — Pós-MVP** | | | |
| DT-05 | Roteamento DeepSeek/Claude | ⚠️ | P2 |
| DT-06 | Retry logic webhook → Make.com | ⚠️ | P2 |
| DT-07 | Rate limiting webhook | ⚠️ | P2 |
| DT-11 | Monitoramento de uptime | 📋 | P2 |
| DB-09 / DT-13 | Backup automático Airtable | 📋 | P2 |
| DB-11 | Latência N×API prorateio | 📋 | P2 |
| UX-03 | Price anchoring Passo 3 | 📋 | P2 |
| **P3 — Backlog** | | | |
| DT-09 | Logging estruturado | 📋 | P3 |
| DT-10 | CI/CD pipeline | 📋 | P3 |
| DB-10 | Campo Temporada redundante | 🔵 | P3 |
| **RESOLVIDOS** | | | |
| DT-12 / DB-05 | Preços alta temporada | ✅ | — |
| DB-04 | Regra período misto | ✅ | — |
| UX-G4a/b/c | FAQs Wi-Fi, piscina, pets | ✅ | — |
| UX-G2 | Horário de recepção | ✅ | — |

### 5.2 Contagem Final

| Status | Qtd |
|--------|-----|
| 🔴 Crítico (P0 + P1) | 8 |
| ⚠️ Alto (P1 + P2) | 11 |
| 📋 Médio (P1 + P2 + P3) | 9 |
| 🔵 Baixo (P3) | 1 |
| ✅ Resolvido | 7 |
| **Total único** | **29** |

**Esforço P0+P1 estimado:** ~20-26h técnicas + ~10-15h humanas/negócio
**Esforço P2+P3 estimado:** ~15-20h técnicas

---

## 6. Questões Finais para a Gestão

> Último item pendente antes do lançamento MVP.

| # | Questão | Impacto | Urgência |
|---|---------|---------|---------|
| **O1** | **Confirmar estacionamento** — há vagas? É cobrado à parte? | FAQ da Luna (única ainda "a confirmar") | Alta — antes do lançamento |
| O2 | Meta Business Manager — criar com CNPJ disponível | DT-02 bloqueador total | Alta — agora |
| O3 | Definir número de operações Make.com para escolher plano correto (Core $9 vs. Pro $16/mês) | Custo operacional | Média |

---

## 7. Recomendação de Próximos Passos (Pós-Fase 7)

### Fase 8 — Consolidação Final (@architect)
Consolidar `technical-debt-DRAFT.md` + reviews das Fases 5-7 em `technical-debt-assessment.md` com:
- Inventário final limpo (sem seções "PENDENTE")
- Plano de resolução por sprint com responsáveis
- Critérios de aceite MVP da Seção 4 deste documento

### Fase 9 — Relatório Executivo (@analyst)
Gerar `TECHNICAL-DEBT-REPORT.md` para a gestão da pousada — linguagem não-técnica, focado em:
- O que está pronto vs. o que falta
- Impacto em negócio de cada gap
- Custo/esforço de resolução em linguagem acessível

### Fase 10 — Épicos + Stories (@pm)
Com base no assessment final, @pm cria:
- EPIC-PLU-01: Atualizar stories PLU-01.2 e PLU-01.3 com novos débitos
- EPIC-PLU-03: Automação de disponibilidade (DB-01 como story própria)
- Backlog priorizado para Sprint 1 MVP

---

## Histórico de Versões

| Data | Versão | Mudanças | Autor |
|------|--------|---------|-------|
| 2026-02-24 | 1.0 | QA Gate inicial Fase 7 | @qa — Brownfield Discovery |
