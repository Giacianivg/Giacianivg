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
