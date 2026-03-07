# Production Deploy Guide — Pousada Luz da Lua CRM

## Pre-requisites

### 1. Environment Variables (Vercel Dashboard)

All env vars must be set in Vercel project settings **before** deploy.

**Required (CRM will not start without these):**

| Variable | Where to get | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase > Settings > API | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API > service_role secret | `eyJhbGciOi...` |

**Required for full functionality:**

| Variable | Purpose | How to generate |
|----------|---------|----------------|
| `INTERNAL_API_KEY` | Webhook-to-CRM auth | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MERCADOPAGO_ACCESS_TOKEN` | PIX payments | MercadoPago Dashboard > Credentials |
| `MERCADOPAGO_WEBHOOK_SECRET` | Payment webhook validation | MercadoPago Dashboard > Webhooks |

**Already configured (WhatsApp/Luna):**

| Variable | Status |
|----------|--------|
| `ANTHROPIC_API_KEY` | Set |
| `WHATSAPP_ACCESS_TOKEN` | Set |
| `WHATSAPP_PHONE_NUMBER_ID` | Set |
| `WHATSAPP_VERIFY_TOKEN` | Set |
| `EQUIPE_WHATSAPP_NUMBER` | Set |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Set |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Set |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Set |

### 2. Supabase Auth — Create Admin User

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add user" > "Create new user"
3. Set email + password (this will be the CRM dashboard login)
4. The user will be `authenticated` role, which matches all RLS policies

### 3. Database Migrations

Migrations 001 + 002 are already applied. Verify:

```sql
-- Run in Supabase SQL Editor to confirm
SELECT count(*) FROM availability;  -- Should be 1460
SELECT count(*) FROM settings;      -- Should be 11
SELECT generate_reservation_number();  -- Should return RES-2026-XXXXX
```

**DO NOT apply `003_phase2_rms_tables.sql` yet** — it is a future feature (Revenue Management).

---

## Deploy Steps

### Step 1: Generate INTERNAL_API_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output. Add to:
- Local `.env`: `INTERNAL_API_KEY=<value>`
- Vercel env vars: same key+value

### Step 2: Set MercadoPago (or skip for now)

If MercadoPago is not ready, PIX payment endpoints will return 500 when called.
The rest of the CRM works without it. Configure when ready.

### Step 3: Verify Locally

```bash
npm install
npm test          # 11/11 pass
npm run test:api  # 29/29 pass
npm run lint      # 0 errors

# Start CRM server
npm run dev:api
# Open http://localhost:3001 — should show dashboard
# Open http://localhost:3001/health — should show { status: "ok" }
```

### Step 4: Deploy to Vercel

```bash
npx vercel --prod
```

### Step 5: Smoke Test Production

After deploy, verify these URLs (replace with your Vercel domain):

```bash
# Health check
curl https://YOUR-DOMAIN.vercel.app/health

# Dashboard loads
curl -s https://YOUR-DOMAIN.vercel.app/public/login.html | head -5

# API returns 401 (auth working)
curl -s https://YOUR-DOMAIN.vercel.app/api/leads | head -1

# WhatsApp webhook still works
curl https://YOUR-DOMAIN.vercel.app/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123
```

---

## Architecture Summary

```
Vercel Functions:
  api/index.js  --> services/whatsapp/webhook.js  (Luna chatbot)
  api/crm.js    --> server.js                      (CRM API)

Routing (vercel.json):
  /api/*   --> api/crm.js    (CRM endpoints)
  /*       --> api/index.js  (WhatsApp webhook + quotation)

Database:
  Supabase PostgreSQL (10 tables, 4 views, 6 RPCs)

Dashboard:
  public/login.html        (Supabase Auth)
  public/dashboard.html    (Pipeline overview)
  public/leads.html        (Lead management)
  public/proposals.html    (Proposal tracking)
  public/reservations.html (Reservation list)
```

## Rollback

If anything breaks after deploy:

```bash
# Revert to previous Vercel deployment
npx vercel rollback

# Or revert git changes
git log --oneline -5   # find last good commit
git revert HEAD        # revert last commit
npx vercel --prod      # redeploy
```

## Monitoring

After deploy, monitor:

1. **Vercel logs**: `npx vercel logs --follow`
2. **Health endpoint**: `GET /health` should return `{ status: "ok" }`
3. **WhatsApp**: Send test message to Luna, confirm response
4. **Dashboard**: Login with Supabase user, verify data loads

---

## Known Limitations (OK for now)

- RLS is permissive (all authenticated = full access) — fine for single-team use
- `ai_logs` and `daily_metrics` tables are empty — no cron jobs yet
- Proposal auto-expiry not implemented — manual PATCH needed
- MercadoPago integration requires separate configuration
