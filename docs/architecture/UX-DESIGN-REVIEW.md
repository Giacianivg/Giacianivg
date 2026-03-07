# UX/Design Review — CRM Web Frontend Architecture

**Revisado por:** @ux-design-expert
**Data:** 2026-03-07
**Documentos analisados:**
- crm-frontend-architecture.md (1591 linhas)
- crm-component-hierarchy.md (944 linhas)
- CRM-RMS-PRD.md (1100 linhas, User Personas)

**Status:** REVIEW COMPLETO COM RECOMENDAÇÕES

---

## EXECUTIVO

### Resumo Geral

A arquitetura de frontend proposta é **sólida e bem pensada** para um CRM operacional B2B interno. O design segue padrões consolidados (Next.js 14, TailwindCSS, shadcn/ui) e a hierarquia de componentes é logicamente estruturada.

**Pontuação geral:** 7.5/10
- ✅ Arquitetura sólida (padrão SPA moderno)
- ✅ Navegação bem definida
- ✅ Components reutilizáveis
- ⚠️ Alguns gaps em a11y e mobile-first
- 🚨 Issues críticas em interação e feedback do usuário

### Recomendações Prioritárias

| Prioridade | Tipo | Resumo |
|-----------|------|--------|
| 🚨 CRÍTICO | UX | Estados de erro/loading não bem definidos em modals |
| 🚨 CRÍTICO | A11y | Keyboard navigation ausente em componentes-chave |
| ⚠️ ALTO | Mobile | Design não é mobile-first (desktop-first approach) |
| ⚠️ ALTO | Forms | Validação e feedback de erro superficial |
| 💡 MÉDIO | Design System | Tokens de design não mapeados (spacing, cores, shadows) |
| 💡 MÉDIO | Personas | UI não diferencia roles (Gerente vs Recepcionista vs Analista) |

---

## 1. USER JOURNEY REVIEW

### 1.1 Fluxos Principais — Análise

**Fluxo 1: Login → Dashboard → Leads**
```
✅ Login
  └─ AuthContext (Supabase) bem estruturado
  └─ Redirect after login → /dashboard
  └─ Protected routes (AuthGuard) implementado

✅ Dashboard
  └─ 4 KPI widgets (receita, ocupação, conversão, leads)
  └─ 2 tabelas (leads recentes, próximas check-ins)
  └─ Quick actions (novo lead, nova reserva, relay)

⚠️ Problema: Nenhum onboarding para primeiro login
   └─ Usuário novo vê dashboard vazio sem contexto
   └─ Sem tooltip, walkthrough, ou empty state educativo

✅ Leads Page
  └─ Filtros (search, status, origem)
  └─ Tabela paginada (20 por página)
  └─ CRUD modal bem estruturado
  └─ Actions dropdown com ver/editar/converter/deletar
```

**Fluxo 2: Conversa → Relay → WhatsApp**
```
⚠️ Conversas Page — Layout interessante (sidebar + main)
   └─ Busca por conversa (bom)
   └─ Lista com avatares (bom)

🚨 Problema CRÍTICO: Relay Input
   └─ Campo único para "resposta equipe"
   └─ Nenhum preview de como ficará na mensagem
   └─ Sem confirmação antes de enviar
   └─ Usuário não vê se a mensagem foi entregue
   └─ Sem retry automático se falhar
```

**Fluxo 3: Calendário → Reserva → Confirmação**
```
✅ Calendário
  └─ React Big Calendar implementado
  └─ Room type selector (checkboxes)
  └─ Drag-drop para mover reservas

⚠️ Problemas:
   └─ Sem validação visual de disponibilidade (color coding)
   └─ Ocupação por tipo não visualmente clara
   └─ Modal de confirmação não especificado

✅ Reservation Wizard (bom conceito)
  └─ Step 1: Datas + tipo quarto
  └─ Step 2: Dados do hóspede
  └─ Step 3: Confirmação com resumo

🚨 Problema: Sem cálculo de preço no wizard
   └─ Usuário vê resumo mas NÃO vê breaking down (noites × preço/noite)
   └─ Motor de cotação separado (quotation.js) não é surfaced
```

### 1.2 Gaps Identificados

