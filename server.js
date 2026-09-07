const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { neon } = require('@neondatabase/serverless');

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

if (!DATABASE_URL) console.warn('WARNING: DATABASE_URL is not set.');
if (!JWT_SECRET) console.warn('WARNING: JWT_SECRET is not set.');

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

app.use((req, res, next) => {
  if (CLIENT_ORIGIN !== '*') {
    res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function requireDb(res) {
  if (!sql) {
    res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    return false;
  }
  return true;
}
function cleanEmail(email) { return String(email || '').trim().toLowerCase(); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function signToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}
function auth(req, res, next) {
  try {
    if (!JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET belum dikonfigurasi.' });
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
function sanitizeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('State must be an object');
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith('gym_')) continue;
    const json = JSON.stringify(value);
    if (json.length > 1000000) throw new Error(`State item too large: ${key}`);
    out[key] = value;
  }
  return out;
}

async function initDb() {
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_states (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
}

app.get('/api/health', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const rows = await sql`SELECT NOW() AS now`;
    res.json({ ok: true, database: 'neon-postgresql', now: rows[0].now });
  } catch (e) {
    console.error(e);
    res.status(503).json({ ok: false, database: false, error: 'Neon database unavailable' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!validEmail(email)) return res.status(400).json({ error: 'Email tidak valid.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });
    const exists = await sql`SELECT id FROM users WHERE email=${email}`;
    if (exists.length) return res.status(409).json({ error: 'Email sudah terdaftar.' });
    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 12);
    await sql`INSERT INTO users(id,email,password_hash) VALUES(${id},${email},${hash})`;
    const user = { id, email };
    res.status(201).json({ token: signToken(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal membuat akun.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');
    const rows = await sql`SELECT id,email,password_hash FROM users WHERE email=${email}`;
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }
    const user = { id: rows[0].id, email: rows[0].email };
    res.json({ token: signToken(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal login.' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  if (!requireDb(res)) return;
  const rows = await sql`SELECT id,email,created_at FROM users WHERE id=${req.user.sub}`;
  if (!rows.length) return res.status(401).json({ error: 'User tidak ditemukan.' });
  res.json({ user: rows[0] });
});

app.get('/api/state', auth, async (req, res) => {
  if (!requireDb(res)) return;
  const rows = await sql`SELECT state_json,updated_at FROM app_states WHERE user_id=${req.user.sub}`;
  if (!rows.length) return res.json({ state: {}, updatedAt: null });
  res.json({ state: rows[0].state_json, updatedAt: rows[0].updated_at });
});

app.put('/api/state', auth, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const state = sanitizeState(req.body.state);
    await sql`
      INSERT INTO app_states(user_id,state_json,updated_at)
      VALUES(${req.user.sub},${JSON.stringify(state)}::jsonb,NOW())
      ON CONFLICT(user_id) DO UPDATE
      SET state_json=EXCLUDED.state_json, updated_at=NOW()
    `;
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'State tidak valid.' });
  }
});

app.delete('/api/state', auth, async (req, res) => {
  if (!requireDb(res)) return;
  await sql`DELETE FROM app_states WHERE user_id=${req.user.sub}`;
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'githubsoge.html'));
});

async function start() {
  await initDb();
  app.listen(PORT, () => console.log(`Get Your Goals running on port ${PORT} with Neon PostgreSQL`));
}

if (require.main === module) {
  start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
}

module.exports = app;
