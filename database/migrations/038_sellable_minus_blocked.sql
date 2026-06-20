-- ============================================================================
-- 038_sellable_minus_blocked.sql — manutenção/bloqueio sai dos "quartos à venda"
-- ============================================================================
-- Pedido do Founder (2026-06-17): quarto em manutenção (lançado na aba Quartos)
-- deve sair da disponibilidade ("quartos à venda") e aparecer marcado nas telas.
--
-- Fonte única (alinha DEC-024): manutenção = bloqueio em availability
-- (status='blocked'), gravado pelo modal de Manutenção do rooms.html com
-- block_reason começando por "Manutenção:". Qualquer bloqueio reduz a venda;
-- a distinção visual manutenção × bloqueio genérico fica no frontend, pelo motivo.
--
-- Mudanças (100% aditivas — só CREATE OR REPLACE VIEW):
--   1. vw_ala_sellable: nova coluna `blocked` e sellable passa a descontar os
--      quartos bloqueados, sem deixar de respeitar o teto manual (DEC-023).
--   2. vw_room_day_status: expõe `block_reason` no ramo de bloqueio, para o
--      bookings.html distinguir 🔧 (manutenção) de 🔒 (bloqueio genérico).
--
-- Compatibilidade: quando não há bloqueio (blocked=0), o sellable é idêntico ao
-- da migration 033 — LEAST(cap−reserved, total−reserved) = cap−reserved (cap<=total).
-- NUNCA alterar migrations 001–037 existentes.
-- ============================================================================

-- ── vw_ala_sellable: desconta bloqueios da venda ────────────────────────────
-- sellable = max(0, min(teto restante, livres físicos reais))
--   teto restante   = cap − reserved
--   livres físicos  = total − reserved − blocked
-- O menor dos dois evita vender acima do teto manual E acima do que existe de
-- fato livre (descontados reservados e em manutenção).
CREATE OR REPLACE VIEW public.vw_ala_sellable AS
WITH totals AS (
  SELECT left(code, 1) AS ala, count(*)::int AS total_rooms
  FROM public.rooms
  WHERE active
  GROUP BY left(code, 1)
),
res AS (
  SELECT left(a.room_type, 1) AS ala, a.date, count(*)::int AS reserved_count
  FROM public.availability a
  JOIN public.rooms r ON r.code = a.room_type AND r.active
  WHERE a.status = 'reserved'
  GROUP BY left(a.room_type, 1), a.date
),
blk AS (
  SELECT left(a.room_type, 1) AS ala, a.date, count(*)::int AS blocked_count
  FROM public.availability a
  JOIN public.rooms r ON r.code = a.room_type AND r.active
  WHERE a.status = 'blocked'
  GROUP BY left(a.room_type, 1), a.date
),
keys AS (
  SELECT ala, date FROM public.ala_inventory_caps
  UNION SELECT ala, date FROM res
  UNION SELECT ala, date FROM blk
)
-- Ordem das colunas 1–8 preservada (CREATE OR REPLACE VIEW não renomeia/reordena);
-- a nova coluna `blocked` é acrescentada no FIM.
SELECT
  k.ala,
  k.date,
  t.total_rooms,
  COALESCE(c.available_count, t.total_rooms)  AS cap,
  COALESCE(r.reserved_count, 0)               AS reserved,
  GREATEST(0, LEAST(
    COALESCE(c.available_count, t.total_rooms) - COALESCE(r.reserved_count, 0),
    t.total_rooms - COALESCE(r.reserved_count, 0) - COALESCE(bk.blocked_count, 0)
  ))                                          AS sellable,
  (c.ala IS NOT NULL)                         AS has_cap,
  c.note,
  COALESCE(bk.blocked_count, 0)               AS blocked
FROM keys k
JOIN      totals t                    ON t.ala  = k.ala
LEFT JOIN public.ala_inventory_caps c ON c.ala  = k.ala  AND c.date = k.date
LEFT JOIN res r                       ON r.ala  = k.ala  AND r.date = k.date
LEFT JOIN blk bk                      ON bk.ala = k.ala  AND bk.date = k.date;

COMMENT ON VIEW public.vw_ala_sellable IS
  'DEC-023 + manutenção (2026-06-17): cap/reservados/bloqueados/sellable por ala/data. sellable desconta reservados E bloqueios. Conta só quartos físicos (CRM).';

-- ── vw_room_day_status: expõe block_reason no ramo de bloqueio ───────────────
-- Recriação idêntica à 035 + coluna block_reason (NULL em ocupação, motivo no
-- bloqueio) para o frontend distinguir manutenção de bloqueio genérico.
CREATE OR REPLACE VIEW public.vw_room_day_status AS
SELECT
  r.room_type AS room_code,
  gs.d::date  AS date,
  'occupied'  AS status,
  r.id        AS reservation_id,
  l.name      AS guest_name,
  r.status    AS resv_status,
  NULL::text  AS block_reason
FROM public.reservations r
JOIN public.rooms rm ON rm.code = r.room_type AND rm.active
LEFT JOIN public.leads l ON l.id = r.lead_id
CROSS JOIN LATERAL generate_series(r.checkin_date, r.checkout_date - 1, interval '1 day') AS gs(d)
WHERE r.status IN ('confirmed', 'checkedin')
UNION ALL
SELECT
  av.room_type    AS room_code,
  av.date,
  'blocked'       AS status,
  NULL::uuid      AS reservation_id,
  NULL::text      AS guest_name,
  NULL::text      AS resv_status,
  av.block_reason
FROM public.availability av
JOIN public.rooms rm ON rm.code = av.room_type AND rm.active
WHERE av.status = 'blocked';

COMMENT ON VIEW public.vw_room_day_status IS
  'DEC-024 + manutenção (2026-06-17): ocupação + bloqueios por quarto físico/dia, com block_reason. Esparsa: ausência = livre.';
