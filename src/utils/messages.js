import { h, bold, code, italic, sep, dsep, ts, trunc } from './helpers.js';
import { CONFIG } from '../config.js';

export const Messages = {
  // Welcome
  welcome(botUsername) {
    return (
      `👋 <b>Selamat Datang!</b>\n\n` +
      `🤖 <b>Auto Promo Bot Ultimate V4.0</b>\n` +
      `${dsep(28)}\n` +
      `⚡ Multi-akun tanpa delay per grup\n` +
      `🔐 OTP auto-detect & forward\n` +
      `📊 Statistik lengkap\n` +
      `🔁 Auto blacklist & retry\n\n` +
      `Pilih menu di bawah:`
    );
  },

  // Main menu info
  mainMenu() {
    return (
      `🤖 <b>Auto Promo Bot Ultimate V4.0</b>\n` +
      `${dsep(28)}\n` +
      `⚡ Tanpa delay per grup\n` +
      `🔐 OTP auto-detect\n` +
      `📡 Multi-akun\n\n` +
      `Pilih menu:`
    );
  },

  // Account detail
  accountDetail(acc, state) {
    const name = h(acc.name || acc.phone);
    return (
      `👤 <b>Akun #${acc.id}</b>\n` +
      `${sep(28)}\n` +
      `📱 Nama      : ${bold(name)}\n` +
      `🆔 Username  : @${acc.username || 'N/A'}\n` +
      `📞 Phone     : ${code(acc.phone)}\n` +
      `🔑 API ID    : ${code(acc.api_id)}\n` +
      `🔐 API Hash  : ${code((acc.api_hash || '').slice(0, 8) + '…')}\n` +
      `🔒 2FA       : ${acc.two_fa ? 'Aktif ✓' : 'Tidak'}\n` +
      `${sep(28)}\n` +
      `Pilih aksi:`
    );
  },

  // Account full info
  accountInfo(acc, state, promo) {
    let created, lastseen;
    try {
      created = acc.created_at ? new Date(acc.created_at).toLocaleString('id-ID') : '?';
      lastseen = acc.last_seen ? new Date(acc.last_seen).toLocaleString('id-ID') : '?';
    } catch {
      created = lastseen = '?';
    }

    const total = (promo.total_sent || 0) + (promo.total_fail || 0);
    const rate = total > 0 ? ((promo.total_sent / total) * 100).toFixed(1) + '%' : 'N/A';

    return (
      `ℹ️ <b>Info Lengkap Akun #${acc.id}</b>\n` +
      `${dsep(30)}\n\n` +
      `<b>📱 Data Akun:</b>\n` +
      `👤 Nama        : ${bold(acc.name || 'N/A')}\n` +
      `🆔 Username    : @${acc.username || 'N/A'}\n` +
      `📞 Phone       : ${code(acc.phone)}\n` +
      `🔑 API ID      : ${code(acc.api_id)}\n` +
      `🔐 API Hash    : ${code((acc.api_hash || '').slice(0, 8) + '…')}\n` +
      `🆔 TG User ID  : ${code(acc.tg_user_id || 0)}\n` +
      `🔒 2FA         : ${acc.two_fa ? 'Aktif ✓' : 'Tidak'}\n` +
      `📅 Dibuat      : ${created}\n` +
      `👁 Terakhir    : ${lastseen}\n\n` +
      `<b>📊 Status Promosi:</b>\n` +
      `${state.active ? '🟢 Aktif' : '🔴 Mati'}\n` +
      `📦 Grup        : ${state.groups?.length || 0}\n` +
      `🚫 Blacklist   : ${state.blacklist?.size || 0}\n` +
      `📝 Teks        : ${state.text ? '✅ Siap' : '❌ Belum diset'}\n\n` +
      `<b>📈 Statistik:</b>\n` +
      `✅ Total Kirim  : ${promo.total_sent || 0}\n` +
      `❌ Total Gagal  : ${promo.total_fail || 0}\n` +
      `🔁 Putaran      : ${promo.rounds || 0}\n` +
      `📊 Sukses       : ${rate}\n` +
      `${dsep(30)}`
    );
  },

  // Promo status
  promoStatus(state) {
    const s = state.stats || {};
    const icon = state.active ? '🟢' : '🔴';
    const txt = state.text ? '✅ Siap' : '❌ Belum diset';
    return (
      `📊 <b>Status Promosi #${state.accountId}</b>\n` +
      `${sep(30)}\n` +
      `${icon} <b>Status</b>     : ${state.active ? 'Aktif' : 'Mati'}\n` +
      `📦 <b>Grup</b>        : ${state.groups?.length || 0}\n` +
      `🚫 <b>Blacklist</b>   : ${state.blacklist?.size || 0}\n` +
      `📝 <b>Teks</b>        : ${txt}\n` +
      `${sep(30)}\n` +
      `📈 <b>Total Kirim</b>  : ${s.totalSent || 0}\n` +
      `📉 <b>Total Gagal</b>  : ${s.totalFail || 0}\n` +
      `🔁 <b>Putaran</b>      : ${s.rounds || 0}\n` +
      `${sep(30)}\n` +
      `⏰ <b>Update</b>       : ${ts()}`
    );
  },

  // Promo started
  promoStarted(groupsLen, blacklistLen) {
    return (
      `✅ <b>Promosi Dimulai!</b>\n` +
      `${sep(28)}\n` +
      `📦 Grup ditemukan  : ${groupsLen}\n` +
      `🚫 Blacklist       : ${blacklistLen}\n` +
      `⚡ Delay per grup  : Tanpa delay\n` +
      `🔁 Interval putaran: ${CONFIG.DELAY_BETWEEN_ROUNDS / 60} menit\n` +
      `${sep(28)}\n` +
      `🚀 Broadcast dimulai sekarang!\n` +
      `⏰ ${ts()}`
    );
  },

  // Promo stopped
  promoStopped(state) {
    return (
      `⏹ <b>Promosi Dihentikan</b>\n\n` +
      this.promoStatus(state)
    );
  },

  // Round complete
  roundComplete(roundNum, ok, fail, accountId, groupsLen, blacklistLen) {
    return (
      `✅ <b>Putaran ${roundNum} Selesai</b>\n` +
      `${sep(28)}\n` +
      `👤 Akun    : #${accountId}\n` +
      `📊 Kirim   : ${ok}\n` +
      `❌ Gagal   : ${fail}\n` +
      `📦 Grup    : ${groupsLen}\n` +
      `🚫 BL      : ${blacklistLen}\n` +
      `⏳ Tunggu  : ${CONFIG.DELAY_BETWEEN_ROUNDS / 60} menit\n` +
      `⏰ Waktu   : ${ts()}`
    );
  },

  // OTP detected
  otpDetected(phone, otp, source, senderName, isTelegram) {
    return (
      `🔐 <b>OTP Terdeteksi!</b>\n` +
      `${dsep(28)}\n` +
      `📱 Akun      : ${code(phone)}\n` +
      `🔑 Kode OTP  : ${bold(otp)}\n` +
      `📨 Dari      : ${code(source)}\n` +
      `👤 Nama      : ${h(senderName)}\n` +
      `✅ Telegram  : ${isTelegram ? 'Ya ✓' : 'Tidak'}\n` +
      `⏰ Waktu     : ${ts()}\n` +
      `${dsep(28)}\n` +
      `⚡ ${italic('Kode OTP berlaku ~30 detik!')}`
    );
  },

  // Forwarded message
  forwardedMessage(accountId, phone, senderName, source, text) {
    const preview = text ? h(trunc(text, 400)) : '<i>(media / sticker)</i>';
    return (
      `📩 <b>Pesan Masuk — Akun #${accountId}</b>\n` +
      `${sep(28)}\n` +
      `📱 Akun  : ${code(phone)}\n` +
      `👤 Dari  : ${h(senderName)} (${code(source)})\n` +
      `⏰ Waktu : ${ts()}\n` +
      `${sep(28)}\n` +
      `💬 <b>Isi Pesan:</b>\n${preview}`
    );
  },

  // Account added
  accountAdded(phone, me, accountId, twoFa) {
    return (
      `✅ <b>Akun Berhasil Ditambahkan!</b>\n` +
      `${dsep(28)}\n` +
      `📱 Nomor     : ${code(phone)}\n` +
      `👤 Nama      : ${bold(me.firstName || 'N/A')}\n` +
      `🆔 Username  : @${me.username || 'N/A'}\n` +
      `🔑 ID Akun   : #${accountId}\n` +
      `🔐 2FA       : ${twoFa ? 'Aktif ✓' : 'Tidak'}\n` +
      `${dsep(28)}\n` +
      `✨ Akun siap digunakan!`
    );
  },

  // New account notification
  newAccountNotification(accountId, name, username, phone) {
    return (
      `🆕 <b>Akun Baru Ditambahkan</b>\n` +
      `#${accountId} — ${bold(name || 'N/A')} (@${username || 'N/A'})\n` +
      `📱 ${code(phone)}`
    );
  },

  // Account deleted
  accountDeleted(accountId) {
    return (
      `✅ <b>Akun #${accountId} Berhasil Dihapus</b>\n\n` +
      `Semua data akun telah dihapus secara permanen.\n` +
      `⏰ ${ts()}`
    );
  },

  // Global stats
  globalStats(stats) {
    return (
      `📈 <b>Statistik Global</b>\n` +
      `${dsep(28)}\n` +
      `📦 Total Akun     : ${stats.totalAccounts}\n` +
      `▶️  Akun Aktif     : ${stats.activeAccounts}\n` +
      `▶️  Promo Aktif    : ${stats.activePromos}\n` +
      `${sep(28)}\n` +
      `✅ Total Kirim    : ${stats.totalSent}\n` +
      `❌ Total Gagal    : ${stats.totalFail}\n` +
      `🔁 Total Putaran  : ${stats.totalRounds}\n` +
      `📊 Tingkat Sukses : ${stats.successRate}\n` +
      `${sep(28)}\n` +
      `⏰ Update         : ${ts()}`
    );
  },

  // All accounts status
  allAccountsStatus(accounts, states, promos) {
    let totalSent = 0, totalFail = 0, activeCnt = 0;
    const lines = [`📊 <b>Status Semua Akun</b>\n${dsep(30)}`];

    for (const acc of accounts) {
      const promo = promos[acc.id] || {};
      const state = states[acc.id];
      const sIcon = state?.active ? '🟢 Aktif' : '🔴 Mati';
      const name = h(acc.name || acc.phone);
      totalSent += promo.total_sent || 0;
      totalFail += promo.total_fail || 0;
      if (state?.active) activeCnt++;

      lines.push(
        `\n${bold(`#${acc.id} ${name}`)}\n` +
        `${sIcon} | Grup: ${state?.groups?.length || 0} | BL: ${state?.blacklist?.size || 0}\n` +
        `✅ ${promo.total_sent || 0} | ❌ ${promo.total_fail || 0} | 🔁 ${promo.rounds || 0}`
      );
    }

    lines.push(
      `\n${dsep(30)}\n` +
      `📦 Total Akun  : ${accounts.length}\n` +
      `▶️  Aktif      : ${activeCnt}\n` +
      `📈 Total Kirim : ${totalSent}\n` +
      `📉 Total Gagal : ${totalFail}\n` +
      `⏰ Update      : ${ts()}`
    );

    return lines.join('\n');
  },

  // Account list
  accountList(accounts) {
    const lines = [
      `📋 <b>List Semua Akun</b> (${accounts.length} total)\n` +
      `${dsep(30)}`
    ];

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const icon = acc.active ? '🟢' : '🔴';
      const name = h(acc.name || acc.phone);
      lines.push(`${i + 1}. ${icon} ${bold(`#${acc.id} ${name}`)} — ${code(acc.phone)}`);
    }

    return lines.join('\n');
  },

  // Help
  help() {
    return (
      `❓ <b>Bantuan & Panduan</b>\n` +
      `${dsep(28)}\n\n` +
      `<b>📱 Cara Tambah Akun:</b>\n` +
      `1. Siapkan API ID & Hash dari ${code('my.telegram.org')}\n` +
      `2. Klik ➕ Tambah Akun\n` +
      `3. Masukkan nomor HP (format: +62xxx)\n` +
      `4. Masukkan API ID (angka)\n` +
      `5. Masukkan API Hash (32 karakter)\n` +
      `6. Masukkan kode OTP yang diterima\n` +
      `7. Jika ada 2FA → masukkan password\n\n` +
      `<b>✏️ Set Teks Promosi:</b>\n` +
      `1. Pilih akun dari 👥 Kelola Akun\n` +
      `2. Klik ✏️ Set Teks\n` +
      `3. Kirim teks promosi\n\n` +
      `<b>▶️ Mulai Promosi:</b>\n` +
      `1. Pastikan teks sudah diset\n` +
      `2. Klik ▶️ Mulai Promo\n` +
      `3. Bot scan grup → mulai broadcast\n\n` +
      `<b>🔐 OTP Auto-Detect:</b>\n` +
      `• Kode OTP otomatis dikirim ke owner\n` +
      `• Semua pesan privat diteruskan\n\n` +
      `<b>⚙️ Pengaturan Default:</b>\n` +
      `• Delay per grup   : ⚡ TANPA DELAY\n` +
      `• Delay putaran    : ${CONFIG.DELAY_BETWEEN_ROUNDS / 60} menit\n` +
      `• Auto-blacklist   : ${CONFIG.MAX_FAIL_BEFORE_BL}x gagal berturut\n\n` +
      `<b>🚫 Blacklist:</b>\n` +
      `• Gagal ${CONFIG.MAX_FAIL_BEFORE_BL}x → otomatis blacklist\n` +
      `• Bisa dihapus via menu Blacklist`
    );
  },

  // Settings
  settings() {
    return (
      `⚙️ <b>Pengaturan Bot</b>\n` +
      `${sep(28)}\n` +
      `⏱ Delay antar putaran : ${CONFIG.DELAY_BETWEEN_ROUNDS / 60} menit\n` +
      `⚠️ Max gagal blacklist : ${CONFIG.MAX_FAIL_BEFORE_BL}x\n` +
      `⚡ Delay per grup      : Tanpa delay\n` +
      `🔁 Max retry           : ${CONFIG.MAX_RETRIES}x`
    );
  },

  // Bot online
  botOnline(botUsername) {
    return (
      `🚀 <b>Bot Online!</b>\n` +
      `${sep(24)}\n` +
      `🤖 @${botUsername}\n` +
      `⏰ ${ts()}\n` +
      `📦 Versi: V4.0 Ultimate`
    );
  },

  // Promo crash
  promoCrash(accountId, error) {
    return (
      `❌ <b>Promo Crash</b>\n` +
      `Akun #${accountId}\n` +
      `Error: ${code(String(error))}`
    );
  },

  // No groups found
  noGroups() {
    return (
      `❌ Tidak ada grup ditemukan!\n` +
      `Pastikan akun sudah bergabung ke grup.`
    );
  },
};