| Fluxo | Gap | Impacto | Solução |
|-------|-----|--------|---------|
| Login | Sem onboarding/tutorial | Novo usuário perdido | Adicionar walkthrough ou animated tooltips |
| Dashboard | Empty state não definido | Sem contexto no primeiro uso | 4-5 cards com "Comece aqui" |
| Conversas | Sem preview de relay | Usuário não sabe o que está enviando | Mostrar "Será enviado como: ..." em real-time |
| Conversas | Sem confirmação de entrega | Não sabe se mensagem chegou | Toast notification ou status visual |
| Calendário | Sem feedback de drag-drop | Arrastou mas não confirma mudança | Visual feedback + toast na soltura |
| Reservas | Cálculo de preço não visível | Usuário cria reserva sem saber custo | Embed quotation engine no wizard |

---

## 2. INFORMATION ARCHITECTURE

### 2.1 Navegação — Estrutura

**Sidebar Navigation (excelente estrutura)**
```
Dashboard        ← Home, visão geral
├─ Leads         ← Gestão de prospects
├─ Clientes      ← CRM profiles (repeat customers)
├─ Reservas      ← Bookings (funil conversão)
├─ Calendário    ← Visual inventory management
├─ Conversas     ← Chat history (relay point)
├─ Analytics     ← BI dashboards
└─ Config        ← Settings (pricing, users, integrations)
```

✅ **Pontos fortes:**
- Ordem lógica (começa no dashboard, depois leads, depois conversão)
- Nenhum submenu (todas 8 páginas em 1 nível)
- Labels claros em português

⚠️ **Issues:**
- Sem indicador de página ativa (qual página estou?)
- Sem badges notificando novos itens (ex: "5 leads novos")
- Sem collapsible groups (Analytics, Config estão ao mesmo nível de Leads)

### 2.2 Hierarquia de Informações — Por Página

**Dashboard** ✅
```
Hierarquia:
  [KPI Widgets] — 4 números grandes
      ↓
  [Tabelas] — 2 tabelas: Leads recentes, Check-ins próximos
      ↓
  [Quick Actions] — 3 botões

Problema: Widgets sem comparação (não mostra "vs semana anterior")
         Tables sem "Ver tudo" link claro
```

**Leads** ⚠️
```
Hierarquia:
  [Filtros] — 4 selects + 1 botão "Limpar"
      ↓
  [Tabela] — 7 colunas: Nome, Fone, Status, Origem, Última interação, Valor, Ações
      ↓
  [Pagination] — Sem info "1-20 de 142"

Problema: Coluna "Valor" pode ser 0 ou vazia — sem contexto se cotou ou não
         Sem sorting nas colunas (tabela rígida)
         Sem bulk actions (selecionar múltiplos leads, marcar como "convertido")
```

**Clientes** ⚠️
```
Hierarquia:
  [Filtros] — 2 selects (busca, período)
      ↓
  [Tabela] — 7 colunas (NPS como ★, bom visual)
      ↓
  [Perfil Detail] — 4 tabs: Overview, Conversations, Reservations, Notes

Problema: Tab "Conversations" não especificado — é replay ou chat ativo?
         Conversas são read-only ou pode replyar de aqui?
```

**Conversas** ⚠️ (MAIS CRÍTICO)
```
Hierarquia:
  [Lista Conversas] — Sidebar com 50 items max
      └─ Avatar, nome, último msg (truncado), timestamp, badge "Novo"
      ↓
  [Chat View] — Header + mensagens + relay input
      ├─ Header: Avatar, nome, phone, botão Ver Perfil
      ├─ Messages: Bubbles color-coded (azul=hóspede, cinza=Luna, verde=Equipe)
      └─ RelayInput: Textarea + "Será enviado como ..." + Button

Problema CRÍTICO: "Novo" badge não cleared após abrir
                  Nenhum visual feedback que estou respondendo
                  Relay input muito simples (sem validação, sem retry)
```

### 2.3 Hierarquia de Componentes — Critério

| Componente | Função | Onde aparece | Reutilização |
|------------|--------|--------------|--------------|
| Avatar | Identificação visual | Dashboard, Leads, Clientes, Conversas | 5+ páginas ✅ |
| Badge | Status/Origin label | Leads, Reservas, Conversas | 4+ páginas ✅ |
| Card | Container padrão | 6/8 páginas (tudo menos Calendário) | ✅ |
| DataTable | Listagem paginada | Leads, Clientes, Reservas | ✅ |
| Dialog/Modal | Forms + confirmações | Leads, Clientes, Reservas | ✅ |
| MessageBubble | Chat messages | Conversas, Cliente Detail | ⚠️ Não documentado com props |
| Chart (Recharts) | Visualização dados | Analytics only | ✅ (especializado) |
| Calendar (React Big Calendar) | Inventory visual | Calendário only | ✅ (especializado) |

