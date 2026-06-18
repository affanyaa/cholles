import { CONFIG } from '../config.js';
import logger from '../logger.js';
import DB from '../database.js';
import { sessionWizard } from '../core/sessionWizard.js';
import { clientRegistry } from '../core/clientRegistry.js';
import { promoManager, promoLoop, scanGroups } from '../core/promoEngine.js';
import { loadingManager } from '../core/loadingManager.js';
import { messageManager } from '../core/messageManager.js';
import { Messages } from '../utils/messages.js';
import { h, cleanPhone, parseCallbackData } from '../utils/helpers.js';
import {
  kbMain, kbAccount, kbAccountList, kbBack, kbBackAccount,
  kbCancel, kbConfirmDelete, kbConfirmClearBl, kbConfirmResetStats,
  kbBlacklistMenu, kbSettings,
} from '../utils/keyboards.js';

/**
 * Register callback query handlers
 */
export function registerCallbacks(bot) {
  bot.on('callback_query:data', async (ctx) => {
    // Only owner can use
    if (ctx.from.id !== CONFIG.OWNER_ID) {
      await ctx.answerCallbackQuery('⛔ Akses ditolak!').catch(() => {});
      return;
    }

    const data = ctx.callbackQuery.data;
    const { action, subAction, accountId } = parseCallbackData(data);

    // Always answer callback to remove loading state
    await ctx.answerCallbackQuery().catch(() => {});

    // Auto-delete previous messages for cleaner UX
    await messageManager.deleteAll(ctx.api, ctx.chat.id);

    try {
      // ── Menu Callbacks ──────────────────────────────────
      if (action === 'menu') {
        switch (subAction) {
          case 'main': return await handleMenuMain(ctx);
          case 'accounts': return await handleMenuAccounts(ctx);
          case 'add_account': return await handleMenuAddAccount(ctx);
          case 'list_accounts': return await handleMenuListAccounts(ctx);
          case 'status_all': return await handleMenuStatusAll(ctx);
          case 'otp_log': return await handleMenuOtpLog(ctx);
          case 'stats': return await handleMenuStats(ctx);
          case 'help': return await handleMenuHelp(ctx);
          case 'settings': return await handleMenuSettings(ctx);
        }
      }

      // ── Settings Callbacks ──────────────────────────────
      if (action === 'settings') {
        switch (subAction) {
          case 'delay': return await handleSettingsDelay(ctx);
          case 'maxfail': return await handleSettingsMaxfail(ctx);
        }
      }

      // ── Account Callbacks ───────────────────────────────
      if (action === 'acc' && accountId) {
        switch (subAction) {
          case 'detail': return await handleAccDetail(ctx, accountId);
          case 'info': return await handleAccInfo(ctx, accountId);
          case 'start': return await handleAccStart(ctx, accountId);
          case 'stop': return await handleAccStop(ctx, accountId);
          case 'status': return await handleAccStatus(ctx, accountId);
          case 'scan': return await handleAccScan(ctx, accountId);
          case 'settext': return await handleAccSettext(ctx, accountId);
          case 'viewtext': return await handleAccViewtext(ctx, accountId);
          case 'blacklist': return await handleAccBlacklist(ctx, accountId);
          case 'clear_bl': return await handleAccClearBl(ctx, accountId);
          case 'clear_bl_confirm': return await handleAccClearBlConfirm(ctx, accountId);
          case 'resetstats': return await handleAccResetstats(ctx, accountId);
          case 'resetstats_confirm': return await handleAccResetstatsConfirm(ctx, accountId);
          case 'delete_confirm': return await handleAccDeleteConfirm(ctx, accountId);
          case 'delete': return await handleAccDelete(ctx, accountId);
        }
      }

      logger.warn(`Unhandled callback: ${data}`);
    } catch (err) {
      logger.error(`Callback handler error: ${err.message}`);
      await ctx.reply(`❌ Error: ${h(err.message)}`, {
        parse_mode: 'HTML',
        reply_markup: kbMain(),
      }).catch(() => {});
    }
  });
}

