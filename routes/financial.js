'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, notFound, serverError } = require('../services/utils/response');
const {
  validateExpense,
  monthRange,
  buildCategoryBreakdown,
} = require('../services/financial/expense-helpers');
const { importInvoice } = require('../services/financial/invoice-import');
const { extractReceipt } = require('../services/financial/ocr');
const { suggestCategory } = require('../services/financial/category-suggester');
const {
  isValidClass,
  coerceClass,
  normalizeDesc,
  computeBusinessAmount,
  DEFAULT_ITEM_CLASS,
} = require('../services/financial/classification');

const router = Router();

const ACTIVE_STATUSES = ['pending', 'deposit_paid', 'confirmed', 'checked_in', 'checkedin', 'checkedout', 'completed'];

// ─── Helper: month key from ISO date string ───────────────────────────────────
function monthKey(isoDate) {
  return isoDate ? isoDate.slice(0, 7) : null; // "YYYY-MM"
}

// GET /api/financial/summary
// KPIs principais: receita confirmada, pendente, ticket médio, breakdown por quarto
router.get('/summary', async (req, res) => {
  try {
    // All non-cancelled reservations
    const { data: reservations, error: resErr } = await supabaseAdmin
      .from('reservations')
      .select('id, room_type, total_amount, deposit_amount, balance_amount, status, checkin_date, checkout_date, created_at')
      .eq('is_test', false)
      .in('status', ACTIVE_STATUSES);

    if (resErr) return serverError(res, resErr);

    // Confirmed payments (received cash)
    const { data: payments, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('amount, status, confirmed_at')
      .eq('is_test', false)
      .eq('status', 'confirmed');

    if (payErr) return serverError(res, payErr);

    const resos = reservations || [];
    const pays  = payments || [];

    // KPIs
    const total_reservas   = resos.length;
    const receita_total    = resos.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const depositos_pagos  = resos
      .filter(r => ['deposit_paid', 'confirmed', 'checked_in', 'completed'].includes(r.status))
      .reduce((s, r) => s + Number(r.deposit_amount || 0), 0);
    const saldo_pendente   = resos
      .filter(r => ['deposit_paid', 'confirmed'].includes(r.status))
      .reduce((s, r) => s + Number(r.balance_amount || 0), 0);
    const receita_confirmada = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
    const ticket_medio     = total_reservas > 0 ? receita_total / total_reservas : 0;

    // Reservas concluídas vs ativas
    const completadas  = resos.filter(r => r.status === 'completed').length;
    const em_andamento = resos.filter(r => ['confirmed', 'checked_in'].includes(r.status)).length;
    const pendentes    = resos.filter(r => r.status === 'pending').length;

    // Breakdown por quarto
    const por_quarto = {};
    for (const r of resos) {
      if (!por_quarto[r.room_type]) por_quarto[r.room_type] = { count: 0, total: 0 };
      por_quarto[r.room_type].count++;
      por_quarto[r.room_type].total += Number(r.total_amount || 0);
    }

    // Meses recentes (últimos 6) para mini-sparkline
    const por_mes = {};
    for (const r of resos) {
      const mk = monthKey(r.checkin_date);
      if (!mk) continue;
      if (!por_mes[mk]) por_mes[mk] = { count: 0, total: 0 };
      por_mes[mk].count++;
      por_mes[mk].total += Number(r.total_amount || 0);
    }

    const mes_keys = Object.keys(por_mes).sort().slice(-6);
    const recentes_por_mes = mes_keys.map(k => ({ month: k, ...por_mes[k] }));

    return ok(res, {
      kpis: {
        total_reservas,
        receita_total:       Math.round(receita_total * 100) / 100,
        depositos_pagos:     Math.round(depositos_pagos * 100) / 100,
        saldo_pendente:      Math.round(saldo_pendente * 100) / 100,
        receita_confirmada:  Math.round(receita_confirmada * 100) / 100,
        ticket_medio:        Math.round(ticket_medio * 100) / 100,
        completadas,
        em_andamento,
        pendentes,
      },
      por_quarto,
      recentes_por_mes,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/monthly?year=2026
// Receita mensal agrupada por mês de check-in
router.get('/monthly', async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const from = `${year}-01-01`;
    const to   = `${year}-12-31`;

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('total_amount, deposit_amount, status, checkin_date')
      .eq('is_test', false)
      .in('status', ACTIVE_STATUSES)
      .gte('checkin_date', from)
      .lte('checkin_date', to);

    if (error) return serverError(res, error);

    // Build 12-month array
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      months[key] = { month: key, count: 0, total_amount: 0, depositos: 0 };
    }

    for (const r of (data || [])) {
      const mk = monthKey(r.checkin_date);
      if (!mk || !months[mk]) continue;
      months[mk].count++;
      months[mk].total_amount += Number(r.total_amount || 0);
      if (['deposit_paid', 'confirmed', 'checked_in', 'completed'].includes(r.status)) {
        months[mk].depositos += Number(r.deposit_amount || 0);
      }
    }

    const result = Object.values(months).map(m => ({
      ...m,
      total_amount: Math.round(m.total_amount * 100) / 100,
      depositos:    Math.round(m.depositos    * 100) / 100,
    }));

    return ok(res, { year, months: result });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/recent?limit=20
// Últimas reservas com detalhe financeiro
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 20, 10), 50);

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        id, reservation_number, room_type, checkin_date, checkout_date,
        guests, total_amount, deposit_amount, balance_amount, status, created_at,
        leads(name, whatsapp_number)
      `)
      .eq('is_test', false)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return serverError(res, error);
    return ok(res, { reservations: data || [], count: (data || []).length });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DESPESAS (saída) — financeiro simples, sem IA. Fonte única, sem planilha paralela.
// ════════════════════════════════════════════════════════════════════════════

// GET /api/financial/categories?active=true
router.get('/categories', async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('expense_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (req.query.active !== undefined) {
      query = query.eq('is_active', req.query.active === 'true');
    }

    const { data, error } = await query;
    if (error) return serverError(res, error);
    return ok(res, { categories: data || [] });
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/financial/categories
router.post('/categories', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return fail(res, 'missing_fields', 'name é obrigatório');

    const { data, error } = await supabaseAdmin
      .from('expense_categories')
      .insert({
        name,
        icon: req.body.icon || null,
        sort_order: Number(req.body.sort_order) || 0,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return fail(res, 'duplicate', 'Categoria já existe', 409);
      return serverError(res, error);
    }
    return ok(res, { category: data }, 201);
  } catch (err) {
    return serverError(res, err);
  }
});

// PATCH /api/financial/categories/:id — renomear / ícone / ativar-desativar
router.patch('/categories/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined)       updates.name = String(req.body.name).trim();
    if (req.body.icon !== undefined)       updates.icon = req.body.icon;
    if (req.body.is_active !== undefined)  updates.is_active = !!req.body.is_active;
    if (req.body.sort_order !== undefined) updates.sort_order = Number(req.body.sort_order) || 0;

    if (!Object.keys(updates).length) return fail(res, 'no_fields', 'Nenhum campo válido para atualizar');
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('expense_categories')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return fail(res, 'duplicate', 'Categoria já existe', 409);
      return serverError(res, error);
    }
    if (!data) return notFound(res, 'Categoria');
    return ok(res, { category: data });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/expenses?month=YYYY-MM
router.get('/expenses', async (req, res) => {
  try {
    const { from, to, month } = monthRange(req.query.month);

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('id, amount, category_id, description, payment_method, expense_date, is_personal, created_at, expense_categories(name, icon)')
      .eq('is_test', false)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return serverError(res, error);

    // Lista mostra TODAS (com marcador); o total do negócio (summary) é quem
    // exclui as particulares.
    const expenses = (data || []).map(e => ({
      id: e.id,
      amount: Number(e.amount),
      category_id: e.category_id,
      category_name: e.expense_categories?.name || 'Sem categoria',
      category_icon: e.expense_categories?.icon || null,
      description: e.description,
      payment_method: e.payment_method,
      expense_date: e.expense_date,
      is_personal: e.is_personal === true,
      created_at: e.created_at,
    }));

    return ok(res, { month, expenses, count: expenses.length });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/expenses/summary?month=YYYY-MM — total + por categoria
router.get('/expenses/summary', async (req, res) => {
  try {
    const { from, to, month } = monthRange(req.query.month);

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('amount, category_id, expense_categories(name, icon)')
      .eq('is_test', false)
      .eq('is_personal', false) // totais do negócio não incluem gastos particulares
      .gte('expense_date', from)
      .lte('expense_date', to);

    if (error) return serverError(res, error);

    const rows = (data || []).map(e => ({
      amount: Number(e.amount),
      category_id: e.category_id,
      category_name: e.expense_categories?.name || 'Sem categoria',
    }));

    const breakdown = buildCategoryBreakdown(rows);
    return ok(res, { month, ...breakdown });
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/financial/expenses — lançamento rápido
router.post('/expenses', async (req, res) => {
  try {
    const { valid, errors, normalized } = validateExpense(req.body);
    if (!valid) return fail(res, 'validation', errors.join('; '));

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert(normalized)
      .select('id, amount, category_id, description, payment_method, expense_date, is_personal, created_at')
      .single();

    if (error) {
      if (error.code === '23503') return fail(res, 'invalid_category', 'Categoria inexistente');
      if (error.code === '23505') return fail(res, 'duplicate_nfe', 'Esta nota já foi lançada', 409);
      return serverError(res, error);
    }
    return ok(res, { expense: data }, 201);
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/financial/expenses/scan — lê a FOTO de um cupom simples (Claude visão)
// e devolve os campos extraídos para pré-preencher o modal. NÃO salva (sempre
// rascunho). Body: { image_base64, mime_type }.
router.post('/expenses/scan', async (req, res) => {
  try {
    const image = req.body && req.body.image_base64;
    if (!image || typeof image !== 'string') {
      return fail(res, 'missing_image', 'Envie a foto em "image_base64".');
    }

    const data = await extractReceipt(image, req.body.mime_type);

    // Falha de OCR NÃO é erro do sistema: devolve 200 com ocr_status 'failed' e
    // uma mensagem genérica. O frontend degrada para o lançamento manual.
    if (!data.ok) {
      return ok(res, { ocr_status: 'failed', reason: data.message });
    }

    const h = data.header;
    return ok(res, {
      ocr_status: 'ok',
      source: data.source,
      source_confidence: data.source_confidence,
      // Pré-preenchimento do modal de despesa:
      amount: h.total_amount,
      expense_date: h.issue_date,
      supplier_name: h.supplier_name,
      uncertain_fields: data.uncertain_fields,
      warnings: data.warnings,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// DELETE /api/financial/expenses/:id — corrigir lançamento errado
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error || !data) return notFound(res, 'Despesa');
    return ok(res, { deleted: data.id });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// COMPRAS — notas de NF-e COM itens (Camada 1). Parsing canônico no servidor.
// O XML chega como TEXTO no body JSON (sem upload de arquivo). A despesa continua
// sendo a linha do financeiro, agora ligada à nota por expenses.invoice_id.
// ════════════════════════════════════════════════════════════════════════════

// POST /api/financial/invoices/preview — parseia e devolve nota+itens+categoria
// sugerida. NÃO salva nada.
router.post('/invoices/preview', async (req, res) => {
  try {
    const { xml, pdf_base64 } = req.body || {};
    if (!xml && !pdf_base64) {
      return fail(res, 'missing_source', 'Envie um XML ou um PDF.');
    }

    // Adapter por fonte → InvoiceImportData. XML e PDF hoje; foto entra aqui depois.
    const data = await importInvoice({ xml, pdf_base64 });
    if (!data.ok) return fail(res, 'parse_error', data.error);

    // Nota já importada? Avisa cedo (dedup mora em purchase_invoices.nfe_key).
    const { data: existing } = await supabaseAdmin
      .from('purchase_invoices')
      .select('id')
      .eq('nfe_key', data.header.access_key)
      .maybeSingle();

    // Categoria sugerida a partir dos itens.
    const { data: categories } = await supabaseAdmin
      .from('expense_categories')
      .select('id, name')
      .eq('is_active', true);

    const suggestion = suggestCategory(data.items, categories || []);

    // Classe sugerida por item, a partir da memória de classificação.
    const matchKeys = data.items.map((it) => normalizeDesc(it.description));
    const uniqueKeys = [...new Set(matchKeys.filter(Boolean))];
    const memMap = {};
    if (uniqueKeys.length) {
      const { data: mem } = await supabaseAdmin
        .from('item_classification_memory')
        .select('match_key, item_class')
        .in('match_key', uniqueKeys);
      for (const m of mem || []) memMap[m.match_key] = m.item_class;
    }

    const items = data.items.map((it, idx) => ({
      ...it,
      suggested_class: memMap[matchKeys[idx]] || DEFAULT_ITEM_CLASS,
    }));

    const business_amount = computeBusinessAmount(
      data.header.total_amount,
      items.map((i) => ({ item_class: i.suggested_class, total_price: i.total_price })),
    );

    return ok(res, {
      source: data.source,
      source_confidence: data.source_confidence,
      mode: data.mode,
      invoice: data.header,
      items,
      items_count: items.length,
      suggested_category_id: suggestion.category_id,
      suggested_category_name: suggestion.category_name,
      business_amount,
      uncertain_fields: data.uncertain_fields,
      warnings: data.warnings,
      already_imported: !!existing,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/financial/invoices — re-parseia o XML e salva (nota+itens+despesa)
// de forma atômica via RPC. Body: { xml, category_id, payment_method?, is_test? }.
router.post('/invoices', async (req, res) => {
  try {
    const { xml, pdf_base64 } = req.body || {};
    if (!xml && !pdf_base64) {
      return fail(res, 'missing_source', 'Envie um XML ou um PDF.');
    }
    if (!req.body.category_id) {
      return fail(res, 'missing_category', 'Selecione uma categoria.');
    }

    // Re-processa no servidor (não confia em valores vindos do cliente). As CLASSES
    // são input do usuário (vêm alinhadas por índice com os itens).
    const imported = await importInvoice({ xml, pdf_base64 });
    if (!imported.ok) return fail(res, 'parse_error', imported.error);

    const classes = Array.isArray(req.body.item_classes) ? req.body.item_classes : [];
    const items = imported.items.map((it, idx) => ({
      ...it,
      item_class: coerceClass(classes[idx]),
      match_key: normalizeDesc(it.description),
    }));

    const h = imported.header;
    const payload = {
      nfe_key: h.access_key,
      supplier_name: h.supplier_name,
      supplier_cnpj: h.supplier_cnpj,
      invoice_number: h.invoice_number,
      issue_date: h.issue_date,
      total_amount: h.total_amount,
      category_id: req.body.category_id,
      payment_method: req.body.payment_method || 'boleto',
      is_test: req.body.is_test === true,
      items,
    };

    const { data, error } = await supabaseAdmin.rpc('import_nfe_invoice', { payload });
    if (error) {
      if (error.code === '23503') return fail(res, 'invalid_category', 'Categoria inexistente');
      return serverError(res, error);
    }
    if (!data || data.success !== true) {
      const code = (data && data.error) || 'import_failed';
      const msg  = (data && data.message) || 'Falha ao importar a nota.';
      const http = code === 'duplicate_nfe' ? 409 : 400;
      return fail(res, code, msg, http);
    }

    return ok(res, {
      invoice_id: data.invoice_id,
      expense_id: data.expense_id,
      items_count: data.items_count,
      business_amount: data.business_amount,
    }, 201);
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/invoices?month=YYYY-MM — lista de notas (sem itens)
router.get('/invoices', async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('purchase_invoices')
      .select('id, nfe_key, supplier_name, supplier_cnpj, invoice_number, issue_date, total_amount, business_amount, category_id, created_at, expense_categories(name, icon)')
      .eq('is_test', false)
      .order('issue_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (/^\d{4}-\d{2}$/.test(String(req.query.month || ''))) {
      const { from, to } = monthRange(req.query.month);
      query = query.gte('issue_date', from).lte('issue_date', to);
    }

    const { data, error } = await query;
    if (error) return serverError(res, error);

    const invoices = (data || []).map((n) => ({
      id: n.id,
      nfe_key: n.nfe_key,
      supplier_name: n.supplier_name,
      supplier_cnpj: n.supplier_cnpj,
      invoice_number: n.invoice_number,
      issue_date: n.issue_date,
      total_amount: Number(n.total_amount),
      business_amount: Number(n.business_amount),
      category_id: n.category_id,
      category_name: n.expense_categories?.name || 'Sem categoria',
      category_icon: n.expense_categories?.icon || null,
      created_at: n.created_at,
    }));

    return ok(res, { invoices, count: invoices.length });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/financial/invoices/:id — nota + itens
router.get('/invoices/:id', async (req, res) => {
  try {
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('purchase_invoices')
      .select('id, nfe_key, supplier_name, supplier_cnpj, invoice_number, issue_date, total_amount, business_amount, category_id, created_at, expense_categories(name, icon)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (invErr) return serverError(res, invErr);
    if (!invoice) return notFound(res, 'Nota');

    const { data: items, error: itErr } = await supabaseAdmin
      .from('purchase_invoice_items')
      .select('id, product_code, description, ncm, cfop, quantity, unit, unit_price, total_price, item_class')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true });

    if (itErr) return serverError(res, itErr);

    return ok(res, {
      invoice: {
        id: invoice.id,
        nfe_key: invoice.nfe_key,
        supplier_name: invoice.supplier_name,
        supplier_cnpj: invoice.supplier_cnpj,
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        total_amount: Number(invoice.total_amount),
        business_amount: Number(invoice.business_amount),
        category_id: invoice.category_id,
        category_name: invoice.expense_categories?.name || 'Sem categoria',
        category_icon: invoice.expense_categories?.icon || null,
        created_at: invoice.created_at,
      },
      items: (items || []).map((i) => ({
        ...i,
        quantity: i.quantity != null ? Number(i.quantity) : null,
        unit_price: i.unit_price != null ? Number(i.unit_price) : null,
        total_price: i.total_price != null ? Number(i.total_price) : null,
      })),
      items_count: (items || []).length,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// PATCH /api/financial/invoices/:id/items/:itemId — reclassifica um item.
// Recalcula o business_amount e sincroniza a despesa do negócio (RPC atômica).
router.patch('/invoices/:id/items/:itemId', async (req, res) => {
  try {
    const itemClass = req.body && req.body.item_class;
    if (!isValidClass(itemClass)) {
      return fail(res, 'invalid_class', 'Classe inválida.');
    }

    // Busca o item (e confirma que pertence à nota) para montar o match_key.
    const { data: item, error: itErr } = await supabaseAdmin
      .from('purchase_invoice_items')
      .select('id, description, invoice_id')
      .eq('id', req.params.itemId)
      .eq('invoice_id', req.params.id)
      .maybeSingle();

    if (itErr) return serverError(res, itErr);
    if (!item) return notFound(res, 'Item');

    const { data, error } = await supabaseAdmin.rpc('reclassify_invoice_item', {
      p_item_id: item.id,
      p_class: itemClass,
      p_match_key: normalizeDesc(item.description),
    });

    if (error) return serverError(res, error);
    if (!data || data.success !== true) {
      return fail(res, (data && data.error) || 'reclassify_failed',
        (data && data.message) || 'Falha ao reclassificar o item.');
    }

    return ok(res, {
      invoice_id: data.invoice_id,
      business_amount: data.business_amount,
      expense_id: data.expense_id,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