✅ **Bom:** Components bem reutilizáveis
⚠️ **Problema:** Props types não documentadas para MessageBubble, KPICard

---

## 3. COMPONENT DESIGN REVIEW

### 3.1 shadcn/ui Choices — Avaliação

**Componentes selecionados:**
```
✅ Button → Versátil, bom padrão
✅ Input → Simples, suficiente
✅ Select → Bom para dropdowns
✅ Dialog → Modal padrão
✅ Card → Container sensato
✅ Badge → Status indicator
✅ Avatar → User/lead identification
✅ Tabs → Cliente detail page
✅ Textarea → Notas, relay input
⚠️ DataTable → Custom implementation (precisa Recharts para charts)
⚠️ Skeleton → Loading state (bom uso)
```

**Componentes NÃO mencionados mas deveriam estar:**
```
❌ AlertDialog → Para confirmação de delete
❌ Toast/Notification → Para feedback assíncrono
❌ Popover → Para mais info sem abrir modal
❌ Sheet → Mobile alternative para dialogs
❌ Dropdown Menu → Para ações (edit, delete)
❌ DatePicker → Para datas (Calendário usa Big Calendar)
❌ Checkbox → Room type selector (mencionado mas não especificado)
```

### 3.2 Problemas de Consistência Visual

| Página | Componente | Problema |
|--------|-----------|----------|
| Dashboard | Widgets | Sem border/shadow — parecem flutuando |
| Leads | Tabela | Headers sem hover state ou indicador sortable |
| Leads | Modal | Sem visual de "loading" durante submit |
| Clientes | Tabs | Sem indicador visual qual tab está ativa |
| Conversas | MessageBubble | Cores hardcoded (azul/cinza/verde) — não tema-friendly |
| Calendário | Legend | Badge colors (green/blue/yellow/red) — sem acessibilidade |
| Analytics | KPI Cards | Sem visual para "trend up" vs "trend down" (só número) |

### 3.3 Accessibility (a11y) — CRÍTICO

**WCAG 2.1 AA Compliance — Score: 4/10**

#### ❌ Keyboard Navigation

```javascript
// PROBLEMA: Nenhuma menção a:
- Tab order nos modals
- Escape key para fechar dialogs
- Enter key para submit forms
- Arrow keys para navegação (calendário, tabelas)
- Focus management após fechar modal
- Skip links para conteúdo principal

// Exemplo do que deveria existir:
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  {/* Auto-focus primeiro field? */}
  <DialogContent>
    <Input autoFocus /> {/* ✅ BOM */}
  </DialogContent>
</Dialog>
```

#### ❌ Screen Reader Support

```
- MessageBubble sem aria-label
- Avatar sem fallback text (só inicia?)
- StatusBadge sem context (usuário cego vê "novo" mas não sabe do quê?)
- Tabelas sem <caption> ou aria-label
- Gráficos Recharts sem alt-text ou tabular fallback

// Exemplo:
<StatusBadge status="novo">
  {/* Deveria ter: */}
  <span className="sr-only">Lead status: novo</span>
  Novo
</StatusBadge>
```

#### ❌ Color Contrast

```
- Calendário usa cores como único indicador:
  ├─ Verde = Disponível
  ├─ Azul = Reservado
  ├─ Amarelo = Bloqueado
  └─ Vermelho = Manutenção

  Problema: Daltônico não diferencia verde/vermelho
  Solução: Adicionar padrões/stripes ou ícones
```

#### ⚠️ Form Accessibility

```
- Inputs sem labels <label htmlFor> (só placeholder)
- Select sem label
- Modals sem role="dialog"
- Confirmação de delete sem aria-describedby
```

---

## 4. DATA VISUALIZATION REVIEW

### 4.1 Recharts (Analytics Page) — Avaliação

