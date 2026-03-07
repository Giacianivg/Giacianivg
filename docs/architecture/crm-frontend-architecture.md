# Arquitetura Full-Stack CRM Web — Pousada Luz da Lua

**Versão:** 1.0
**Data:** 2026-03-07
**Autor:** Aria (@architect)
**Status:** Design Architecture (pronto para implementação Phase 0)
**Epic de Referência:** EPIC-PLU-04 (CRM e Retenção)

---

## Executive Summary

O CRM Web será uma aplicação Next.js 14 (App Router) + React + TypeScript que consome a API Node.js/Supabase já implementada no backend (`server.js` em Vercel). A arquitetura segue princípios de escalabilidade, segurança e performance, com separation of concerns em camadas bem definidas.

**Objetivo:** Dashboard de gestão de reservas, leads, clientes, e analytics com interface profissional em 3-4 semanas.

**Status do Backend:**
- ✅ API (Express + Supabase) implementada em `server.js`
- ✅ Routes de leads, conversations, reservations, payments, availability
- ✅ Database schema validado no Supabase PostgreSQL
- ⏳ Frontend: ainda não existe

---

## I. Diagrama de Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER (Next.js 14)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  /crm/login      │  │  /crm/dashboard  │  │  /crm/analytics  │   │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │   │
│  │  │   Auth UI  │  │  │  │  Widgets   │  │  │  │  Gráficos  │  │   │
│  │  │ Supabase   │  │  │  │  Leads ↓   │  │  │  │ Recharts   │  │   │
│  │  │ <Hook>     │  │  │  │  Reservas  │  │  │  │ Analytics  │  │   │
│  │  └────────────┘  │  │  │  Receita   │  │  │  │            │  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  /crm/leads      │  │  /crm/calendario │  │  /crm/clientes   │   │
│  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │   │
│  │  │   Tabela   │  │  │  │  React Big │  │  │  │   Perfil   │  │   │
│  │  │  Filtros   │  │  │  │  Calendar  │  │  │  │  Histórico │  │   │
│  │  │  Status    │  │  │  │  Drag+Drop │  │  │  │  Notas     │  │   │
│  │  │  Origem    │  │  │  │  Ocupação  │  │  │  │            │  │   │
│  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐                          │
│  │  /crm/reservas   │  │  /crm/conversas  │                          │
│  │  ┌────────────┐  │  │  ┌────────────┐  │                          │
│  │  │ Calendário │  │  │  │  Chat View │  │                          │
│  │  │ Listagem   │  │  │  │  History   │  │                          │
│  │  │ Confirmação│  │  │  │  Relay     │  │                          │
│  │  │            │  │  │  │            │  │                          │
│  │  └────────────┘  │  │  └────────────┘  │                          │
│  └──────────────────┘  └──────────────────┘                          │
│                                                                       │
│                    ┌─────────────────────────┐                       │
│                    │   STATE MANAGEMENT      │                       │
│                    │  TanStack Query (React  │                       │
│                    │  Query) + Context +     │                       │
│                    │  Zustand (optional)     │                       │
│                    └─────────────────────────┘                       │
│                             │                                         │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │
                         HTTP/REST
                              │
                    ┌─────────▼──────────┐
                    │   API Layer        │
                    │  (server.js)       │
                    │  Vercel/Node.js    │
                    │  Express           │
                    └────────┬────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐         ┌──────▼─────┐      ┌──────▼───┐
    │Supabase│         │  Auth      │      │ Email/  │
    │ Postgre│         │  Policies  │      │ Notif.  │
    │   SQL  │         │            │      │         │
    └────────┘         └────────────┘      └─────────┘
