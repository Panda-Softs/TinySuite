/**
 * MicroEvent
 * ----------
 * Tiny event emitter used by calendar components.
 */
class MicroEvent {
  constructor() {
    this._events = {};
  }

  /**
   * Register an event listener.
   *
   * @param {string} event - Event name.
   * @param {Function} fn - Listener callback.
   * @returns {MicroEvent}
   */
  on(event, fn) {
    if (!this._events[event]) {
      this._events[event] = [];
    }

    this._events[event].push(fn);

    return this;
  }

  /**
   * Remove an event listener.
   *
   * @param {string} event - Event name.
   * @param {Function} fn - Listener callback.
   * @returns {MicroEvent}
   */
  off(event, fn) {
    const listeners = this._events?.[event];

    if (!listeners) return this;

    const index = listeners.indexOf(fn);

    if (index !== -1) {
      listeners.splice(index, 1);
    }

    return this;
  }

  /**
   * Emit an event to all listeners.
   *
   * @param {string} event - Event name.
   * @param {...*} args - Listener arguments.
   * @returns {MicroEvent}
   */
  _emit(event, ...args) {
    const listeners = this._events?.[event];

    if (!listeners) return this;

    listeners.slice().forEach(fn => fn.apply(this, args));

    return this;
  }
}
