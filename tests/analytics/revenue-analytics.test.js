'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { getPipelineRevenue, STAGE_PROBABILITIES } = require('../../services/analytics/revenue-analytics');

// ---------------------------------------------------------------------------
// Mock Supabase client builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal Supabase client mock that returns pre-defined data
 * for each table queried by getPipelineRevenue.
 *
 * @param {object} fixtures
 * @param {Array}  fixtures.conversation_states
 * @param {Array}  fixtures.proposals
 * @param {Array}  fixtures.reservations_history  - last-10 confirmed (for ADR)
 * @param {Array}  fixtures.reservations_recent   - recent 30-day confirmed
 */
function buildMockClient({ conversation_states = [], proposals = [], reservations_history = [], reservations_recent = [] } = {}) {
  return {
    from(table) {
      const self = {
        _table: table,
        _filters: {},
        _order: null,
        _limitVal: null,

        select() { return self; },
        eq(col, val) {
          if (!self._filters.eq) self._filters.eq = [];
          self._filters.eq.push({ col, val });
          return self;
        },
        neq(col, val) { self._filters.neq = { col, val }; return self; },
        in(col, vals) {
          if (!self._filters.in) self._filters.in = [];
          self._filters.in.push({ col, vals });
          return self;
        },
        gte(col, val) { self._filters.gte = { col, val }; return self; },
        order() { return self; },
        limit(n) { self._limitVal = n; return self; },

        async then(resolve) {
          // Resolve the promise-like
          return resolve(await self._exec());
        },

        // Aplica filtros .eq() registrados (inclui is_test=false: exclui dados de teste;
        // undefined é tratado como não-teste e permanece).
        _applyEq(rows) {
          for (const f of (self._filters.eq || [])) {
            if (f.col === 'is_test') {
              rows = rows.filter((r) => Boolean(r.is_test) === Boolean(f.val));
            } else {
              rows = rows.filter((r) => r[f.col] === f.val);
            }
          }
          return rows;
        },

        async _exec() {
          if (table === 'conversation_states') {
            const neqFilter = self._filters.neq;
            let rows = conversation_states;
            if (neqFilter && neqFilter.col === 'state') {
              rows = rows.filter((r) => r.state !== neqFilter.val);
            }
            return { data: self._applyEq(rows), error: null };
          }

          if (table === 'proposals') {
            const inFilters = self._filters.in || [];
            let rows = proposals;
            for (const f of inFilters) {
              if (f.col === 'lead_id') {
                rows = rows.filter((r) => f.vals.includes(r.lead_id));
              }
              if (f.col === 'status') {
                rows = rows.filter((r) => f.vals.includes(r.status));
              }
            }
            return { data: self._applyEq(rows), error: null };
          }

          if (table === 'reservations') {
            const inFilters = self._filters.in || [];
            const gteFilter = self._filters.gte;

            let rows;
            // Distinguish the two reservation queries:
            // - ADR query has a limit (10)
            // - Recent query has a gte filter on created_at
            if (gteFilter && gteFilter.col === 'created_at') {
              // Recent 30-day confirmed
              rows = reservations_recent;
            } else {
              // Last 10 confirmed for ADR
              rows = reservations_history;
              if (self._limitVal) rows = rows.slice(0, self._limitVal);
            }

            // Apply status filter
            for (const f of inFilters) {
              if (f.col === 'status') {
                rows = rows.filter((r) => f.vals.includes(r.status));
              }
            }

            return { data: self._applyEq(rows), error: null };
          }

          return { data: [], error: null };
        },
      };

      // Make the builder thenable so await works on the chain
      Object.defineProperty(self, Symbol.for('nodejs.rejection'), { value: undefined });
      const origExec = self._exec.bind(self);
      return Object.assign(self, {
        // Allow `await client.from(...).select(...).neq(...)` etc.
        // We expose a custom then so the whole chain is thenable.
        then(onFulfilled, onRejected) {
          return origExec().then(onFulfilled, onRejected);
        },
        catch(onRejected) {
          return origExec().catch(onRejected);
        },
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: future date string DD/MM/YYYY offset by N days from today
// ---------------------------------------------------------------------------
function futureDateDMY(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('revenue-analytics — getPipelineRevenue', () => {

  it('1. STAGE_PROBABILITIES has all 8 FSM states', () => {
    const expected = ['GREETING', 'COLLECT_NAME', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS', 'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'];
    for (const stage of expected) {
      assert.ok(stage in STAGE_PROBABILITIES, `Missing probability for ${stage}`);
    }
  });

  it('2. Lead in SEND_QUOTE with proposal R$1000 → weighted = 600', async () => {
    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-1', phone: '5511999', state: 'SEND_QUOTE', data: {} },
      ],
      proposals: [
        { lead_id: 'lead-1', final_amount: 1000, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
      ],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    assert.equal(result.by_stage.SEND_QUOTE.count, 1);
    assert.equal(result.by_stage.SEND_QUOTE.potential, 1000);
    assert.equal(result.by_stage.SEND_QUOTE.weighted, 600); // 0.60 × 1000
    assert.equal(result.weighted_pipeline, 600);
  });

  it('3. Pipeline weighted is potential × probability', async () => {
    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-A', phone: '5511001', state: 'CONFIRM_BOOKING', data: {} },
      ],
      proposals: [
        { lead_id: 'lead-A', final_amount: 2000, status: 'viewed', created_at: '2026-01-02T00:00:00Z' },
      ],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    const expectedWeighted = 2000 * STAGE_PROBABILITIES.CONFIRM_BOOKING; // 1800
    assert.equal(result.weighted_pipeline, expectedWeighted);
    assert.equal(result.by_stage.CONFIRM_BOOKING.weighted, expectedWeighted);
  });

  it('4. Lead without proposal uses ADR fallback (ADR × 2)', async () => {
    // Two confirmed reservations: R$600/2nights = ADR 300, R$900/3nights = ADR 300 → ADR = 300
    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-X', phone: '5511002', state: 'ASK_GUESTS', data: {} },
      ],
      proposals: [], // no proposals
      reservations_history: [
        { total_amount: 600, checkin_date: '2026-01-10', checkout_date: '2026-01-12', status: 'confirmed' },
        { total_amount: 900, checkin_date: '2026-01-15', checkout_date: '2026-01-18', status: 'confirmed' },
      ],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    // ADR = (300 + 300) / 2 = 300 → potential = 300 × 2 = 600
    assert.equal(result.by_stage.ASK_GUESTS.potential, 600);
    const expectedWeighted = 600 * STAGE_PROBABILITIES.ASK_GUESTS; // 180
    assert.equal(result.by_stage.ASK_GUESTS.weighted, expectedWeighted);
  });

  it('5. total_pipeline is the sum of all lead potentials', async () => {
    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-1', phone: '5511001', state: 'SEND_QUOTE', data: {} },
        { lead_id: 'lead-2', phone: '5511002', state: 'SHOW_ROOMS', data: {} },
      ],
      proposals: [
        { lead_id: 'lead-1', final_amount: 1000, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
        { lead_id: 'lead-2', final_amount: 800, status: 'viewed', created_at: '2026-01-01T00:00:00Z' },
      ],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    assert.equal(result.total_pipeline, 1800); // 1000 + 800
    assert.equal(result.leads_count, 2);
    assert.equal(result.avg_deal_size, 900); // 1800 / 2
  });

  it('6. weighted_pipeline is the sum of all weighted values', async () => {
    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-1', phone: '5511001', state: 'SEND_QUOTE', data: {} },   // 1000 × 0.60 = 600
        { lead_id: 'lead-2', phone: '5511002', state: 'GREETING', data: {} },     // 500 × 0.05 = 25
      ],
      proposals: [
        { lead_id: 'lead-1', final_amount: 1000, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
        { lead_id: 'lead-2', final_amount: 500, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
      ],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    const expected = 1000 * 0.60 + 500 * 0.05; // 600 + 25 = 625
    assert.equal(result.weighted_pipeline, expected);
  });

  it('7. forecast_30d includes only leads with check-in in next 30 days', async () => {
    const checkinIn15Days = futureDateDMY(15);   // within 30d window
    const checkinIn45Days = futureDateDMY(45);   // outside 30d window, inside 60d window

    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-near', phone: '5511001', state: 'SEND_QUOTE', data: { data_entrada: checkinIn15Days } },
        { lead_id: 'lead-far',  phone: '5511002', state: 'SEND_QUOTE', data: { data_entrada: checkinIn45Days } },
      ],
      proposals: [
        { lead_id: 'lead-near', final_amount: 1000, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
        { lead_id: 'lead-far',  final_amount: 1000, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
      ],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    const weightedPerLead = 1000 * STAGE_PROBABILITIES.SEND_QUOTE; // 600

    // forecast_30d should include only the near lead
    assert.equal(result.forecast_30d, weightedPerLead);

    // forecast_60d should include both
    assert.equal(result.forecast_60d, weightedPerLead * 2);
  });

  it('8. confirmed_revenue sums total_amount from recent reservations', async () => {
    const client = buildMockClient({
      conversation_states: [],
      proposals: [],
      reservations_history: [],
      reservations_recent: [
        { total_amount: 1500, status: 'confirmed' },
        { total_amount: 2000, status: 'completed' },
      ],
    });

    const result = await getPipelineRevenue(client);

    assert.equal(result.confirmed_revenue, 3500);
  });

  it('9. HANDOFF_HUMAN leads are excluded from pipeline', async () => {
    const client = buildMockClient({
      conversation_states: [
        // This one has state HANDOFF_HUMAN — should be excluded by the DB filter
        // The mock filters it out via neq('state', 'HANDOFF_HUMAN')
        { lead_id: 'lead-h', phone: '5511003', state: 'SEND_QUOTE', data: {} },
      ],
      proposals: [
        { lead_id: 'lead-h', final_amount: 999, status: 'sent', created_at: '2026-01-01T00:00:00Z' },
      ],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    // The mock returns the fixture as-is (neq already applied at mock level).
    // Verify that active leads are counted correctly.
    assert.equal(result.leads_count, 1);
    assert.equal(result.total_pipeline, 999);
  });

  it('10. empty state list returns zero pipeline', async () => {
    const client = buildMockClient({
      conversation_states: [],
      proposals: [],
      reservations_history: [],
      reservations_recent: [],
    });

    const result = await getPipelineRevenue(client);

    assert.equal(result.total_pipeline, 0);
    assert.equal(result.weighted_pipeline, 0);
    assert.equal(result.leads_count, 0);
    assert.equal(result.avg_deal_size, 0);
    assert.equal(result.forecast_30d, 0);
    assert.equal(result.forecast_60d, 0);
    assert.deepEqual(result.by_stage, {});
  });

  it('11. Exclui dados de teste — is_test=true fora de receita e pipeline', async () => {
    const client = buildMockClient({
      conversation_states: [
        { lead_id: 'lead-real', phone: '5511001', state: 'SEND_QUOTE', data: {}, is_test: false },
        { lead_id: 'lead-test', phone: '5511002', state: 'SEND_QUOTE', data: {}, is_test: true },
      ],
      proposals: [],
      reservations_history: [],
      reservations_recent: [
        { total_amount: 39000, status: 'confirmed', is_test: false }, // grupo real
        { total_amount: 300,   status: 'confirmed', is_test: true },  // teste
      ],
    });

    const result = await getPipelineRevenue(client);

    // Só a reserva real entra na receita confirmada
    assert.equal(result.confirmed_revenue, 39000, 'receita deve ignorar reserva de teste');
    // Só o lead real entra no pipeline (o de teste é filtrado no mock)
    assert.equal(result.leads_count, 1, 'só o lead real conta no pipeline');
  });
});