```

---

## II. Stack Tecnológico

### Frontend

| Camada | Tecnologia | Versão | Justificativa |
|--------|-----------|--------|---------------|
| **Framework** | Next.js 14 | 14.x (App Router) | SSR, API routes, deploying simples, performance |
| **UI Library** | React | 18.x | Componentes reutilizáveis, controle de estado fino |
| **Linguagem** | TypeScript | 5.x | Type safety, melhor DX, menos bugs |
| **UI Components** | shadcn/ui | latest | Customizável, headless, acessível |
| **CSS** | TailwindCSS | 3.x | Utility-first, produtivo, bundling otimizado |
| **Calendário** | React Big Calendar | 1.8+ | Profissional, suporta drag-drop, flexível |
| **Gráficos** | Recharts | 2.x | Simples, React-first, bom para análise |
| **Data Fetching** | TanStack Query | 5.x | Caching automático, sincronização, polling |
| **Tabelas** | TanStack Table (React Table) | 8.x | Headless, filtros, paginação, sorting |
| **Formulários** | React Hook Form | 7.x | Performance, validação flexível |
| **Validação** | Zod | 3.x | Type-safe schemas, feedback rápido |
| **Auth** | Supabase Auth | built-in | Session management, MFA ready |
| **HTTP Client** | Axios | 1.x | Interceptors, timeout, cancelamento |
| **Date Utils** | date-fns | 3.x | Leve, tree-shakeable, sem mutação |
| **Ícones** | Lucide React | latest | Limpos, acessíveis, tree-shakeable |
| **Toast Notifications** | Sonner | latest | Acessível, bonito, fácil |
| **Modais** | Dialog (shadcn/ui) | built-in | Acessível, baseado em Radix UI |
| **Linting** | ESLint | 8.x | Code quality |
| **Formatting** | Prettier | 3.x | Consistência de código |
| **Testing** | Vitest + React Testing Library | latest | Unit tests, component tests |
| **E2E** | Playwright | latest | Testes de fluxo completo |

### Backend (já implementado)

| Camada | Tecnologia | Status |
|--------|-----------|--------|
| Runtime | Node.js 18+ | ✅ Implementado |
| Framework | Express | ✅ Implementado |
| Database | Supabase PostgreSQL | ✅ Implementado |
| Auth | Supabase Auth | ✅ Implementado |
| Deploy | Vercel | ✅ Implementado |

---

## III. Estrutura de Pastas — Frontend

```
crm-web/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Lint + test + build
│   │   └── deploy.yml          # Deploy to Vercel
│   └── ...
│
├── app/                         # Next.js 14 App Router
│   ├── layout.tsx              # Root layout (fonts, providers)
│   ├── page.tsx                # Redirect para /crm/login
│   ├── (auth)/                 # Grupo de rotas autenticadas
│   │   ├── layout.tsx          # Wrapper com AuthGuard + navbar
│   │   ├── crm/
│   │   │   ├── login/
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       └── LoginForm.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── LeadsWidget.tsx
│   │   │   │       ├── ReservationsWidget.tsx
│   │   │   │       ├── ConversionRateWidget.tsx
│   │   │   │       ├── RevenueWidget.tsx
│   │   │   │       └── QuickActions.tsx
│   │   │   │
│   │   │   ├── leads/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx           # Perfil do lead
│   │   │   │   └── components/
│   │   │   │       ├── LeadsTable.tsx
│   │   │   │       ├── LeadFilters.tsx
│   │   │   │       ├── LeadModal.tsx
│   │   │   │       └── StatusBadge.tsx
│   │   │   │
│   │   │   ├── clientes/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx           # Perfil completo
│   │   │   │   │   ├── layout.tsx         # Tabs/sidebar
│   │   │   │   │   └── components/
│   │   │   │   │       ├── ProfileCard.tsx
│   │   │   │   │       ├── ReservationHistory.tsx
│   │   │   │   │       ├── ConversationHistory.tsx
│   │   │   │   │       └── NotesEditor.tsx
│   │   │   │   └── components/
│   │   │   │       ├── ClientsTable.tsx
│   │   │   │       └── ClientFilters.tsx
│   │   │   │
│   │   │   ├── reservas/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx           # Detalhe da reserva
│   │   │   │   └── components/
│   │   │   │       ├── ReservationsCalendar.tsx
│   │   │   │       ├── ReservationsList.tsx
│   │   │   │       ├── ReservationModal.tsx
│   │   │   │       └── ConfirmationFlow.tsx
│   │   │   │
│   │   │   ├── calendario/
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── CalendarGrid.tsx   # React Big Calendar
│   │   │   │       ├── OccupancyLegend.tsx
│   │   │   │       └── RoomTypeSelector.tsx
│   │   │   │
│   │   │   ├── conversas/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx           # Chat viewer
│   │   │   │   └── components/
│   │   │   │       ├── ConversationsList.tsx
│   │   │   │       ├── ChatView.tsx
│   │   │   │       ├── MessageBubble.tsx
│   │   │   │       └── RelayInput.tsx
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── LeadsChart.tsx
│   │   │   │       ├── RevenueTrendChart.tsx
│   │   │   │       ├── ConversionFunnelChart.tsx
│   │   │   │       ├── OccupancyChart.tsx
│   │   │   │       └── KPICards.tsx
│   │   │   │
│   │   │   └── config/
│   │   │       ├── page.tsx
│   │   │       └── components/
│   │   │           ├── SettingsForm.tsx
│   │   │           ├── RoomManagement.tsx
│   │   │           └── PricingTable.tsx
│   │   │
│   │   └── _components/
│   │       ├── Navbar.tsx
│   │       ├── Sidebar.tsx
│   │       ├── AuthGuard.tsx
│   │       └── LayoutWrapper.tsx
│   │
│   └── api/
│       └── auth/
│           └── callback/      # Supabase OAuth callback
│               └── route.ts
│
├── components/
│   ├── ui/                    # shadcn/ui components (gerados)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   ├── alert.tsx
│   │   ├── toast.tsx
│   │   ├── avatar.tsx
│   │   └── ... (mais)
│   │
│   └── common/
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       ├── ConfirmDialog.tsx
│       ├── EmptyState.tsx
│       └── Pagination.tsx
│
├── hooks/
│   ├── useAuth.ts              # Auth context + Supabase session
│   ├── useLeads.ts             # TanStack Query para leads
│   ├── useReservations.ts      # TanStack Query para reservas
│   ├── useConversations.ts     # TanStack Query para conversas
│   ├── useAnalytics.ts         # Fetching de dados analíticos
│   ├── useClients.ts           # Query clientes
│   ├── useAvailability.ts      # Query calendário
│   ├── usePagination.ts        # Lógica de paginação reutilizável
│   ├── useFilters.ts           # Estado de filtros
│   └── useDebounce.ts          # Debounce helper
│
├── services/
│   ├── api/
│   │   ├── client.ts           # Axios instance configurado
│   │   ├── leads.ts            # Funções para leads
│   │   ├── reservations.ts     # Funções para reservas
│   │   ├── conversations.ts    # Funções para conversas
│   │   ├── availability.ts     # Funções para calendário
│   │   ├── payments.ts         # Funções para pagamentos
│   │   ├── analytics.ts        # Funções para analytics
│   │   └── auth.ts             # Auth helpers
│   │
│   ├── supabase/
│   │   └── client.ts           # Cliente Supabase init
│   │
│   └── utils/
│       ├── date.ts             # Utilitários de data
│       ├── currency.ts         # Formatação de moeda
│       ├── validators.ts       # Validações com Zod
│       └── constants.ts        # Constantes (status, etc)
│
├── types/
│   ├── index.ts                # Tipos principais
│   ├── api.ts                  # Respostas de API
│   ├── leads.ts                # Tipos de leads
│   ├── reservations.ts         # Tipos de reservas
│   ├── conversations.ts        # Tipos de conversas
│   ├── clients.ts              # Tipos de clientes
│   └── analytics.ts            # Tipos de dados analíticos
│
├── context/
│   └── AuthContext.tsx         # Contexto global de autenticação
│
├── lib/
│   ├── queryClient.ts          # TanStack Query config
│   └── supabase.ts             # Supabase config
│
├── styles/
│   ├── globals.css             # Estilos globais
│   └── variables.css           # CSS variables (cores, spacing)
│
├── env.d.ts                    # Type-safe env vars
├── next.config.js              # Next.js config
├── tailwind.config.ts          # TailwindCSS config
├── tsconfig.json               # TypeScript config
├── eslintrc.json               # ESLint config
├── .prettierrc.json            # Prettier config
├── vitest.config.ts            # Vitest config (unit tests)
├── playwright.config.ts        # Playwright config (E2E)
├── package.json
├── package-lock.json
├── .env.local.example
├── .gitignore
└── README.md
```

---

## IV. Estrutura de Componentes — Hierarquia

### Página: Dashboard (`/crm/dashboard`)

```
DashboardPage (Server)
  ↓
<DashboardLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <header>
      │   └── <h1>Dashboard</h1>
      │
      ├── <section className="grid-4-cols">
      │   ├── <LeadsWidget />                # Leads novos hoje
      │   │   ├── <Card>
      │   │   ├── <Skeleton> (loading)
      │   │   └── <AlertDialog> (error)
      │   │
      │   ├── <ReservationsWidget />         # Reservas confirmadas
      │   │   └── <Card>
      │   │
      │   ├── <ConversionRateWidget />       # Taxa de conversão
      │   │   └── <Card>
      │   │
      │   └── <RevenueWidget />              # Receita mês
      │       └── <Card>
      │
      ├── <section className="grid-2-cols">
      │   ├── <RecentLeadsPreview />         # Últimos 5 leads
      │   │   ├── <Card>
      │   │   ├── <Table>
      │   │   │   └── <LeadRow>
      │   │   │       ├── <StatusBadge>
      │   │   │       ├── <Avatar>
      │   │   │       └── <Button> (view)
      │   │   └── <Button>See all</Button>
      │   │
      │   └── <UpcomingReservations />       # Próximas check-ins
      │       ├── <Card>
      │       ├── <List>
      │       │   └── <ReservationItem>
      │       │       ├── <Badge> (status)
      │       │       └── <Button> (confirm)
      │       └── <Button>See calendar</Button>
      │
      └── <QuickActions />                   # Atalhos
          └── <ButtonGroup>
              ├── <Button>New Lead</Button>
              ├── <Button>New Reservation</Button>
              └── <Button>Send Relay</Button>
```

### Página: Leads (`/crm/leads`)

```
LeadsPage (Server)
  ↓
<LeadsLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <header>
      │   ├── <h1>Leads</h1>
      │   └── <Button>Add Lead</Button>
      │
      ├── <LeadFilters />                   # Filtros + search
      │   ├── <Input placeholder="Search..." />
      │   ├── <Select label="Status">
      │   │   ├── Novo
      │   │   ├── Em atendimento
      │   │   ├── Cotação enviada
      │   │   ├── Reserva solicitada
      │   │   ├── Reservado
      │   │   └── Encerrado
      │   ├── <Select label="Origem">
      │   │   ├── WhatsApp Direto
      │   │   ├── Meta Ads
      │   │   ├── Google Ads
      │   │   ├── Booking
      │   │   ├── Airbnb
      │   │   ├── Site Próprio
      │   │   ├── Indicação
      │   │   └── Outro
      │   └── <Button>Clear filters</Button>
      │
      ├── <LeadsTable />                    # TanStack Table
      │   ├── <thead>
      │   │   └── <th>
      │   │       ├── Nome
      │   │       ├── Telefone
      │   │       ├── Status [sortable]
      │   │       ├── Origem [sortable]
      │   │       ├── Última interação [sortable]
      │   │       ├── Valor cotado
      │   │       └── Ações
      │   ├── <tbody>
      │   │   └── <LeadRow>
      │   │       ├── <Avatar>
      │   │       ├── Nome / Telefone
      │   │       ├── <StatusBadge>
      │   │       ├── <Badge>Origem</Badge>
      │   │       ├── Data formatada
      │   │       ├── R$ cotação
      │   │       └── <Menu>
      │   │           ├── View
      │   │           ├── Edit
      │   │           ├── Convert to reservation
      │   │           └── Delete
      │   └── <Pagination>
      │
      └── <LeadModal />                     # Dialog para criar/editar
          └── <Form>
              ├── <Input label="Nome" />
              ├── <Input label="Telefone" />
              ├── <Select label="Status" />
              ├── <Select label="Origem" />
              ├── <Textarea label="Notas" />
              └── <Button>Save</Button>
```

### Página: Calendário (`/crm/calendario`)

```
CalendarPage (Server)
  ↓
<CalendarLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <header>
      │   ├── <h1>Calendário</h1>
      │   └── <RoomTypeSelector />          # ALA_A, ALA_B, ALA_C_CASAL
      │
      ├── <CalendarGrid />                  # React Big Calendar
      │   ├── <View>Month</View> / <View>Week</View>
      │   ├── <Calendar
      │   │   events={[{ start, end, title, roomType }]}
      │   │   onSelectEvent={handleSelectReservation}
      │   │   onSelectSlot={handleSelectDates}
      │   │   style={{ height: '100vh' }}
      │   │ />
      │   │
      │   └── <Tooltip>  # Ao hover sobre evento
      │       ├── Cliente: João Silva
      │       ├── Tipo: ALA_A
      │       ├── Data: 10-12/mar
      │       ├── Pessoas: 3
      │       ├── Total: R$1.200
      │       └── <Button>View details</Button>
      │
      ├── <OccupancyLegend />               # Código de cores
      │   └── <div className="flex gap-4">
      │       ├── <Badge color="green">Disponível</Badge>
      │       ├── <Badge color="blue">Reservado</Badge>
      │       ├── <Badge color="yellow">Bloqueado</Badge>
      │       └── <Badge color="red">Manutenção</Badge>
      │
      └── <ReservationDetail />             # Painel direito (se selecionado)
          ├── <Card>
          ├── Cliente
          ├── Datas
          ├── Tipo/Pessoas
          ├── Total
          └── <Button>Edit / Confirm / Cancel</Button>
```

### Página: Clientes (`/crm/clientes`)

```
ClientsPage (Server)
  ↓
<ClientsLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <header>
      │   ├── <h1>Clientes</h1>
      │   └── <Button>Add Client</Button>
      │
      ├── <ClientFilters />                 # Search + filter
      │   ├── <Input placeholder="Buscar por nome..." />
      │   └── <Select label="Período">
      │       ├── Todos
      │       ├── Este mês
      │       ├── Este trimestre
      │       └── Este ano
      │
      ├── <ClientsTable />                  # TanStack Table
      │   └── <tbody>
      │       └── <ClientRow>
      │           ├── <Avatar> + Nome
      │           ├── Telefone
      │           ├── Primeira Conversa
      │           ├── Última Conversa
      │           ├── Total gasto (R$)
      │           ├── NPS
      │           └── <Button>View profile</Button>
      │
      └── <Pagination>
