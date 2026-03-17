'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { saveMessages, getRecentHistory, MAX_HISTORY_MESSAGES } = require('../services/conversations/history');

// ── Mock Supabase ────────────────────────────────────────────────────────────

function makeSaveSupabase(onInsert) {
  return {
    from(table) {
      assert.strictEqual(table, 'conversations');
      return this;
    },
    insert(rows) {
      if (onInsert) onInsert(rows);
      return Promise.resolve({ error: null });
    },
  };
}

function makeSelectSupabase(rows, error = null) {
  return {
    _rows: rows,
    from(table) {
      assert.strictEqual(table, 'conversations');
      return this;
    },
    select()  { return this; },
    eq()      { return this; },
    order()   { return this; },
    limit()   { return this; },
    async then(resolve) {
      return resolve({ data: this._rows, error });
    },
    // Support await directly
    [Symbol.asyncIterator]: undefined,
  };
}

// Build a mock that chains properly for getRecentHistory
function makeHistorySupabase(rows, error = null) {
  const chain = {
    from(table) {
      assert.strictEqual(table, 'conversations');
      return this;
    },
    select() { return this; },
    eq(field, value) {
      this._phone = value;
      return this;
    },
    order() { return this; },
    limit() { return this; },
  };
  // Make it thenable (await chain)
  chain.then = function (resolve, reject) {
    return Promise.resolve({ data: rows, error }).then(resolve, reject);
  };
  return chain;
}

// ── saveMessages ─────────────────────────────────────────────────────────────

describe('saveMessages()', () => {
  it('inserts user and assistant rows', async () => {
    let inserted = null;
    const sb = makeSaveSupabase(rows => { inserted = rows; });
    // Patch insert to return properly
    sb.insert = (rows) => {
      inserted = rows;
      return Promise.resolve({ error: null });
    };

    await saveMessages(sb, 'lead-123', '5519999', 'Olá', 'Oi! Como posso ajudar?');

    assert.ok(inserted);
    assert.strictEqual(inserted.length, 2);
    assert.strictEqual(inserted[0].role, 'user');
    assert.strictEqual(inserted[0].content, 'Olá');
    assert.strictEqual(inserted[0].lead_id, 'lead-123');
    assert.strictEqual(inserted[1].role, 'assistant');
    assert.strictEqual(inserted[1].content, 'Oi! Como posso ajudar?');
  });

  it('is a no-op when leadId is missing', async () => {
    let called = false;
    const sb = { from() { called = true; return this; } };
    await saveMessages(sb, null, '5519999', 'msg', 'resp');
    assert.strictEqual(called, false);
  });

  it('is a no-op when phone is missing', async () => {
    let called = false;
    const sb = { from() { called = true; return this; } };
    await saveMessages(sb, 'lead-1', '', 'msg', 'resp');
    assert.strictEqual(called, false);
  });

  it('is a no-op when content is empty', async () => {
    let called = false;
    const sb = { from() { called = true; return this; } };
    await saveMessages(sb, 'lead-1', '5519999', '', 'resp');
    assert.strictEqual(called, false);
  });

  it('logs warning but does not throw on Supabase error', async () => {
    const sb = {
      from() { return this; },
      insert: () => Promise.resolve({ error: { message: 'insert failed' } }),
    };
    // Should not throw
    await assert.doesNotReject(() => saveMessages(sb, 'lead-1', '55199', 'msg', 'resp'));
  });
});

// ── getRecentHistory ─────────────────────────────────────────────────────────

describe('getRecentHistory()', () => {
  it('returns messages in chronological order (oldest first)', async () => {
    const sb = makeHistorySupabase([
      { role: 'assistant', content: 'Olá!', created_at: '2026-03-17T10:01:00Z' },
      { role: 'user', content: 'Oi',       created_at: '2026-03-17T10:00:00Z' },
    ]);

    const result = await getRecentHistory(sb, '5519999');

    assert.strictEqual(result.length, 2);
    // reverse() puts oldest first: user before assistant
    assert.strictEqual(result[0].role, 'user');
    assert.strictEqual(result[0].content, 'Oi');
    assert.strictEqual(result[1].role, 'assistant');
  });

  it('returns only role and content fields', async () => {
    const sb = makeHistorySupabase([
      { role: 'user', content: 'Bom dia', created_at: '2026-03-17T09:00:00Z' },
    ]);

    const result = await getRecentHistory(sb, '5519999');
    assert.deepStrictEqual(Object.keys(result[0]).sort(), ['content', 'role']);
  });

  it('returns empty array when no rows found', async () => {
    const sb = makeHistorySupabase([]);
    const result = await getRecentHistory(sb, '5519999');
    assert.deepStrictEqual(result, []);
  });

  it('returns empty array when data is null', async () => {
    const sb = makeHistorySupabase(null);
    const result = await getRecentHistory(sb, '5519999');
    assert.deepStrictEqual(result, []);
  });

  it('returns empty array on Supabase error', async () => {
    const sb = makeHistorySupabase(null, { message: 'relation does not exist' });
    const result = await getRecentHistory(sb, '5519999');
    assert.deepStrictEqual(result, []);
  });

  it('returns empty array when phone is missing', async () => {
    const sb = { from() { throw new Error('should not be called'); } };
    const result = await getRecentHistory(sb, '');
    assert.deepStrictEqual(result, []);
  });

  it('MAX_HISTORY_MESSAGES is 20', () => {
    assert.strictEqual(MAX_HISTORY_MESSAGES, 20);
  });
});
