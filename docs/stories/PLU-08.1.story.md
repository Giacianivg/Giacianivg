# PLU-08.1 — Frontend Intelligence Widgets

**Epic:** EPIC-PLU-08 Dashboard de Operações e Métricas
**Status:** InProgress
**Points:** 5
**Priority:** Alta
**Created:** 2026-03-08
**Author:** River (@sm)

---

## Description

O backend já entrega 9 novos endpoints de inteligência (scoring, funil, receita, alertas, follow-ups) implementados no servidor. O frontend ainda não consome esses dados. Esta story adiciona os widgets de inteligência no dashboard existente e na tela de leads, além de criar a página de follow-ups, sem alterar a estrutura ou o padrão visual atual.

**Problema:** O gestor não consegue ver métricas de pipeline, funil de vendas, alertas nem follow-ups pendentes — dados que o backend já calcula e expõe.

**Solução:** Adicionar widgets e uma página nova aproveitando os endpoints existentes, replicando exatamente o padrão visual dark (slate-900/800/700, Tailwind CSS).

---

## Acceptance Criteria

### AC-1: Dashboard — Card "Receita em Pipeline"
**Given** o gestor acessa dashboard.html
**When** a página carrega
**Then** deve exibir um card novo com o valor `weighted_pipeline` formatado em BRL, buscado de `GET /api/analytics/revenue/pipeline`
**And** mostrar `--` se o endpoint falhar (graceful error)
**And** mostrar estado de loading até resposta

### AC-2: Dashboard — Widget Funil Visual
**Given** o gestor acessa dashboard.html
**When** a página carrega
**Then** deve exibir barras horizontais por estágio do funil com contagem de leads, a partir de `GET /api/analytics/funnel`
**And** as barras devem usar a cor purple-600 (padrão da aplicação)
**And** mostrar `--` se o endpoint falhar

### AC-3: Dashboard — Card "Gargalo Atual"
**Given** o gestor acessa dashboard.html
**When** a página carrega
**Then** deve exibir o estágio com mais leads parados e a contagem, de `GET /api/analytics/funnel/bottleneck`
**And** mostrar `--` se o endpoint falhar

### AC-4: Dashboard — Seção Alertas
**Given** o gestor acessa dashboard.html
**When** a página carrega
**Then** deve exibir lista de alertas ativos de `GET /api/alerts/active`
**And** cada alerta deve ter badge colorido por tipo (IDLE=amber, STALE=red, FOLLOW_UP=blue)
**And** mostrar "Nenhum alerta ativo" se lista vazia
**And** mostrar `--` se o endpoint falhar

### AC-5: Leads — Coluna Score
**Given** o gestor acessa leads.html e visualiza a tabela de leads
**When** a tabela carrega
**Then** deve exibir coluna "Score" com badge emoji (🔥 HOT / 🟡 WARM / 🟠 COOL / ❄️ COLD)
**And** o score é buscado de `GET /api/leads/:id/score` individualmente
**And** mostrar `--` se o endpoint do score falhar para aquele lead

### AC-6: Leads — Coluna Alerta (substituindo "undefined")
**Given** o gestor visualiza a tabela de leads
**When** um lead tem `alert_message`
**Then** deve exibir a mensagem de alerta na coluna dedicada (sem "undefined")
**When** o lead não tem alerta
**Then** a coluna fica vazia ou mostra `--`

### AC-7: Leads — Botão Dispensar Alerta
**Given** um lead tem alerta na tabela
**When** o gestor clica em "Dispensar"
**Then** deve chamar `POST /api/alerts/:leadId/dismiss`
**And** o alerta é removido visualmente da linha sem recarregar a página

### AC-8: Página Follow-ups
**Given** o gestor acessa follow-ups.html
**When** a página carrega
**Then** deve exibir tabela com follow-ups pendentes de `GET /api/follow-ups/pending`
**And** colunas: Lead, Tipo, Agendado para, Status
**And** botão "Cancelar" em cada linha que chama `DELETE /api/follow-ups/:id/cancel`
**And** linha removida visualmente após cancelamento
**And** mostrar "Nenhum follow-up pendente" se lista vazia

### AC-9: Link Follow-ups no Menu
**Given** o gestor acessa qualquer página (dashboard, leads, reservas, propostas, follow-ups)
**When** visualiza o menu lateral
**Then** deve ver link "Follow-ups" com ícone consistente com o padrão do menu

---

## Scope

