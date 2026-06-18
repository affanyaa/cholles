import { CONFIG } from '../config.js';
import logger from '../logger.js';
import DB from '../database.js';
import { clientRegistry } from './clientRegistry.js';
import { Messages } from '../utils/messages.js';
import { h, trunc } from '../utils/helpers.js';

/**
 * Promo state per account (runtime)
 */
export class PromoState {
  constructor(accountId) {
    this.accountId = accountId;
    this.active = false;
    this.text = '';
    this.groups = [];
    this.blacklist = new Set();
    this.failCount = new Map();
    this.task = null;
    this.abortController = null;
    this.stats = {
      totalSent: 0,
      totalFail: 0,
      rounds: 0,
      roundOk: 0,
      roundFail: 0,
    };
  }

  shouldStop() {
    return !this.active || this.abortController?.signal.aborted;
  }

  async stop() {
    if (!this.active) return false;
    this.active = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.task) {
      try {
        await Promise.race([
          this.task,
          new Promise(r => setTimeout(r, 10000)),
        ]);
      } catch {
        // ignore
      }
      this.task = null;
    }
    return true;
  }

  addToBlacklist(groupId) {
    this.blacklist.add(Number(groupId));
    this.failCount.delete(Number(groupId));
    const idx = this.groups.indexOf(Number(groupId));
    if (idx > -1) this.groups.splice(idx, 1);
  }

  incrementFail(groupId) {
    const current = this.failCount.get(Number(groupId)) || 0;
    this.failCount.set(Number(groupId), current + 1);
    return current + 1;
  }

  resetFail(groupId) {
    this.failCount.delete(Number(groupId));
  }
}

/**
 * Promo State Manager
 */
class PromoStateManager {
  constructor() {
    this._states = new Map();
  }

  async get(accountId) {
    accountId = Number(accountId);
    if (!this._states.has(accountId)) {
      const bl = await DB.getBlacklist(accountId);
      const promo = await DB.getOrCreatePromo(accountId);
      const state = new PromoState(accountId);
      state.blacklist = bl;
      state.text = promo.promo_text || '';
      state.stats.totalSent = promo.total_sent || 0;
      state.stats.totalFail = promo.total_fail || 0;
      state.stats.rounds = promo.rounds || 0;
      this._states.set(accountId, state);
    }
    return this._states.get(accountId);
  }

  remove(accountId) {
    const state = this._states.get(Number(accountId));
    if (state) {
      state.stop();
      this._states.delete(Number(accountId));
    }
  }

  getAll() {
    return new Map(this._states);
  }
}

export const promoManager = new PromoStateManager();

/**
 * Scan groups for an account
 */
export async function scanGroups(accountId) {
  const client = clientRegistry.get(accountId);
  if (!client) {
    logger.warn(`[ACC#${accountId}] scanGroups: client not found`);
    return [];
  }

  const state = await promoManager.get(accountId);
  const groups = [];
  const seen = new Set();

  try {
    const dialogs = await client.getDialogs({ limit: 500 });
    for (const dialog of dialogs) {
      if (dialog.isGroup || dialog.isChannel) {
        const id = Number(dialog.id?.value || dialog.id);
        if (id && !seen.has(id) && !state.blacklist.has(id)) {
          groups.push(id);
          seen.add(id);
        }
      }
    }
  } catch (err) {
    logger.error(`[ACC#${accountId}] scanGroups error: ${err.message}`);
    return groups; // Return what we got
  }

  // Limit max groups per round
  if (groups.length > CONFIG.MAX_GROUPS_PER_ROUND) {
    logger.warn(`[ACC#${accountId}] Limiting groups from ${groups.length} to ${CONFIG.MAX_GROUPS_PER_ROUND}`);
    return groups.slice(0, CONFIG.MAX_GROUPS_PER_ROUND);
  }

  logger.info(`[ACC#${accountId}] scanGroups: ${groups.length} groups found`);
  return groups;
}

/**
 * Send message to a single group
 */
