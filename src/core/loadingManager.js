import { CONFIG } from '../config.js';
import logger from '../logger.js';

/**
 * Loading Animation Manager
 * Creates animated loading messages with auto-cleanup
 */
class LoadingManager {
  constructor() {
    this._activeAnimations = new Map(); // key -> { interval, messageId, chatId, bot }
  }

  /**
   * Start loading animation
   * @param {Object} ctx - Grammy context
   * @param {string} text - Loading text
   * @returns {Promise<{stop: Function, messageId: number}>}
   */
  async start(ctx, text) {
    const chatId = ctx.chat?.id || ctx.from?.id;
    if (!chatId) return { stop: () => {}, messageId: null };

    const key = `${chatId}:${Date.now()}`;
    let frameIndex = 0;

    // Send initial message
    const initialFrame = CONFIG.LOADING_FRAMES[0];
    const msg = await ctx.reply(`${initialFrame} <b>${this._escapeHtml(text)}</b>…`, {
      parse_mode: 'HTML',
    });

    const messageId = msg.message_id;

    // Start animation interval
    const interval = setInterval(async () => {
      frameIndex = (frameIndex + 1) % CONFIG.LOADING_FRAMES.length;
      const frame = CONFIG.LOADING_FRAMES[frameIndex];
      try {
        await ctx.api.editMessageText(
          chatId,
          messageId,
          `${frame} <b>${this._escapeHtml(text)}</b>…`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        // Message might be deleted or edited by another process
        this._cleanup(key);
      }
    }, CONFIG.LOADING_INTERVAL);

    this._activeAnimations.set(key, { interval, messageId, chatId });

    return {
      messageId,
      stop: async (finalText = null, keyboard = null) => {
        this._cleanup(key);
        if (finalText) {
          try {
            const options = { parse_mode: 'HTML' };
            if (keyboard) options.reply_markup = keyboard;
            await ctx.api.editMessageText(chatId, messageId, finalText, options);
            return messageId;
          } catch (err) {
            // If edit fails, send new message
            const newMsg = await ctx.reply(finalText, {
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
            return newMsg.message_id;
          }
        }
        return messageId;
      },
      updateText: async (newText) => {
        text = newText;
      },
    };
  }

  /**
   * Quick loading wrapper - start loading, execute function, stop with result
   * @param {Object} ctx - Grammy context
   * @param {string} loadingText - Text to show during loading
   * @param {Function} fn - Async function to execute
   * @param {string} successText - Final text on success
   * @param {Object} keyboard - Final keyboard
   * @returns {Promise<*>} - Result of fn
   */
  async wrap(ctx, loadingText, fn, successText = null, keyboard = null) {
    const loading = await this.start(ctx, loadingText);
    try {
      const result = await fn();
      if (successText) {
        await loading.stop(successText, keyboard);
      } else {
        this._stopAnimation(loading.messageId);
      }
      return result;
    } catch (err) {
      this._stopAnimation(loading.messageId);
      throw err;
    }
  }

  /**
   * Stop all animations for a chat
   */
  stopAllForChat(chatId) {
    for (const [key, data] of this._activeAnimations.entries()) {
      if (data.chatId === chatId) {
        this._cleanup(key);
      }
    }
  }

  /**
   * Stop specific animation by message ID
   */
  _stopAnimation(messageId) {
    for (const [key, data] of this._activeAnimations.entries()) {
      if (data.messageId === messageId) {
        this._cleanup(key);
        break;
      }
    }
  }

  /**
   * Cleanup animation
   */
  _cleanup(key) {
    const data = this._activeAnimations.get(key);
    if (data) {
      clearInterval(data.interval);
      this._activeAnimations.delete(key);
    }
  }

  /**
   * Escape HTML for loading text
   */
  _escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export const loadingManager = new LoadingManager();