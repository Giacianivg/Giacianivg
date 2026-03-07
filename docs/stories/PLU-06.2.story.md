# PLU-06.2: API REST — Endpoints Leads, Reservas, Disponibilidade

**Status:** Draft
**Epic:** EPIC-PLU-06 — Fundação CRM
**Points:** 8
**Priority:** Critica
**Executor:** @dev
**Quality Gate:** @architect
**Depends on:** PLU-06.1

---

## User Story

**Como** sistema Luna (webhook) e dashboard do gestor,
**quero** uma API REST que exponha CRUD para leads, reservas, disponibilidade e propostas,
**para** persistir dados do WhatsApp no Supabase e consultar disponibilidade em tempo real.

---

## Acceptance Criteria

- [ ] AC-01: `POST /api/leads/upsert` — cria ou atualiza lead por `whatsapp_number`; retorna `lead_id`
- [ ] AC-02: `POST /api/conversations` — grava mensagem no histórico; idempotente via `message_id`
- [ ] AC-03: `GET /api/availability?room_type=ALA_A&checkin=07/03/2026&checkout=09/03/2026` — retorna `{ available: true/false }`
- [ ] AC-04: `POST /api/proposals` — cria proposta, retorna `proposal_number` (PROP-YYYY-NNNNN)
- [ ] AC-05: `POST /api/reservations/confirm` — chama RPC `create_reservation_atomic`; retorna `reservation_number` ou erro estruturado
- [ ] AC-06: `GET /api/reservations/:id` — retorna reserva com lead e pagamentos
- [ ] AC-07: `GET /api/reservations?status=pending&checkin_from=YYYY-MM-DD` — lista com filtros para dashboard
- [ ] AC-08: Autenticação: endpoints de webhook usam `SUPABASE_SERVICE_ROLE_KEY`; endpoints de dashboard exigem `Authorization: Bearer <supabase_jwt>`
- [ ] AC-09: Todos os endpoints retornam erros em formato `{ success: false, error: "code", message: "..." }`
- [ ] AC-10: Testes de integração cobrindo AC-01 a AC-07 com Supabase em modo test

---

## Technical Notes

### Location
```
api/
├── leads/
│   └── route.js        # POST /api/leads/upsert
├── conversations/
│   └── route.js        # POST /api/conversations
├── availability/
│   └── route.js        # GET /api/availability
├── proposals/
│   └── route.js        # POST /api/proposals
└── reservations/
    ├── route.js        # GET /api/reservations (list)
    ├── [id]/
    │   └── route.js    # GET /api/reservations/:id
    └── confirm/
        └── route.js    # POST /api/reservations/confirm
```

### Supabase Client Setup
```javascript
// services/supabase/client.js
const { createClient } = require('@supabase/supabase-js');

// For webhook (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// For dashboard (respects RLS)
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

### POST /api/reservations/confirm — critical path
```javascript
// Calls RPC, not direct INSERT
const { data, error } = await supabaseAdmin.rpc('create_reservation_atomic', {
  p_lead_id:        leadId,
  p_whatsapp:       whatsapp,
  p_room_type:      roomType,   // ALA_A | ALA_B | ALA_C_CASAL
  p_checkin:        checkin,    // YYYY-MM-DD
  p_checkout:       checkout,
  p_guests:         guests,
  p_total_amount:   totalAmount,
  p_deposit_amount: depositAmount,
  p_proposal_id:    proposalId  // optional
});
// data.success === false → return 409 Conflict with data.error
```

### Date Format
- API accepts `DD/MM/YYYY` (Luna format) and converts to `YYYY-MM-DD` (PostgreSQL)
- Conversion helper in `services/utils/dates.js`

### Availability Check Logic
```javascript
// GET /api/availability
// Queries availability table, counts available rows for all dates in range
// Returns { available: true } only if ALL dates have status = 'available'
```

---

## Tasks

- [ ] T1: Setup `services/supabase/client.js` (admin + public clients)
- [ ] T2: `POST /api/leads/upsert` — upsert by `whatsapp_number`, return `lead_id`
- [ ] T3: `POST /api/conversations` — insert with `message_id` idempotency check
- [ ] T4: `GET /api/availability` — query availability table for date range + room type
- [ ] T5: `POST /api/proposals` — insert proposal, return `proposal_number`
- [ ] T6: `POST /api/reservations/confirm` — call `create_reservation_atomic` RPC
- [ ] T7: `GET /api/reservations/:id` — fetch with lead join
- [ ] T8: `GET /api/reservations` — list with `status` and `checkin_from` filters
- [ ] T9: Error handler middleware returning `{ success, error, message }` consistently
- [ ] T10: Integration tests for all endpoints (Supabase test project or mocked client)

---

## Quality Gate — @architect

- [ ] QG-01: `service_role` key used only in server-side calls (never exposed to client)
- [ ] QG-02: `/api/reservations/confirm` calls RPC — no direct INSERT into `reservations` from app code
- [ ] QG-03: Date format conversion (DD/MM/YYYY ↔ YYYY-MM-DD) is centralized, not duplicated
- [ ] QG-04: All endpoints handle Supabase errors and return structured JSON (never raw stack traces)
- [ ] QG-05: CodeRabbit pre-commit: no CRITICAL issues before marking Done

---

## File List

- `services/supabase/client.js` — novo
- `api/leads/route.js` — novo
- `api/conversations/route.js` — novo
- `api/availability/route.js` — novo
- `api/proposals/route.js` — novo
- `api/reservations/route.js` — novo
- `api/reservations/[id]/route.js` — novo
- `api/reservations/confirm/route.js` — novo
- `services/utils/dates.js` — novo
- `tests/api.integration.test.js` — novo

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
