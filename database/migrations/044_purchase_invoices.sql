-- ============================================================================
-- 044_purchase_invoices.sql — Compras: notas de NF-e COM itens classificáveis
-- ============================================================================
-- A Camada 0 (migration 043) importava o XML no navegador e criava só UMA
-- despesa (o total da nota), sem os produtos. Esta migration guarda a NOTA e
-- seus ITENS, com parsing canônico no servidor — e cada item é CLASSIFICÁVEL.
--
-- Modelo:
--   • purchase_invoices       — cabeçalho (fornecedor, nº, data) + dois totais:
--       - total_amount    = vNF do XML (FISCAL, intacto, referência/auditoria)
--       - business_amount = parte da pousada (vai pro financeiro)
--   • purchase_invoice_items  — produtos; cada um com item_class (4 classes).
--   • expenses.invoice_id     — liga a despesa do negócio à nota (nullable).
--   • item_classification_memory — aprende a classe por descrição normalizada.
--
-- Classificação por item (item_class):
--   pousada_estoque      → custo SIM, estoque SIM  (PADRÃO)
--   pousada_nao_estoque  → custo SIM, estoque NÃO
--   ativo_imobilizado    → custo SIM, estoque NÃO  (só rótulo; ZERO lógica
--                          patrimonial agora — campo pronto p/ módulo futuro)
--   particular           → custo NÃO, estoque NÃO  (fora dos números do negócio)
--
-- business_amount (Opção B, aprovada pelo Founder):
--   business = vNF − Σ(total_price dos itens 'particular'), com piso 0.
--   Se NENHUM item é da pousada (todos particulares) → business = 0 (o frete de
--   uma compra 100% pessoal também é pessoal). A despesa só existe se business>0.
--
-- Ganchos das próximas camadas (sem retrabalho):
--   • Camada 2 (custo por categoria): category_id + ncm nos itens.
--   • Camada 3 (estoque): só itens 'pousada_estoque' viram estoque.
--   • Patrimônio (futuro): itens 'ativo_imobilizado' já isolados.
--
-- Aditivo e isolado. NUNCA alterar migrations 001–043.
-- ============================================================================

BEGIN;

-- =============================================================================
-- 1. Cabeçalho da nota de compra
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_key         TEXT          NOT NULL UNIQUE,            -- chNFe (44 díg.) — dedup
  supplier_name   TEXT,                                     -- emit/xNome
  supplier_cnpj   TEXT,                                     -- emit/CNPJ
  invoice_number  TEXT,                                     -- ide/nNF
  issue_date      DATE,                                     -- ide/dhEmi (só a data)
  total_amount    NUMERIC(12,2) NOT NULL CHECK (total_amount > 0), -- ICMSTot/vNF (FISCAL)
  business_amount NUMERIC(12,2) NOT NULL DEFAULT 0,         -- parte da pousada (financeiro)
  category_id     UUID          REFERENCES expense_categories(id) ON DELETE SET NULL,
  payment_method  TEXT          NOT NULL DEFAULT 'boleto'
                  CHECK (payment_method IN ('pix','dinheiro','cartao','transferencia','boleto')),
  is_test         BOOLEAN       NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchase_invoices IS
  'Cabeçalho da nota de compra (NF-e/NFC-e). total_amount = vNF fiscal intacto; '
  'business_amount = parte da pousada que vai pro financeiro. nfe_key UNIQUE = dedup.';
COMMENT ON COLUMN purchase_invoices.business_amount IS
  'vNF menos os itens particulares (piso 0). 0 quando a nota é 100% particular.';

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_real
  ON purchase_invoices(issue_date DESC) WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_category
  ON purchase_invoices(category_id);

