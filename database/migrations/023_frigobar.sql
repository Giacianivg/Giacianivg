-- ============================================================
-- Migration 023: Frigobar físico por quarto
-- ============================================================
-- frigobar_items        → o que está carregado em cada frigobar
-- rooms.frigobar_status → ok | manutencao | sem_frigobar
-- room_charges.from_frigobar → consumo vindo do frigobar baixa o
--   frigobar do quarto (o estoque central já foi debitado no load)
-- Funções atômicas: frigobar_load (central → frigobar, valida
--   estoque), frigobar_unload (frigobar → central)
-- ============================================================

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frigobar_status TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_frigobar_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_frigobar_status_check
  CHECK (frigobar_status IN ('ok','manutencao','sem_frigobar'));

CREATE TABLE IF NOT EXISTS frigobar_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code  VARCHAR(20) NOT NULL REFERENCES rooms(code) ON UPDATE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  loaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_code, product_id)
);

CREATE INDEX IF NOT EXISTS idx_frigobar_room ON frigobar_items(room_code);

ALTER TABLE frigobar_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS frigobar_items_read_auth ON frigobar_items;
CREATE POLICY frigobar_items_read_auth ON frigobar_items FOR SELECT TO authenticated USING (true);

ALTER TABLE room_charges ADD COLUMN IF NOT EXISTS from_frigobar BOOLEAN NOT NULL DEFAULT false;

-- Trigger de estoque: consumo do frigobar baixa o frigobar do quarto;
-- consumo direto (bar/mercearia) baixa o estoque central.
CREATE OR REPLACE FUNCTION fn_charge_stock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.from_frigobar AND NEW.room_code IS NOT NULL THEN
      UPDATE frigobar_items SET quantity = quantity - NEW.quantity
      WHERE room_code = NEW.room_code AND product_id = NEW.product_id;
    ELSE
      UPDATE products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = NOW()
      WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.from_frigobar AND OLD.room_code IS NOT NULL THEN
      INSERT INTO frigobar_items (room_code, product_id, quantity)
      VALUES (OLD.room_code, OLD.product_id, OLD.quantity)
      ON CONFLICT (room_code, product_id)
      DO UPDATE SET quantity = frigobar_items.quantity + EXCLUDED.quantity;
    ELSE
      UPDATE products SET stock_quantity = stock_quantity + OLD.quantity, updated_at = NOW()
      WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Abastecer: estoque central → frigobar do quarto (valida saldo)
CREATE OR REPLACE FUNCTION frigobar_load(p_room VARCHAR, p_product UUID, p_qty NUMERIC)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_stock NUMERIC;
  v_name  TEXT;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN json_build_object('success',false,'error','invalid_quantity','message','Quantidade deve ser maior que zero.');
  END IF;

  SELECT stock_quantity, name INTO v_stock, v_name FROM products WHERE id = p_product FOR UPDATE;
  IF v_name IS NULL THEN
    RETURN json_build_object('success',false,'error','not_found','message','Produto não encontrado.');
  END IF;
  IF v_stock < p_qty THEN
    RETURN json_build_object('success',false,'error','insufficient_stock',
      'message', v_name || ': estoque central tem ' || v_stock || ', pedido ' || p_qty || '. Registre entrada no Mapa → Mercearia/Bar.');
  END IF;

  UPDATE products SET stock_quantity = stock_quantity - p_qty, updated_at = NOW() WHERE id = p_product;
  INSERT INTO frigobar_items (room_code, product_id, quantity)
  VALUES (p_room, p_product, p_qty)
  ON CONFLICT (room_code, product_id)
  DO UPDATE SET quantity = frigobar_items.quantity + EXCLUDED.quantity, loaded_at = NOW();

  RETURN json_build_object('success',true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;

-- Devolver: frigobar do quarto → estoque central (valida saldo do frigobar)
CREATE OR REPLACE FUNCTION frigobar_unload(p_room VARCHAR, p_product UUID, p_qty NUMERIC)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_qty NUMERIC;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN json_build_object('success',false,'error','invalid_quantity','message','Quantidade deve ser maior que zero.');
  END IF;

  SELECT quantity INTO v_qty FROM frigobar_items
  WHERE room_code = p_room AND product_id = p_product FOR UPDATE;
  IF v_qty IS NULL OR v_qty < p_qty THEN
    RETURN json_build_object('success',false,'error','insufficient_frigobar',
      'message','Frigobar tem ' || COALESCE(v_qty,0) || ' deste item, pedido ' || p_qty || '.');
  END IF;

  UPDATE frigobar_items SET quantity = quantity - p_qty
  WHERE room_code = p_room AND product_id = p_product;
  DELETE FROM frigobar_items WHERE room_code = p_room AND product_id = p_product AND quantity = 0;
  UPDATE products SET stock_quantity = stock_quantity + p_qty, updated_at = NOW() WHERE id = p_product;

  RETURN json_build_object('success',true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;
