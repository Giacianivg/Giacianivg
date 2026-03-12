# EPIC-PLU-09 — Luz da Lua Design System v1.0

**Projeto:** Pousada Luz da Lua | Socorro-SP
**Criado:** 2026-03-09
**Status:** Planning
**Prioridade:** 🔴 Alta
**Pontos totais:** 31
**Executor primário:** @ux-design-expert + @dev
**Quality gate:** @architect

---

## Epic Goal

Criar um Design System proprietário zero-build (HTML + CSS vars + Vanilla JS) que substitua o Tailwind CDN, unifique a identidade visual da pousada boutique e sirva tanto o CRM interno quanto a landing pública — sem quebrar os 134 testes backend existentes.

---

## Contexto do Sistema Existente

**Stack atual (frontend):**
- Tailwind CSS via CDN (`cdn.tailwindcss.com`) — será removido
- Supabase JS v2 via CDN — **mantido**
- Chart.js v4 via CDN — **mantido**
- 6 páginas em `public/`: login, dashboard, leads, reservations, proposals, follow-ups
- `public/app.js` — auth, API helpers, formatters, statusBadge, toast, initNav

**Integração points:**
- `server.js` serve `public/` como static (Express)
- `app.js` é importado por todas as páginas HTML via `<script src="/app.js">`
- CRM API em `/api/*` — 134 testes backend **não podem regredir**
- Deploy: Vercel (zero build step — arquivos servidos diretamente)

**Brand:**
- Pousada boutique, Socorro-SP
- Cor primária: Royal Blue `#2D6BE4`
- Cor de acento: Gold `#E6B800`
- Temas: `dark` (padrão CRM) + `clean` (light para landing)

---

## Deliverables

```
design-system/
  t.css     ← tokens: colors, typography, spacing, shadows, z-index
  c.css     ← components: buttons, cards, tables, badges, forms, modals, toasts
  l.css     ← layout: sidebar, drawer (mobile), header, grid, page-wrapper
  u.js      ← utils: theme engine, auth, api(), formatters, statusBadge, toast, initNav, drawer

public/
  login.html        ← migrado (remove Tailwind CDN)
  dashboard.html    ← migrado
  leads.html        ← migrado
  reservations.html ← migrado
  proposals.html    ← migrado
  follow-ups.html   ← migrado
  calendar.html     ← NOVO (calendário de disponibilidade)
  app.js            ← atualizado (importa design-system/u.js ou mescla)

landing/
  index.html        ← NOVO (página pública para hóspedes)
```

---

## Critérios de Aceite do Epic

- [ ] Zero `"undefined"` visível em qualquer página
- [ ] Tema dark/clean persiste via `localStorage` key `"theme"` e aplica imediatamente sem flash
- [ ] 134 testes backend passam sem modificação (`npm test`)
- [ ] Mobile (≤768px): sidebar vira drawer com overlay e toggle button
- [ ] Tailwind CDN removido de todas as páginas CRM
- [ ] Deploy Vercel funciona: zero build step, arquivos servidos estáticos
- [ ] Calendar page exibe disponibilidade dos quartos
- [ ] Landing page converte visitas em contatos WhatsApp

---

## Stories — Sequência de Execução

> **Regra de dependência:** Stories 1 e 2 em paralelo → Story 3 e 4 em paralelo (dependem de 1+2) → Story 5 independente.

---

### Story PLU-09.1 — CSS Foundation: Tokens, Components e Layout

**Executor:** @ux-design-expert | **Quality Gate:** @dev
**Complexidade:** 8pts (L) | **Risco:** Médio

**O que fazer:**
Criar os 3 arquivos CSS base do design system usando CSS custom properties (variáveis nativas). Nenhum preprocessador, nenhum build step.

**`design-system/t.css`** — Tokens:
```css
/* Exemplo de estrutura esperada */
:root[data-theme="dark"] {
  --color-bg-base: #0F1117;
  --color-bg-surface: #1A1D27;
  --color-bg-elevated: #232636;
  --color-border: #2E3148;
  --color-text-primary: #F0F2FF;
  --color-text-secondary: #8B8FA8;
  --color-primary: #2D6BE4;
  --color-primary-hover: #3D7BF4;
  --color-accent: #E6B800;
  --color-accent-hover: #F5C800;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  /* typography, spacing, radius, shadow, z-index */
}
:root[data-theme="clean"] {
  /* light theme equivalents */
}
```

