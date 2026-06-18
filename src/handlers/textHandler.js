import { CONFIG } from '../config.js';
import logger from '../logger.js';
import DB from '../database.js';
import { sessionWizard } from '../core/sessionWizard.js';
import { clientRegistry } from '../core/clientRegistry.js';
import { promoManager } from '../core/promoEngine.js';
import { setupOtpWatcher } from '../core/otpWatcher.js';
import { loadingManager } from '../core/loadingManager.js';
import { messageManager } from '../core/messageManager.js';
import { Messages } from '../utils/messages.js';
import { h, bold, code, cleanPhone } from '../utils/helpers.js';
import { kbMain, kbAccount, kbSettings, kbCancel, kbBack } from '../utils/keyboards.js';

/**
 * Register text message handlers
 */
export function registerTextHandlers(bot) {
  bot.on('message:text', async (ctx) => {
    // Only owner can use
    if (ctx.from.id !== CONFIG.OWNER_ID) return;

    const text = ctx.message.text.trim();
    const step = sessionWizard.getStep(ctx.from.id);

    // ── /start command ────────────────────────────────────
    if (text.startsWith('/start')) {
      sessionWizard.clear(ctx.from.id);
      await messageManager.deleteAll(ctx.api, ctx.chat.id, ctx.message.message_id);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch { /* ignore */ }
      
      const msg = await ctx.reply(Messages.welcome(ctx.me?.username), {
        parse_mode: 'HTML',
        reply_markup: kbMain(),
      });
      messageManager.track(ctx.chat.id, msg.message_id);
      return;
    }

    // ── /cancel command ───────────────────────────────────
    if (text.startsWith('/cancel')) {
      sessionWizard.clear(ctx.from.id);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch { /* ignore */ }
      
      const msg = await ctx.reply('❌ Dibatalkan.', {
        parse_mode: 'HTML',
        reply_markup: kbMain(),
      });
      messageManager.track(ctx.chat.id, msg.message_id);
      return;
    }

    // ── No active wizard ──────────────────────────────────
    if (!step) {
      await messageManager.deleteAll(ctx.api, ctx.chat.id, ctx.message.message_id);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch { /* ignore */ }
      
      const msg = await ctx.reply('❓ Pilih menu:', {
        parse_mode: 'HTML',
        reply_markup: kbMain(),
      });
      messageManager.track(ctx.chat.id, msg.message_id);
      return;
    }

    // Delete user's message for clean UI during wizard
    try {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch { /* ignore */ }

    // ── Login Wizard Steps ────────────────────────────────
    if (step === 'wait_phone') {
      return await handleStepPhone(ctx, text);
    }

    if (step === 'wait_api_id') {
      return await handleStepApiId(ctx, text);
    }

    if (step === 'wait_api_hash') {
      return await handleStepApiHash(ctx, text);
    }

    if (step === 'wait_otp') {
      return await handleStepOtp(ctx, text);
    }

    if (step === 'wait_2fa') {
      return await handleStep2fa(ctx, text);
    }

    // ── Promo Text Step ───────────────────────────────────
    if (step.startsWith('wait_promo_text:')) {
      const accountId = parseInt(step.split(':')[1], 10);
      if (isNaN(accountId)) {
        sessionWizard.clear(ctx.from.id);
        return;
      }
      return await handleSetPromoText(ctx, text, accountId);
    }

    // ── Settings Steps ────────────────────────────────────
    if (step === 'wait_setting_delay') {
      return await handleSettingDelay(ctx, text);
    }

    if (step === 'wait_setting_maxfail') {
      return await handleSettingMaxfail(ctx, text);
    }

    // ── Fallback ──────────────────────────────────────────
    sessionWizard.clear(ctx.from.id);
    const msg = await ctx.reply('❓ Pilih menu:', {
      parse_mode: 'HTML',
      reply_markup: kbMain(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
  });
}

// ═══════════════════════════════════════════════════════════
// LOGIN WIZARD STEPS
// ═══════════════════════════════════════════════════════════

async function handleStepPhone(ctx, text) {
  let phone = cleanPhone(text);

  if (phone.length < 10) {
    const msg = await ctx.reply(
      `❌ <b>Nomor tidak valid!</b>\nKirim ulang nomor HP.\nContoh: ${code('+628123456789')}`,
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const existing = await DB.getAccountByPhone(phone);
  if (existing) {
    sessionWizard.clear(ctx.from.id);
    const msg = await ctx.reply(
      `⚠️ Nomor ${code(phone)} sudah terdaftar!\nID Akun: #${existing.id}`,
      { parse_mode: 'HTML', reply_markup: kbBack() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  sessionWizard.set(ctx.from.id, 'wait_api_id', { phone });
  const msg = await ctx.reply(
    `✅ Nomor: ${code(phone)}\n\n` +
    `Kirim <b>API ID</b> kamu.\n` +
    `<i>Dapatkan di: my.telegram.org → App API</i>`,
    { parse_mode: 'HTML', reply_markup: kbCancel() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleStepApiId(ctx, text) {
  let apiId;
  try {
    apiId = parseInt(text.trim(), 10);
    if (apiId <= 0) throw new Error('Invalid');
  } catch {
    const msg = await ctx.reply(
      '❌ API ID harus berupa angka positif!\nKirim ulang:',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = sessionWizard.get(ctx.from.id);
  sessionWizard.set(ctx.from.id, 'wait_api_hash', { ...state, apiId });

  const msg = await ctx.reply(
    `✅ API ID: ${code(apiId)}\n\nKirim <b>API Hash</b> kamu:`,
    { parse_mode: 'HTML', reply_markup: kbCancel() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleStepApiHash(ctx, text) {
  const apiHash = text.trim();
  if (apiHash.length < 16) {
    const msg = await ctx.reply(
      '❌ API Hash terlalu pendek!\nKirim ulang:',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = sessionWizard.get(ctx.from.id);
  const { phone, apiId } = state;

  const loading = await loadingManager.start(ctx, `Mengirim OTP ke ${phone}`);

  let client;
  try {
    client = clientRegistry.createClient('', apiId, apiHash, `temp_${Date.now()}`);
    await client.connect();

    // Send code using gramjs API
    const { phoneCodeHash } = await client.sendCode(
      { apiId: Number(apiId), apiHash },
      phone
    );

    await client.disconnect();

    sessionWizard.set(ctx.from.id, 'wait_otp', {
      phone, apiId, apiHash, phoneCodeHash,
    });

    await loading.stop(
      `📱 <b>Kode OTP Terkirim!</b>\n` +
      `${'─'.repeat(28)}\n` +
      `📞 Ke nomor : ${code(phone)}\n\n` +
      `Kirim kode OTP yang kamu terima:\n` +
      `<i>Contoh: 12345</i>`,
      kbCancel()
    );
  } catch (err) {
    logger.error(`sendCode error: ${err.message}`);
    await loading.stop();

    let errorMsg;
    if (err.message?.includes('PHONE_NUMBER_INVALID') || 
        err.errorMessage === 'PHONE_NUMBER_INVALID') {
      sessionWizard.clear(ctx.from.id);
      errorMsg = '❌ Nomor HP tidak valid!';
    } else if (err.message?.includes('FLOOD_WAIT') || 
               err.errorMessage === 'FLOOD_WAIT') {
      const match = err.message.match(/(\d+)/);
      const wait = match ? match[1] : '?';
      sessionWizard.clear(ctx.from.id);
      errorMsg = `⏱ FloodWait ${wait} detik!\nCoba lagi nanti.`;
    } else {
      sessionWizard.clear(ctx.from.id);
      errorMsg = `❌ Gagal kirim OTP:\n${code(err.message || 'Unknown error')}`;
    }

    if (client) {
      try { await client.disconnect(); } catch { /* ignore */ }
    }

    const msg = await ctx.reply(errorMsg, {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
  }
}

async function handleStepOtp(ctx, text) {
  const otpCode = text.replace(/\D/g, '');
  if (otpCode.length < 4) {
    const msg = await ctx.reply(
      '❌ Kode OTP tidak valid!\nKirim ulang kode:',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = sessionWizard.get(ctx.from.id);
  const { phone, apiId, apiHash, phoneCodeHash } = state;

  const loading = await loadingManager.start(ctx, 'Memverifikasi kode OTP');

  let client;
  try {
    client = clientRegistry.createClient('', apiId, apiHash, `temp_${Date.now()}`);
    await client.connect();

    let me;

    try {
      // Use client.start for proper authentication flow
      await client.start({
        phoneNumber: () => Promise.resolve(phone),
        phoneCode: () => Promise.resolve(otpCode),
        password: () => Promise.reject(new Error('2FA_REQUIRED')),
        onError: (err) => {
          if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            return Promise.reject(new Error('2FA_REQUIRED'));
          }
          return Promise.reject(err);
        },
      });
      me = await client.getMe();
    } catch (err) {
      if (err.message === '2FA_REQUIRED' || 
          err.errorMessage === 'SESSION_PASSWORD_NEEDED' ||
          err.message?.includes('SESSION_PASSWORD_NEEDED')) {
        await client.disconnect();
        sessionWizard.set(ctx.from.id, 'wait_2fa', { phone, apiId, apiHash });

        await loading.stop(
          `🔐 <b>2FA Diperlukan</b>\n` +
          `${'─'.repeat(28)}\n` +
          `Akun kamu dilindungi verifikasi 2 langkah.\n\n` +
          `Kirim <b>password 2FA</b> kamu:`,
          kbCancel()
        );
        return;
      } else if (err.message?.includes('PHONE_CODE_INVALID') || 
                 err.errorMessage === 'PHONE_CODE_INVALID') {
        await loading.stop();
        const msg = await ctx.reply(
          '❌ Kode OTP salah!\nKirim ulang kode yang benar:',
          { parse_mode: 'HTML', reply_markup: kbCancel() }
        );
        messageManager.track(ctx.chat.id, msg.message_id);
        return;
      } else if (err.message?.includes('PHONE_CODE_EXPIRED') ||
                 err.errorMessage === 'PHONE_CODE_EXPIRED') {
        sessionWizard.clear(ctx.from.id);
        await loading.stop();
        const msg = await ctx.reply(
          '⏱ Kode OTP sudah expired!\nUlangi proses tambah akun dari awal.',
          { parse_mode: 'HTML', reply_markup: kbBack() }
        );
        messageManager.track(ctx.chat.id, msg.message_id);
        return;
      }
      throw err;
    }

    // Success without 2FA
    const sessionString = client.session.save();
    await client.disconnect();

    await finalizeLogin(ctx, loading, phone, apiId, apiHash, sessionString, me, false);

  } catch (err) {
    logger.error(`signIn error: ${err.message}`);
    await loading.stop();
    sessionWizard.clear(ctx.from.id);

    if (client) {
      try { await client.disconnect(); } catch { /* ignore */ }
    }

    const msg = await ctx.reply(
      `❌ Login gagal:\n${code(err.message || 'Unknown error')}`,
      { parse_mode: 'HTML', reply_markup: kbBack() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
  }
}

async function handleStep2fa(ctx, text) {
  const password = text.trim();
  if (!password) {
    const msg = await ctx.reply(
      '❌ Password tidak boleh kosong!',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = sessionWizard.get(ctx.from.id);
  const { phone, apiId, apiHash } = state;

  const loading = await loadingManager.start(ctx, 'Memverifikasi password 2FA');

  let client;
  try {
    client = clientRegistry.createClient('', apiId, apiHash, `temp_${Date.now()}`);
    await client.connect();

    await client.start({
      phoneNumber: () => Promise.resolve(phone),
      phoneCode: () => Promise.resolve(''),
      password: () => Promise.resolve(password),
      onError: (err) => {
        if (err.errorMessage === 'PASSWORD_HASH_INVALID') {
          return Promise.reject(new Error('INVALID_PASSWORD'));
        }
        return Promise.reject(err);
      },
    });

    const me = await client.getMe();
    const sessionString = client.session.save();
    await client.disconnect();

    await finalizeLogin(ctx, loading, phone, apiId, apiHash, sessionString, me, true);

  } catch (err) {
    logger.error(`2FA error: ${err.message}`);
    await loading.stop();

    if (client) {
      try { await client.disconnect(); } catch { /* ignore */ }
    }

    if (err.message === 'INVALID_PASSWORD' || err.message?.includes('PASSWORD_HASH_INVALID')) {
      const msg = await ctx.reply(
        '❌ Password 2FA salah!\nKirim ulang password:',
        { parse_mode: 'HTML', reply_markup: kbCancel() }
      );
      messageManager.track(ctx.chat.id, msg.message_id);
      return;
    }

    sessionWizard.clear(ctx.from.id);
    const msg = await ctx.reply(
      `❌ Verifikasi 2FA gagal:\n${code(err.message || 'Unknown error')}`,
      { parse_mode: 'HTML', reply_markup: kbBack() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
  }
}

// ═══════════════════════════════════════════════════════════
// FINALIZE LOGIN
// ═══════════════════════════════════════════════════════════

async function finalizeLogin(ctx, loading, phone, apiId, apiHash, sessionString, me, twoFa) {
  try {
    // Save to database
    const result = await DB.addAccount(phone, apiId, apiHash);
    const accountId = result.id;

    await DB.updateAccount(accountId, {
      sessionStr: sessionString,
      name: me.firstName || '',
      username: me.username || '',
      tgUserId: Number(me.id?.value || me.id),
      active: 1,
      twoFa: twoFa ? 1 : 0,
    });

    await DB.getOrCreatePromo(accountId);

    // Start permanent client
    const permClient = clientRegistry.createClient(sessionString, apiId, apiHash, 
      `user_${accountId}_${phone.replace(/\+/g, '')}`
    );
    await permClient.connect();

    // Setup OTP watcher
    const notifyFn = async (chatId, text) => {
      try {
        await ctx.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        logger.error(`Notify error: ${err.message}`);
      }
    };

    setupOtpWatcher(permClient, accountId, phone, notifyFn);
    await clientRegistry.register(accountId, permClient);

    sessionWizard.clear(ctx.from.id);

    await loading.stop(
      Messages.accountAdded(phone, me, accountId, twoFa),
      kbAccount(accountId, false)
    );

    // Send notification
    await ctx.api.sendMessage(
      CONFIG.OWNER_ID,
      Messages.newAccountNotification(accountId, me.firstName, me.username, phone),
      { parse_mode: 'HTML' }
    );

  } catch (err) {
    logger.error(`finalizeLogin error: ${err.message}`);
    await loading.stop();
    sessionWizard.clear(ctx.from.id);

    const msg = await ctx.reply(
      `❌ Gagal menyimpan akun:\n${code(err.message)}`,
      { parse_mode: 'HTML', reply_markup: kbBack() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
  }
}

// ═══════════════════════════════════════════════════════════
// SET PROMO TEXT
// ═══════════════════════════════════════════════════════════

async function handleSetPromoText(ctx, text, accountId) {
  const promoText = text.trim();
  if (!promoText) {
    const msg = await ctx.reply(
      '❌ Teks tidak boleh kosong!',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = await promoManager.get(accountId);
  state.text = promoText;
  await DB.updatePromo(accountId, { promoText });
  sessionWizard.clear(ctx.from.id);

  const preview = h(promoText.slice(0, 150)) + (promoText.length > 150 ? '…' : '');

  const msg = await ctx.reply(
    `✅ <b>Teks Promosi Disimpan</b>\n` +
    `${'─'.repeat(28)}\n` +
    `📊 Panjang : ${promoText.length} karakter\n\n` +
    `<b>Preview:</b>\n${preview}`,
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

// ═══════════════════════════════════════════════════════════
// SETTINGS HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleSettingDelay(ctx, text) {
  let minutes;
  try {
    minutes = parseInt(text.trim(), 10);
    if (minutes < 1) throw new Error('Invalid');
  } catch {
    const msg = await ctx.reply(
      '❌ Masukkan angka bulat minimal 1!',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  CONFIG.DELAY_BETWEEN_ROUNDS = minutes * 60;
  sessionWizard.clear(ctx.from.id);

  const msg = await ctx.reply(
    `✅ Delay putaran diubah ke ${bold(`${minutes} menit`)}.`,
    { parse_mode: 'HTML', reply_markup: kbSettings() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleSettingMaxfail(ctx, text) {
  let val;
  try {
    val = parseInt(text.trim(), 10);
    if (val < 1) throw new Error('Invalid');
  } catch {
    const msg = await ctx.reply(
      '❌ Masukkan angka bulat minimal 1!',
      { parse_mode: 'HTML', reply_markup: kbCancel() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  CONFIG.MAX_FAIL_BEFORE_BL = val;
  sessionWizard.clear(ctx.from.id);

  const msg = await ctx.reply(
    `✅ Max gagal blacklist diubah ke ${bold(`${val}x`)}.`,
    { parse_mode: 'HTML', reply_markup: kbSettings() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}