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
