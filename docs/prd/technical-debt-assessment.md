# Technical Debt Assessment — FINAL
## Pousada Luz da Lua — Growth Operations Platform

**Versão:** 1.0 (Final)
**Data:** 2026-02-24
**Metodologia:** Brownfield Discovery — 10 fases (Fases 1-8 concluídas)
**QA Gate:** ✅ APROVADO COM CONDIÇÕES (Fase 7 — 2026-02-24)

**Equipe do Discovery:**
| Fase | Agente | Entregável |
|------|--------|-----------|
| 1 | Aria @architect | `system-architecture.md` |
| 2 | Aria @architect / perspectiva Dara | `DB-AUDIT.md` + `SCHEMA.md` |
| 4 | Aria @architect | `technical-debt-DRAFT.md` |
| 5 | Dara @data-engineer | `db-specialist-review.md` |
| 6 | Uma @ux-design-expert | `ux-specialist-review.md` |
| 7 | @qa | `qa-review.md` |
| 8 | Aria @architect | **Este documento** |

---

## 1. Contexto do Projeto

**Produto:** Pousada Luz da Lua — Plataforma de Growth Operations
**Negócio:** Pousada em Socorro-SP (Circuito das Águas Paulista), 18 quartos, 3 alas
**Objetivo:** Automatizar atendimento via WhatsApp 24/7 e elevar receita de ~R$30k → R$60k/mês (MVP) → R$100k/mês

### Stack Tecnológica

```
WhatsApp Business API (Meta Cloud API)
  ↓
Vercel (Node.js/Express — handler.js)   ← microserviço de código
  ↓ forward async
Make.com (orquestrador no-code)
  ├─→ Airtable (CRM + disponibilidade + preços)
  ├─→ Anthropic API (Claude Sonnet 4.6 — qualificação, cotação, fechamento)
  └─→ DeepSeek API (FAQs simples — redução de custo 50-60%)
  ↓
WhatsApp Business API (resposta ao hóspede)
```

**Constraint crítico:** Equipe sem desenvolvedores dedicados. Soluções devem priorizar no-code/low-code. Código restrito ao `handler.js` (já existente).

### Fase Atual do Projeto

| Story | Descrição | Status |
|-------|-----------|--------|
| PLU-01.1 | WhatsApp Business API + Webhook Vercel | 🔄 InProgress |
| PLU-01.2 | Claude + Make.com (chatbot base) | 🔄 InProgress |
| PLU-01.3 | Qualificação → Cotação → Fechamento | 🔜 Pending |

**Artefatos prontos para uso imediato:**
- `docs/architecture/claude-system-prompt.md` — system prompt da Luna (32/32 testes ✅)
- `docs/data/SCHEMA.md` — schema Airtable v1.1 com todas as tabelas
- `docs/make-com/blueprint-pousada-atendimento.json` — blueprint Make.com cenário principal
- `docs/make-com/blueprint-pousada-followup.json` — blueprint Make.com follow-up

---

## 2. Decisões de Negócio Confirmadas

> Todas as questões abertas do Discovery foram respondidas pela gestão.

| Decisão | Valor | Data |
|---------|-------|------|
| Preço base casal (alta temporada) | R$400/noite | 2026-02-24 |
| Adicional por pessoa extra (alta temporada) | R$150/noite | 2026-02-24 |
| Mínimo de noites — alta temporada | 2 noites | 2026-02-24 |
| Mínimo de noites — fins de semana | 2 noites | 2026-02-24 |
| Mínimo de noites — geral (dias úteis) | 1 noite | 2026-02-24 |
| Regra de período misto | Prorateio por noite (cada noite pela sua temporada) | 2026-02-24 |
| Capacidade total | 18 quartos (Ala A=8 / Ala B=7 / Ala C=3) | 2026-02-24 |
| Meta Business Manager | Criar do zero com CNPJ da pousada | ⏳ Ação pendente |
| Wi-Fi | Incluso na diária em todas as alas | 2026-02-24 |
| Piscina | Externa, disponível a todos os hóspedes | 2026-02-24 |
| Pets | Aceitos — adicional de R$20/dia por animal | 2026-02-24 |
| Estacionamento | **A confirmar pela gestão** | ⏳ Pendente |
| Horário da recepção | 12h às 22h | 2026-02-24 |
| SLA escalonamento (dentro do horário) | 30 minutos | 2026-02-24 |
| SLA confirmação de reserva | 2 horas (das 12h às 22h) | 2026-02-24 |

