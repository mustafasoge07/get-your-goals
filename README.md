# Get Your Goals — Vercel + Neon Multi-User

Versi ini menggunakan:
- Frontend: HTML/CSS/JavaScript (`githubsoge.html`)
- Backend: Node.js + Express
- Auth: JWT + bcryptjs
- Database: Neon Serverless PostgreSQL
- Hosting: Vercel

Alur:
Browser -> Vercel/Express -> Neon PostgreSQL

## Deploy paling mudah

### 1. Buat database Neon
Buat project PostgreSQL di Neon. Ambil connection string dari **Connect** lalu simpan sebagai `DATABASE_URL`.

Contoh:
`postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`

### 2. Upload project ke GitHub
Upload seluruh isi folder ini ke repository GitHub.

### 3. Import repository ke Vercel
Di Vercel: **Add New -> Project -> Import Git Repository**.
Pilih repository ini.

Set **Root Directory** ke `backend` jika ingin hanya folder backend yang menjadi project Vercel. Karena frontend sudah disalin ke `backend/public`, aplikasi tetap ikut ter-deploy.

### 4. Environment Variables
Tambahkan:
- `DATABASE_URL` = connection string Neon
- `JWT_SECRET` = secret random panjang
- `NODE_ENV` = `production`
- `CLIENT_ORIGIN` = `*` untuk setup awal

### 5. Deploy
Vercel akan menjalankan Node/Express. Neon menyediakan database PostgreSQL terpisah.

### 6. Tes
Buka:
`https://DOMAIN-VERCEL-KAMU/api/health`

Harus mendapatkan JSON dengan `ok: true` dan `database: "neon-postgresql"`.

## Lokal

Masuk ke folder `backend`:

`npm install`

Buat `.env` dari `.env.example`, isi `DATABASE_URL` Neon dan `JWT_SECRET`, lalu:

`npm start`

Buka `http://localhost:3000`.

## Catatan keamanan
- Jangan masukkan `DATABASE_URL` atau `JWT_SECRET` ke GitHub.
- Password user tidak disimpan dalam bentuk plaintext; yang disimpan adalah hash bcrypt.
- Data aplikasi dibatasi ke key `gym_*`.
- Token login berlaku 30 hari.
- Untuk produksi besar, tambahkan rate limiting, email verification, reset password, audit log, dan migrasi schema formal.
