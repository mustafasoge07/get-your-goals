const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT || 3000);
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'gym.sqlite');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_states (
    user_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
  );
`);

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '5mb' }));

function validClientId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function ensureUser(id) {
  db.prepare(`
    INSERT INTO app_users (id) VALUES (?)
    ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
  `).run(id);
}

function readState(id) {
  const row = db.prepare('SELECT state_json, updated_at FROM app_states WHERE user_id = ?').get(id);
  if (!row) return { state: {}, updatedAt: null };
  let state = {};
  try { state = JSON.parse(row.state_json); } catch (_) { state = {}; }
  return { state, updatedAt: row.updated_at };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'get-your-goals-backend', database: 'sqlite' });
});

app.get('/api/state/:clientId', (req, res) => {
  const { clientId } = req.params;
  if (!validClientId(clientId)) return res.status(400).json({ error: 'Invalid clientId' });
  ensureUser(clientId);
  const result = readState(clientId);
  res.json({ ok: true, clientId, ...result });
});

const saveState = db.transaction((clientId, state) => {
  ensureUser(clientId);
  const json = JSON.stringify(state ?? {});
  db.prepare(`
    INSERT INTO app_states (user_id, state_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(clientId, json);
});

app.put('/api/state/:clientId', (req, res) => {
  const { clientId } = req.params;
  if (!validClientId(clientId)) return res.status(400).json({ error: 'Invalid clientId' });
  if (!req.body || typeof req.body.state !== 'object' || Array.isArray(req.body.state)) {
    return res.status(400).json({ error: 'state must be a JSON object' });
  }
  const keys = Object.keys(req.body.state);
  if (keys.some(k => !k.startsWith('gym_'))) {
    return res.status(400).json({ error: 'Only gym_* state keys are allowed' });
  }
  try {
    saveState(clientId, req.body.state);
    const result = readState(clientId);
    res.json({ ok: true, clientId, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

app.delete('/api/state/:clientId', (req, res) => {
  const { clientId } = req.params;
  if (!validClientId(clientId)) return res.status(400).json({ error: 'Invalid clientId' });
  db.prepare('DELETE FROM app_states WHERE user_id = ?').run(clientId);
  db.prepare('DELETE FROM app_users WHERE id = ?').run(clientId);
  res.json({ ok: true });
});

// Endpoint khusus untuk debugging/admin lokal: daftar ringkas user yang pernah tersimpan.
app.get('/api/admin/users', (_req, res) => {
  const rows = db.prepare('SELECT id, created_at, updated_at FROM app_users ORDER BY updated_at DESC').all();
  res.json({ ok: true, users: rows });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Get Your Goals backend running on http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_FILE}`);
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
