# Arsitektur — Perushaan AI

Dokumen teknis untuk developer yang melanjutkan project ini. Setup dan cara pakai ada di [`README.md`](../README.md).

## Gambaran besar

```
 Browser (React + Three.js)                 Server Node (:8787)                     Claude Code CLI
┌──────────────────────────┐   HTTP /api   ┌──────────────────────────┐   spawn    ┌────────────────────┐
│ Panel: Tugas, Aktivitas, │ ────────────▶ │ index.mjs                │ ─────────▶ │ claude -p          │
│ Leads, Pengaturan        │               │  - status karyawan       │            │  Sonnet 5.5        │
│ Scene 3D + layar live    │ ◀──────────── │  - jadwal otomatis       │ ◀───────── │  stream-json       │
└──────────────────────────┘  WebSocket /ws│  - simpan hasil (store)  │  stdout    │  ↓                 │
                                           └──────────────────────────┘            │ Chrome (Threads)   │
                                                  │  data/*.json                   │ atau web search    │
                                                  ▼                                └────────────────────┘
```

- **Satu proses server** tanpa framework (`node:http` + `ws`). Tidak ada database: semua state di file JSON `data/`.
- **Satu kerja = satu proses `claude -p`.** Setiap baris stream dari Claude Code diubah jadi item aktivitas dan langsung di-broadcast ke semua browser lewat WebSocket.
- **Frontend** hanya membaca state awal (`GET /api/state`), lalu menerima update dari WebSocket.

## Alur satu kerja

1. User klik **Mulai kerja** → `POST /api/run { instruction }`. Bisa juga dipicu oleh jadwal otomatis.
2. `startRun()` di `server/index.mjs`:
   - menolak (HTTP 409) kalau masih ada kerja yang berjalan, karena hanya boleh satu kerja sekaligus;
   - memuat config, membuat record run, dan mengirim daftar handle lead lama supaya tidak ditemukan ulang;
   - memanggil `runLeadHunt()` di `server/agent.mjs`.