---

## 3. Inventário de Débitos Ativos

> 28 débitos únicos · 8 críticos · 12 altos · 7 médios · 1 baixo
> Ordenados por prioridade de resolução.

---

### 3.1 P0 — Bloqueadores Totais (sem isso, o sistema não opera)

> São ações humanas. Nenhuma pode ser resolvida por código.

| ID | Débito | Responsável | Esforço |
|----|--------|-------------|---------|
| DT-01 | Webhook URL não registrada no Meta Developers Portal | @devops + gestor | 30 min |
| DT-02 | Número (19) 99840-0306 não migrado para WhatsApp Business API | Gestor | 2-4h (janela de manutenção) |
| DT-03 | Make.com sem cenários configurados | @dev + gestor | 4-6h |
| DT-04 | Base Airtable "Pousada Luz da Lua — CRM" não criada | Gestor | 2-3h |

**Impacto:** Sistema 100% inoperante enquanto qualquer P0 estiver aberto.

---

### 3.2 P1 — Sprint MVP (necessários antes do lançamento)

#### Segurança — Fazer antes de qualquer deploy de produção

| ID | Débito | Sev. | Responsável | Esforço | Nota |
|----|--------|------|-------------|---------|------|
| QA-01 | Webhook signature validation (X-Hub-Signature-256) ausente ou não confirmada em `handler.js` | 🔴 | @dev | 1h | Verificar primeiro; se já presente, zero esforço |
| DT-08 | Credenciais de API em `.env` local — Vercel precisa de env vars no dashboard | ⚠️ | @devops | 1h | LGPD: arquivo `.env` não deve conter dados de hóspedes |
| DB-03 | API Key Airtable com permissão total — usar PAT com escopos mínimos | ⚠️ | @devops | 30min | Fazer no setup do Airtable (antes de qualquer dado entrar) |

#### Setup do Airtable — Fazer na criação da base (retroativo é 5× mais trabalhoso)

| ID | Débito | Sev. | Responsável | Esforço | Nota |
|----|--------|------|-------------|---------|------|
| DB-06 | Tabela `Reservas` inexistente — hóspedes confirmados misturados com leads | ⚠️ | Gestor | 1h | Criar na primeira abertura do Airtable |
| DB-07 | Campos estruturados de cotação ausentes em `Conversas` (5 campos ⭐) | ⚠️ | Gestor | 30min | Pré-requisito para DB-01 funcionar |
| DB-08 | Campo `Canal de Origem` ausente — inviabiliza cálculo de CAC | 📋 | Gestor | 15min | Adicionar junto com DB-07 |

> Schema completo com todos os campos em `docs/data/SCHEMA.md` (v1.1).

#### PLU-01.2 — Chatbot Base

| ID | Débito | Sev. | Responsável | Esforço | Nota |
|----|--------|------|-------------|---------|------|
| DB-02 | Sem upsert por telefone — cria registros duplicados no Airtable | 🔴 | @dev | 1h | Implementar `Search → SE encontrar UPDATE / SE não encontrar CREATE` |
| UX-01 | Passo 2 do funil tem 2 perguntas em 1 mensagem | 📋 | @dev | 30min | Unificar: "Quantas pessoas no total? (incluindo crianças e bebês)" |
| UX-02 | Escalonamento sem SLA por horário ("Um momento" às 23h) | ⚠️ | @dev | 1h | Make.com verifica timestamp → variante dentro/fora do horário 12h-22h |

#### PLU-01.3 — Fluxo Completo de Cotação

