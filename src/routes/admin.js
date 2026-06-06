const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware');
const { log } = require('../activity');

const router = express.Router();
router.use(requireRole('admin'));

// Aggregate platform statistics.
router.get('/stats', (req, res) => {
  const byRole = db.prepare(`SELECT role, COUNT(*) AS n FROM users GROUP BY role`).all();
  const roleMap = { admin: 0, customer: 0, architect: 0 };
  byRole.forEach(r => { roleMap[r.role] = r.n; });

  const stats = {
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    admins: roleMap.admin,
    customers: roleMap.customer,
    architects: roleMap.architect,
    suspended: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE status='suspended'`).get().n,
    projects: db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,
    openProjects: db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status='open'`).get().n,
    hiredProjects: db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status='hired'`).get().n,
    proposals: db.prepare('SELECT COUNT(*) AS n FROM proposals').get().n,
    acceptedProposals: db.prepare(`SELECT COUNT(*) AS n FROM proposals WHERE status='accepted'`).get().n,
    services: db.prepare('SELECT COUNT(*) AS n FROM services').get().n,
    orders: db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
    activeOrders: db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('active','delivered')`).get().n,
    completedOrders: db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE status='completed'`).get().n,
    revenue: db.prepare(`SELECT COALESCE(SUM(price),0) AS s FROM orders WHERE status='completed'`).get().s,
    gmv: db.prepare(`SELECT COALESCE(SUM(price),0) AS s FROM orders WHERE status IN ('active','delivered','completed')`).get().s,
    reviews: db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n,
    avgRating: Math.round((db.prepare('SELECT AVG(rating) AS a FROM reviews').get().a || 0) * 10) / 10,
    actionsToday: db.prepare(`SELECT COUNT(*) AS n FROM activity_logs WHERE date(created_at)=date('now')`).get().n,
    actionsTotal: db.prepare('SELECT COUNT(*) AS n FROM activity_logs').get().n
  };

  // Activity over the last 7 days.
  const trend = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS n
    FROM activity_logs
    WHERE created_at >= datetime('now','-6 days','start of day')
    GROUP BY day ORDER BY day
  `).all();

  res.json({ stats, trend });
});

// All users.
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, status, created_at, last_login
    FROM users ORDER BY created_at DESC
  `).all();
  res.json({ users });
});

// Suspend / activate a user.
router.post('/users/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Cannot change an admin account status.' });

  const status = req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  log(req, 'user_' + status, `${target.email} set to ${status}`);
  res.json({ ok: true, status });
});

// Delete a user.
router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Cannot delete an admin account.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  log(req, 'user_deleted', `${target.email} (${target.role})`);
  res.json({ ok: true });
});

// All projects.
router.get('/projects', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name AS customer_name, u.email AS customer_email,
      (SELECT COUNT(*) FROM proposals pr WHERE pr.project_id = p.id) AS proposal_count
    FROM projects p JOIN users u ON u.id = p.customer_id
    ORDER BY p.created_at DESC
  `).all();
  res.json({ projects });
});

router.delete('/projects/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  log(req, 'project_deleted', `${p.title} (#${id})`);
  res.json({ ok: true });
});

// All proposals.
router.get('/proposals', (req, res) => {
  const proposals = db.prepare(`
    SELECT pr.*, p.title AS project_title, ua.name AS architect_name
    FROM proposals pr
    JOIN projects p ON p.id = pr.project_id
    JOIN users ua ON ua.id = pr.architect_id
    ORDER BY pr.created_at DESC
  `).all();
  res.json({ proposals });
});

// All services (gigs).
router.get('/services', (req, res) => {
  const services = db.prepare(`
    SELECT s.id, s.title, s.category, s.rating, s.reviews_count, s.orders_count, s.active, s.created_at,
           u.name AS architect_name
    FROM services s JOIN users u ON u.id = s.architect_id
    ORDER BY s.created_at DESC
  `).all();
  res.json({ services });
});

router.delete('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  log(req, 'service_deleted', `${s.title} (#${id})`);
  res.json({ ok: true });
});

// All orders.
router.get('/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, uc.name AS customer_name, ua.name AS architect_name
    FROM orders o
    JOIN users uc ON uc.id = o.customer_id
    JOIN users ua ON ua.id = o.architect_id
    ORDER BY o.created_at DESC
  `).all();
  res.json({ orders });
});

// All reviews.
router.get('/reviews', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, uc.name AS customer_name, ua.name AS architect_name, s.title AS service_title
    FROM reviews r
    JOIN users uc ON uc.id = r.customer_id
    JOIN users ua ON ua.id = r.architect_id
    LEFT JOIN services s ON s.id = r.service_id
    ORDER BY r.created_at DESC
  `).all();
  res.json({ reviews });
});

// Activity log feed — monitor full webpage actions.
router.get('/activity', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = db.prepare(`
    SELECT a.*, u.name AS user_name, u.email AS user_email
    FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT ?
  `).all(limit);
  res.json({ logs });
});

router.post('/activity/clear', (req, res) => {
  db.prepare('DELETE FROM activity_logs').run();
  log(req, 'activity_cleared', 'Admin cleared the activity log');
  res.json({ ok: true });
});

module.exports = router;
