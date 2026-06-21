'use strict';

require('dotenv').config();

const express = require('express');
const path    = require('path');
const app = express();

const PORT = process.env.API_PORT || 3001;

// ─── CORS ───────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.ALLOWED_ORIGIN,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const inProd = process.env.NODE_ENV === 'production';
  if (!inProd || !origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Rate limiting (in-memory, per-IP) ─────────────────────────────────────────
const _rateStore = new Map();
function rateLimiter(windowMs = 60_000, max = 120) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = req.ip || 'unknown';
    const now  = Date.now();
    let rec = _rateStore.get(key);
    if (!rec || now > rec.resetAt) {
      rec = { count: 1, resetAt: now + windowMs };
    } else {
      rec.count++;
    }
    _rateStore.set(key, rec);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rec.count));
    if (rec.count > max) {
      return res.status(429).json({ success: false, error: 'rate_limit', message: 'Too many requests, try again later' });
    }
    next();
  };
}

// ─── Auth middleware (Supabase JWT) ────────────────────────────────────────────
async function requireCrmAuth(req, res, next) {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') return next();

  // Internal service calls (e.g. webhook → CRM)
  const internalKey = req.headers['x-internal-key'];
  if (internalKey && process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Missing Authorization header' });
  }

  try {
    const { supabaseAdmin } = require('./services/supabase/client');
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(503).json({ success: false, error: 'service_unavailable', message: 'Auth service error' });
  }
}

// ─── Colors for terminal logging ───────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

function methodColor(m) {
  return { GET: C.cyan, POST: C.green, PATCH: C.yellow, DELETE: C.red }[m] || C.blue;
}

function statusColor(s) {
  if (s < 300) return C.green;
  if (s < 400) return C.yellow;
  return C.red;
}

// ─── Request logger ────────────────────────────────────────────────────────────
function mkReqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

app.use((req, res, next) => {
  const start = Date.now();
  req.reqId = mkReqId();
  const mc = methodColor(req.method);
  res.on('finish', () => {
    const ms = Date.now() - start;
    const sc = statusColor(res.statusCode);
    const ts = new Date().toTimeString().slice(0, 8);
    console.log(
      `${C.gray}${ts}${C.reset}  ` +
      `${mc}${C.bold}${req.method.padEnd(6)}${C.reset}  ` +
      `${C.bold}${req.path}${C.reset}` +
      (Object.keys(req.query).length ? C.dim + '?' + new URLSearchParams(req.query).toString() + C.reset : '') +
      `  ${sc}${res.statusCode}${C.reset}  ${C.gray}${ms}ms${C.reset}  ${C.dim}[${req.reqId}]${C.reset}`
    );
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: res.statusCode < 400 ? 'info' : 'error',
        svc: 'crm',
        event: 'http_request',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: ms,
        reqId: req.reqId,
      }));
    }
  });
  next();
});

app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/design-system', express.static(path.join(__dirname, 'public', 'design-system')));
app.use('/landing', express.static(path.join(__dirname, 'public', 'landing')));

// ─── Public Debug Endpoint (no auth required) ──────────────────────────────────
// MUST be before auth middleware
app.get('/api/conversations/debug/:lead_id', async (req, res) => {
  const { supabaseAdmin } = require('./services/supabase/client');
  const { ok, serverError } = require('./services/utils/response');
  const lead_id = req.params.lead_id;

  // Count total messages
  const { count, error: countError } = await supabaseAdmin
    .from('conversations')
    .select('id', { count: 'exact' })
    .eq('lead_id', lead_id);

  // Get the 10 most recent messages
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, lead_id, role, content, created_at')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[conversations/debug] Error:', error);
    return serverError(res, error);
  }

  console.log(`[conversations/debug] Total: ${count}, Last 10:`, data?.length || 0);
  return ok(res, {
    total_count: count || 0,
    last_10_messages: (data || []).reverse(), // Reverse to show oldest first
    timestamp: new Date().toISOString(),
  });
});

// ─── Public API Health (sem auth — deve estar antes do middleware de auth) ─────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pousada-crm-api', ts: Date.now() });
});

// ── Public site API (DEC-025) — SEM AUTH. Montada ANTES do rate limiter/auth de
//    /api para não exigir JWT do CRM (Turnstile + store próprio no router).
app.use('/api/public', require('./routes/public'));

