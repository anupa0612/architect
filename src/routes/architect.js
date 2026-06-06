const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware');
const { log } = require('../activity');

const router = express.Router();
router.use(requireRole('architect'));

// Dashboard stats for the logged-in architect.
router.get('/stats', (req, res) => {
  const u = req.session.user;
  const openRequests = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status='open'`).get().n;
  const sent = db.prepare(`SELECT COUNT(*) AS n FROM proposals WHERE architect_id=?`).get(u.id).n;
  const accepted = db.prepare(`SELECT COUNT(*) AS n FROM proposals WHERE architect_id=? AND status='accepted'`).get(u.id).n;
  const hireRate = sent ? Math.round((accepted / sent) * 100) : 0;
  res.json({ openRequests, sent, accepted, hireRate });
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
