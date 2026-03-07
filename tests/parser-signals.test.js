'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Copy parsers directly from webhook.js for isolated testing
function parseConfirmarParams(signal) {
  const match = signal.match(/\[CONFIRMAR:\s*([^\]]+)\]/);
  if (!match) return null;
  const params = {};
  match[1].split(',').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      params[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
    }
  });
  return params;
}

function parseEscalarParams(rawSignal) {
  if (!rawSignal.includes(':')) return { motivo: null };
  const inner = rawSignal.replace(/^\[ESCALAR:\s*/, '').replace(/\]$/, '').trim();
  if (!inner.includes('=')) return { motivo: inner || null };
  const params = {};
  const parts = inner.split(/,\s*(?=\w+=)/);
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) params[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
  }
  return params;
}

function parseCotarParams(signal) {
  const match = signal.match(/\[COTAR:\s*([^\]]+)\]/);
  if (!match) return null;
  const params = {};
  match[1].split(',').forEach(part => {
    const [k, v] = part.split('=').map(s => s.trim());
    if (k && v) params[k] = v;
  });
  return params;
}

// ── [CONFIRMAR] ───────────────────────────────────────────────────────────────
describe('[CONFIRMAR] parser — new format with sinal field', () => {
  test('parses all fields including sinal', () => {
    const sig = '[CONFIRMAR: nome=Carlos, entrada=07/03/2026, saida=09/03/2026, tipo=ALA_A, pessoas=2, total=R$600, sinal=R$180]';
    const p = parseConfirmarParams(sig);
    assert.equal(p.nome, 'Carlos');
    assert.equal(p.entrada, '07/03/2026');
    assert.equal(p.saida, '09/03/2026');
    assert.equal(p.tipo, 'ALA_A');
    assert.equal(p.pessoas, '2');
    assert.equal(p.total, 'R$600');
    assert.equal(p.sinal, 'R$180');
  });

  test('parses sinal with decimal value', () => {
    const sig = '[CONFIRMAR: nome=Ana Silva, entrada=10/04/2026, saida=15/04/2026, tipo=ALA_B, pessoas=4, total=R$1500, sinal=R$450]';
    const p = parseConfirmarParams(sig);
    assert.equal(p.sinal, 'R$450');
    assert.equal(p.nome, 'Ana Silva');
  });

  test('sinal field absent — returns undefined (fallback to 30% in handler)', () => {
    const sig = '[CONFIRMAR: nome=Jose, entrada=01/05/2026, saida=03/05/2026, tipo=ALA_A, pessoas=2, total=R$600]';
    const p = parseConfirmarParams(sig);
    assert.equal(p.sinal, undefined);
    assert.equal(p.total, 'R$600');
  });

  test('returns null for non-CONFIRMAR string', () => {
    assert.equal(parseConfirmarParams('[COTAR: tipo=ALA_A]'), null);
  });
});

// ── [ESCALAR] ─────────────────────────────────────────────────────────────────
describe('[ESCALAR] parser — structured motivo/nome/interesse', () => {
  test('parses all three fields', () => {
    const sig = '[ESCALAR: motivo=grupo acima de 8 pessoas, nome=Carlos, interesse=12 pessoas 15 a 18 mai precificacao especial]';
    const p = parseEscalarParams(sig);
    assert.equal(p.motivo, 'grupo acima de 8 pessoas');
    assert.equal(p.nome, 'Carlos');
    assert.equal(p.interesse, '12 pessoas 15 a 18 mai precificacao especial');
  });

  test('parses reclamacao with interesse containing spaces', () => {
    const sig = '[ESCALAR: motivo=reclamacao, nome=Pedro, interesse=quarto estava com cheiro de mofo]';
    const p = parseEscalarParams(sig);
    assert.equal(p.motivo, 'reclamacao');
    assert.equal(p.nome, 'Pedro');
    assert.equal(p.interesse, 'quarto estava com cheiro de mofo');
  });

  test('parses cliente pediu humano', () => {
    const sig = '[ESCALAR: motivo=cliente pediu humano, nome=Ana, interesse=queria falar com gerente sobre decoracao]';
    const p = parseEscalarParams(sig);
    assert.equal(p.motivo, 'cliente pediu humano');
    assert.equal(p.nome, 'Ana');
  });

  test('legacy format — motivo only, no key=value', () => {
    const sig = '[ESCALAR: cliente pediu falar com humano]';
    const p = parseEscalarParams(sig);
    assert.equal(p.motivo, 'cliente pediu falar com humano');
    assert.equal(p.nome, undefined);
    assert.equal(p.interesse, undefined);
  });

  test('plain [ESCALAR] with no params', () => {
    const sig = '[ESCALAR]';
    const p = parseEscalarParams(sig);
    assert.equal(p.motivo, null);
  });
});

