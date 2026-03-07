# PLU-06.4: Motor de Propostas Automáticas

**Status:** Draft
**Epic:** EPIC-PLU-06 — Fundação CRM
**Points:** 5
**Priority:** Alta
**Executor:** @dev
**Quality Gate:** @qa
**Depends on:** PLU-06.1, PLU-06.2

---

## User Story

**Como** sistema Luna,
**quero** gerar e persistir propostas formalizadas no CRM quando uma cotação for aceita,
**para** ter rastreabilidade do funil de vendas e base para emissão de link PIX.

---

## Acceptance Criteria

- [ ] AC-01: `POST /api/proposals` recebe `{ lead_id, room_type, checkin, checkout, guests, total_amount, deposit_amount }` e retorna `{ proposal_number, proposal_id }`
- [ ] AC-02: `proposal_number` gerado no formato `PROP-YYYY-NNNNN` via sequência PostgreSQL
- [ ] AC-03: Campo `nights` calculado automaticamente (GENERATED ALWAYS AS) — não aceita valor do caller
- [ ] AC-04: Proposta criada com `status = 'pending'` por padrão
- [ ] AC-05: `GET /api/proposals/:id` retorna proposta com lead associado
- [ ] AC-06: `GET /api/proposals?lead_id=X&status=pending` lista propostas com filtros
- [ ] AC-07: `PATCH /api/proposals/:id/expire` marca proposta como `expired` (validade 48h padrão)
- [ ] AC-08: Wrapper `services/quotation/proposalService.js` encapsula criação de proposta a partir de output do `calculateQuotation()`

---

## Technical Notes

### Proposal Creation Flow
```javascript
// services/quotation/proposalService.js
const { calculateQuotation } = require('./engine');

async function createProposalFromQuotation({ leadId, roomType, checkin, checkout, guests }) {
  const quotation = calculateQuotation({ tipo: roomType, data_entrada: checkin, data_saida: checkout, pessoas: guests });
  if (quotation.escalar) throw new Error('room_requires_human');

  const { data } = await supabaseAdmin
    .from('proposals')
    .insert({
      lead_id:        leadId,
      room_type:      roomType,
      checkin_date:   toISO(checkin),   // DD/MM/YYYY → YYYY-MM-DD
      checkout_date:  toISO(checkout),
      guests:         guests,
      total_amount:   quotation.total,
      deposit_amount: Math.round(quotation.total * 0.30),
      expires_at:     new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .select('proposal_number, id')
    .single();

  return data; // { proposal_number: 'PROP-2026-00001', id: uuid }
}
```

### Expiration Job (future — PLU-08)
- Proposals with `expires_at < now()` and `status = 'pending'` should be auto-expired
- For now: `PATCH /api/proposals/:id/expire` covers manual expiration

---

## Tasks

- [ ] T1: `POST /api/proposals` — insert + return `proposal_number`
- [ ] T2: `GET /api/proposals/:id` — fetch with lead join
- [ ] T3: `GET /api/proposals` — list with `lead_id` and `status` filters
- [ ] T4: `PATCH /api/proposals/:id/expire` — mark as expired
- [ ] T5: `services/quotation/proposalService.js` — wrapper integrando `calculateQuotation()` + Supabase
- [ ] T6: Tests covering AC-01 a AC-08 (happy path + expiration)

---

## Quality Gate — @qa

- [ ] QG-01: `proposal_number` nunca nulo e no formato correto `PROP-YYYY-NNNNN`
- [ ] QG-02: `nights` sempre calculado pelo banco — jamais aceito pelo payload
- [ ] QG-03: `proposalService.js` usa `services/utils/dates.js` para conversão de datas — sem duplicação
- [ ] QG-04: Endpoint de expiração não permite expirar proposta `confirmed` ou já `expired`

---

## File List

- `api/proposals/route.js` — novo (lista + cria)
- `api/proposals/[id]/route.js` — novo (GET por ID)
- `api/proposals/[id]/expire/route.js` — novo (PATCH expire)
- `services/quotation/proposalService.js` — novo
- `tests/proposals.test.js` — novo

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
