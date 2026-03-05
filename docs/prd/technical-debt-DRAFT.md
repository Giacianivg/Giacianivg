# Technical Debt Assessment — DRAFT
## Pousada Luz da Lua — Para Revisão dos Especialistas

**Versão:** 0.4 (DRAFT — Fases 5-7 completas)
**Data:** 2026-02-24
**Autor:** Aria (@architect) — Brownfield Discovery Fase 4
**Revisado:** Dara (@data-engineer) — Fase 5 | Uma (@ux-design-expert) — Fase 6 | @qa — Fase 7
**Fontes:**
- `docs/architecture/system-architecture.md` (Fase 1)
- `docs/data/DB-AUDIT.md` (Fase 2)
- `docs/data/SCHEMA.md` (Fase 2)
- `docs/reviews/db-specialist-review.md` (Fase 5) ⭐
- `docs/reviews/ux-specialist-review.md` (Fase 6) ⭐
- `docs/reviews/qa-review.md` (Fase 7) ⭐
**Status:** ✅ ARQUIVADO — Fase 8 concluída. Documento final: `docs/prd/technical-debt-assessment.md`

---

## Contexto do Projeto

**Projeto:** Pousada Luz da Lua — Plataforma de Growth Operations
**Stack:** WhatsApp Business API → Vercel Webhook → Make.com → Claude/DeepSeek → Airtable
**Tipo:** No-code/low-code + microserviço Node.js
**Fase atual:** MVP em implementação — PLU-01.1 e PLU-01.2 InProgress, PLU-01.3 Pending
**Receita base atual estimada:** ~R$30k/mês | **Meta MVP:** R$60k/mês | **Meta final:** R$100k/mês

---

## 1. Débitos de Sistema e Infraestrutura

> Fonte: `docs/architecture/system-architecture.md`

### 1.1 Bloqueadores Operacionais (sem isso, nada funciona)

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DT-01 | Webhook URL não registrada no Meta Developers Portal | Infra | 🔴 Crítico — WhatsApp não recebe/envia nada | 30 min (humano) | @devops + gestor |
| DT-02 | Número (19) 99840-0306 não migrado para WhatsApp Business API | Infra | 🔴 Crítico — Automação impossível | 2-4h (downtime, humano) | Gestor da pousada |
| DT-03 | Make.com não configurado (cenários não existem) | Integração | 🔴 Crítico — Fluxo completo inoperante | 4-6h (humano) | @dev + gestor |
| DT-04 | Base Airtable "Pousada Luz da Lua — CRM" não criada | Dados | 🔴 Crítico — Sem CRM, sem cotação | 2-3h (humano) | Gestor da pousada |

> ⚠️ Todos os 4 itens acima bloqueiam o MVP. São ações humanas fora do escopo de código.

---

### 1.2 Qualidade e Resiliência

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DT-05 | Roteamento DeepSeek/Claude não implementado no Make.com | Custo | ⚠️ Alto — Custo ~2x maior que estimado (~$17/mês vs ~$4/mês) | 2h Make.com | @dev |
| DT-06 | Sem retry logic no forward webhook → Make.com | Resiliência | ⚠️ Alto — Mensagens perdidas se Make.com offline | 1h código | @dev |
| DT-07 | Sem rate limiting no endpoint `/webhook` | Segurança | ⚠️ Alto — Vulnerável a flood/spam que gera custos e instabilidade | 2h código | @dev |
| DT-08 | Credenciais de API apenas em `.env` local (sem secrets manager) | Segurança | ⚠️ Alto — Risco LGPD se arquivo vazar; deploy Vercel deve usar env vars | 1h @devops | @devops |
| **QA-01** ⭐ | **Validação de assinatura webhook Meta (X-Hub-Signature-256) — status desconhecido** | Segurança | 🔴 **Crítico — sem validação, qualquer ator externo pode injetar mensagens falsas no sistema** | 1h código | @dev |
| **QA-02** ⭐ | **Sem idempotency check — Meta pode reenviar webhooks causando mensagens duplicadas** | Resiliência | ⚠️ **Alto — hóspede recebe resposta em duplicata; registros duplicados no Airtable** | 2h Make.com | @dev |

