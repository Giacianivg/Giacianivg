# STORY PLU-01.4: Configuração de Produção e Otimização de Desempenho

**ID:** PLU-01.4 | **Epic:** [EPIC-PLU-01](../epics/EPIC-PLU-01-funil-vendas-automatizado.md)
**Sprint:** 3 | **Points:** 3 | **Priority:** 🔴 Critical
**Created:** 2026-02-24
**Status:** 📋 Draft
**Predecessor:** PLU-01.3 (Fluxo completo operacional)

> **Origem:** Identificada durante o Brownfield Discovery (Fases 5-8) — debts DT-08 e DB-11 não cobertos pelas stories existentes. Deve ser concluída **antes da divulgação pública do número**.

---

## User Story

**Como** equipe técnica da Pousada Luz da Lua,
**Quero** que o ambiente de produção esteja seguro e o sistema otimizado para múltiplas conversas simultâneas,
**Para que** o lançamento público não exponha credenciais, cause erros por secrets mal configurados ou seja lento para hóspedes com estadias em períodos mistos.

---

## Acceptance Criteria

- [ ] AC1: Todas as credenciais do sistema (Anthropic, WhatsApp, Airtable) estão configuradas como variáveis de ambiente seguras — **nunca** hardcoded em código ou configurações Make.com exportáveis
- [ ] AC2: Deploy no Vercel usa Environment Variables (não `.env` commitado); Make.com usa Team Variables (não valores diretos nos módulos)
- [ ] AC3: Cotação de estadia em período misto (ex: 5 noites cruzando baixa + alta temporada) é calculada em **uma única chamada** ao Airtable — não N chamadas por noite
- [ ] AC4: Tempo total do fluxo de cotação para período misto: ≤ 10 segundos (dentro do timeout de 30s da Meta)

---

## Scope

### IN
- Auditoria e configuração de todas as variáveis de ambiente em produção (Vercel + Make.com)
- Implementação de calculadora de precificação por período no Make.com (substitui N chamadas Airtable)
- Validação de que nenhuma credencial está exposta em logs, código ou arquivos versionados

### OUT
- Rate limiting e proteção contra abuso (P2 — pós-MVP, coberto em backlog de EPIC-PLU-01)
- Sistema de retry com back-off exponencial (P2 — pós-MVP)
- Monitoramento de uptime e alertas (P2 — pós-MVP)
- Integração com channel manager (EPIC-PLU-03)

---

## Tasks

### T1 — Auditoria de Secrets em Produção (1h) [DT-08]

> ⚠️ **Fazer antes do primeiro request real de hóspede.** Credenciais expostas podem resultar em uso não autorizado das APIs.

- [ ] T1.1: Auditar repositório Git — confirmar que `.env` está no `.gitignore` e **não** está commitado
- [ ] T1.2: Auditar `src/webhook/handler.js` e qualquer outro arquivo de código — confirmar zero credenciais hardcoded
- [ ] T1.3: Configurar **Vercel Environment Variables** (Production):
  ```
  WHATSAPP_PHONE_NUMBER_ID   → obtido no Meta Developers Portal
  WHATSAPP_BUSINESS_ACCOUNT_ID → obtido no Meta Developers Portal
  WHATSAPP_ACCESS_TOKEN      → System User Token permanente
  WHATSAPP_VERIFY_TOKEN      → string aleatória (mínimo 32 chars)
  WHATSAPP_APP_SECRET        → App Secret do Meta (necessário para QA-01)
  ```
- [ ] T1.4: Configurar **Make.com Team Variables** (Team → Variables):
  ```
  ANTHROPIC_API_KEY          → sk-ant-api03-...
  AIRTABLE_API_KEY           → pat... (Personal Access Token — novo, revogado o anterior)
  AIRTABLE_BASE_ID           → app... (ID da base "Pousada Luz da Lua — CRM")
  EQUIPE_WHATSAPP_NUMBER     → número para notificações de escalonamento
  ```
- [ ] T1.5: Validar que nenhuma variável de ambiente aparece em logs do Vercel ou Make.com (testar com request de debug)
- [ ] T1.6: Registrar localização de cada secret em `docs/architecture/secrets-inventory.md` (sem os valores — apenas onde cada um está configurado)

### T2 — Otimização de Precificação por Período (2h) [DB-11]

> **Contexto:** A tabela de preços no Airtable contém linhas por período (baixa, fins de semana, alta temporada). Para uma estadia de 7 noites cruzando dois períodos, a abordagem ingênua faria 7 chamadas ao Airtable (1 por noite). Isso causa latência de 7-14 segundos só na fase de precificação.

- [ ] T2.1: Implementar **calculadora de período** no Make.com (antes das chamadas ao Airtable):
  ```
  INPUT: data_entrada, data_saida
  PROCESSO:
    1. Gerar lista de datas do período (Make.com Date functions)
    2. Para cada data, classificar: dia_útil | fim_de_semana | alta_temporada
    3. Agrupar datas por período → [{tipo: "baixa", noites: 3}, {tipo: "fim_de_semana", noites: 2}]
  OUTPUT: array de segmentos de período
  ```