**Gráficos escolhidos:**
```
✅ LineChart — Leads trend (bom para série temporal)
✅ AreaChart — Revenue trend (bom visual)
✅ BarChart — Funnel de conversão (bom para comparação)
✅ LineChart — Ocupação (bom para percentage 0-100%)
✅ PieChart — Leads por origem (bom para breakdown)
```

✅ **Pontos fortes:**
- Escolhas coerentes com dados
- Tooltip configured com formatter
- Cores consistent (mas não especificadas)

⚠️ **Issues:**
- Sem animation on load (Recharts default é quick)
- Sem exportar como imagem (gráficos read-only)
- Sem comparação YoY (mês atual vs ano anterior)
- Sem drill-down (clicar em barra do funnel → ver detalhes)

### 4.2 React Big Calendar (Calendário) — Avaliação

```javascript
<ReactBigCalendar
  style={{ height: '100vh' }}
  events={events}
  onSelectEvent={handleSelectReservation}
  onSelectSlot={handleSelectSlot}
  selectable
/>
```

✅ **Bom:**
- Drag-drop nativo
- Click para criar reserva
- Mostra títulos das reservas

⚠️ **Issues:**
- Sem validação de double-booking visual
- onSelectSlot abre modal sem confirmar disponibilidade
- Height 100vh pode causar scroll issues em mobile
- Sem legend visual clara de cores por room type
- Sem filtro por room type aplicado dinamicamente (só checkboxes)

### 4.3 Tabelas (DataTable) — Avaliação

```
Leads Table:
├─ Columns: Nome, Fone, Status, Origem, Última interação, Valor, Ações
├─ Sortable: Não especificado
├─ Filterable: Sim (filtros acima)
├─ Pagination: 20/página
└─ Actions: Edit, Delete, Convert, View Details

Problemas:
❌ Sem checkboxes para bulk actions
❌ Sem hover state nas linhas
❌ Sem row expansion (clicar → expandir detalhes sem modal)
❌ Sem export (CSV, PDF)
❌ Sem "sticky" header ao scroll
```

---

## 5. MOBILE RESPONSIVENESS

### 5.1 Design Approach — PROBLEMA

**Atual: Desktop-First** ❌
```
- Sidebar always visible (não collapsa em mobile)
- Tabelas com 7 colunas (impossível ler em < 768px)
- Gráficos 100vw (text unreadable)
- Calendário height:100vh (scroll infinito)
- Modals sem considerar mobile viewport
```

**Recomendação: Mobile-First** ✅
```
- Sidebar → hamburguer menu em <768px
- Tabelas → card layout ou horizontal scroll
- Gráficos → stack vertical em <768px
- Calendário → month view apenas, sem hour grid
```

### 5.2 Breakpoints Recomendados (TailwindCSS)

```javascript
// Usar Tailwind defaults:
sm: 640px   — Tablet pequeno
md: 768px   — Tablet/notebook pequeno
lg: 1024px  — Laptop
xl: 1280px  — Desktop grande

// Exemplo refatorado:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 1 coluna mobile, 2 tablet, 4 desktop */}
</div>
```

### 5.3 MVP vs Phase 2

**Recomendação:** Mobile seja Phase 2, não Phase 1
- Phase 1 (MVP): Desktop 1024px+, tablet 768px+ (portrait)
- Phase 2: Full mobile-first responsive + PWA
- Phase 3: Native app (React Native)

---

## 6. INTERACTION PATTERNS

### 6.1 Forms (React Hook Form) — Score: 5/10

**O que está bem:**
```javascript
<Form
  schema={leadSchema}
  onSubmit={handleSubmit}
>
  <Input label="Nome" name="name" required />
  <Input label="Telefone" name="phone" mask="(99) 9999-9999" />
  <Button type="submit">Salvar</Button>
</Form>
```

✅ Schema validation (Zod)
✅ Phone mask

**O que falta:**
```
❌ Error messages não especificadas (onde aparecem? inline? toast?)
❌ Loading state durante submit (button disabled? spinner?)
❌ Success message após salvar
❌ Dirty state warning (sair sem salvar → confirmar?)
❌ Field validation on blur (vs on submit)
❌ Async validation (exemplo: "Este telefone já existe?")
```

### 6.2 Modals/Dialogs — Score: 4/10

