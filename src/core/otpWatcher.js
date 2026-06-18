import { NewMessage } from 'telegram/events/index.js';
import { CONFIG } from '../config.js';
import logger from '../logger.js';
import DB from '../database.js';
import { extractOtp, isTelegramOfficial } from '../utils/helpers.js';
import { Messages } from '../utils/messages.js';

/**
 * Setup OTP watcher for a client
 * @param {Object} client - TelegramClient instance
 * @param {number} accountId - Account ID
 * @param {string} phone - Phone number
 * @param {Function} notifyFn - Function to send notification (chatId, text) => Promise
 */
export function setupOtpWatcher(client, accountId, phone, notifyFn) {
  const handler = async (event) => {
    try {
      const message = event.message;
      
      // Only handle private messages
      if (!message.isPrivate) return;

      const text = message.text || message.message || '';
      const sender = await message.getSender();
      const senderId = Number(sender?.id?.value || sender?.id || 0);
      const senderUsername = (sender?.username || '').toLowerCase();
      const senderName = sender?.firstName || sender?.title || 'Unknown';
      const sourceStr = senderUsername ? `@${senderUsername}` : String(senderId);

      const isTelegram = isTelegramOfficial(senderId, senderUsername);

      // Extract OTP
      const otp = extractOtp(text);

      if (otp) {
        // Log OTP
        await DB.logOtp({
          accountId,
          phone,
          otpCode: otp,
          source: sourceStr,
          rawText: text.slice(0, 500),
        });

        // Notify owner
        await notifyFn(
          CONFIG.OWNER_ID,
          Messages.otpDetected(phone, otp, sourceStr, senderName, isTelegram)
        );

        // Auto-reply if from Telegram official
        if (isTelegram) {
          try {
            await client.sendMessage(senderId, { message: '✅ Kode OTP diterima.' });
          } catch (err) {
            logger.debug(`Auto-reply failed: ${err.message}`);
          }
        }
      } else {
        // Forward all non-OTP messages to owner
        await notifyFn(
          CONFIG.OWNER_ID,
          Messages.forwardedMessage(accountId, phone, senderName, sourceStr, text)
        );
      }
    } catch (err) {
      logger.error(`OTP watcher error for ACC#${accountId}: ${err.message}`);
    }
  };

  // Add event handler for new private messages
  client.addEventHandler(handler, new NewMessage({
    incoming: true,
    fromUsers: undefined, // All users
  }));

  logger.info(`OTP watcher installed for ACC#${accountId} (${phone})`);
}

/**
 * Remove OTP watcher (client disconnect handles this automatically)
 */
export function removeOtpWatcher(client) {
  try {
    client.removeEventHandler();
    logger.info('OTP watcher removed');
  } catch (err) {
    logger.debug(`Remove OTP watcher error: ${err.message}`);
  }
}