3. `runLeadHunt()` menjalankan `claude -p` (lihat [Agent](#agent-serveragentmjs)). Setiap event stream:
   - `system/init` → aktivitas "Mulai kerja" (plus info Chrome tersambung atau tidak);
   - `assistant` text → aktivitas 💭; `tool_use` → aktivitas yang mudah dibaca (`describeTool()`);
   - `rate_limit_event` → update meter kuota;
   - `result` → output terstruktur (`structured_output`) sesuai `LEAD_SCHEMA`.
4. Selesai: lead baru digabung ke `data/leads.json` (duplikat dibuang), run disimpan, kuota di-refresh.
5. Status karyawan: `working` → `done` (tepuk tangan, 9 detik) atau `error` (20 detik) → kembali `idle`. Kalau dihentikan, status langsung `idle`.

Run dianggap `error` kalau Claude Code gagal, **atau** kalau selesai tanpa lead baru dan ada isi `blocked` (mis. CAPTCHA).

## Server

### `server/index.mjs`

| Bagian | Isi |
|---|---|
| `employee` | `{ status, since, activity, runId }`. Status: `idle` · `working` · `done` · `error`. |
| `startRun()` | Memulai satu kerja (lihat alur di atas). |
| Jadwal otomatis | `setInterval` 20 detik. Memicu kerja kalau jam lokal sama dengan salah satu `auto.times`. Slot terakhir disimpan di `data/schedule.json` supaya satu jam tidak terpicu dua kali. **Jadwal memakai brief di Pengaturan, bukan isi Tugas.** |
| Kuota | `refreshUsage()` saat start, tiap 2 menit, dan setelah setiap kerja. |
| Static | Menyajikan `dist/` (hasil `npm run build`). Path di luar `dist/` ditolak. |

Server hanya listen di `127.0.0.1`. Saat `SIGINT`/`SIGTERM`, kerja yang berjalan dihentikan dulu.

### HTTP API

| Method | Path | Body | Hasil |
|---|---|---|---|
| `GET` | `/api/state` | – | `{ employee, model, usage, config, leads, runs, activity }` |
| `POST` | `/api/run` | `{ instruction? }` | `{ run }`, atau `409 { error }` kalau sedang bekerja |
| `POST` | `/api/stop` | – | `{ ok: true }` |
| `PUT` | `/api/config` | sebagian/seluruh config | config lengkap (di-merge dangkal di level atas) |
| `PATCH` | `/api/leads/:id` | `{ status }` | `{ ok: true }` |
| `DELETE` | `/api/leads/:id` | – | `{ ok: true }` |
| `GET` | `/api/leads.csv` | – | File CSV semua lead |

> `PUT /api/config` me-merge di level atas saja. Kirim objek `brief` / `auto` / `employee` secara utuh, seperti yang dilakukan panel Pengaturan.

### WebSocket `/ws`

Server → browser, JSON `{ type, ... }`:

| `type` | Payload | Kapan |
|---|---|---|
| `employee` | `employee` | Status karyawan berubah |
| `activity` | `runId`, `item` | Setiap langkah Claude Code |
| `run` | `run` (tanpa activity, plus `steps`) | Kerja mulai / selesai |
| `leads` | `leads` (semua) | Lead bertambah, berubah, atau dihapus |
| `config` | `config` | Pengaturan disimpan |
| `usage` | `usage` | Kuota diperbarui |

Frontend (`src/useOffice.js`) otomatis reconnect tiap 1,5 detik dan memuat ulang `/api/state` setiap tersambung.

### `server/store.mjs` — data

Semua file ada di `data/` (relatif terhadap folder tempat server dijalankan). Folder dibuat otomatis. Penulisan memakai file `.tmp` lalu `rename`, supaya file tidak setengah tertulis kalau proses mati.

| File | Isi |
|---|---|
| `config.json` | Lihat `DEFAULT_CONFIG` di bawah. Belum ada sampai Pengaturan pertama kali disimpan. |
| `leads.json` | Array lead, terbaru di depan. |
| `runs.json` | 30 kerja terakhir, termasuk activity-nya. |
| `schedule.json` | `{ lastSlot }` untuk jadwal otomatis. |
| `workspace/` | Folder kerja (cwd) `claude -p`. Sengaja kosong supaya tidak ada `CLAUDE.md` project yang ikut terbaca. |

```js
// DEFAULT_CONFIG
{
  employee: { name: 'Raka', role: 'Lead Hunter' },
  brief: { offer: '', target: '', keywords: [], location: 'Indonesia', perRun: 10 },
  browser: true,                                  // true = Chrome, false = web search saja
  auto: { enabled: false, times: ['09:00', '15:00'] },
}
```

**Lead** (field dari agent + field dari server):

```js
{
  name, handle, profile_url, post_url, quote, need, why, score /* 1–5 */, location,  // dari agent
  id, status /* baru | dihubungi | tertarik | tidak cocok */, runId, foundAt,         // dari server
}
```

Duplikat ditentukan dari `profile_url` (fallback ke `handle`, lalu `name`), dinormalisasi tanpa `https://www.`, tanpa `@`, dan tanpa `/` di akhir.

### `server/usage.mjs` — kuota Claude

1. **Sumber utama:** `GET https://api.anthropic.com/api/oauth/usage` dengan token dari `~/.claude/.credentials.json`. Ini endpoint yang sama dengan `/usage` di Claude Code. Mendukung dua bentuk respons: `five_hour`/`seven_day` (Pro/Max) atau `limits[]` (Team/Enterprise).
2. **Cadangan:** `rate_limit_event` yang dikirim Claude Code selama kerja.

Endpoint ini tidak terdokumentasi resmi dan bisa berubah. Kalau gagal, angka terakhir tetap dipakai.

## Agent (`server/agent.mjs`)

### Perintah yang dijalankan

```
claude -p <taskPrompt>
  --output-format stream-json --verbose --no-session-persistence
  --model claude-sonnet-5-5 --effort medium
  --system-prompt <systemPrompt>
  --json-schema <LEAD_SCHEMA>
  --strict-mcp-config                 # tidak memuat connector lain milik user
  --tools WebSearch,WebFetch          # tool bawaan: hanya web, tanpa shell/file
  --allowedTools WebSearch,WebFetch[,tool baca Chrome]
  --chrome --disallowedTools <tool Chrome untuk menulis>   # mode Chrome
  --no-chrome                                              # mode web search
```

Environment: `ANTHROPIC_API_KEY` dihapus supaya pemakaian masuk ke subscription. `CLAUDECODE` dihapus supaya CLI tetap mau jalan walaupun server dijalankan dari dalam Claude Code.

Tool Chrome yang diizinkan: `navigate`, `read_page`, `get_page_text`, `find`, `computer`, `browser_batch`, serta tool tab/browser. Yang diblokir: `form_input`, `file_upload`, `upload_image`, `javascript_tool`, `shortcuts_execute`, `gif_creator`.

### System prompt (`systemPrompt()`)

Berisi, berurutan:

1. **Identitas & tugas:** cari orang di Threads yang **butuh** apa yang kita jual.
2. **Brief** dari Pengaturan (`offer`, `target`, `location`). Kalau kosong, Raka membaca dari isi Tugas.
3. **Aturan inti, cari yang BUTUH dan bukan yang MENAWARKAN:**
   - perintah "cari jasa X" = cari orang yang butuh X;
   - ciri pembeli ("cari", "butuh", "ada yang bisa…?", "rekomendasi", "spill vendor", tanya harga);
   - ciri penjual yang harus dibuang ("Jasa…", "open order", "harga mulai Rp…", "order via WA", "cek katalog di bio");
   - iklan yang pura-pura bertanya ("Butuh website? DM aja!");
   - bukan lead: freelancer cari klien, lowongan kerja, rekrut reseller, giveaway, tips, yang sudah dapat vendor;
   - balasan di postingan pembeli biasanya vendor, jadi di-skip kecuali dia juga bilang butuh;
   - bisnis yang menjual barang lain tetap lead, yang di-skip hanya kompetitor;
   - kalau ragu cek profil, kalau masih ragu jangan dimasukkan.
4. **Cara mencari:** keyword ditulis seperti pembeli ("cari jasa website", "ada yang bisa bikin website"), bukan nama jasa saja ("jasa website" hasilnya kebanyakan iklan).
5. **Aturan keamanan:** hanya membaca, berhenti di login/CAPTCHA, tidak boleh mengarang lead, tutup tab, tulis output dalam Bahasa Indonesia.

### Task prompt (`taskPrompt()`)

Isi Tugas dari user (atau default `Cari sekitar <perRun> lead baru di Threads.`), plus keyword awal dan daftar handle yang sudah pernah ditemukan (maks. 150).

### Output (`LEAD_SCHEMA`)

`{ summary, blocked, leads[] }`. Field wajib setiap lead: `name`, `profile_url`, `quote`, `need`, `why`, `score`. `quote` harus kata-kata orang itu sendiri yang menunjukkan dia sedang butuh.

## Frontend (`src/`)

| File | Tanggung jawab |
|---|---|
| `main.jsx` | Mount React. |
| `App.jsx` | Layout, jam, tombol view kamera, menyambungkan klik karakter → tab Aktivitas + view Layar. |
| `useOffice.js` | Satu-satunya tempat yang bicara dengan server: `state`, `connected`, `actions` (`run`, `stop`, `saveConfig`, `setLeadStatus`, `deleteLead`). |
| `ui/Panel.jsx` | Empat tab. Komponen: `EmployeeCard`, `Orders`, `Activity`, `Leads`, `Settings`. |
| `ui/UsageBadge.jsx` | Meter kuota (kuning ≥ 70%, merah ≥ 90%). |
| `styles.css` | Semua style. Flat, tanpa gradient. |

### Scene 3D (`src/scene/`)

| File | Isi |
|---|---|
| `layout.js` | Ukuran ruangan dan koordinat (meter): meja, titik tujuan (`desk`, `coffee`, `lounge`), jalur lorong. **Ubah posisi di sini.** |
| `Scene.jsx` | `<Canvas>`, 3 view kamera (`kantor`, `layar`, `istirahat`) lewat `CameraControls`, environment HDRI, post-processing (AO, bloom, vignette, tone mapping). |
| `Room.jsx` | Lantai kayu, dinding plester, jendela, karpet, cahaya. |
| `Furniture.jsx` | Model Poly Haven. Model baru harus ditambah juga ke `MODELS` di `scripts/fetch-assets.mjs`. |
| `Workstation.jsx` | Meja, kursi, dan monitor. Monitor meja Raka memakai canvas live. |
| `Employee.jsx` | Karakter (Quaternius, animasi `Idle`, `Walk`, `Sitting`, `Clapping`, …), state machine posisi berdasarkan status, plumbob, dan bubble aktivitas. |
| `screens.js` | Menggambar isi monitor Raka (langkah kerja live) dan TV dinding (statistik + 3 lead terbaru) di `<canvas>`. |

**Mode dev:** buka `http://localhost:5173/?pose=working` (atau `done` / `error`) untuk melihat pose tanpa menjalankan kerja. Karakter langsung teleport ke posisinya.

## Panduan perubahan umum

| Mau… | Ubah |
|---|---|
| Ganti model / effort | `MODEL` di `server/agent.mjs`. Effort lebih tinggi = kuota lebih cepat habis. |
| Ubah perilaku / kriteria Raka | `systemPrompt()` di `server/agent.mjs`. Kriteria per bisnis sebaiknya di **Pengaturan**, bukan di kode. |
| Tambah field lead | `LEAD_SCHEMA` (agent) → tampilkan di `Leads` (`Panel.jsx`) → tambah ke `cols` di `csv()` (`index.mjs`). |
| Tambah status lead | `LEAD_STATUS` di `Panel.jsx`. |
| Tambah endpoint | Router di `http.createServer` (`index.mjs`), lalu action di `useOffice.js`. |
| Tambah furnitur | `scripts/fetch-assets.mjs` (`MODELS`) → `npm run assets` → `<Model id=… />` di `Furniture.jsx`. |

## Keterbatasan yang diketahui

- Hanya **satu karyawan** dan **satu kerja sekaligus**. State karyawan ada di memori, jadi kerja yang berjalan hilang kalau server restart. Di mode dev, mengedit file server memicu restart.
- Belum ada autentikasi. Aman karena hanya listen di `127.0.0.1`.
- Belum ada test otomatis atau linter.
- Pencarian Threads sangat bergantung pada UI Threads. Kalau Threads mengubah tampilan atau URL pencarian, instruksi di `systemPrompt()` perlu disesuaikan.
- Endpoint kuota (`/api/oauth/usage`) tidak resmi dan bisa berubah sewaktu-waktu.