**Problemas críticos:**
```
1. LeadModal — Sem especificação de:
   ├─ Initial focus
   ├─ Escape key handler
   ├─ Backdrop click closes?
   ├─ Loading state (durante salvar)
   ├─ Error state (form enviou e falhou)
   └─ Success toast (salvou com sucesso?)

2. ReservationWizard — 3 steps:
   ├─ Sem "Next/Back" buttons visualizados
   ├─ Sem progress indicator (step 1 of 3)
   ├─ Sem data persistence entre steps (se clicar back, form vazio?)
   └─ Sem cálculo de preço no Step 3
```

### 6.3 Loading States

**Especificado:**
- Skeleton components (bom)
- Usando no Dashboard para widgets

**Falta em:**
- Tabelas (enquanto carrega dados)
- Modals (enquanto submete)
- Calendário (enquanto carrega events)
- Botões (enquanto processa)

### 6.4 Error States

**Completamente faltando:**
```
❌ Network error — "Falha na conexão"
❌ 404 — "Lead não encontrado"
❌ 403 — "Sem permissão para editar"
❌ Validation error — "Telefone inválido"
❌ Timeout — "Operação demorou, tente novamente"
❌ Toast notifications — Toda ação assíncrona deveria ter feedback
```

### 6.5 Empty States

**Falta definição em:**
```
❌ Dashboard no primeiro acesso (0 leads)
❌ Leads page sem resultados (filtro aplicado, 0 matches)
❌ Calendário sem reservas
❌ Conversas sem histórico
❌ Analytics com data range em branco

Exemplo de bom empty state:
<EmptyState
  icon={<LeadIcon />}
  title="Nenhum lead ainda"
  description="Crie seu primeiro lead ou importe do WhatsApp"
  action={<Button>Novo Lead</Button>}
/>
```

---

## 7. USABILITY ISSUES

### 7.1 Navegação & Clareza

| Issue | Crítico | Solução |
|-------|---------|---------|
| Sidebar sem indicador de página ativa | Médio | Highlight item ativo com background + bold |
| Sem breadcrumbs em páginas detail | Médio | Adicionar breadcrumb: Dashboard > Clientes > João Silva |
| Sem "Back" button em detail pages | Médio | Browser back funciona, mas UI button é clareza |
| Avatar dropdown sem logout visual | Baixo | Adicionar ícone/texto claro "Logout" |

### 7.2 Label & Button Clarity

| Componente | Label | Problema |
|-----------|-------|----------|
| Button em Leads | "Ver detalhes" | Vago — abre o quê? Novo modal? Nova página? |
| Button em Dashboard | "Ver todos" | Qual "todos"? Leva pra Leads page? |
| Modal em Leads | "Editar Lead" | Sem contexto se é CREATE ou UPDATE |
| Modal em Conversas | "Enviar resposta" | Como diferencia de resposta automática (Luna)? |

### 7.3 Data Formatting

| Campo | Formato | Problema |
|-------|---------|----------|
| Telefone | (19) 9999-9999 | Bom, consistente |
| Data | DD/MM/YYYY | Não especificado — ISO ou brasileiro? |
| Moeda | R$ 1.050,00 | Não mencionado — separador pt-BR ou en-US? |
| Timestamp | formatTime() | Não especificado — 14:30 ou 2:30 PM? |

---

## 8. PERSONAS & ROLE-BASED UI

### 8.1 Personas vs UI — PROBLEMA CRÍTICO

**PRD define 3 personas:**

1. **Gerente (Júlia)** — Quer dashboard executivo, KPIs, relatórios
2. **Recepcionista (Ana)** — Quer busca rápida, histórico, relay
3. **Analista (Tiago)** — Quer API, dados estruturados, export

**Mas arquitetura NÃO diferencia:**
```
- Não há role-based UI (Gerente vê tudo = Recepcionista vê tudo)
- Não há feature flags por role
- Não há restricted actions (Analista pode deletar leads?)
- Dashboard igual pra todos (Gerente deveria ter "Relatórios" tab extra)
```

### 8.2 Role-Based Recommendations

