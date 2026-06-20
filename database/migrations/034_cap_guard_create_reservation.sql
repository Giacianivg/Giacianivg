-- ============================================================================
-- 034_cap_guard_create_reservation.sql — DEC-023 / F5: trava do teto de venda
-- ============================================================================
-- Adiciona o teto por ala (ala_inventory_caps, migration 033) ao caminho FÍSICO
-- de create_reservation_atomic (reservas do CRM por quarto A1–C5, caminho ATIVO).
--
-- Regra (DEC-023): só permite alocar o quarto se, em TODA noite do período, o
-- nº de quartos físicos da ala já reservados for MENOR que o teto da ala/data
-- (teto = ala_inventory_caps.available_count, ou total físico da ala se não houver).
-- Caso contrário → no_availability. O teto NUNCA derruba reserva confirmada.
--
-- O caminho LEGADO por ala (room_type IN ('ALA_A','ALA_B','ALA_C_CASAL'), usado
-- pela Luna inativa) NÃO recebe o guard aqui — fica para a F6 (gated, toca
-- webhook.js/system-prompt.js, exige aprovação CTO ao religar a Luna).
--
-- Limitação conhecida (aceita no volume atual ~0%): o lock FOR UPDATE NOWAIT
-- trava só o quarto-alvo, não a ala inteira; sob concorrência alta dois quartos
-- distintos da mesma ala poderiam passar o teto. Coerente com o modelo de
-- concorrência atual; endurecer se o volume crescer.
--
-- Recriação fiel da função (migration 016 é a origem) + bloco do guard.
-- NUNCA alterar migrations 001–033 existentes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
  p_lead_id uuid,
  p_whatsapp character varying,
  p_room_type character varying,
  p_checkin date,
  p_checkout date,
  p_guests smallint,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_proposal_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
AS $function$
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

  -- ── DEC-023 F5: teto de venda por ala (só caminho físico/CRM) ──────────────
  -- Bloqueia se em QUALQUER noite os reservados da ala já alcançaram o teto.
  IF EXISTS (SELECT 1 FROM rooms WHERE code = v_physical_room AND active = true) THEN
    IF EXISTS (
      SELECT 1
      FROM generate_series(p_checkin, p_checkout - 1, interval '1 day') AS gs(d)
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(
            (SELECT aic.available_count FROM ala_inventory_caps aic
              WHERE aic.ala = left(v_physical_room, 1) AND aic.date = gs.d::date),
            (SELECT COUNT(*) FROM rooms
              WHERE left(code, 1) = left(v_physical_room, 1) AND active = true)
          ) AS cap,
          (SELECT COUNT(*) FROM availability av
             JOIN rooms r2 ON r2.code = av.room_type AND r2.active = true
            WHERE left(av.room_type, 1) = left(v_physical_room, 1)
              AND av.date = gs.d::date
              AND av.status = 'reserved') AS reserved
      ) x
      WHERE x.reserved >= x.cap
    ) THEN
      RETURN json_build_object('success',false,'error','no_availability',
        'message','Ala ' || left(v_physical_room, 1) || ' atingiu o teto de quartos disponíveis no período.');
    END IF;
  END IF;
  -- ───────────────────────────────────────────────────────────────────────────

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
$function$;
