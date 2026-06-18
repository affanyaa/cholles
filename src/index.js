#!/usr/bin/env node

import { CONFIG, validateConfig } from './config.js';
import logger from './logger.js';
import DB from './database.js';
import { createBot } from './bot.js';
import { clientRegistry } from './core/clientRegistry.js';
import { promoManager } from './core/promoEngine.js';
import { startupReconnect } from './core/startupManager.js';
import { messageManager } from './core/messageManager.js';
import { Messages } from './utils/messages.js';

import { registerCommands } from './handlers/commands.js';
import { registerCallbacks } from './handlers/callbackHandler.js';
import { registerTextHandlers } from './handlers/textHandler.js';

// ── Validate Config ───────────────────────────────────────
try {
  validateConfig();
  logger.info('Configuration validated');
} catch (err) {
  logger.error(`Config validation failed: ${err.message}`);
  process.exit(1);
}

// ── Create Bot ────────────────────────────────────────────
const bot = createBot();

// ── Register Handlers ─────────────────────────────────────
registerCommands(bot);
registerCallbacks(bot);
registerTextHandlers(bot);

// ── Graceful Shutdown ─────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop all promo loops
    const states = promoManager.getAll();
    for (const [accountId, state] of states) {
      if (state.active) {
        logger.info(`Stopping promo for ACC#${accountId}`);
        await state.stop();
      }
    }

    // Stop all clients
    await clientRegistry.stopAll();

    // Stop bot
    await bot.stop();

    // Close database
    await DB.close();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error(`Shutdown error: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});

// ── Startup ───────────────────────────────────────────────
async function main() {
  logger.info('═══════════════════════════════════════════════');
  logger.info('  Auto Promo Bot Ultimate V4.0 - Starting...');
  logger.info('═══════════════════════════════════════════════');

  try {
    // Init bot (get me, etc.)
    logger.info('Initializing bot...');
    await bot.init();

    const me = await bot.api.getMe();
    logger.info(`Bot initialized: @${me.username} (${me.id})`);

    // Reconnect saved accounts & resume promos
    logger.info('Reconnecting saved accounts...');
    await startupReconnect(bot);

    // Notify owner
    try {
      await bot.api.sendMessage(
        CONFIG.OWNER_ID,
        Messages.botOnline(me.username),
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      logger.warn(`Failed to notify owner: ${err.message}`);
    }

    logger.info('Bot ready. Starting message polling...');
    logger.info('═══════════════════════════════════════════════');

    // Start bot polling (blocking)
    await bot.start({
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query'],
    });
  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);
    process.exit(1);
  }
}

// Start
main();