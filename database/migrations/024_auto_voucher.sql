-- ============================================================
-- Migration 024: Voucher automático na criação de reserva
-- ============================================================
-- create_reservation_atomic passa a inserir o voucher (status
-- 'active') na MESMA transação da reserva — sem clique manual.
-- download_token/status/created_at vêm dos defaults da tabela.
-- ============================================================

CREATE OR REPLACE FUNCTION create_reservation_atomic(
  p_lead_id        UUID,
  p_whatsapp       VARCHAR(20),
  p_room_type      VARCHAR(20),
  p_checkin        DATE,
  p_checkout       DATE,
  p_guests         SMALLINT,
  p_total_amount   DECIMAL(10,2),
  p_deposit_amount DECIMAL(10,2),
  p_proposal_id    UUID DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_physical_room   VARCHAR(20);
  v_nights_required INT;
  v_nights_free     INT;
  v_reservation_id  UUID;
  v_res_number      TEXT;
  v_voucher_id      UUID;
BEGIN
  v_nights_required := (p_checkout - p_checkin)::INT;

  IF p_room_type IN ('ALA_A','ALA_B') THEN
    v_physical_room := p_room_type;
  ELSIF p_room_type = 'ALA_C_CASAL' THEN
    SELECT q INTO v_physical_room
    FROM (VALUES ('ALA_C_1'),('ALA_C_2')) AS t(q)
    WHERE (
      SELECT COUNT(*) FROM availability
      WHERE room_type = t.q
        AND date >= p_checkin AND date < p_checkout
        AND status = 'available'
    ) = v_nights_required
    LIMIT 1;
  ELSIF EXISTS (SELECT 1 FROM rooms WHERE code = p_room_type AND active = true) THEN
    v_physical_room := p_room_type;
  ELSE
    RETURN json_build_object('success',false,'error','invalid_room_type','message','Quarto inválido: ' || p_room_type);
  END IF;

  IF v_physical_room IS NULL THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto indisponível para o período.');
  END IF;

  WITH locked AS (
    SELECT id FROM availability
    WHERE room_type = v_physical_room
      AND date >= p_checkin AND date < p_checkout
      AND status = 'available'
    FOR UPDATE NOWAIT
  )
  SELECT COUNT(*) INTO v_nights_free FROM locked;

  IF v_nights_free < v_nights_required THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto indisponível para o período.');
  END IF;

  INSERT INTO reservations (
    lead_id, whatsapp_number, room_type,
    checkin_date, checkout_date, guests,
    total_amount, deposit_amount, status
  ) VALUES (
    p_lead_id, p_whatsapp, v_physical_room,
    p_checkin, p_checkout, p_guests,
    p_total_amount, p_deposit_amount, 'pending'
  ) RETURNING id, reservation_number INTO v_reservation_id, v_res_number;

  UPDATE availability
  SET status = 'reserved', reservation_id = v_reservation_id, updated_at = NOW()
  WHERE room_type = v_physical_room AND date >= p_checkin AND date < p_checkout;

  -- Voucher automático (status 'active' via default da tabela)
  INSERT INTO vouchers (
    reservation_id, guest_name, room_type,
    check_in, check_out, guests, source, total_amount, notes
  )
  SELECT v_reservation_id, COALESCE(l.name, 'Hóspede'), v_physical_room,
         p_checkin, p_checkout, p_guests, 'direct', p_total_amount,
         'Gerado automaticamente — ' || v_res_number
  FROM leads l WHERE l.id = p_lead_id
  RETURNING id INTO v_voucher_id;

  IF p_proposal_id IS NOT NULL THEN
    UPDATE proposals SET reservation_id = v_reservation_id, status = 'accepted', updated_at = NOW()
    WHERE id = p_proposal_id;
  END IF;

  UPDATE leads SET funnel_stage = 'confirmed', updated_at = NOW() WHERE id = p_lead_id;

  RETURN json_build_object(
    'success',true,
    'reservation_id',v_reservation_id,
    'reservation_number',v_res_number,
    'room_type',v_physical_room,
    'voucher_id',v_voucher_id
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success',false,'error','concurrency','message','Outro processo está confirmando este quarto. Tente novamente.');
  WHEN OTHERS THEN
    RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;
