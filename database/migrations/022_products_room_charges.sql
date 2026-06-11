-- ============================================================
-- Migration 022: Comanda de hóspede — produtos, consumos e estoque
-- ============================================================
-- products      → catálogo (frigobar/bar/mercearia/extra) com estoque
-- room_charges  → consumos lançados na comanda de uma reserva
-- stock_entries → entradas de compra (reposição de estoque)
-- Triggers mantêm products.stock_quantity consistente:
--   room_charges INSERT  → baixa estoque
--   room_charges DELETE  → estorna estoque
--   stock_entries INSERT → repõe estoque
-- ============================================================

-- ── products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'frigobar'
                 CHECK (category IN ('frigobar','bar','mercearia','extra')),
  price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  cost_price     NUMERIC(10,2) DEFAULT 0 CHECK (cost_price >= 0),
  unit           TEXT NOT NULL DEFAULT 'un',
  stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock      NUMERIC(10,2) NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE active;

-- ── room_charges ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_charges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  room_code      VARCHAR(20),
  product_id     UUID NOT NULL REFERENCES products(id),
  quantity       NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total          NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  charged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staff_note     TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_charges_reservation ON room_charges(reservation_id);
CREATE INDEX IF NOT EXISTS idx_room_charges_charged_at  ON room_charges(charged_at);

-- ── stock_entries ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_cost  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  note       TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_entries_product ON stock_entries(product_id);

-- ── Triggers de estoque ──────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_charge_stock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products SET stock_quantity = stock_quantity + OLD.quantity, updated_at = NOW()
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_charge_stock ON room_charges;
CREATE TRIGGER trg_charge_stock
  AFTER INSERT OR DELETE ON room_charges
  FOR EACH ROW EXECUTE FUNCTION fn_charge_stock();

CREATE OR REPLACE FUNCTION fn_stock_entry() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products SET stock_quantity = stock_quantity + NEW.quantity, updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_entry ON stock_entries;
CREATE TRIGGER trg_stock_entry
  AFTER INSERT ON stock_entries
  FOR EACH ROW EXECUTE FUNCTION fn_stock_entry();

-- ── RLS ──────────────────────────────────────────────────────
-- API usa service_role (bypassa RLS); authenticated pode ler.
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_charges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_read_auth      ON products;
DROP POLICY IF EXISTS room_charges_read_auth  ON room_charges;
DROP POLICY IF EXISTS stock_entries_read_auth ON stock_entries;

CREATE POLICY products_read_auth      ON products      FOR SELECT TO authenticated USING (true);
CREATE POLICY room_charges_read_auth  ON room_charges  FOR SELECT TO authenticated USING (true);
CREATE POLICY stock_entries_read_auth ON stock_entries FOR SELECT TO authenticated USING (true);

-- ── Seeds ────────────────────────────────────────────────────
INSERT INTO products (name, category, price, unit, stock_quantity, min_stock) VALUES
  ('Água mineral 500ml', 'frigobar',  5.00, 'un', 0, 10),
  ('Cerveja',            'frigobar',  8.00, 'un', 0, 12),
  ('Refrigerante',       'frigobar',  6.00, 'un', 0, 12),
  ('Suco',               'frigobar',  7.00, 'un', 0, 8),
  ('Vinho',              'bar',      35.00, 'gf', 0, 4),
  ('Salgadinho',         'frigobar',  5.00, 'un', 0, 10),
  ('Chocolate',          'frigobar',  6.00, 'un', 0, 10)
ON CONFLICT DO NOTHING;
