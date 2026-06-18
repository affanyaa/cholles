/**
 * Session Wizard - Menyimpan state login multi-step di memory
 * Key: userId, Value: { step, data... }
 */
class SessionWizard {
  constructor() {
    this._state = new Map();
    this._timeoutMs = 10 * 60 * 1000; // 10 minutes timeout
    this._timestamps = new Map();
  }

  /**
   * Set wizard state
   */
  set(userId, step, data = {}) {
    this._state.set(userId, { step, ...data });
    this._timestamps.set(userId, Date.now());
  }

  /**
   * Get wizard state
   */
  get(userId) {
    this._cleanupIfExpired(userId);
    return this._state.get(userId) || null;
  }

  /**
   * Get current step
   */
  getStep(userId) {
    const state = this.get(userId);
    return state?.step || '';
  }

  /**
   * Clear wizard state
   */
  clear(userId) {
    this._state.delete(userId);
    this._timestamps.delete(userId);
  }

  /**
   * Check if wizard is active
   */
  isActive(userId) {
    this._cleanupIfExpired(userId);
    return this._state.has(userId);
  }

  /**
   * Update data without changing step
   */
  update(userId, data) {
    const state = this._state.get(userId);
    if (state) {
      this._state.set(userId, { ...state, ...data });
      this._timestamps.set(userId, Date.now());
    }
  }

  /**
   * Cleanup expired entries
   */
  _cleanupIfExpired(userId) {
    const ts = this._timestamps.get(userId);
    if (ts && Date.now() - ts > this._timeoutMs) {
      this._state.delete(userId);
      this._timestamps.delete(userId);
    }
  }

  /**
   * Cleanup all expired entries
   */
  cleanupAll() {
    const now = Date.now();
    for (const [userId, ts] of this._timestamps.entries()) {
      if (now - ts > this._timeoutMs) {
        this._state.delete(userId);
        this._timestamps.delete(userId);
      }
    }
  }
}

// Singleton
export const sessionWizard = new SessionWizard();

// Auto cleanup every 5 minutes
setInterval(() => sessionWizard.cleanupAll(), 5 * 60 * 1000);