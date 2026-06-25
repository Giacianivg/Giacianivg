'use strict';

/**
 * Pure helpers for the manual expenses feature (financeiro simples, sem IA).
 * No I/O here — keeps validation/aggregation testable in isolation.
 */

const PAYMENT_METHODS = ['pix', 'dinheiro', 'cartao', 'transferencia', 'boleto'];

// ─── NF-e key ───────────────────────────────────────────────────────────────────
// Chave de acesso da NF-e: exatamente 44 dígitos. Aceita entrada com prefixo
// "NFe" (vem do atributo Id do <infNFe>) e com espaços. Retorna só os 44 dígitos
// ou null se inválida.
function normalizeNfeKey(raw) {
  if (raw === undefined || raw === null) return null;
  const digits = String(raw).replace(/^NFe/i, '').replace(/\D/g, '');
  return digits.length === 44 ? digits : null;
}

function isValidNfeKey(raw) {
  return normalizeNfeKey(raw) !== null;
}

// ─── Validation ────────────────────────────────────────────────────────────────
// Returns { valid, errors, normalized }. `normalized` is safe to insert.
function validateExpense(body = {}) {
  const errors = [];

  const amount = Number(body.amount);
  if (body.amount === undefined || body.amount === null || body.amount === '') {
    errors.push('amount é obrigatório');
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('amount deve ser um número > 0');
  }

  if (!body.category_id) {
    errors.push('category_id é obrigatório');
  }

  const payment_method = (body.payment_method || 'pix').trim().toLowerCase();
  if (!PAYMENT_METHODS.includes(payment_method)) {
    errors.push(`payment_method deve ser: ${PAYMENT_METHODS.join(', ')}`);
  }

  // expense_date opcional — default hoje (YYYY-MM-DD). Se vier, valida formato.
  let expense_date = body.expense_date;
  if (expense_date !== undefined && expense_date !== null && expense_date !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expense_date))) {
      errors.push('expense_date deve estar no formato YYYY-MM-DD');
    }
  } else {
    expense_date = undefined; // deixa o DEFAULT do banco (CURRENT_DATE) assumir
  }

  // nfe_key opcional (só em importação de XML). Se vier, deve ter 44 dígitos.
  let nfe_key;
  if (body.nfe_key !== undefined && body.nfe_key !== null && body.nfe_key !== '') {
    nfe_key = normalizeNfeKey(body.nfe_key);
    if (!nfe_key) errors.push('nfe_key deve ter 44 dígitos');
  }

  const description = body.description ? String(body.description).trim() : null;

  const normalized = {
    amount: Math.round(amount * 100) / 100,
    category_id: body.category_id,
    description,
    payment_method,
  };
  if (expense_date) normalized.expense_date = expense_date;
  if (nfe_key) normalized.nfe_key = nfe_key;

  return { valid: errors.length === 0, errors, normalized };
}

// ─── Month range ───────────────────────────────────────────────────────────────
// 'YYYY-MM' → { from: 'YYYY-MM-01', to: 'YYYY-MM-<lastDay>' } (inclusive).
function monthRange(month) {
  const m = /^\d{4}-\d{2}$/.test(String(month || ''))
    ? String(month)
    : new Date().toISOString().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const lastDay = new Date(y, mo, 0).getDate(); // mo is 1-based; day 0 = last of mo
  return {
    month: m,
    from: `${m}-01`,
    to: `${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ─── Category breakdown ────────────────────────────────────────────────────────
// expenses: [{ amount, category_id, category_name? }]. Returns total + by_category
// sorted desc, each with pct of total. Answers "pra onde foi o dinheiro?".
function buildCategoryBreakdown(expenses = []) {
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const map = new Map();

  for (const e of expenses) {
    const key = e.category_id || '__none__';
    const cur = map.get(key) || {
      category_id: e.category_id || null,
      category_name: e.category_name || 'Sem categoria',
      total: 0,
      count: 0,
    };
    cur.total += Number(e.amount || 0);
    cur.count += 1;
    if (e.category_name) cur.category_name = e.category_name;
    map.set(key, cur);
  }

  const by_category = Array.from(map.values())
    .map(c => ({
      ...c,
      total: Math.round(c.total * 100) / 100,
      pct: total > 0 ? Math.round((c.total / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { total: Math.round(total * 100) / 100, count: expenses.length, by_category };
}

module.exports = {
  PAYMENT_METHODS,
  validateExpense,
  monthRange,
  buildCategoryBreakdown,
  normalizeNfeKey,
  isValidNfeKey,
};
