'use strict';
// Uso único: padroniza a ordem do menu lateral em todas as páginas do dashboard.
// Ordem definida pelo Vitor (2026-06-11): Dashboard, Front Desk, Reservas,
// Vouchers, Quartos, Mapa, Calendário, Follow-ups, Financeiro, Leads + AI OS.

const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');

const ICONS = {
  dashboard:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  frontdesk:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  bookings:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  vouchers:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  rooms:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M2 12h20M8 7V4h8v3"/><rect x="5" y="7" width="5" height="5" rx="1"/></svg>',
  map:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  calendar:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  followups:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  financial:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  leads:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  command:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  luna:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.3 6L15 21H9l-.3-6A7 7 0 0112 2z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>',
};

// Ordem exata definida pelo Vitor + Leads mantido após Financeiro
const MAIN = [
  { href: 'dashboard.html',  label: 'Dashboard',     icon: 'dashboard' },
  { href: 'frontdesk.html',  label: 'Front Desk',    icon: 'frontdesk' },
  { href: 'bookings.html',   label: 'Reservas',      icon: 'bookings' },
  { href: 'vouchers.html',   label: 'Vouchers',      icon: 'vouchers' },
  { href: 'rooms.html',      label: 'Quartos',       icon: 'rooms' },
  { href: 'map.html',        label: 'Mapa',          icon: 'map' },
  { href: 'calendar.html',   label: 'Calendário',    icon: 'calendar' },
  { href: 'follow-ups.html', label: 'Follow-ups',    icon: 'followups' },
  { href: 'financial.html',  label: 'Financeiro',    icon: 'financial' },
  { href: 'leads.html',      label: 'Leads',         icon: 'leads' },
];

const AIOS = [
  { href: 'command-center.html', label: 'Command Center',   icon: 'command' },
  { href: 'luna-training.html',  label: 'Treinamento Luna', icon: 'luna' },
];

// página → href marcado como ativo
const ACTIVE = {
  'dashboard.html': 'dashboard.html',
  'frontdesk.html': 'frontdesk.html',
  'bookings.html': 'bookings.html',
  'vouchers.html': 'vouchers.html',
  'vouchers-create.html': 'vouchers.html',
  'rooms.html': 'rooms.html',
  'map.html': 'map.html',
  'calendar.html': 'calendar.html',
  'follow-ups.html': 'follow-ups.html',
  'financial.html': 'financial.html',
  'leads.html': 'leads.html',
  'command-center.html': 'command-center.html',
  'luna-training.html': 'luna-training.html',
  'pricing.html': null,
  'proposals.html': null,
};

function buildNav(activeHref) {
  const link = i =>
    `      <a class="nav-link${i.href === activeHref ? ' active' : ''}" href="${i.href}">${ICONS[i.icon]}${i.label}</a>`;
  return [
    '<nav class="sidebar-nav">',
    '      <div class="nav-section-title">Principal</div>',
    ...MAIN.map(link),
    '      <div class="nav-section-title" style="margin-top:var(--sp-3)">AI OS</div>',
    ...AIOS.map(link),
    '    </nav>',
  ].join('\n');
}

const files = Object.keys(ACTIVE);
let changed = 0;
for (const file of files) {
  const fp = path.join(PUB, file);
  if (!fs.existsSync(fp)) { console.log('skip (não existe):', file); continue; }
  const html = fs.readFileSync(fp, 'utf8');
  const re = /<nav class="sidebar-nav">[\s\S]*?<\/nav>/;
  if (!re.test(html)) { console.log('skip (sem sidebar-nav):', file); continue; }
  const out = html.replace(re, buildNav(ACTIVE[file]));
  if (out !== html) { fs.writeFileSync(fp, out); changed++; console.log('ok:', file); }
}
console.log(`\n${changed} páginas atualizadas`);
