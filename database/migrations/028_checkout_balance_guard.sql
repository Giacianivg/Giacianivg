-- ============================================================
-- Migration 028: Trava de saldo no check-out (fonte única)
-- ============================================================
-- checkout_reservation(p_reservation_id) é a ÚNICA porta de saída:
-- valida o saldo (diárias + consumos − sinal − pagamentos confirmados)
-- ANTES de finalizar. Se houver saldo, REJEITA — nenhum caminho de
-- frontend (frontdesk/rooms/map) consegue burlar, pois a trava é aqui.
--
-- Saldo idêntico ao do endpoint /api/room-charges/comanda/:id:
--   balance = total_amount + Σ room_charges.total
--             − deposit_amount − Σ payments(confirmed, balance|full)
-- ============================================================

CREATE OR REPLACE FUNCTION checkout_reservation(p_reservation_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
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

  -- Idempotente: já finalizada (não reprocessa nem reexige saldo)
  IF v_res.status = 'checkedout' THEN
    RETURN json_build_object('success', true, 'already', true,
      'reservation_id', v_res.id, 'status', v_res.status, 'totals', v_totals);
  END IF;

  -- Trava: saldo em aberto bloqueia o check-out
  IF v_balance > 0 THEN
    RETURN json_build_object('success', false, 'error', 'balance_due',
      'message', 'Saldo em aberto — receba o valor antes de finalizar o check-out.',
      'totals', v_totals);
  END IF;

  UPDATE reservations
    SET status = 'checkedout', checkout_at = NOW()
    WHERE id = p_reservation_id;

  RETURN json_build_object('success', true, 'already', false,
    'reservation_id', p_reservation_id, 'status', 'checkedout', 'totals', v_totals);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'internal_error', 'message', SQLERRM);
END;
$$;