```javascript
// Sugerir estrutura como:
const RoleBasedLayout = () => {
  const { user } = useAuth();

  return (
    <>
      {/* Sidebar igual para todos */}
      <Sidebar>
        <NavLink href="/dashboard">Dashboard</NavLink>
        <NavLink href="/leads">Leads</NavLink>
        {/* Recepcionista vê Conversas em destaque */}
        {user.role === 'receptionist' && (
          <NavLink highlight href="/conversas">
            ⚡ Conversas Ativas
          </NavLink>
        )}
        {/* Gerente vê Analytics em destaque */}
        {user.role === 'manager' && (
          <NavLink highlight href="/analytics">
            📊 Relatórios
          </NavLink>
        )}
        {/* Analista vê Config/API em destaque */}
        {user.role === 'analyst' && (
          <NavLink highlight href="/config/api">
            🔌 API Docs
          </NavLink>
        )}
      </Sidebar>

      {/* Dashboard customizado por role */}
      <DashboardManager />  {/* Se gerente */}
      <DashboardReceptionist />  {/* Se recepcionista */}
    </>
  );
};
```

---

## 9. ACCESSIBILITY (a11y) — CHECKLIST

### WCAG 2.1 AA Compliance — Recomendações

**Crítico (deve ter):**
```
❌ Keyboard navigation completa (Tab, Shift+Tab, Enter, Escape, Arrow keys)
❌ Focus management (visible outline, focus trap em modals)
❌ Screen reader labels (aria-label, aria-describedby)
❌ Color contrast 4.5:1 texto, 3:1 UI components
❌ Alternative to color (icons/patterns para diferenciação)
```

**Alto (deveriam ter):**
```
❌ Form labels <label htmlFor> (não só placeholder)
❌ Error messages linked a campos (aria-describedby)
❌ Loading states announced (aria-busy)
❌ Table headers <th scope="col">
❌ Skip links (skip to main content)
```

**Médio (nice-to-have):**
```
⚠️ Dark mode support (TailwindCSS suporta com dark: prefix)
⚠️ Reduced motion (@media prefers-reduced-motion)
⚠️ Text resize support (não usar px em fonts, usar rem)
⚠️ Magnification support (min 200%)
```

---

## 10. DESIGN SYSTEM & TOKENS

### 10.1 Design Tokens — FALTAM DEFINIÇÃO

**Necessário mapear:**
```yaml
Colors:
  primary: #3B82F6        # Azul (suposto)
  secondary: #10B981      # Verde (suposto)
  danger: #EF4444
  warning: #F59E0B
  success: #10B981
  neutral: #6B7280
  background: #FFFFFF
  text-primary: #1F2937
  text-secondary: #6B7280

Spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px

Typography:
  heading-lg: 32px / 40px (bold)
  heading-md: 24px / 32px (bold)
  heading-sm: 20px / 28px (semi-bold)
  body-lg: 16px / 24px (regular)
  body-sm: 14px / 20px (regular)
  caption: 12px / 16px (regular)

Shadows:
  sm: 0 1px 2px rgba(0, 0, 0, 0.05)
  md: 0 4px 6px rgba(0, 0, 0, 0.1)
  lg: 0 10px 15px rgba(0, 0, 0, 0.1)

Borders:
  radius-sm: 4px
  radius-md: 8px
  radius-lg: 12px
```

**Recomendação:** Usar `tailwind.config.ts` para centralizar
```typescript
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          // ... até 900
        }
      },
      spacing: {
        'xs': '4px',
        // ...
      }
    }
  }
}
```

### 10.2 Component Patterns a Padronizar

```typescript
// Pattern 1: Cards
export interface CardProps {
  title?: string;
  description?: string;
  footer?: ReactNode;
  isLoading?: boolean;
  error?: string;
  children: ReactNode;
}

// Pattern 2: Tables
export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: Error;
  pagination?: PaginationProps;
  onRowClick?: (row: T) => void;
}

// Pattern 3: Forms
export interface FormProps {
  schema: ZodSchema;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  successMessage?: string;
  children: ReactNode;
}

// Pattern 4: Buttons
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  children: ReactNode;
}
```

---

## 11. DESIGN CONSISTENCY ISSUES

### Tabela de Inconsistências

| Elemento | Página 1 | Página 2 | Recomendação |
|----------|----------|----------|--------------|
| Card border | Não especificado | — | Definir: 1px solid #E5E7EB |
| Card shadow | Não especificado | — | Padrão: md (0 4px 6px) |
| Button styling | Primary (azul) | — | Documentar todas 4 variantes |
| Input height | Não especificado | — | 40px padrão (8 do padding + 24 texto) |
| Modal backdrop | Não especificado | — | Escuro com opacity 50% |
| Modal animation | Não especificado | — | Fade-in 200ms, slide-up 100ms |
| Color palette | Não mapeado | — | Definir base-12 cores Tailwind |
| Hover states | Nenhum definido | — | Todos botões/links need :hover |

