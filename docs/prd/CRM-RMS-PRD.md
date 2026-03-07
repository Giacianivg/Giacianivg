# CRM Web + Multi-tenant + Pagamento + RMS — Product Requirements Document

**Pousada Luz da Lua**
**Versão:** 2.0 (AMENDED)
**Data:** 2026-03-07
**Autor:** Morgan (@pm)
**Status:** 🟢 APPROVED FOR IMPLEMENTATION

> 📝 **Amendment Log**: v1.0 → v2.0
> - ✅ Added: Email/Senha login (Supabase Auth)
> - ✅ Added: Multi-tenant via subdomínio (empresa1.pousada-luz.com)
> - ✅ Added: Mercado Pago payment integration (Phase 2)
> - ✅ Reorganized: Phase 1 now 4 weeks (auth + multi-tenant), Phase 2 adds payment + RMS

---

## EXECUTIVE SUMMARY

### A Visão

A Pousada Luz da Lua é uma hospedagem 4-estrelas em Socorro-SP com meta de crescimento de R$30k → R$100k/mês. Atualmente, a receita é operada manualmente via WhatsApp + planilhas.

Estamos construindo um **CRM Web operacional** que:
- ✅ Centraliza todos os leads, reservas e clientes
- ✅ Automatiza o funil de vendas (WhatsApp + Claude)
- ✅ Fornece visibilidade em tempo real (dashboards + KPIs)
- ✅ Prepara a base de dados para um **Revenue Management System (RMS) futuro**

### O Problema

| Aspecto | Realidade | Impacto |
|---------|-----------|--------|
| **Gestão de leads** | Dispersa em WhatsApp | Leads perdidos, conversão ~15% |
| **Cotações** | Manuais (equipe) | Tempo resposta >2h, lentidão |
| **Reservas** | Airtable básico | Sem visibilidade de ocupação |
| **Analytics** | Nenhum | Sem dados para otimização |
| **Preços** | Fixos (não dinâmicos) | Receita deixada na mesa |
| **Futuro RMS** | Sem estrutura | Impossível prever demand/receita |

### A Solução

Um **CRM Web Enterprise full-stack** com autenticação + multi-tenant + pagamentos:
- **Frontend:** Next.js 14 + React + TypeScript + TailwindCSS (interface moderna)
- **Backend:** Já pronto (API Node.js em Vercel)
- **Database:** Supabase PostgreSQL com isolamento multi-tenant
- **Autenticação:** Supabase Auth (email + senha) + JWT com tenant_id
- **Pagamentos:** Mercado Pago (PIX + cartão + boleto) integrado em Phase 2
- **Integração:** WhatsApp + Claude Haiku + Google Sheets + Mercado Pago
- **Multi-tenant:** Subdomínios isolados (empresa1.pousada-luz.com, empresa2.pousada-luz.com, etc)
- **Roadmap:**
  - Fase 1 (4 semanas) = CRM operacional + Login + Multi-tenant
  - Fase 2 (4 semanas) = Pagamentos + RMS com previsibilidade

### Oportunidade de Negócio

**Single Tenant (Pousada Luz da Lua):**

| Métrica | Hoje | Phase 1 (CRM+Auth+MT) | Phase 2 (Payment+RMS) | Impacto |
|---------|------|--------------|---------------|--------|
| Taxa conversão lead→reserva | ~15% | 22% | 28% | +R$10k/mês |
| Tempo resposta cotação | 2h | <5m | <1m | +R$5k/mês |
| Taxa ocupação | ~60% | ~68% | 78% | +R$15k/mês |
| Receita estimada | R$30k | R$60k | R$85k | +R$55k/mês |
| Margem | 25% | 32% | 38% | +ROI em 6 semanas |

**Multi-Tenant Scale (10+ clientes em Phase 2):**

| Métrica | Phase 2 Single | Phase 3 (10 tenants) | Crescimento |
|---------|----------------|----------------------|-------------|
| Receita MRR (SaaS) | R$0 | R$50k/mês | — |
| Revenue per tenant | R$85k | R$85k (cada) | Scale linear |
| Margem SaaS | — | 45% | Business model |
| Total MRR | R$85k | R$850k+ | 10x growth |

---

## PRODUCT VISION

### Phase 1: CRM Operacional + Autenticação + Multi-tenant (4 semanas)

**Objetivo:** Centralizar vendas, leads e clientes em um único dashboard com autenticação segura e suporte a múltiplos tenants isolados.

**Entregáveis:**

#### Autenticação & Multi-tenant (Semanas 1-2)
- ✅ **Login/Signup com Email + Senha** (Supabase Auth)
  - Password recovery via email
  - Account settings / change password
  - Session management
- ✅ **Multi-tenant isolação via subdomínio** (empresa1.pousada-luz.com)
  - Supabase RLS policies por tenant_id
  - JWT incluindo tenant_id claim
  - Roteamento automático por subdomínio
  - Segregação de dados em nível de BD
- ✅ **Gerenciamento de Usuários**
  - Roles: admin, receptionist, analyst
  - Permissões baseadas em role
  - Invite usuarios via email
  - Audit log de ações

#### CRM Core (Semanas 2-4)
- ✅ Dashboard executivo com KPIs (conversão, ocupação, receita)
- ✅ Gestão de Leads (CRUD, filtros, histórico conversas)
- ✅ Calendário de Reservas (visual, drag-drop, confirmação)
- ✅ Perfis de Clientes (dados, histórico, preferências)
- ✅ Histórico de Conversas (replay das interações WhatsApp)
- ✅ Analytics básico (funnel, trends, relatórios exportáveis)
- ✅ Config de Preços e Notificações (settings)

**Resultado esperado:**
- Equipe vê TUDO em um lugar (isolado por tenant)
- Login seguro com controle de acesso
- Múltiplos clientes podem usar o sistema (cada um com dados isolados)
- Cotações respondidas em <5m
- Conversão sobe de 15% → 22%
- Receita single: R$30k → R$60k/mês

---

### Phase 2: Pagamentos + RMS Foundation + Previsibilidade (4 semanas)

**Objetivo:** Implementar sistema de pagamentos + estruturar dados + inteligência para otimização de receita.

**Entregáveis:**

#### Pagamentos (Semanas 1-2)
- ✅ **Integração Mercado Pago** (PIX + Cartão + Boleto)
  - Checkout no CRM (sem redirecionar)
  - Webhook para status de pagamento
  - Recibos automáticos via email
  - Payment history por reserva
  - Refund management
