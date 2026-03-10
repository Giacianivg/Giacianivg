# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pousada Luz da Lua** — Growth Operations platform for a pousada (inn) in Socorro-SP.
Stack: WhatsApp → Meta Cloud API → Vercel (two serverless functions) → Claude Haiku → Supabase + Google Sheets

**Production URL:** https://webhook-six-topaz.vercel.app

## Commands

All commands run from the project root (`meu-projeto/`):

```bash
npm install            # install dependencies
npm run dev            # WhatsApp webhook with hot-reload (port 3000)
npm run dev:api        # CRM API with hot-reload (port 3001)
npm test               # run all unit tests (node:test native runner)
npm run test:api       # run API integration tests only
npm run lint           # ESLint check
npm run setup-sheets   # initialize Google Sheets tabs and headers (run once)
npx vercel --prod      # deploy to Vercel (run from project root)
```

Run a specific test file:
```bash
node --test tests/scoring/lead-scorer.test.js
```

## Architecture

### Two Express apps, two Vercel functions

```
vercel.json routes:
  /api/* → api/crm.js   → server.js        (CRM dashboard API, port 3001)
  /*      → api/index.js → services/whatsapp/webhook.js  (WhatsApp bot, port 3000)
```

### WhatsApp data flow

```
Guest (WhatsApp) → Meta Cloud API
  → POST /webhook (services/whatsapp/webhook.js)  ← MUST respond 200 in <5s
  → ConversationStateMachine (state tracking in Supabase)
  → Claude Haiku (claude-haiku-4-5-20251001) ~600ms
  → Meta Cloud API (send reply to guest)
  → Google Sheets + Supabase (history async)
  → WhatsApp equipe (EQUIPE_WHATSAPP_NUMBER) on [ESCALAR] or [CONFIRMAR]
```

**CRITICAL:** Never add processing before `res.sendStatus(200)` in `POST /webhook`. All Claude + Sheets + Supabase calls are async after the 200 response.

### Project structure

```
meu-projeto/
├── api/
│   ├── index.js              # Vercel thin wrapper → webhook.js
│   └── crm.js                # Vercel thin wrapper → server.js
├── services/
│   ├── whatsapp/webhook.js   # WhatsApp bot: /webhook, /quote, /health, /privacy
│   ├── luna/system-prompt.js # Luna identity, rules, control signals (canonical source)
│   ├── quotation/
│   │   ├── engine.js         # calculateQuotation() + formatWhatsAppMessage()
│   │   └── proposalService.js
│   ├── supabase/client.js    # supabaseAdmin (bypasses RLS) + supabasePublic (respects RLS)
│   ├── state-machine/index.js # ConversationStateMachine — tracks conversation states in Supabase
│   ├── crm/index.js          # CRM service layer
│   ├── scoring/
│   │   ├── lead-scorer.js    # Lead scoring logic
│   │   └── scoring-trigger.js
│   ├── follow-up/
│   │   ├── follow-up-cron.js       # Cron job (started at boot)
│   │   ├── follow-up-scheduler.js
│   │   ├── follow-up-executor.js
│   │   ├── quote-event-listener.js # Started at boot
│   │   └── templates.js
│   ├── analytics/
│   │   ├── funnel-analytics.js
│   │   └── revenue-analytics.js
│   ├── alerts/alert-calculator.js
│   ├── payments/mercadopago.js
│   └── utils/               # dates.js, response.js, currency.js
├── routes/                  # CRM API route modules (mounted in server.js)
│   ├── leads.js, conversations.js, reservations.js, reservations-confirm.js
│   ├── proposals.js, payments.js, follow-ups.js
│   ├── availability.js, availability-block.js, availability-unblock.js, availability-calendar.js
│   ├── scoring.js, analytics.js, alerts.js
├── database/
│   ├── sheets.js            # Google Sheets client (Histórico, Leads, Clientes)
│   ├── setup.js             # Initialize Sheets tabs/headers (run once)
│   ├── migrations/          # SQL migrations for Supabase (001–006)
│   ├── migrate.js           # Migration runner
│   └── scripts/migrate-sheets-to-supabase.js
├── public/                  # Static frontend dashboard (served by CRM app)
│   ├── dashboard.html, leads.html, reservations.html, proposals.html
│   ├── follow-ups.html, login.html, app.js
├── server.js                # CRM Express app (port 3001): auth, rate limiting, routes
├── agents/                  # Luna definition and planned agents
├── tests/                   # Unit + integration tests (node:test)
├── vercel.json              # Two serverless functions: api/index.js, api/crm.js
└── docs/                    # Stories, PRD, architecture, migrations docs
```

### Luna control signals

`services/luna/system-prompt.js` outputs control tokens parsed by `webhook.js` before sending to guest:

| Signal | Trigger | Action |
|--------|---------|--------|
| `[ESCALAR: motivo]` | Can't answer / complaint / human requested | Notify team, send escalation message |
| `[COTAR: tipo=, data_entrada=, data_saida=, pessoas=]` | Guest provides dates + guests | Calls `calculateQuotation()`, inserts result |
| `[CONFIRMAR: params]` | Guest confirms booking | Notifies team for manual confirmation |
| `[NOME: NomeCapturado]` | Name detected in conversation | Saved to CRM profile |

### Quotation engine

- Rooms (auto-quoted): `ALA_A` (≤3px), `ALA_B` (≤5px), `ALA_C_CASAL` (≤8px)
- `ALA_C_GRUPO` always returns `{ escalar: true }` — requires human
- Season: months 1, 7, 12 = alta; weekends = media; else baixa
- Alta/feriado: R$400 base (≤2px) + R$150/px additional
- Discounts: 7+ nights = 10%, 14+ nights = 15%
- Dates as `DD/MM/YYYY`; minimum 2 nights only during feriados/events

### State machine

`services/state-machine/index.js` tracks conversation states per phone number in Supabase (`conversation_states` table). States: idle, collecting_dates, collecting_guests, awaiting_confirmation, escalated, etc.

### CRM API (server.js)

Auth: Supabase JWT via `Authorization: Bearer <token>` or internal calls via `X-Internal-Key` header. Rate limited (120 req/min in-memory). Serves static files from `public/` for the dashboard.

### Database

- **Supabase**: Primary database for conversations, leads, reservations, proposals, scoring, follow-ups, availability, alerts. `supabaseAdmin` client bypasses RLS.
- **Google Sheets**: Secondary log (Histórico, Leads, Clientes). Controlled by `SHEETS_ENABLED` env var.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API |
| `WHATSAPP_ACCESS_TOKEN` | Meta System User Token (permanent) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developers Portal |
| `WHATSAPP_VERIFY_TOKEN` | Webhook challenge token |
| `WHATSAPP_APP_SECRET` | For X-Hub-Signature-256 validation (currently disabled) |
| `EQUIPE_WHATSAPP_NUMBER` | Team number e.g. `5519998400306` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Public key (respects RLS, for dashboard) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Sheets ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account key |
| `SHEETS_ENABLED` | Set to `false` to disable Sheets (default: enabled) |
| `ALLOWED_ORIGIN` | CORS origin for CRM dashboard |
| `API_PORT` | CRM API port (default: 3001) |

## Known Issues

- `WHATSAPP_APP_SECRET` validation is temporarily disabled (`webhook.js:30`). The validation code exists but is bypassed with an early `return next()`.
- `WHATSAPP_ACCESS_TOKEN` can expire — replace via Meta Business Portal with a System User Token set to "Never expires".

## Stories & Epics

Current work tracked in `docs/stories/`. Active epic: `EPIC-PLU-01` (sales funnel automation).

---

## Sistema Operacional (AI-OS)

**Orquestrador:** AIOS Master (`@aios-master`) coordena todos os agentes abaixo.

### Estado Atual — Componentes Funcionando

| Componente | Status | Localização |
|-----------|--------|-------------|
| Bot Luna (WhatsApp) | ✅ | `services/whatsapp/webhook.js` |
| CRM Dashboard | ✅ | `server.js` + `public/` + `routes/` |
| Design System v1.0 | ✅ | `public/design-system/` (c.css, l.css, t.css, u.js) |
| Lead Scoring | ✅ | `services/scoring/lead-scorer.js` |
| Follow-up Automático | ✅ | `services/follow-up/follow-up-cron.js` |
| Dynamic Pricing Base | ✅ | `services/quotation/engine.js` |
| Supabase (banco principal) | ✅ | `services/supabase/client.js` |
| Analytics | ✅ | `services/analytics/` |

### Camada AI-OS

**Localização:** `ai-os/` — Camada de inteligência estratégica sobre o sistema existente.

#### C-Level Board
| Agente | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| CEO | `ai-os/board/ceo-agent.md` | Direção estratégica, Pareto³ |
| CMO | `ai-os/board/cmo-agent.md` | Marketing, aquisição, Growth Squad |
| CPO | `ai-os/board/cpo-agent.md` | Produto, UX, roadmap |
| CTO | `ai-os/board/cto-agent.md` | Arquitetura, infra, veto técnico |
| CFO | `ai-os/board/cfo-agent.md` | Finanças, pricing dinâmico |