| ID | Débito | Sev. | Responsável | Esforço | Nota |
|----|--------|------|-------------|---------|------|
| DB-01 | Campo `Reservadas` manual — risco de overbooking | 🔴 | @dev | 2h | Automação Make.com: status → "Reservado" decrementa disponibilidade por noite |
| DB-12 | Validação de mínimo de noites ausente no fluxo | ⚠️ | @dev | 1h | Verificar antes de gerar cotação: `noites >= minimo_noites` |
| QA-02 | Sem idempotency check — Meta retries geram mensagens duplicadas | ⚠️ | @dev | 2h | Deduplicar por `message_id` no início do cenário Make.com |
| UX-04 | Silêncio de 5-30s durante processamento da cotação | ⚠️ | @dev | 30min | Enviar "Deixa eu verificar..." imediatamente após detectar [COTAR] |
| UX-05 | Pós-CONFIRMAR sem SLA explícito — lead pode esfriar | 🔴 | @dev | 1h | Mensagem atualizada no system prompt; implementar Make.com + confirmação de resumo |

> UX-02 e UX-05: system prompt já atualizado em `docs/architecture/claude-system-prompt.md`. Falta apenas a lógica condicional de horário no Make.com.

---

### 3.3 P2 — Pós-MVP (primeira iteração após lançamento)

| ID | Débito | Sev. | Responsável | Esforço | Impacto |
|----|--------|------|-------------|---------|---------|
| DT-05 | Roteamento DeepSeek/Claude não implementado — custo $17/mês vs. $4/mês estimado | ⚠️ | @dev | 2h | Economia de ~55% no custo de API |
| DT-06 | Sem retry logic no forward Vercel → Make.com — mensagens perdidas se Make.com offline | ⚠️ | @dev | 1h | Resiliência em falhas transitórias |
| DT-07 | Sem rate limiting no `/webhook` — vulnerável a flood de requisições maliciosas | ⚠️ | @dev | 2h | Proteção pós QA-01 (assinatura é a primeira linha) |
| DT-11 | Sem monitoramento de uptime do webhook | 📋 | @devops | 30min | UptimeRobot gratuito — alerta se webhook cair |
| DB-09/DT-13 | Sem backup automático do Airtable | 📋 | @dev | 1h | Make.com export semanal → Google Drive |
| DB-11 | Latência N×API no prorateio por noite (7 noites = 14 calls Airtable) | 📋 | @dev | 1h | Usar `Preço Base` da tabela `Disponibilidade` — sem calls extras |
| UX-03 | Passo 3 exibe preços antes da cotação — price anchoring prematuro | 📋 | @dev | 30min | Remover preços do Passo 3; usar apenas características dos quartos |

---

### 3.4 P3 — Backlog (qualidade e operações)

| ID | Débito | Sev. | Responsável | Esforço | Impacto |
|----|--------|------|-------------|---------|---------|
| DT-09 | Logging apenas com `console.log` — difícil depurar em produção | 📋 | @dev | 2h | Substituir por logging estruturado (JSON) com níveis |
| DT-10 | Deploy manual via `vercel --prod` — sem CI/CD nem rollback | 📋 | @devops | 2h | GitHub Actions → deploy automático em push para main |
| DB-10 | Campo `Temporada` redundante em `Disponibilidade` | 🔵 | Gestor | 15min | Manter como informativo; nunca usar em queries operacionais |

---

## 4. Débitos Resolvidos

> Documentados para rastreabilidade histórica.

| ID | Débito | Resolução | Data |
|----|--------|-----------|------|
| DT-12 / DB-05 | Preços de alta temporada indefinidos | R$400 casal + R$150/pessoa adicional — todos os períodos de alta | 2026-02-24 |
| DB-04 | Regra de preço para períodos mistos indefinida | Prorateio por noite (Option C) — documentado em `SCHEMA.md` | 2026-02-24 |
| UX-G2 | Horário de atendimento humano desconhecido | Recepção das 12h às 22h | 2026-02-24 |
| UX-G4a | FAQ Wi-Fi "a confirmar" | Wi-Fi incluso na diária em todas as alas | 2026-02-24 |
| UX-G4b | FAQ Piscina "a confirmar" | Piscina externa disponível para todos | 2026-02-24 |
| UX-G4c | FAQ Pets "a confirmar" | Aceitos com R$20/dia por animal | 2026-02-24 |
| DB-MED-03 | Dados de alta temporada bloqueando cotações | Resolvido junto com DT-12 | 2026-02-24 |

