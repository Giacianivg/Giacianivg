'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { getTrainingContext, buildContext, invalidateCache } = require('../services/luna/config-loader');

// ── Mock Supabase ────────────────────────────────────────────────────────────

function makeMockSupabase(rowData, error = null) {
  return {
    from(table) {
      assert.strictEqual(table, 'luna_config');
      return this;
    },
    select()      { return this; },
    order()       { return this; },
    limit()       { return this; },
    async maybeSingle() {
      return { data: rowData, error };
    },
  };
}

// ── buildContext (pure function — no Supabase needed) ────────────────────────

describe('buildContext()', () => {
  it('returns empty string when config is empty', () => {
    assert.strictEqual(buildContext({}), '');
  });

  it('returns empty string when all fields are blank', () => {
    const result = buildContext({
      system_prompt: '   ',
      scripts: { saudacao: '', cotacao: '', objecao: '', fechamento: '' },
      active_packages: [],
    });
    assert.strictEqual(result, '');
  });

  it('includes system_prompt when present', () => {
    const result = buildContext({ system_prompt: 'FAQ: pets são R$20/noite' });
    assert.match(result, /TREINAMENTO ATUALIZADO/);
    assert.match(result, /FAQ: pets são R\$20\/noite/);
  });

  it('includes script fields when not empty', () => {
    const result = buildContext({
      scripts: { saudacao: 'Olá, bem-vindo!', cotacao: '', objecao: '', fechamento: 'Até mais!' },
    });
    assert.match(result, /Saudação: Olá, bem-vindo!/);
    assert.match(result, /Fechamento: Até mais!/);
    assert.doesNotMatch(result, /Cotação/);
  });

  it('includes active packages when present', () => {
    const result = buildContext({
      active_packages: [
        { name: 'Páscoa', description: 'Fim de semana especial', price: 'R$450' },
      ],
    });
    assert.match(result, /Pacotes ativos/);
    assert.match(result, /Páscoa/);
    assert.match(result, /R\$450/);
  });

  it('skips packages with no name or description', () => {
    const result = buildContext({ active_packages: [{}] });
    assert.doesNotMatch(result, /Pacotes ativos/);
  });

  it('combines all sections when all present', () => {
    const result = buildContext({
      system_prompt: 'Info pousada',
      scripts: { saudacao: 'Oi!', cotacao: '', objecao: '', fechamento: '' },
      active_packages: [{ name: 'Verão', description: 'Praia', price: 'R$300' }],
    });
    assert.match(result, /Info pousada/);
    assert.match(result, /Saudação: Oi!/);
    assert.match(result, /Verão/);
  });

  it('handles non-array active_packages gracefully', () => {
    const result = buildContext({ active_packages: null });
    assert.doesNotMatch(result, /Pacotes/);
  });
});

// ── getTrainingContext (async, uses Supabase) ────────────────────────────────

describe('getTrainingContext()', () => {
  beforeEach(() => {
    invalidateCache();
  });

  it('returns formatted string when config has system_prompt', async () => {
    const sb = makeMockSupabase({
      system_prompt: 'Pets aceitos apenas no final de semana',
      scripts: {},
      active_packages: [],
      version: 3,
    });
    const result = await getTrainingContext(sb);
    assert.match(result, /TREINAMENTO ATUALIZADO/);
    assert.match(result, /Pets aceitos/);
  });

  it('returns empty string when no config row exists', async () => {
    const sb = makeMockSupabase(null);
    const result = await getTrainingContext(sb);
    assert.strictEqual(result, '');
  });

  it('returns empty string when Supabase errors', async () => {
    const sb = makeMockSupabase(null, { message: 'relation does not exist' });
    const result = await getTrainingContext(sb);
    assert.strictEqual(result, '');
  });

  it('returns empty string when config fields are all blank', async () => {
    const sb = makeMockSupabase({
      system_prompt: '',
      scripts: { saudacao: '', cotacao: '', objecao: '', fechamento: '' },
      active_packages: [],
    });
    const result = await getTrainingContext(sb);
    assert.strictEqual(result, '');
  });

  it('uses cache on second call (Supabase called only once)', async () => {
    let callCount = 0;
    const sb = {
      from() { callCount++; return this; },
      select() { return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() {
        return { data: { system_prompt: 'cached content', scripts: {}, active_packages: [] }, error: null };
      },
    };

    await getTrainingContext(sb);
    await getTrainingContext(sb);
    // callCount 1 = first call; second call uses cache
    assert.strictEqual(callCount, 1);
  });

  it('invalidateCache() forces fresh fetch', async () => {
    let callCount = 0;
    const sb = {
      from() { callCount++; return this; },
      select() { return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() {
        return { data: { system_prompt: 'fresh', scripts: {}, active_packages: [] }, error: null };
      },
    };

    await getTrainingContext(sb);
    invalidateCache();
    await getTrainingContext(sb);
    assert.strictEqual(callCount, 2);
  });

  it('returns empty string on exception (fail-safe)', async () => {
    const sb = {
      from() { throw new Error('network error'); },
    };
    const result = await getTrainingContext(sb);
    assert.strictEqual(result, '');
  });
});