```

### Página: Detalhes do Cliente (`/crm/clientes/[id]`)

```
ClientProfilePage
  ↓
<ProfileLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <header>
      │   ├── <Avatar size="lg" />
      │   ├── <h1>João Silva</h1>
      │   ├── <p>Telefone: (19) 99234-5678</p>
      │   └── <ButtonGroup>
      │       ├── <Button>Edit</Button>
      │       └── <Button>Send Message</Button>
      │
      ├── <Tabs>
      │   ├── <Tab label="Visão Geral">
      │   │   ├── <Card>
      │   │   │   ├── <h3>Resumo</h3>
      │   │   │   ├── Total gasto: R$5.200
      │   │   │   ├── Reservas: 2
      │   │   │   ├── Última visita: 25/fev/2026
      │   │   │   ├── NPS: 8/10
      │   │   │   └── Status: Cliente ativo
      │   │   │
      │   │   └── <Card>
      │   │       ├── <h3>Próximas Reservas</h3>
      │   │       └── <List>
      │   │           ├── 15-18/mar — ALA_B — R$1.500
      │   │           └── 05-07/abr — ALA_A — R$900
      │   │
      │   ├── <Tab label="Histórico de Conversas">
      │   │   └── <ConversationThread>
      │   │       ├── <MessageBubble from="client">
      │   │       │   └── Olá, tudo bem?
      │   │       ├── <MessageBubble from="bot">
      │   │       │   └── Oi João! Como posso ajudar?
      │   │       └── ... (mais mensagens)
      │   │
      │   ├── <Tab label="Histórico de Reservas">
      │   │   └── <List>
      │   │       ├── <ReservationItem>
      │   │       │   ├── Datas
      │   │       │   ├── Tipo de quarto
      │   │       │   ├── Total
      │   │       │   ├── Status pagamento
      │   │       │   └── <Button>View</Button>
      │   │       └── ... (mais reservas)
      │   │
      │   └── <Tab label="Notas">
      │       └── <NotesEditor>
      │           ├── <Textarea>
      │           │   └── Alergia a frutos do mar...
      │           └── <Button>Save</Button>
      │
      └── <Card>
          ├── <h3>Ações Rápidas</h3>
          └── <ButtonGroup>
              ├── <Button>Enviar promoção</Button>
              ├── <Button>Solicitar NPS</Button>
              └── <Button>Arquivar cliente</Button>
```

### Página: Conversas (`/crm/conversas`)

```
ConversationsPage
  ↓
<ConversationsLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main className="grid-2-cols">
      ├── <aside>
      │   ├── <Input placeholder="Buscar conversa..." />
      │   └── <ConversationsList>
      │       ├── <ConversationItem active>
      │       │   ├── <Avatar />
      │       │   ├── João Silva
      │       │   ├── "Olá! Gostaria de..."
      │       │   ├── 14:30
      │       │   └── <Badge>Sem ler</Badge>
      │       └── ... (mais conversas)
      │
      └── <section>
          ├── <header>
          │   ├── <Avatar /> João Silva
          │   ├── <Button>View profile</Button>
          │   └── <Button>Menu ...</Button>
          │
          ├── <ChatView>
          │   ├── <MessageBubble from="client">
          │   │   ├── Olá, qual o valor para...
          │   │   └── 14:25
          │   ├── <MessageBubble from="bot">
          │   │   ├── Oi João! Para datas de...
          │   │   └── 14:27
          │   ├── <MessageBubble from="human">    # Relay da equipe
          │   │   ├── ⚡ Equipe
          │   │   ├── Oi João, tudo bem?
          │   │   └── 14:35
          │   └── ... (mais mensagens)
          │
          └── <RelayInput>
              ├── <Textarea
              │   placeholder="Digite resposta (será enviada como relayed)..."
              │   maxLength={1000}
              │ />
              ├── <p className="text-xs">
              │   ⚡ Será enviado como: "Equipe: sua mensagem"
              │ </p>
              └── <Button>Send</Button>
```

### Página: Analytics (`/crm/analytics`)

```
AnalyticsPage
  ↓
<AnalyticsLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <DateRangePicker />               # Custom date range
      │   ├── Data início
      │   ├── Data fim
      │   └── <Button>Apply</Button>
      │
      ├── <KPICards />                      # 4 cards no topo
      │   ├── <Card>
      │   │   ├── Leads (período): 45
      │   │   ├── % nova: 60%
      │   │   └── Trending ↑
      │   ├── <Card>
      │   │   ├── Conversão: 22%
      │   │   └── Meta: 25%
      │   ├── <Card>
      │   │   ├── Receita: R$18.500
      │   │   └── vs período anterior: +12%
      │   └── <Card>
      │       ├── Taxa ocupação: 68%
      │       └── Capacidade máxima: 100%
      │
      ├── <section className="grid-2-cols">
      │   ├── <LeadsChart />                # Gráfico de leads (linha)
      │   │   └── <LineChart
      │   │       data={leadsData}
      │   │       dataKey="date"
      │   │       lines={[{ dataKey: 'leads' }]}
      │   │     />
      │   │
      │   └── <ConversionFunnelChart />     # Funil (bar)
      │       └── <BarChart
      │           data={[
      │             { stage: 'Leads', value: 100 },
      │             { stage: 'Cotação enviada', value: 45 },
      │             { stage: 'Reservado', value: 22 },
      │           ]}
      │         />
      │
      ├── <section className="grid-2-cols">
      │   ├── <RevenueTrendChart />         # Revenue (área)
      │   │   └── <AreaChart data={revenueData} />
      │   │
      │   └── <OccupancyChart />            # Ocupação (linha)
      │       └── <LineChart data={occupancyData} />
      │
      └── <section>
          ├── <h3>Leads por Origem</h3>
          └── <PieChart data={originData} />
```

### Página: Config (`/crm/config`)

```
ConfigPage
  ↓
