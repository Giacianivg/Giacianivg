'use strict';

/**
 * Tests for the manual expenses feature (financeiro simples, sem IA).
 * Pure logic only — validation, month range, category breakdown.
 * DB I/O (Supabase insert/select) is integration and not covered here.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  PAYMENT_METHODS,
  validateExpense,
  monthRange,
  buildCategoryBreakdown,
} = require('../services/financial/expense-helpers');

// ── validateExpense ─────────────────────────────────────────────────────────────
describe('validateExpense', () => {
  const base = { amount: 150, category_id: 'cat-1', payment_method: 'pix' };

  test('aceita lançamento mínimo válido', () => {
    const r = validateExpense(base);
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, []);
    assert.equal(r.normalized.amount, 150);
    assert.equal(r.normalized.payment_method, 'pix');
  });

  test('rejeita amount ausente', () => {
    const r = validateExpense({ category_id: 'cat-1' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('amount')));
  });

  test('rejeita amount <= 0', () => {
    assert.equal(validateExpense({ ...base, amount: 0 }).valid, false);
    assert.equal(validateExpense({ ...base, amount: -5 }).valid, false);
  });

  test('rejeita amount não numérico', () => {
    assert.equal(validateExpense({ ...base, amount: 'abc' }).valid, false);
  });

  test('rejeita category_id ausente', () => {
    const r = validateExpense({ amount: 100 });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('category_id')));
  });

  test('default payment_method = pix quando ausente', () => {
    const r = validateExpense({ amount: 100, category_id: 'cat-1' });
    assert.equal(r.valid, true);
    assert.equal(r.normalized.payment_method, 'pix');
  });

  test('normaliza payment_method (case/trim)', () => {
    const r = validateExpense({ ...base, payment_method: ' Dinheiro ' });
    assert.equal(r.valid, true);
    assert.equal(r.normalized.payment_method, 'dinheiro');
  });

  test('rejeita payment_method inválido', () => {
    const r = validateExpense({ ...base, payment_method: 'cheque' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('payment_method')));
  });

  test('aceita todos os métodos suportados', () => {
    for (const pm of PAYMENT_METHODS) {
      assert.equal(validateExpense({ ...base, payment_method: pm }).valid, true, pm);
    }
  });

  test('arredonda amount para 2 casas', () => {
    const r = validateExpense({ ...base, amount: 10.005 });
    assert.equal(r.normalized.amount, 10.01);
  });

  test('expense_date válida é mantida', () => {
    const r = validateExpense({ ...base, expense_date: '2026-06-15' });
    assert.equal(r.valid, true);
    assert.equal(r.normalized.expense_date, '2026-06-15');
  });

  test('expense_date ausente não entra no normalized (usa DEFAULT do banco)', () => {
    const r = validateExpense(base);
    assert.equal(r.valid, true);
    assert.equal('expense_date' in r.normalized, false);
  });

  test('rejeita expense_date em formato inválido', () => {
    const r = validateExpense({ ...base, expense_date: '15/06/2026' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('expense_date')));
  });

  test('description é aparada; vazia vira null', () => {
    assert.equal(validateExpense({ ...base, description: '  conta de luz  ' }).normalized.description, 'conta de luz');
    assert.equal(validateExpense(base).normalized.description, null);
  });
});

// ── monthRange ──────────────────────────────────────────────────────────────────
describe('monthRange', () => {
  test('mês de 31 dias', () => {
    assert.deepEqual(monthRange('2026-01'), { month: '2026-01', from: '2026-01-01', to: '2026-01-31' });
  });

  test('mês de 30 dias', () => {
    assert.deepEqual(monthRange('2026-06'), { month: '2026-06', from: '2026-06-01', to: '2026-06-30' });
  });

  test('fevereiro bissexto (2028)', () => {
    assert.equal(monthRange('2028-02').to, '2028-02-29');
  });

  test('fevereiro não bissexto (2026)', () => {
    assert.equal(monthRange('2026-02').to, '2026-02-28');
  });

  test('entrada inválida cai no mês atual', () => {
    const r = monthRange('lixo');
    assert.match(r.month, /^\d{4}-\d{2}$/);
    assert.equal(r.from, `${r.month}-01`);
  });
});

// ── buildCategoryBreakdown ──────────────────────────────────────────────────────
describe('buildCategoryBreakdown', () => {
  test('lista vazia → zeros', () => {
    assert.deepEqual(buildCategoryBreakdown([]), { total: 0, count: 0, by_category: [] });
  });

  test('soma total e agrupa por categoria', () => {
    const r = buildCategoryBreakdown([
      { amount: 100, category_id: 'a', category_name: 'Limpeza' },
      { amount: 50,  category_id: 'a', category_name: 'Limpeza' },
      { amount: 200, category_id: 'b', category_name: 'Aluguel' },
    ]);
    assert.equal(r.total, 350);
    assert.equal(r.count, 3);
    assert.equal(r.by_category.length, 2);
  });

  test('ordena por total desc', () => {
    const r = buildCategoryBreakdown([
      { amount: 100, category_id: 'a', category_name: 'Limpeza' },
      { amount: 200, category_id: 'b', category_name: 'Aluguel' },
    ]);
    assert.equal(r.by_category[0].category_name, 'Aluguel');
    assert.equal(r.by_category[1].category_name, 'Limpeza');
  });

  test('calcula pct corretamente', () => {
    const r = buildCategoryBreakdown([
      { amount: 250, category_id: 'a', category_name: 'Limpeza' },
      { amount: 750, category_id: 'b', category_name: 'Aluguel' },
    ]);
    const limpeza = r.by_category.find(c => c.category_name === 'Limpeza');
    const aluguel = r.by_category.find(c => c.category_name === 'Aluguel');
    assert.equal(limpeza.pct, 25);
    assert.equal(aluguel.pct, 75);
  });

  test('despesa sem categoria vira "Sem categoria"', () => {
    const r = buildCategoryBreakdown([{ amount: 80, category_id: null }]);
    assert.equal(r.by_category[0].category_name, 'Sem categoria');
  });
});
