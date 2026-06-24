-- ============================================================================
-- 040_views_exclude_test.sql — Bloco 1 / Higiene: views de ocupação ignoram teste
-- ============================================================================
-- Redefine as views canônicas de exibição (DEC-024) para excluir reservas
-- marcadas como is_test, mantendo Front Desk/Mapa críveis (sem hóspede fictício
-- "in-house" para sempre vindo de reservas de teste).
--
-- Mantém fielmente a definição vigente (036 para vw_today_board) e só adiciona
-- o filtro `r.is_test = false`. 100% aditivo (CREATE OR REPLACE VIEW).
-- vw_reservation_balance NÃO é alterada (lookup por id; já fica fora do board
-- porque vw_today_board passa a filtrar test). NUNCA alterar migrations 001–039.
-- ============================================================================

-- ── Board do dia (fiel à 036 + filtro is_test) ───────────────────────────────
CREATE OR REPLACE VIEW public.vw_today_board AS
WITH t AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today)
SELECT
  r.id            AS reservation_id,
  r.room_type,
  r.checkin_date,
  r.checkout_date,
  r.status,
  r.guests,
  l.name          AS guest_name,
  b.balance_due,
  (r.checkin_date  = t.today AND r.status IN ('pending','confirmed','checkedin')) AS is_checkin_today,
  (r.checkout_date = t.today AND r.status IN ('confirmed','checkedin'))           AS is_checkout_today,
  (r.checkin_date <= t.today AND r.checkout_date > t.today
     AND r.status IN ('confirmed','checkedin'))                                   AS is_in_house,
  b.room_total,
  b.charges_total
FROM public.reservations r
CROSS JOIN t
LEFT JOIN public.leads l ON l.id = r.lead_id
LEFT JOIN public.vw_reservation_balance b ON b.reservation_id = r.id
WHERE r.status <> 'cancelled'
  AND r.is_test = false
  AND (r.checkin_date = t.today
       OR r.checkout_date = t.today
       OR (r.checkin_date <= t.today AND r.checkout_date > t.today));

COMMENT ON VIEW public.vw_today_board IS
  'DEC-024 + Bloco 1: board do dia (America/Sao_Paulo), exclui is_test. Inclui room_total/charges_total/balance_due.';

-- ── Status por quarto físico / dia (fiel à 035 + filtro is_test na ocupação) ──
-- Preserva a coluna block_reason (presente na view de produção, posição 7).
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
  AND r.is_test = false
UNION ALL
SELECT
  av.room_type   AS room_code,
  av.date,
  'blocked'      AS status,
  NULL::uuid     AS reservation_id,
  NULL::text     AS guest_name,
  NULL::text     AS resv_status,
  av.block_reason
FROM public.availability av
JOIN public.rooms rm ON rm.code = av.room_type AND rm.active
WHERE av.status = 'blocked';

COMMENT ON VIEW public.vw_room_day_status IS
  'DEC-024 + Bloco 1: ocupação (reservas ativas não-teste) + bloqueios por quarto/dia. Esparsa: ausência = livre.';
