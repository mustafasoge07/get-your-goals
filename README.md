# Get Your Goals — Backend

Backend ini menyediakan REST API + SQLite untuk menyimpan data aplikasi fitness dari `githubsoge.html`.

## Metode
- Node.js + Express: server/API.
- SQLite + better-sqlite3: database lokal ringan.
- REST API: frontend mengirim state JSON ke `/api/state/:clientId`.
- Client ID: dibuat otomatis di browser dan menjadi identitas data perangkat/browser.
- Offline fallback: aplikasi tetap memakai localStorage jika backend mati.

## Data yang disimpan
Semua key aplikasi yang diawali `gym_`, misalnya:
- `gym_bio_v7` — profil/target pengguna.
- `gym_daily_logs_v9` — checklist air, makan, tidur, status latihan.
- `gym_weekly_logs_v8` — evaluasi berat badan dan catatan.
- `gym_workout_logs_v9` — riwayat latihan.
- `gym_custom_sched_v7` — jadwal custom.
- `gym_custom_progs_v7` — paket custom.
- `gym_active_workout_v11` — sesi workout yang sedang berlangsung.

Struktur data aplikasi lama tidak dipaksa menjadi tabel-tabel baru, sehingga perubahan versi frontend lebih aman. SQLite menyimpan satu JSON state per client.

## Menjalankan
Pastikan Node.js 18+ terpasang.

```bash
cd backend
npm install
npm start
```

Server berjalan di `http://localhost:3000`.

Jika HTML dibuka langsung sebagai file, bridge otomatis menggunakan `http://localhost:3000`.
Jika HTML di-host pada server yang sama, bridge menggunakan `/api`.

## Konfigurasi
Jika frontend dan backend berada di host berbeda, sebelum script aplikasi dijalankan dapat ditambahkan:

```html
<script>window.GYM_BACKEND_URL = 'https://domain-anda.com/api';</script>
```

## Catatan produksi
Versi ini sengaja sederhana dan cocok untuk tahap pengembangan/local hosting. Untuk aplikasi publik multi-user, tambahkan autentikasi (misalnya JWT/Supabase Auth), otorisasi, rate limiting, HTTPS, backup database, dan validasi schema yang lebih ketat.
