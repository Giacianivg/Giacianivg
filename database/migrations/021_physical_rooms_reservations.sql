-- ============================================================
-- Migration 021: Reservas em quartos físicos (A1–A8, B1–B7, C1–C5)
-- ============================================================
-- Contexto: a migration 012 criou os quartos físicos na tabela rooms,
-- mas availability, os CHECK constraints e a RPC create_reservation_atomic
-- continuaram aceitando apenas as alas genéricas (ALA_A, ALA_B, ALA_C_1/2).
-- Resultado: criar reserva pelo CRM com quarto físico (ex.: B1) falhava.
--
-- Esta migration:
--   1. Amplia res_room_check / avail_room_check para incluir quartos físicos
--   2. Amplia res_status_check para aceitar 'checkedin'/'checkedout' (usados
--      pelo CRM) mantendo os valores legados
--   3. Relaxa deposit_amount para >= 0 (reserva sem sinal é válida)
--   4. Gera availability para os quartos físicos (2026-01-01 → 2027-12-31)
--   5. Atualiza a RPC para aceitar quartos físicos ativos, mantendo
--      compatibilidade com os sinais da Luna (ALA_A, ALA_B, ALA_C_CASAL)
-- ============================================================

-- ── 1. CHECK de room_type ────────────────────────────────────
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS res_room_check;
ALTER TABLE reservations ADD CONSTRAINT res_room_check CHECK (
  room_type::text = ANY (ARRAY[
    'ALA_A','ALA_B','ALA_C_1','ALA_C_2',
    'A1','A2','A3','A4','A5','A6','A7','A8',
    'B1','B2','B3','B4','B5','B6','B7',
    'C1','C2','C3','C4','C5'
  ]::text[])
);

ALTER TABLE availability DROP CONSTRAINT IF EXISTS avail_room_check;
ALTER TABLE availability ADD CONSTRAINT avail_room_check CHECK (
  room_type::text = ANY (ARRAY[
    'ALA_A','ALA_B','ALA_C_1','ALA_C_2',
    'A1','A2','A3','A4','A5','A6','A7','A8',
    'B1','B2','B3','B4','B5','B6','B7',
    'C1','C2','C3','C4','C5'
  ]::text[])
);

-- ── 2. CHECK de status: aceita valores do CRM + legados ──────
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS res_status_check;
ALTER TABLE reservations ADD CONSTRAINT res_status_check CHECK (
  status::text = ANY (ARRAY[
    'pending','deposit_paid','confirmed',
    'checked_in','checkedin','checkedout','completed','cancelled'
  ]::text[])
);

-- ── 3. Sinal pode ser zero (reserva sem sinal ainda pago) ────
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_deposit_amount_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_deposit_amount_check
  CHECK (deposit_amount >= 0);

-- ── 4. Availability para quartos físicos ─────────────────────
INSERT INTO availability (room_type, date, status)
SELECT r.code, d::date, 'available'
FROM rooms r
CROSS JOIN generate_series('2026-01-01'::date, '2027-12-31'::date, interval '1 day') AS d
WHERE r.active = true
  AND r.code NOT IN ('ALA_A','ALA_B','ALA_C_CASAL','ALA_C_GRUPO')
ON CONFLICT (room_type, date) DO NOTHING;

-- ── 5. RPC: aceita quartos físicos ativos ────────────────────
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
    -- Quarto físico do CRM (A1–A8, B1–B7, C1–C5)
    v_physical_room := p_room_type;
  ELSE
    RETURN json_build_object('success',false,'error','invalid_room_type','message','Quarto inválido: ' || p_room_type);
  END IF;

  IF v_physical_room IS NULL THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto indisponível para o período.');
  END IF;

  -- CTE para bloquear rows individualmente (FOR UPDATE), depois conta
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

  IF p_proposal_id IS NOT NULL THEN
    UPDATE proposals SET reservation_id = v_reservation_id, status = 'accepted', updated_at = NOW()
    WHERE id = p_proposal_id;
  END IF;

  UPDATE leads SET funnel_stage = 'confirmed', updated_at = NOW() WHERE id = p_lead_id;

  RETURN json_build_object(
    'success',true,
    'reservation_id',v_reservation_id,
    'reservation_number',v_res_number,
    'room_type',v_physical_room
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success',false,'error','concurrency','message','Outro processo está confirmando este quarto. Tente novamente.');
  WHEN OTHERS THEN
    RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;