### IN
- Adicionar widgets em dashboard.html (AC-1 a AC-4)
- Modificar tabela de leads.html (AC-5 a AC-7)
- Criar follow-ups.html nova (AC-8)
- Atualizar menu lateral em todos os HTML existentes (AC-9)
- Usar padrão visual existente: dark theme, slate, Tailwind, `api()` helper de app.js

### OUT
- Não criar novos endpoints no backend
- Não alterar estrutura de autenticação
- Não modificar lógica de reservas, propostas ou calendário
- Não criar novos arquivos JS separados (manter código inline nas páginas)

---

## Technical Notes

### API Base URL
Todos os endpoints usam `api('/path')` do `app.js` (linha 13: `const API_BASE = '/api'`).

### Endpoints mapeados
| Endpoint | Uso |
|----------|-----|
| `GET /api/analytics/revenue/pipeline` | card receita pipeline |
| `GET /api/analytics/funnel` | widget funil (barras) |
| `GET /api/analytics/funnel/bottleneck` | card gargalo |
| `GET /api/alerts/active` | seção alertas dashboard |
| `GET /api/leads/:id/score` | badge score em leads.html |
| `POST /api/alerts/:leadId/dismiss` | botão dispensar alerta |
| `GET /api/follow-ups/pending` | tabela follow-ups.html |
| `DELETE /api/follow-ups/:id/cancel` | cancelar follow-up |

### Padrão Visual (replicar exatamente)
- Body: `bg-slate-900 text-slate-100`
- Cards: `bg-slate-800 rounded-xl p-5 border border-slate-700`
- Labels: `text-xs text-slate-400 uppercase tracking-wide mb-1`
- Valores: `text-3xl font-bold text-white` (KPIs) ou `text-sm text-white` (listas)
- Accent/links: `text-purple-400 hover:text-purple-300`
- Barras funil: `bg-purple-600`
- Badge HOT: `bg-red-900/30 text-red-400 border border-red-700`
- Badge WARM: `bg-amber-900/30 text-amber-400 border border-amber-700`
- Badge COOL: `bg-orange-900/30 text-orange-400 border border-orange-700`
- Badge COLD: `bg-slate-700 text-slate-400 border border-slate-600`
- Badge alerta IDLE: `bg-amber-900/30 text-amber-400`
- Badge alerta STALE: `bg-red-900/30 text-red-400`
- Badge alerta FOLLOW_UP: `bg-blue-900/30 text-blue-400`

---

## Dependencies

- EPIC-PLU-07 backend parcialmente: endpoints `/api/analytics`, `/api/alerts`, `/api/follow-ups`, `/api/scoring` já implementados em `server.js` (commit `0bf3c78`)
- Não depende de outros stories para iniciar

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Endpoint score por lead → N+1 requests | Médio | Throttle ou Promise.allSettled com limite |
| Endpoints novos retornando 404 em produção | Alto | Graceful fallback com `--` + testar localmente primeiro |
| Inconsistência visual na página nova | Baixo | Copiar sidebar exata de leads.html como template |

---

## Definition of Done

- [x] AC-1: Card receita pipeline no dashboard
- [x] AC-2: Widget funil visual no dashboard
- [x] AC-3: Card gargalo no dashboard
- [x] AC-4: Seção alertas no dashboard
- [x] AC-5: Coluna score na tabela de leads
- [x] AC-6: Coluna alerta sem "undefined" na tabela de leads
- [x] AC-7: Botão dispensar alerta funcionando
- [x] AC-8: follow-ups.html criada e funcional
- [x] AC-9: Link follow-ups no menu de todas as páginas
- [ ] Padrão visual 100% consistente com o existente
- [ ] Graceful error (-- em falha) em todos os widgets
- [ ] Mobile-friendly seguindo padrão atual

---

## File List

- `public/dashboard.html` — adicionar widgets AC-1 a AC-4
- `public/leads.html` — modificar tabela (AC-5, AC-6, AC-7)
- `public/follow-ups.html` — criar nova página (AC-8)
- `public/dashboard.html`, `public/leads.html`, `public/reservations.html`, `public/proposals.html` — adicionar link menu (AC-9)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-08 | 1.0 | Story criada | River (@sm) |
| 2026-03-08 | 1.1 | Validação GO (10/10) — Status Draft→Ready | Pax (@po) |
| 2026-03-08 | 1.2 | Implementação completa — todos os 9 ACs entregues | Dex (@dev) |