// Apply rate limiting and auth to all /api/* routes
app.use('/api', rateLimiter());
app.use('/api', (req, res, next) => {
  return requireCrmAuth(req, res, next);
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/leads',                      require('./routes/leads'));
app.use('/api/conversations',              require('./routes/conversations'));
app.use('/api/availability/calendar',      require('./routes/availability-calendar'));
app.use('/api/availability/block',         require('./routes/availability-block'));
app.use('/api/availability/unblock',       require('./routes/availability-unblock'));
app.use('/api/availability/caps',          require('./routes/availability-caps'));
app.use('/api/availability',               require('./routes/availability'));
app.use('/api/occupancy',                  require('./routes/occupancy'));
app.use('/api/proposals',                  require('./routes/proposals'));
app.use('/api/reservations/confirm',       require('./routes/reservations-confirm'));
app.use('/api/reservations',               require('./routes/reservations'));
app.use('/api/payments',                   require('./routes/payments'));
app.use('/api/products',                   require('./routes/products'));
app.use('/api/room-charges',               require('./routes/room-charges'));

// ─── Intelligence Layer Routes ──────────────────────────────────────────────────
app.use('/api',                            require('./routes/scoring'));
app.use('/api/analytics',                  require('./routes/analytics'));
app.use('/api/follow-ups',                 require('./routes/follow-ups'));
app.use('/api/alerts',                     require('./routes/alerts'));
app.use('/api/ai',                         require('./routes/ai-activity'));
app.use('/api/blackboard',                 require('./routes/blackboard'));
app.use('/api/luna-config',                require('./routes/luna-config'));
app.use('/api/rooms',                      require('./routes/rooms'));
app.use('/api/financial',                  require('./routes/financial'));
app.use('/api/vouchers',                   require('./routes/vouchers'));
app.use('/api/competitor-prices',          require('./routes/competitor-prices'));
app.use('/api/pricing',                    require('./routes/pricing'));
app.use('/auth',                           require('./routes/auth'));

// ─── Cron: scraping diário de concorrentes (Vercel Cron → 03h UTC) ──────────
app.get('/api/cron/competitor-prices', async (req, res) => {
  const { runDailyScrape } = require('./services/competitor/scraper');
  const { generateDailyReport } = require('./services/revenue-intelligence/revenue-agent');
  try {
    const scrapeReport   = await runDailyScrape();
    const revenueReport  = await generateDailyReport();
    return res.json({ success: true, scrape: scrapeReport, revenue: revenueReport });
  } catch (err) {
    console.error('[cron/competitor-prices]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── WhatsApp Webhook (escuta mensagens do Meta) ────────────────────────────────
app.use('/webhook', require('./services/whatsapp/webhook'));

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pousada-crm-api',
    supabase_url: process.env.SUPABASE_URL ? '✅ configured' : '⚠️  not set',
    timestamp: new Date().toISOString(),
  });
});

// ─── Dashboard (HTML) ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  const supabaseOk = !!process.env.SUPABASE_URL;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>CRM API — Pousada Luz da Lua</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:2rem}
    h1{font-size:1.5rem;color:#f8fafc;margin-bottom:.25rem}
    .sub{color:#94a3b8;font-size:.875rem;margin-bottom:2rem}
    .badge{display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .75rem;border-radius:9999px;font-size:.75rem;font-weight:600;margin-bottom:1.5rem}
    .badge.ok{background:#16a34a22;color:#4ade80;border:1px solid #16a34a44}
    .badge.warn{background:#b4530022;color:#fb923c;border:1px solid #b4530044}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem}
    .card{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:1.25rem}
    .card h2{font-size:.875rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:.75rem}
    .route{display:flex;align-items:baseline;gap:.75rem;padding:.4rem 0;border-bottom:1px solid #1e293b}
    .route:last-child{border:none}
    .method{font-size:.7rem;font-weight:700;padding:.15rem .45rem;border-radius:.3rem;min-width:3.5rem;text-align:center}
    .GET{background:#0e7490;color:#e0f2fe} .POST{background:#15803d;color:#dcfce7}
    .PATCH{background:#b45309;color:#fef9c3} .DELETE{background:#991b1b;color:#fee2e2}
    .path{font-family:'Cascadia Code','Fira Code',monospace;font-size:.8rem;color:#cbd5e1}
    .desc{font-size:.75rem;color:#64748b;margin-left:auto;text-align:right}
    .env{margin-top:1.5rem;background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:1.25rem}
    .env h2{font-size:.875rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:.75rem}
    .env-row{display:flex;justify-content:space-between;padding:.3rem 0;font-size:.8rem;border-bottom:1px solid #0f172a}
    .env-row:last-child{border:none}
    .var{font-family:monospace;color:#94a3b8}
    .set{color:#4ade80} .unset{color:#f87171}
    .footer{margin-top:2rem;text-align:center;color:#334155;font-size:.75rem}
  </style>
</head>
<body>
  <h1>🏨 CRM API — Pousada Luz da Lua</h1>
  <p class="sub">Local dev server · http://localhost:${PORT}</p>
  <span class="badge ${supabaseOk ? 'ok' : 'warn'}">${supabaseOk ? '✅ Supabase connected' : '⚠️  Supabase not configured — set SUPABASE_URL in .env'}</span>

  <div class="grid">
    <div class="card">
      <h2>Leads &amp; Conversations</h2>
      <div class="route"><span class="method POST">POST</span><span class="path">/api/leads/upsert</span><span class="desc">Upsert lead</span></div>
      <div class="route"><span class="method POST">POST</span><span class="path">/api/conversations</span><span class="desc">Record message</span></div>
    </div>

    <div class="card">
      <h2>Availability</h2>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/availability</span><span class="desc">Check dates</span></div>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/availability/calendar</span><span class="desc">Full calendar</span></div>
      <div class="route"><span class="method PATCH">PATCH</span><span class="path">/api/availability/block</span><span class="desc">Block dates</span></div>
      <div class="route"><span class="method PATCH">PATCH</span><span class="path">/api/availability/unblock</span><span class="desc">Unblock dates</span></div>
    </div>

    <div class="card">
      <h2>Proposals</h2>
      <div class="route"><span class="method POST">POST</span><span class="path">/api/proposals</span><span class="desc">Create proposal</span></div>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/proposals</span><span class="desc">List proposals</span></div>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/proposals/:id</span><span class="desc">Get proposal</span></div>
      <div class="route"><span class="method PATCH">PATCH</span><span class="path">/api/proposals/:id/expire</span><span class="desc">Expire proposal</span></div>
    </div>

    <div class="card">
      <h2>Reservations</h2>
      <div class="route"><span class="method POST">POST</span><span class="path">/api/reservations/confirm</span><span class="desc">Atomic confirm</span></div>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/reservations</span><span class="desc">List reservations</span></div>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/reservations/:id</span><span class="desc">Get reservation</span></div>
    </div>

    <div class="card">
      <h2>Payments (InfinitePay)</h2>
      <div class="route"><span class="method POST">POST</span><span class="path">/api/payments/pix</span><span class="desc">Create payment link</span></div>
      <div class="route"><span class="method GET">GET</span><span class="path">/api/payments/:id</span><span class="desc">Get payment status</span></div>
      <div class="route"><span class="method POST">POST</span><span class="path">/api/public/infinitepay-webhook</span><span class="desc">InfinitePay webhook</span></div>
    </div>
  </div>

  <div class="env">
    <h2>Environment</h2>
    <div class="env-row"><span class="var">SUPABASE_URL</span><span class="${process.env.SUPABASE_URL ? 'set' : 'unset'}">${process.env.SUPABASE_URL ? '✅ set' : '✗ not set'}</span></div>
    <div class="env-row"><span class="var">SUPABASE_SERVICE_ROLE_KEY</span><span class="${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'unset'}">${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '✗ not set'}</span></div>
    <div class="env-row"><span class="var">SUPABASE_ANON_KEY</span><span class="${process.env.SUPABASE_ANON_KEY ? 'set' : 'unset'}">${process.env.SUPABASE_ANON_KEY ? '✅ set' : '✗ not set'}</span></div>
    <div class="env-row"><span class="var">NODE_ENV</span><span class="set">${process.env.NODE_ENV || 'development'}</span></div>
  </div>

  <p class="footer">PLU-06 CRM Foundation · Pousada Luz da Lua</p>
</body>
</html>`);
});

// ─── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'not_found', message: `No route for ${req.method} ${req.path}` });
});

// ─── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ success: false, error: 'internal_error', message: err.message });
});

// ─── Boot — only when run directly, not when required by tests ────────────────
if (require.main === module) {
  require('./ai/agents/crmAgent');
  require('./services/follow-up/follow-up-cron').startFollowUpCron();
  require('./services/follow-up/quote-event-listener').startQuoteEventListener();

  const server = app.listen(PORT, () => {
    console.log('');
    console.log(`${C.bold}${C.cyan}🏨 Pousada Luz da Lua — CRM API${C.reset}`);
    console.log(`${C.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(`${C.green}✓ Server running${C.reset}   http://localhost:${PORT}`);
    console.log(`${C.green}✓ Dashboard${C.reset}        http://localhost:${PORT}/`);
    console.log(`${C.green}✓ Health${C.reset}           http://localhost:${PORT}/health`);
    console.log('');
    if (!process.env.SUPABASE_URL) {
      console.log(`${C.yellow}⚠  SUPABASE_URL not set — add to .env to connect DB${C.reset}`);
      console.log(`${C.gray}   Copy .env.example to .env and fill in your Supabase credentials${C.reset}`);
      console.log('');
    }
    console.log(`${C.gray}Waiting for requests...${C.reset}`);
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`${C.red}✗ Port ${PORT} already in use.${C.reset} Try: API_PORT=3002 npm run dev:api`);
      process.exit(1);
    }
    throw err;
  });
}

module.exports = app;