- ✅ **Invoice System**
  - Invoice geração automática após pagamento
  - PDF exportável
  - Histórico de pagamentos por cliente
  - Reconciliação com financeiro
- ✅ **Segurança PCI Compliance**
  - Tokenization de cartões (via Mercado Pago)
  - Sem armazenar cartão localmente
  - Audit log de transações
  - Fraud detection básico

#### RMS Foundation (Semanas 2-4)
- ✅ Histórico de conversão (lead → reserva, por origem)
- ✅ Análise de sazonalidade (padrões de demanda)
- ✅ Previsão de ocupação (ML básico)
- ✅ Recomendações de pricing dinâmico (baseado em demand × ocupação)
- ✅ RMS Dashboard (demand forecast, revenue opportunity, payment analytics)
- ✅ API estruturada para futuro (AI pricing, channel manager)

**Resultado esperado:**
- Pagamentos processados 100% online (PIX instantâneo, boleto em 2-3 dias)
- Receita acelerada (sem esperar by bank transfer)
- Gestão sabe quando levantar/descer preços
- Ocupação otimizada: 68% → 78%
- Receita: R$60k → R$85k/mês
- Margem: 32% → 38%
- **Multi-tenant**: Pronto para escalar para 10+ clientes

---

### Roadmap Visual

```
Phase 1: CRM + AUTH + MULTI-TENANT (Semanas 1-4)
    Week 1-2: Autenticação & Multi-tenant
    ├─ Setup backend ✓ (pronto)
    ├─ Supabase Auth (email/senha)
    ├─ Multi-tenant RLS policies
    ├─ Subdomínio routing (empresa1.domain)
    ├─ User management + roles
    └─ Audit logging

    Week 2-4: CRM Core
    ├─ Auth + Layout + Navbar
    ├─ Dashboard + KPIs
    ├─ Leads CRUD
    ├─ Calendário reservas
    ├─ Clientes profiles
    ├─ Analytics gráficos
    └─ Deploy produção

Phase 2: PAGAMENTOS + RMS FOUNDATION (Semanas 5-8)
    Week 5-6: Mercado Pago Integration
    ├─ Checkout inline
    ├─ Webhook handling
    ├─ Invoice system
    ├─ Payment history
    └─ PCI compliance

    Week 6-8: RMS Foundation
    ├─ Histórico conversão
    ├─ Sazonalidade detection
    ├─ ML demand forecast
    ├─ Pricing optimizer (recomendações)
    ├─ RMS dashboard
    └─ Payment analytics

SCALE: Multi-tenant pronto para 10+ clientes (SaaS model)

Phase 3: MONETIZAÇÃO & SCALE (Q3 2026)
    ├─ Dynamic pricing automation
    ├─ Multi-channel (Booking.com, Airbnb)
    ├─ Onboarding de novos tenants
    ├─ +R$800k/mês MRR potencial (10 tenants × R$85k)
    └─ Channel manager integrations
```

---

## USER PERSONAS

### 1. Gerente da Pousada (Júlia)

**Perfil:**
- 35 anos, administradora da pousada
- Precisa de visibilidade executiva
- Toma decisões sobre preços, promoções, staffing
- Usa smartphone + laptop

**Necessidades:**
- Dashboard "em 1 olhada": ocupação, receita, leads ativos
- Relatórios para enviar ao sócio
- Alertas quando algo importante acontece
- Tendências (está crescendo? caindo?)

**Sucesso:**
- "Consigo ver toda a situação em 30s"
- "Reconheço padrões que antes não via"
- "Tomo melhores decisões sobre preços"

---

### 2. Recepcionista (Ana)

**Perfil:**
- 28 anos, atende clientes WhatsApp + telefone
- Está no CRM 6-8h/dia
- Precisa ser rápida e eficiente
- Acesso principalmente via smartphone

**Necessidades:**
- Busca rápida de cliente/reserva
- Histórico de conversa para contexto
- Botões simples: confirmar, escalar, adicionar nota
- Notificações de novas cotações

**Sucesso:**
- "Respondo cotações em 2 minutos, não em 30"
- "Não perco informação de cliente"
- "Vejo o que foi prometido na última conversa"

---

### 3. Analista de Negócio (Future — Tiago)

**Perfil:**
- 30 anos, analisa dados e recomenda otimizações
- Usa BI tools (Tableau, Power BI)
- Precisa de API para exportar dados
- Acesso Python/SQL para análises customizadas

**Necessidades:**
- API estruturada (leads, reservas, conversas, analytics)
- Dados históricos em formato padrão
- Webhooks para alertas automáticos
- Documentação técnica

**Sucesso:**
- "Extraio dados e rodo análises em Python"
- "Recomendo quando levantar/descer preços com base em demand"
- "Integro com tools de BI para dashboards executivos"

---

## MULTI-TENANT ARCHITECTURE

### Isolação de Dados

**Modelo:** Shared database + Row Level Security (RLS) via tenant_id

```
Subdomínios:
├─ empresa1.pousada-luz.com  → leads, reservations, conversations com tenant_id=1
├─ empresa2.pousada-luz.com  → leads, reservations, conversations com tenant_id=2
├─ empresa3.pousada-luz.com  → leads, reservations, conversations com tenant_id=3
└─ ...

Cada tenant:
  └─ Dados completamente isolados (RLS em nível de linha)
  └─ Usuários isolados por tenant
  └─ Dashboard, analytics, relatórios por tenant
  └─ Preços independentes
  └─ Pagamentos processados separadamente
```

### Auth Flow com Multi-tenant

```
1. Usuário acessa empresa1.pousada-luz.com
2. Redireciona para /login (detecta subdomain automaticamente)
3. Login com email + senha (Supabase Auth)
4. JWT recebe claim: { sub, tenant_id: "empresa1", role: "admin" }
5. RLS policy: WHERE tenant_id = current_setting('app.current_tenant')
6. User só vê dados onde tenant_id == seu tenant
7. API automaticamente filtra por tenant do JWT
```

### Data Segregation

```sql
-- Todos os dados de todos os tenants em uma tabela
Table: leads
  id, name, phone, tenant_id, created_at
  │   │    │      │
  │   │    │      └─ Isolação via RLS
  │   │    └─ Dados do guest
  │   └─ Identificador único globalmente
  └─ Row level security: WHERE tenant_id = auth.jwt_claims ->> 'tenant_id'

-- RLS Policy (automático)
CREATE POLICY leads_isolation ON leads
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant'));
```