// ═══════════════════════════════════════════════════════════
// MENU HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleMenuMain(ctx) {
  sessionWizard.clear(ctx.from.id);
  const msg = await ctx.reply(Messages.mainMenu(), {
    parse_mode: 'HTML',
    reply_markup: kbMain(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuAccounts(ctx) {
  const loading = await loadingManager.start(ctx, 'Memuat daftar akun');

  const accounts = await DB.getAllAccounts();
  await loading.stop();

  if (accounts.length === 0) {
    const msg = await ctx.reply(
      '📭 <b>Belum ada akun terdaftar.</b>\n\nTambahkan akun dengan tombol ➕ Tambah Akun.',
      { parse_mode: 'HTML', reply_markup: kbBack() }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const msg = await ctx.reply(
    `👥 <b>Kelola Akun</b>\nTotal: ${accounts.length} akun\n\nPilih akun:`,
    { parse_mode: 'HTML', reply_markup: kbAccountList(accounts) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuAddAccount(ctx) {
  sessionWizard.set(ctx.from.id, 'wait_phone');
  const msg = await ctx.reply(
    `➕ <b>Tambah Akun Baru</b>\n` +
    `${'─'.repeat(28)}\n` +
    `📱 Kirim nomor HP kamu:\n` +
    `<i>Contoh: +628123456789</i>\n\n` +
    `💡 <b>Siapkan:</b>\n` +
    `• API ID & Hash dari <code>my.telegram.org</code>\n` +
    `• Nomor aktif & bisa terima OTP\n` +
    `• Password 2FA (jika diaktifkan)`,
    { parse_mode: 'HTML', reply_markup: kbCancel() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuListAccounts(ctx) {
  const loading = await loadingManager.start(ctx, 'Memuat list akun');

  const accounts = await DB.getAllAccounts();
  await loading.stop();

  if (accounts.length === 0) {
    const msg = await ctx.reply('📭 Belum ada akun terdaftar.', {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const msg = await ctx.reply(Messages.accountList(accounts), {
    parse_mode: 'HTML',
    reply_markup: kbBack(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuStatusAll(ctx) {
  const loading = await loadingManager.start(ctx, 'Memuat status semua akun');

  const accounts = await DB.getAllAccounts();
  const states = {};
  const promos = {};

  for (const acc of accounts) {
    states[acc.id] = await promoManager.get(acc.id);
    promos[acc.id] = await DB.getOrCreatePromo(acc.id);
  }

  await loading.stop();

  if (accounts.length === 0) {
    const msg = await ctx.reply('📭 Belum ada akun.', {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const msg = await ctx.reply(
    Messages.allAccountsStatus(accounts, states, promos),
    { parse_mode: 'HTML', reply_markup: kbBack() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuOtpLog(ctx) {
  const loading = await loadingManager.start(ctx, 'Memuat riwayat OTP');

  const logs = await DB.getOtpLogs(20);
  await loading.stop();

  if (logs.length === 0) {
    const msg = await ctx.reply('📭 Belum ada log OTP.', {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const lines = [`🔐 <b>Log OTP Terakhir</b> (${logs.length} entri)\n${'═'.repeat(30)}`];
  for (const log of logs) {
    let dtStr;
    try {
      dtStr = new Date(log.created_at).toLocaleString('id-ID');
    } catch {
      dtStr = log.created_at || '?';
    }
    lines.push(
      `\n📱 ${code(log.phone || '?')}\n` +
      `🔑 ${log.otp_code} | dari ${code(log.source || '?')}\n` +
      `⏰ ${dtStr}`
    );
  }

  const msg = await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: kbBack(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuStats(ctx) {
  const loading = await loadingManager.start(ctx, 'Menghitung statistik global');

  const stats = await DB.getGlobalStats();
  await loading.stop();

  const msg = await ctx.reply(Messages.globalStats(stats), {
    parse_mode: 'HTML',
    reply_markup: kbBack(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuHelp(ctx) {
  const msg = await ctx.reply(Messages.help(), {
    parse_mode: 'HTML',
    reply_markup: kbBack(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleMenuSettings(ctx) {
  const msg = await ctx.reply(Messages.settings(), {
    parse_mode: 'HTML',
    reply_markup: kbSettings(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

// ═══════════════════════════════════════════════════════════
// SETTINGS HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleSettingsDelay(ctx) {
  sessionWizard.set(ctx.from.id, 'wait_setting_delay');
  const msg = await ctx.reply(
    `⏱ <b>Ubah Delay Putaran</b>\n` +
    `${'─'.repeat(28)}\n` +
    `Saat ini: ${CONFIG.DELAY_BETWEEN_ROUNDS / 60} menit\n\n` +
    `Kirim nilai baru dalam <b>menit</b> (angka bulat):`,
    { parse_mode: 'HTML', reply_markup: kbCancel() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleSettingsMaxfail(ctx) {
  sessionWizard.set(ctx.from.id, 'wait_setting_maxfail');
  const msg = await ctx.reply(
    `⚠️ <b>Ubah Max Gagal Blacklist</b>\n` +
    `${'─'.repeat(28)}\n` +
    `Saat ini: ${CONFIG.MAX_FAIL_BEFORE_BL}x\n\n` +
    `Kirim nilai baru (angka bulat, min 1):`,
    { parse_mode: 'HTML', reply_markup: kbCancel() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

// ═══════════════════════════════════════════════════════════
// ACCOUNT HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleAccDetail(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Memuat detail akun');

  const acc = await DB.getAccount(accountId);
  await loading.stop();

  if (!acc) {
    const msg = await ctx.reply('❌ Akun tidak ditemukan!', {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = await promoManager.get(accountId);
  const msg = await ctx.reply(Messages.accountDetail(acc, state), {
    parse_mode: 'HTML',
    reply_markup: kbAccount(accountId, state.active),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccInfo(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Memuat info lengkap akun');

  const acc = await DB.getAccount(accountId);
  if (!acc) {
    await loading.stop();
    const msg = await ctx.reply('❌ Akun tidak ditemukan!', {
      parse_mode: 'HTML',
      reply_markup: kbBack(),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const state = await promoManager.get(accountId);
  const promo = await DB.getOrCreatePromo(accountId);
  await loading.stop();

  const msg = await ctx.reply(Messages.accountInfo(acc, state, promo), {
    parse_mode: 'HTML',
    reply_markup: kbAccount(accountId, state.active),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccStart(ctx, accountId) {
  const state = await promoManager.get(accountId);

  if (!state.text) {
    const msg = await ctx.reply(
      '⚠️ <b>Teks promosi belum diset!</b>\nGunakan ✏️ Set Teks terlebih dahulu.',
      { parse_mode: 'HTML', reply_markup: kbAccount(accountId, false) }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  if (state.active) {
    const msg = await ctx.reply(
      '⚠️ Promosi sudah berjalan!',
      { parse_mode: 'HTML', reply_markup: kbAccount(accountId, true) }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const loading = await loadingManager.start(ctx, 'Scanning grup & memulai promosi');

  const groups = await scanGroups(accountId);
  if (groups.length === 0) {
    await loading.stop();
    const msg = await ctx.reply(Messages.noGroups(), {
      parse_mode: 'HTML',
      reply_markup: kbAccount(accountId, false),
    });
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  state.active = true;
  state.groups = groups;
  state.abortController = new AbortController();

  await DB.updatePromo(accountId, { active: 1 });

  // Start promo loop
  const task = promoLoop(accountId);
  state.task = task;

  await loading.stop();

  const msg = await ctx.reply(
    Messages.promoStarted(groups.length, state.blacklist.size),
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, true) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccStop(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Menghentikan promo loop');

  const state = await promoManager.get(accountId);
  const stopped = await state.stop();
  await DB.updatePromo(accountId, { active: 0 });

  await loading.stop();

  const msg = await ctx.reply(
    stopped ? Messages.promoStopped(state) : '⚠️ Promosi sudah berhenti.',
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, false) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccStatus(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Memuat status promosi');

  const state = await promoManager.get(accountId);
  await loading.stop();

  const msg = await ctx.reply(Messages.promoStatus(state), {
    parse_mode: 'HTML',
    reply_markup: kbAccount(accountId, state.active),
  });
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccScan(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Scanning semua grup & supergroup');

  const groups = await scanGroups(accountId);
  const state = await promoManager.get(accountId);
  state.groups = groups;

  await loading.stop();

  const msg = await ctx.reply(
    `✅ <b>Scan Selesai</b>\n` +
    `${'─'.repeat(28)}\n` +
    `📦 Grup ditemukan : ${groups.length}\n` +
    `🚫 Blacklist      : ${state.blacklist.size}\n` +
    `✅ Aktif promo    : ${groups.length}\n` +
    `⏰ Waktu          : ${new Date().toLocaleTimeString('id-ID', { hour12: false })}`,
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccSettext(ctx, accountId) {
  const state = await promoManager.get(accountId);
  let preview = '';
  if (state.text) {
    preview = (
      `\n\n📝 <b>Teks saat ini (${state.text.length} karakter):</b>\n` +
      `<i>${h(state.text.slice(0, 120))}${state.text.length > 120 ? '…' : ''}</i>`
    );
  }

  sessionWizard.set(ctx.from.id, `wait_promo_text:${accountId}`);
  const msg = await ctx.reply(
    `✏️ <b>Set Teks Promosi — Akun #${accountId}</b>\n` +
    `${'─'.repeat(28)}\n` +
    `Kirim teks promosi baru.\n` +
    `<i>Teks ini dikirim ke semua grup.</i>${preview}`,
    { parse_mode: 'HTML', reply_markup: kbCancel() }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccViewtext(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Memuat teks promosi');

  const state = await promoManager.get(accountId);
  await loading.stop();

  if (!state.text) {
    const msg = await ctx.reply(
      '❌ Belum ada teks promosi.\nGunakan ✏️ Set Teks.',
      { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  let display = state.text;
  if (display.length > 3500) {
    display = display.slice(0, 3500) + '\n… (terpotong)';
  }

  const msg = await ctx.reply(
    `📝 <b>Teks Promosi — Akun #${accountId}</b>\n` +
    `${'─'.repeat(28)}\n` +
    `📊 ${state.text.length} karakter\n\n` +
    `${h(display)}`,
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccBlacklist(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Memuat daftar blacklist');

  const state = await promoManager.get(accountId);
  await loading.stop();

  if (state.blacklist.size === 0) {
    const msg = await ctx.reply(
      '✅ Blacklist kosong. Tidak ada grup yang diblokir.',
      { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
    );
    messageManager.track(ctx.chat.id, msg.message_id);
    return;
  }

  const blItems = Array.from(state.blacklist);
  const shown = blItems.slice(0, 30);
  const more = blItems.length - 30;
  let blList = shown.map(gid => `• ${code(String(gid))}`).join('\n');
  if (more > 0) {
    blList += `\n<i>… +${more} grup lainnya</i>`;
  }

  const msg = await ctx.reply(
    `🚫 <b>Blacklist — Akun #${accountId}</b>\n` +
    `${'─'.repeat(28)}\n` +
    `Total: ${state.blacklist.size} grup\n\n${blList}`,
    { parse_mode: 'HTML', reply_markup: kbBlacklistMenu(accountId) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccClearBl(ctx, accountId) {
  const state = await promoManager.get(accountId);
  const msg = await ctx.reply(
    `⚠️ <b>Konfirmasi Hapus Blacklist</b>\n` +
    `${'─'.repeat(28)}\n` +
    `Total: ${state.blacklist.size} grup akan dihapus.\n\n` +
    `Yakin ingin menghapus semua blacklist?`,
    { parse_mode: 'HTML', reply_markup: kbConfirmClearBl(accountId) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccClearBlConfirm(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Menghapus semua blacklist');

  const state = await promoManager.get(accountId);
  const count = state.blacklist.size;
  state.blacklist.clear();
  await DB.clearBlacklist(accountId);

  await loading.stop();

  const msg = await ctx.reply(
    `✅ <b>Blacklist Dihapus</b>\n\n` +
    `🗑 ${count} grup berhasil dihapus dari blacklist.\n` +
    `⏰ ${new Date().toLocaleTimeString('id-ID', { hour12: false })}`,
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccResetstats(ctx, accountId) {
  const promo = await DB.getOrCreatePromo(accountId);
  const msg = await ctx.reply(
    `⚠️ <b>Konfirmasi Reset Statistik</b>\n` +
    `${'─'.repeat(28)}\n` +
    `✅ Total Kirim  : ${promo.total_sent || 0}\n` +
    `❌ Total Gagal  : ${promo.total_fail || 0}\n` +
    `🔁 Putaran      : ${promo.rounds || 0}\n\n` +
    `Semua data di atas akan direset ke 0.\nYakin?`,
    { parse_mode: 'HTML', reply_markup: kbConfirmResetStats(accountId) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccResetstatsConfirm(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Mereset statistik akun');

  await DB.resetPromoStats(accountId);
  const state = await promoManager.get(accountId);
  state.stats.totalSent = 0;
  state.stats.totalFail = 0;
  state.stats.rounds = 0;

  await loading.stop();

  const msg = await ctx.reply(
    `✅ <b>Statistik Direset</b>\n\n` +
    `Semua data statistik akun #${accountId} telah direset ke 0.\n` +
    `⏰ ${new Date().toLocaleTimeString('id-ID', { hour12: false })}`,
    { parse_mode: 'HTML', reply_markup: kbAccount(accountId, state.active) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccDeleteConfirm(ctx, accountId) {
  const acc = await DB.getAccount(accountId);
  const name = h(acc?.name || acc?.phone || `#${accountId}`);
  const msg = await ctx.reply(
    `🗑 <b>Konfirmasi Hapus Akun</b>\n` +
    `${'─'.repeat(28)}\n` +
    `Akun: ${name}\n` +
    `Phone: ${code(acc?.phone || 'N/A')}\n\n` +
    `⚠️ <b>Semua data akun akan dihapus permanen!</b>\n` +
    `Termasuk: sesi, teks promo, statistik, blacklist.\n\n` +
    `Yakin ingin menghapus?`,
    { parse_mode: 'HTML', reply_markup: kbConfirmDelete(accountId) }
  );
  messageManager.track(ctx.chat.id, msg.message_id);
}

async function handleAccDelete(ctx, accountId) {
  const loading = await loadingManager.start(ctx, 'Menghapus akun & sesi');

  // Stop promo if running
  const state = await promoManager.get(accountId);
  if (state.active) {
    await state.stop();
  }

  // Stop & remove client
  const cl = clientRegistry.get(accountId);
  if (cl) {
    try { await cl.disconnect(); } catch { /* ignore */ }
    await clientRegistry.remove(accountId);
  }

  // Remove from promo manager
  promoManager.remove(accountId);

  // Delete from DB
  await DB.deleteAccount(accountId);

  await loading.stop();

  // Notify owner
  const msg = await ctx.reply(Messages.accountDeleted(accountId), {
    parse_mode: 'HTML',
    reply_markup: kbBack(),
  });
  messageManager.track(ctx.chat.id, msg.message_id);

  // Send notification
  try {
    await ctx.api.sendMessage(
      CONFIG.OWNER_ID,
      `🗑 Akun #${accountId} telah dihapus.`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    logger.error(`Delete notification error: ${err.message}`);
  }
}

function code(text) {
  return `<code>${h(String(text))}</code>`;
}