const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware');
const { log } = require('../activity');
const { recomputeRatings } = require('../marketplace');

const router = express.Router();
router.use(requireRole('customer'));

// Create a project brief.
router.post('/projects', (req, res) => {
  const u = req.session.user;
  let { title, type, location, description, size, timeline, budget, style } = req.body || {};
  title = (title || '').trim();
  if (!title) return res.status(400).json({ error: 'Project title is required.' });

  const info = db.prepare(`
    INSERT INTO projects (customer_id, title, type, location, description, size, timeline, budget, style, status)
    VALUES (?,?,?,?,?,?,?,?,?, 'open')
  `).run(u.id, title, type || '', location || '', description || '', size || '', timeline || '', budget || '', style || '');

  log(req, 'project_created', `${title} (#${info.lastInsertRowid})`);
  res.json({ id: info.lastInsertRowid });
});

// List my projects with proposal counts.
router.get('/projects', (req, res) => {
  const u = req.session.user;
  const projects = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) AS proposal_count
    FROM projects p WHERE p.customer_id = ?
    ORDER BY p.created_at DESC
  `).all(u.id);
  res.json({ projects });
});

// Proposals received for one of my projects.
router.get('/projects/:id/proposals', (req, res) => {
  const u = req.session.user;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND customer_id = ?').get(req.params.id, u.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const proposals = db.prepare(`
    SELECT pr.*, ua.name AS architect_name, ap.studio, ap.location, ap.img, ap.rating
    FROM proposals pr
    JOIN users ua ON ua.id = pr.architect_id
    LEFT JOIN architect_profiles ap ON ap.user_id = pr.architect_id
    WHERE pr.project_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.params.id);
  res.json({ project, proposals });
});

// Accept or decline a proposal.
router.post('/proposals/:id/:decision', (req, res) => {
  const u = req.session.user;
  const decision = req.params.decision;
  if (!['accept', 'decline'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }
  const prop = db.prepare(`
    SELECT pr.*, p.customer_id, p.id AS pid FROM proposals pr
    JOIN projects p ON p.id = pr.project_id
    WHERE pr.id = ?
  `).get(req.params.id);
  if (!prop || prop.customer_id !== u.id) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  const status = decision === 'accept' ? 'accepted' : 'declined';
  db.prepare('UPDATE proposals SET status = ? WHERE id = ?').run(status, prop.id);
  if (decision === 'accept') {
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('hired', prop.pid);
  }
  log(req, 'proposal_' + status, `Proposal #${prop.id} on project #${prop.pid}`);
  res.json({ ok: true, status });
});

// ===== ORDERS (Fiverr-style direct hiring) =====

// Place an order against a service package.
router.post('/orders', (req, res) => {
  const u = req.session.user;
  const { service_id, package_tier, requirements } = req.body || {};
  const svc = db.prepare(`
    SELECT s.*, u.status AS arch_status FROM services s JOIN users u ON u.id = s.architect_id
    WHERE s.id = ? AND s.active = 1
  `).get(service_id);
  if (!svc || svc.arch_status !== 'active') return res.status(404).json({ error: 'Service unavailable.' });

  const packages = JSON.parse(svc.packages || '[]');
  const pkg = packages.find(p => p.tier === package_tier) || packages[0];
  if (!pkg) return res.status(400).json({ error: 'This service has no packages to order.' });

  const info = db.prepare(`
    INSERT INTO orders (service_id, customer_id, architect_id, title, package_tier, package_name, price, delivery_days, requirements, status)
    VALUES (?,?,?,?,?,?,?,?,?, 'active')
  `).run(svc.id, u.id, svc.architect_id, svc.title, pkg.tier, pkg.name,
    Number(pkg.price) || 0, Number(pkg.delivery_days) || 0, requirements || '');

  db.prepare('UPDATE services SET orders_count = orders_count + 1 WHERE id = ?').run(svc.id);
  log(req, 'order_placed', `Order #${info.lastInsertRowid} · ${svc.title} (${pkg.tier})`);
  res.json({ id: info.lastInsertRowid });
});

router.get('/orders', (req, res) => {
  const u = req.session.user;
  const rows = db.prepare(`
    SELECT o.*, ua.name AS architect_name, ap.img AS architect_img,
      (SELECT COUNT(*) FROM messages m WHERE m.order_id = o.id) AS message_count,
      (SELECT COUNT(*) FROM reviews r WHERE r.order_id = o.id) AS reviewed
    FROM orders o
    JOIN users ua ON ua.id = o.architect_id
    LEFT JOIN architect_profiles ap ON ap.user_id = o.architect_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(u.id);
  res.json({ orders: rows });
});

// Mark a delivered order as complete.
router.post('/orders/:id/complete', (req, res) => {
  const u = req.session.user;
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, u.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.status !== 'delivered') return res.status(400).json({ error: 'Order must be delivered before completing.' });
  db.prepare(`UPDATE orders SET status='completed', completed_at=datetime('now') WHERE id=?`).run(o.id);
  log(req, 'order_completed', `Order #${o.id}`);
  res.json({ ok: true });
});

router.post('/orders/:id/cancel', (req, res) => {
  const u = req.session.user;
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, u.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (!['active', 'delivered'].includes(o.status)) return res.status(400).json({ error: 'Order cannot be cancelled.' });
  db.prepare(`UPDATE orders SET status='cancelled' WHERE id=?`).run(o.id);
  log(req, 'order_cancelled', `Order #${o.id}`);
  res.json({ ok: true });
});

// Leave a review on a completed order.
router.post('/orders/:id/review', (req, res) => {
  const u = req.session.user;
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, u.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.status !== 'completed') return res.status(400).json({ error: 'You can only review completed orders.' });
  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(o.id);
  if (existing) return res.status(409).json({ error: 'You already reviewed this order.' });

  const rating = Math.max(1, Math.min(5, parseInt(req.body && req.body.rating) || 5));
  const comment = (req.body && req.body.comment) || '';
  db.prepare(`INSERT INTO reviews (order_id, service_id, customer_id, architect_id, rating, comment) VALUES (?,?,?,?,?,?)`)
    .run(o.id, o.service_id, u.id, o.architect_id, rating, comment);
  recomputeRatings(o.service_id, o.architect_id);
  log(req, 'review_left', `Order #${o.id} · ${rating}★`);
  res.json({ ok: true });
});

module.exports = router;