> ⭐ QA-01 e QA-02 identificados por @qa na Fase 7.

---

### 1.3 Observabilidade e Operações

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DT-09 | Sem logging estruturado no handler (apenas `console.log`) | Observabilidade | 📋 Médio — Difícil debugar problemas em produção | 2h código | @dev |
| DT-10 | Sem CI/CD pipeline (deploy manual via `vercel --prod`) | DevOps | 📋 Médio — Risco de deploy com erro, sem rollback automatizado | 2h @devops | @devops |
| DT-11 | Sem monitoramento de uptime do webhook | Observabilidade | 📋 Médio — Falhas silenciosas: webhook cai, leads perdidos sem aviso | 30min (UptimeRobot gratuito) | @devops |

---

### 1.4 Dados e Negócio

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DT-12 | ~~Preços de alta temporada indefinidos~~ | Negócio | ✅ **RESOLVIDO** — R$400 casal + R$150 adicional, mín. 2 noites | Decisão registrada 2026-02-24 | — |
| DT-13 | Sem estratégia de backup do Airtable | Dados | 📋 Médio — Perda irrecuperável de dados de hóspedes | 1h Make.com | @dev |

---

## 2. Débitos de Dados e Schema (Airtable)

> Fonte: `docs/data/DB-AUDIT.md`
> ⚠️ PENDENTE: Validação por @data-engineer especialista

### 2.1 Integridade de Dados

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DB-01 | Overbooking: campo `Reservadas` é manual, sem automação de decrementação | Integridade | 🔴 Crítico — Múltiplas reservas para o mesmo quarto/data | 2h Make.com | @dev |
| DB-02 | Sem upsert por telefone: múltiplos registros para mesmo hóspede | Integridade | 🔴 Crítico — CRM com dados duplicados, histórico fragmentado | 1h Make.com | @dev |

### 2.2 Segurança e Acesso

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DB-03 | API Key Airtable com permissão total (deve ser PAT com escopos mínimos) | Segurança | ⚠️ Alto — Exposição de dados pessoais de hóspedes (LGPD) | 30min | Gestor/devops |

### 2.3 Regras de Negócio Indefinidas

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DB-04 | Regra de preço para períodos mistos de temporada indefinida | Negócio | ⚠️ Alto — Cotações com valores incorretos, conflito com hóspede | 1h decisão negócio | Gestor da pousada |
| DB-05 | Preços de alta temporada sem dados (mesmo que DT-12) | Negócio | ⚠️ Alto — Ver DT-12 | — | (unificado com DT-12) |

### 2.4 Schema Insuficiente para Épicos Futuros

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DB-06 | Tabela `Reservas` inexistente — dados de hóspedes confirmados misturados com leads | Arquitetura de dados | ⚠️ Alto — Inviabiliza EPIC-PLU-04 (retenção) e EPIC-PLU-05 (analytics/LTV) | 1h Airtable | Gestor + @dev |
| DB-07 | Campos estruturados de cotação ausentes em `Conversas` (datas, tipo, valor) | Analytics | ⚠️ Alto — Impossível calcular RevPAR, ocupação por tipo, receita potencial | 30min Airtable | Gestor |
| DB-08 | Campo `canal_origem` ausente — impossível calcular CAC por canal | Analytics | 📋 Médio — EPIC-PLU-02 não conseguirá medir ROI das campanhas | 15min Airtable | Gestor |
| **DB-12** ⭐ | **Validação de mínimo de noites ausente no fluxo de cotação** | Regras de negócio | ⚠️ **Alto — Cotações geradas para estadias que violam política de mínimo; dano à experiência do hóspede** | 1h Make.com | @dev |

