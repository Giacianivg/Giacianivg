# PLU-06.1: Setup Supabase — Schema Completo + Migrations

**Status:** Draft
**Epic:** EPIC-PLU-06 — Fundação CRM
**Points:** 5
**Priority:** Critica
**Executor:** @data-engineer
**Quality Gate:** @architect

---

## User Story

**Como** desenvolvedor responsável pelo CRM,
**quero** ter o schema PostgreSQL completo no Supabase com todas as tabelas, índices, RPCs e RLS,
**para** que as camadas de API e integração possam ser construídas sobre uma base sólida e segura.

---

## Context

Migration já projetada por @data-engineer em `database/migrations/001_schema_initial.sql`.
Esta story cobre a execução e validação da migration no Supabase Cloud.

---

## Acceptance Criteria

- [ ] AC-01: Migration `001_schema_initial.sql` executada sem erros no Supabase SQL Editor
- [ ] AC-02: 10 tabelas criadas: `leads`, `conversations`, `availability`, `reservations`, `proposals`, `payments`, `followups`, `ai_logs`, `daily_metrics`, `settings`
- [ ] AC-03: RPC `create_reservation_atomic()` testada com cenário de sucesso e cenário de concorrência
- [ ] AC-04: RPC `release_reservation()` testada com cancelamento válido e inválido
- [ ] AC-05: `initialize_calendar('2026-01-01', '2027-01-01')` executada → 1460 rows em `availability`
- [ ] AC-06: RLS habilitado em todas as tabelas; `service_role` bypassa, `authenticated` tem acesso completo, `anon` sem acesso
- [ ] AC-07: `reservation_number` e `proposal_number` gerados corretamente no formato `RES-YYYY-NNNNN` / `PROP-YYYY-NNNNN`
- [ ] AC-08: `balance_amount` em `reservations` calculado automaticamente como `total_amount - deposit_amount`
- [ ] AC-09: Variáveis de ambiente Supabase documentadas em `.env.example`

---

## Technical Notes

### Files
- `database/migrations/001_schema_initial.sql` — migration já criada, pronta para executar
- `database/migrations/002_calendar_seed.sql` — a criar: executa `initialize_calendar` para 2026

### Room Type Mapping
```
ALA_A       → 1 quarto físico (até 3 pessoas)
ALA_B       → 1 quarto físico (até 5 pessoas)
ALA_C_1     → quarto 1 da Ala C (até 8 pessoas)
ALA_C_2     → quarto 2 da Ala C (até 8 pessoas)
ALA_C_CASAL → alias para qualquer ALA_C_x livre (resolvido pela RPC)
```

### Testing the Atomic RPC
```sql
-- Cenário 1: sucesso
SELECT create_reservation_atomic(
  p_lead_id        := (SELECT id FROM leads LIMIT 1),
  p_whatsapp       := '5519999999999',
  p_room_type      := 'ALA_A',
  p_checkin        := '2026-04-10',
  p_checkout       := '2026-04-12',
  p_guests         := 2,
  p_total_amount   := 600.00,
  p_deposit_amount := 180.00
);
-- Expected: {"success": true, "reservation_number": "RES-2026-00001", ...}

-- Cenário 2: sem disponibilidade
-- (Marcar as mesmas datas como reservado primeiro, repetir a chamada)
-- Expected: {"success": false, "error": "no_availability", ...}
```

### Environment Variables to Add
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # usado pelo webhook (bypassa RLS)
```

---

## Tasks

- [ ] T1: Executar `001_schema_initial.sql` no Supabase SQL Editor e confirmar 0 erros
- [ ] T2: Criar `database/migrations/002_calendar_seed.sql` com `SELECT initialize_calendar('2026-01-01', '2027-01-01')` e executar
- [ ] T3: Validar 10 tabelas criadas com `\dt` ou via Supabase Table Editor
- [ ] T4: Testar RPC `create_reservation_atomic` (sucesso + sem disponibilidade + concorrência simulada)
- [ ] T5: Testar RPC `release_reservation` (sucesso + status inválido)
- [ ] T6: Verificar RLS: conectar como `anon` e confirmar acesso negado; como `authenticated` e confirmar acesso
- [ ] T7: Adicionar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ao `.env.example`
- [ ] T8: Documentar Supabase project ID e URL em `docs/architecture/supabase-setup.md`

---

## Quality Gate — @architect

Verificar antes de marcar Done:
- [ ] QG-01: RLS policies corretas (service_role bypassa, authenticated acesso, anon bloqueado)
- [ ] QG-02: Índices cobrem os padrões de query da API (por `whatsapp_number`, `status`, `checkin_date`)
- [ ] QG-03: RPC `create_reservation_atomic` usa `FOR UPDATE NOWAIT` — anti-overbooking validado
- [ ] QG-04: FK circular `availability ↔ reservations` resolvida corretamente

---

## File List

- `database/migrations/001_schema_initial.sql` — modificado (executado no Supabase)
- `database/migrations/002_calendar_seed.sql` — novo
- `.env.example` — modificado (variáveis Supabase)
- `docs/architecture/supabase-setup.md` — novo

---

## Dev Agent Record

**Agent Model Used:** —
**Debug Log:** —
**Completion Notes:** —

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada | River (@sm) |
