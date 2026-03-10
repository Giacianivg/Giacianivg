const eventBus = require('../../system/eventBus');

class DecisionQueue {
  constructor() {
    this._queue = [];
    this._counter = 1;
  }

  add({ agent, type, action, impact, options, recommendation }) {
    const decision = {
      id: this._counter++,
      agent,
      type,
      action,
      impact,
      options: options || [],
      recommendation: recommendation || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };
    this._queue.unshift(decision);
    eventBus.emit('decision_queued', { id: decision.id, action, agent });
    return decision;
  }

  approve(id) {
    const d = this._queue.find(d => d.id === id);
    if (!d) return null;
    d.status = 'approved';
    d.resolvedAt = new Date().toISOString();
    eventBus.emit('decision_approved', { id, action: d.action, agent: d.agent });
    return d;
  }

  reject(id, reason) {
    const d = this._queue.find(d => d.id === id);
    if (!d) return null;
    d.status = 'rejected';
    d.reason = reason || 'Rejeitado pelo founder';
    d.resolvedAt = new Date().toISOString();
    eventBus.emit('decision_rejected', { id, action: d.action, reason: d.reason });
    return d;
  }

  getPending() { return this._queue.filter(d => d.status === 'pending'); }
  getAll(limit = 50) { return this._queue.slice(0, limit); }
}

module.exports = new DecisionQueue();
