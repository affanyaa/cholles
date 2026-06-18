# Auto Promo Bot Ultimate V4.0

Bot Telegram multi-akun untuk promosi otomatis ke grup dengan auto-detect OTP, tanpa delay per grup, dan manajemen userbot lengkap.

## Fitur Utama

- **Multi-Userbot** — Tambah & kelola multiple akun Telegram sebagai userbot
- **Broadcast Tanpa Delay** — Kirim pesan promo ke ratusan grup tanpa delay per grup
- **OTP Auto-Detect** — Deteksi kode OTP dan forward semua pesan privat ke owner
- **Auto-Delete Message** — Pesan bot otomatis dihapus saat interaksi baru
- **Loading Animations** — Animasi loading profesional di semua fitur
- **Inline Keyboard** — Semua fitur diakses via tombol inline
- **Auto-Blacklist** — Grup yang gagal otomatis masuk blacklist
- **2FA Support** — Login dengan verifikasi dua langkah
- **Full Statistics** — Statistik lengkap per akun dan global
- **Session Persistence** — Auto-reconnect saat bot restart

## Tech Stack

- **Runtime**: Node.js 18+
- **Bot Framework**: [Grammy](https://grammy.dev)
- **MTProto Client**: [GramJS](https://github.com/gram-js/gramjs)
- **Database**: SQLite (better-sqlite3)
- **Logging**: Winston

## Instalasi

### 1. Clone & Install

```bash
git clone <repo-url>
cd telegram-auto-promo-bot
npm install
```

### 2. Konfigurasi Environment

```bash
cp .env.example .env
```

Edit file `.env`:

```env
API_ID=your_api_id          # Dari my.telegram.org
API_HASH=your_api_hash      # Dari my.telegram.org
BOT_TOKEN=your_bot_token    # Dari @BotFather
OWNER_ID=your_telegram_id   # ID Telegram owner
```

### 3. Jalankan Bot

```bash
npm start
```

Atau untuk development dengan auto-reload:

```bash
npm run dev
```

## Cara Penggunaan

### Menambah Akun (Userbot)

1. Klik **➕ Tambah Akun** di menu utama
2. Kirim nomor HP (format: +628123456789)
3. Kirim API ID (angka dari my.telegram.org)
4. Kirim API Hash (string dari my.telegram.org)
5. Kirim kode OTP yang diterima
6. Jika ada 2FA → kirim password 2FA

### Mengatur Teks Promosi

1. Klik **👥 Kelola Akun**
2. Pilih akun yang ingin digunakan
3. Klik **✏️ Set Teks**
4. Kirim teks promosi

### Memulai Promosi

1. Pastikan teks promosi sudah diatur
2. Klik **▶️ Mulai Promo**
3. Bot akan scan grup dan mulai broadcast

### Menghentikan Promosi

1. Klik **⏹ Stop Promo**
2. Promosi akan dihentikan gracefully

## Struktur Folder

```
telegram-auto-promo-bot/
├── src/
│   ├── index.js              # Entry point
│   ├── bot.js                # Grammy bot setup
│   ├── config.js             # Konfigurasi & env
│   ├── database.js           # SQLite database
│   ├── logger.js             # Winston logging
│   ├── core/                 # Core modules
│   │   ├── clientRegistry.js # MTProto client manager
│   │   ├── promoEngine.js    # Promo loop engine
│   │   ├── otpWatcher.js     # OTP detection & forward
│   │   ├── sessionWizard.js  # Login wizard state
│   │   ├── loadingManager.js # Loading animations
│   │   ├── messageManager.js # Auto-delete messages
│   │   └── startupManager.js # Startup reconnect
│   ├── handlers/             # Bot handlers
│   │   ├── commands.js       # /start, /help, dll
│   │   ├── callbackHandler.js # Inline button handlers
│   │   └── textHandler.js    # Text message handlers
│   └── utils/                # Utilities
│       ├── helpers.js        # Helper functions
│       ├── keyboards.js      # Inline keyboards
│       └── messages.js       # Message templates
├── data/                     # SQLite database
├── sessions/                 # Session files
├── logs/                     # Log files
├── .env                      # Environment variables
├── .env.example              # Example env
├── .gitignore
├── package.json
└── README.md
```

## Menu Owner

| Tombol | Fungsi |
|--------|--------|
| 👥 Kelola Akun | Lihat & pilih akun untuk dikelola |
| 📊 Status Semua | Status semua akun dalam satu tampilan |
| ➕ Tambah Akun | Wizard tambah akun baru |
| 📋 List Akun | Daftar semua akun (ringkas) |
| 🔐 Log OTP | Riwayat OTP yang terdeteksi |
| 📈 Statistik | Statistik global semua akun |
| ❓ Bantuan | Panduan penggunaan |
| ⚙️ Pengaturan | Ubah delay & max fail |

## Perbaikan Bug dari V3 Python

### 36+ Bug Diperbaiki:

1. **Race Condition** pada client registry access
2. **Missing method** `unregister` → renamed ke `remove`
3. **Indentation Error** di `_cb_menu_list_accounts` (SyntaxError)
4. **Memory Leak** promo states tidak pernah dihapus
5. **Double Delete** saat cleanup akun
6. **Invalid Attribute** `sent_count`, `fail_count`, `round_num` tidak ada di dataclass
7. **Loading Zombie** animation task tidak di-cleanup saat exception
8. **FloodWait Inconsistency** — unified error handling
9. **Concurrent Modification** `state.groups` berubah saat iterasi
10. **Duplicate Functions** `start_user_clients` & `startup_reconnect`
11. **No Graceful Shutdown** — signal handler ditambahkan
12. **No Auto-Delete** — implementasi message tracking & auto-delete
13. **Loading Animation Race** — pesan diedit setelah dihapus
14. **OTP False Positive** — pattern matching diperbaiki
15. **No Session Revocation** — session string tidak di-revoke saat delete
16. **Database No Index** — index ditambahkan untuk performa
17. **Pending Sessions Leak** — cleanup otomatis setelah 1 jam
18. **No Max Groups Limit** — batas 500 grup per putaran
19. **Message Edit Race** — `safe_edit` menerima parameter tapi tidak konsisten
20. **No Connection Pooling** — SQLite WAL mode + busy timeout
21. **HTML Escape None** — `h(null)` return "None" → diperbaiki
22. **Keyboard Limit** — potensi >100 tombol tidak di-handle
23. **Retry Logic Bug** — delay backoff tidak konsisten
24. **cancellable_sleep Bug** — tidak handle pre-set event
25. **Stop Loading Double** — `done.set()` dipanggil double
26. **Promo Resume Bug** — client disconnect tapi promo tetap jalan
27. **No Account Existence Check** — start promo tanpa client aktif
28. **Type Safety** — JS type coercion di banyak tempat
29. **No Error Boundary** — `callback_handler` tidak catch error
30. **Bot Message Leak** — pesan bot menumpuk tidak pernah dihapus
31. **Session Cleanup** — file session tidak dihapus saat akun dihapus
32. **BlackList Clear** — tidak ada konfirmasi sebelum clear
33. **Stats Reset** — menggunakan attribute yang tidak ada
34. **Loop Task Cleanup** — `add_done_callback` tidak reliable
35. **No Retry for `scan_groups`** — retry mechanism ditambahkan
36. **Global Variable Mutation** — `DELAY_BETWEEN_ROUNDS` & `MAX_FAIL_BEFORE_BL` race condition

## Lisensi

MIT