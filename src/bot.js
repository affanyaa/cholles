import { Bot } from 'grammy';
import { CONFIG } from './config.js';
import logger from './logger.js';

/**
 * Create and configure Grammy bot
 */
export function createBot() {
  const bot = new Bot(CONFIG.BOT_TOKEN);

  // Error handler
  bot.catch((err) => {
    logger.error(`Bot error: ${err.message}`);
    if (err.stack) {
      logger.debug(err.stack);
    }
  });

  // Pre-update handler for auto-delete
  bot.use(async (ctx, next) => {
    // Auto-delete bot's previous messages on callback queries
    if (ctx.callbackQuery) {
      const { messageManager } = await import('./core/messageManager.js');
      await messageManager.deleteAll(ctx.api, ctx.chat?.id || ctx.from?.id);
    }
    return next();
  });

  // Log updates in debug mode
  if (CONFIG.LOG_LEVEL === 'debug') {
    bot.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      logger.debug(`Update processed in ${ms}ms: ${ctx.updateType}`);
    });
  }

  return bot;
}