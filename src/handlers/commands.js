import { CONFIG } from '../config.js';
import { Messages } from '../utils/messages.js';
import { kbMain } from '../utils/keyboards.js';
import { messageManager } from '../core/messageManager.js';
import DB from '../database.js';
import { promoManager } from '../core/promoEngine.js';

/**
 * Register command handlers
 * @param {Object} bot - Grammy bot instance
 */
export function registerCommands(bot) {
  // /start command
  bot.command('start', async (ctx) => {
    // Auto-delete previous messages
    await messageManager.deleteAll(ctx.api, ctx.chat.id);

    const msg = await ctx.reply(
      Messages.welcome(ctx.me?.username || 'bot'),
      {
        parse_mode: 'HTML',
        reply_markup: kbMain(),
      }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
  });

  // /cancel command
  bot.command('cancel', async (ctx) => {
    const { sessionWizard } = await import('../core/sessionWizard.js');
    sessionWizard.clear(ctx.from.id);

    const msg = await ctx.reply('❌ Dibatalkan.', {
      parse_mode: 'HTML',
      reply_markup: kbMain(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
  });

  // /help command
  bot.command('help', async (ctx) => {
    const msg = await ctx.reply(Messages.help(), {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
  });

  // /status command
  bot.command('status', async (ctx) => {
    const accounts = await DB.getAllAccounts();
    const states = {};
    const promos = {};

    for (const acc of accounts) {
      states[acc.id] = await promoManager.get(acc.id);
      promos[acc.id] = await DB.getOrCreatePromo(acc.id);
    }

    const msg = await ctx.reply(
      Messages.allAccountsStatus(accounts, states, promos),
      {
        parse_mode: 'HTML',
        reply_markup: kbBack(),
      }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
  });
}

function kbBack() {
  return {
    inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'menu:main' }]],
  };
}