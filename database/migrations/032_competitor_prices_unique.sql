-- ============================================================================
-- 032_competitor_prices_unique.sql — corrige UPSERT de preços de concorrente
-- ============================================================================
-- BUG: routes/competitor-prices.js (POST) usa
--      .upsert(..., { onConflict: 'competitor_name,date,room_type,source' })
-- mas a tabela competitor_prices só tinha UNIQUE na PK (id). Sem uma constraint
-- única cobrindo essas 4 colunas, o Postgres rejeita o ON CONFLICT com:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Esta migration cria a UNIQUE que falta, EXATAMENTE nas colunas que o código
-- já espera. Com ela, salvar o mesmo concorrente/data/tipo/fonte ATUALIZA o
-- preço (UPDATE) em vez de duplicar (INSERT).
--
-- Por que incluir `source` na chave: o scraper Apify (source='apify') grava por
-- delete+insert, e a entrada manual (source='manual') grava por upsert. Manter
-- `source` na chave evita que uma fonte sobrescreva a outra para a mesma
-- data/tipo — e mantém a migration alinhada ao onConflict já existente no código
-- (zero alteração de código necessária).
--
-- Índice único (não constraint) é suficiente como alvo de ON CONFLICT, é
-- idempotente (IF NOT EXISTS) e não conflita com o idx_cp_competitor_date
-- existente, que é não-único e permanece útil para leitura.
--
-- Tabela verificada vazia em produção (0 linhas) em 2026-06-16 — sem risco de
-- duplicatas pré-existentes bloquearem a criação do índice.
-- NUNCA alterar migrations 001–031 existentes.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_cp_competitor_date_room_source
  ON public.competitor_prices (competitor_name, date, room_type, source);

COMMENT ON INDEX public.uq_cp_competitor_date_room_source IS
  'Alvo do UPSERT (ON CONFLICT) de routes/competitor-prices.js: 1 preço por concorrente/data/tipo/fonte. Reinserir atualiza em vez de duplicar.';