---

## ✅ PONTOS FORTES

1. **Arquitetura bem estruturada**
   - Componentes reutilizáveis
   - Props types claros
   - Data flow bem documentado (Context + TanStack Query)

2. **Escolhas tecnológicas sólidas**
   - Next.js 14 (App Router, SSR pronto)
   - TailwindCSS (velocidade + customização)
   - shadcn/ui (componentes sem lock-in)
   - React Hook Form + Zod (validação forte)

3. **Sidebar bem desenhada**
   - 8 páginas em 1 nível (não deep nesting)
   - Ordem lógica
   - Fácil de estender

4. **Hierarquia de componentes clara**
   - Matriz de reutilização bem mapeada
   - Custom hooks bem organizados (useLeads, useClients, etc)

5. **Data visualization apropriada**
   - Recharts é bom choice
   - React Big Calendar é production-ready
   - Gráficos coerentes com dados

---

## 🚨 ISSUES CRÍTICAS

### 1. Keyboard & Screen Reader Access (WCAG)
**Severidade:** CRÍTICO
**Impacto:** Site não acessível para usuários com deficiência
**Fix:** 2-3 dias

- Adicionar keyboard navigation em todos componentes
- Adicionar aria-labels/descriptions
- Testar com screen reader (NVDA, JAWS)

### 2. Error Handling & Feedback
**Severidade:** CRÍTICO
**Impacto:** Usuário não sabe se ação funcionou ou falhou
**Fix:** 2-3 dias

- Definir error states para toda ação assíncrona
- Toast notifications com tipos (success/error/warning/info)
- Form error messages inline
- Retry logic para failed requests

### 3. Relay Message (Conversas)
**Severidade:** CRÍTICO
**Impacto:** Equipe pode enviar mensagens erradas
**Fix:** 1 dia

- Adicionar preview em real-time
- Confirmation dialog antes de enviar
- Toast notification com status (enviada/entregue/erro)

### 4. Reservation Wizard — Sem Cálculo de Preço
**Severidade:** ALTO
**Impacto:** Usuário cria reserva sem saber custo
**Fix:** 1 dia

- Embed quotation.js no wizard
- Mostrar breaking down (7 noites × R$300 = R$2.100)
- Mostrar desconto se aplicável
- Mostrar total final

### 5. Calendário — Double-Booking
**Severidade:** ALTO
**Impacto:** Usuário pode criar reservas conflitantes
**Fix:** 1 dia

- Validar disponibilidade antes de abrir modal
- Visual feedback de room não disponível (greyed out)
- Erro claro se tenta salvar com conflito

---

## ⚠️ ISSUES ALTOS

### 1. Mobile-First Design
**Severidade:** ALTO
**Status:** MVP desktop-only recomendado
**Fix:** Phase 2 (2-3 semanas)

- Refactor para mobile-first (sm/md/lg breakpoints)
- Tabelas → card layout em mobile
- Sidebar → hamburger menu
- Modals → full-screen em mobile

### 2. Forms — Validation & Feedback
**Severidade:** ALTO
**Impacto:** Usuário não sabe campo tem erro
**Fix:** 2 dias

- Inline error messages (field-level)
- Red border/text para campos com erro
- Loading state durante submit (button disabled + spinner)
- Success message após salvar
- Dirty state warning (sair sem salvar)

### 3. Data Formatting
**Severidade:** ALTO
**Impacto:** Inconsistência em datas/moedas
**Fix:** 1 dia

- Centralizar formatters (formatDate, formatCurrency, formatPhone)
- Usar pt-BR locale em date-fns/Intl
- Documentar padrão (DD/MM/YYYY, R$ X.XXX,00)

### 4. Modals — UX Completo
**Severidade:** ALTO
**Impacto:** Modals sem lifecycle completo
**Fix:** 2 dias

- Focus management (autofocus primeiro field)
- Escape key handler
- Initial/edit mode visual diferente
- Loading state durante submit
- Error state se falhar
- Success feedback após salvar

### 5. Empty States
**Severidade:** MÉDIO
**Impacto:** Novo usuário confuso
**Fix:** 2 dias

