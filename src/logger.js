import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';
import { CONFIG } from './config.js';
import { mkdirSync } from 'fs';

// Ensure log directory exists
try {
  mkdirSync(CONFIG.LOG_DIR, { recursive: true });
} catch { /* ignore */ }

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let msg = `${timestamp} | ${level.padEnd(8)} | PromoBot | ${message}`;
  if (Object.keys(meta).length > 0) {
    msg += ` | ${JSON.stringify(meta)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

// Console format with colors
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  logFormat
);

// File format without colors
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  logFormat
);

// Create logger
const logger = winston.createLogger({
  level: CONFIG.LOG_LEVEL,
  defaultMeta: { service: 'promo-bot' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    }),

    // Rotating file
    new DailyRotateFile({
      dirname: CONFIG.LOG_DIR,
      filename: 'bot-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d',
      format: fileFormat,
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Silence noisy MTProto logs
const silenceLoggers = ['grammy', 'node-schedule'];
silenceLoggers.forEach(name => {
  const silent = winston.createLogger({ silent: true });
  // We can't directly suppress grammy's internal logging, but we can proxy
});

export default logger;