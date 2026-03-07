/**
 * Pousada Luz da Lua — CRM Dashboard Shared JS
 * Handles auth, API calls, and utility functions
 */

const SUPABASE_URL  = 'https://vwgqhonbbiqubuahkyij.supabase.co';
const SUPABASE_ANON = (() => {
  // Read from meta tag injected by page
  const meta = document.querySelector('meta[name="sb-anon"]');
  return meta ? meta.content : '';
})();

const API_BASE = '/api';

// ── Supabase client ────────────────────────────────────────────────────────────
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth guard ─────────────────────────────────────────────────────────────────
async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.href = '/public/login.html';
    return null;
  }
  return data.session;
}

async function logout() {
  await sb.auth.signOut();
  localStorage.removeItem('sb_session');
  window.location.href = '/public/login.html';
}

// ── API helper ─────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json };
}

// ── Formatters ─────────────────────────────────────────────────────────────────
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDatetime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(isoStr) {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'agora';
  if (mins < 60)  return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

const STATUS_LABELS = {
  // leads — funnel_stage values
  new:         { label: 'Novo',        cls: 'bg-blue-900/50 text-blue-300' },
  qualified:   { label: 'Qualificado', cls: 'bg-cyan-900/50 text-cyan-300' },
  proposal:    { label: 'Proposta',    cls: 'bg-indigo-900/50 text-indigo-300' },
  negotiation: { label: 'Negociação',  cls: 'bg-amber-900/50 text-amber-300' },
  confirmed:   { label: 'Confirmado',  cls: 'bg-green-900/50 text-green-300' },
  lost:        { label: 'Perdido',     cls: 'bg-red-900/50 text-red-300' },
  // proposals
  sent:        { label: 'Enviada',     cls: 'bg-blue-900/50 text-blue-300' },
  viewed:      { label: 'Visualizada', cls: 'bg-purple-900/50 text-purple-300' },
  accepted:    { label: 'Aceita',      cls: 'bg-green-900/50 text-green-300' },
  rejected:    { label: 'Recusada',    cls: 'bg-red-900/50 text-red-300' },
  expired:     { label: 'Expirada',    cls: 'bg-slate-600 text-slate-400' },
  // reservations
  pending:     { label: 'Pendente',    cls: 'bg-yellow-900/50 text-yellow-300' },
  cancelled:   { label: 'Cancelado',   cls: 'bg-red-900/50 text-red-300' },
  completed:   { label: 'Concluído',   cls: 'bg-slate-600 text-slate-300' },
  // payments
  approved:    { label: 'Aprovado',    cls: 'bg-green-900/50 text-green-300' },
  refunded:    { label: 'Reembolsado', cls: 'bg-slate-600 text-slate-300' },
};

function statusBadge(status) {
  const s = STATUS_LABELS[status] || { label: status, cls: 'bg-slate-600 text-slate-300' };
  return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}">${s.label}</span>`;
}

const ROOM_LABELS = {
  ALA_A:      'Ala A (até 3px)',
  ALA_B:      'Ala B (até 5px)',
  ALA_C_CASAL:'Ala C Casal (até 8px)',
  ALA_C_GRUPO:'Ala C Grupo (coletivo)',
  ALA_C_1:    'Ala C – 1',
  ALA_C_2:    'Ala C – 2',
};
function roomLabel(type) { return ROOM_LABELS[type] || type; }

// ── Toast notifications ────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const colors = { success: 'bg-green-700', error: 'bg-red-700', info: 'bg-blue-700' };
  const el = document.createElement('div');
  el.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-xl ${colors[type]} transition-all`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Sidebar nav helper ─────────────────────────────────────────────────────────
function initNav(active) {
  const links = document.querySelectorAll('[data-nav]');
  links.forEach(link => {
    if (link.dataset.nav === active) {
      link.classList.add('bg-slate-700', 'text-white');
    }
  });
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}
