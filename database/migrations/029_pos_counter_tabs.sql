-- ============================================================
-- Migration 029: PDV (Ponto de Venda) — comandas de balcão
-- ============================================================
-- counter_tabs → comanda avulsa de balcão (cliente sem quarto).
-- A venda de balcão REUSA a infra existente:
--   room_charges → itens vendidos (trigger baixa estoque central)
--   payments     → pagamento (entra no financeiro automaticamente)
-- Em vez de reservation_id, a linha aponta para counter_tab_id.
--   reservation_id passa a ser NULLABLE em ambas as tabelas.
--   CHECK garante XOR: cada linha pertence a UMA reserva OU a UMA
--   comanda de balcão (nunca aos dois, nunca a nenhum).
-- RPC pos_register_sale → registra a venda inteira (carrinho +
--   destino + pagamento) de forma atômica.
-- RPC counter_tab_pay → quita uma comanda de balcão fiada.
-- ============================================================

-- ── counter_tabs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counter_tabs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_counter_tabs_status ON counter_tabs(status);

-- ── room_charges: vínculo opcional com comanda de balcão ─────
ALTER TABLE room_charges ALTER COLUMN reservation_id DROP NOT NULL;
ALTER TABLE room_charges ADD COLUMN IF NOT EXISTS counter_tab_id UUID
  REFERENCES counter_tabs(id) ON DELETE CASCADE;
ALTER TABLE room_charges DROP CONSTRAINT IF EXISTS room_charges_owner_xor;
ALTER TABLE room_charges ADD CONSTRAINT room_charges_owner_xor
  CHECK ((reservation_id IS NOT NULL)::int + (counter_tab_id IS NOT NULL)::int = 1);

CREATE INDEX IF NOT EXISTS idx_room_charges_counter_tab ON room_charges(counter_tab_id);

-- ── payments: vínculo opcional com comanda de balcão ─────────
ALTER TABLE payments ALTER COLUMN reservation_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS counter_tab_id UUID
  REFERENCES counter_tabs(id) ON DELETE CASCADE;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_owner_xor;
ALTER TABLE payments ADD CONSTRAINT payments_owner_xor
  CHECK ((reservation_id IS NOT NULL)::int + (counter_tab_id IS NOT NULL)::int = 1);

CREATE INDEX IF NOT EXISTS idx_payments_counter_tab ON payments(counter_tab_id);

-- ── RLS (API usa service_role; authenticated pode ler) ───────
ALTER TABLE counter_tabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counter_tabs_read_auth ON counter_tabs;
CREATE POLICY counter_tabs_read_auth ON counter_tabs FOR SELECT TO authenticated USING (true);

