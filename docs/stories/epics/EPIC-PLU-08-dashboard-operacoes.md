# EPIC-PLU-08: Dashboard de Operacoes e Metricas

**Status:** Planning
**Owner:** Morgan (@pm)
**Created:** 2026-03-06
**Prioridade:** Media — Visibilidade para decisoes do gestor

---

## Objective

Construir dashboard operacional para o gestor da pousada: KPIs em tempo real (ocupacao, receita, conversao), calendario visual de reservas, funil de leads e relatorios automaticos diarios. Substitui planilhas manuais e da visibilidade para otimizar precificacao e operacao.

## Business Value

- **Decisoes mais rapidas:** Gestor ve ocupacao em tempo real vs. consultar equipe
- **Pricing dinamico:** Visibilidade de baixa ocupacao permite ativar promocoes proativamente
- **Acompanhamento de metas:** Progresso rumo a R$60k/mes visivel diariamente
- **Reducao de erros:** Calendario visual elimina double-booking manual

---

## Stakeholders

- Dono/Gestor da Pousada Luz da Lua
- @dev (frontend React/Next.js + queries Supabase)
- @ux-design-expert (UX do dashboard)

---

## Scope

### In Scope
- Dashboard home: KPIs em tempo real (ocupacao, receita, leads, conversao)
- Calendario visual de ocupacao por quarto (view semanal/mensal)
- Pipeline de leads: funil com estagio de cada lead
- Relatorio diario automatico via WhatsApp para o gestor
- Filtros por periodo (semana, mes, trimestre)
- View mobile-friendly (gestor acessa pelo celular)

### Out of Scope
- Integracao com Google Analytics / Meta Ads (EPIC-PLU-02)
- Revenue management / pricing dinamico avancado (EPIC-PLU-03)
- Multi-usuario com permissoes granulares - fase 2
- Export para Excel/PDF - fase 2

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-08.1 | Dashboard home: KPIs em tempo real | 5 | Alta | Draft | @dev | @qa |
| PLU-08.2 | Calendario visual de ocupacao por quarto | 8 | Alta | Draft | @dev | @ux-design-expert |
| PLU-08.3 | Pipeline de leads: funil e estagio | 5 | Media | Draft | @dev | @qa |
| PLU-08.4 | Relatorio diario automatico via WhatsApp | 3 | Media | Draft | @dev | @qa |
| PLU-08.5 | View mobile-friendly (responsivo) | 3 | Media | Draft | @dev | @ux-design-expert |

**Total Points:** 24

---

## Success Criteria

- [ ] Gestor acessa dashboard e ve ocupacao atual em < 3 segundos
- [ ] Calendario mostra todos os quartos e reservas sem inconsistencias
- [ ] KPIs do dia atualizados automaticamente (sem refresh manual)
- [ ] Relatorio diario chegando no WhatsApp do gestor todo dia as 18h
- [ ] Dashboard acessivel e usavel no celular (iOS/Android)
- [ ] Taxa de ocupacao calculada corretamente vs. numero de quartos disponiveis

---

## Technical Requirements

- EPIC-PLU-06 concluida (Supabase com dados)
- EPIC-PLU-07 concluida (dados de leads e conversas populados)
- Next.js 14 (App Router) — consistente com stack da API
- Shadcn/UI + Tailwind CSS (componentes)
- Recharts (graficos de ocupacao e receita)
- Supabase Realtime (atualizacoes em tempo real)
- Vercel (deploy frontend junto com API)

---

## KPIs do Dashboard (Home)

| KPI | Formula | Fonte |
|-----|---------|-------|
| Ocupacao atual | quartos_ocupados / total_quartos x 100 | tabela `disponibilidade` |
| Receita do mes | SUM(valor_total) WHERE mes=atual | tabela `reservas` |
| Leads novos (semana) | COUNT leads criados nos ultimos 7 dias | tabela `leads` |
| Taxa conversao | reservas_confirmadas / leads_novos x 100 | join leads+reservas |
| RevPAR | receita_total / (quartos x dias_no_periodo) | calculado |
| Propostas pendentes | COUNT propostas status=enviada | tabela `propostas` |
| Check-ins hoje | COUNT reservas data_checkin=hoje | tabela `reservas` |
| Saldo a receber | SUM(valor_restante) WHERE status=confirmada | tabela `reservas` |

---

## Calendar View

Calendario de ocupacao por quarto:

```
         [Sem 1 Mar] [Dom 2] [Seg 3] [Ter 4] ...
ALA_A    [------JOAO--------]        [---MARIA---]
ALA_B              [-----GRUPO SILVA-----------]
ALA_C_C  [--PAULO--]        [---RESERVADO-------]
```

- Verde: disponivel
- Azul: reservado (confirmado)
- Amarelo: proposta enviada (pendente confirmacao)
- Cinza: bloqueado (manutencao)

---

## Relatorio Diario WhatsApp (PLU-08.4)

Template enviado as 18h para o gestor:

```
*RELATORIO DO DIA — {data}*

Hospedes hoje: {checkins_hoje} check-ins
Saidas hoje: {checkouts_hoje} check-outs

Ocupacao atual: {ocupacao}% ({quartos_ocupados}/{total} quartos)
Receita do mes: R$ {receita_mes}

Novos leads hoje: {leads_novos}
Propostas enviadas: {propostas_enviadas}
Reservas confirmadas: {reservas_confirmadas}

Proximos check-ins (amanha): {proximos_checkins}
Saldo a receber (7 dias): R$ {saldo_pendente}
```

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dados incorretos no dashboard | Alto | Testes de integridade antes do go-live; validar vs. planilha manual |
| Performance lenta com muitos dados | Medio | Indices no Supabase + caching Redis para queries pesadas |
| UX confusa para gestor nao tecnico | Alto | @ux-design-expert revisa prototipos; teste com usuario real |
| Supabase Realtime em Vercel serverless | Medio | Usar polling a cada 30s como fallback se realtime nao funcionar |

---

## Dependencies

**Depends on:**
- EPIC-PLU-06 (Supabase + dados)
- EPIC-PLU-07 (fluxo Luna -> CRM populando dados)

**Feeds into:**
- EPIC-PLU-03 (Pricing Dinamico — usa dados de ocupacao)
- EPIC-PLU-05 (Analytics — dashboard base para metricas avancadas)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Epic criado a partir de crm-automacao-arquitetura.md | Morgan (@pm) |
