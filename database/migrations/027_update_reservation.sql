-- ============================================================
-- Migration 027: Edição de reserva atômica (update_reservation_atomic)
-- ============================================================
-- Contexto: o PATCH /api/reservations/:id grava room_type/datas direto
-- na tabela reservations SEM recalcular a tabela availability. Editar
-- quarto ou datas por esse caminho dessincroniza o estoque → overbooking.
--
-- Esta RPC edita a reserva e, quando o quarto OU as datas mudam,
-- recalcula a availability na mesma transação (mesmo padrão de lock
-- FOR UPDATE NOWAIT de create_reservation_atomic / swap_room_atomic):
--   1. Verifica disponibilidade do novo quarto/período ANTES de mutar
--      (conta noites 'available' OU já reservadas por esta própria reserva,
--       cobrindo o caso de estender/encurtar no mesmo quarto)
--   2. Só então libera a janela antiga (por reservation_id) e ocupa a nova
--   3. Campos sem efeito no estoque (total/sinal/canal/placa/hóspedes)
--      entram na mesma UPDATE
--
-- balance_amount é coluna GENERATED (total - deposit) — recalculada pelo
-- Postgres, nunca setada aqui.
-- ============================================================

CREATE OR REPLACE FUNCTION update_reservation_atomic(
  p_reservation_id UUID,
  p_room_type      VARCHAR(20),
  p_checkin        DATE,
  p_checkout       DATE,
  p_guests         SMALLINT,
  p_total_amount   DECIMAL(10,2),
  p_deposit_amount DECIMAL(10,2),
  p_channel        VARCHAR(20) DEFAULT NULL,
  p_vehicle_plate  VARCHAR(20) DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_res             RECORD;
  v_physical_room   VARCHAR(20);
  v_nights_required INT;
  v_nights_free     INT;
  v_changed         BOOLEAN;
BEGIN
  SELECT id, room_type, checkin_date, checkout_date, status INTO v_res
  FROM reservations WHERE id = p_reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','not_found','message','Reserva não encontrada.');
  END IF;

  IF v_res.status IN ('checkedout','completed','cancelled') THEN
    RETURN json_build_object('success',false,'error','reservation_closed','message','Reserva encerrada não pode ser editada.');
  END IF;

  IF p_checkout <= p_checkin THEN
    RETURN json_build_object('success',false,'error','invalid_dates','message','Check-out deve ser depois do check-in.');
  END IF;

  v_nights_required := (p_checkout - p_checkin)::INT;

  -- Resolve quarto físico (mesma lógica de create_reservation_atomic)
  IF p_room_type IN ('ALA_A','ALA_B') THEN
    v_physical_room := p_room_type;
  ELSIF p_room_type = 'ALA_C_CASAL' THEN
    -- mantém o quarto atual se já é ALA_C_x e cabe; senão escolhe um livre
    IF v_res.room_type IN ('ALA_C_1','ALA_C_2') THEN
      v_physical_room := v_res.room_type;
    ELSE
      SELECT q INTO v_physical_room
      FROM (VALUES ('ALA_C_1'),('ALA_C_2')) AS t(q)
      WHERE (
        SELECT COUNT(*) FROM availability
        WHERE room_type = t.q
          AND date >= p_checkin AND date < p_checkout
          AND (status = 'available' OR reservation_id = p_reservation_id)
      ) = v_nights_required
      LIMIT 1;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM rooms WHERE code = p_room_type AND active = true) THEN
    v_physical_room := p_room_type;
  ELSE
    RETURN json_build_object('success',false,'error','invalid_room_type','message','Quarto inválido: ' || p_room_type);
  END IF;

  IF v_physical_room IS NULL THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto indisponível para o período.');
  END IF;

  v_changed := (v_physical_room IS DISTINCT FROM v_res.room_type)
            OR (p_checkin  <> v_res.checkin_date)
            OR (p_checkout <> v_res.checkout_date);

  IF v_changed THEN
    -- Verifica disponibilidade ANTES de qualquer mutação (return = sem rollback).
    -- Conta como livre o que está 'available' OU já é desta reserva (estender/encurtar).
    WITH locked AS (
      SELECT id FROM availability
      WHERE room_type = v_physical_room
        AND date >= p_checkin AND date < p_checkout
        AND (status = 'available' OR reservation_id = p_reservation_id)
      FOR UPDATE NOWAIT
    )
    SELECT COUNT(*) INTO v_nights_free FROM locked;

    IF v_nights_free < v_nights_required THEN
      RETURN json_build_object('success',false,'error','no_availability',
        'message','Quarto ' || v_physical_room || ' indisponível para o novo período.');
    END IF;

    -- Libera toda a janela antiga desta reserva
    UPDATE availability
    SET status='available', reservation_id=NULL, updated_at=NOW()
    WHERE reservation_id = p_reservation_id;

    -- Ocupa a nova janela
    UPDATE availability
    SET status='reserved', reservation_id=p_reservation_id, updated_at=NOW()
    WHERE room_type = v_physical_room
      AND date >= p_checkin AND date < p_checkout;
  END IF;

  UPDATE reservations
  SET room_type      = v_physical_room,
      checkin_date   = p_checkin,
      checkout_date  = p_checkout,
      guests         = p_guests,
      total_amount   = p_total_amount,
      deposit_amount = p_deposit_amount,
      channel        = COALESCE(p_channel, channel),
      vehicle_plate  = NULLIF(p_vehicle_plate, ''),
      updated_at     = NOW()
  WHERE id = p_reservation_id;

  RETURN json_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'room_type', v_physical_room,
    'inventory_recalculated', v_changed
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success',false,'error','locked','message','Outra operação está mexendo neste quarto. Tente novamente.');
  WHEN OTHERS THEN
    RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;
