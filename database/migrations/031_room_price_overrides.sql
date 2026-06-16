-- ============================================================================
-- 031_room_price_overrides.sql — Bloco 4 / C′: preço absoluto por ala/data
-- ============================================================================
-- Preço absoluto (R$) travado manualmente pelo dono, por ala/data.
-- O calendário lê e exibe direto (sem tocar engine.js). A cotação da Luna
-- SÓ honrará estes overrides após edição futura do engine.js (gated em
-- pricing_mode='auto'), com OK explícito do Founder + teste de cotação
-- byte-idêntica — pendência registrada em docs/STATUS.md.
-- NUNCA alterar migrations 001–030 existentes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.room_price_overrides (
  room_type   text NOT NULL
    CHECK (room_type IN ('ALA_A','ALA_B','ALA_C_CASAL')),  -- mesmas alas cotáveis
  date        date NOT NULL,
  price       numeric(10,2) NOT NULL CHECK (price > 0),     -- R$ absoluto (ex.: 380.00)
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_type, date)                             -- 1 preço travado por ala/data
);

CREATE INDEX IF NOT EXISTS idx_rpo_date ON public.room_price_overrides(date);

COMMENT ON TABLE public.room_price_overrides IS
  'Preço absoluto (R$) travado manualmente por ala/data. Fonte do calendário; a Luna só honra após edição do engine.js (gated em auto).';

-- updated_at automático (mesma função das demais tabelas)
DROP TRIGGER IF EXISTS trg_rpo_updated ON public.room_price_overrides;
CREATE TRIGGER trg_rpo_updated BEFORE UPDATE ON public.room_price_overrides
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS (mesmo padrão manager_* das demais tabelas)
ALTER TABLE public.room_price_overrides ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY manager_room_price_overrides ON public.room_price_overrides
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