### 2.5 Operações e Backup

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| DB-09 | Sem backup automático do Airtable (mesmo que DT-13) | Dados | 📋 Médio | — | (unificado com DT-13) |
| DB-10 | Campo `Temporada` redundante em `Disponibilidade` | Qualidade | 🔵 Baixo — Dados inconsistentes se temporadas mudarem | 15min | Gestor |
| **DB-11** ⭐ | **Latência N×API na cotação com prorateio por noite** | Performance | 📋 **Médio — Cotação de 7 noites faz ~14 chamadas Airtable; risco de rate limit e latência >3s** | 1h Make.com | @dev |

> ⭐ DB-11 e DB-12 identificados por @data-engineer na Fase 5 — não constavam na auditoria original.

---

## 3. Débitos de UX Conversacional (WhatsApp / Luna)

> Fase 3 não executada no formato tradicional — projeto não tem frontend.
> Fase 6: @ux-design-expert (Uma) avaliou o fluxo conversacional da Luna.
> Fonte: `docs/reviews/ux-specialist-review.md`

### 3.1 Débitos Identificados

| ID | Débito | Área | Impacto | Esforço | Responsável |
|----|--------|------|---------|---------|-------------|
| **UX-05** ⭐ | Gap de handoff pós-CONFIRMAR — "Em breve alguém entrará em contato" sem SLA | Conversão | 🔴 Crítico — lead confirmado pode resfriar e buscar alternativa (Booking.com) | 1h Make.com + decisão gestão | @dev + gestor |
| **UX-02** ⭐ | Mensagem de escalonamento sem SLA por horário | Experiência | ⚠️ Alto — "Um momento" cria expectativa falsa fora do horário de atendimento | 1h Make.com | @dev |
| **UX-04** ⭐ | Latência silenciosa no processamento da cotação (5-30s sem feedback) | Experiência | ⚠️ Alto — percepção de falha do sistema para o hóspede | 30min Make.com | @dev |
| **UX-01** ⭐ | Passo 2 tem 2 perguntas em 1 mensagem ("Quantas pessoas? E vai ter crianças?") | Fluxo | 📋 Médio — anti-pattern conversacional; pode resultar em dados incompletos | 30min (system prompt) | @dev |
| **UX-03** ⭐ | Passo 3 exibe preços antes da cotação (price anchoring prematuro) | Conversão | 📋 Médio — surpresa no total final se alta temporada ou pessoa extra | 30min (system prompt) | @dev |

> ⭐ Todos os débitos UX são novos — identificados por @ux-design-expert na Fase 6.

### 3.2 Pontos Positivos (preservar)

| Aspecto | Status |
|---------|--------|
| Tom da Luna — "acolhedor, caloroso, profissional" | ✅ Correto |
| Uso moderado de emojis (máx. 1-2/mensagem) | ✅ Correto |
| Mensagens curtas (máx. 3 parágrafos) | ✅ Correto |
| Follow-up com apenas 1 envio por cotação | ✅ Correto |
| CONFIRMAR como palavra-chave | ✅ Correto |
| Escalonamento automático para grupos 6+ | ✅ Correto |

---

## 4. Matriz de Priorização Preliminar

> Priorização por: **Impacto no negócio × Urgência para MVP × Esforço**

