import logger from '../logger.js';
import { CONFIG } from '../config.js';

/**
 * Message Manager - Auto-delete bot messages to prevent clutter
 * Tracks all bot-sent messages and deletes them on new interactions
 */
class MessageManager {
  constructor() {
    this._messages = new Map(); // chatId -> [messageIds]
    this._maxTracked = 50; // Max messages per chat
  }

  /**
   * Track a sent message for potential auto-delete
   */
  track(chatId, messageId) {
    if (!chatId || !messageId) return;
    chatId = Number(chatId);
    messageId = Number(messageId);

    if (!this._messages.has(chatId)) {
      this._messages.set(chatId, []);
    }

    const msgs = this._messages.get(chatId);
    msgs.push(messageId);

    // Keep only recent messages
    if (msgs.length > this._maxTracked) {
      msgs.shift();
    }
  }

  /**
   * Track multiple messages
   */
  trackMany(chatId, messageIds) {
    for (const mid of messageIds) {
      this.track(chatId, mid);
    }
  }

  /**
   * Delete all tracked messages for a chat (auto-delete on new interaction)
   * @param {Object} api - Grammy Api instance
   * @param {number} chatId - Chat ID
   * @param {number} exceptMessageId - Don't delete this message (usually the new one)
 */
  async deleteAll(api, chatId, exceptMessageId = null) {
    const msgs = this._messages.get(Number(chatId));
    if (!msgs || msgs.length === 0) return;

    const toDelete = exceptMessageId 
      ? msgs.filter(id => id !== exceptMessageId)
      : [...msgs];

    // Clear tracked list
    this._messages.set(Number(chatId), exceptMessageId ? [exceptMessageId] : []);

    // Delete messages with small delay between each (avoid rate limit)
    for (let i = 0; i < toDelete.length; i++) {
      try {
        await api.deleteMessage(chatId, toDelete[i]);
        await new Promise(r => setTimeout(r, 50)); // Small delay
      } catch (err) {
        // Message might already be deleted or too old
        logger.debug(`Auto-delete failed for msg ${toDelete[i]}: ${err.message}`);
      }
    }
  }

  /**
   * Delete a specific message
   */
  async deleteOne(api, chatId, messageId) {
    try {
      await api.deleteMessage(chatId, messageId);
      this.remove(chatId, messageId);
    } catch (err) {
      logger.debug(`Delete failed for msg ${messageId}: ${err.message}`);
    }
  }

  /**
   * Remove from tracking without deleting
   */
  remove(chatId, messageId) {
    const msgs = this._messages.get(Number(chatId));
    if (msgs) {
      const idx = msgs.indexOf(Number(messageId));
      if (idx > -1) msgs.splice(idx, 1);
    }
  }

  /**
   * Clear all tracked messages for a chat
   */
  clear(chatId) {
    this._messages.delete(Number(chatId));
  }

  /**
   * Get tracked messages count
   */
  getCount(chatId) {
    return this._messages.get(Number(chatId))?.length || 0;
  }

  /**
   * Reply with auto-tracking and auto-delete of previous messages
   * @param {Object} ctx - Grammy context
   * @param {string} text - Message text
   * @param {Object} options - Extra options (parse_mode, reply_markup, etc)
   * @param {boolean} autoDeletePrev - Whether to delete previous messages
   */
  async reply(ctx, text, options = {}, autoDeletePrev = true) {
    const chatId = ctx.chat?.id;
    
    // Delete previous messages
    if (autoDeletePrev && chatId) {
      await this.deleteAll(ctx.api, chatId);
    }

    // Send new message
    const msg = await ctx.reply(text, {
      parse_mode: 'HTML',
      ...options,
    });

    // Track new message
    if (chatId && msg?.message_id) {
      this.track(chatId, msg.message_id);
    }

    return msg;
  }

  /**
   * Edit or reply - tries to edit first, falls back to reply
   */
  async editOrReply(ctx, text, options = {}) {
    try {
      if (ctx.callbackQuery?.message) {
        const edited = await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...options,
        });
        if (chatId && edited?.message_id) {
          this.track(ctx.chat.id, edited.message_id);
        }
        return edited;
      }
    } catch {
      // Fall through to reply
    }
    return this.reply(ctx, text, options);
  }
}

export const messageManager = new MessageManager();