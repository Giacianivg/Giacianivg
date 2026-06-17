-- ============================================================================
-- 036_today_board_enrich.sql — DEC-024 / F3: enriquece vw_today_board
-- ============================================================================
-- Adiciona room_total e charges_total ao board do dia para que o card do Front
-- Desk seja servido inteiramente pela fonte única (total exibido + saldo real),
-- sem precisar de uma 2ª chamada a /api/reservations.
-- Apenas CREATE OR REPLACE VIEW (aditivo, novas colunas). NUNCA alterar 001–035.
-- ============================================================================

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
  -- Novas colunas anexadas ao FIM (CREATE OR REPLACE não permite reordenar)
  b.room_total,
  b.charges_total
FROM public.reservations r
CROSS JOIN t
LEFT JOIN public.leads l ON l.id = r.lead_id
LEFT JOIN public.vw_reservation_balance b ON b.reservation_id = r.id
WHERE r.status <> 'cancelled'
  AND (r.checkin_date = t.today
       OR r.checkout_date = t.today
       OR (r.checkin_date <= t.today AND r.checkout_date > t.today));

COMMENT ON VIEW public.vw_today_board IS
  'DEC-024: board do dia (America/Sao_Paulo). is_checkout_today exclui checkedout/cancelled. Inclui room_total/charges_total/balance_due.';
