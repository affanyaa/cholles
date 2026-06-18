import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { CONFIG } from './config.js';
import logger from './logger.js';

// Ensure directories
const dbDir = dirname(CONFIG.DB_PATH);
try {
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(CONFIG.SESSION_DIR, { recursive: true });
} catch { /* ignore */ }

// In-memory storage
let data = {
  user_accounts: [],
  promo_sessions: [],
  blacklist: [],
  otp_log: [],
  pending_sessions: [],
};

let nextId = {
  user_accounts: 1,
  promo_sessions: 1,
  blacklist: 1,
  otp_log: 1,
  pending_sessions: 1,
};

// Load from file if exists
const DB_FILE = CONFIG.DB_PATH.replace(/\.db$/, '.json');

function load() {
  try {
    if (existsSync(DB_FILE)) {
      const raw = readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      data = loaded.data || data;
      nextId = loaded.nextId || nextId;
      logger.info(`Database loaded from ${DB_FILE}`);
    }
  } catch (err) {
    logger.error(`Failed to load database: ${err.message}`);
  }
}

function save() {
  try {
    writeFileSync(DB_FILE, JSON.stringify({ data, nextId }, null, 2));
  } catch (err) {
    logger.error(`Failed to save database: ${err.message}`);
  }
}

// Auto-save every 30 seconds
setInterval(save, 30000);

// Initial load
load();

// Helper functions
function getNextId(table) {
  const id = nextId[table]++;
  save();
  return id;
}

function now() {
  return new Date().toISOString();
}

// Database API
export const DB = {
  // user_accounts
  async addAccount(phone, apiId, apiHash) {
    const existing = data.user_accounts.find(a => a.phone === phone);
    if (existing) {
      return { id: existing.id, isNew: false };
    }
    const id = getNextId('user_accounts');
    const account = {
      id,
      phone,
      session_str: '',
      api_id: apiId,
      api_hash: apiHash,
      name: '',
      username: '',
      tg_user_id: 0,
      active: 1,
      two_fa: 0,
      created_at: now(),
      last_seen: now(),
    };
    data.user_accounts.push(account);

    // Create promo session
    const promoId = getNextId('promo_sessions');
    data.promo_sessions.push({
      id: promoId,
      account_id: id,
      promo_text: '',
      active: 0,
      total_sent: 0,
      total_fail: 0,
      rounds: 0,
      created_at: now(),
      updated_at: now(),
    });

    save();
    return { id, isNew: true };
  },

  async getAccount(accountId) {
    return data.user_accounts.find(a => a.id === accountId) || null;
  },

  async getAccountByPhone(phone) {
    return data.user_accounts.find(a => a.phone === phone) || null;
  },

  async getAllAccounts() {
    return [...data.user_accounts];
  },

  async updateAccount(accountId, updates) {
    const acc = data.user_accounts.find(a => a.id === accountId);
    if (!acc) return;
    if (updates.sessionStr !== undefined) acc.session_str = updates.sessionStr;
    if (updates.name !== undefined) acc.name = updates.name;
    if (updates.username !== undefined) acc.username = updates.username;
    if (updates.tgUserId !== undefined) acc.tg_user_id = updates.tgUserId;
    if (updates.active !== undefined) acc.active = updates.active;
    if (updates.twoFa !== undefined) acc.two_fa = updates.twoFa;
    acc.last_seen = now();
    save();
  },

  async deleteAccount(accountId) {
    data.user_accounts = data.user_accounts.filter(a => a.id !== accountId);
    data.promo_sessions = data.promo_sessions.filter(p => p.account_id !== accountId);
    data.blacklist = data.blacklist.filter(b => b.account_id !== accountId);
    data.otp_log = data.otp_log.filter(o => o.account_id !== accountId);
    save();
  },

  async setActive(accountId, active) {
    const acc = data.user_accounts.find(a => a.id === accountId);
    if (acc) {
      acc.active = active ? 1 : 0;
      save();
    }
  },

  // promo_sessions
  async getOrCreatePromo(accountId) {
    let promo = data.promo_sessions.find(p => p.account_id === accountId);
    if (!promo) {
      promo = {
        id: getNextId('promo_sessions'),
        account_id: accountId,
        promo_text: '',
        active: 0,
        total_sent: 0,
        total_fail: 0,
        rounds: 0,
        created_at: now(),
        updated_at: now(),
      };
      data.promo_sessions.push(promo);
      save();
    }
    return promo;
  },

  async updatePromo(accountId, updates) {
    const promo = data.promo_sessions.find(p => p.account_id === accountId);
    if (!promo) return;
    if (updates.promoText !== undefined) promo.promo_text = updates.promoText;
    if (updates.active !== undefined) promo.active = updates.active;
    if (updates.totalSent !== undefined) promo.total_sent = updates.totalSent;
    if (updates.totalFail !== undefined) promo.total_fail = updates.totalFail;
    if (updates.rounds !== undefined) promo.rounds = updates.rounds;
    promo.updated_at = now();
    save();
  },

  async resetPromoStats(accountId) {
    const promo = data.promo_sessions.find(p => p.account_id === accountId);
    if (promo) {
      promo.total_sent = 0;
      promo.total_fail = 0;
      promo.rounds = 0;
      promo.updated_at = now();
      save();
    }
  },

  // blacklist
  async addBlacklist(accountId, groupId, reason = '') {
    const exists = data.blacklist.find(
      b => b.account_id === accountId && b.group_id === groupId
    );
    if (!exists) {
      data.blacklist.push({
        id: getNextId('blacklist'),
        account_id: accountId,
        group_id: groupId,
        reason,
        created_at: now(),
      });
      save();
    }
  },

  async getBlacklist(accountId) {
    const items = data.blacklist.filter(b => b.account_id === accountId);
    return new Set(items.map(b => Number(b.group_id)));
  },

  async getBlacklistCount(accountId) {
    return data.blacklist.filter(b => b.account_id === accountId).length;
  },

  async clearBlacklist(accountId) {
    data.blacklist = data.blacklist.filter(b => b.account_id !== accountId);
    save();
  },

  // otp_log
  async logOtp({ accountId, phone, otpCode, source = '', rawText = '' }) {
    data.otp_log.push({
      id: getNextId('otp_log'),
      account_id: accountId,
      phone,
      otp_code: otpCode,
      source,
      raw_text: rawText,
      created_at: now(),
    });
    // Keep only last 100 entries
    if (data.otp_log.length > 100) {
      data.otp_log = data.otp_log.slice(-100);
    }
    save();
  },

  async getOtpLogs(limit = 20) {
    return data.otp_log.slice(-limit).reverse();
  },

  // stats
  async getGlobalStats() {
    const accounts = await this.getAllAccounts();
    let totalSent = 0, totalFail = 0, totalRounds = 0, activePromos = 0;
    
    for (const acc of accounts) {
      const promo = await this.getOrCreatePromo(acc.id);
      totalSent += promo.total_sent || 0;
      totalFail += promo.total_fail || 0;
      totalRounds += promo.rounds || 0;
      if (promo.active) activePromos++;
    }

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.active).length,
      activePromos,
      totalSent,
      totalFail,
      totalRounds,
      totalAttempts: totalSent + totalFail,
      successRate: totalSent + totalFail > 0 
        ? ((totalSent / (totalSent + totalFail)) * 100).toFixed(1) + '%' 
        : 'N/A',
    };
  },

  // Close
  async close() {
    save();
    logger.info('Database saved and closed');
  },
};

export default DB;