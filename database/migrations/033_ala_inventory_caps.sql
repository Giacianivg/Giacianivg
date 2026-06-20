-- ============================================================================
-- 033_ala_inventory_caps.sql — DEC-023 / F1: teto de venda por ala/data
-- ============================================================================
-- Permite definir QUANTOS quartos de uma ala (A/B/C) ficam disponíveis num
-- período, sem escolher quartos físicos. Camada fina e aditiva ACIMA do
-- inventário físico (A1–C5, migration 021). Tabela esparsa: só guarda exceções.
--   ausência de linha = ala cheia (default)
--   available_count = 0 = fechar tudo
--   available_count = total da ala (8/7/5) = abrir tudo
--
-- Regra de venda (DEC-023): vender = max(0, cap − reservados_físicos_na_ala).
-- O teto NUNCA derruba reserva confirmada; só limita venda nova.
--
-- Espelha o padrão de room_price_overrides (migration 031).
-- NUNCA alterar migrations 001–032 existentes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ala_inventory_caps (
  ala             text NOT NULL CHECK (ala IN ('A','B','C')),
  date            date NOT NULL,
  available_count integer NOT NULL CHECK (available_count >= 0),  -- teto de venda da ala/dia
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ala, date)                                         -- 1 teto por ala/data
);

CREATE INDEX IF NOT EXISTS idx_aic_date ON public.ala_inventory_caps(date);

COMMENT ON TABLE public.ala_inventory_caps IS
  'Teto de venda por ala/data (DEC-023). Esparsa: ausência de linha = ala cheia. 0 = fechado.';
COMMENT ON COLUMN public.ala_inventory_caps.available_count IS
  'Quantos quartos da ala podem ser vendidos na data. vender = max(0, este_valor − reservados).';

-- updated_at automático (mesma função das demais tabelas)
DROP TRIGGER IF EXISTS trg_aic_updated ON public.ala_inventory_caps;
CREATE TRIGGER trg_aic_updated BEFORE UPDATE ON public.ala_inventory_caps
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS (mesmo padrão manager_* das demais tabelas)
ALTER TABLE public.ala_inventory_caps ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY manager_ala_inventory_caps ON public.ala_inventory_caps
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- View vw_ala_sellable: entrega cap, reservados e sellable já calculados.
-- Conta SOMENTE quartos físicos (A1–C5) reservados — caminho CRM ativo.
-- O caminho legado por ala (ALA_A/ALA_B/ALA_C_*, usado pela Luna inativa) NÃO
-- é contado aqui: será incorporado na F6 (gated) quando a Luna religar.
-- Retorna linhas apenas para (ala, date) com teto definido OU com reserva —
-- datas sem nenhum dos dois são "ala cheia" (default) e o consumidor preenche.
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_ala_sellable AS
WITH totals AS (
  SELECT left(code, 1) AS ala, count(*)::int AS total_rooms
  FROM public.rooms
  WHERE active
  GROUP BY left(code, 1)
),
res AS (
  SELECT left(a.room_type, 1) AS ala, a.date, count(*)::int AS reserved_count
  FROM public.availability a
  JOIN public.rooms r ON r.code = a.room_type AND r.active
  WHERE a.status = 'reserved'
  GROUP BY left(a.room_type, 1), a.date
),
keys AS (
  SELECT ala, date FROM public.ala_inventory_caps
  UNION
  SELECT ala, date FROM res
)
SELECT
  k.ala,
  k.date,
  t.total_rooms,
  COALESCE(c.available_count, t.total_rooms)                                              AS cap,
  COALESCE(r.reserved_count, 0)                                                           AS reserved,
  GREATEST(0, COALESCE(c.available_count, t.total_rooms) - COALESCE(r.reserved_count, 0)) AS sellable,
  (c.ala IS NOT NULL)                                                                     AS has_cap,
  c.note
FROM keys k
JOIN      totals t                  ON t.ala = k.ala
LEFT JOIN public.ala_inventory_caps c ON c.ala = k.ala AND c.date = k.date
LEFT JOIN res r                     ON r.ala = k.ala AND r.date = k.date;

COMMENT ON VIEW public.vw_ala_sellable IS
  'DEC-023: cap/reservados/sellable por ala/data. Conta só quartos físicos (CRM). Legado-ala (Luna) na F6.';