| ID | Débito | Área | Severidade | Impacto Negócio | Esforço (h) | Prioridade | Sprint |
|----|--------|------|-----------|----------------|-------------|-----------|--------|
| DT-01 | Registrar webhook URL na Meta | Infra | 🔴 Crítico | Bloqueador total | 0.5h | P0 — Agora |
| DT-02 | Migrar número WhatsApp Business API | Infra | 🔴 Crítico | Bloqueador total | 2-4h | P0 — Agora |
| DT-03 | Configurar cenários Make.com | Integração | 🔴 Crítico | Bloqueador total | 4-6h | P0 — Agora |
| DT-04 | Criar base Airtable | Dados | 🔴 Crítico | Bloqueador total | 2-3h | P0 — Agora |
| DT-12 | Preços alta temporada | Negócio | ⚠️ Alto | 30-40% cotações falhando | 2-4h | P0 — Agora |
| DB-01 | Automação de disponibilidade (anti-overbooking) | Integridade | 🔴 Crítico | Dano operacional direto | 2h | P1 — PLU-01.3 |
| DB-02 | Upsert por telefone no Make.com | Integridade | 🔴 Crítico | CRM corrompido | 1h | P1 — PLU-01.2 |
| DB-03 | PAT Airtable com escopos mínimos | Segurança | ⚠️ Alto | LGPD | 0.5h | P1 — Setup |
| DB-06 | Tabela Reservas no Airtable | Arquitetura | ⚠️ Alto | Inviabiliza EPIC-04/05 | 1h | P1 — Setup |
| DB-07 | Campos estruturados cotação em Conversas | Analytics | ⚠️ Alto | Inviabiliza EPIC-05 | 0.5h | P1 — Setup |
| DT-05 | Roteamento DeepSeek/Claude | Custo | ⚠️ Alto | Economia 50-60% API | 2h | P2 — Pós-MVP |
| DT-06 | Retry logic webhook → Make.com | Resiliência | ⚠️ Alto | Mensagens perdidas | 1h | P2 — Pós-MVP |
| DT-07 | Rate limiting no webhook | Segurança | ⚠️ Alto | Flood/spam | 2h | P2 — Pós-MVP |
| DT-08 | Secrets manager (Vercel env vars) | Segurança | ⚠️ Alto | LGPD | 1h | P1 — Deploy |
| DB-04 | ~~Regra preço período misto~~ | Negócio | — | ✅ Resolvido (prorateio/noite) | — | RESOLVIDO |
| DB-12 ⭐ | Validação mínimo de noites no fluxo | Regras de negócio | ⚠️ Alto | Cotações inválidas geradas | 1h | P1 — PLU-01.3 |
| UX-05 ⭐ | Gap handoff pós-CONFIRMAR (sem SLA) | UX / Conversão | 🔴 Crítico | Lead confirmado busca alternativa | 1h + decisão gestão | P1 — PLU-01.3 |
| UX-02 ⭐ | Escalonamento sem SLA por horário | UX / Experiência | ⚠️ Alto | Expectativa falsa de resposta imediata | 1h Make.com | P1 — antes lançamento |
| UX-04 ⭐ | Latência silenciosa no processamento | UX / Experiência | ⚠️ Alto | Percepção de falha do sistema | 30min Make.com | P1 — PLU-01.3 |
| DT-11 | Monitoramento de uptime | Observabilidade | 📋 Médio | Falhas silenciosas | 0.5h | P2 |
| DB-08 | Campo canal_origem | Analytics | 📋 Médio | CAC por canal | 0.25h | P1 — Setup |
| UX-01 ⭐ | Passo 2 com 2 perguntas em 1 msg | UX / Fluxo | 📋 Médio | Anti-pattern conversacional | 30min | P1 — PLU-01.2 |
| UX-03 ⭐ | Price anchoring no Passo 3 (preços antes da cotação) | UX / Conversão | 📋 Médio | Surpresa no total final | 30min | P2 — Pós-MVP |
| DB-11 ⭐ | Latência N×API (prorateio por noite) | Performance | 📋 Médio | Cotação lenta, rate limit | 1h | P2 — Pós-MVP |
| DT-13 | Backup automático Airtable | Dados | 📋 Médio | Perda dados | 1h | P2 |
| DT-09 | Logging estruturado | Observabilidade | 📋 Médio | Debug difícil | 2h | P3 |
| DT-10 | CI/CD pipeline | DevOps | 📋 Médio | Risco de deploy | 2h | P3 |
| DB-10 | Campo Temporada redundante | Qualidade | 🔵 Baixo | Inconsistência | 0.25h | P3 |

> ⭐ DB-11 e DB-12 identificados por @data-engineer (Fase 5).

**Total de débitos:** 30 brutos → 28 únicos ativos (excluindo DB-05/DT-12 e DB-09/DT-13 duplicados; DB-04/DT-12 + FAQs resolvidos)
**Críticos:** 8 (+QA-01) | **Altos:** 14 (+QA-02) | **Médios:** 8 | **Baixos:** 1 | **Resolvidos:** 7
**Esforço P0+P1:** ~20-26h técnicas + ~10-15h humanas | **Esforço P2+P3:** ~15-20h técnicas