- Definir empty states para 6+ páginas
- Educativo (imagem + texto + CTA)
- Onboarding walkthrough (opcional)

---

## 💡 RECOMENDAÇÕES MÉDIAS

### 1. Design System / Tokens
**Fix:** 1 dia de documentação
Mapear todas cores, spacing, shadows no tailwind.config.ts

### 2. Role-Based UI
**Fix:** 2 dias
Diferenciar Dashboard/Conversas/Analytics por user.role

### 3. Bulk Actions
**Fix:** 1 dia
Checkboxes em tabelas + "Mark as converted" em massa

### 4. Sorting & Filtering
**Fix:** 2 dias
Colunas nas tabelas devem ser sortable

### 5. Drag-Drop Feedback
**Severity:** MÉDIO
**Fix:** 1 dia
- Visual feedback ao arrastar
- Toast notification ao soltar
- Desfazer (undo)

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 0 (Day 1-2) — Setup Design System
- [ ] Criar `lib/design-tokens.ts` centralizando cores/spacing
- [ ] Configurar `tailwind.config.ts` com variáveis
- [ ] Documentar pattern para Button, Input, Card, Modal
- [ ] Exemplo: implementar Button com 4 variantes
- [ ] Storybook setup (optional mas recomendado)

### Fase 1 (Week 1-2) — Críticos
- [ ] Keyboard navigation em todos componentes
- [ ] Screen reader labels (aria-*)
- [ ] Toast notification system
- [ ] Error handling em toda ação assíncrona
- [ ] Relay message com preview + confirmation
- [ ] Reservation wizard com cálculo de preço
- [ ] Calendário com validação de disponibilidade
- [ ] Forms com error messages inline
- [ ] Loading states em tabelas/modals
- [ ] Empty states nas 6 páginas principais

### Fase 2 (Week 3) — Altos
- [ ] Refactor para mobile-first responsive
- [ ] Sidebar hamburger menu
- [ ] Tabelas card layout em mobile
- [ ] Modals full-screen em mobile
- [ ] Breakpoint testing (sm/md/lg/xl)
- [ ] Touch-friendly buttons (min 44px)
- [ ] Form validation on blur
- [ ] Dirty state warning
- [ ] Undo/Redo para ações principais

### Fase 3 (Week 4+) — Médios
- [ ] Role-based UI (Gerente vs Recepcionista vs Analista)
- [ ] Bulk actions em tabelas
- [ ] Sorting em colunas de tabelas
- [ ] Color contrast audit (acessibilidade)
- [ ] Dark mode support
- [ ] Breadcrumbs em pages detail
- [ ] Back buttons
- [ ] Data pagination com info "1-20 de 142"
- [ ] Export (CSV, PDF) para tabelas
- [ ] Gráficos com drill-down

---

## CONCLUSÃO & RECOMENDAÇÃO

### Recomendação Final

**🟡 CONDITIONALLY APPROVED** — Proceder com implementação, mas com caveats:

**Força o MVP em:**
- Desktop-first (mobile Phase 2)
- Críticos primeiro (a11y, error handling, feedback)
- Design system robusto desde o começo

**Risco se não fizer:**
- Site inacessível (legal liability)
- Usuários perdidos (bad UX)
- Técnica dívida (refator posterior = 2x custo)

### Quick Wins (impacto alto, custo baixo)

Implementar ESTES 5 itens primeiro:

1. **Toast notification system** — 2h
   Feedback imediato em todas ações

2. **Error boundaries** — 2h
   Catch erros e mostrar mensagem clara

3. **Loading skeletons** — 3h
   Skeleton já especificado, só aplicar

4. **Relay message preview** — 2h
   Preview + confirmation modal

5. **Reservation wizard pricing** — 3h
   Embed quotation.js

**Total: ~4 horas de desenvolvimento = 50% melhoria em UX**

---

## DOCUMENTO RELACIONADOS

- `/docs/architecture/crm-frontend-architecture.md` — Arquitetura original
- `/docs/architecture/crm-component-hierarchy.md` — Hierarquia de componentes
- `/docs/prd/CRM-RMS-PRD.md` — PRD com personas

---

**Revisão completa por:** @ux-design-expert
**Data:** 2026-03-07
**Status:** ✅ REVIEW COMPLETO
**Próximo passo:** Feedback do @architect + priorização

