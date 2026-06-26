'use strict';

/**
 * Tests for item classification + business_amount (Compras — Camada 1).
 * Pure logic only — espelha a regra do banco (recalc_invoice_business).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  ITEM_CLASSES,
  DEFAULT_ITEM_CLASS,
  isValidClass,
  coerceClass,
  normalizeDesc,
  computeBusinessAmount,
} = require('../services/financial/classification');

describe('classes', () => {
  test('as 4 classes existem e o padrão é estoque da pousada', () => {
    assert.deepEqual(ITEM_CLASSES, ['pousada_estoque', 'pousada_nao_estoque', 'ativo_imobilizado', 'particular']);
    assert.equal(DEFAULT_ITEM_CLASS, 'pousada_estoque');
  });

  test('isValidClass', () => {
    assert.equal(isValidClass('particular'), true);
    assert.equal(isValidClass('ativo_imobilizado'), true);
    assert.equal(isValidClass('xxx'), false);
    assert.equal(isValidClass(undefined), false);
  });

  test('coerceClass cai no padrão quando inválida/ausente', () => {
    assert.equal(coerceClass('particular'), 'particular');
    assert.equal(coerceClass('lixo'), 'pousada_estoque');
    assert.equal(coerceClass(undefined), 'pousada_estoque');
  });
});

describe('normalizeDesc', () => {
  test('minúsculo, sem acento, espaços colapsados', () => {
    assert.equal(normalizeDesc('  Café  Torrado '), 'cafe torrado');
    assert.equal(normalizeDesc('GILLETTE  Mach3'), 'gillette mach3');
    assert.equal(normalizeDesc('Pão de Açúcar'), 'pao de acucar');
  });
  test('vazio/nulo → string vazia', () => {
    assert.equal(normalizeDesc(null), '');
    assert.equal(normalizeDesc(''), '');
  });
});

describe('computeBusinessAmount (Opção B: vNF − Σ particulares)', () => {
  test('sem particulares → business = vNF exato', () => {
    const items = [
      { item_class: 'pousada_estoque', total_price: 125.00 },
      { item_class: 'pousada_nao_estoque', total_price: 30.00 },
    ];
    assert.equal(computeBusinessAmount(267.44, items), 267.44); // bate com o vNF
  });

  test('frete no rodapé (Σ itens < vNF) e sem particular → ainda = vNF', () => {
    // itens somam 155, mas a nota (com frete) é 175 → business deve ser 175.
    const items = [
      { item_class: 'pousada_estoque', total_price: 125.00 },
      { item_class: 'pousada_estoque', total_price: 30.00 },
    ];
    assert.equal(computeBusinessAmount(175.00, items), 175.00);
  });

  test('1 item particular → tira só o valor dele do vNF', () => {
    const items = [
      { item_class: 'pousada_estoque', total_price: 240.00 },  // leite
      { item_class: 'particular',      total_price: 12.90 },   // gilette
    ];
    // vNF 267.44 − 12.90 = 254.54
    assert.equal(computeBusinessAmount(267.44, items), 254.54);
  });

  test('ativo_imobilizado e não-estoque CONTAM no negócio (não são particular)', () => {
    const items = [
      { item_class: 'ativo_imobilizado',   total_price: 1500.00 }, // geladeira
      { item_class: 'pousada_nao_estoque', total_price: 50.00 },
      { item_class: 'particular',          total_price: 100.00 },
    ];
    // só o particular sai: 1700 − 100 = 1600
    assert.equal(computeBusinessAmount(1700.00, items), 1600.00);
  });

  test('100% particular → business = 0 (frete pessoal também)', () => {
    const items = [
      { item_class: 'particular', total_price: 80.00 },
      { item_class: 'particular', total_price: 20.00 },
    ];
    // mesmo que a nota seja 110 (frete 10), nada é da pousada → 0
    assert.equal(computeBusinessAmount(110.00, items), 0);
  });

  test('piso 0: desconto global que faz particulares passarem do vNF', () => {
    const items = [
      { item_class: 'pousada_estoque', total_price: 10.00 },
      { item_class: 'particular',      total_price: 200.00 },
    ];
    assert.equal(computeBusinessAmount(150.00, items), 0); // GREATEST(0, ...)
  });

  test('classe inválida é tratada como padrão (entra no negócio)', () => {
    const items = [
      { item_class: 'xxx',        total_price: 100.00 }, // vira pousada_estoque
      { item_class: 'particular', total_price: 40.00 },
    ];
    assert.equal(computeBusinessAmount(140.00, items), 100.00);
  });

  test('lista vazia → 0', () => {
    assert.equal(computeBusinessAmount(100.00, []), 0);
  });
});