---

## 5. Decisões de Negócio — RESPONDIDAS (2026-02-24)

| # | Questão | Resposta | Status |
|---|---------|----------|--------|
| Q1 | Preços de alta temporada | R$400/casal + R$150/pessoa adicional. Mín. 2 noites. Válido para todos os períodos de alta (Carnaval, Semana Santa, Férias julho, Natal, Réveillon, Feriados prolongados) | ✅ Documentado |
| Q2 | Regra de período misto | **Prorateio por noite** — cada noite pela tarifa da temporada correspondente | ✅ Documentado |
| Q3 | Mínimo de noites | Alta temporada: **2 noites**. Fins de semana: 2 noites. Geral: 1 noite | ✅ Documentado |
| Q4 | Capacidade real | Ala A: 8 quartos (3p) ✅ \| Ala B: 7 quartos (5p) ✅ \| Ala C: 2+1 ✅ \| Total: 18 ✅ | ✅ Confirmado |
| Q5 | Meta Business Manager | Perfil FB pessoal existente — criar Business Manager do zero com identidade da pousada | ⏳ Ação pendente (humano) |
| Q6 | CNPJ para verificação Meta | CNPJ ativo e disponível | ✅ Confirmado |

---

## 6. Perguntas para Especialistas

### Para @data-engineer (Dara) — ✅ RESPONDIDAS (Fase 5 — 2026-02-24)

> Ver `docs/reviews/db-specialist-review.md` para análise completa.

1. **Schema v1.1 adequado para PLU-04/05?** → ✅ SIM. Com ressalva: adicionar campo `Preço Unitário Aplicado` em Reservas (15min) para integridade histórica de pricing.
2. **Upsert por Telefone é suficiente?** → ✅ SIM. Nenhum campo adicional necessário. Número E.164 da Meta é estável e consistente.
3. **Race condition em DB-01?** → Race condition existe tecnicamente, mas probabilidade BAIXA (<0,1%) para volume MVP. Mitigação gratuita: Make.com sequential processing (concurrency=1). Risco aceitável para lançamento.
4. **Airtable limitações de volume 12-24 meses?** → ✅ SEM RISCO. Projeção: ~5.000-6.400 registros em 24 meses vs. limite de 50.000 no plano Team. Único requisito: contratar plano Team ($20/mês) — Free é insuficiente.
5. **Solução melhor que Airtable?** → Para MVP e 12-24 meses: Airtable é a escolha CORRETA. Reavaliar migração para Supabase apenas quando: receita >R$80k/mês E desenvolvedor contratado. Não migrar prematuramente.

### Para @ux-design-expert (Uma) — ✅ RESPONDIDAS (Fase 6 — 2026-02-24)

> Ver `docs/reviews/ux-specialist-review.md` para análise completa.

1. **Ordem datas → pessoas → quarto é otimizada?** → ✅ SIM — ordem correta. Melhoria minor: consolidar Passo 2 em "Quantas pessoas no total (incluindo crianças)?" (elimina 2 perguntas em 1 mensagem).
2. **Template de cotação alinhado com boas práticas?** → ✅ SIM com melhorias: adicionar "Cancelamento gratuito 7 dias" + remover localização redundante + sincronizar com PLU-01.3 T3.3.
3. **Risco de abandono no funil?** → 🔴 SIM — 3 pontos identificados, 1 crítico: gap pós-CONFIRMAR sem SLA ("Em breve alguém entrará em contato" pode perder lead confirmado).
4. **Escalonamento precisa de SLA de tempo?** → ✅ SIM — "Um momento" cria expectativa falsa. Implementar variantes por horário (dentro/fora do expediente 8h-20h).

### Para @qa (revisor) — ✅ RESPONDIDAS (Fase 7 — 2026-02-24)

