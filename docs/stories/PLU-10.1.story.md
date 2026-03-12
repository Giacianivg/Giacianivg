# PLU-10.1 — Dashboard: Diagnóstico e Correção de Widgets

**Epic:** EPIC-PLU-10 CRM Completo (DEC-015)
**Status:** Done
**Points:** 3
**Priority:** Alta (P1)
**Created:** 2026-03-11
**Author:** Morgan (@pm)

---

## Description

O Dashboard (`public/dashboard.html`) chama 4 endpoints mas exibe `—` em quase todos os KPIs. A investigação revelou **mismatches de campo** entre o que as APIs retornam e o que o frontend lê. Nenhum dado precisa ser criado — apenas os mapeamentos precisam ser corrigidos.

**Problema:** Widgets de Pipeline, Funil, Taxa de Conversão e Alertas mostram dados incorretos ou vazios por erros de campo.

**Causa-raiz identificada:**
1. `/api/analytics/funnel` → retorna `{ funnel: { stages, conversion_rate } }` — frontend lê `result.stages` (deveria ser `result.funnel.stages`)
2. `/api/analytics/revenue/pipeline` → retorna `{ revenue: { total_pipeline, leads_count } }` — frontend lê `result.total_pipeline` (deveria ser `result.revenue.total_pipeline`)
3. `/api/alerts/active` → retorna `alert_message` e `alert_type` — frontend lê `a.message` e `a.severity`

---

## Acceptance Criteria

### AC-1: KPI Pipeline exibe valor real
**Given** GET /api/analytics/revenue/pipeline retorna `{ revenue: { total_pipeline: 1800, leads_count: 3 } }`
**When** dashboard carrega
**Then** card "Pipeline" exibe R$ 1.800 (não "—")

### AC-2: Funil de Conversão exibe barras
**Given** GET /api/analytics/funnel retorna `{ funnel: { stages: [...], conversion_rate: 0.12 } }`
**When** dashboard carrega
**Then** painel de funil exibe barras horizontais por estágio (não "Sem dados")

### AC-3: Taxa de Conversão exibe percentual
**Given** API retorna conversion_rate: 0.1234
**When** dashboard carrega
**Then** card "Taxa de Conversão" exibe "12.3%" (não "—")

### AC-4: KPI Reservas usa dado disponível
**Given** API de pipeline retorna `leads_count` (sem `confirmed_count`)
**When** dashboard carrega
**Then** card "Leads em Pipeline" exibe contagem real de leads ativos

### AC-5: Alertas exibem mensagem e tipo corretos
**Given** GET /api/alerts/active retorna `[{ alert_message: "Lead sem resposta há 48h", alert_type: "no_response" }]`
**When** dashboard carrega
**Then** alerta exibe a mensagem e badge com tipo correto (não em branco)

---

## Scope

**IN:**
- Correção de mapeamentos de campo no `public/dashboard.html`
- Labels dos cards ajustados para refletir o que a API realmente entrega

**OUT:**
- Não criar novas APIs
- Não alterar `server.js` ou nenhum arquivo de backend
- Não alterar design ou layout

---

## File List

- [x] `public/dashboard.html` — corrigir mapeamentos de campo

---

## Change Log

| Data | Autor | Ação |
|------|-------|------|
| 2026-03-11 | Morgan @pm | Story criada — Status: InProgress |
