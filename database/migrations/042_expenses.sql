-- ============================================================================
-- 042_expenses.sql — Despesas manuais (saída) do módulo financeiro
-- ============================================================================
-- Hoje o módulo financeiro (routes/financial.js + public/financial.html) só
-- enxerga RECEITA (reservas + payments). Não existe nenhuma forma de registrar
-- DESPESA. Esta migration cria a fonte única de despesas — sem planilha paralela.
--
-- Escopo (Bloco — financeiro simples, sem IA):
--   • expense_categories: categorias editáveis (café da manhã, limpeza, etc.).
--   • expenses: lançamento rápido manual (valor, categoria, descrição, forma de
--     pagamento, data). is_test coerente com o Bloco 1 (higiene de dados).
--
-- NÃO faz parte deste bloco: foto de cupom/IA, leitura de PIX, áudio, XML de NF.
--
-- Aditivo e isolado. NUNCA alterar migrations 001–041.
-- ============================================================================

BEGIN;

-- =============================================================================
-- 1. Categorias de despesa (editáveis)
-- =============================================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  icon        TEXT,                                    -- emoji opcional para a UI
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expense_categories IS
  'Categorias de despesa, editáveis no CRM (financial.html). Fonte única.';

-- Seed inicial (aprovado pelo Founder). Editável depois pela UI.
INSERT INTO expense_categories (name, icon, sort_order) VALUES
  ('Café da manhã',  '🍳', 10),
  ('Limpeza',        '🧹', 20),
  ('Manutenção',     '🔧', 30),
  ('Jardinagem',     '🌿', 40),
  ('Lavanderia',     '🧺', 50),
  ('Contas (água/luz/gás/internet)', '💡', 60),
  ('Salários',       '👥', 70),
  ('Impostos',       '🧾', 80),
  ('Aluguel',        '🏠', 90),
  ('Outros',         '📦', 100)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 2. Despesas (lançamento manual rápido)
-- =============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id     UUID        REFERENCES expense_categories(id) ON DELETE SET NULL,
  description     TEXT,
  payment_method  TEXT        NOT NULL DEFAULT 'pix'
                  CHECK (payment_method IN ('pix','dinheiro','cartao','transferencia','boleto')),
  expense_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_test         BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expenses IS
  'Despesas manuais da pousada. Fonte única do "saída" no financeiro. '
  'is_test segue o Bloco 1 (higiene de dados): KPIs filtram is_test=false.';

-- Índice parcial: acelera o filtro padrão "só dados reais" por mês de despesa.
CREATE INDEX IF NOT EXISTS idx_expenses_real
  ON expenses(expense_date DESC) WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses(category_id);

-- =============================================================================
-- 3. RLS — acesso só via service role (supabaseAdmin), como o resto do CRM.
--    Sem policies: o anon key fica trancado; os endpoints /api/financial usam
--    supabaseAdmin (bypassa RLS), então a dashboard continua funcionando.
-- =============================================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;

COMMIT;
