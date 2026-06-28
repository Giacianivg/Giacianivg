'use strict';

/**
 * Tests for the photo-receipt adapter (Compras — Fase 2, Caso A).
 * parseReceiptResponse é puro: recebe o TEXTO da resposta do Claude (visão) e
 * monta um InvoiceImportData mode 'simple'. A chamada à API não é testada aqui.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseReceiptResponse, extractJson } = require('../services/financial/photo-receipt');
const { validateExpense } = require('../services/financial/expense-helpers');

describe('extractJson', () => {
  test('JSON puro', () => {
    assert.deepEqual(extractJson('{"total": 10}'), { total: 10 });
  });
  test('JSON em bloco ```json com texto em volta', () => {
    const t = 'Claro!\n```json\n{"total": 5.5, "date": "2026-01-02"}\n```\npronto';
    assert.deepEqual(extractJson(t), { total: 5.5, date: '2026-01-02' });
  });
  test('texto sem JSON → null', () => {
    assert.equal(extractJson('não tem json aqui'), null);
  });
});

describe('parseReceiptResponse — cupom legível', () => {
  const r = parseReceiptResponse(JSON.stringify({
    total: 84.5, date: '2026-06-20', supplier: 'Feira do Zé',
    confidence: { total: 'high', date: 'high', supplier: 'high' },
  }));

  test('vira InvoiceImportData mode simple / fonte foto / confiança baixa', () => {
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'simple');
    assert.equal(r.source, 'photo_receipt');
    assert.equal(r.source_confidence, 'low'); // foto é sempre rascunho
    assert.deepEqual(r.items, []);
  });

  test('extrai total, data e estabelecimento', () => {
    assert.equal(r.header.total_amount, 84.5);
    assert.equal(r.header.issue_date, '2026-06-20');
    assert.equal(r.header.supplier_name, 'Feira do Zé');
  });

  test('campos legíveis não entram em uncertain_fields', () => {
    assert.deepEqual(r.uncertain_fields, []);
  });

  test('sempre traz o aviso de revisão', () => {
    assert.ok(r.warnings.some(w => /confira|foto/i.test(w)));
  });
});

describe('parseReceiptResponse — campos incertos / ausentes', () => {
  test('confiança baixa e campo nulo entram em uncertain_fields', () => {
    const r = parseReceiptResponse(JSON.stringify({
      total: 30, date: null, supplier: 'Padaria',
      confidence: { total: 'low', date: 'low', supplier: 'high' },
    }));
    assert.ok(r.uncertain_fields.includes('total_amount')); // confiança low
    assert.ok(r.uncertain_fields.includes('issue_date'));   // null
    assert.ok(!r.uncertain_fields.includes('supplier_name'));
    assert.equal(r.header.issue_date, null);
  });

  test('total inválido → null e incerto (não bloqueia; usuário completa)', () => {
    const r = parseReceiptResponse(JSON.stringify({ total: 0, supplier: 'X' }));
    assert.equal(r.ok, true);
    assert.equal(r.header.total_amount, null);
    assert.ok(r.uncertain_fields.includes('total_amount'));
  });

  test('resposta sem JSON → erro', () => {
    const r = parseReceiptResponse('desculpe, não consegui ler a imagem');
    assert.equal(r.ok, false);
    assert.ok(r.error);
  });
});

describe('validateExpense — marcador particular/negócio', () => {
  const base = { amount: 50, category_id: 'c1', payment_method: 'dinheiro' };
  test('default é do negócio (is_personal false)', () => {
    assert.equal(validateExpense(base).normalized.is_personal, false);
  });
  test('is_personal true quando marcado particular', () => {
    assert.equal(validateExpense({ ...base, is_personal: true }).normalized.is_personal, true);
  });
});
