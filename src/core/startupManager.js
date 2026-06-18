import { CONFIG } from '../config.js';
import logger from '../logger.js';
import DB from '../database.js';
import { clientRegistry } from './clientRegistry.js';
import { promoManager, promoLoop, scanGroups } from './promoEngine.js';
import { setupOtpWatcher } from './otpWatcher.js';

/**
 * Startup Manager - Reconnect all saved accounts and resume promos
 */
export async function startupReconnect(bot) {
  const accounts = await DB.getAllAccounts();
  if (accounts.length === 0) {
    logger.info('No saved accounts, skipping reconnect.');
    return;
  }

  logger.info(`Reconnecting ${accounts.length} saved accounts…`);

  for (const acc of accounts) {
    if (!acc.active || !acc.session_str) continue;

    try {
      const client = clientRegistry.createClient(
        acc.session_str,
        acc.api_id,
        acc.api_hash,
        `user_${acc.id}_${acc.phone.replace(/\+/g, '')}`
      );

      await client.connect();
      const me = await client.getMe();

      // Update account info
      await DB.updateAccount(acc.id, {
        name: me.firstName || '',
        username: me.username || '',
        tgUserId: Number(me.id?.value || me.id),
        lastSeen: new Date().toISOString(),
      });

      // Setup OTP watcher
      const notifyFn = async (chatId, text) => {
        try {
          await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } catch (err) {
          logger.error(`Notify error: ${err.message}`);
        }
      };

      setupOtpWatcher(client, acc.id, acc.phone, notifyFn);
      await clientRegistry.register(acc.id, client);

      logger.info(`[ACC#${acc.id}] ✅ Reconnected: ${acc.phone}`);

      // Resume promo if previously active
      const promo = await DB.getOrCreatePromo(acc.id);
      if (promo.active && promo.promo_text) {
        const state = await promoManager.get(acc.id);
        const groups = await scanGroups(acc.id);

        if (groups.length > 0) {
          state.active = true;
          state.text = promo.promo_text;
          state.groups = groups;
          state.abortController = new AbortController();

          const task = promoLoop(acc.id);
          state.task = task;

          logger.info(`[ACC#${acc.id}] ▶️ Promo resumed (${groups.length} groups)`);
        } else {
          await DB.updatePromo(acc.id, { active: 0 });
        }
      }
    } catch (err) {
      logger.error(`[ACC#${acc.id}] ❌ Reconnect failed: ${err.message}`);
      // Deactivate problematic account
      await DB.setActive(acc.id, false);
      await DB.updatePromo(acc.id, { active: 0 });
    }
  }

  logger.info('Startup reconnect complete');
}