const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware');
const { log } = require('../activity');
const { parseService } = require('../marketplace');

const router = express.Router();
router.use(requireRole('architect'));

// Dashboard stats for the logged-in architect.
router.get('/stats', (req, res) => {
  const u = req.session.user;
  const openRequests = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status='open'`).get().n;
  const sent = db.prepare(`SELECT COUNT(*) AS n FROM proposals WHERE architect_id=?`).get(u.id).n;
  const accepted = db.prepare(`SELECT COUNT(*) AS n FROM proposals WHERE architect_id=? AND status='accepted'`).get(u.id).n;
  const hireRate = sent ? Math.round((accepted / sent) * 100) : 0;
  const activeOrders = db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE architect_id=? AND status IN ('active','delivered')`).get(u.id).n;
  const earnings = db.prepare(`SELECT COALESCE(SUM(price),0) AS s FROM orders WHERE architect_id=? AND status='completed'`).get(u.id).s;
  const services = db.prepare(`SELECT COUNT(*) AS n FROM services WHERE architect_id=?`).get(u.id).n;
  res.json({ openRequests, sent, accepted, hireRate, activeOrders, earnings, services });
});

// ===== SERVICES (gigs) =====
router.get('/services', (req, res) => {
  const u = req.session.user;
  const rows = db.prepare('SELECT * FROM services WHERE architect_id = ? ORDER BY created_at DESC').all(u.id);
  res.json({ services: rows.map(parseService) });
});

router.post('/services', (req, res) => {
  const u = req.session.user;
  let { title, category, description, image, tags, packages } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Service title is required.' });
  const prof = db.prepare('SELECT img FROM architect_profiles WHERE user_id = ?').get(u.id);
  const info = db.prepare(`
    INSERT INTO services (architect_id, title, category, description, image, tags, packages)
    VALUES (?,?,?,?,?,?,?)
  `).run(u.id, title, category || 'Residential', description || '',
    image || (prof && prof.img) || '',
    JSON.stringify(Array.isArray(tags) ? tags : []),
    JSON.stringify(Array.isArray(packages) ? packages : []));
  log(req, 'service_created', `${title} (#${info.lastInsertRowid})`);
  res.json({ id: info.lastInsertRowid });
});

router.put('/services/:id', (req, res) => {
  const u = req.session.user;
  const svc = db.prepare('SELECT * FROM services WHERE id = ? AND architect_id = ?').get(req.params.id, u.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  let { title, category, description, image, tags, packages, active } = req.body || {};
  db.prepare(`
    UPDATE services SET title=?, category=?, description=?, image=?, tags=?, packages=?, active=? WHERE id=?
  `).run(
    title ?? svc.title, category ?? svc.category, description ?? svc.description,
    image ?? svc.image,
    JSON.stringify(Array.isArray(tags) ? tags : JSON.parse(svc.tags || '[]')),
    JSON.stringify(Array.isArray(packages) ? packages : JSON.parse(svc.packages || '[]')),
    active != null ? (active ? 1 : 0) : svc.active,
    svc.id
  );
  log(req, 'service_updated', `#${svc.id}`);
  res.json({ ok: true });
});

router.delete('/services/:id', (req, res) => {
  const u = req.session.user;
  const svc = db.prepare('SELECT * FROM services WHERE id = ? AND architect_id = ?').get(req.params.id, u.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  db.prepare('DELETE FROM services WHERE id = ?').run(svc.id);
  log(req, 'service_deleted', `#${svc.id}`);
  res.json({ ok: true });
});

// ===== ORDERS (as the seller) =====
router.get('/orders', (req, res) => {
  const u = req.session.user;
  const rows = db.prepare(`
    SELECT o.*, uc.name AS customer_name, s.title AS service_title,
      (SELECT COUNT(*) FROM messages m WHERE m.order_id = o.id) AS message_count
    FROM orders o
    JOIN users uc ON uc.id = o.customer_id
    LEFT JOIN services s ON s.id = o.service_id
    WHERE o.architect_id = ?
    ORDER BY o.created_at DESC
  `).all(u.id);
  res.json({ orders: rows });
});

router.post('/orders/:id/deliver', (req, res) => {
  const u = req.session.user;
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND architect_id = ?').get(req.params.id, u.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.status !== 'active') return res.status(400).json({ error: 'Only active orders can be delivered.' });
  db.prepare(`UPDATE orders SET status='delivered', delivery_note=?, delivered_at=datetime('now') WHERE id=?`)
    .run((req.body && req.body.note) || '', o.id);
  log(req, 'order_delivered', `Order #${o.id}`);
  res.json({ ok: true });
});

// All open project requests on the platform.
router.get('/requests', (req, res) => {
  const u = req.session.user;
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id AND pr.architect_id = ?) AS mine
    FROM projects p
    WHERE p.status IN ('open','in_review')
    ORDER BY p.created_at DESC
  `).all(u.id);
  res.json({ requests: rows });
});

// My sent proposals.
router.get('/proposals', (req, res) => {
  const u = req.session.user;
  const rows = db.prepare(`
    SELECT pr.*, p.title AS project_title, p.type AS project_type, p.budget AS project_budget
    FROM proposals pr JOIN projects p ON p.id = pr.project_id
    WHERE pr.architect_id = ?
    ORDER BY pr.created_at DESC
  `).all(u.id);
  res.json({ proposals: rows });
});

// Send a proposal to a project.
router.post('/proposals', (req, res) => {
  const u = req.session.user;
  let { project_id, package_name, message, timeline, quote } = req.body || {};
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const dup = db.prepare(`SELECT id FROM proposals WHERE project_id=? AND architect_id=?`).get(project_id, u.id);
  if (dup) return res.status(409).json({ error: 'You already sent a proposal for this project.' });

  const info = db.prepare(`
    INSERT INTO proposals (project_id, architect_id, package_name, message, timeline, quote)
    VALUES (?,?,?,?,?,?)
  `).run(project_id, u.id, package_name || '', message || '', timeline || '', quote || '');

  db.prepare(`UPDATE projects SET status='in_review' WHERE id=? AND status='open'`).run(project_id);
  log(req, 'proposal_sent', `Proposal #${info.lastInsertRowid} -> project "${project.title}"`);
  res.json({ id: info.lastInsertRowid });
});

// Get / update my profile.
router.get('/profile', (req, res) => {
  const u = req.session.user;
  const row = db.prepare('SELECT * FROM architect_profiles WHERE user_id = ?').get(u.id);
  if (!row) return res.status(404).json({ error: 'Profile not found' });
  row.tags = JSON.parse(row.tags || '[]');
  row.packages = JSON.parse(row.packages || '[]');
  res.json({ profile: row, name: u.name });
});

router.put('/profile', (req, res) => {
  const u = req.session.user;
  let { studio, title, specialty, location, experience, bio, price, tags, packages } = req.body || {};
  db.prepare(`
    UPDATE architect_profiles
    SET studio=?, title=?, specialty=?, location=?, experience=?, bio=?, price=?, tags=?, packages=?
    WHERE user_id=?
  `).run(
    studio || '', title || '', specialty || '', location || '', experience || '', bio || '', price || '',
    JSON.stringify(Array.isArray(tags) ? tags : []),
    JSON.stringify(Array.isArray(packages) ? packages : []),
    u.id
  );
  log(req, 'profile_updated', '');
  res.json({ ok: true });
});

module.exports = router;
