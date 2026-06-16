-- ============================================================
-- Migration 030: Comanda de balcão única por cliente
-- ============================================================
-- Antes, cada venda fiada de balcão criava uma counter_tab nova,
-- então o mesmo cliente acumulava várias comandas abertas. Agora:
--   pos_register_sale (counter + later) → reaproveita a comanda
--     ABERTA mais antiga do mesmo cliente (nome normalizado); só
--     cria nova se não houver. Pagamento 'now' segue criando comanda
--     fechada própria (transação avulsa já quitada).
--   counter_tab_add_items → adiciona itens a uma comanda aberta
--     (usado pelo popup "Ver comanda" no map.html).
-- A consolidação das comandas duplicadas já existentes é um data-fix
-- pontual aplicado em produção (fora desta migration de schema/funções).
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

    -- Fiado: reaproveita a comanda aberta mais antiga do mesmo cliente.
    IF p_payment = 'later' THEN
      SELECT id INTO v_tab_id FROM counter_tabs
       WHERE status = 'aberta' AND lower(customer_name) = lower(v_name)
       ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_tab_id IS NULL THEN
      INSERT INTO counter_tabs (customer_name, status, paid_at)
      VALUES (v_name,
              CASE WHEN p_payment = 'now' THEN 'paga'  ELSE 'aberta' END,
              CASE WHEN p_payment = 'now' THEN NOW()   ELSE NULL     END)
      RETURNING id INTO v_tab_id;
    END IF;
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
-- RPC: counter_tab_add_items — adiciona itens a uma comanda aberta
-- ============================================================
CREATE OR REPLACE FUNCTION counter_tab_add_items(p_tab_id UUID, p_items JSONB)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_item    JSONB;
  v_product products%ROWTYPE;
  v_qty     NUMERIC;
  v_status  TEXT;
  v_total   NUMERIC := 0;
  v_count   INT := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('success',false,'error','empty_cart','message','Nenhum item para adicionar.');
  END IF;

  SELECT status INTO v_status FROM counter_tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','not_found','message','Comanda não encontrada.');
  END IF;
  IF v_status <> 'aberta' THEN
    RETURN json_build_object('success',false,'error','closed_tab','message','Comanda já está paga.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RETURN json_build_object('success',false,'error','invalid_quantity','message','Quantidade inválida.');
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

    INSERT INTO room_charges (counter_tab_id, product_id, quantity, unit_price, staff_note, from_frigobar)
    VALUES (p_tab_id, v_product.id, v_qty, v_product.price, 'PDV', false);

    v_total := v_total + v_qty * v_product.price;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success',true,'total',v_total,'items',v_count,'counter_tab_id',p_tab_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;