export async function sendToGroup(accountId, groupId, text) {
  const client = clientRegistry.get(accountId);
  if (!client) return false;

  const state = await promoManager.get(accountId);

  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      await client.sendMessage(groupId, { message: text });
      state.resetFail(groupId);
      return true;
    } catch (err) {
      const errMsg = err.message || '';
      const errType = err.code || '';

      // Permanent errors → blacklist immediately
      if (
        errMsg.includes('CHAT_WRITE_FORBIDDEN') ||
        errMsg.includes('USER_BANNED') ||
        errMsg.includes('CHANNEL_PRIVATE') ||
        errMsg.includes('PEER_ID_INVALID') ||
        errMsg.includes('CHAT_ADMIN_REQUIRED') ||
        errMsg.includes('USER_NOT_PARTICIPANT') ||
        errMsg.includes('MSG_ID_INVALID') ||
        errType === 'CHAT_WRITE_FORBIDDEN' ||
        errType === 'USER_BANNED_IN_CHANNEL' ||
        errType === 'CHANNEL_PRIVATE' ||
        errType === 'PEER_ID_INVALID'
      ) {
        state.addToBlacklist(groupId);
        await DB.addBlacklist(accountId, groupId, errMsg.slice(0, 64));
        return false;
      }

      // Account deactivated
      if (errMsg.includes('USER_DEACTIVATED') || errMsg.includes('SESSION_REVOKED')) {
        logger.critical(`[ACC#${accountId}] Account/session invalid!`);
        await state.stop();
        await DB.setActive(accountId, false);
        await DB.updatePromo(accountId, { active: 0 });
        return false;
      }

      // Auth key unregistered
      if (errMsg.includes('AUTH_KEY_UNREGISTERED') || errMsg.includes('SESSION_EXPIRED')) {
        logger.critical(`[ACC#${accountId}] Session invalid!`);
        await state.stop();
        await DB.setActive(accountId, false);
        await DB.updatePromo(accountId, { active: 0 });
        return false;
      }

      // Flood wait
      if (errMsg.includes('FLOOD_WAIT') || errType === 'FLOOD') {
        const match = errMsg.match(/(\d+)/);
        const wait = match ? parseInt(match[1], 10) + 3 : 60;
        logger.warn(`[ACC#${accountId}] FloodWait ${wait}s for group ${groupId}`);
        if (wait > CONFIG.FLOOD_WAIT_LONG) return false;
        await cancellableDelay(wait * 1000, state.abortController?.signal);
        if (state.shouldStop()) return false;
        continue;
      }

      // Slowmode
      if (errMsg.includes('SLOWMODE_WAIT')) {
        const match = errMsg.match(/(\d+)/);
        const wait = match ? parseInt(match[1], 10) + 2 : 60;
        if (wait > CONFIG.SLOWMODE_WAIT_LONG) return false;
        await cancellableDelay(wait * 1000, state.abortController?.signal);
        if (state.shouldStop()) return false;
        continue;
      }

      // Retry with backoff
      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        await cancellableDelay(delay, state.abortController?.signal);
        if (state.shouldStop()) return false;
      }
    }
  }

  return false;
}

/**
 * Cancellable delay helper
 */
async function cancellableDelay(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Main promo loop for an account
 */
export async function promoLoop(accountId) {
  logger.info(`[ACC#${accountId}] Promo loop started`);
  const state = await promoManager.get(accountId);

  try {
    while (!state.shouldStop()) {
      // Ensure we have groups
      if (!state.groups.length) {
        const newGroups = await scanGroups(accountId);
        if (!newGroups.length) {
          logger.warn(`[ACC#${accountId}] No groups available!`);
          break;
        }
        state.groups = newGroups;
      }

      // Start round
      state.stats.roundOk = 0;
      state.stats.roundFail = 0;
      const currentGroups = [...state.groups];
      const total = currentGroups.length;
      const roundNum = state.stats.rounds + 1;

      logger.info(`[ACC#${accountId}] Round ${roundNum} | ${total} groups`);

      for (let i = 0; i < currentGroups.length; i++) {
        if (state.shouldStop()) return;

        const gid = currentGroups[i];
        if (state.blacklist.has(gid)) {
          state.stats.roundFail++;
          continue;
        }

        const success = await sendToGroup(accountId, gid, state.text);

        if (state.shouldStop()) return;

        if (success) {
          state.stats.roundOk++;
        } else {
          state.stats.roundFail++;
          if (!state.blacklist.has(gid)) {
            const consec = state.incrementFail(gid);
            if (consec >= CONFIG.MAX_FAIL_BEFORE_BL) {
              state.addToBlacklist(gid);
              await DB.addBlacklist(accountId, gid, 'auto-blacklist');
            }
          }
        }

        // Log progress every 10 groups
        if ((i + 1) % 10 === 0 || (i + 1) === total) {
          logger.info(
            `[ACC#${accountId}] ${i + 1}/${total} ` +
            `OK:${state.stats.roundOk} FAIL:${state.stats.roundFail}`
          );
        }
      }

      // Update stats
      const ok = state.stats.roundOk;
      const fail = state.stats.roundFail;
      state.stats.totalSent += ok;
      state.stats.totalFail += fail;
      state.stats.rounds++;

      await DB.updatePromo(accountId, {
        totalSent: state.stats.totalSent,
        totalFail: state.stats.totalFail,
        rounds: state.stats.rounds,
      });

      if (state.shouldStop()) return;

      logger.info(`[ACC#${accountId}] Round ${state.stats.rounds} complete: ${ok} ok, ${fail} fail`);

      // Wait between rounds
      if (!state.shouldStop()) {
        await cancellableDelay(
          CONFIG.DELAY_BETWEEN_ROUNDS * 1000,
          state.abortController?.signal
        );
      }
    }
  } catch (err) {
    if (err.message?.includes('aborted')) {
      logger.info(`[ACC#${accountId}] Promo loop aborted`);
    } else {
      logger.error(`[ACC#${accountId}] Promo loop error: ${err.message}`);
    }
  } finally {
    state.active = false;
    await DB.updatePromo(accountId, { active: 0 });
    logger.info(`[ACC#${accountId}] Promo loop ended`);
  }
}