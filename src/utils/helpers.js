import { CONFIG } from '../config.js';

/**
 * HTML escape utility (mirrors Python html.escape)
 */
export function h(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Bold text
 */
export function bold(text) {
  return `<b>${h(text)}</b>`;
}

/**
 * Code text
 */
export function code(text) {
  return `<code>${h(text)}</code>`;
}

/**
 * Italic text
 */
export function italic(text) {
  return `<i>${h(text)}</i>`;
}

/**
 * Truncate text
 */
export function trunc(text, n = 200) {
  const str = String(text || '');
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/**
 * Current timestamp HH:MM:SS
 */
export function ts() {
  return new Date().toLocaleTimeString('id-ID', { hour12: false });
}

/**
 * Full datetime
 */
export function dtf() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Extract OTP from text
 */
export function extractOtp(text) {
  if (!text) return null;
  for (const pattern of CONFIG.OTP_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[1]) return m[1];
  }
  return null;
}

/**
 * Check if sender is Telegram official
 */
export function isTelegramOfficial(senderId, username = '') {
  return senderId === 777000 || 
    username.toLowerCase().includes('telegram') ||
    username.toLowerCase() === 'telegramnotifications';
}

/**
 * Safe delay that can be cancelled
 */
export async function cancellableDelay(ms, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => resolve(true), ms);
    if (abortSignal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry(fn, maxRetries = CONFIG.MAX_RETRIES, delays = CONFIG.RETRY_DELAYS) {
  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries) {
        const delay = delays[i] || delays[delays.length - 1];
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Format number with separators
 */
export function fmtNum(n) {
  return Number(n).toLocaleString('id-ID');
}

/**
 * Generate separator line
 */
export function sep(len = 28) {
  return '─'.repeat(len);
}

/**
 * Generate double separator line
 */
export function dsep(len = 28) {
  return '═'.repeat(len);
}

/**
 * Check if text is a valid phone number
 */
export function isValidPhone(phone) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') && cleaned.length >= 10;
}

/**
 * Clean phone number
 */
export function cleanPhone(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

/**
 * Escape regex special characters
 */
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse callback data safely
 */
export function parseCallbackData(data) {
  if (!data) return { action: '', params: [] };
  const parts = data.split(':');
  return {
    action: parts[0] || '',
    subAction: parts[1] || '',
    accountId: parts[2] ? parseInt(parts[2], 10) : null,
    params: parts.slice(1),
  };
}

/**
 * Create abortable controller
 */
export function createAbortController() {
  return new AbortController();
}