### Dados Separáveis

- **Leads** — isolados por tenant_id
- **Conversations** — isolados por tenant_id
- **Reservations** — isolados por tenant_id
- **Invoices** — isolados por tenant_id
- **Payments** — isolados por tenant_id
- **Pricing Rules** — isolados por tenant_id
- **Users** — isolados por tenant_id
- **Audit Log** — isolados por tenant_id

### Admin Segregation

```
Usuário admin@empresa1.com
  └─ Só pode criar usuários para empresa1
  └─ Só pode ver dados de empresa1
  └─ Não consegue acessar dados de empresa2 mesmo via API

Usuário admin@empresa2.com
  └─ Totalmente isolado de empresa1
  └─ Não consegue inventar um JWT para empresa1
```

### Custo-Benefício

| Aspecto | Shared DB (MT) | Separate DBs |
|---------|---|---|
| **Custo** | R$50/mês | R$50 × 10 = R$500/mês |
| **Complexidade** | RLS policies | Replicação, failover |
| **Performance** | ~10-20ms latency | ~5-10ms latency |
| **Escalabilidade** | 100+ tenants fácil | Cara em escala |
| **Compliance** | RLS auditable | Data isolation nativa |

**Decisão:** Shared database com RLS — reduz custo, manutenção simples, escalável.

---

## REQUIREMENTS (MoSCoW)

### MUST HAVE (MVP Phase 1)

#### 0. Autenticação & Multi-tenant
- [ ] Login com email + senha (Supabase Auth)
- [ ] Signup com validação de email
- [ ] Password reset via email
- [ ] Session management (logout, session timeout)
- [ ] Multi-tenant routing via subdomínio
- [ ] Subdomínio detection + redirect automático
- [ ] RLS policies para isolação de dados
- [ ] JWT incluindo tenant_id claim
- [ ] User roles: admin, receptionist, analyst
- [ ] Permissões baseadas em role
- [ ] Invite users via email
- [ ] Audit log de ações (who, what, when)

**Acceptance Criteria:**
- Login funciona para múltiplos tenants isolados
- User de empresa1 não consegue acessar dados de empresa2
- RLS policies bloqueiam tentativas de bypass
- Session timeout em 30 min de inatividade
- Subdomínio funciona com HTTPS
- JWT válido por 24h

---

#### 1. Dashboard Executivo
- [ ] Widget: Receita total (mês/ano)
- [ ] Widget: Taxa de ocupação (%)
- [ ] Widget: Taxa de conversão lead→reserva (%)
- [ ] Widget: Leads ativos (hoje)
- [ ] Gráfico: Receita trend (últimos 30 dias)
- [ ] Gráfico: Ocupação trend (calendário anual)
- [ ] Filtros: Data range, tipo quarto, origem lead
- [ ] Export: PDF com relatório executivo

**Acceptance Criteria:**
- Dashboard carrega em <2s
- Dados atualizados a cada 5 minutos
- Funciona em desktop + mobile
- Sem erros de cálculo

---

#### 2. Gestão de Leads
- [ ] Lista de leads (tabela paginada)
- [ ] Colunas: Nome, Telefone, Data contato, Status, Receita estimada, Origem
- [ ] Filtros: Status, data, origem, valor
- [ ] Busca por nome/telefone
- [ ] CRUD completo (criar, editar, arquivar)
- [ ] Histórico de mudanças (quem fez quê e quando)
- [ ] Tags/labels customizáveis

**Acceptance Criteria:**
- Suporta 1000+ leads sem lag
- Bulk actions (marcar como qualificado, enviar email em massa)
- Integração com histórico WhatsApp (read-only)
- Relatório: leads por origem, por status, por período

---

#### 3. Calendário de Reservas
- [ ] Calendário visual (mês/semana/dia)
- [ ] Drag-drop para mover reservas
- [ ] Cores por tipo de quarto (ALA_A, ALA_B, etc)
- [ ] Mostra ocupação por tipo
- [ ] Clique para ver detalhes da reserva
- [ ] Botão "Nova reserva" com wizard
- [ ] Sincroniza com backend em tempo real
- [ ] Bloqueios para manutenção

**Acceptance Criteria:**
- Performance: <1s para carregar 90 dias
- Edições aparecem em todos os clientes em <3s
- Não permite double-booking
- Exporta para iCal/Google Calendar

---

#### 4. Perfis de Clientes
- [ ] Dados básicos (nome, telefone, email, cidade, país)
- [ ] Histórico de reservas (tabela)
- [ ] Histórico de conversas (transcript)
- [ ] Preferências (tipo quarto favorito, alergias, etc)
- [ ] Notas internas (equipe)
- [ ] Documentos (CPF, identidade, autorização)
- [ ] Timeline (atividades)
- [ ] Segmentação (repeat, VIP, churn risk)

**Acceptance Criteria:**
- Histórico carrega em <2s
- Conversas searchable
- Exporta perfil como PDF
- Não expõe dados sensíveis (senha, cartão)

---

#### 5. Histórico de Conversas
- [ ] Chat viewer (WhatsApp style)
- [ ] Mostra mensagens recebidas e enviadas
- [ ] Identifica quem respondeu (Luna ou humano)
- [ ] Timestamps precisos
- [ ] Busca por palavra-chave
- [ ] Exporta conversa como PDF
- [ ] Integração: mostra sinais [ESCALAR], [COTAR], [CONFIRMAR]

**Acceptance Criteria:**
- Sincronizado com Google Sheets e Airtable
- Suporta 500+ mensagens por conversa
- Não duplica mensagens
- Mostra status (enviada, entregue, lida)

---

#### 6. Analytics & Reporting
- [ ] Dashboard: Funnel de conversão (lead → cotação → reserva → check-in)
- [ ] Gráfico: Receita por origem (WhatsApp, Booking.com, direto)
- [ ] Gráfico: Receita por tipo de quarto
- [ ] Gráfico: Sazonalidade (ocupação média por mês)
- [ ] Tabela: Top clientes (by receita)
- [ ] Tabela: Taxa de cancelamento por período
- [ ] Relatório exportável: PDF mensal
- [ ] Comparação YoY (mês atual vs ano anterior)