- [ ] T2.2: Com os segmentos calculados localmente, fazer **uma única chamada ao Airtable** buscando todos os preços necessários (usando `filterByFormula` com OR para os tipos de período)
- [ ] T2.3: Calcular total no Make.com com operações matemáticas (sem chamadas adicionais):
  ```
  total = soma(noites_por_segmento × preco_por_segmento)
  ```
- [ ] T2.4: Atualizar `{{descricao_noites}}` no template de cotação (T3.3 do PLU-01.3) para detalhar precificação mista:
  ```
  Exemplo: "3 noites × R$300 (dias úteis) + 2 noites × R$350 (fim de semana)"
  ```
- [ ] T2.5: Testar com 5 cenários de período misto:
  - Estadia cruzando baixa → fim de semana
  - Estadia cruzando fim de semana → alta temporada
  - Estadia 100% em alta temporada (sem mistura)
  - Estadia de 1 noite (dia útil)
  - Estadia de 14 noites cruzando 3 períodos

---

## Dev Notes

### Calculadora de Períodos (Make.com)

O Make.com tem funções nativas para manipulação de datas:
- `parseDate()` — converte string DD/MM/YYYY para date object
- `addDays(date, n)` — adiciona dias
- `formatDate(date, "dddd")` — retorna dia da semana (Monday, Tuesday, etc.)

**Lógica de classificação:**
```javascript
// Pseudocódigo — implementar com Make.com Formula expressions
function classificarNoite(data) {
  const diaSemana = dayOfWeek(data); // 0=Dom, 1=Seg, ..., 6=Sáb
  if (isAltaTemporada(data)) return "alta";
  if (diaSemana === 0 || diaSemana === 5 || diaSemana === 6) return "fim_de_semana";
  return "baixa";
}
```

**Datas de Alta Temporada (confirmar anualmente):**
- Carnaval (sáb antes até quarta-feira de cinzas)
- Semana Santa (sexta-feira de ramos até domingo de Páscoa)
- Férias de julho (01/07 a 31/07)
- Natal (23/12 a 26/12)
- Réveillon (29/12 a 01/01)
- Feriados prolongados (3+ dias consecutivos)

### Referência de Segurança

| Credencial | Onde Configurar | Quem Precisa |
|-----------|----------------|-------------|
| WHATSAPP_ACCESS_TOKEN | Vercel Env Vars | handler.js (forward para Make.com) |
| WHATSAPP_APP_SECRET | Vercel Env Vars | handler.js (validação HMAC — QA-01) |
| WHATSAPP_VERIFY_TOKEN | Vercel Env Vars | handler.js (verificação de webhook) |
| ANTHROPIC_API_KEY | Make.com Team Vars | Módulo HTTP → Anthropic API |
| AIRTABLE_API_KEY | Make.com Team Vars | Módulo Airtable |
| AIRTABLE_BASE_ID | Make.com Team Vars | Módulo Airtable |

> **Regra:** Credenciais do Vercel ficam no Vercel. Credenciais do Make.com ficam no Make.com. Nunca cruzar (o handler.js **não** precisa da chave Anthropic).

### Testing

| Test ID | Nome | Tipo | Prioridade |
|---------|------|------|-----------|
| T-SEC-01 | Nenhuma credencial em código ou logs | Auditoria | P0 |
| T-SEC-02 | Request sem APP_SECRET configurado → erro explicativo | Smoke | P0 |
| T-PERF-01 | Cotação período misto (3 segmentos) em ≤ 10s | Performance | P0 |
| T-PERF-02 | Apenas 1 chamada ao Airtable para precificação (independente do número de noites) | Integration | P0 |
| T-PERF-03 | Cálculo correto para 5 cenários de período misto | Unit | P0 |

---

## 🤖 CodeRabbit Integration

### Story Type Analysis
**Primary Type:** Security / Infrastructure
**Secondary Type(s):** Performance
**Complexity:** Medium (sem novos sistemas — otimização de fluxo existente)

### Specialized Agent Assignment
**Primary Agents:**
- @dev (implementação da calculadora Make.com e auditoria de secrets)
- @devops (configuração de Vercel Environment Variables)

### Focus Areas
**Primary Focus:**
- Zero credenciais hardcoded ou commitadas
- Performance da cotação dentro do timeout da Meta (30s)

**Secondary Focus:**
- Legibilidade do cálculo de período misto para manutenção futura

---

## Dependencies

**Depends on:**
- PLU-01.1: Webhook handler (handler.js com QA-01 implementado)
- PLU-01.2: Make.com configurado com conexões básicas
- PLU-01.3: Fluxo de cotação completo (template T3.3 e módulo [COTAR])
- Airtable criado com tabela "Tabela de Preços" populada com dados reais

**Blocks:**
- Lançamento público do número (divulgação)

---

## Definition of Done

- [ ] Auditoria de secrets concluída — zero credenciais em código
- [ ] Todas as credenciais em Vercel Env Vars e Make.com Team Variables
- [ ] `docs/architecture/secrets-inventory.md` criado
- [ ] Cotação de período misto ≤ 10s (testado com 5 cenários)
- [ ] Apenas 1 chamada Airtable para precificação (independente do número de noites)
- [ ] @po valida os ACs

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-24 | 1.0 | Story criada — Brownfield Discovery Fase 10 (DT-08, DB-11) | Morgan (@pm) / Aria (@architect) |
