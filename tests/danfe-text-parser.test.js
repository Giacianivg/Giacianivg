'use strict';

/**
 * Tests for the DANFE text parser (Compras — Fase 1, PDF com texto).
 * Pure parsing — recebe o texto já extraído. Fixture anonimizado com 4 itens
 * (unidades variadas: CX012UN, LA001LA, UN001UN, UN).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDanfeText } = require('../services/financial/danfe-text-parser');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'danfe-sample.txt'), 'utf8');

describe('parseDanfeText — DANFE válida', () => {
  const r = parseDanfeText(SAMPLE);

  test('retorna ok com alta confiança (chave + total + soma batem)', () => {
    assert.equal(r.ok, true);
    assert.equal(r.source_confidence, 'high');
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.uncertain_fields, []);
  });

  test('extrai cabeçalho — chave de 44 díg + CNPJ/série/número derivados dela', () => {
    assert.equal(r.header.access_key, '35250212345678000199550010000123451123456789');
    assert.equal(r.header.access_key.length, 44);
    assert.equal(r.header.supplier_name, 'FORNECEDOR EXEMPLO DISTRIBUIDORA LTDA');
    assert.equal(r.header.supplier_cnpj, '12345678000199'); // díg 7-20 da chave
    assert.equal(r.header.invoice_number, '12345');         // díg 26-34
    assert.equal(r.header.series, '1');                     // díg 23-25
    assert.equal(r.header.issue_date, '2025-02-15');
    assert.equal(r.header.total_amount, 206.00);
  });

  test('extrai os 4 itens com unidade e valores', () => {
    assert.equal(r.items.length, 4);
    const soma = r.items.reduce((s, i) => s + i.total_price, 0);
    assert.equal(Math.round(soma * 100) / 100, 206.00); // bate com o total
  });

  test('preserva a unidade comercial (codificada e simples)', () => {
    assert.equal(r.items[0].unit, 'CX012UN');  // caixa de 12
    assert.equal(r.items[0].quantity, 2);
    assert.equal(r.items[0].total_price, 120.00);
    assert.equal(r.items[1].unit, 'LA001LA');
    assert.equal(r.items[3].unit, 'UN');       // unidade simples
  });

  test('descrição não engole o NCM nem a unidade', () => {
    assert.equal(r.items[0].description, 'CERVEJA EXEMPLO LT 350ML');
    assert.equal(r.items[0].ncm, '22030000');
  });

  test('anti-contaminação: texto fiscal/cabeçalho/rodapé NÃO vira item', () => {
    // Fixture tem cabeçalho (Nº 100), bloco fiscal (Decr. 52665/2007, RICMS, PIS,
    // COFINS, Fatura, Pedido) e canhoto "RECEBEMOS DE". Nada disso pode virar item
    // nem contaminar descrição. Só os 4 produtos reais.
    assert.equal(r.items.length, 4);
    for (const it of r.items) {
      assert.ok(it.description.length <= 120, `descrição longa: ${it.description}`);
      assert.doesNotMatch(it.description, /FISCO|RECEBEMOS|RICMS|COFINS|ADICION|DANFE|FATURA|PEDIDO|REDUCAO|REDUÇÃO/i);
    }
  });
});

describe('parseDanfeText — divergências e erros', () => {
  test('texto vazio / sem texto pesquisável → erro (imagem, Fase 2)', () => {
    const r = parseDanfeText('   ');
    assert.equal(r.ok, false);
    assert.match(r.error, /OCR|imagem/i);
  });

  test('soma dos itens ≠ total → confidence medium + warning', () => {
    // Troca o total da nota para um valor que não bate com a soma (206).
    const adulterado = SAMPLE.replace('VALOR TOTAL DA NOTA\n206,00', 'VALOR TOTAL DA NOTA\n999,00');
    const r = parseDanfeText(adulterado);
    assert.equal(r.ok, true);
    assert.equal(r.source_confidence, 'medium');
    assert.ok(r.warnings.some((w) => /difere/.test(w)));
  });

  test('sem itens reconhecidos → warning', () => {
    const semItens = SAMPLE.split('\n').filter((l) => !/^\d{6}\s/.test(l)).join('\n');
    const r = parseDanfeText(semItens);
    assert.ok(r.warnings.some((w) => /item/i.test(w)));
  });
});