-- =============================================================================
-- 2. Itens da nota (produtos) — com classificação
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID          NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_code TEXT,                                       -- prod/cProd
  description TEXT          NOT NULL,                       -- prod/xProd
  ncm         TEXT,                                         -- prod/NCM  (gancho Camada 2)
  cfop        TEXT,                                         -- prod/CFOP
  quantity    NUMERIC(14,4),                                -- prod/qCom
  unit        TEXT,                                         -- prod/uCom
  unit_price  NUMERIC(14,6),                                -- prod/vUnCom
  total_price NUMERIC(12,2),                                -- prod/vProd
  item_class  TEXT          NOT NULL DEFAULT 'pousada_estoque'
              CHECK (item_class IN ('pousada_estoque','pousada_nao_estoque','particular','ativo_imobilizado')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchase_invoice_items IS
  'Produtos de cada nota. item_class decide se entra no custo/estoque do negócio.';
COMMENT ON COLUMN purchase_invoice_items.item_class IS
  'pousada_estoque (custo+estoque) | pousada_nao_estoque (custo) | '
  'ativo_imobilizado (custo; só rótulo, sem lógica patrimonial) | particular (fora).';

CREATE INDEX IF NOT EXISTS idx_pii_invoice ON purchase_invoice_items(invoice_id);

-- =============================================================================
-- 3. Liga a despesa do negócio à nota (a despesa continua a linha do financeiro)
-- =============================================================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_id UUID
  REFERENCES purchase_invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN expenses.invoice_id IS
  'Nota de compra de origem (purchase_invoices). NULL em despesa manual.';

CREATE INDEX IF NOT EXISTS idx_expenses_invoice ON expenses(invoice_id);

-- =============================================================================
-- 4. Memória de classificação — aprende a classe por descrição normalizada
--    (o match_key normalizado é calculado no Node e enviado às RPCs, para que a
--     normalização viva numa fonte só e a consulta do preview sempre case.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS item_classification_memory (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_key    TEXT        NOT NULL UNIQUE,                 -- descrição normalizada
  item_class   TEXT        NOT NULL
               CHECK (item_class IN ('pousada_estoque','pousada_nao_estoque','particular','ativo_imobilizado')),
  times_seen   INTEGER     NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE item_classification_memory IS
  'Lembra a última classe escolhida por produto (descrição normalizada). '
  'Sugere — não força — na próxima importação.';

-- =============================================================================
-- 5. RLS — acesso só via service role (supabaseAdmin), como o resto do CRM.
-- =============================================================================
ALTER TABLE purchase_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_classification_memory ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. recalc_invoice_business(invoice_id) — FONTE DE VERDADE do business_amount.
--    Recalcula business e sincroniza a despesa do negócio (cria/atualiza/remove).
--    Chamada na importação e em toda reclassificação.
-- =============================================================================
CREATE OR REPLACE FUNCTION recalc_invoice_business(p_invoice_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  v_inv        purchase_invoices%ROWTYPE;
  v_part_sum   NUMERIC(12,2);
  v_nonpart    INTEGER;
  v_business   NUMERIC(12,2);
  v_expense_id UUID;
  v_desc       TEXT;
BEGIN
  SELECT * INTO v_inv FROM purchase_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COUNT(*) FILTER (WHERE item_class <> 'particular'),
         COALESCE(SUM(total_price) FILTER (WHERE item_class = 'particular'), 0)
    INTO v_nonpart, v_part_sum
    FROM purchase_invoice_items WHERE invoice_id = p_invoice_id;

  -- Opção B: vNF − Σ(particulares), piso 0. 100% particular → 0.
  IF v_nonpart = 0 THEN
    v_business := 0;
  ELSE
    v_business := GREATEST(0, ROUND(v_inv.total_amount - v_part_sum, 2));
  END IF;

  UPDATE purchase_invoices SET business_amount = v_business, updated_at = NOW()
    WHERE id = p_invoice_id;

  -- Descrição da despesa, derivada da nota.
  v_desc := NULLIF(trim(
    CASE WHEN COALESCE(v_inv.invoice_number,'') <> '' THEN 'NF ' || v_inv.invoice_number ELSE '' END
    || CASE WHEN COALESCE(v_inv.supplier_name,'') <> ''
            THEN (CASE WHEN COALESCE(v_inv.invoice_number,'') <> '' THEN ' — ' ELSE '' END) || v_inv.supplier_name
            ELSE '' END
  ), '');

  SELECT id INTO v_expense_id FROM expenses WHERE invoice_id = p_invoice_id LIMIT 1;

  IF v_business > 0 THEN
    IF v_expense_id IS NOT NULL THEN
      UPDATE expenses
         SET amount = v_business, category_id = v_inv.category_id,
             payment_method = v_inv.payment_method, description = v_desc,
             expense_date = COALESCE(v_inv.issue_date, CURRENT_DATE),
             is_test = v_inv.is_test, updated_at = NOW()
       WHERE id = v_expense_id;
    ELSE
      INSERT INTO expenses (amount, category_id, description, payment_method,
                            expense_date, is_test, nfe_key, invoice_id)
      VALUES (v_business, v_inv.category_id, v_desc, v_inv.payment_method,
              COALESCE(v_inv.issue_date, CURRENT_DATE), v_inv.is_test,
              v_inv.nfe_key, p_invoice_id);
    END IF;
  ELSE
    -- business = 0: não deve existir despesa do negócio para esta nota.
    IF v_expense_id IS NOT NULL THEN
      DELETE FROM expenses WHERE id = v_expense_id;
    END IF;
  END IF;

  RETURN v_business;
END;
$$;

-- =============================================================================
-- 7. import_nfe_invoice(payload jsonb) — importa nota + itens + despesa ATÔMICO.
--    payload: { nfe_key, supplier_name, supplier_cnpj, invoice_number, issue_date,
--               total_amount, category_id, payment_method, is_test,
--               items: [ { ...campos, item_class, match_key } ] }
--    sucesso  → { success:true, invoice_id, expense_id (nullable), items_count, business_amount }
--    repetida → { success:false, error:'duplicate_nfe' }
-- =============================================================================
CREATE OR REPLACE FUNCTION import_nfe_invoice(payload JSONB)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_nfe_key     TEXT;
  v_invoice_id  UUID;
  v_items_count INTEGER;
  v_business    NUMERIC(12,2);
  v_is_test     BOOLEAN;
  v_payment     TEXT;
  v_category_id UUID;
  v_total       NUMERIC(12,2);
  v_issue       DATE;
  v_expense_id  UUID;
BEGIN
  v_nfe_key := NULLIF(regexp_replace(COALESCE(payload->>'nfe_key',''), '\D', '', 'g'), '');
  IF v_nfe_key IS NULL OR length(v_nfe_key) <> 44 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_nfe_key',
      'message', 'Chave da NF-e ausente ou inválida (precisa de 44 dígitos).');
  END IF;

  IF EXISTS (SELECT 1 FROM purchase_invoices WHERE nfe_key = v_nfe_key) THEN
    RETURN json_build_object('success', false, 'error', 'duplicate_nfe',
      'message', 'Esta nota já foi importada.');
  END IF;

  v_is_test     := COALESCE((payload->>'is_test')::BOOLEAN, false);
  v_category_id := NULLIF(payload->>'category_id', '')::UUID;
  v_total       := (payload->>'total_amount')::NUMERIC;
  v_issue       := NULLIF(payload->>'issue_date', '')::DATE;
  v_payment     := COALESCE(NULLIF(payload->>'payment_method',''), 'boleto');

  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_total',
      'message', 'Valor total da nota ausente ou inválido.');
  END IF;

  INSERT INTO purchase_invoices (
    nfe_key, supplier_name, supplier_cnpj, invoice_number, issue_date,
    total_amount, business_amount, category_id, payment_method, is_test
  ) VALUES (
    v_nfe_key, NULLIF(payload->>'supplier_name',''), NULLIF(payload->>'supplier_cnpj',''),
    NULLIF(payload->>'invoice_number',''), v_issue,
    v_total, 0, v_category_id, v_payment, v_is_test
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO purchase_invoice_items (
    invoice_id, product_code, description, ncm, cfop,
    quantity, unit, unit_price, total_price, item_class
  )
  SELECT
    v_invoice_id,
    NULLIF(it->>'product_code',''),
    COALESCE(NULLIF(it->>'description',''), 'Item sem descrição'),
    NULLIF(it->>'ncm',''),
    NULLIF(it->>'cfop',''),
    NULLIF(it->>'quantity','')::NUMERIC,
    NULLIF(it->>'unit',''),
    NULLIF(it->>'unit_price','')::NUMERIC,
    NULLIF(it->>'total_price','')::NUMERIC,
    CASE WHEN it->>'item_class' IN ('pousada_estoque','pousada_nao_estoque','particular','ativo_imobilizado')
         THEN it->>'item_class' ELSE 'pousada_estoque' END
  FROM jsonb_array_elements(COALESCE(payload->'items', '[]'::jsonb)) AS it;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  -- Memória: aprende a classe por match_key (deduplicado p/ não bater 2x no upsert).
  INSERT INTO item_classification_memory (match_key, item_class, times_seen, last_seen_at)
  SELECT mk, cls, 1, NOW() FROM (
    SELECT DISTINCT ON (it->>'match_key')
      it->>'match_key' AS mk,
      CASE WHEN it->>'item_class' IN ('pousada_estoque','pousada_nao_estoque','particular','ativo_imobilizado')
           THEN it->>'item_class' ELSE 'pousada_estoque' END AS cls
    FROM jsonb_array_elements(COALESCE(payload->'items','[]'::jsonb)) WITH ORDINALITY AS t(it, ord)
    WHERE COALESCE(it->>'match_key','') <> ''
    ORDER BY it->>'match_key', ord DESC
  ) d
  ON CONFLICT (match_key) DO UPDATE
    SET item_class   = EXCLUDED.item_class,
        times_seen   = item_classification_memory.times_seen + 1,
        last_seen_at = NOW();

  v_business := recalc_invoice_business(v_invoice_id);
  SELECT id INTO v_expense_id FROM expenses WHERE invoice_id = v_invoice_id LIMIT 1;

  RETURN json_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'expense_id', v_expense_id,
    'items_count', v_items_count,
    'business_amount', v_business
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'duplicate_nfe',
      'message', 'Esta nota já foi importada.');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'internal_error',
      'message', SQLERRM);
END;
$$;

-- =============================================================================
-- 8. reclassify_invoice_item(item_id, class, match_key) — muda a classe de um
--    item, recalcula o business (e a despesa) e atualiza a memória. Atômico.
-- =============================================================================
CREATE OR REPLACE FUNCTION reclassify_invoice_item(p_item_id UUID, p_class TEXT, p_match_key TEXT)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_inv        UUID;
  v_business   NUMERIC(12,2);
  v_expense_id UUID;
BEGIN
  IF p_class NOT IN ('pousada_estoque','pousada_nao_estoque','particular','ativo_imobilizado') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_class', 'message', 'Classe inválida.');
  END IF;

  SELECT invoice_id INTO v_inv FROM purchase_invoice_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found', 'message', 'Item não encontrado.');
  END IF;

  UPDATE purchase_invoice_items SET item_class = p_class WHERE id = p_item_id;

  v_business := recalc_invoice_business(v_inv);

  IF COALESCE(p_match_key,'') <> '' THEN
    INSERT INTO item_classification_memory (match_key, item_class, times_seen, last_seen_at)
    VALUES (p_match_key, p_class, 1, NOW())
    ON CONFLICT (match_key) DO UPDATE
      SET item_class   = EXCLUDED.item_class,
          times_seen   = item_classification_memory.times_seen + 1,
          last_seen_at = NOW();
  END IF;

  SELECT id INTO v_expense_id FROM expenses WHERE invoice_id = v_inv LIMIT 1;

  RETURN json_build_object(
    'success', true,
    'invoice_id', v_inv,
    'business_amount', v_business,
    'expense_id', v_expense_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'internal_error', 'message', SQLERRM);
END;
$$;

COMMIT;