**`design-system/c.css`** — Components:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`
- `.card`, `.card-header`, `.card-body`
- `.badge`, `.badge-{status}` para todos os STATUS_LABELS do app.js
- `.table`, `.table-row`, `.table-cell`
- `.form-group`, `.input`, `.select`, `.label`
- `.modal`, `.modal-overlay`, `.modal-content`
- `.toast`, `.toast-success`, `.toast-error`, `.toast-info`
- `.stat-card` (KPI widgets do dashboard)
- `.nav-link`, `.nav-link.active`

**`design-system/l.css`** — Layout:
- `.app-shell` (flex container)
- `.sidebar` (w:220px, collapsible)
- `.drawer` (mobile: position fixed, transform slide-in)
- `.drawer-overlay` (mobile: backdrop)
- `.main-content` (flex-1, overflow-auto)
- `.page-header`, `.page-title`, `.page-actions`
- `.grid-cols-{1-4}` com responsividade
- `@media (max-width: 768px)` → sidebar hidden, drawer visible

**Acceptance Criteria:**
- [ ] Ambos os temas (dark/clean) funcionam sem JS inicial (aplica via `data-theme` no `<html>`)
- [ ] Nenhuma classe de Tailwind nos arquivos CSS
- [ ] Todos os componentes possuem estado hover, focus, disabled via CSS puro
- [ ] Mobile breakpoint ≤768px: sidebar oculta, `.drawer` funciona via classe `.open`
- [ ] Arquivo `t.css` < 5KB, `c.css` < 15KB, `l.css` < 8KB

**Executor Assignment:**
```yaml
executor: "@ux-design-expert"
quality_gate: "@dev"
quality_gate_tools: [css_validation, cross_browser_check, accessibility_check]
```

---

### Story PLU-09.2 — u.js: Theme Engine + Utilities Migradas

**Executor:** @dev | **Quality Gate:** @architect
**Complexidade:** 5pts (M) | **Risco:** Baixo

**O que fazer:**
Criar `design-system/u.js` como substituto expandido do `public/app.js`, adicionando theme engine e drawer controller. O `app.js` existente pode ser refatorado para importar/delegar ou ser substituído.

**Funcionalidades obrigatórias:**

```javascript
// Theme engine
ThemeEngine.init()           // lê localStorage, aplica data-theme ao <html>, sem flash (inline script)
ThemeEngine.toggle()         // alterna dark ↔ clean, persiste localStorage
ThemeEngine.current()        // retorna 'dark' | 'clean'

// Drawer (mobile sidebar)
Drawer.init(triggerId, drawerId, overlayId)
Drawer.open()
Drawer.close()

// Auth (mantém compatibilidade com app.js)
requireAuth()                // redireciona para /login.html se sem sessão
logout()

// API helper (mantém compatibilidade)
api(path, opts)

// Formatters (mantém compatibilidade)
formatCurrency(val)
formatDate(isoStr)
formatDatetime(isoStr)
relativeTime(isoStr)
statusBadge(status)          // usa classes .badge do c.css
roomLabel(type)

// Notifications
toast(msg, type)             // usa .toast do c.css, auto-remove 3.5s

