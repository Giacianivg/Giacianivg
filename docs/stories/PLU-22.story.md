# PLU-22 — bookings.html: Redesign Completo — Sistema Operacional de Reservas

**Epic:** EPIC-PLU-18 Revenue Intelligence (DEC-018)
**Status:** InReview
**Points:** 13
**Priority:** Alta (P1)
**Created:** 2026-03-12
**Author:** Morgan (@pm)

---

## Description

A página `bookings.html` atual é só leitura — uma tabela com 6 colunas e 4 cards.
Não tem ações, não permite criar reserva, não mostra canal de origem, não faz check-in/out.

Esta story transforma bookings.html em sistema operacional completo:
- Timeline Gantt visual por quarto (adaptado do calendar.html)
- KPIs operacionais do dia (chegadas, saídas, ocupação, receita)
- Filtros: status, ala, canal de origem, período, busca livre
- Ações inline: confirmar, check-in, check-out, cancelar, voucher
- Drawer de detalhe com histórico de pagamentos e notas
- Modal "Nova Reserva" com busca de lead

Requer migration 013 (campos `channel`, `notes`, `checkin_at`, `checkout_at`) e
novas rotas PATCH dentro do router já montado em `/api/reservations`.

---

## Acceptance Criteria

### AC-1: KPI bar operacional
**Given** gestor acessa bookings.html
**When** página carrega
**Then** exibe 4 cards: chegando hoje (count), saindo hoje (count), quartos ocupados (N/22), receita do mês (R$)

### AC-2: Timeline Gantt por quarto
**Given** existem reservas no mês selecionado
**When** aba Timeline está ativa
**Then** cada quarto (A1–A8, B1–B7, C1–C5) ocupa uma linha com barra de reserva colorida por status
**And** clique na barra abre o drawer de detalhe
**And** mês pode ser navegado com setas ← →

### AC-3: Filtros funcionais
**Given** gestor aplica filtros de status, ala, canal ou período
**When** filtro é ativado
**Then** timeline e lista atualizam mostrando apenas reservas que correspondem
**And** busca por nome filtra em tempo real (debounce 300ms)

### AC-4: Ações inline na lista
**Given** reserva aparece na aba Lista
**When** gestor clica em ação inline
**Then** Confirmar: PATCH /:id → { status: 'confirmed' }
**And** Check-in: PATCH /:id/checkin → { status: 'checkedin', checkin_at: now }
**And** Check-out: PATCH /:id/checkout → { status: 'checkedout', checkout_at: now }
**And** Cancelar: PATCH /:id → { status: 'cancelled' } com confirm dialog
**And** Voucher: abre /vouchers.html?reservation_id=X

### AC-5: Drawer de detalhe completo
**Given** gestor clica em reserva (barra ou linha da tabela)
**When** drawer abre pela direita
**Then** exibe: hóspede (nome + WhatsApp), quarto, datas, canal, notas editáveis
**And** exibe histórico de pagamentos (sinal pago + saldo pendente)
**And** exibe botões de ação no rodapé do drawer

### AC-6: Modal "Nova Reserva"
**Given** gestor clica em "Nova Reserva"
**When** modal abre
**Then** formulário tem: WhatsApp (+ busca lead), quarto, entrada, saída, pessoas, total, sinal, canal
**And** submissão chama POST /api/reservations/confirm e fecha modal ao sucesso

### AC-7: Migration 013 executada
**Given** migration 013 é rodada no Supabase
**When** consulta à tabela reservations
**Then** colunas `channel`, `notes`, `checkin_at`, `checkout_at` existem
**And** `channel` tem default 'whatsapp' com CHECK válido

---

## Scope

**IN:**
- `database/migrations/013_reservations_channel.sql`
- `routes/reservations.js` — adicionar PATCH /:id/checkin, PATCH /:id/checkout, PATCH /:id
- `public/bookings.html` — rewrite completo

**OUT:**
- Modificação de `server.js` (rota já montada)
- Criação de nova rota `/api/competitor-prices` (PLU-23)
- Alteração de `webhook.js` ou `system-prompt.js`
- Envio de email na reserva

---

## Technical Notes

### Migration 013
```sql
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'booking', 'airbnb', 'direct', 'phone', 'other')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS checkin_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz;
```

### Novas rotas (reservations.js — sem alterar server.js)
```
PATCH /api/reservations/:id/checkin   → status='checkedin', checkin_at=now()
PATCH /api/reservations/:id/checkout  → status='checkedout', checkout_at=now()
PATCH /:id                            → campos livres: status, channel, notes, room_type, guests, amounts, dates
```

### Status colors
```
pending    → var(--gold) opacity .7        (amarelo)
confirmed  → #22c55e                       (verde)
checkedin  → var(--royal-l)               (azul royal)
checkedout → var(--tx3)                   (cinza)
cancelled  → var(--err)                   (vermelho)
```

### Canal labels
```
whatsapp → 📱 WhatsApp
booking  → 🏨 Booking
airbnb   → 🏠 Airbnb
direct   → 🔗 Direto
phone    → 📞 Telefone
other    → ⋯ Outro
```

### Rooms mapping para Gantt
```
ALA A: A1, A2, A3 (max 3px) | A4, A5, A6, A7, A8 (max 4px)
ALA B: B1 (max 3px) | B2, B3, B4, B5, B6, B7 (max 6px)
ALA C: C1, C2 (grupo, max 8px) | C3, C4, C5 (casal, max 2px)
```
Total: 22 quartos = 22 linhas no Gantt

---

## File List

- [x] `database/migrations/013_reservations_channel.sql`
- [x] `routes/reservations.js` — PATCH /:id/checkin, PATCH /:id/checkout, PATCH /:id
- [x] `public/bookings.html` — rewrite completo

---

## Tests

- [ ] `tests/routes/reservations-patch.test.js` — checkin, checkout, edit, cancel

---

## Change Log

| Data | Autor | Ação |
|------|-------|------|
| 2026-03-12 | Morgan @pm | Story criada — Status: Ready |
| 2026-03-12 | Dex @dev | Implementação completa (migration + rotas + HTML) — Status: InReview |
