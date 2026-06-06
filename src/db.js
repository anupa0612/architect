const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    password     TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('admin','customer','architect')),
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_login   TEXT
  );

  CREATE TABLE IF NOT EXISTS architect_profiles (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    studio       TEXT,
    title        TEXT,
    specialty    TEXT,
    location     TEXT,
    experience   TEXT,
    bio          TEXT,
    rating       REAL DEFAULT 0,
    projects     INTEGER DEFAULT 0,
    price        TEXT,
    badge        TEXT,
    img          TEXT,
    tags         TEXT,      -- JSON array
    packages     TEXT       -- JSON array
  );

  CREATE TABLE IF NOT EXISTS projects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    type         TEXT,
    location     TEXT,
    description  TEXT,
    size         TEXT,
    timeline     TEXT,
    budget       TEXT,
    style        TEXT,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','hired','closed')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    architect_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_name TEXT,
    message      TEXT,
    timeline     TEXT,
    quote        TEXT,
    status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','declined')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER,
    role         TEXT,
    action       TEXT NOT NULL,
    detail       TEXT,
    ip           TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
