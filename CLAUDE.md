# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pousada Luz da Lua** — Growth Operations platform for a pousada (inn) in Socorro-SP.
Stack: WhatsApp → Vercel (handler.js) → Make.com → Claude/DeepSeek → Airtable

The only managed code lives in `src/`. Everything else is no-code SaaS (Make.com, Airtable, Meta API).

## Commands

All commands run from the project root (`meu-projeto/`):

```bash
npm install          # install dependencies
npm run dev          # run locally with hot-reload (node --watch)
npm test             # run 11 unit tests (node:test native runner)
npm run lint         # ESLint check
npm run setup-sheets # initialize Google Sheets tabs and headers
npx vercel --prod    # deploy to Vercel (run from project root)
```

Test the chatbot system prompt (from `src/chatbot/`):
```bash
cd src/chatbot
node test-system-prompt.js   # automated tests against Claude API
```

## Architecture

### Data flow

```
Guest (WhatsApp) → Meta Cloud API
  → POST /webhook (Vercel, services/whatsapp/webhook.js)  ← must respond 200 in <5s
  → Claude Haiku (claude-haiku-4-5-20251001) ~600ms
  → Meta Cloud API (send reply to guest)
  → Google Sheets (history async)
  → WhatsApp equipe (19998400306) on [ESCALAR] or [CONFIRMAR]
```

### Project structure

```
meu-projeto/
├── agents/                          # AI agent definitions
│   ├── luna.md                      # [ACTIVE] WhatsApp chatbot
│   ├── reservations-agent.md        # [PLANNED] booking flow
│   ├── crm-agent.md                 # [PLANNED] retention
│   └── ads-agent.md                 # [PLANNED] marketing
├── services/
│   ├── whatsapp/webhook.js          # Express app: /webhook, /quote, /health, /privacy
│   ├── luna/system-prompt.js        # Luna identity, rules, and control signals
│   └── quotation/engine.js          # Pricing: calculateQuotation() + formatWhatsAppMessage()
├── database/
│   ├── sheets.js                    # Google Sheets client (Histórico, Leads, Clientes)
│   └── setup.js                     # Initialize Sheets tabs/headers (run once)
├── api/index.js                     # Vercel thin wrapper (maxDuration 30s)
├── tests/handler.test.js            # 11 unit tests
├── vercel.json                      # Serverless deploy config
└── .env.example                     # AIOS framework env vars (see src/webhook/.env.example for pousada vars)
```

### webhook.js critical constraint

**NEVER add processing before `res.sendStatus(200)` in `POST /webhook`.** Meta will retry and potentially block the number if it doesn't receive 200 within 5 seconds. All processing is async after the 200 response.

### Luna control signals

The Claude system prompt (`services/luna/system-prompt.js`) outputs control tokens parsed by `webhook.js` before sending to the guest:

| Signal | Trigger | Make.com action |
|--------|---------|-----------------|
| `[ESCALAR]` | Can't answer / complaint / human requested | Notify team at (19) 99840-0306, send escalation message |
| `[COTAR: params]` | Guest provides dates + guests + room type | Call `POST /quote` on Vercel, insert result |

### Quotation engine (`quotation.js`)

- Rooms: `ALA_A`, `ALA_B`, `ALA_C_CASAL` — priced automatically
- `ALA_C_GRUPO` always returns `{ escalar: true }` — requires human
- Season detection: months 1, 7, 12 = alta; weekends = media; else baixa
- Discounts: 7+ nights = 10%, 14+ nights = 15%
- Input format: dates as `DD/MM/YYYY`

### Vercel vs local

`handler.js` detects its execution context:
- `require.main === module` → calls `app.listen()` (local dev)
- Otherwise → exports `app` for Vercel serverless + tests

## Required Environment Variables

Defined in `src/webhook/.env.example`. Set as Vercel environment variables for production:

- `WHATSAPP_VERIFY_TOKEN` — webhook challenge token (chosen by us)
- `WHATSAPP_PHONE_NUMBER_ID` — from Meta Developers Portal
- `WHATSAPP_ACCESS_TOKEN` — System User Token (never expires)
- `MAKE_WEBHOOK_URL` — Make.com scenario webhook URL

## Stories & Epics

Current work tracked in `docs/stories/`. Active epic: `EPIC-PLU-01` (sales funnel automation).

| Story | Status | Focus |
|-------|--------|-------|
| PLU-01.1 | InProgress | WhatsApp Business API migration (human actions pending) |
| PLU-01.2 | InProgress | Claude + Make.com chatbot base (human actions pending) |
| PLU-01.3 | Pending | Full quotation funnel (depends on 01.1 + 01.2) |
| PLU-01.4 | Pending | Production hardening (secrets, proration optimization) |

## Known Blockers (require human action, not code)

- **DT-01/02:** Register webhook URL in Meta + migrate WhatsApp number
- **DT-03:** Configure Make.com scenarios using blueprints in `docs/make-com/`
- **DT-04:** Create Airtable base using schema in `docs/architecture/airtable-schema.md`

## Airtable Tables

| Table | Purpose |
|-------|---------|
| `Conversas` | Lead history and interactions |
| `Disponibilidade` | Availability calendar by room type |
| `Tabela de Preços` | Rates by season and room type |

Room type IDs used across Make.com, Airtable, and `/quote`: `ALA_A`, `ALA_B`, `ALA_C_GRUPO`, `ALA_C_CASAL`
