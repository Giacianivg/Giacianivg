/**
 * u.js — DS Utilities | Luz da Lua v1.0
 * Exports: window.DS (primary) + legacy compat aliases
 */
(function (global) {
  'use strict';

  /* =========================================
     SUPABASE CLIENT
     ========================================= */
  let _sb = null;

  function _getSB() {
    if (_sb) return _sb;
    const meta = document.querySelector('meta[name="sb-anon"]');
    const anonKey = meta ? meta.content.replace('sb_publishable_', '') : '';
    const url = 'https://nqxesjxbqupmhnivkfyk.supabase.co';
    if (global.supabase && anonKey) {
      _sb = global.supabase.createClient(url, anonKey);
    }
    return _sb;
  }

  /* =========================================
     THEME
     ========================================= */
  const THEME_KEY = 'ldl-theme';

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(cur === 'dark' ? 'clean' : 'dark');
  }

  /* =========================================
     AUTH
     ========================================= */
  async function requireAuth() {
    const sb = _getSB();
    if (!sb) {
      window.location.href = 'login.html';
      return null;
    }
    // Validate session against server (not just local cache)
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) {
      await sb.auth.signOut(); // Clear stale session
      window.location.href = 'login.html';
      return null;
    }
    const { data: { session } } = await sb.auth.getSession();
    return session;
  }

  async function login(email, password) {
    const sb = _getSB();
    if (!sb) throw new Error('Supabase não inicializado');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    const sb = _getSB();
    if (sb) await sb.auth.signOut();
    window.location.href = 'login.html';
  }

  async function getToken() {
    const sb = _getSB();
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return session ? session.access_token : null;
  }

  /* =========================================
     FETCH WRAPPER
     ========================================= */
  async function api(path, opts = {}) {
    const token = await getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) { window.location.href = 'login.html'; return null; }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      // message primeiro: o usuário precisa ver a causa, não o código do erro
      try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /* =========================================
     FORMATTERS
     ========================================= */
  function cur(v) {
    const n = Number(v);
    if (isNaN(n)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }

  function date(d) {
    if (!d) return '—';
    const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''));
    return new Intl.DateTimeFormat('pt-BR').format(dt);
  }

  function datetime(d) {
    if (!d) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));
  }

  function rel(d) {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'agora';
    if (mins < 60)  return `${mins}min atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h atrás`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d atrás`;
    return date(d);
  }

  function room(r) {
    const m = { ALA_A: 'Ala A', ALA_B: 'Ala B', ALA_C_CASAL: 'Ala C Casal', ALA_C_GRUPO: 'Ala C Grupo' };
    return m[r] || r || '—';
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0,2).map(w => w[0].toUpperCase()).join('');
  }

  /* =========================================
     BADGES
     ========================================= */
  const STATUS_LABELS = {
    pending: 'Pendente', confirmed: 'Confirmado', cancelled: 'Cancelado',
    checkin: 'Check-in', checkout: 'Check-out', active: 'Ativo',
    sent: 'Enviado', draft: 'Rascunho', expired: 'Expirado',
    accepted: 'Aceito', rejected: 'Recusado'
  };

  function statusBadge(s) {
    const label = STATUS_LABELS[s] || s || '—';
    const cls = {
      pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled',
      checkin: 'badge-checkin', active: 'badge-active', sent: 'badge-sent', draft: 'badge-draft'
    }[s] || 'badge-draft';
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }

  const SCORE_LABELS = { HOT: 'Hot', WARM: 'Warm', NURTURE: 'Nurture', COLD: 'Cold' };

  function scoreBadge(s) {
    const label = SCORE_LABELS[s] || s || '—';
    const cls = { HOT: 'badge-hot', WARM: 'badge-warm', NURTURE: 'badge-nurture', COLD: 'badge-cold' }[s] || 'badge-cold';
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }

  function alertIcon(sev) {
    if (sev === 'critical') return '🔴';
    if (sev === 'high')     return '🟠';
    if (sev === 'medium')   return '🟡';
    return '🔵';
  }

  /* =========================================
     SKELETON
     ========================================= */
  function skeleton(rows = 5, cols = 4) {
    const header = Array(cols).fill('<th><div class="skel skel-text" style="width:80px"></div></th>').join('');
    const cells  = Array(cols).fill('<td><div class="skel skel-text"></div></td>').join('');
    const rowHtml= Array(rows).fill(`<tr>${cells}</tr>`).join('');
    return `<table class="tbl"><thead><tr>${header}</tr></thead><tbody>${rowHtml}</tbody></table>`;
  }

  function skeletonCards(n = 4) {
    return Array(n).fill('<div class="skel skel-card"></div>').join('');
  }

  /* =========================================
     TOAST
     ========================================= */
  function _ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    return c;
  }

  function toast(msg, type = 'info', dur = 4000) {
    const c = _ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, dur);
  }

  /* =========================================
     MODAL
     ========================================= */
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* =========================================
     SLIDE-OVER
     ========================================= */
  function openSlideOver(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
    const bd = document.getElementById(id + '-backdrop');
    if (bd) bd.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSlideOver(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
    const bd = document.getElementById(id + '-backdrop');
    if (bd) bd.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* =========================================
     NAVIGATION
     ========================================= */
  function initNav() {
    // Hamburger toggle
    const ham = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const drawerBd = document.getElementById('drawer-backdrop');

    if (ham && sidebar) {
      ham.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (drawerBd) drawerBd.classList.toggle('open');
      });
    }
    if (drawerBd) {
      drawerBd.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('open');
        drawerBd.classList.remove('open');
      });
    }

    // Active nav link
    const cur = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.nav-link').forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (href === cur) a.classList.add('active');
    });

    // Theme toggle button
    const ttBtn = document.getElementById('theme-toggle-btn');
    if (ttBtn) {
      ttBtn.addEventListener('click', () => { toggleTheme(); });
    }

    // Logout buttons
    document.querySelectorAll('[data-action="logout"]').forEach(btn => {
      btn.addEventListener('click', () => logout());
    });

    // Show user email
    (async () => {
      const sb = _getSB();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        document.querySelectorAll('[data-user-email]').forEach(el => {
          el.textContent = session.user.email || '';
        });
      }
    })();
  }

  /* =========================================
     ERROR & EMPTY STATES
     ========================================= */
  function errorState(container, msg) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-ico">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="empty-title">Erro ao carregar</p>
        <p class="empty-msg">${esc(msg || 'Tente novamente em instantes.')}</p>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Tentar novamente</button>
      </div>`;
  }

  function emptyState(container, title, msg, ctaHtml) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-ico">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
          </svg>
        </div>
        <p class="empty-title">${esc(title)}</p>
        <p class="empty-msg">${esc(msg)}</p>
        ${ctaHtml || ''}
      </div>`;
  }

  /* =========================================
     COUNTDOWN
     ========================================= */
  function countdownBadge(targetDate) {
    const diff = new Date(targetDate).getTime() - Date.now();
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    let cls = 'ok', label;
    if (diff < 0) { cls = 'urgent'; label = 'Vencido'; }
    else if (hours < 24) { cls = 'urgent'; label = hours + 'h'; }
    else if (days <= 3)  { cls = 'warning'; label = days + 'd'; }
    else { label = days + 'd'; }
    return `<span class="countdown-badge ${cls}">⏱ ${esc(label)}</span>`;
  }

  /* =========================================
     TABS INIT
     ========================================= */
  function initTabs(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        c.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        c.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
    // Activate first tab
    const first = c.querySelector('.tab-btn');
    if (first && !c.querySelector('.tab-btn.active')) first.click();
  }

  /* =========================================
     DS NAMESPACE
     ========================================= */
  const DS = {
    // Theme
    initTheme, setTheme, toggleTheme,
    // Auth
    requireAuth, login, logout, getToken,
    // Fetch
    api,
    // Formatters
    cur, date, datetime, rel, room, esc, initials,
    // Badges
    statusBadge, scoreBadge, alertIcon, countdownBadge,
    STATUS_LABELS,
    // UI
    skeleton, skeletonCards, toast, openModal, closeModal,
    openSlideOver, closeSlideOver,
    initNav, initTabs, errorState, emptyState,
    // Supabase
    getSB: _getSB,
    ROOM_LABELS: { ALA_A: 'Ala A', ALA_B: 'Ala B', ALA_C_CASAL: 'Ala C Casal', ALA_C_GRUPO: 'Ala C Grupo' }
  };

  global.DS = DS;

  /* =========================================
     LEGACY COMPAT (maps app.js surface)
     ========================================= */
  global.requireAuth    = requireAuth;
  global.logout         = logout;
  global.api            = api;
  global.formatCurrency = cur;
  global.formatDate     = date;
  global.formatDatetime = datetime;
  global.relativeTime   = rel;
  global.statusBadge    = statusBadge;
  global.roomLabel      = room;
  global.toast          = toast;
  global.initNav        = initNav;
  global.STATUS_LABELS  = STATUS_LABELS;
  global.ROOM_LABELS    = DS.ROOM_LABELS;

  /* Auto-init theme on load */
  initTheme();

}(window));
