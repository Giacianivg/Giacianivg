-- ============================================================================
-- 018_special_periods_packages.sql — Fase 1 / Etapa A (config-driven)
-- ============================================================================
-- Aplicada em produção (nqxesjxbqupmhnivkfyk) em 2026-06-10 via MCP
-- (migration remota: special_periods_packages).
--
-- Move para o banco o que hoje está hardcoded em services/quotation/engine.js
-- (FERIADO_RANGES e PASCOA_PACKAGE) e adiciona chaves de branding/pricing em
-- settings. O engine passa a ler daqui na Etapa B da Fase 1.
-- Seeds idempotentes — valores idênticos aos hardcoded.
-- ============================================================================

-- ─── special_periods — feriados/eventos com mínimo de noites ────────────────
-- Matching por mês-dia (MM-DD), recorrente anualmente (espelha o engine atual).
CREATE TABLE IF NOT EXISTS public.special_periods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  start_md   char(5) NOT NULL CHECK (start_md ~ '^\d{2}-\d{2}$'),
  end_md     char(5) NOT NULL CHECK (end_md ~ '^\d{2}-\d{2}$'),
  min_nights smallint NOT NULL DEFAULT 2 CHECK (min_nights >= 1),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.special_periods IS 'Feriados/eventos com preço de feriado e mínimo de noites. start_md/end_md em MM-DD (recorrente). Fonte original: FERIADO_RANGES em engine.js.';

-- ─── packages — pacotes promocionais com preço fechado ──────────────────────
CREATE TABLE IF NOT EXISTS public.packages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  nights      smallint NOT NULL CHECK (nights >= 1),
  max_guests  smallint NOT NULL DEFAULT 2 CHECK (max_guests >= 1),
  price       numeric(10,2) NOT NULL CHECK (price > 0),
  includes    text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT packages_dates_check CHECK (end_date > start_date)
);

COMMENT ON TABLE public.packages IS 'Pacotes promocionais com preço fechado (datas absolutas). Fonte original: PASCOA_PACKAGE em engine.js.';

-- ─── Triggers updated_at (reusa touch_updated_at existente) ─────────────────
DROP TRIGGER IF EXISTS trg_special_periods_updated ON public.special_periods;
CREATE TRIGGER trg_special_periods_updated BEFORE UPDATE ON public.special_periods FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_packages_updated ON public.packages;
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── RLS (mesmo padrão manager_* das demais tabelas) ────────────────────────
ALTER TABLE public.special_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY manager_special_periods ON public.special_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_packages ON public.packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Seed: FERIADO_RANGES (valores idênticos ao engine.js) ──────────────────
INSERT INTO public.special_periods (label, start_md, end_md, min_nights, active)
SELECT * FROM (VALUES
  ('Carnaval 2026',            '02-13', '02-18', 2, true),
  ('Semana Santa/Páscoa 2026', '03-28', '04-06', 2, true),
  ('EBAA/Corpus Christi 2026', '06-04', '06-07', 2, true),
  ('Independência 2026',       '09-05', '09-07', 2, true),
  ('Aparecida 2026',           '10-10', '10-12', 2, true),
  ('Consciência Negra 2026',   '11-20', '11-22', 2, true),
  ('Natal/Réveillon',          '12-24', '01-02', 2, true)
) AS v(label, start_md, end_md, min_nights, active)
WHERE NOT EXISTS (SELECT 1 FROM public.special_periods);

-- ─── Seed: Pacote Páscoa (valores idênticos a PASCOA_PACKAGE) ───────────────
INSERT INTO public.packages (name, description, start_date, end_date, nights, max_guests, price, includes, active)
SELECT 'Escapada Romântica Páscoa', '2 noites + café da manhã para 2 pessoas',
       '2026-03-28', '2026-04-06', 2, 2, 900.00, 'Café da manhã incluso', true
WHERE NOT EXISTS (SELECT 1 FROM public.packages WHERE name = 'Escapada Romântica Páscoa');

-- ─── Seed: settings de branding e pricing (para Etapa A/B) ──────────────────
-- Valores idênticos aos hardcoded hoje em templates.js, voucher-generator.js e engine.js
INSERT INTO public.settings (key, value, value_type, description) VALUES
  ('inn_short_name',        'Luz da Lua',                       'string', 'Nome curto da pousada (templates)'),
  ('city',                  'Socorro-SP',                       'string', 'Cidade exibida em mensagens e voucher'),
  ('tagline',               'Natureza e Aconchego',             'string', 'Tagline do voucher PDF'),
  ('region_label',          'Circuito das Águas Paulista',      'string', 'Região exibida na cotação WhatsApp'),
  ('site_url',              'pousadaluzdaluasp.com.br',         'string', 'Site exibido no rodapé do voucher'),
  ('public_phone',          '(19) 99840-0306',                  'string', 'Telefone público exibido no voucher'),
  ('alta_base_price',       '400',                              'number', 'Alta/feriado: preço base até 2 pax (engine)'),
  ('alta_extra_per_person', '150',                              'number', 'Alta/feriado: adicional por pax acima de 2 (engine)'),
  ('discount_7plus_pct',    '10',                               'number', 'Desconto %: 7+ noites (engine)'),
  ('discount_14plus_pct',   '15',                               'number', 'Desconto %: 14+ noites (engine)'),
  ('pet_fee_per_day',       '20',                               'number', 'Taxa pet R$/dia (mensagem de cotação)')
ON CONFLICT (key) DO NOTHING;