**Acceptance Criteria:**
- Cálculos auditáveis (mostrar fórmula)
- Dados agregados corretamente (sem duplicação)
- Relatório completo em <10s
- Suporta custom date ranges

---

#### 7. Config & Settings
- [ ] Tipos de quarto (ALA_A, ALA_B, ALA_C_CASAL, ALA_C_GRUPO)
- [ ] Preços por temporada (baixa, média, alta)
- [ ] Mínimo de noites por período
- [ ] Tabela de Preços (visual editor)
- [ ] Notificações (email, WhatsApp para equipe)
- [ ] Usuários (criar, editar, permissions)
- [ ] Integrações (Airtable, Google Sheets, Vercel)
- [ ] Backup automático

**Acceptance Criteria:**
- Mudanças de preço refletem imediatamente nas cotações
- Histórico de mudanças (audit log)
- Sem downtime ao atualizar config
- Rollback rápido se necessário

---

### SHOULD HAVE (Phase 1 + 1 semana)

- [ ] Relatórios automáticos por email (segunda-feira: resumo semanal)
- [ ] Notificações em tempo real (novo lead, novo booking)
- [ ] Integração com Google Calendar (sincronizar reservas)
- [ ] Mobile app básico (React Native ou PWA)
- [ ] Dark mode + temas customizáveis
- [ ] Suporte a múltiplos idiomas (português, inglês, espanhol)
- [ ] Onboarding wizard para novos tenants
- [ ] Custom domain support (meutenant.com em vez de empresa.pousada-luz.com)

---

### COULD HAVE (Phase 2)

#### Pagamentos (Phase 2 — MUST HAVE)
- [ ] Integração Mercado Pago (PIX + Cartão + Boleto)
- [ ] Checkout no CRM
- [ ] Invoice geração automática
- [ ] Webhook de status de pagamento
- [ ] Refund management
- [ ] Payment history + reconciliação

#### RMS & Analytics (Phase 2)
- [ ] Previsões de ocupação (ML básico)
- [ ] Recomendações de pricing dinâmico
- [ ] Chat IA para responder FAQs (Claude integrado)
- [ ] Integração com Booking.com / Airbnb
- [ ] Automação de follow-up (email, SMS)
- [ ] Programa de fidelidade (pontos)
- [ ] Video tour (360 dos quartos)

#### Phase 3 (Future)
- [ ] Integração com sistemas de limpeza/manutenção
- [ ] Channel manager (Booking, Airbnb, Trivago)
- [ ] Marketplace / sistema de afiliados
- [ ] AI-powered pricing automation (auto-update preços)
- [ ] Concorrente monitoring (web scraping)

---

### WON'T HAVE (Fora de escopo — Phase 1)

- ❌ ~~Sistema de pagamento integrado~~ (Agora em Phase 2 como MUST HAVE)
- ❌ Suporte a múltiplas propriedades (single-property MVP, multi-tenant é suficiente)
- ❌ Integração real-time com sistemas de limpeza (Phase 3)
- ❌ Marketplace / sistema de afiliados (Phase 3)

---

## RMS ROADMAP (Future-Ready Architecture)

### Por que RMS? (Revenue Management System)

Um RMS típico otimiza receita ajustando preços baseado em:
- **Demand:** quando a demanda sobe, levanta preços
- **Ocupação:** quanto mais cheio, mais caro
- **Sazonalidade:** períodos altos custam 2-3x mais
- **Concorrência:** monitora preços de concorrentes

### Impacto Estimado de RMS

```
Sem RMS (manual):
  - Ocupação: 60% (muitas datas baratas)
  - Preço médio: R$350/noite
  - Receita: R$60.000/mês

Com RMS (inteligente):
  - Ocupação: 75% (demanda sobe com recomendações)
  - Preço médio: R$450/noite (pricing otimizado)
  - Receita: R$100.000/mês

Incremento: +R$40.000/mês = +67%
```

### Phase 2 Data Requirements

Para construir um RMS, precisamos coletar:

#### 1. Histórico de Conversão
```yaml
Dados necessários:
  - Lead ID → Data → Status final (reserva Y/N)
  - Origem do lead (WhatsApp, Booking.com, direto)
  - Tipo de quarto solicitado
  - Data entrada/saída (período da reserva)
  - Preço cotado vs preço aceito
  - Lead scoring (probabilidade de converter)

Schema (tabela):
  leads_history:
    - id, created_at, origin, guest_name, phone
    - room_type, check_in, check_out, nights
    - quoted_price, final_price, discount_applied
    - converted (Y/N), conversion_date
    - lost_reason (se não converteu)
```

#### 2. Sazonalidade & Padrões
```yaml
Dados necessários:
  - Ocupação histórica por mês/semana/dia
  - Receita histórica por período
  - Taxa de conversão por período
  - Origem de leads por período
  - Eventos (Carnaval, Páscoa, EBAA — vê spike)

Schema (tabela):
  occupancy_history:
    - date, room_type, occupancy_rate, price, revenue
    - season (low/medium/high/holiday)
    - day_of_week
```

#### 3. Concorrência & Benchmark
```yaml
Dados necessários (futura integração):
  - Preços de concorrentes (scrape web)
  - Reviews & ratings (guest satisfaction)
  - Ocupação de concorrentes (se disponível)
  - Features oferecidas (piscina, WiFi, etc)

Schema (tabela):
  competitor_data:
    - date, competitor_id, room_type
    - price, occupancy, rating
```

### Phase 2 Technical Architecture

```
┌─────────────────────────────────────────┐
│         CRM Frontend (Next.js)           │
│     ┌─────── RMS Dashboard ────────┐    │
│     │ • Demand Forecast            │    │
│     │ • Pricing Recommendations    │    │
│     │ • Revenue Opportunity Map    │    │
│     └──────────────────────────────┘    │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Backend (Node.js)  │
        │  ┌─ RMS Engine ─┐   │
        │  │ • Forecasting│   │
        │  │ • Optimizer  │   │
        │  │ • Simulator  │   │
        │  └──────────────┘   │
        └──────────────┬───────┘
                       │
        ┌──────────────▼──────────────┐
        │  Supabase PostgreSQL        │
        │  ├─ leads_history           │
        │  ├─ occupancy_history       │
        │  ├─ competitor_data         │
        │  ├─ reservations            │
        │  └─ conversations           │
        └─────────────────────────────┘
```

### Phase 2 Roadmap (13 semanas)