// ── [COTAR] ───────────────────────────────────────────────────────────────────
describe('[COTAR] parser — existing format unchanged', () => {
  test('parses standard cotar signal', () => {
    const sig = '[COTAR: tipo=ALA_A, data_entrada=07/03/2026, data_saida=09/03/2026, pessoas=2]';
    const p = parseCotarParams(sig);
    assert.equal(p.tipo, 'ALA_A');
    assert.equal(p.data_entrada, '07/03/2026');
    assert.equal(p.data_saida, '09/03/2026');
    assert.equal(p.pessoas, '2');
  });

  test('parses ALA_C_CASAL', () => {
    const sig = '[COTAR: tipo=ALA_C_CASAL, data_entrada=28/03/2026, data_saida=06/04/2026, pessoas=6]';
    const p = parseCotarParams(sig);
    assert.equal(p.tipo, 'ALA_C_CASAL');
  });
});

// ── Signal extraction from full Luna response ─────────────────────────────────
describe('Signal extraction from full response text', () => {
  test('CONFIRMAR extracted from response with prefix text', () => {
    const response = 'Ótimo! Finalizando sua reserva — em instantes você recebe a chave PIX para o pagamento do sinal. [CONFIRMAR: nome=Carlos, entrada=07/03/2026, saida=09/03/2026, tipo=ALA_A, pessoas=2, total=R$600, sinal=R$180]';
    const match = response.match(/\[CONFIRMAR:[^\]]+\]/);
    assert.ok(match, 'CONFIRMAR signal should be found');
    const p = parseConfirmarParams(match[0]);
    assert.equal(p.sinal, 'R$180');
    // userMsg should be the prefix text
    const userMsg = response.replace(/\[CONFIRMAR:[^\]]+\]/, '').trim();
    assert.ok(userMsg.includes('Finalizando sua reserva'));
  });

  test('ESCALAR extracted from response with prefix text', () => {
    const response = 'Vou chamar a equipe agora para te ajudar com isso! [ESCALAR: motivo=grupo acima de 8 pessoas, nome=Carlos, interesse=evento corporativo 50px]';
    const match = response.match(/\[ESCALAR[^\]]*\]/);
    assert.ok(match, 'ESCALAR signal should be found');
    const p = parseEscalarParams(match[0]);
    assert.equal(p.motivo, 'grupo acima de 8 pessoas');
    assert.equal(p.interesse, 'evento corporativo 50px');
  });

  test('COTAR with "Um momento..." prefix — prefix sent to guest', () => {
    const response = 'Um momento que vou verificar a disponibilidade... [COTAR: tipo=ALA_A, data_entrada=07/03/2026, data_saida=09/03/2026, pessoas=2]';
    const match = response.match(/\[COTAR:[^\]]+\]/);
    assert.ok(match, 'COTAR signal should be found');
    const userMsg = response.replace(/\[COTAR:[^\]]+\]/, '').trim();
    assert.equal(userMsg, 'Um momento que vou verificar a disponibilidade...');
  });
});
