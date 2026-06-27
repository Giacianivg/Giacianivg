'use strict';

/**
 * Integração do adapter de PDF (importFromPdf) com um PDF REAL de DANFE.
 * O PDF real NÃO é versionado (dado pessoal). Este teste roda só se o arquivo
 * existir localmente em tests/fixtures/ — caso contrário é pulado, sem quebrar a
 * suíte. Serve de validação ponta-a-ponta na máquina de quem tem a nota.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { importFromPdf } = require('../services/financial/invoice-import');

// Qualquer .pdf colocado em tests/fixtures vira insumo do teste.
const fixturesDir = path.join(__dirname, 'fixtures');
const pdfs = fs.existsSync(fixturesDir)
  ? fs.readdirSync(fixturesDir).filter((f) => /\.pdf$/i.test(f))
  : [];

test('importFromPdf extrai uma DANFE real (pulado se não houver PDF local)', { skip: pdfs.length === 0 }, async () => {
  for (const f of pdfs) {
    const buf = fs.readFileSync(path.join(fixturesDir, f));
    const d = await importFromPdf(buf);
    assert.equal(d.ok, true, `${f} deve parsear`);
    assert.equal(d.source, 'pdf_text');
    assert.equal(d.mode, 'itemized');
    assert.ok(d.header.access_key && d.header.access_key.length === 44, `${f}: chave de 44 díg`);
    assert.ok(d.header.total_amount > 0, `${f}: total > 0`);
    assert.ok(d.items.length > 0, `${f}: ao menos 1 item`);
    // Anti-contaminação: nenhuma descrição pode conter texto fiscal/rodapé.
    for (const it of d.items) {
      assert.ok(it.description.length <= 120, `${f}: descrição longa (${it.description.length}): ${it.description.slice(0, 60)}`);
      assert.doesNotMatch(it.description, /FISCO|RECEBEMOS|RICMS|COFINS|ADICION|DANFE|GLEBA/i, `${f}: descrição contaminada`);
    }
    // Se a confiança é alta, a soma dos itens tem de bater com o total.
    if (d.source_confidence === 'high') {
      const soma = Math.round(d.items.reduce((s, i) => s + (i.total_price || 0), 0) * 100) / 100;
      assert.equal(soma, d.header.total_amount, `${f}: soma dos itens = total`);
    }
  }
});
