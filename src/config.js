import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

dotenv.config({ path: join(ROOT_DIR, '.env') });

// Helper with defaults
const int = (val, def) => {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? def : parsed;
};

const str = (val, def) => val?.trim() || def;

export const CONFIG = {
  // Telegram API
  API_ID: int(process.env.API_ID, 0),
  API_HASH: str(process.env.API_HASH, ''),
  BOT_TOKEN: str(process.env.BOT_TOKEN, ''),
  OWNER_ID: int(process.env.OWNER_ID, 0),

  // Promo Settings (mutable via settings menu)
  DELAY_BETWEEN_ROUNDS: int(process.env.DELAY_BETWEEN_ROUNDS, 300),
  MAX_RETRIES: int(process.env.MAX_RETRIES, 3),
  MAX_FAIL_BEFORE_BL: int(process.env.MAX_FAIL_BEFORE_BL, 3),

  // Paths
  DB_PATH: str(process.env.DB_PATH, join(ROOT_DIR, 'data', 'bot.db')),
  SESSION_DIR: join(ROOT_DIR, 'sessions'),
  LOG_DIR: join(ROOT_DIR, 'logs'),
  DATA_DIR: join(ROOT_DIR, 'data'),

  // Logging
  LOG_LEVEL: str(process.env.LOG_LEVEL, 'info'),

  // OTP Detection Patterns
  OTP_PATTERNS: [
    /(?:login|verification|confirm|your\s+code|کد|رمز)\D{0,10}(\d{4,8})/i,
    /\b(\d{4,8})\b(?=.*(?:telegram|تلگرام))/i,
    /(?:code|کد)[\s:]+(\d{4,8})/i,
    /login\s+code[:\s]+(\d{4,8})/i,
    /your\s+code[:\s]+(\d{4,8})/i,
    /\b(\d{5,6})\b/,
  ],

  // Auto-delete messages after (ms)
  AUTO_DELETE_DELAY: 500,

  // Max groups per round (prevent overload)
  MAX_GROUPS_PER_ROUND: 500,

  // Loading frames for animation
  LOADING_FRAMES: ['⏳', '⌛', '🔄', '💫', '✨', '🌀', '⚡'],
  LOADING_INTERVAL: 800,

  // Retry delays (ms)
  RETRY_DELAYS: [1000, 2000, 4000],

  // FloodWait thresholds
  FLOOD_WAIT_SHORT: 600,
  FLOOD_WAIT_LONG: 600,
  SLOWMODE_WAIT_LONG: 300,
};

// Validate critical config
export function validateConfig() {
  const required = ['API_ID', 'API_HASH', 'BOT_TOKEN', 'OWNER_ID'];
  const missing = required.filter(k => !CONFIG[k] || CONFIG[k] === 0);
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
  if (CONFIG.API_ID === 0) {
    throw new Error('API_ID must be a valid integer');
  }
  if (CONFIG.OWNER_ID === 0) {
    throw new Error('OWNER_ID must be a valid integer');
  }
}

export { ROOT_DIR };