-- ============================================================
-- RPC: pos_register_sale — venda atômica do PDV
-- ============================================================
-- p_items: JSONB [{ "product_id": uuid, "quantity": n }, ...]
-- p_destination: 'room' (lança na comanda do hóspede) | 'counter' (balcão)
-- p_payment: 'now' (pago já, registra payment) | 'later' (fiado)
-- Regras:
--   destino room   → itens em room_charges(reservation_id); 'now' = payment balance confirmado
--   destino counter→ cria counter_tab; itens em room_charges(counter_tab_id)
--                    'now'  = tab 'paga'  + payment confirmado
--                    'later'= tab 'aberta' + sem payment (fica devendo), nome obrigatório
-- Valida estoque central de cada item (FOR UPDATE). Tudo ou nada.
-- ============================================================
CREATE OR REPLACE FUNCTION pos_register_sale(
  p_items          JSONB,
  p_destination    TEXT,
  p_payment        TEXT,
  p_reservation_id UUID  DEFAULT NULL,
  p_room_code      TEXT  DEFAULT NULL,
  p_customer_name  TEXT  DEFAULT NULL,
  p_method         TEXT  DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_item    JSONB;
  v_product products%ROWTYPE;
  v_qty     NUMERIC;
  v_tab_id  UUID := NULL;
  v_total   NUMERIC := 0;
  v_count   INT := 0;
  v_name    TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('success',false,'error','empty_cart','message','Carrinho vazio.');
  END IF;
  IF p_destination NOT IN ('room','counter') THEN
    RETURN json_build_object('success',false,'error','invalid_destination','message','Destino inválido.');
  END IF;
  IF p_payment NOT IN ('now','later') THEN
    RETURN json_build_object('success',false,'error','invalid_payment','message','Forma de registro inválida.');
  END IF;
  IF p_payment = 'now' AND (p_method IS NULL OR p_method NOT IN ('pix','cash','card','transfer')) THEN
    RETURN json_build_object('success',false,'error','invalid_method','message','Forma de pagamento inválida.');
  END IF;

  IF p_destination = 'room' THEN
    IF p_reservation_id IS NULL THEN
      RETURN json_build_object('success',false,'error','missing_reservation','message','Quarto/reserva não informado.');
    END IF;
    PERFORM 1 FROM reservations WHERE id = p_reservation_id;
    IF NOT FOUND THEN
      RETURN json_build_object('success',false,'error','reservation_not_found','message','Reserva não encontrada.');
    END IF;
  ELSE
    IF p_payment = 'later' AND (p_customer_name IS NULL OR btrim(p_customer_name) = '') THEN
      RETURN json_build_object('success',false,'error','missing_customer_name','message','Nome do cliente é obrigatório para comanda de balcão fiada.');
    END IF;
    v_name := COALESCE(NULLIF(btrim(p_customer_name), ''), 'Balcão');
    INSERT INTO counter_tabs (customer_name, status, paid_at)
    VALUES (v_name,
            CASE WHEN p_payment = 'now' THEN 'paga'  ELSE 'aberta' END,
            CASE WHEN p_payment = 'now' THEN NOW()   ELSE NULL     END)
    RETURNING id INTO v_tab_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RETURN json_build_object('success',false,'error','invalid_quantity','message','Quantidade inválida no carrinho.');
    END IF;

    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NOT FOUND THEN
      RETURN json_build_object('success',false,'error','product_not_found','message','Produto não encontrado.');
    END IF;
    IF NOT v_product.active THEN
      RETURN json_build_object('success',false,'error','inactive_product','message', v_product.name || ' está inativo.');
    END IF;
    IF v_product.stock_quantity < v_qty THEN
      RETURN json_build_object('success',false,'error','insufficient_stock',
        'message', v_product.name || ': estoque ' || v_product.stock_quantity || ', pedido ' || v_qty || '.');
    END IF;

    -- trigger fn_charge_stock baixa o estoque central no INSERT
    INSERT INTO room_charges (reservation_id, counter_tab_id, room_code, product_id, quantity, unit_price, staff_note, from_frigobar)
    VALUES (
      CASE WHEN p_destination = 'room' THEN p_reservation_id ELSE NULL END,
      v_tab_id,
      CASE WHEN p_destination = 'room' THEN p_room_code ELSE NULL END,
      v_product.id, v_qty, v_product.price, 'PDV', false
    );

    v_total := v_total + v_qty * v_product.price;
    v_count := v_count + 1;
  END LOOP;

  IF p_payment = 'now' THEN
    INSERT INTO payments (reservation_id, counter_tab_id, payment_type, amount, method, status, confirmed_at)
    VALUES (
      CASE WHEN p_destination = 'room' THEN p_reservation_id ELSE NULL END,
      v_tab_id,
      'balance', v_total, p_method, 'confirmed', NOW()
    );
  END IF;

  RETURN json_build_object('success',true,'total',v_total,'items',v_count,'counter_tab_id',v_tab_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;

-- ============================================================
-- RPC: counter_tab_pay — quita uma comanda de balcão fiada
-- ============================================================
CREATE OR REPLACE FUNCTION counter_tab_pay(p_tab_id UUID, p_method TEXT)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_tab     counter_tabs%ROWTYPE;
  v_charges NUMERIC;
  v_paid    NUMERIC;
  v_due     NUMERIC;
BEGIN
  IF p_method IS NULL OR p_method NOT IN ('pix','cash','card','transfer') THEN
    RETURN json_build_object('success',false,'error','invalid_method','message','Forma de pagamento inválida.');
  END IF;

  SELECT * INTO v_tab FROM counter_tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','not_found','message','Comanda não encontrada.');
  END IF;
  IF v_tab.status = 'paga' THEN
    RETURN json_build_object('success',false,'error','already_paid','message','Comanda já está paga.');
  END IF;

  SELECT COALESCE(SUM(total),0)  INTO v_charges FROM room_charges WHERE counter_tab_id = p_tab_id;
  SELECT COALESCE(SUM(amount),0) INTO v_paid    FROM payments     WHERE counter_tab_id = p_tab_id AND status = 'confirmed';
  v_due := v_charges - v_paid;

  IF v_due > 0 THEN
    INSERT INTO payments (counter_tab_id, payment_type, amount, method, status, confirmed_at)
    VALUES (p_tab_id, 'balance', v_due, p_method, 'confirmed', NOW());
  END IF;

  UPDATE counter_tabs SET status = 'paga', paid_at = NOW() WHERE id = p_tab_id;
  RETURN json_build_object('success',true,'amount',GREATEST(v_due,0));
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;
