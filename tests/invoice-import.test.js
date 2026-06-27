'use strict';

/**
 * Tests for the multi-source import foundation (InvoiceImportData) and the XML
 * adapter. Garante que o XML mapeia para o formato único sem perder dados.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildImportData,
  totalMismatchWarning,
  importFromXml,
  SOURCES,
  MODES,
} = require('../services/financial/invoice-import');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'nfe-sample.xml'), 'utf8');

describe('buildImportData — normalização', () => {
  test('preenche header completo e arrays vazios', () => {
    const d = buildImportData({});
    assert.equal(d.ok, true);
    assert.deepEqual(d.items, []);
    assert.deepEqual(d.uncertain_fields, []);
    assert.deepEqual(d.warnings, []);
    // header tem todas as chaves esperadas
    for (const k of ['supplier_name','supplier_cnpj','invoice_number','series','issue_date','total_amount','payment_method','access_key']) {
      assert.ok(k in d.header, `header.${k} deve existir`);
    }
  });

  test('sem itens ⇒ mode simple; com itens ⇒ itemized', () => {
    assert.equal(buildImportData({ items: [] }).mode, 'simple');
    assert.equal(buildImportData({ items: [{ description: 'x' }] }).mode, 'itemized');
  });

  test('mode itemized sem itens é corrigido para simple', () => {
    assert.equal(buildImportData({ mode: 'itemized', items: [] }).mode, 'simple');
  });

  test('source/confidence inválidos caem no padrão', () => {
    const d = buildImportData({ source: 'lixo', source_confidence: 'xpto' });
    assert.ok(SOURCES.includes(d.source));
    assert.equal(d.source, 'xml');
    assert.equal(d.source_confidence, 'high');
  });

  test('total_amount é arredondado a 2 casas', () => {
    assert.equal(buildImportData({ header: { total_amount: 10.999 } }).header.total_amount, 11);
  });
});

describe('totalMismatchWarning', () => {
  test('soma confere → sem warning', () => {
    const w = totalMismatchWarning(100, [{ total_price: 60 }, { total_price: 40 }]);
    assert.equal(w, null);
  });
  test('diferença pequena (frete) → sem warning', () => {
    assert.equal(totalMismatchWarning(100, [{ total_price: 99.5 }]), null);
  });
  test('diferença grande → warning', () => {
    const w = totalMismatchWarning(200, [{ total_price: 50 }]);
    assert.match(w, /difere/);
  });
});

describe('importFromXml — adapter', () => {
  const d = importFromXml(SAMPLE);

  test('devolve InvoiceImportData válido', () => {
    assert.equal(d.ok, true);
    assert.equal(d.source, 'xml');
    assert.equal(d.source_confidence, 'high');
    assert.ok(MODES.includes(d.mode));
    assert.equal(d.mode, 'itemized');
  });

  test('header mapeia os campos do XML (chave fiscal em access_key)', () => {
    assert.equal(d.header.access_key, '35200114200166000187550010000000071123456780');
    assert.equal(d.header.supplier_name, 'Atacadao Distribuicao Ltda');
    assert.equal(d.header.supplier_cnpj, '14200166000187');
    assert.equal(d.header.invoice_number, '71');
    assert.equal(d.header.issue_date, '2026-06-15');
    assert.equal(d.header.total_amount, 267.44);
  });

  test('preserva todos os itens', () => {
    assert.equal(d.items.length, 3);
    assert.equal(d.items[0].description, 'PAO FRANCES KG');
    assert.equal(d.items[0].unit, 'KG');
  });

  test('XML é estruturado: nada incerto', () => {
    assert.deepEqual(d.uncertain_fields, []);
  });

  test('propaga erro de parsing', () => {
    const bad = importFromXml('não é xml <<<');
    assert.equal(bad.ok, false);
    assert.ok(bad.error);
  });
});