| Semana | Fase | Deliverable |
|--------|------|-------------|
| 1-2 | Data Prep | Histórico de conversão importado + validado |
| 3-4 | Analytics | Sazonalidade detectada + trends |
| 5-6 | ML Prep | Dataset preparado, features engineered |
| 7-8 | Demand Forecast | Modelo simples (exponential smoothing) em produção |
| 9-10 | Pricing Optimizer | Recomendações baseadas em demand + ocupação |
| 11-12 | RMS Dashboard | Visualizações + recomendações ao gerente |
| 13 | UAT & Hardening | Testes, validação, preparação para automação |

---

## SUCCESS METRICS

### Phase 1 (CRM Operacional)

**Métrica de Produto:**
| Métrica | Target | Como medir |
|---------|--------|-----------|
| **Dashboard load time** | <2s | Lighthouse / Real User Monitoring |
| **Lead CRUD latency** | <500ms | Backend monitoring |
| **Uptime** | 99.5% | Uptime monitor (Pingdom) |
| **Mobile responsiveness** | 100% pages | Manual test + Lighthouse |

**Métrica de Negócio:**
| Métrica | Baseline | Target | Timeline |
|---------|----------|--------|----------|
| **Tempo resposta cotação** | 2h | <5 min | Week 2 |
| **Taxa conversão lead→reserva** | 15% | 20% | Week 3 |
| **Leads respondidos via bot** | 0% | 80% | Week 2 |
| **Taxa ocupação** | 60% | 65% | Week 4 |
| **Receita/mês** | R$30k | R$45k | Week 4 |
| **NPS (Net Promoter Score)** | — | >60 | Week 4 |
| **Churn de cliente** | — | <5%/mês | Week 4 |

---

### Phase 2 (RMS Foundation)

**Métrica de Produto:**
| Métrica | Target | Como medir |
|---------|--------|-----------|
| **Forecast accuracy (MAE)** | <10% | Comparação histórico |
| **API uptime** | 99.9% | Monitoring |
| **Data freshness** | <1h | Pipeline observability |
| **Webhook reliability** | 99.99% | Event logs |

**Métrica de Negócio:**
| Métrica | Phase 1 | Phase 2 Target | Impacto |
|---------|---------|---|---------|
| **Taxa ocupação** | 65% | 75% | +R$10k/mês |
| **ADR (Avg Daily Rate)** | R$350 | R$450 | +R$20k/mês |
| **RevPAR** | R$210 | R$337 | +R$30k/mês |
| **Receita/mês** | R$45k | R$75k | +R$30k/mês |
| **Margem** | 30% | 35% | +R$2.5k/mês |

---

## TECHNICAL REQUIREMENTS

### Tech Stack (Consolidado)

```yaml
Frontend:
  Framework: Next.js 14 (React 18)
  Language: TypeScript (strict)
  Styling: TailwindCSS + CSS Modules
  UI Components: shadcn/ui (customizável)
  State: TanStack Query + React Hook Form
  Charts: Recharts (gráficos)
  Calendar: React Big Calendar
  Forms: Zod (validação) + React Hook Form
  Testing: Vitest + Playwright + React Testing Library

Backend:
  Framework: Express.js (Node.js ≥18)
  Language: TypeScript
  Database: Supabase PostgreSQL
  Auth: Supabase Auth (JWT)
  API: REST (OpenAPI 3.0)
  ORM: PostgRES (queries nativas) ou Prisma
  Monitoring: Sentry + structured logging
  Testing: Jest + Supertest

Deployment:
  Frontend: Vercel (automatic from main branch)
  Backend: Vercel Functions ou Railway
  Database: Supabase (SLA 99.9%)
  Cache: Redis (future, para performance)
  CDN: Vercel Edge Network
  Secrets: Vercel Environment Variables

DevOps:
  CI/CD: GitHub Actions
  Version Control: Git + GitHub
  Monitoring: Sentry + Vercel Analytics
  Error Tracking: Sentry (CRITICAL alerts)
  Logs: Vercel Logs + structured JSON logging
  Backup: Supabase automated backups
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND TIER (Vercel)                │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Next.js 14 App Router                            │   │
│  │ ├─ Pages: /login, /dashboard, /leads, ...        │   │
│  │ ├─ Components: 50+ reusable UI components        │   │
│  │ ├─ Hooks: useLeads(), useReservations(), ...     │   │
│  │ ├─ Services: LeadsService, ReservationsService   │   │
│  │ ├─ Context: AuthContext (Supabase)               │   │
│  │ └─ State: TanStack Query (5 min staleTime)       │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP/REST (Axios)
    ┌──────────▼──────────────────┐
    │  BACKEND TIER (Vercel Fn)   │
    │  ┌────────────────────────┐ │
    │  │ Express.js Routers     │ │
    │  │ ├─ /api/leads          │ │
    │  │ ├─ /api/reservations   │ │
    │  │ ├─ /api/conversations  │ │
    │  │ ├─ /api/analytics      │ │
    │  │ └─ /api/config         │ │
    │  └────────────────────────┘ │
    │  ┌────────────────────────┐ │
    │  │ Middleware             │ │
    │  │ ├─ Auth (JWT Verify)   │ │
    │  │ ├─ CORS                │ │
    │  │ └─ Error Handling      │ │
    │  └────────────────────────┘ │
    │  ┌────────────────────────┐ │
    │  │ Services (Business)    │ │
    │  │ ├─ LeadsService        │ │
    │  │ ├─ ReservationsService │ │
    │  │ ├─ AnalyticsService    │ │
    │  │ └─ RmsService (Phase 2)│ │
    │  └────────────────────────┘ │
    └──────────────┬───────────────┘
                   │ SQL
    ┌──────────────▼───────────────┐
    │  DATABASE TIER (Supabase)    │
    │  ┌────────────────────────┐  │
    │  │ PostgreSQL             │  │
    │  │ ├─ leads               │  │
    │  │ ├─ reservations        │  │
    │  │ ├─ conversations       │  │
    │  │ ├─ occupancy_history   │  │
    │  │ ├─ users               │  │
    │  │ ├─ room_types          │  │
    │  │ └─ pricing_rules       │  │
    │  └────────────────────────┘  │
    │  ├─ Row Level Security (RLS) │
    │  ├─ Backups automated 24h    │
    │  └─ SLA 99.9%                │
    └──────────────────────────────┘
```

### Data Model (PostgreSQL Schema)

