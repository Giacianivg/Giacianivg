# PLU-11.1 — Follow-ups: Correção da Página + Sequência D+N

**Epic:** EPIC-PLU-11 Follow-ups de Reativação (DEC-015)
**Status:** Done
**Points:** 5
**Priority:** Alta (P1)
**Created:** 2026-03-11
**Author:** Morgan (@pm)

---

## Description

A página `public/follow-ups.html` exibe dados incorretos — nomes e datas aparecem vazios/inválidos por mapeamento errado de campos. Adicionalmente, o sistema só suporta follow-ups de cotação abandonada. Esta story corrige os bugs e adiciona a sequência completa de reativação D+1, D+7, D+30, D+60, D+90 com tracking de status por hóspede.

**Problema:** Página de follow-ups não exibe dados úteis. Não há visibilidade de status por hóspede. Não há sequência de reativação para hóspedes pós-estadia.

**Causa-raiz dos bugs:**
1. Frontend lê `f.guest_name` / `f.guestName` — API retorna `f.lead_name` (do join com leads)
2. Frontend lê `f.scheduled_at` / `f.scheduledAt` — DB/API usa coluna `scheduled_for`
3. Sem templates D+30/D+60/D+90 e sem rota para criá-los

---

## Acceptance Criteria

### AC-1: Nomes de hóspedes renderizam corretamente
**Given** scheduled_follow_up tem join com leads.name via `lead_name`
**When** página carrega e há follow-ups pendentes
**Then** coluna "Hóspede" exibe o nome real (não "Hóspede desconhecido")

### AC-2: Datas renderizam corretamente
**Given** DB usa coluna `scheduled_for` (não `scheduled_at`)
**When** página carrega e há follow-ups pendentes
**Then** coluna "Agendado para" exibe data/hora formatada (não "Data inválida")

### AC-3: Abas de status por hóspede
**Given** follow-ups podem ter status: pending, sent, responded, converted, cancelled, failed
**When** gestor acessa a página
**Then** página exibe abas: Pendentes | Enviados | Respondidos | Convertidos
**And** cada aba mostra contagem no badge

### AC-4: Templates D+30/D+60/D+90 existem
**Given** hóspede completou estadia há 30 dias (ou 60, ou 90)
**When** cron de follow-up executa
**Then** templates `reactivation_d30`, `reactivation_d60`, `reactivation_d90` são usados

### AC-5: Rota para criar follow-up de reativação
**Given** hóspede com `reservation.checkout_date` no passado
**When** POST /api/follow-ups/reactivation { lead_id, phone }
**Then** sistema agenda 4 follow-ups: D+1, D+7, D+30, D+60 a partir de checkout_date
**And** retorna os IDs dos follow-ups criados

### AC-6: Coluna de tipo usa labels em PT-BR
**Given** follow-up tem `follow_up_type: "reactivation_d30"`
**When** página exibe
**Then** badge exibe "Reativação D+30" (não "reactivation_d30")

---

## Scope

**IN:**
- Correção de mapeamentos na `public/follow-ups.html`
- Adicionar abas de status com contagem
- Adicionar templates D+30/D+60/D+90 em `services/follow-up/templates.js`
- Adicionar rota POST `/api/follow-ups/reactivation` em `routes/follow-ups.js`
- Adicionar labels PT-BR para novos tipos

**OUT:**
- Não alterar `server.js` (não precisa montar nova rota — já usa `/api/follow-ups`)
- Não alterar `follow-up-cron.js` ou `follow-up-executor.js`
- Não criar migrations (tabela `scheduled_follow_ups` já existe)

---

## File List

- [x] `public/follow-ups.html` — fix field mapping + abas de status + labels PT-BR
- [x] `services/follow-up/templates.js` — adicionar templates D+30/D+60/D+90
- [x] `routes/follow-ups.js` — adicionar POST /reactivation

---

## Change Log

| Data | Autor | Ação |
|------|-------|------|
| 2026-03-11 | Morgan @pm | Story criada — Status: InProgress |