---

## 5. Plano de Resolução — Pré-Lançamento MVP

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEMANA 1 — DESBLOQUEIO (ações humanas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gestor da pousada:
  □ DT-02: Migrar número WhatsApp → Business API (agendar janela de manutenção)
  □ DT-04: Criar base Airtable com schema v1.1 completo (SCHEMA.md como guia)
       └─ Incluir desde o início: Tabela Reservas + campos ⭐ + Campo Canal de Origem
  □ O1: Confirmar se há estacionamento e se é cobrado (última FAQ pendente)
  □ Q5: Criar Meta Business Manager com CNPJ da pousada

@devops:
  □ DT-01: Deploy Vercel → registrar webhook URL no Meta Developers Portal
  □ DT-08: Configurar todas as env vars no Vercel dashboard (não .env local)

@dev (verificação prévia):
  □ QA-01: Abrir handler.js → confirmar se X-Hub-Signature-256 está implementado
       └─ SE não estiver: implementar (1h) antes de qualquer tráfego real

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEMANA 2 — INTEGRAÇÃO (Make.com + Setup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gestor da pousada:
  □ DB-03: Gerar PAT Airtable com escopos mínimos (guia em SCHEMA.md)
  □ Popular Tabela de Preços — TODOS os períodos (sem lacunas)
  □ Popular Disponibilidade — próximos 90 dias

@dev:
  □ DT-03: Configurar cenário Make.com usando blueprint-pousada-atendimento.json
  □ DB-02: Implementar upsert por Telefone (Search → Update ou Create)
  □ UX-01: Atualizar Passo 2 no system prompt: uma pergunta por mensagem
  □ UX-02: Adicionar condicional de horário (12h-22h) na mensagem de escalonamento

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEMANA 3 — PLU-01.3 + ANTI-OVERBOOKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dev:
  □ DB-12: Implementar validação de mínimo de noites antes do [COTAR]
  □ UX-04: Enviar "Deixa eu verificar..." antes do Make.com processar cotação
  □ DB-01: Automação de decrementação de disponibilidade ao status "Reservado"
       └─ Configurar Make.com sequential processing (concurrency=1)
  □ QA-02: Implementar deduplicação por message_id
  □ UX-05: Implementar mensagem pós-CONFIRMAR com resumo + SLA ("em até 2h")
  □ Configurar blueprint-pousada-followup.json (follow-up 45min pós-cotação)

7 SMOKE TESTS — executar antes de divulgar o número:
  □ ST-01: "Oi" → saudação Luna em <15s
  □ ST-02: "Tem piscina?" → confirmação sem escalonamento
  □ ST-03: "Aceita pets?" → R$20/dia sem "a confirmar"
  □ ST-04: Cotação completa → valores corretos por temporada
  □ ST-05: CONFIRMAR → equipe recebe notificação em <30s
  □ ST-06: "Quero falar com alguém" → [ESCALAR] + SLA de horário
  □ ST-07: Enviar foto → "por favor envie mensagem de texto"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PÓS-MVP (Semana 4+, após receita estabilizada)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dev (prioridade):
  □ DT-05: Implementar roteamento DeepSeek/Claude (economia ~$8/mês)
  □ DB-11: Otimizar cotação para usar Preço Base de Disponibilidade
  □ DT-06: Retry logic no forward Vercel → Make.com
  □ DT-07: Rate limiting no /webhook
  □ DB-09: Backup semanal automático Make.com → Google Drive
  □ UX-03: Remover preços do Passo 3 (price anchoring)

@devops:
  □ DT-11: UptimeRobot (gratuito) monitorando /health a cada 5 min
  □ DT-10: GitHub Actions para deploy automático

@dev (backlog):
  □ DT-09: Structured logging (JSON) no handler.js
  □ DB-10: Documentar que Temporada em Disponibilidade é só informativo
```

---

## 6. Critérios de Aceite para Produção

### PLU-01.1 — Infraestrutura WhatsApp

- [ ] Webhook URL registrada no Meta e recebendo eventos
- [ ] Número migrado para WhatsApp Business API (modo produção)
- [ ] `GET /webhook` retorna challenge com sucesso
- [ ] `POST /webhook` responde 200 em <3s e encaminha ao Make.com
- [ ] `GET /health` retornando 200
- [ ] QA-01: X-Hub-Signature-256 validada no handler.js
- [ ] Env vars configuradas no Vercel (não .env local)

### PLU-01.2 — Chatbot Base

- [ ] Airtable criado com schema v1.1 completo (todos os campos ⭐)
- [ ] PAT Airtable com escopos mínimos configurado
- [ ] Luna responde FAQs confirmadas sem escalonamento: Wi-Fi, piscina, pets
- [ ] [ESCALAR] acionado corretamente + notificação chegando à equipe
- [ ] Passo 2 com pergunta unificada de pessoas
- [ ] Mensagem de escalonamento com SLA por horário
- [ ] Smoke tests ST-01, ST-02, ST-03, ST-06, ST-07 ✅

### PLU-01.3 — Funil Completo

- [ ] `Disponibilidade` populada para os próximos 90 dias
- [ ] `Tabela de Preços` sem lacunas em nenhum período
- [ ] DB-02: Upsert por telefone funcionando (zero duplicatas)
- [ ] DB-12: Cotação recusa stays abaixo do mínimo de noites
- [ ] UX-04: Mensagem "aguarde" enviada antes do processamento
- [ ] DB-01: Decrementação automática ao confirmar reserva
- [ ] QA-02: Deduplicação por message_id funcionando
- [ ] UX-05: Pós-CONFIRMAR exibe resumo + SLA de confirmação
- [ ] Follow-up automático configurado (45min sem resposta pós-cotação)
- [ ] Smoke tests ST-04, ST-05 ✅
- [ ] Taxa de erro <5% em 20 cenários de teste

---

## 7. Decisões Arquiteturais Registradas

> Decisões tomadas durante o discovery que definem o rumo técnico do projeto.

| Decisão | Escolha | Alternativas Descartadas | Razão |
|---------|---------|--------------------------|-------|
| Banco de dados | Airtable (plano Team) | Supabase, Notion, Google Sheets | Sem dev team; gestão usa nativo; Make.com nativo |
| Migração futura | Supabase quando: receita >R$80k/mês E dev contratado | — | Manter Airtable até lá |
| Precificação mista | Prorateio por noite (Option C) | Preço mais alto / Temporada predominante | Justo para o hóspede, transparente |
| Modelo LLM principal | Claude Sonnet 4.6 | GPT-4o, Gemini | Já validado com 32/32 testes + qualidade superior PT-BR |
| Modelo econômico | DeepSeek para FAQs simples | Claude para tudo | Economia ~55% no custo mensal de API |
| Processamento Make.com | Sequential (concurrency=1) | Paralelo | Elimina race condition de overbooking com custo zero |
| Schema Airtable | v1.1 (com campos ⭐ e tabela Reservas) | v1.0 original | Sem os campos novos, PLU-04/05 não funcionam |
| Identificação de leads | Upsert por Telefone E.164 | UUID, email | Meta sempre envia E.164 — confiável no contexto WhatsApp |

---

## 8. Riscos Residuais Aceitos

> Riscos conhecidos que foram avaliados e aceitos para o MVP.

| Risco | Probabilidade | Impacto | Mitigação Existente | Decisão |
|-------|--------------|---------|--------------------|----|
| Race condition de overbooking | <0,1% para ≤20 reservas/mês | Alto | Make.com sequential processing | ✅ Aceito para MVP |
| Portabilidade de número WhatsApp | Rara | Baixo | Merge manual pela equipe | ✅ Aceito |
| Airtable free → Team plan upgrade | Certo | Baixo (R$100/mês) | Plano Team contratado no setup | ✅ Aceito |
| Latência E2E WhatsApp >10s | Ocasional | Médio | Mensagem "aguarde" (UX-04) | ✅ Aceito com mitigação |
| Meta BM não aprovado pelo Meta | Baixa | 🔴 Bloqueador total | CNPJ disponível para verificação | ⚠️ Monitorar |

---

## 9. Arquitetura de Dados — Estado Final

### Tabelas Airtable (schema v1.1)

| Tabela | Finalidade | Registros esperados (24 meses) |
|--------|-----------|-------------------------------|
| `Conversas` | CRM de leads + cotações | ~2.400 |
| `Disponibilidade` | Calendário de ocupação (1 registro/dia/tipo) | ~2.920 |
| `Tabela de Preços` | Tarifas por período e tipo de quarto | ~60 |
| `Reservas` | Histórico de reservas confirmadas | ~960 |
| **Total** | | **~6.340 registros** |

**Limite plano Team:** 50.000 registros → margem de 87%. Seguro para 24 meses.

### Campos adicionais recomendados para PLU-05 (analytics)
Adicionar no setup inicial (custo: 15 min):
- `Preço Unitário Aplicado` (Currency) na tabela `Reservas` — preserva tarifa histórica

---

## 10. Inventário de Artefatos do Discovery

### Gerados pelo Brownfield Discovery

| Arquivo | Fase | Status |
|---------|------|--------|
| `docs/architecture/system-architecture.md` | 1 | ✅ Final |
| `docs/data/DB-AUDIT.md` | 2 | ✅ Final |
| `docs/data/SCHEMA.md` | 2 | ✅ Final (v1.1) |
| `docs/prd/technical-debt-DRAFT.md` | 4 | ✅ Arquivado (este documento é a versão final) |
| `docs/reviews/db-specialist-review.md` | 5 | ✅ Final |
| `docs/reviews/ux-specialist-review.md` | 6 | ✅ Final |
| `docs/reviews/qa-review.md` | 7 | ✅ Final |
| `docs/prd/technical-debt-assessment.md` | 8 | ✅ **Este documento** |

### Artefatos Pré-existentes (validados pelo Discovery)

| Arquivo | Validação |
|---------|-----------|
| `docs/architecture/claude-system-prompt.md` | ✅ Atualizado 2026-02-24 (Wi-Fi, piscina, pets, recepção 12h-22h, SLAs) |
| `docs/architecture/airtable-schema.md` | ✅ Atualizado com preços confirmados |
| `docs/architecture/whatsapp-migration.md` | ✅ Referência para DT-02 |
| `docs/make-com/blueprint-pousada-atendimento.json` | ✅ Pronto para uso |
| `docs/make-com/blueprint-pousada-followup.json` | ✅ Pronto para uso |
| `src/webhook/handler.js` | ⚠️ Verificar QA-01 antes do deploy de produção |

---

## Apêndice A — Resumo por Números

| Categoria | Qtd |
|-----------|-----|
| Débitos críticos ativos | 8 |
| Débitos altos ativos | 12 |
| Débitos médios ativos | 7 |
| Débitos baixos ativos | 1 |
| **Total ativos** | **28** |
| Resolvidos durante o discovery | 7 |
| **Total identificados** | **35** |

| Esforço | Horas |
|---------|-------|
| P0 — ações humanas | ~10-15h humanas |
| P1 — técnico (@dev/@devops) | ~15-18h |
| P2 — pós-MVP | ~8-9h |
| P3 — backlog | ~6h |
| **Total estimado** | **~39-48h** |

---

*Aprovado pelo QA Gate em 2026-02-24 — pronto para Fase 9 (relatório executivo) e Fase 10 (epics + stories).*
*— Aria, @architect — Brownfield Discovery Fase 8*