```sql
-- Core Tables
Table: users
  - id (UUID, PK)
  - email (unique)
  - role (admin, receptionist, analyst)
  - created_at, updated_at

Table: leads
  - id (UUID, PK)
  - name, phone (WhatsApp E.164)
  - origin (WhatsApp, Booking.com, direto)
  - status (novo, atendimento, cotação_enviada, ...)
  - first_contact_date, last_message_date
  - conversation_summary (LLM-generated)
  - created_at, updated_at
  - Index: (status, created_at) for queries

Table: reservations
  - id (UUID, PK)
  - lead_id (FK leads)
  - room_type (ALA_A, ALA_B, ...)
  - check_in, check_out (date)
  - guests_count
  - quoted_price, final_price
  - discount_percent, discount_reason
  - status (pending, confirmed, cancelled)
  - created_at, updated_at
  - Index: (status, check_in, room_type)

Table: conversations
  - id (UUID, PK)
  - lead_id (FK leads)
  - message_text
  - sender_role (guest, luna, human)
  - timestamp
  - metadata (tokens_used, model_used, control_signals)
  - Index: (lead_id, timestamp)

Table: room_types
  - id (UUID, PK)
  - code (ALA_A, etc)
  - name, capacity, amenities
  - created_at

Table: pricing_rules
  - id (UUID, PK)
  - room_type_id (FK)
  - season (low, medium, high, holiday)
  - price_per_night (currency)
  - min_nights
  - period_start, period_end
  - active (boolean)
  - Index: (room_type_id, period_start, period_end)

Table: occupancy_history (Phase 2)
  - id (UUID, PK)
  - date, room_type_id (FK)
  - occupancy_rate (0-1)
  - price_charged
  - revenue
  - demand_indicator (low/med/high)
  - Index: (date, room_type_id)

-- Audit Tables
Table: audit_log
  - id (UUID, PK)
  - table_name, record_id
  - action (INSERT, UPDATE, DELETE)
  - old_values, new_values (JSONB)
  - user_id (FK users)
  - timestamp
```

---

## RISK & MITIGATION

### Technical Risks

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| **Backend API schema muda** | Média | CRÍTICO | Versionamento API, testes contratuais |
| **Performance com 1000+ leads** | Baixa | ALTO | Pagination, virtual scrolling, índices DB |
| **Integração Airtable/Sheets falha** | Média | ALTO | Fallback local, retry logic, monitoring |
| **WhatsApp API downtime** | Muito Baixa | CRÍTICO | Graceful degradation, queue de mensagens |
| **Supabase outage** | Muito Baixa | CRÍTICO | SLA 99.9%, backup automático, failover |
| **Componentes shadcn/ui quebram em update** | Baixa | MÉDIO | Pinned versions, vendor lock avoidance |
| **Mobile layout quebra** | Média | MÉDIO | Mobile-first design, automated testing |

**Estratégia geral:** Redundância em dados críticos (Airtable + Sheets + PostgreSQL), monitoramento proativo, alertas automáticos.

---

### Business Risks

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| **Adoptation baixa (equipe não usa)** | Média | CRÍTICO | Treinamento hands-on, UI intuitiva, quick wins |
| **Preços dinâmicos alienam clientes** | Baixa | MÉDIO | Teste com 10% de guests primeiro, A/B |
| **Competidores começam a usar RMS** | Alta | MÉDIO | Executar Phase 2 antes deles, be first-mover |
| **Sazonalidade piora (recessão)** | Baixa | ALTO | Diversificar origens de leads (Ads, parceros) |
| **Churn de clientes sobe com pricing alto** | Média | MÉDIO | Implementar loyalty program (Phase 2) |
| **Integrações externas exigem custo** | Média | BAIXO | Avaliar trade-off, usar alternativas open-source |

**Estratégia geral:** Validar hipóteses cedo (Week 1), iteração rápida, feedback constante da equipe.

---

## IMPLEMENTATION TIMELINE

### Phase 1: CRM + Auth + Multi-tenant (4 semanas = 20 dias úteis)

```
SEMANA 1: Setup + Auth + Multi-tenant
├─ Phase 0 (1 dia): Next.js scaffolding, TailwindCSS, shadcn/ui, Supabase client
├─ Phase 1a (2 dias): Supabase Auth (email/senha), AuthContext, JWT com tenant_id
├─ Phase 1b (2 dias): Multi-tenant RLS policies, subdomínio routing, Auth Guard
├─ Phase 1c (1 dia): User management + roles, Navbar + Sidebar per-tenant
└─ Milestone: "Login funciona, multi-tenant isolado, pode fazer logout"

SEMANA 2: Dashboard + Leads + RLS Enforcement
├─ Phase 2 (4 dias): Dashboard com KPIs (receita, ocupação, conversão, leads) — isolado por tenant
├─ Phase 3 (3 dias): CRUD de leads, filtros, busca, histórico — com RLS
├─ Phase 4 (1 dia): Audit logging (quem fez o quê, quando)
└─ Milestone: "Vejo todos os leads (isolados por tenant), em um lugar"

SEMANA 3: Reservas + Clientes
├─ Phase 5 (4 dias): Calendário de reservas (visual + drag-drop), form wizard — per tenant
├─ Phase 6 (3 dias): Perfis de clientes, histórico conversas — per tenant
├─ Phase 7 (1 dia): Export de dados por tenant
└─ Milestone: "Vejo calendário + perfis (isolados), funciona para múltiplos tenants"

SEMANA 4: Analytics + Testing + Deploy
├─ Phase 8 (3 dias): Gráficos (funnel, trends), relatórios exportáveis — per tenant
├─ Phase 9 (2 dias): Settings, notificações, integrations config per tenant
├─ Phase 10 (2 dias): Unit tests (>80% coverage), E2E tests (auth, RLS)
├─ Phase 11 (1 dia): Load testing (multi-tenant), performance tuning
├─ Phase 12 (1 dia): Deploy produção, monitoramento, SLA, onboarding wizard
└─ Milestone: "Sistema em produção, múltiplos tenants usando isoladamente"
```

**Total:** 20 dias úteis = 4 semanas (dev full-time)
**Key Focus:** Segurança de multi-tenant, RLS correctness, audit logging

### Phase 2: Pagamentos + RMS Foundation (4 semanas = 20 dias úteis)

