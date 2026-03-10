const EventEmitter = require('events');

class LuzDaLuaEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
    this._history = [];
  }

  emit(event, data) {
    const entry = {
      id: Date.now(),
      time: new Date().toISOString(),
      event,
      data: data || {},
      source: data?.source || 'system'
    };
    this._history.unshift(entry);
    if (this._history.length > 100) this._history.pop();
    console.log(`[EventBus] ${event}`, JSON.stringify(data || {}));
    return super.emit(event, data);
  }

  getHistory(limit = 20) {
    return this._history.slice(0, limit);
  }
}

module.exports = new LuzDaLuaEventBus();

// ─── Blackboard Listeners — DEC-007 ────────────────────────────────────────────
// Append only — não modifica lógica existente do EventBus
// Writes são fire-and-forget (set() nunca bloqueia)

const blackboard = require('./blackboard');

module.exports.on('lead_received', async (data) => {
  const leads = await blackboard.get('leads') || {};
  blackboard.set('leads', {
    ...leads,
    total: (leads.total || 0) + 1,
    ativos: (leads.ativos || 0) + 1,
    ultimo_update: new Date().toISOString(),
  });
});

module.exports.on('booking_confirmed', async (data) => {
  const reservas = await blackboard.get('reservas') || {};
  blackboard.set('reservas', {
    ...reservas,
    hoje: (reservas.hoje || 0) + 1,
    mes: (reservas.mes || 0) + 1,
  });
});

module.exports.on('message_received', async () => {
  const leads = await blackboard.get('leads') || {};
  blackboard.set('leads', { ...leads, ultimo_update: new Date().toISOString() });
});
