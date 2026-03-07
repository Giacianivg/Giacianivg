# PLU-06.3: Calendário de Ocupação e Gestão de Disponibilidade

**Status:** Draft
**Epic:** EPIC-PLU-06 — Fundação CRM
**Points:** 5
**Priority:** Alta
**Executor:** @dev
**Quality Gate:** @architect
**Depends on:** PLU-06.1, PLU-06.2

---

## User Story

**Como** gestor da pousada,
**quero** visualizar e gerenciar a ocupação dos quartos por data,
**para** bloquear datas manualmente, confirmar disponibilidade e evitar overbooking.

---

## Acceptance Criteria

- [ ] AC-01: `GET /api/availability/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` retorna todos os quartos e status para o período
- [ ] AC-02: `PATCH /api/availability/block` — gestor pode bloquear datas com `motivo` (manutenção, uso pessoal, etc.)
- [ ] AC-03: `PATCH /api/availability/unblock` — desbloqueia datas previamente bloqueadas manualmente
- [ ] AC-04: Ao confirmar reserva (via PLU-06.2 `confirm`), datas são marcadas como `reserved` automaticamente (validar que já funciona via RPC)
- [ ] AC-05: Ao cancelar reserva (`release_reservation` RPC), datas voltam para `available` automaticamente
- [ ] AC-06: Resposta do calendário inclui `guest_name` e `reservation_number` para datas `reserved`
- [ ] AC-07: View `vw_occupancy_calendar` usada como base para o endpoint de calendário

---

## Technical Notes

### Calendar Response Format
```json
{
  "calendar": [
    {
      "date": "2026-04-10",
      "rooms": {
        "ALA_A":   { "status": "reserved", "reservation_number": "RES-2026-00001", "guest_name": "Carlos" },
        "ALA_B":   { "status": "available" },
        "ALA_C_1": { "status": "blocked", "block_reason": "Manutenção" },
        "ALA_C_2": { "status": "available" }
      }
    }
  ]
}
```

### Block/Unblock Endpoint
```javascript
// PATCH /api/availability/block
// Body: { room_type: "ALA_C_1", from: "YYYY-MM-DD", to: "YYYY-MM-DD", reason: "Manutenção" }
// Calls: UPDATE availability SET status='blocked', block_reason=reason WHERE ...
// Constraint: cannot block dates with status='reserved' (reservation in progress)
```

### Unblock Logic
```javascript
// PATCH /api/availability/unblock
// Only allows unblocking status='blocked' rows (not 'reserved' — use release_reservation for those)
```

---

## Tasks

- [ ] T1: `GET /api/availability/calendar` — query `vw_occupancy_calendar`, group by date
- [ ] T2: `PATCH /api/availability/block` — mark dates as blocked with reason
- [ ] T3: `PATCH /api/availability/unblock` — revert blocked dates to available
- [ ] T4: Validate that `create_reservation_atomic` RPC correctly marks dates as `reserved` (integration test)
- [ ] T5: Validate that `release_reservation` RPC correctly restores dates to `available`
- [ ] T6: Tests for block/unblock endpoints including edge cases (already reserved, date in past)

---

## Quality Gate — @architect

- [ ] QG-01: Block endpoint rejects requests for `reserved` dates (must use `release_reservation` for those)
- [ ] QG-02: Calendar endpoint uses `vw_occupancy_calendar` view — no raw JOIN duplication in app code
- [ ] QG-03: All date range queries use `date >= p_start AND date < p_end` (checkout date excluded)

---

## File List

- `api/availability/calendar/route.js` — novo
- `api/availability/block/route.js` — novo
- `api/availability/unblock/route.js` — novo
- `tests/availability.test.js` — novo

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
