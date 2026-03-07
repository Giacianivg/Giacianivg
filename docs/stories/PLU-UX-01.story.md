# PLU-UX-01: Wireframe e Especificacao do Dashboard do Gestor

**Status:** Draft
**Epic:** EPIC-PLU-08 — Dashboard de Operacoes
**Points:** 5
**Priority:** Alta
**Executor:** @ux-design-expert + @dev
**Quality Gate:** @ux-design-expert

---

## User Story

**Como** gestor da Pousada Luz da Lua,
**quero** ver em uma tela o status da ocupacao, receita e leads do dia,
**para** tomar decisoes rapidas sem precisar perguntar para a equipe.

---

## Acceptance Criteria

- [ ] AC-01: Dashboard home exibe os 8 KPIs definidos em tempo real (ocupacao, receita, leads, conversao, RevPAR, propostas pendentes, check-ins hoje, saldo a receber)
- [ ] AC-02: Calendario de ocupacao por quarto como tela principal (view semanal default)
- [ ] AC-03: Codigo de cores: verde=livre, azul=confirmado, amarelo=proposta pendente, cinza=bloqueado
- [ ] AC-04: Lista de leads urgentes com badge de atencao (proposta sem resposta > 48h)
- [ ] AC-05: Totalmente responsivo — usavel no celular sem zoom
- [ ] AC-06: Carregamento inicial < 3 segundos em 4G

---

## Wireframe — Home (Mobile First)

```
┌─────────────────────────────────┐
│ 🌙 Pousada Luz da Lua     [⚙]  │
├─────────────────────────────────┤
│  Hoje: Sex, 06/Mar              │
│                                 │
│ ┌────────┐ ┌────────┐           │
│ │ 75%    │ │ R$1.2k │           │
│ │Ocupação│ │Receita │           │
│ │  hoje  │ │  hoje  │           │
│ └────────┘ └────────┘           │
│                                 │
│ ┌────────┐ ┌────────┐           │
│ │  8     │ │  3     │           │
│ │ Leads  │ │ Propos │           │
│ │ novos  │ │ pend.  │           │
│ └────────┘ └────────┘           │
├─────────────────────────────────┤
│ CALENDARIO (semanal)            │
│           Sex  Sab  Dom  Seg    │
│ ALA_A    [JOAO─────] [     ]   │
│ ALA_B    [    ][SILV────────]  │
│ ALA_C_C  [MARI─────] [     ]   │
├─────────────────────────────────┤
│ ATENCAO AGORA ⚠                 │
│ • Carlos — proposta h 2 dias    │
│   [Ver] [Follow-up]             │
│ • Maria — saldo R$420 vence 7d  │
│   [Ver] [Cobrar]                │
└─────────────────────────────────┘
```

---

## Wireframe — Calendario (Desktop)

```
┌──────────────────────────────────────────────────────────────┐
│  CALENDARIO DE OCUPACAO         [< Mar 2026 >]   [Sem][Mes]  │
├──────────────────────────────────────────────────────────────┤
│         | Sex 6 | Sab 7 | Dom 8 | Seg 9 | Ter 10 | Qua 11  │
├─────────┼───────┼───────┼───────┼────────┼────────┼──────── │
│ ALA_A   │ JOAO  │ JOAO  │       │        │ MARIA  │ MARIA   │
│         │ ■■■■■ │ ■■■■■ │       │        │ ■■■■■  │ ■■■■■   │
├─────────┼───────┼───────┼───────┼────────┼────────┼──────── │
│ ALA_B   │       │ SILVA │ SILVA │ SILVA  │        │         │
│         │       │ ■■■■■ │ ■■■■■ │ ■■■■■  │        │         │
├─────────┼───────┼───────┼───────┼────────┼────────┼──────── │
│ ALA_C_C │ MARI  │ MARI  │       │ PROP?  │        │         │
│         │ ■■■■■ │ ■■■■■ │       │ ▪▪▪▪▪  │        │         │
└─────────┴───────┴───────┴───────┴────────┴────────┴──────── ┘

Legenda: ■ = confirmado  ▪ = proposta pendente  (vazio) = livre
```

---

## Componentes React Necessarios

| Componente | Tipo | Lib |
|-----------|------|-----|
| `KPICard` | Atom | Shadcn Card |
| `OccupancyCalendar` | Organism | react-big-calendar + Tailwind |
| `UrgentLeadList` | Molecule | Shadcn Table |
| `QuickActionButton` | Atom | Shadcn Button |
| `RevenueChart` | Molecule | Recharts BarChart |

---

## Design Tokens Necessarios

```yaml
colors:
  status-available: '#22c55e'    # verde
  status-confirmed: '#3b82f6'    # azul
  status-pending: '#f59e0b'      # amarelo
  status-blocked: '#6b7280'      # cinza
  urgent-badge: '#ef4444'        # vermelho

spacing:
  card-padding: '16px'
  calendar-cell-height: '64px'
  mobile-bottom-nav: '64px'
```

---

## Notas de Implementacao

- **Mobile first:** Calendario em view semanal no mobile, mensal no desktop
- **Real-time:** Supabase Realtime para atualizar KPIs sem refresh
- **Fallback:** Polling a cada 30s se Realtime nao disponivel no Vercel serverless
- **Auth:** Supabase Auth — apenas o gestor acessa (1 usuario no MVP)

---

## Tasks de Implementacao

- [ ] T1: Setup Next.js 14 app em `/dashboard` no projeto Vercel
- [ ] T2: Componente `KPICard` + query Supabase para 8 metricas
- [ ] T3: Componente `OccupancyCalendar` com dados da tabela `disponibilidade`
- [ ] T4: Lista `UrgentLeadList` com filtro propostas > 48h sem resposta
- [ ] T5: Responsividade mobile + dark mode (opcional)
- [ ] T6: Relatorio diario WhatsApp (cron n8n 18h)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada apos revisao de jornada UX | Uma (@ux-design-expert) |
