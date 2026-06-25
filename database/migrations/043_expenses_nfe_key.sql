-- ============================================================================
-- 043_expenses_nfe_key.sql — Chave da NF-e em despesas (anti-duplicata)
-- ============================================================================
-- Importação de XML de NF-e/NFC-e (mercadoria) preenche uma despesa a partir do
-- arquivo. Para não lançar a MESMA nota duas vezes, guardamos a chave de acesso
-- (chNFe, 44 dígitos) e a tornamos única.
--
-- Lançamento manual continua SEM chave (coluna nullable). O índice único é
-- PARCIAL (só quando nfe_key IS NOT NULL), então despesas manuais nunca colidem.
--
-- O parsing do XML é 100% no navegador (DOMParser nativo) — nenhum arquivo
-- trafega/armazena no servidor. Aqui só guardamos a chave para deduplicar.
--
-- Aditivo. NUNCA alterar migrations 001–042.
-- ============================================================================

BEGIN;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS nfe_key TEXT;

COMMENT ON COLUMN expenses.nfe_key IS
  'Chave de acesso da NF-e (44 dígitos), preenchida só em despesas importadas de '
  'XML. NULL em lançamento manual. Único parcial impede reimportar a mesma nota.';

-- Único parcial: bloqueia reimportar a mesma nota; ignora lançamentos manuais.
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_nfe_key
  ON expenses(nfe_key) WHERE nfe_key IS NOT NULL;

COMMIT;
