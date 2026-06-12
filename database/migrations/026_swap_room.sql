-- ============================================================
-- Migration 026: Troca de quarto atômica (swap_room_atomic)
-- ============================================================
-- Move uma reserva ativa para outro quarto físico, com lock
-- FOR UPDATE NOWAIT na availability (mesmo padrão da
-- create_reservation_atomic, migration 021).
--
-- Janela movida: GREATEST(checkin, hoje) → checkout.
--   - Reserva futura: move o período inteiro.
--   - Hóspede no quarto: noites passadas ficam no quarto antigo
--     (histórico); de hoje em diante vale o quarto novo.
-- room_charges.room_code não é alterado — consumo já lançado é
-- histórico do quarto onde aconteceu.

CREATE OR REPLACE FUNCTION swap_room_atomic(
  p_reservation_id UUID,
  p_new_room       VARCHAR(20)
)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_res    RECORD;
  v_from   DATE;
  v_nights INT;
  v_free   INT;
BEGIN
  SELECT id, room_type, checkin_date, checkout_date, status INTO v_res
  FROM reservations WHERE id = p_reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','not_found','message','Reserva não encontrada.');
  END IF;

  IF v_res.status IN ('checkedout','completed','cancelled') THEN
    RETURN json_build_object('success',false,'error','reservation_closed','message','Reserva já encerrada — não é possível trocar de quarto.');
  END IF;

  IF p_new_room = v_res.room_type THEN
    RETURN json_build_object('success',false,'error','same_room','message','O quarto escolhido é o atual.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rooms WHERE code = p_new_room AND active = true) THEN
    RETURN json_build_object('success',false,'error','invalid_room','message','Quarto inválido ou inativo: ' || p_new_room);
  END IF;

  v_from   := GREATEST(v_res.checkin_date, CURRENT_DATE);
  v_nights := (v_res.checkout_date - v_from)::INT;

  IF v_nights <= 0 THEN
    RETURN json_build_object('success',false,'error','stay_finished','message','A estadia termina hoje — não há noites para mover.');
  END IF;

  -- Lock noite a noite no quarto novo; se outra transação segura, falha rápido
  WITH locked AS (
    SELECT id FROM availability
    WHERE room_type = p_new_room
      AND date >= v_from AND date < v_res.checkout_date
      AND status = 'available'
    FOR UPDATE NOWAIT
  )
  SELECT COUNT(*) INTO v_free FROM locked;

  IF v_free < v_nights THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto ' || p_new_room || ' indisponível para o período restante.');
  END IF;

  -- Libera o quarto antigo daqui em diante (noites passadas ficam como histórico)
  UPDATE availability
  SET status = 'available', reservation_id = NULL, updated_at = NOW()
  WHERE room_type = v_res.room_type
    AND reservation_id = p_reservation_id
    AND date >= v_from;

  -- Ocupa o quarto novo
  UPDATE availability
  SET status = 'reserved', reservation_id = p_reservation_id, updated_at = NOW()
  WHERE room_type = p_new_room
    AND date >= v_from AND date < v_res.checkout_date;

  UPDATE reservations
  SET room_type = p_new_room, updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN json_build_object(
    'success',true,
    'old_room', v_res.room_type,
    'new_room', p_new_room,
    'from_date', v_from
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success',false,'error','locked','message','Outra operação está mexendo neste quarto. Tente novamente.');
END;
$$;
