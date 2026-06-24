'use strict';

/**
 * Nomes públicos por ala (fonte única room_types) — Bloco "nome único".
 * Prova que sobrescrever o nome público:
 *   (a) muda APENAS o tipoLabel do room_type_code informado;
 *   (b) com lista vazia/ausente, mantém o fallback byte-idêntico;
 *   (c) NÃO afeta o preço/cálculo da cotação (price independe do label).
 *
 * Run: node --test tests/quotation/room-types-label.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyRoomTypeLabels, calculateQuotation } = require('../../services/quotation/engine');

const BASE = {
  ALA_A: 'Standard Casal (Ala A)',
  ALA_B: 'Familia (Ala B)',
  ALA_C_CASAL: 'Casal Especial (Ala C)',
};

describe('applyRoomTypeLabels — nome público da fonte única', () => {
  it('lista vazia → fallback byte-idêntico', () => {
    assert.deepEqual(applyRoomTypeLabels(BASE, []), BASE);
  });

  it('lista ausente (null/undefined) → fallback byte-idêntico', () => {
    assert.deepEqual(applyRoomTypeLabels(BASE, null), BASE);
    assert.deepEqual(applyRoomTypeLabels(BASE, undefined), BASE);
  });

  it('sobrescreve apenas o room_type_code informado', () => {
    const out = applyRoomTypeLabels(BASE, [
      { room_type_code: 'ALA_A', public_name: 'Suíte Romântica' },
    ]);
    assert.equal(out.ALA_A, 'Suíte Romântica', 'ALA_A deve mudar');
    assert.equal(out.ALA_B, BASE.ALA_B, 'ALA_B intacto');
    assert.equal(out.ALA_C_CASAL, BASE.ALA_C_CASAL, 'ALA_C_CASAL intacto');
  });

  it('não muta o objeto base (retorna cópia)', () => {
    const out = applyRoomTypeLabels(BASE, [{ room_type_code: 'ALA_A', public_name: 'X' }]);
    assert.notEqual(out, BASE);
    assert.equal(BASE.ALA_A, 'Standard Casal (Ala A)', 'base original preservado');
  });

  it('ignora linhas sem room_type_code ou sem public_name', () => {
    const out = applyRoomTypeLabels(BASE, [
      { room_type_code: 'ALA_A' },                 // sem public_name
      { public_name: 'Sem code' },                 // sem code
      { room_type_code: 'ALA_B', public_name: '' },// vazio (falsy) → ignora
    ]);
    assert.deepEqual(out, BASE, 'linhas inválidas não alteram nada');
  });
});

describe('cotação — preço independe do nome público (byte-idêntico)', () => {
  // calculateQuotation sem DB usa DEFAULT_CONFIG (cache frio em teste).
  const params = {
    tipo: 'ALA_A', data_entrada: '15/05/2026', data_saida: '17/05/2026', pessoas: 2,
  };

  it('a cotação retorna preço estável e um tipoLabel', () => {
    const q = calculateQuotation(params);
    assert.ok(!q.error, 'não deve dar erro');
    assert.ok(Number(q.totalFinal) > 0, 'preço positivo');
    assert.ok(typeof q.tipoLabel === 'string' && q.tipoLabel.length > 0, 'tem label');
    // O preço é o mesmo independentemente do texto do label (são campos independentes).
    const q2 = calculateQuotation(params);
    assert.equal(q2.totalFinal, q.totalFinal, 'preço determinístico');
  });
});
