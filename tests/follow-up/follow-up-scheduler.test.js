'use strict';

/**
 * Unit tests for Follow-up Scheduler — Feature 2: Follow-up Automático
 * Run with: node --test tests/follow-up/follow-up-scheduler.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// MockSupabase — simulates Supabase chained query builder
// Follows the exact pattern established in tests/scoring/lead-scorer.test.js
// ---------------------------------------------------------------------------

class MockQueryBuilder {
  constructor(result) {
    this._result = result;
  }
  select() { return this; }
  eq() { return this; }
  limit() { return this; }
  order() { return this; }
  single() { return Promise.resolve(this._result); }
  then(resolve) { return Promise.resolve(this._result).then(resolve); }
}

class MockSchedulerSupabase {
  constructor() {
    this.store = [];
    this._insertError = null;
    this._updateError = null;
  }

  from(table) {
    const self = this;

    return {
      select(_fields) {
        return new MockQueryBuilder({ data: [], error: null });
      },

      insert(rows) {
        if (self._insertError) {
          return { data: null, error: self._insertError };
        }
        const arr = Array.isArray(rows) ? rows : [rows];
        arr.forEach(r => self.store.push({ ...r, __table: table }));
        return { data: arr, error: null };
      },

      update(fields) {
        return {
          eq(col, val) {
            const chain = {
              _filters: { [col]: val },
              eq(col2, val2) {
                this._filters[col2] = val2;
                return this;
              },
              select(_f) {
                // Apply update to matching rows
                const filters = this._filters;
                const matching = self.store.filter(r =>
                  r.__table === table &&
                  Object.entries(filters).every(([k, v]) => r[k] === v)
                );
                if (self._updateError) {
                  return new MockQueryBuilder({ data: null, error: self._updateError });
                }
                matching.forEach(r => Object.assign(r, fields));
                return new MockQueryBuilder({ data: matching, error: null });
              },
              then(resolve) {
                // Direct await without .select()
                const filters = this._filters;
                const matching = self.store.filter(r =>
                  r.__table === table &&
                  Object.entries(filters).every(([k, v]) => r[k] === v)
                );
                if (self._updateError) {
                  return Promise.resolve({ data: null, error: self._updateError }).then(resolve);
                }
                matching.forEach(r => Object.assign(r, fields));
                return Promise.resolve({ data: matching, error: null }).then(resolve);
              },
            };
            return chain;
          },
        };
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helper: inject mock supabase and load scheduler fresh each test suite
// ---------------------------------------------------------------------------

function makeScheduler(mockDb) {
  const clientPath = require.resolve('../../services/supabase/client');
  const schedulerPath = require.resolve('../../services/follow-up/follow-up-scheduler');

  delete require.cache[clientPath];
  delete require.cache[schedulerPath];

  require.cache[clientPath] = {
    id: clientPath,
    filename: clientPath,
    loaded: true,
    exports: { supabaseAdmin: mockDb },
  };

  return require('../../services/follow-up/follow-up-scheduler');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('follow-up-scheduler', () => {
  let db;

  beforeEach(() => {
    db = new MockSchedulerSupabase();
  });

  it('scheduleFollowUps agenda exatamente 3 follow-ups para quote_sent', async () => {
    const scheduler = makeScheduler(db);
    const leadId = 'lead-uuid-001';
    const phone = '5511999990000';

    const result = await scheduler.scheduleFollowUps(leadId, phone, 'quote_sent');

    assert.equal(result.scheduled, 3, 'deve agendar 3 follow-ups');

    const inserted = db.store.filter(
      r => r.__table === 'scheduled_follow_ups' && r.lead_id === leadId
    );
    assert.equal(inserted.length, 3, 'deve ter 3 registros no store');

    const types = inserted.map(r => r.follow_up_type).sort();
    assert.deepEqual(types, [
      'quote_abandoned_1h',
      'quote_abandoned_24h',
      'quote_abandoned_72h',
    ]);
  });

  it('cancelFollowUps marca todos os pendentes como cancelled', async () => {
    const scheduler = makeScheduler(db);
    const leadId = 'lead-uuid-002';
    const phone = '5511999990001';

    // Pre-populate store with 2 pending follow-ups for this lead
    db.store.push(
      {
        __table: 'scheduled_follow_ups',
        id: 'fu-01',
        lead_id: leadId,
        status: 'pending',
        phone,
        follow_up_type: 'quote_abandoned_1h',
        template_name: 'quote_abandoned_1h',
      },
      {
        __table: 'scheduled_follow_ups',
        id: 'fu-02',
        lead_id: leadId,
        status: 'pending',
        phone,
        follow_up_type: 'quote_abandoned_24h',
        template_name: 'quote_abandoned_24h',
      }
    );

    const result = await scheduler.cancelFollowUps(leadId);

    assert.equal(result.cancelled, 2, 'deve cancelar 2 follow-ups');

    const stillPending = db.store.filter(
      r =>
        r.__table === 'scheduled_follow_ups' &&
        r.lead_id === leadId &&
        r.status === 'pending'
    );
    assert.equal(stillPending.length, 0, 'nenhum deve ficar pendente');
  });

  it('chamada dupla de scheduleFollowUps cancela os anteriores antes de criar novos', async () => {
    const scheduler = makeScheduler(db);
    const leadId = 'lead-uuid-003';
    const phone = '5511999990002';

    // First call — schedules 3
    await scheduler.scheduleFollowUps(leadId, phone, 'quote_sent');
    const afterFirst = db.store.filter(
      r =>
        r.__table === 'scheduled_follow_ups' &&
        r.lead_id === leadId &&
        r.status === 'pending'
    );
    assert.equal(afterFirst.length, 3, 'deve ter 3 pendentes após primeira chamada');

    // Second call — must cancel the 3 previous ones and schedule 3 new
    const result = await scheduler.scheduleFollowUps(leadId, phone, 'quote_sent');

    assert.equal(result.cancelled, 3, 'deve cancelar os 3 anteriores');
    assert.equal(result.scheduled, 3, 'deve agendar 3 novos');

    const pendingAfterSecond = db.store.filter(
      r =>
        r.__table === 'scheduled_follow_ups' &&
        r.lead_id === leadId &&
        r.status === 'pending'
    );
    assert.equal(pendingAfterSecond.length, 3, 'deve ter exatamente 3 pendentes no total');
  });

  it('template quote_abandoned_1h usa o nome do lead', () => {
    delete require.cache[require.resolve('../../services/follow-up/templates')];
    const { templates } = require('../../services/follow-up/templates');

    const message = templates.quote_abandoned_1h({
      name: 'Ana',
      checkIn: '10/07/2026',
      checkOut: '15/07/2026',
    });

    assert.ok(message.includes('Ana'), 'mensagem deve conter o nome do lead');
    assert.ok(message.length > 20, 'mensagem deve ter conteúdo relevante');
  });
});
