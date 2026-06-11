-- ============================================================================
-- 019_dynamic_pricing.sql — Fase 1.5: Motor de Precificação Dinâmica
-- ============================================================================
-- Objetivo: ocupação de 70%/mês maximizando receita.
-- Multiplicador calculado por DATA (ritmo de vendas, antecedência, concorrência)
-- aplicado sobre o preço base da tabela rooms (fonte única).
--
-- pricing_mode inicia 'off': a Luna continua cotando como hoje até o Founder
-- aprovar a ativação pelo dashboard (Regra item 8 da spec).
-- NUNCA alterar migrations 001–018 existentes.
-- ============================================================================

-- ─── Settings do motor (editáveis pelo dashboard /pricing.html) ─────────────
INSERT INTO public.settings (key, value, value_type, description) VALUES
  ('price_floor',      '155', 'number', 'Piso de preço por noite (R$) — resultado do motor nunca fica abaixo'),
  ('price_ceiling',    '550', 'number', 'Teto de preço por noite (R$) — resultado do motor nunca fica acima'),
  ('target_occupancy', '70',  'number', 'Meta de ocupação mensal (%) que guia a curva de ritmo'),
  ('pricing_mode',     'off', 'string', 'off = Luna cota como hoje | auto = aplica multiplicador dinâmico')
ON CONFLICT (key) DO NOTHING;

-- ─── price_log — auditoria de cada cálculo do motor ─────────────────────────
CREATE TABLE IF NOT EXISTS public.price_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  room_code   text NOT NULL,
  base_price  numeric(10,2) NOT NULL,
  multiplier  numeric(6,4) NOT NULL,
  final_price numeric(10,2) NOT NULL,
  factors     jsonb NOT NULL DEFAULT '{}',
  source      text NOT NULL DEFAULT 'quote'
    CHECK (source IN ('quote', 'calendar', 'manual')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_log_date    ON public.price_log(date);
CREATE INDEX IF NOT EXISTS idx_price_log_created ON public.price_log(created_at);

COMMENT ON TABLE public.price_log IS
  'Auditoria do motor de precificação dinâmica: cada cálculo registra data, quarto, multiplicador e fatores (ritmo, antecedência, concorrência).';
COMMENT ON COLUMN public.price_log.source IS
  'quote = cotação da Luna | calendar = cálculo do calendário do dashboard | manual = override do dono';

-- ─── price_overrides — trava manual do dono por data ────────────────────────
-- Override do dono SEMPRE vence o algoritmo (item 6 da spec).
CREATE TABLE IF NOT EXISTS public.price_overrides (
  date       date PRIMARY KEY,
  multiplier numeric(6,4) NOT NULL CHECK (multiplier > 0 AND multiplier <= 3),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.price_overrides IS
  'Datas com preço travado manualmente pelo dono. Quando existe linha aqui, o motor usa este multiplicador e ignora os fatores automáticos.';

DROP TRIGGER IF EXISTS trg_price_overrides_updated ON public.price_overrides;
CREATE TRIGGER trg_price_overrides_updated BEFORE UPDATE ON public.price_overrides
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── RLS (mesmo padrão manager_* das demais tabelas) ────────────────────────
ALTER TABLE public.price_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY manager_price_log ON public.price_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_price_overrides ON public.price_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
