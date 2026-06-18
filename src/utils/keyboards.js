import { InlineKeyboard } from 'grammy';
import { CONFIG } from '../config.js';

/**
 * Main menu keyboard
 */
export function kbMain() {
  return new InlineKeyboard()
    .text('👥 Kelola Akun', 'menu:accounts')
    .text('📊 Status Semua', 'menu:status_all').row()
    .text('➕ Tambah Akun', 'menu:add_account')
    .text('📋 List Akun', 'menu:list_accounts').row()
    .text('🔐 Log OTP', 'menu:otp_log')
    .text('📈 Statistik', 'menu:stats').row()
    .text('❓ Bantuan', 'menu:help')
    .text('⚙️ Pengaturan', 'menu:settings');
}

/**
 * Account management keyboard
 */
export function kbAccount(accountId, isActive) {
  const toggleLabel = isActive ? '⏹ Stop Promo' : '▶️ Mulai Promo';
  const toggleData = isActive ? `acc:stop:${accountId}` : `acc:start:${accountId}`;
  return new InlineKeyboard()
    .text(toggleLabel, toggleData)
    .text('📊 Status', `acc:status:${accountId}`).row()
    .text('✏️ Set Teks', `acc:settext:${accountId}`)
    .text('📜 Lihat Teks', `acc:viewtext:${accountId}`).row()
    .text('🔄 Scan Grup', `acc:scan:${accountId}`)
    .text('🚫 Blacklist', `acc:blacklist:${accountId}`).row()
    .text('ℹ️ Info Lengkap', `acc:info:${accountId}`)
    .text('📈 Reset Stats', `acc:resetstats:${accountId}`).row()
    .text('🗑 Hapus Akun', `acc:delete_confirm:${accountId}`)
    .text('◀️ Kembali', 'menu:accounts');
}

/**
 * Account list keyboard
 */
export function kbAccountList(accounts) {
  const kb = new InlineKeyboard();
  for (const acc of accounts) {
    const icon = acc.active ? '🟢' : '🔴';
    const label = `${icon} #${acc.id} ${acc.name || acc.phone}`;
    kb.text(label, `acc:detail:${acc.id}`).row();
  }
  kb.text('◀️ Kembali', 'menu:main');
  return kb;
}

/**
 * Back button
 */
export function kbBack(to = 'menu:main') {
  return new InlineKeyboard().text('◀️ Kembali', to);
}

/**
 * Back to account button
 */
export function kbBackAccount(accountId) {
  return new InlineKeyboard().text('◀️ Kembali ke Akun', `acc:detail:${accountId}`);
}

/**
 * Cancel button
 */
export function kbCancel() {
  return new InlineKeyboard().text('❌ Batal', 'menu:main');
}

/**
 * Confirm delete
 */
export function kbConfirmDelete(accountId) {
  return new InlineKeyboard()
    .text('✅ Ya, Hapus Permanen', `acc:delete:${accountId}`)
    .text('❌ Batal', `acc:detail:${accountId}`);
}

/**
 * Confirm clear blacklist
 */
export function kbConfirmClearBl(accountId) {
  return new InlineKeyboard()
    .text('✅ Ya, Hapus Semua', `acc:clear_bl_confirm:${accountId}`)
    .text('❌ Batal', `acc:blacklist:${accountId}`);
}

/**
 * Confirm reset stats
 */
export function kbConfirmResetStats(accountId) {
  return new InlineKeyboard()
    .text('✅ Ya, Reset', `acc:resetstats_confirm:${accountId}`)
    .text('❌ Batal', `acc:detail:${accountId}`);
}

/**
 * Blacklist menu
 */
export function kbBlacklistMenu(accountId) {
  return new InlineKeyboard()
    .text('🗑 Hapus Semua Blacklist', `acc:clear_bl:${accountId}`).row()
    .text('◀️ Kembali', `acc:detail:${accountId}`);
}

/**
 * Settings keyboard
 */
export function kbSettings() {
  return new InlineKeyboard()
    .text(`⏱ Delay Putaran: ${CONFIG.DELAY_BETWEEN_ROUNDS / 60} mnt`, 'settings:delay').row()
    .text(`⚠️ Max Gagal BL: ${CONFIG.MAX_FAIL_BEFORE_BL}x`, 'settings:maxfail').row()
    .text('◀️ Kembali', 'menu:main');
}

/**
 * Yes/No confirmation
 */
export function kbConfirm(yesData, noData, yesLabel = '✅ Ya', noLabel = '❌ Batal') {
  return new InlineKeyboard()
    .text(yesLabel, yesData)
    .text(noLabel, noData);
}

/**
 * OTP Log keyboard
 */
export function kbOtpLog() {
  return new InlineKeyboard().text('◀️ Kembali', 'menu:main');
}

/**
 * Userbot list keyboard (admin)
 */
export function kbUserbotList(accounts) {
  const kb = new InlineKeyboard();
  for (const acc of accounts.slice(0, 20)) {
    const icon = acc.active ? '🟢' : '🔴';
    kb.text(`${icon} #${acc.id} ${acc.phone}`, `ubot:detail:${acc.id}`).row();
  }
  if (accounts.length > 20) {
    kb.text(`… dan ${accounts.length - 20} lainnya`, 'noop').row();
  }
  kb.text('◀️ Kembali', 'menu:main');
  return kb;
}