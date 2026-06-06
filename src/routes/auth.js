const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { log } = require('../activity');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
}

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

router.post('/register', (req, res) => {
  let { name, email, password, role, studio, specialty, location } = req.body || {};
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  role = role === 'architect' ? 'architect' : 'customer'; // admins are never self-registered

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`
  ).run(name, email, hash, role);

  if (role === 'architect') {
    db.prepare(
      `INSERT INTO architect_profiles (user_id, studio, title, specialty, location, bio, rating, projects, price, badge, img, tags, packages)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      info.lastInsertRowid,
      (studio || name).trim(),
      'Architect',
      (specialty || 'Residential').trim(),
      (location || '').trim(),
      'Tell clients about your studio and design philosophy.',
      0, 0, 'From $5,000', 'New',
      'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=500&q=80',
      JSON.stringify([specialty || 'Residential']),
      JSON.stringify([])
    );
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  req.session.user = publicUser(user);
  log(req, 'register', `${role} account created: ${email}`);
  res.json({ user: req.session.user });
});

router.post('/login', (req, res) => {
  let { email, password } = req.body || {};
  email = (email || '').trim().toLowerCase();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    log(req, 'login_failed', `Failed login for ${email}`);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.status === 'suspended') {
    log(req, 'login_blocked', `Suspended account tried to log in: ${email}`);
    return res.status(403).json({ error: 'This account has been suspended. Contact the administrator.' });
  }

  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
  req.session.user = publicUser(user);
  log(req, 'login', `${user.role} logged in: ${email}`);
  res.json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  log(req, 'logout', '');
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