#### Engines
- **Decision Engine** (`ai-os/decision-engine/`) — Votação ponderada: CEO 30% | CMO 25% | CPO 20% | CTO 15% | CFO 10%
- **Strategy Engine** (`ai-os/strategy-engine/`) — Converte decisões aprovadas em planos de execução
- **Demand Prediction** (`ai-os/data/demand-prediction.md`) — Previsão de ocupação 60 dias
- **Revenue Optimization** (`ai-os/data/revenue-optimization.md`) — Precificação dinâmica

#### Squads
- **Growth Squad** (`ai-os/squads/growth-squad.md`) → CMO | Media Buyer, Funnel Builder, CRO, Analytics
- **Product Squad** (`ai-os/squads/product-squad.md`) → CPO | @pm, @po, @sm, UX Expert, Analyst
- **Revenue Squad** (`ai-os/squads/revenue-squad.md`) → CFO | Analytics, Forecast, Pricing Optimizer

### Fluxo Padrão de Orquestração

```
Detecção (alerta KPI / input Founder)
      ↓
Análise (CEO aplica Pareto³)
      ↓
Votação (Decision Engine — score ponderado)
      ↓
Execução (Strategy Engine → Squads)
      ↓
Monitoramento (feedback loop → decision-history/)
```

---

## Regras de Ouro CTO

### PROIBIDO sem aprovação explícita do CTO
- Alterar `server.js` (Express core — auth, rate limiting, routes mount)
- Modificar `vercel.json` (altera deployment, pode quebrar produção)
- Tocar em `services/whatsapp/webhook.js` (contrato com Meta API — resposta 200 em <5s)
- Mudar `services/luna/system-prompt.js` (identidade e regras da Luna)
- Sobrescrever agentes existentes em `agents/` (luna, reservations, crm, ads)
- Modificar migrations existentes `database/migrations/001–006`

### SEGURO sem restrições
- Adicionar arquivos em `ai-os/`
- Criar novas migrations numeradas a partir de `007`
- Adicionar novas routes em `routes/` (montar em server.js requer aprovação)
- Criar novos services em `services/` (novos arquivos, não modificar existentes)
- Criar stories em `docs/stories/`

---

## KPIs Monitorados

| KPI | Meta | Fonte |
|-----|------|-------|
| Taxa de ocupação | > 70% | `services/analytics/revenue-analytics.js` |
| RevPAR | > R$ 250 | `services/analytics/revenue-analytics.js` |
| CAC (custo aquisição) | < R$ 150 | `agents/ads-agent.md` |
| LTV (lifetime value) | > R$ 3.000 | `services/crm/index.js` |
| Conversão lead→reserva | > 8% | `services/analytics/funnel-analytics.js` |
| Tempo resposta Bot Luna | < 2s | `services/whatsapp/webhook.js` |
| NPS | > 8 | Feedback pós-estadia |

---

## Tabela de Referência Rápida

| Arquivo | Função | Usado por |
|---------|--------|-----------|
| `services/whatsapp/webhook.js` | Webhook WhatsApp, orquestra respostas | Vercel, Meta API |
| `services/luna/system-prompt.js` | Identidade Luna + sinais de controle | `webhook.js` |
| `services/quotation/engine.js` | Cálculo de cotações + dynamic pricing | Luna, CFO Agent |
| `services/analytics/revenue-analytics.js` | Ocupação, receita, RevPAR | CEO, CFO, Demand Engine |
| `services/analytics/funnel-analytics.js` | Funil leads→reservas | CMO, CEO |
| `services/crm/index.js` | Leads, conversas, perfis | CRM API, Luna |
| `services/follow-up/follow-up-cron.js` | Follow-ups automáticos | Boot (cron) |
| `services/scoring/lead-scorer.js` | Score de leads | CRM, Revenue Squad |
| `services/alerts/alert-calculator.js` | Alertas operacionais | CEO, CFO |
| `routes/` (13 módulos) | API REST do CRM | `server.js` |
| `database/migrations/` | Schema Supabase (001–006) | `database/migrate.js` |
| `ai-os/` | Camada AI-OS estratégica | AIOS Master, C-Level Board |

---

## Segurança & Permissões

### Hierarquia
```
AIOS Master (@aios-master)
      ↓
C-Level Board (CEO/CMO/CPO/CTO/CFO)
      ↓
Squads (Growth / Product / Revenue / Engineering)
```

### Regras
- **CTO veto absoluto:** score CTO < 30 bloqueia qualquer proposta no Decision Engine
- **QA bloqueia deploy:** issues CRITICAL não resolvidas impedem push para produção
- **Migrations irreversíveis:** nunca alterar `001–006`, sempre criar nova numerada
- **Auth CRM:** Supabase JWT obrigatório para todas as rotas (exceto `X-Internal-Key` para chamadas internas)
- **Webhook:** validação `X-Hub-Signature-256` existe mas está desabilitada temporariamente (`webhook.js:30`)
