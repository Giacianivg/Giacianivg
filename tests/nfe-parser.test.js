'use strict';

/**
 * Tests for the canonical NF-e parser (Compras — Camada 1).
 * Pure parsing only — no DB. Uses a real-shaped NF-e fixture with 3 items.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseNfe } = require('../services/financial/nfe-parser');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'nfe-sample.xml'), 'utf8');

describe('parseNfe — nota válida', () => {
  const r = parseNfe(SAMPLE);

  test('retorna ok', () => {
    assert.equal(r.ok, true);
  });

  test('extrai o cabeçalho da nota', () => {
    assert.equal(r.invoice.nfe_key, '35200114200166000187550010000000071123456780');
    assert.equal(r.invoice.nfe_key.length, 44);
    assert.equal(r.invoice.supplier_name, 'Atacadao Distribuicao Ltda');
    assert.equal(r.invoice.supplier_cnpj, '14200166000187');
    assert.equal(r.invoice.invoice_number, '71');
    assert.equal(r.invoice.issue_date, '2026-06-15'); // só a data, sem fuso
    assert.equal(r.invoice.total_amount, 267.44);
  });

  test('extrai todos os itens', () => {
    assert.equal(r.items.length, 3);
  });

  test('extrai os campos do primeiro item', () => {
    const it = r.items[0];
    assert.equal(it.product_code, '1001');
    assert.equal(it.description, 'PAO FRANCES KG');
    assert.equal(it.ncm, '19059090');
    assert.equal(it.cfop, '5102');
    assert.equal(it.quantity, 10);
    assert.equal(it.unit, 'KG');
    assert.equal(it.unit_price, 12.5);
    assert.equal(it.total_price, 125);
  });

  test('pega o emitente (fornecedor), não o destinatário', () => {
    assert.notEqual(r.invoice.supplier_name, 'Pousada Luz da Lua');
  });
});

describe('parseNfe — nota com um único item (objeto, não array)', () => {
  const ONE_ITEM = `<?xml version="1.0"?>
    <NFe><infNFe Id="NFe35200114200166000187550010000000071123456780">
      <ide><nNF>5</nNF><dhEmi>2026-01-02T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>14200166000187</CNPJ><xNome>Fornecedor Unico</xNome></emit>
      <det><prod><cProd>9</cProd><xProd>ITEM SOLO</xProd><vProd>10.00</vProd></prod></det>
      <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
    </infNFe></NFe>`;

  test('trata 1 item como array de tamanho 1', () => {
    const r = parseNfe(ONE_ITEM);
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].description, 'ITEM SOLO');
    assert.equal(r.invoice.total_amount, 10);
  });
});

describe('parseNfe — casos de erro', () => {
  test('XML vazio', () => {
    const r = parseNfe('');
    assert.equal(r.ok, false);
    assert.match(r.error, /vazio/i);
  });

  test('texto que não é XML', () => {
    const r = parseNfe('isto não é xml <<<');
    assert.equal(r.ok, false);
  });

  test('XML válido mas sem infNFe (ex.: NFS-e)', () => {
    const r = parseNfe('<?xml version="1.0"?><CompNfse><Nfse><numero>1</numero></Nfse></CompNfse>');
    assert.equal(r.ok, false);
    assert.match(r.error, /NF-e/);
  });

  test('NF-e sem chave de 44 dígitos', () => {
    const r = parseNfe('<NFe><infNFe Id="NFe123"><total><ICMSTot><vNF>10</vNF></ICMSTot></total></infNFe></NFe>');
    assert.equal(r.ok, false);
    assert.match(r.error, /chave/i);
  });

  test('NF-e sem valor total (vNF)', () => {
    const r = parseNfe('<NFe><infNFe Id="NFe35200114200166000187550010000000071123456780"><ide><nNF>1</nNF></ide></infNFe></NFe>');
    assert.equal(r.ok, false);
    assert.match(r.error, /total|vNF/i);
  });
});
