-- ============================================================================
-- 035_occupancy_ssot_views.sql — DEC-024 / F1: fonte única de ocupação (views)
-- ============================================================================
-- Cria as views canônicas que TODAS as telas vão consumir (via endpoint na F2),
-- eliminando as regras divergentes de fronteira/status/fuso/saldo.
--
-- Regras canônicas (DEC-024):
--   • Fronteira: ocupado se checkin <= dia < checkout (dia do checkout = LIVRE).
--   • Status ativos p/ ocupação: 'confirmed','checkedin'. 'checkedout'/'cancelled' não ocupam.
--   • "Hoje": America/Sao_Paulo.
--   • Saldo: total + room_charges − sinal − pagamentos confirmados (mesma conta da RPC).
--
-- Fonte da verdade: reservations = ocupação de hóspede; availability = bloqueios.
-- Reservas legadas por ala (room_type 'ALA_*', Luna inativa) ficam fora do mapa
-- por quarto físico — tratadas quando a Luna religar (alinha DEC-022/023 F6).
--
-- 100% aditivo (só CREATE OR REPLACE VIEW). Não altera tabela, escrita nem RLS.
-- NUNCA alterar migrations 001–034 existentes.
-- ============================================================================

-- ── Saldo único por reserva (espelha checkout_reservation) ───────────────────
CREATE OR REPLACE VIEW public.vw_reservation_balance AS
SELECT
  r.id                                   AS reservation_id,
  COALESCE(r.total_amount, 0)            AS room_total,
  COALESCE(rc.charges_total, 0)          AS charges_total,
  COALESCE(r.deposit_amount, 0)          AS deposit_paid,
  COALESCE(pay.payments_confirmed, 0)    AS payments_confirmed,
  COALESCE(r.total_amount, 0) + COALESCE(rc.charges_total, 0)
    - COALESCE(r.deposit_amount, 0) - COALESCE(pay.payments_confirmed, 0) AS balance_due
FROM public.reservations r
LEFT JOIN LATERAL (
  SELECT SUM(total) AS charges_total
  FROM public.room_charges WHERE reservation_id = r.id
) rc ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS payments_confirmed
  FROM public.payments
  WHERE reservation_id = r.id AND status = 'confirmed' AND payment_type IN ('balance', 'full')
) pay ON true;

COMMENT ON VIEW public.vw_reservation_balance IS
  'DEC-024: saldo único por reserva = total + charges − sinal − pagamentos confirmados.';

-- ── Board do dia (fuso BR, regras canônicas) ─────────────────────────────────
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
     AND r.status IN ('confirmed','checkedin'))                                   AS is_in_house
FROM public.reservations r
CROSS JOIN t
LEFT JOIN public.leads l ON l.id = r.lead_id
LEFT JOIN public.vw_reservation_balance b ON b.reservation_id = r.id
WHERE r.status <> 'cancelled'
  AND (r.checkin_date = t.today
       OR r.checkout_date = t.today
       OR (r.checkin_date <= t.today AND r.checkout_date > t.today));

COMMENT ON VIEW public.vw_today_board IS
  'DEC-024: board do dia (America/Sao_Paulo). is_checkout_today exclui checkedout/cancelled.';

-- ── Status por quarto físico / dia (ocupação + bloqueio) ─────────────────────
-- Retorna SÓ linhas ocupadas/bloqueadas (esparsa): ausência de (quarto,dia) = livre.
CREATE OR REPLACE VIEW public.vw_room_day_status AS
SELECT
  r.room_type AS room_code,
  gs.d::date  AS date,
  'occupied'  AS status,
  r.id        AS reservation_id,
  l.name      AS guest_name,
  r.status    AS resv_status
FROM public.reservations r
JOIN public.rooms rm ON rm.code = r.room_type AND rm.active
LEFT JOIN public.leads l ON l.id = r.lead_id
CROSS JOIN LATERAL generate_series(r.checkin_date, r.checkout_date - 1, interval '1 day') AS gs(d)
WHERE r.status IN ('confirmed', 'checkedin')
UNION ALL
SELECT
  av.room_type AS room_code,
  av.date,
  'blocked'    AS status,
  NULL::uuid   AS reservation_id,
  NULL::text   AS guest_name,
  NULL::text   AS resv_status
FROM public.availability av
JOIN public.rooms rm ON rm.code = av.room_type AND rm.active
WHERE av.status = 'blocked';

COMMENT ON VIEW public.vw_room_day_status IS
  'DEC-024: ocupação (reservas ativas, checkin<=d<checkout) + bloqueios por quarto físico/dia. Esparsa: ausência = livre.';