<ConfigLayout>
  ├── <NavBar />
  ├── <Sidebar />
  └── <main>
      ├── <h1>Configurações</h1>
      │
      ├── <Tabs>
      │   ├── <Tab label="Quartos e Preços">
      │   │   ├── <Card>
      │   │   │   ├── <h3>Tipos de Quarto</h3>
      │   │   │   └── <RoomTable>
      │   │   │       ├── <tbody>
      │   │   │       │   ├── ALA_A | 8 | Edit | Delete
      │   │   │       │   ├── ALA_B | 7 | Edit | Delete
      │   │   │       │   └── ALA_C_CASAL | 1 | Edit | Delete
      │   │   │       └── <Button>Add room type</Button>
      │   │   │
      │   │   └── <Card>
      │   │       ├── <h3>Tabela de Preços</h3>
      │   │       └── <PricingTable>
      │   │           ├── Temporada | Tipo | Preço/noite | Min. noites | Edit
      │   │           ├── Baixa | ALA_A | R$300 | 1 | Edit
      │   │           ├── Média | ALA_A | R$350 | 2 | Edit
      │   │           └── ... (mais)
      │   │
      │   ├── <Tab label="Integrações">
      │   │   ├── <Card>
      │   │   │   ├── <h3>Supabase</h3>
      │   │   │   ├── Status: ✅ Conectado
      │   │   │   ├── Projeto: balmy-vertex...
      │   │   │   └── <Button>Reconectar</Button>
      │   │   │
      │   │   ├── <Card>
      │   │   │   ├── <h3>Anthropic / Claude</h3>
      │   │   │   ├── Status: ✅ Configurado
      │   │   │   ├── Modelo: claude-sonnet-4-6
      │   │   │   └── <Button>Test API</Button>
      │   │   │
      │   │   └── <Card>
      │   │       ├── <h3>WhatsApp</h3>
      │   │       ├── Status: ✅ Ativo
      │   │       ├── Número: (19) 99840-0306
      │   │       ├── API version: v18.0
      │   │       └── <Button>View logs</Button>
      │   │
      │   └── <Tab label="Notificações">
      │       ├── <Card>
      │       │   ├── <Checkbox> Email para nova reserva
      │       │   ├── <Checkbox> Alerta de ocupação > 80%
      │       │   ├── <Checkbox> Resumo diário
      │       │   └── <Checkbox> Alertas de pagamento
      │       │
      │       └── <Card>
      │           ├── Email para receber: (input)
      │           └── <Button>Save</Button>
```

---

## V. API Integration Specification

### Base URL
```
Production: https://giacianivg.vercel.app
Local dev: http://localhost:3001
```

### Authentication

**Method:** Supabase Auth + JWT in Authorization header

```typescript
// Client-side
const { data: { session } } = await supabase.auth.getSession();
// token = session?.access_token

// All requests include:
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### API Endpoints Needed

#### **LEADS**

```typescript
// GET /api/leads?status=&origin=&page=1&limit=20&search=
GET /api/leads
Response: {
  success: true,
  data: [
    {
      id: string,
      whatsapp_number: string,
      name: string,
      status: 'novo' | 'em_atendimento' | 'cotacao_enviada' | 'reserva_solicitada' | 'reservado' | 'encerrado',
      origin: string,
      created_at: string,
      updated_at: string,
      last_interaction: string,
      quotation_value?: number,
      quotation_sent_at?: string,
    }[]
  ],
  pagination: { page, limit, total, pages }
}

// GET /api/leads/:id
GET /api/leads/123
Response: {
  success: true,
  data: {
    id, whatsapp_number, name, status, origin, created_at, ...
    conversations: [{ id, message, role, timestamp }...],
    reservations: [{ id, dates, total }...],
    notes: string
  }
}

// POST /api/leads/upsert
POST /api/leads/upsert
Body: { whatsapp_number, name?, status? }
Response: { lead_id, lead: {...} }

// PATCH /api/leads/:id
PATCH /api/leads/123
Body: { name?, status?, origin?, notes? }
Response: { success: true, data: {...} }

// DELETE /api/leads/:id
DELETE /api/leads/123
Response: { success: true }
```

#### **CONVERSATIONS**

```typescript
// GET /api/conversations?lead_id=&page=1&limit=50
GET /api/conversations
Response: {
  success: true,
  data: [
    {
      id: string,
      lead_id: string,
      message: string,
      role: 'user' | 'bot' | 'human',
      timestamp: string,
      relay_from?: string,
    }[]
  ],
  pagination: {...}
}

// POST /api/conversations
POST /api/conversations
Body: { lead_id, message, role, relay_from? }
Response: { success: true, conversation: {...} }
```

#### **RESERVATIONS**

```typescript
// GET /api/reservations?status=&page=1&limit=20
GET /api/reservations
Response: {
  success: true,
  data: [
    {
      id: string,
      lead_id: string,
      client_name: string,
      client_phone: string,
      check_in: string (date),
      check_out: string (date),
      room_type: string,
      guest_count: number,
      total_value: number,
      status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled',
      payment_status: 'pending' | 'partial' | 'paid',
      created_at: string,
    }[]
  ],
  pagination: {...}
}

// GET /api/reservations/:id
GET /api/reservations/456
Response: { success: true, data: {...full details...} }

// POST /api/reservations
POST /api/reservations
Body: {
  lead_id, check_in, check_out, room_type, guest_count, total_value, status
}
Response: { success: true, reservation_id, reservation: {...} }

// PATCH /api/reservations/:id/confirm
PATCH /api/reservations/456/confirm
Body: { payment_method?, deposit_amount? }
Response: { success: true, data: {...updated...} }

// PATCH /api/reservations/:id
PATCH /api/reservations/456
Body: { status?, payment_status?, notes? }
Response: { success: true, data: {...} }

// DELETE /api/reservations/:id
DELETE /api/reservations/456
Response: { success: true }
```

#### **AVAILABILITY / CALENDAR**

```typescript
// GET /api/availability/calendar?start_date=&end_date=&room_type=
GET /api/availability/calendar
Response: {
  success: true,
  data: [
    {
      date: string,
      room_type: string,
      total_units: number,
      reserved: number,
      available: number,
      status: 'available' | 'reserved' | 'blocked',
    }[]
  ]
}

// GET /api/availability?room_type=&date=
GET /api/availability
Response: { success: true, data: {...} }

// POST /api/availability/block
POST /api/availability/block
Body: { room_type, start_date, end_date, reason? }
Response: { success: true }

// POST /api/availability/unblock
POST /api/availability/unblock
Body: { room_type, start_date, end_date }
Response: { success: true }
```