> Ver `docs/reviews/qa-review.md` para análise completa. Veredicto: **APROVADO COM CONDIÇÕES**.

1. **Débitos cobrem os principais riscos?** → ✅ SIM + 2 novos débitos de segurança: QA-01 (webhook signature validation) e QA-02 (idempotency check).
2. **Gaps de segurança adicionais?** → ✅ SIM: QA-01 (Meta X-Hub-Signature-256 — status desconhecido em `handler.js`) e QA-02 (Meta retries podem duplicar mensagens).
3. **Falta de E2E no WhatsApp real é aceitável?** → ✅ SIM com protocolo de 7 smoke tests obrigatórios antes do lançamento (documentados na Fase 7, ST-01 a ST-07).
4. **Critério de aceite mínimo para produção?** → ✅ DEFINIDO — checklists por story em `docs/reviews/qa-review.md` Seção 4.

---

## 7. Plano de Resolução Sugerido (Pré-lançamento MVP)

```
SEMANA 1 — Unblocking (ações humanas)
  Gestor:
  ├── Q5/Q6: Verificar Meta Business Manager + CNPJ
  ├── DT-02: Migrar número WhatsApp (hora de baixo movimento)
  ├── Q1/Q2/Q3: Definir preços e regras de temporada
  └── DT-04 + DB-06/07/08: Criar base Airtable com schema v1.1

  @devops:
  ├── Deploy Vercel → DT-01: Registrar webhook URL
  └── DT-08: Configurar env vars no Vercel (não .env local)

SEMANA 2 — Integração (Make.com)
  @dev:
  ├── DT-03: Configurar cenários Make.com com blueprints existentes
  ├── DB-02: Implementar upsert por telefone
  ├── DB-03: Configurar PAT Airtable com escopos mínimos
  └── DB-04: Implementar regra de preço período misto

SEMANA 3 — PLU-01.3 + Anti-overbooking
  @dev:
  ├── DB-01: Automação de decrementação de disponibilidade
  ├── PLU-01.3: Fluxo de cotação completo no Make.com
  └── Testes end-to-end (20 cenários do PLU-01.3)

PÓS-MVP (Semana 4+)
  @dev: DT-05 (roteamento DeepSeek), DT-06 (retry), DT-07 (rate limiting)
  @devops: DT-11 (uptime monitor), DT-10 (CI/CD)
  @dev: DT-13 (backup automático Airtable)
```

---

## Apêndice: Artefatos Gerados no Discovery

| Arquivo | Fase | Descrição |
|---------|------|-----------|
| `docs/architecture/system-architecture.md` | Fase 1 | Arquitetura completa com débitos de sistema |
| `docs/data/DB-AUDIT.md` | Fase 2 | Auditoria detalhada do schema Airtable |
| `docs/data/SCHEMA.md` | Fase 2 | Schema v1.1 revisado com recomendações |
| `docs/prd/technical-debt-DRAFT.md` | Fase 4 | **Este documento** |
| `docs/reviews/db-specialist-review.md` | Fase 5 | ✅ Review @data-engineer — 2 novos débitos, 5 perguntas respondidas |
| `docs/reviews/ux-specialist-review.md` | Fase 6 | ✅ Review @ux-design-expert — 5 novos débitos UX, 4 perguntas respondidas |
| `docs/reviews/qa-review.md` | Fase 7 | ✅ QA Gate APROVADO COM CONDIÇÕES — 2 novos débitos segurança, critérios MVP definidos |

| Arquivo pré-existente | Descrição |
|-----------------------|-----------|
| `docs/brief.md` | Project brief completo |
| `docs/architecture/airtable-schema.md` | Schema v1.0 original |
| `docs/architecture/claude-system-prompt.md` | System prompt da Luna |
| `docs/architecture/whatsapp-migration.md` | Guia de migração WhatsApp |
| `docs/make-com/blueprint-pousada-atendimento.json` | Blueprint Make.com — atendimento |
| `docs/make-com/blueprint-pousada-followup.json` | Blueprint Make.com — follow-up |
