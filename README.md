# Perushaan AI — Kantor 3D

Kantor 3D ala The Sims dengan satu karyawan AI, **Raka (Lead Hunter)**, yang mencari calon pelanggan di Threads.

- Raka hanya mencari orang yang **lagi butuh** produk/jasa kita (calon pembeli), **bukan** yang menawarkan jasa (penjual/kompetitor).
- Mesinnya **Claude Code** di komputer ini, memakai login **subscription Claude** (bukan API key). Model: **Claude Sonnet 5.5, effort medium**.
- Semua aktivitas yang tampil adalah langkah asli dari Claude Code. Tidak ada data simulasi.

Detail teknis (alur, API, format data, prompt): [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md).

---

## Daftar isi

1. [Fitur](#fitur)
2. [Prasyarat](#prasyarat)
3. [Instalasi](#instalasi)
4. [Menjalankan](#menjalankan)
5. [Cara pakai](#cara-pakai)
6. [Browsing Threads dengan akun (Claude in Chrome)](#browsing-threads-dengan-akun-claude-in-chrome)
7. [Struktur project](#struktur-project)
8. [Konfigurasi](#konfigurasi)
9. [Troubleshooting](#troubleshooting)
10. [Keamanan & privasi](#keamanan--privasi)
11. [Pindah ke VPS](#pindah-ke-vps)
12. [Kredit aset](#kredit-aset)

---

## Fitur

| Fitur | Keterangan |
|---|---|
| Kantor 3D | Raka jalan ke meja, duduk, dan mengetik saat bekerja. Saat istirahat dia ke troli kopi atau kursi lounge. |
| Layar live | Monitor Raka menampilkan langkah kerjanya secara live. TV di dinding menampilkan ringkasan lead. |
| Tugas | Kasih perintah bebas, atau kosongkan untuk memakai brief di Pengaturan. |
| Aktivitas | Feed langkah asli Claude Code, laporan akhir, dan riwayat kerja. |
| Leads | Profil, postingan, kutipan, alasan, dan skor 1–5. Status bisa diubah, dan bisa **Export CSV**. |
| Jadwal otomatis | Raka kerja sendiri di jam tertentu (default 09:00 & 15:00). |
| Kuota Claude | Pojok kiri atas: limit **5 jam** dan **mingguan**, angkanya sama dengan `/usage` di Claude Code. |

## Prasyarat

| Kebutuhan | Versi / catatan |
|---|---|
| Node.js | **20+** |
| Claude Code CLI | Terpasang dan sudah login: jalankan `claude` sekali, lalu login dengan akun Claude (Pro/Max). |
| Google Chrome + ekstensi Claude in Chrome | Opsional, tapi disarankan. Lihat [bagian Chrome](#browsing-threads-dengan-akun-claude-in-chrome). |

> **Jangan** set `ANTHROPIC_API_KEY`. Server juga membuangnya saat menjalankan Raka, supaya pemakaian masuk ke subscription, bukan ditagih per token.

## Instalasi

```bash
npm install
npm run assets      # sekali saja: unduh aset 3D (CC0) ke public/assets/
```

`npm run assets` aman diulang: file yang sudah ada dilewati.

## Menjalankan

**Development** (auto-reload server + frontend):

```bash
npm run dev         # buka http://localhost:5173
```

**Production / demo:**

```bash
npm run build
npm start           # buka http://localhost:8787
```

| Script | Fungsi |
|---|---|
| `npm run dev` | Server di `:8787` (restart otomatis saat file server berubah) + Vite di `:5173` (hot reload). |
| `npm run build` | Build frontend ke `dist/`. |
| `npm start` | Server di `:8787`, sekaligus menyajikan `dist/`. |
| `npm run assets` | Unduh aset 3D ke `public/assets/`. |

## Cara pakai

1. **Pengaturan**: isi kita jualan apa, lead seperti apa yang dicari, keyword awal, lokasi, dan target lead per kerja, lalu **Simpan**.
2. **Tugas**: tulis perintah (opsional), lalu klik **Mulai kerja**. Kalau perintah dikosongkan, Raka memakai isi Pengaturan.
3. **Aktivitas**: lihat langkahnya. Tombol **Layar Raka** di bawah mendekatkan kamera ke monitornya. Klik karakter Raka juga membuka tampilan ini.
4. **Leads**: cek hasilnya, ubah status (`baru` → `dihubungi` → `tertarik` / `tidak cocok`), atau **Export CSV**.
5. **Jadwal otomatis**: nyalakan di tab Tugas. Server harus tetap jalan.

**Tips menulis perintah:**

- Sebutkan apa yang kita jual, siapa target pembelinya, dan rentang waktu. Contoh:
  > Kita jualan custom packaging (box, paper bag, pouch) MOQ kecil. Cari 10 pemilik UMKM/brand di Threads yang lagi cari vendor kemasan, postingan 2 minggu terakhir.
- "cari jasa website" dibaca sebagai **"cari orang yang butuh website"**. Raka tidak akan mencari penyedia jasanya.
- **Jadwal otomatis tidak membaca isi Tugas.** Kriteria yang mau dipakai terus harus ditulis di **Pengaturan**.

## Browsing Threads dengan akun (Claude in Chrome)

Supaya Raka bisa membuka Threads seperti manusia dengan akun yang sudah login:

1. Pasang ekstensi [Claude in Chrome](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) di Google Chrome.
2. Login ke ekstensi dengan **akun Claude yang sama** dengan Claude Code.
3. Login ke Threads di Chrome itu. **Pakai akun khusus, jangan akun utama.**
4. Biarkan Chrome terbuka saat Raka bekerja.

Kalau Chrome tidak tersambung, Raka otomatis pindah ke web search (halaman tag Threads publik) dan menyebutkannya di laporan. Mode ini juga bisa dipilih manual di Pengaturan → **Cara kerja**.

Aturan untuk Raka: **hanya membaca**. Dia tidak boleh like, follow, komentar, repost, DM, atau mengisi form. Kalau ketemu login, CAPTCHA, atau checkpoint, dia berhenti dan melapor.

## Struktur project

```
.
├── server/               Backend Node (tanpa framework)
│   ├── index.mjs         HTTP API + WebSocket, status karyawan, jadwal otomatis
│   ├── agent.mjs         Menjalankan `claude -p`, system prompt Raka, format output lead
│   ├── store.mjs         Baca/tulis data JSON di data/
│   └── usage.mjs         Kuota Claude: limit 5 jam & mingguan
├── src/                  Frontend React + React Three Fiber
│   ├── App.jsx           Layout: panggung 3D, tombol kamera, jam, panel
│   ├── useOffice.js      State live: fetch awal + update via WebSocket
│   ├── styles.css        Semua styling
│   ├── ui/
│   │   ├── Panel.jsx     Panel kanan: Tugas, Aktivitas, Leads, Pengaturan
│   │   └── UsageBadge.jsx  Meter kuota di kiri atas
│   └── scene/            Kantor 3D
│       ├── Scene.jsx     Canvas, kamera (3 view), lighting, post-processing
│       ├── Room.jsx      Lantai, dinding, jendela, karpet, cahaya
│       ├── Furniture.jsx Furnitur Poly Haven
│       ├── Workstation.jsx Meja, kursi, monitor
│       ├── Employee.jsx  Karakter Raka: jalan, duduk, mengetik, animasi status
│       ├── screens.js    Isi monitor & TV (digambar di canvas)
│       └── layout.js     Posisi meja dan titik tujuan karakter (meter)
├── scripts/
│   └── fetch-assets.mjs  Unduh aset 3D
├── public/assets/        Aset 3D (hasil `npm run assets`)
├── data/                 Dibuat otomatis saat runtime (di-gitignore)
├── docs/ARSITEKTUR.md    Dokumentasi teknis
├── index.html            Entry Vite
└── vite.config.js        Proxy /api dan /ws ke :8787 saat dev
```

## Konfigurasi

| Apa | Di mana |
|---|---|
| Brief (jualan apa, target, keyword, lokasi, target per kerja), cara kerja, jam jadwal | Tab **Pengaturan** di aplikasi → tersimpan di `data/config.json` |
| Port server | Environment variable `PORT` (default `8787`) |
| Model & effort Raka | Konstanta `MODEL` di `server/agent.mjs` |
| Aturan & cara kerja Raka (system prompt) | Fungsi `systemPrompt()` di `server/agent.mjs` |
| Format lead yang dikembalikan | `LEAD_SCHEMA` di `server/agent.mjs` |

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Layar "Menghubungkan ke server…" terus | Server belum jalan. Jalankan `npm run dev`, lalu cek port 8787 tidak dipakai program lain. |
| Halaman `:8787` bilang "Belum di-build" | Jalankan `npm run build` dulu, atau pakai `npm run dev` lalu buka `:5173`. |
| Kantor 3D kosong / model hilang | Aset belum diunduh. Jalankan `npm run assets`. |
| Kerja gagal: "Tidak bisa menjalankan claude" | Claude Code CLI belum terpasang atau tidak ada di `PATH`. |
| Kerja gagal karena login | Jalankan `claude` di terminal dan login ulang. |
| Laporan bilang pindah ke web search | Chrome tidak tersambung. Cek ekstensi Claude in Chrome sudah login dan Chrome terbuka. |
| "Terhenti: login / CAPTCHA" | Threads minta verifikasi. Buka Threads di Chrome, selesaikan manual, lalu jalankan lagi. |
| Meter kuota menampilkan "—" | Token login Claude Code di `~/.claude/.credentials.json` tidak terbaca. Angka akan terisi dari kerja berikutnya. |
| Lead sedikit | Wajar kalau pembelinya memang sedikit: Raka sengaja tidak mengisi daftar dengan penjual. Perjelas brief dan tambah keyword. |

## Keamanan & privasi

- **`data/` berisi data asli**: lead (nama & username orang di Threads) dan riwayat kerja. Folder ini di-gitignore. Jangan dibagikan atau di-commit sembarangan.
- **Token Claude** hanya dibaca dari `~/.claude/.credentials.json` ke memori, hanya dikirim ke `api.anthropic.com`, dan tidak pernah disimpan atau dicatat di log.
- **Akses Raka dibatasi** (lihat `runLeadHunt()` di `server/agent.mjs`): hanya web search/fetch dan tool baca browser. Tidak ada shell, akses file, atau connector lain (Gmail, Drive, dll.). Tool browser untuk mengetik/upload diblokir.
- **Server hanya mendengarkan `127.0.0.1`.** Panel ini bisa menyuruh Raka bekerja, jadi jangan dibuka ke internet tanpa login.
- Kuota Claude dipakai bersama semua pemakaian di akun yang sama, termasuk Claude Code yang dipakai manual.

## Pindah ke VPS

- Install Node + Claude Code di VPS, lalu login sekali (`claude`). Alternatifnya, jalankan `claude setup-token` di laptop, lalu set `CLAUDE_CODE_OAUTH_TOKEN` di VPS.
- Mode Chrome butuh browser yang login Threads di mesin yang sama. Di VPS, pakai mode **Web search saja** atau siapkan Chrome dengan ekstensi.
- Untuk akses dari luar, pakai Tailscale atau reverse proxy **dengan login**.
- Jalankan dengan process manager (mis. `pm2` atau systemd) supaya jadwal otomatis tetap jalan setelah reboot.

## Kredit aset

Semua aset 3D berlisensi **CC0**:

- Furnitur, tekstur, dan HDRI: [Poly Haven](https://polyhaven.com)
- Karakter "Man in Suit": [Quaternius](https://quaternius.com), via Poly Pizza