#### **PAYMENTS**

```typescript
// GET /api/payments?reservation_id=
GET /api/payments
Response: {
  success: true,
  data: [
    {
      id: string,
      reservation_id: string,
      amount: number,
      method: 'pix' | 'card' | 'cash',
      status: 'pending' | 'processed' | 'failed',
      created_at: string,
    }[]
  ]
}

// POST /api/payments
POST /api/payments
Body: { reservation_id, amount, method, pix_key? }
Response: { success: true, payment_id, payment: {...} }
```

#### **PROPOSALS / QUOTATIONS**

```typescript
// POST /api/proposals
POST /api/proposals
Body: { lead_id, check_in, check_out, room_type, guest_count }
Response: {
  success: true,
  data: {
    quotation_id: string,
    room_type: string,
    check_in: string,
    check_out: string,
    nights: number,
    price_per_night: number,
    subtotal: number,
    discount_percent: number,
    discount_amount: number,
    total: number,
  }
}

// GET /api/proposals/:id
GET /api/proposals/789
Response: { success: true, data: {...} }
```

#### **ANALYTICS** (NEW ENDPOINTS)

```typescript
// GET /api/analytics/kpis?start_date=&end_date=
GET /api/analytics/kpis
Response: {
  success: true,
  data: {
    leads_count: number,
    leads_new_percent: number,
    conversion_rate: number,
    total_revenue: number,
    occupancy_rate: number,
  }
}

// GET /api/analytics/leads-trend?start_date=&end_date=&group_by=day|week|month
GET /api/analytics/leads-trend
Response: {
  success: true,
  data: [{ date, count }...]
}

// GET /api/analytics/revenue-trend?start_date=&end_date=&group_by=
GET /api/analytics/revenue-trend
Response: {
  success: true,
  data: [{ date, revenue }...]
}

// GET /api/analytics/conversion-funnel?start_date=&end_date=
GET /api/analytics/conversion-funnel
Response: {
  success: true,
  data: [
    { stage: 'Leads', count: 100 },
    { stage: 'Cotação enviada', count: 45 },
    { stage: 'Reservado', count: 22 },
  ]
}

// GET /api/analytics/occupancy?start_date=&end_date=
GET /api/analytics/occupancy
Response: {
  success: true,
  data: [{ date, occupancy_percent, available_rooms }...]
}

// GET /api/analytics/leads-by-origin?start_date=&end_date=
GET /api/analytics/leads-by-origin
Response: {
  success: true,
  data: [
    { origin: 'WhatsApp Direto', count: 30 },
    { origin: 'Meta Ads', count: 15 },
    ...
  ]
}
```

---

## VI. State Management Strategy

### Authentication (Global)

**Context:** `AuthContext` (React Context + Supabase)

```typescript
interface AuthContext {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email, password) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email, password) => Promise<void>;
}

// Usage in components
const { user, session, isLoading } = useAuth();
```

### Data Fetching (Global + Local)

**Framework:** TanStack Query (React Query)

```typescript
// Setup in lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 min
      gcTime: 1000 * 60 * 10,          // 10 min (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Custom hooks (in hooks/)
export function useLeads(filters?: { status, origin, search, page }) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => leadsService.getLeads(filters),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsService.getLeadById(id),
  });
}

// Usage in components
const { data, isLoading, error } = useLeads({ status: 'novo', page: 1 });
```

### Form State (Local)

**Framework:** React Hook Form + Zod

```typescript
// Form validation schema
import { z } from 'zod';

const leadSchema = z.object({
  name: z.string().min(2),
  whatsapp_number: z.string().regex(/^\d{10,15}$/),
  status: z.enum(['novo', 'em_atendimento', ...]),
  notes: z.string().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

// In component
const { register, handleSubmit, formState: { errors } } = useForm<LeadForm>({
  resolver: zodResolver(leadSchema),
});

const onSubmit = async (data) => {
  await leadsService.upsert(data);
  // refetch list
};

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <input {...register('name')} />
    {errors.name && <p>{errors.name.message}</p>}
    ...
  </form>
);
```

### UI State (Local)

**Framework:** Component state (useState) + optional Zustand

```typescript
// For simple modal/dialog state: useState
const [isModalOpen, setIsModalOpen] = useState(false);

// For complex multi-page navigation state (optional): Zustand
import { create } from 'zustand';

export const useFiltersStore = create((set) => ({
  status: null,
  origin: null,
  setStatus: (status) => set({ status }),
  setOrigin: (origin) => set({ origin }),
  reset: () => set({ status: null, origin: null }),
}));

// Usage
const { status, setStatus } = useFiltersStore();
```

---

## VII. Implementação — Fases

### **Phase 0: Setup (2 dias) — @dev**

#### Tarefas
1. Criar repositório Next.js 14 com template TypeScript
2. Configurar TailwindCSS + shadcn/ui
3. Configurar Supabase Auth (google button, email/password fallback)
4. Setup de Axios client com interceptors (auth token)
5. Setup de TanStack Query provider
6. Estrutura de pastas + index files vazios
7. Configurar ESLint + Prettier + TypeScript strict mode
8. Setup de testes (Vitest + React Testing Library)
9. Criar `.env.local.example`
10. Deploy skeleton no Vercel

**Critérios de aceitação:**
- ✅ npm install funciona
- ✅ npm run dev levanta servidor local
- ✅ npm run build sem erros
- ✅ Supabase connection tested
- ✅ Vercel deployment OK (página em branco é aceitável)

---

### **Phase 1: Auth + Layout (3 dias) — @dev**

