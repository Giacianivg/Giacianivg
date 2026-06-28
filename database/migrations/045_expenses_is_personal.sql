-- ============================================================================
-- 045_expenses_is_personal.sql — Marcador particular/negócio em despesas
-- ============================================================================
-- Fase 2 das Compras (foto de cupom simples — Caso A): um cupom de feira/padaria
-- pode ser um gasto PESSOAL do Founder, não do negócio. Este marcador permite
-- registrar a despesa (histórico) mas mantê-la FORA dos totais/KPIs do negócio.
--
-- is_personal = true  → gasto particular: fica registrado, mas não conta no
--                       summary/breakdown do negócio (os totais filtram).
-- is_personal = false → despesa normal do negócio (default; nada muda nas
--                       despesas já existentes).
--
-- Vale para qualquer despesa (manual ou vinda de foto), não só a foto.
-- Aditivo. NUNCA alterar migrations 001–044.
-- ============================================================================

BEGIN;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN expenses.is_personal IS
  'true = gasto pessoal (cupom particular): fica FORA dos totais/KPIs do negócio. Default false.';

-- Índice parcial: acelera o filtro padrão "só despesas do negócio" por mês.
CREATE INDEX IF NOT EXISTS idx_expenses_business
  ON expenses(expense_date DESC) WHERE is_test = false AND is_personal = false;

COMMIT;
