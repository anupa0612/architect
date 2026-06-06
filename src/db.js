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

  -- Fiverr-style service listings ("gigs") published by architects.
  CREATE TABLE IF NOT EXISTS services (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    architect_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    category     TEXT,
    description  TEXT,
    image        TEXT,
    tags         TEXT,      -- JSON array
    packages     TEXT,      -- JSON array [{tier,name,price,delivery_days,revisions,features[]}]
    rating       REAL DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Orders placed against a service package (or a custom offer).
  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id   INTEGER REFERENCES services(id) ON DELETE SET NULL,
    customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    architect_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT,
    package_tier TEXT,
    package_name TEXT,
    price        REAL DEFAULT 0,
    delivery_days INTEGER DEFAULT 0,
    requirements TEXT,
    delivery_note TEXT,
    status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','delivered','completed','cancelled')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    delivered_at TEXT,
    completed_at TEXT
  );

  -- Messages exchanged on an order thread.
  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Reviews left by clients after an order completes.
  CREATE TABLE IF NOT EXISTS reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    service_id   INTEGER REFERENCES services(id) ON DELETE SET NULL,
    customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    architect_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating       INTEGER NOT NULL,
    comment      TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