```
SEMANA 5: Mercado Pago Integration
├─ Phase 1 (2 dias): Mercado Pago account setup, API integration, webhook handling
├─ Phase 2 (2 dias): Checkout inline (PIX + Cartão + Boleto), payment status handling
├─ Phase 3 (1 dia): Invoice generation, email notifications
└─ Milestone: "Pagamentos funcionando end-to-end, PCI compliance validado"

SEMANA 6: RMS Data Prep + Analytics
├─ Phase 4 (2 dias): Importar histórico de conversão (leads → reservas) isolado por tenant
├─ Phase 5 (2 dias): Criar tabelas occupancy_history, competitor_data per tenant
├─ Phase 6 (1 dia): Detectar padrões (sazonalidade), calcular taxa de conversão
└─ Milestone: "Dados históricos prontos, padrões identificados"

SEMANA 7: ML Demand Forecast + Payment Analytics
├─ Phase 7 (2 dias): Feature engineering (day_of_week, season, occupancy_lag)
├─ Phase 8 (2 dias): Treinar modelo forecast (exponential smoothing), validar (<10% MAE)
├─ Phase 9 (1 dia): Payment analytics dashboard (receita, conversion por método)
└─ Milestone: "Previsões funcionando, analytics de pagamento visível"

SEMANA 8: Pricing Optimizer + RMS Dashboard + Scale Testing
├─ Phase 10 (2 dias): Implementar optimizer (demand × ocupação → preço recomendado)
├─ Phase 11 (2 dias): RMS Dashboard (forecast, recommendations, opportunity map per tenant)
├─ Phase 12 (1 dia): A/B testing setup (teste com 10% de guests com preços dinâmicos)
└─ Milestone: "Sistema completo, pronto para múltiplos tenants, SaaS model validado"
```

**Total:** 20 dias úteis = 4 semanas (dev full-time)
**Key Focus:** Payment security, RMS accuracy, multi-tenant analytics

### Timeline Consolidado
- **Phase 1:** 4 semanas (auth + multi-tenant + CRM core)
- **Phase 2:** 4 semanas (payments + RMS)
- **Total:** 8 semanas = 2 meses até full feature parity

---

## APPENDIX

### A. Referências de Documentação

| Documento | Propósito | Arquivo |
|-----------|-----------|---------|
| **System Architecture** | Alto nível (backend pronto) | `/docs/architecture/system-architecture.md` |
| **Component Hierarchy** | Estrutura de componentes React | `/docs/architecture/crm-component-hierarchy.md` |
| **Tech Stack Validation** | Justificação e trade-offs | `/docs/architecture/tech-stack-validation.md` |
| **Implementation Roadmap** | Fases detalhadas | `/docs/architecture/implementation-roadmap.md` |
| **CRM Frontend Architecture** | Design frontend específico | `/docs/architecture/crm-frontend-architecture.md` |
| **Executive Summary** | 1-pager para stakeholders | `/docs/architecture/EXECUTIVE-SUMMARY.md` |
| **Airtable Schema** | Schema do CRM (integração) | `/docs/architecture/airtable-schema.md` |
| **Claude System Prompt** | Luna chatbot rules | `/docs/architecture/claude-system-prompt.md` |

---

### B. API Contracts (Preview)

#### Leads Endpoint

```
GET /api/leads?status=novo&limit=20&offset=0
Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "João Silva",
      "phone": "5519999999999",
      "origin": "whatsapp",
      "status": "novo",
      "first_contact_date": "2026-03-07T10:30:00Z",
      "last_message_date": "2026-03-07T14:00:00Z",
      "estimated_revenue": 1050.00,
      "created_at": "2026-03-07T10:30:00Z"
    }
  ],
  "meta": { "total": 142, "limit": 20, "offset": 0 }
}

POST /api/leads
Body:
{
  "name": "João Silva",
  "phone": "5519999999999",
  "origin": "whatsapp"
}

Response: { "id": "uuid", "status": "novo", ... }

PUT /api/leads/{id}
Body:
{
  "status": "cotacao_enviada",
  "notes": "Cliente interessado em ALA_A, 2 noites"
}
```

#### Reservations Endpoint

```
GET /api/reservations?status=confirmed&check_in=2026-03-15&check_out=2026-03-22
Response:
{
  "data": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "room_type": "ALA_A",
      "check_in": "2026-03-15",
      "check_out": "2026-03-22",
      "guests_count": 2,
      "quoted_price": 1050.00,
      "final_price": 1050.00,
      "discount_percent": 0,
      "status": "confirmed",
      "created_at": "2026-03-07T10:30:00Z"
    }
  ],
  "meta": { ... }
}
```

#### Analytics Endpoint (Phase 1)

```
GET /api/analytics/funnel?start_date=2026-02-01&end_date=2026-03-07
Response:
{
  "leads_total": 142,
  "leads_quoted": 98,
  "leads_reserved": 28,
  "conversion_rate": 0.197,
  "revenue": 45000.00,
  "occupancy_rate": 0.65
}

GET /api/analytics/trends?metric=revenue&days=30
Response:
{
  "data": [
    { "date": "2026-02-06", "revenue": 1200.00, "occupancy": 0.60 },
    { "date": "2026-02-07", "revenue": 1500.00, "occupancy": 0.75 },
    ...
  ]
}
```

---

### C. Data Model Preview (Entity Relationship)

```
users
  │
  └─────────────────┬─────────────────
                    │
            ┌───────┴────────┐
            │                │
        leads ◄─────────┐     │
            │           │    │
            │      reservations
            │           │
            │    ┌──────┴──────┐
            │    │             │
            │  room_types  conversations
            │
        occupancy_history (Phase 2)
            │
        pricing_rules
            │
        audit_log
```

---

### D. Checklist de Começar (Phase 0)

#### Day 1
- [ ] Criar repositório Git (ou usar existente)
- [ ] Setup Node.js 18+, npm/yarn/pnpm
- [ ] Executar: `npx create-next-app crm-web --typescript --tailwind`
- [ ] Instalar dependências: `@tanstack/react-query`, `axios`, `zod`, `react-hook-form`, `recharts`, `react-big-calendar`
- [ ] Executar: `npx shadcn-ui@latest init`
- [ ] Configurar Supabase client (credenciais)
- [ ] Verificar: `npm run dev` funciona

