'use strict';

/**
 * Testes do access token da porta pública (DEC-025 Bloco 2).
 * Fixa PUBLIC_TOKEN_SECRET ANTES de importar o módulo para poder forjar
 * um token expirado com a assinatura correta.
 * Run: node --test tests/security/turnstile-token.test.js
 */

process.env.PUBLIC_TOKEN_SECRET = 'test-secret-fixo';
delete process.env.TURNSTILE_SECRET_KEY; // garante caminho "não configurado"

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { issueAccessToken, verifyAccessToken, verifyTurnstile } = require('../../services/security/turnstile');

function sign(exp) {
  return `${exp}.${crypto.createHmac('sha256', 'test-secret-fixo').update(String(exp)).digest('hex')}`;
}

describe('access token', () => {
  it('token recém-emitido é válido', () => {
    assert.equal(verifyAccessToken(issueAccessToken()), true);
  });

  it('token expirado é rejeitado', () => {
    assert.equal(verifyAccessToken(sign(Date.now() - 1000)), false);
  });

  it('assinatura adulterada é rejeitada', () => {
    const exp = Date.now() + 60_000;
    const bad = `${exp}.${'0'.repeat(64)}`;
    assert.equal(verifyAccessToken(bad), false);
  });

  it('formatos inválidos são rejeitados', () => {
    for (const t of [undefined, null, '', 'semponto', '123.', '.abc', 42]) {
      assert.equal(verifyAccessToken(t), false);
    }
  });
});

describe('verifyTurnstile — degradação graciosa', () => {
  it('sem TURNSTILE_SECRET_KEY, verifyTurnstile resolve true (captcha desativado)', async () => {
    assert.equal(await verifyTurnstile(undefined, '127.0.0.1'), true);
  });
});