// Nav
initNav(active)              // marca link ativo, bind logout button
```

**Constraint crítica:** `ThemeEngine.init()` DEVE ser chamado via `<script>` inline no `<head>` ANTES do carregamento do CSS para evitar flash of unstyled content (FOUC). Exportar snippet separado para isso.

**Acceptance Criteria:**
- [ ] `localStorage.setItem('theme', 'clean')` + reload → tema clean sem flash
- [ ] Drawer abre/fecha em mobile com overlay backdrop
- [ ] Todas as funções de `app.js` presentes com mesma assinatura
- [ ] `statusBadge()` usa classes CSS do design system (não hardcoded Tailwind)
- [ ] Arquivo < 10KB minificado

**Executor Assignment:**
```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [code_review, api_compatibility_check, no_regression_test]
```

---

### Story PLU-09.3 — Migração das 6 Páginas CRM para Design System

**Executor:** @ux-design-expert | **Quality Gate:** @dev
**Complexidade:** 8pts (L) | **Risco:** Alto
**Depende de:** PLU-09.1 + PLU-09.2

**O que fazer:**
Remover Tailwind CDN de todas as 6 páginas e aplicar o design system. Nenhuma lógica de negócio ou chamada de API muda — apenas HTML estrutural e classes CSS.

**Páginas a migrar:**

| Página | Classes críticas a preservar | Componentes |
|--------|------------------------------|-------------|
| `login.html` | Form de auth Supabase | `.card`, `.input`, `.btn-primary` |
| `dashboard.html` | Widgets KPI, charts | `.stat-card`, `.card`, sidebar |
| `leads.html` | Tabela, filtros, modal detalhes | `.table`, `.badge`, `.modal` |
| `reservations.html` | Tabela reservas, status badges | `.table`, `.badge-{status}` |
| `proposals.html` | Cards proposta, status | `.card`, `.badge` |
| `follow-ups.html` | Lista follow-ups, status | `.table`, `.badge` |

**Regras de migração:**
1. Substituir `<script src="https://cdn.tailwindcss.com">` pelos links do design system
2. Substituir classes Tailwind por classes do design system
3. Adicionar `<html data-theme="dark">` como padrão
4. Adicionar snippet `ThemeEngine.init()` no `<head>` antes dos CSS links
5. Adicionar drawer HTML no mobile (toggle button no header)
6. Garantir zero `"undefined"` — todos os campos com fallback `|| '—'`

**Acceptance Criteria:**
- [ ] `npm test` — 134 testes passam (zero regressão backend)
- [ ] Nenhuma referência a `cdn.tailwindcss.com` nas páginas
- [ ] Zero texto `"undefined"` visível em nenhum estado
- [ ] dark/clean toggle funciona em todas as páginas
- [ ] Mobile (375px): sidebar → drawer, conteúdo não quebra
- [ ] Chart.js dashboard funciona com as novas cores do tema

**Executor Assignment:**
```yaml
executor: "@ux-design-expert"
quality_gate: "@dev"
quality_gate_tools: [visual_regression, no_tailwind_check, undefined_check, mobile_test, npm_test]
```

---

### Story PLU-09.4 — Calendar Page (Nova)

**Executor:** @dev | **Quality Gate:** @ux-design-expert
**Complexidade:** 5pts (M) | **Risco:** Baixo
**Depende de:** PLU-09.1 + PLU-09.2

**O que fazer:**
Criar `public/calendar.html` — calendário de disponibilidade dos quartos, integrando com a API `/api/availability`.

**Funcionalidades:**
- Calendário mensal com navegação anterior/próximo
- Células coloridas por status de ocupação:
  - `--color-success` → disponível
  - `--color-warning` → parcialmente ocupado
  - `--color-danger` → lotado
- Tooltip/hover com detalhes do quarto
- Filtro por tipo de quarto (ALA_A, ALA_B, ALA_C_CASAL, ALA_C_GRUPO)
- Link na sidebar de navegação do CRM

**Integração API:**
```javascript
// GET /api/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
// Retorna disponibilidade por quarto e data
```

**Acceptance Criteria:**
- [ ] Página acessível em `/calendar.html`, protegida por `requireAuth()`
- [ ] Link "Calendário" adicionado à sidebar de todas as páginas CRM
- [ ] Navegação mês a mês funciona
- [ ] Status de ocupação exibido com as cores dos tokens
- [ ] Mobile: grid responsivo, colunas adaptam

**Executor Assignment:**
```yaml
executor: "@dev"
quality_gate: "@ux-design-expert"
quality_gate_tools: [api_integration_test, mobile_test, visual_check]
```

---

### Story PLU-09.5 — Landing Page para Hóspedes

**Executor:** @ux-design-expert | **Quality Gate:** @dev
**Complexidade:** 5pts (M) | **Risco:** Baixo
**Independente:** pode ser desenvolvida em paralelo com 3 e 4

**O que fazer:**
Criar `landing/index.html` — página pública para hóspedes potenciais, usando tema `clean` e identidade brand da pousada.

**Seções obrigatórias:**

1. **Hero** — Logo 🌙 + headline + CTA "Reservar via WhatsApp"
2. **Sobre** — Pousada boutique em Socorro-SP, natureza, tranquilidade
3. **Acomodações** — Cards dos 3 tipos: Ala A (3px), Ala B (5px), Ala C (8px) com fotos placeholder e preços base
4. **Comodidades** — Grid de ícones (piscina, café da manhã, pets, Wi-Fi, etc.)
5. **Localização** — Endereço + link Google Maps
6. **CTA Final** — Botão WhatsApp com número formatado
7. **Footer** — Copyright, links

**Regras:**
- Tema `clean` como padrão (`data-theme="clean"`)
- Cores brand: `#2D6BE4` e `#E6B800`
- CTA WhatsApp usa `https://wa.me/5519998400306`
- Zero dependências externas (sem CDNs desnecessários)
- `landing/` é servida como diretório separado em Vercel ou inclusa no `public/`