#### Day 2
- [ ] Configurar ESLint + Prettier
- [ ] Configurar Vitest + React Testing Library
- [ ] Criar pastas: `/app`, `/components`, `/hooks`, `/services`, `/types`, `/context`, `/lib`
- [ ] Primeira commit: "feat: Initial Next.js setup with TailwindCSS + shadcn/ui"
- [ ] Deploy skeleton no Vercel (conectar repo)

#### Day 3+
- [ ] Implementar AuthContext (Supabase)
- [ ] Implementar primeiro hook (`useLeads()`)
- [ ] Implementar primeira página (`/login`)
- [ ] TDD approach: escrever testes primeiro

---

### E. Environment Variables

```bash
# .env.local (Development)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
NEXT_PUBLIC_API_URL=http://localhost:3001

# .env.production (Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx
NEXT_PUBLIC_API_URL=https://giacianivg.vercel.app
SENTRY_AUTH_TOKEN=xxxxx  # Para error tracking
```

---

### F. Stack Justification

| Tecnologia | Por que? | Alternativa | Trade-off |
|-----------|---------|-----------|-----------|
| **Next.js 14** | Full-stack, API routes, Deploy Vercel sem fricção | SvelteKit, Remix | Menos flexível, mas mais produtivo |
| **React 18** | Ecosystem gigante, comunidade, TSX | Vue, Svelte | Mais verbose, mas mais jobs |
| **TailwindCSS** | Utility-first, build pequeno, rápido | Bootstrap, Material-UI | Aprende curve, mas produtividade alta |
| **shadcn/ui** | Customizável (headless), não lock-in | MUI, Chakra | Componentes simples, mas no controle |
| **TanStack Query** | Caching automático, menos bugs | Redux, Zustand | Dependency extra, mas vale a pena |
| **PostgreSQL** | Relacional, escalável, RLS nativa | MongoDB, DynamoDB | Mais estruturado, menos flexível |
| **Supabase** | Auth + DB + Realtime em 1 lugar | AWS, Firebase | Lock-in, mas SLA 99.9% |
| **TypeScript** | Type safety, IDE help, menos bugs | JavaScript | Mais verbose, mas production-ready |
| **Vercel** | Deploy 1 comando, Edge network, integrações | AWS, Heroku | Mais caro, mas DevOps mínimo |

---

### G. Critérios de Aceitação Geral

#### Phase 1 Complete When:
- ✅ Todas 8 páginas funcionam (login, dashboard, leads, clientes, reservas, conversas, analytics, config)
- ✅ CRUD completo (criar, editar, deletar para leads/reservas)
- ✅ Calendário sincroniza em tempo real
- ✅ Gráficos mostram dados corretos
- ✅ Mobile responsive (testado em Safari iOS + Chrome Android)
- ✅ Sem console errors
- ✅ Testes: >80% coverage, todos passando
- ✅ Lighthouse score: >90
- ✅ Performance: dashboard <2s, outras páginas <3s
- ✅ Documentação: README atualizado, API docs

#### Phase 2 Complete When:
- ✅ Histórico de conversão importado + validado
- ✅ Sazonalidade detectada (gráficos)
- ✅ Forecast funcionando (MAE <10%)
- ✅ Optimizer sugerindo preços
- ✅ Dashboard RMS com recomendações
- ✅ A/B test setup pronto (10% guests com preços dinâmicos)
- ✅ Testes: todos passando
- ✅ SLA 99.9%+ (monitored)

---

## APPROVAL & NEXT STEPS

### Recomendação

**✅ RECOMENDADO: Proceder com Implementação**

**Fundamentos:**
1. ✅ Backend pronto (API Node.js + Supabase operacional)
2. ✅ Stack testado (Next.js, React, TailwindCSS — all production-proven)
3. ✅ Timeline realista (3-4 semanas para MVP)
4. ✅ ROI alto (R$15k incremento mês 1, R$30k mês 2)
5. ✅ Risco baixo (arquitetura clara, equipe sênior)

---

### Próximos Passos (Após Aprovação)

1. **Kickoff (Dia 1)**
   - Apresentar arquitetura + timeline ao time
   - Validar com stakeholders
   - Setup repositório Git

2. **Phase 0 (Dias 1-2)**
   - Next.js scaffolding
   - Deploy skeleton no Vercel
   - Primeiro commit

3. **Phase 1 (Semanas 1-3)**
   - Implementar página por página
   - Code reviews 24h (arquiteto)
   - Daily standups (15 min)
   - Weekly sync com stakeholders (30 min)

4. **Phase 1 Complete (Semana 4)**
   - UAT com equipe (1 semana antes de prod)
   - Documentação final
   - Production deploy

5. **Phase 2 Planning (Semana 4)**
   - Kickoff RMS foundation
   - Data prep (importar histórico)
   - Começar ML research

---

### Sign-off

| Papel | Nome | Assinatura | Data |
|-------|------|-----------|------|
| **Product Manager** | Morgan (@pm) | __________ | __ / __ / 26 |
| **Arquiteto** | Aria (@architect) | __________ | __ / __ / 26 |
| **Stakeholder** | [Proprietário/Gerente] | __________ | __ / __ / 26 |
| **DevOps** | Gage (@devops) | __________ | __ / __ / 26 |

---

## CONCLUSÃO

**O CRM Web é a base operacional para crescimento 3x em 6 meses.**

Com Phase 1 (CRM operacional), a equipe terá:
- Visibilidade centralizada de leads/reservas
- Automação WhatsApp + Claude
- Dashboards com KPIs
- Documentação estruturada

Com Phase 2 (RMS Foundation), a pousada poderá:
- Prever demand com 90% de acurácia
- Otimizar preços dinamicamente
- Aumentar receita de R$45k → R$75k/mês
- Competir com grandes players (Booking.com, Airbnb)

**Timeline:** Pronto em 5 semanas. ROI em 8 semanas.

---

**Documento criado por:** Morgan (@pm)
**Data:** 2026-03-07
**Versão:** 1.0
**Status:** 🟢 READY FOR KICKOFF

---

## DOCUMENTOS RELACIONADOS

- [Executive Summary](./EXECUTIVE-SUMMARY.md)
- [System Architecture](./system-architecture.md)
- [CRM Frontend Architecture](./crm-frontend-architecture.md)
- [Component Hierarchy](./crm-component-hierarchy.md)
- [Implementation Roadmap](./implementation-roadmap.md)
- [Tech Stack Validation](./tech-stack-validation.md)
- [Airtable Schema](./airtable-schema.md)