#### Componentes
1. `AuthContext` + `useAuth()` hook
2. `AuthGuard` wrapper para rotas protegidas
3. `LoginForm` com Supabase Auth (email/password)
4. `Navbar` com menu user, logout, breadcrumbs
5. `Sidebar` com navegação /crm/* links
6. `LayoutWrapper` para aplicar navbar + sidebar
7. Auth error handling + toast notifications
8. Página de login funcional
9. Redirect logic: `/` → `/crm/login` se não autenticado; `/crm/login` → `/crm/dashboard` se autenticado

**Critérios de aceitação:**
- ✅ Login/logout completo
- ✅ Session persiste após reload
- ✅ Páginas protegidas bloqueadas sem auth
- ✅ Navbar + sidebar renderiza em todos os /crm/*
- ✅ Mobile responsive (breakpoints)

---

### **Phase 2: Dashboard + Widgets (4 dias) — @dev**

#### Componentes
1. `LeadsWidget` com TanStack Query (últimos 24h count)
2. `ReservationsWidget` (reservas confirmadas semana)
3. `ConversionRateWidget` (leads → reservas %)
4. `RevenueWidget` (receita mês)
5. `RecentLeadsPreview` (tabela 5 últimas)
6. `UpcomingReservations` (próximas check-ins)
7. `QuickActions` (botões rápidos)
8. Skeleton loaders para cada widget
9. Error states com retry button
10. Dashboard page layout

**Critérios de aceitação:**
- ✅ Todos 4 widgets carregam dados via API
- ✅ Dados atualizam ao reload
- ✅ Loading states mostram skeletons
- ✅ Error states recuperáveis
- ✅ Responsivo

---

### **Phase 3: Leads Management (5 dias) — @dev**

#### Componentes
1. `LeadsTable` com TanStack Table (sorting, filtering, pagination)
2. `LeadFilters` (status, origin, search)
3. `LeadModal` (create/edit form com React Hook Form)
4. `StatusBadge` (componente de cor por status)
5. `LeadRow` com avatar, actions menu
6. Leads page layout
7. Lead detail page com dados expandidos
8. Delete confirmation dialog
9. Bulk actions (select multiple, change status)

**Critérios de aceitação:**
- ✅ Listar leads com paginação
- ✅ Filtrar por status, origem, search em tempo real (debounced)
- ✅ Criar novo lead via modal
- ✅ Editar lead existente
- ✅ Deletar lead com confirmação
- ✅ Ver detalhe do lead (conversas, reservas)
- ✅ Responsivo

---

### **Phase 4: Calendário + Reservas (6 dias) — @dev**

#### Componentes
1. `CalendarGrid` com React Big Calendar
2. `OccupancyLegend` (cores de status)
3. `RoomTypeSelector` (filtrar por ALA_A, etc)
4. `ReservationsCalendar` (view alternativo)
5. `ReservationsList` (listagem com filtros)
6. `ReservationModal` (criar/editar)
7. `ConfirmationFlow` (wizard 3 passos)
8. Calendar page layout
9. Reservation detail page
10. Drag-drop to change dates (se suportado por React Big Calendar)

**Critérios de aceitação:**
- ✅ Calendário mostra eventos (reservas)
- ✅ Clicar em data abre modal de nova reserva
- ✅ Clicar em evento mostra detalhes
- ✅ Filtrar por tipo de quarto
- ✅ Criar reserva (linked a lead)
- ✅ Editar datas/pessoas
- ✅ Confirmação com cálculo de total
- ✅ Responsivo (calendar pode scrollar em mobile)

---

### **Phase 5: Clientes + Conversas (4 dias) — @dev**

#### Componentes
1. `ClientsTable` (TanStack Table)
2. `ClientFilters` (search, período)
3. `ClientProfilePage` com tabs
4. `ProfileCard` (avatar, info básica)
5. `ReservationHistory` (lista de reservas anteriores)
6. `ConversationHistory` (histórico de chats)
7. `NotesEditor` (textarea editável)
8. `ConversationsList` (sidebar com lista de conversas)
9. `ChatView` (mensagens, thread)
10. `MessageBubble` (estilo por role: user/bot/human)
11. `RelayInput` (equipe responde)
12. Conversas page layout
13. Detalhe de conversa com cliente

**Critérios de aceitação:**
- ✅ Listar clientes com dados (nome, telefone, próximas reservas)
- ✅ Perfil completo com histórico
- ✅ Editar notas do cliente
- ✅ Ver histórico de conversas
- ✅ Chat view com scroll
- ✅ Enviar relay (mensagem da equipe)
- ✅ Responsivo

---

### **Phase 6: Analytics (5 dias) — @dev**

#### Componentes
1. `DateRangePicker` (custom range + presets)
2. `KPICards` (4 cards: leads, conversão, receita, ocupação)
3. `LeadsChart` (Recharts LineChart)
4. `ConversionFunnelChart` (BarChart funil)
5. `RevenueTrendChart` (AreaChart receita)
6. `OccupancyChart` (LineChart ocupação %)
7. `LeadsOriginChart` (PieChart origem)
8. Analytics page layout
9. Exportar dados (CSV, PDF — opcional Phase 6.5)

**Critérios de aceitação:**
- ✅ KPI cards carregam dados
- ✅ Todos os gráficos renderizam
- ✅ Date range filter funciona
- ✅ Dados atualizam ao mudar datas
- ✅ Gráficos responsivos
- ✅ Tooltips em hover

---

### **Phase 7: Config (2 dias) — @dev**

#### Componentes
1. `RoomTable` (listar, editar, deletar tipos)
2. `PricingTable` (editar tarifas)
3. `SettingsForm` (notificações, email)
4. Integration status cards (Supabase, Claude, WhatsApp)
5. Config page com tabs

**Critérios de aceitação:**
- ✅ Editar tipos de quarto (read-only em MVP)
- ✅ Editar preços (read-only em MVP)
- ✅ Ver status de integrações
- ✅ Editar email para notificações

---

### **Phase 8: Polish + Testing (3 dias) — @dev + @qa**

#### Tarefas
1. Unit tests para hooks (useLeads, useReservations, etc)
2. Component tests para tabelas, modais, forms
3. E2E tests para fluxos críticos (login → criar reserva)
4. Testes de acessibilidade (a11y)
5. Mobile testing (iOS/Android)
6. Performance audit (Lighthouse)
7. Otimização de imagens
8. Bundle analysis
9. Fix de bugs descobertos
10. Documentação de componentes (Storybook — opcional)

**Critérios de aceitação:**
- ✅ >80% test coverage
- ✅ Lighthouse score >90
- ✅ Mobile performance OK
- ✅ Acessibilidade basics (alt text, labels, etc)
- ✅ Sem console errors/warnings

---

### **Phase 9: Deployment + Docs (1 dia) — @devops**

#### Tarefas
1. Setup CI/CD (GitHub Actions: lint, test, build, deploy)
2. Environment variables (dev, staging, prod)
3. Staging URL + Production URL
4. README com setup instructions
5. API documentation (Swagger/OpenAPI — opcional)
6. Component documentation (Storybook — opcional)
7. Known issues / roadmap

**Critérios de aceitação:**
- ✅ Staging deployment automático
- ✅ Production deployment manual (com aprovação)
- ✅ All tests passing on CI
- ✅ README updated

---

## VIII. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| **API mudanças de schema** | Média | Alto | Versionamento de API, tipos TypeScript gerados de schema |
| **Performance — tabelas grandes** | Média | Médio | Virtual scrolling (TanStack Table supports), pagination, índices DB |
| **Autenticação / session bugs** | Baixa | Alto | Testes e2e de login/logout, session refresh logic |
| **Calendário — muitos eventos** | Média | Médio | Lazy load eventos, filtrar por room type, clustering |
| **Mobile — layout quebra** | Baixa | Médio | Responsive design desde início, Mobile First approach |
| **Deployment — env vars faltando** | Baixa | Alto | Checklist de env vars, health endpoint testa conexão |
| **Supabase downtime** | Baixa | Alto | Error boundaries, offline detection, fallback UI |
| **Browser compat — IE11 etc** | Baixa | Baixo | Next.js 14 moderna, não suporta IE (aceitável) |
| **State sync — lead muda em outra aba** | Média | Médio | Polling com TanStack Query, real-time via webhooks (futuro) |

---

## IX. Tecnologia Decision Record — Trade-offs

### Por que Next.js 14 (vs Vite + React)?
- ✅ File-based routing (menos config)
- ✅ API routes built-in
- ✅ SSR/SSG ready
- ✅ Image optimization
- ✅ Deployment Vercel sem friction
- ❌ Maior bundle size (trade-off aceitável)

### Por que TanStack Query (vs SWR)?
- ✅ Mais features (mutations, cache management)
- ✅ Melhor DX com devtools
- ✅ Background refetch automático
- ❌ Mais boilerplate inicial

### Por que React Big Calendar (vs FullCalendar.io)?
- ✅ Open source, sem license
- ✅ Simples, integra bem com React
- ✅ Drag-drop support
- ❌ Menos features que FullCalendar

### Por que Recharts (vs Chart.js / D3)?
- ✅ React-first, simples
- ✅ Composable
- ✅ Responsivo por padrão
- ❌ Menos customizável que D3

### Por que Supabase Auth (vs Auth0)?
- ✅ Integrado com Postgres
- ✅ Free tier
- ✅ Controle total
- ❌ Menos enterprise features

---

## X. Monitoramento e Observabilidade

### Frontend Monitoring

```typescript
// Sentry (error tracking)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Google Analytics 4
gtag.event('page_view', { page_location: pathname });

// Custom metrics
// Tempo para carregar dashboard
performance.mark('dashboard-loaded');
```

### API Monitoring

- Vercel Analytics (built-in)
- Supabase Logs (postgres, auth)
- Error alerts via email/Slack

### Alertas Recomendados

| Métrica | Threshold | Ação |
|---------|-----------|------|
| API error rate | >5% | Slack alert |
| Dashboard load time | >3s | Investigate |
| Auth failures | >10/hora | Review logs |
| Database slow queries | >1s | Analyze query |

---

## XI. Roadmap Futuro (Post-MVP)

### Phase 10: Real-time Updates
- WebSocket connection para chat + calendário
- Webhook de Supabase para eventos
- Live notifications quando alguém abre/edita um lead

### Phase 11: Relatórios Exportáveis
- PDF/CSV export de analytics
- Agendamento de relatórios (diário/semanal)
- Email delivery automático

### Phase 12: Mobile App
- React Native app (share codebase de types/services)
- Push notifications
- Offline-first (eventual sync)

### Phase 13: Integrações
- Booking.com / Airbnb sync
- Stripe/PagSeguro para pagamentos automatizados
- Zapier para automações custom

### Phase 14: AI Features
- Smart lead scoring (ML model)
- Auto-reply sugestões
- Análise de sentimento (conversas)

---

## XII. Checklist de Entrega Final

- [ ] Todos os 7 páginas principais funcionais
- [ ] >80% testes automatizados
- [ ] Lighthouse >90 score
- [ ] Documentação completa (README, JSDoc)
- [ ] Staging + Production deployments
- [ ] User acceptance testing (UAT) com gerente
- [ ] Security audit (OWASP basics)
- [ ] Performance optimization (< 3s FCP)
- [ ] Acessibilidade compliance (WCAG 2.1 AA)
- [ ] Backup + disaster recovery plan

---

## XIII. Referências e Recursos

### Documentação
- [Next.js 14 Docs](https://nextjs.org/docs)
- [React 18 Docs](https://react.dev)
- [TanStack Query Docs](https://tanstack.com/query)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [TailwindCSS](https://tailwindcss.com)
- [React Big Calendar](https://jquense.github.io/react-big-calendar)
- [Recharts](https://recharts.org)

### Boilerplates / Templates
- `create-next-app` com TypeScript
- shadcn/ui CLI: `npx shadcn-ui@latest init`

### Performance Tools
- Lighthouse (Chrome DevTools)
- Bundle Analyzer: `@next/bundle-analyzer`
- React Profiler (React DevTools)

---

## Conclusão

Esta arquitetura foi desenhada para ser **realista, escalável e implementável em 3-4 semanas** com um developer sênior. A stack escolhida minimiza fricção (Next.js + shadcn/ui), maximiza produtividade (TanStack Query + React Hook Form) e facilita manutenção futura (TypeScript strict, testes, monitoring).

O backend (server.js + Supabase) está pronto. O frontend segue as best practices de React moderno, com separação clara de responsabilidades em camadas (UI, hooks, services, types).

**Próximo passo:** Iniciar Phase 0 (setup) e validar a estrutura com um prototype simples (login + dashboard com 1 widget).

---

**Documento criado por:** Aria (@architect)
**Data:** 2026-03-07
**Versão:** 1.0
**Status:** Ready for Implementation
