# EPIC-PLU-06: Fundacao CRM — Database, API e Motor de Reservas

**Status:** Planning
**Owner:** Morgan (@pm)
**Created:** 2026-03-06
**Prioridade:** Alta — Fundacao que habilita todas as funcionalidades de reserva direta

---

## Objective

Construir a fundacao tecnica do CRM: banco de dados Supabase PostgreSQL com schema completo, API REST para leads/reservas/disponibilidade, calendario de ocupacao e motor de geracao de propostas com cobranca de sinal (30%). Esta epic habilita reservas diretas sem depender de OTAs.

## Business Value

- **Impacto estimado:** +R$15-20k/mes em reservas diretas (reduz comissao OTA 15-25%)
- **Fundacao critica:** Todos os epicos seguintes (PLU-07, PLU-08) dependem desta base
- **Velocidade:** Motor de propostas + cobranca de sinal automatiza o fechamento de reservas
- **Controle:** Disponibilidade em tempo real evita overbooking

---

## Stakeholders

- Dono/Gestor da Pousada Luz da Lua
- @architect (decisoes de banco de dados e API)
- @data-engineer (schema Supabase + migrations)
- @dev (API REST + motor de reservas)

---

## Scope

### In Scope
- Setup Supabase (PostgreSQL) com schema completo (10 tabelas)
- API REST: leads, reservas, disponibilidade, propostas, pagamentos
- Calendario de ocupacao com controle de disponibilidade por quarto
- Motor de geracao de proposta automatica (calculo valor, desconto, sinal)
- Integracao PIX para cobranca do sinal de 30%
- Validacao X-Hub-Signature e idempotencia
- Migracao de dados historicos do Google Sheets (atual) para Supabase

### Out of Scope
- Frontend dashboard (EPIC-PLU-08)
- Integracao com OTAs (Booking.com, Airbnb) - fase 2
- Pagamento online por cartao - fase 2
- App mobile - fase 2

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-06.1 | Setup Supabase: schema completo + migrations | 5 | Critica | Draft | @data-engineer | @architect |
| PLU-06.2 | API REST: endpoints leads, reservas, disponibilidade | 8 | Critica | Draft | @dev | @architect |
| PLU-06.3 | Calendario de ocupacao e gestao de disponibilidade | 5 | Alta | Draft | @dev | @architect |
| PLU-06.4 | Motor de geracao de propostas automaticas | 5 | Alta | Draft | @dev | @qa |
| PLU-06.5 | Integracao PIX — cobranca de sinal 30% | 5 | Alta | Draft | @dev | @qa |
| PLU-06.6 | Migracao de dados historicos (Sheets -> Supabase) | 3 | Media | Draft | @data-engineer | @dev |

**Total Points:** 31

---

## Success Criteria

- [ ] Schema Supabase criado com todas as 10 tabelas e indices
- [ ] API REST respondendo CRUD completo para leads e reservas
- [ ] Disponibilidade atualizada em tempo real ao confirmar reserva
- [ ] Proposta gerada automaticamente com valor, desconto e sinal calculados
- [ ] PIX gerado e sinal confirmado via webhook de pagamento
- [ ] Zero overbooking (constraint de disponibilidade validado)
- [ ] Dados historicos do Google Sheets importados

---

## Technical Requirements

- Supabase Cloud (PostgreSQL 15, RLS habilitado)
- Node.js 18+ / Next.js 14 (API Routes) ou Express em Vercel
- MercadoPago API (PIX — sem taxa abaixo de R$1.500)
- Redis (idempotencia de webhooks de pagamento)
- Vercel (deploy serverless, compativel com stack atual)

---

## Stack Decision

| Componente | Atual | Proposto (este epic) |
|-----------|-------|---------------------|
| Banco de dados | Google Sheets / Airtable (nao criado) | Supabase PostgreSQL |
| API | Nenhuma | Next.js API Routes no Vercel |
| Automacao | Make.com | Permanece para WhatsApp (PLU-01) |
| Pagamento | Manual (PIX via equipe) | MercadoPago PIX automatico |

> Nota: Supabase substitui Airtable (DT-04 pendente) com vantagens: SQL real, RLS, escalavel, free tier generoso.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migracao dados Sheets incompleta | Medio | Exportar CSV + script de import; manter Sheets em paralelo 30 dias |
| MercadoPago rejeitando PIX | Alto | Testar sandbox completo antes de produção; fallback manual |
| Supabase RLS mal configurado | Alto | @data-engineer valida todas as policies antes de PLU-06.2 |
| Overbooking por race condition | Alto | SELECT FOR UPDATE ao bloquear disponibilidade; concurrency control |

---

## Dependencies

**Depends on:**
- Conta Supabase criada (acao humana)
- Conta MercadoPago Developers configurada (acao humana)
- EPIC-PLU-01 (webhook Vercel operacional — reusa infra)

**Blocks:**
- EPIC-PLU-07 (Luna <-> CRM)
- EPIC-PLU-08 (Dashboard)

---

## Database Schema Summary

Tabelas principais (ver `docs/architecture/crm-automacao-arquitetura.md` para schema completo):

| Tabela | Proposito |
|--------|-----------|
| `leads` | Contatos via WhatsApp, estagio do funil, pontuacao |
| `conversas` | Historico de mensagens + dados extraidos pela IA |
| `disponibilidade` | Calendario por data: quartos disponíveis + preco |
| `reservas` | Reservas confirmadas com status de pagamento |
| `propostas` | Propostas geradas com desconto e validade |
| `followups` | Agendamento de follow-ups automaticos |
| `pagamentos` | Registro de transacoes PIX/cartao |
| `logs_ia` | Monitoramento de custo e uso da API Claude |
| `metricas_diarias` | KPIs agregados por dia |
| `settings` | Configuracoes dinamicas do sistema |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Epic criado a partir de crm-automacao-arquitetura.md | Morgan (@pm) |
