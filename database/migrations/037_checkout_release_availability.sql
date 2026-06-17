-- ============================================================================
-- 037_checkout_release_availability.sql — DEC-024 / F4: checkout libera availability
-- ============================================================================
-- Causa raiz da divergência entre telas: checkout_reservation gravava
-- status='checkedout' mas NUNCA liberava a tabela availability (só o
-- cancelamento liberava, via trigger). Resultado: slots ficavam 'reserved'
-- para sempre — e, em checkout antecipado, as noites futuras não voltavam a
-- ficar vendáveis (create_reservation_atomic e o teto DEC-023 viam 'reserved').
--
-- Correção (simetria com o cancelamento): ao finalizar o check-out, libera os
-- slots 'reserved' da reserva (status→available, reservation_id→NULL). Assim a
-- availability volta a refletir a realidade e as duas fontes não divergem.
--
-- Inclui backfill idempotente dos slots órfãos de reservas já encerradas.
-- Recriação fiel de checkout_reservation (origem: migrations 016/028) + release.
-- NUNCA alterar migrations 001–036 existentes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.checkout_reservation(p_reservation_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
  v_res        reservations%ROWTYPE;
  v_room_total NUMERIC;
  v_deposit    NUMERIC;
  v_charges    NUMERIC;
  v_payments   NUMERIC;
  v_balance    NUMERIC;
  v_totals     JSON;
BEGIN
  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found',
      'message', 'Reserva não encontrada.');
  END IF;

  v_room_total := COALESCE(v_res.total_amount, 0);
  v_deposit    := COALESCE(v_res.deposit_amount, 0);

  SELECT COALESCE(SUM(total), 0) INTO v_charges
  FROM room_charges WHERE reservation_id = p_reservation_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_payments
  FROM payments
  WHERE reservation_id = p_reservation_id
    AND status = 'confirmed'
    AND payment_type IN ('balance', 'full');

  v_balance := v_room_total + v_charges - v_deposit - v_payments;

  v_totals := json_build_object(
    'room_total',         v_room_total,
    'charges_total',      v_charges,
    'deposit_paid',       v_deposit,
    'payments_confirmed', v_payments,
    'balance_due',        v_balance
  );

  IF v_res.status = 'checkedout' THEN
    RETURN json_build_object('success', true, 'already', true,
      'reservation_id', v_res.id, 'status', v_res.status, 'totals', v_totals);
  END IF;

  IF v_balance > 0 THEN
    RETURN json_build_object('success', false, 'error', 'balance_due',
      'message', 'Saldo em aberto — receba o valor antes de finalizar o check-out.',
      'totals', v_totals);
  END IF;

  UPDATE reservations
    SET status = 'checkedout', checkout_at = NOW()
    WHERE id = p_reservation_id;

  -- DEC-024 F4: libera a availability (simetria com o cancelamento) para a
  -- reserva não permanecer 'reserved' após o checkout — fonte única consistente.
  UPDATE availability
    SET status = 'available', reservation_id = NULL, updated_at = NOW()
    WHERE reservation_id = p_reservation_id AND status = 'reserved';

  RETURN json_build_object('success', true, 'already', false,
    'reservation_id', p_reservation_id, 'status', 'checkedout', 'totals', v_totals);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'internal_error', 'message', SQLERRM);
END;
$function$;

-- Backfill: libera slots órfãos de reservas já encerradas (checkedout/cancelled).
UPDATE availability a
  SET status = 'available', reservation_id = NULL, updated_at = NOW()
FROM reservations r
WHERE a.reservation_id = r.id
  AND a.status = 'reserved'
  AND r.status IN ('checkedout', 'cancelled');