**Acceptance Criteria:**
- [ ] Página carrega em < 2s (sem CDNs pesados)
- [ ] CTA WhatsApp abre conversa corretamente
- [ ] Responsiva: 375px, 768px, 1280px
- [ ] Tema `clean` aplicado por padrão
- [ ] Nenhum link quebrado
- [ ] `meta` tags básicas de SEO (title, description, og:image placeholder)

**Executor Assignment:**
```yaml
executor: "@ux-design-expert"
quality_gate: "@dev"
quality_gate_tools: [performance_check, link_check, mobile_test, seo_check]
```

---

## Sequência de Execução (Wave Plan)

```
Wave 1 (paralelo):
  PLU-09.1 — CSS Foundation      [8pts — @ux-design-expert]
  PLU-09.2 — u.js Utilities      [5pts — @dev]
  PLU-09.5 — Landing Page        [5pts — @ux-design-expert] ← pode rodar em paralelo

Wave 2 (após Wave 1, paralelo):
  PLU-09.3 — Migrar 6 páginas    [8pts — @ux-design-expert]  ← depende de 09.1 + 09.2
  PLU-09.4 — Calendar Page       [5pts — @dev]               ← depende de 09.1 + 09.2
```

**Estimativa total:** 31 story points | ~2 semanas dev

---

## Compatibilidade e Riscos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| FOUC (flash tema) | Alta | `ThemeEngine.init()` inline no `<head>` antes do CSS |
| Regressão testes backend | Baixa | `npm test` obrigatório antes de cada PR |
| `"undefined"` em campos | Média | Revisar todos os `?.` e `|| '—'` na Story 09.3 |
| Charts com cores erradas | Baixa | Chart.js lê CSS vars via `getComputedStyle` |
| Vercel path para `landing/` | Baixa | Configurar `vercel.json` se necessário |

**Rollback:** Todas as mudanças são frontend-only. Reverter = git revert nas páginas HTML. Backend intacto.

---

## Definition of Done

- [ ] Stories PLU-09.1 a PLU-09.5 com status Done
- [ ] `npm test` — 134 testes passam
- [ ] Zero `"undefined"` em todas as páginas (inspeção visual + automated check)
- [ ] dark/clean persiste via localStorage em todas as páginas CRM
- [ ] Mobile drawer funciona (sidebar → drawer em ≤768px)
- [ ] Tailwind CDN removido de todas as páginas
- [ ] `landing/index.html` publicada e acessível
- [ ] Deploy Vercel sem build step

---

## Handoff para @sm

"Por favor, crie stories detalhadas para o EPIC-PLU-09 (Design System v1.0).

- **Stack:** HTML + CSS custom properties + Vanilla JS. Zero build. Deploy Vercel.
- **Sistema existente:** Express serve `public/` estático; 134 testes backend em `tests/`; `public/app.js` é utility compartilhada
- **Integração crítica:** Remover `cdn.tailwindcss.com`, manter `cdn.jsdelivr.net/supabase` e `chart.js`
- **Padrões a seguir:** CSS custom properties com `data-theme` no `<html>`, classes semânticas (não utilitárias)
- **Compatibilidade obrigatória:** `npm test` não pode regredir; `app.js` API surface mantida
- **Ordem:** Wave 1 (09.1 + 09.2 + 09.5 em paralelo) → Wave 2 (09.3 + 09.4 após Wave 1)

O epic deve entregar o design system preservando integridade do sistema enquanto unifica a identidade visual da pousada boutique."
