'use strict';

/**
 * Tests for the keyword-based category suggester (Compras — Camada 1).
 * Pure and deterministic — no IA, no DB.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { suggestCategory } = require('../services/financial/category-suggester');

// Categorias como vêm do seed da migration 042 (subset suficiente p/ os testes).
const CATS = [
  { id: 'cafe',  name: 'Café da manhã' },
  { id: 'limp',  name: 'Limpeza' },
  { id: 'manut', name: 'Manutenção' },
  { id: 'jard',  name: 'Jardinagem' },
  { id: 'outros', name: 'Outros' },
];

describe('suggestCategory', () => {
  test('itens de mercearia → Café da manhã', () => {
    const r = suggestCategory([
      { description: 'PAO FRANCES KG' },
      { description: 'LEITE INTEGRAL 1L' },
      { description: 'QUEIJO MUSSARELA' },
    ], CATS);
    assert.equal(r.category_id, 'cafe');
    assert.equal(r.matched, true);
  });

  test('produtos de limpeza → Limpeza', () => {
    const r = suggestCategory([
      { description: 'DETERGENTE NEUTRO 500ML' },
      { description: 'AGUA SANITARIA 2L' },
    ], CATS);
    assert.equal(r.category_id, 'limp');
    assert.equal(r.matched, true);
  });

  test('é robusto a acento e caixa (Café vs CAFE)', () => {
    const cats = [{ id: 'x', name: 'CAFÉ DA MANHÃ' }, { id: 'o', name: 'Outros' }];
    const r = suggestCategory([{ description: 'cafe torrado moido' }], cats);
    assert.equal(r.category_id, 'x');
    assert.equal(r.matched, true);
  });

  test('categoria vencedora é a com mais hits', () => {
    const r = suggestCategory([
      { description: 'PAO' },               // café (1)
      { description: 'DETERGENTE' },         // limpeza (1)
      { description: 'SABAO EM PO' },        // limpeza (1)
      { description: 'DESINFETANTE' },       // limpeza (1)
    ], CATS);
    assert.equal(r.category_id, 'limp'); // 3 > 1
  });

  test('sem correspondência → Outros (fallback)', () => {
    const r = suggestCategory([{ description: 'PARAFANALHA INEXISTENTE XYZ' }], CATS);
    assert.equal(r.category_id, 'outros');
    assert.equal(r.matched, false);
  });

  test('sem categorias → null', () => {
    const r = suggestCategory([{ description: 'PAO' }], []);
    assert.equal(r.category_id, null);
    assert.equal(r.matched, false);
  });

  test('ignora categoria de palavra-chave que não existe no banco', () => {
    // Banco só tem "Outros": nenhum hit casa, cai no fallback.
    const cats = [{ id: 'o', name: 'Outros' }];
    const r = suggestCategory([{ description: 'PAO LEITE' }], cats);
    assert.equal(r.category_id, 'o');
    assert.equal(r.matched, false);
  });

  test('lista de itens vazia → Outros', () => {
    const r = suggestCategory([], CATS);
    assert.equal(r.category_id, 'outros');
  });
});
