const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware');
const { log } = require('../activity');

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

module.exports = router;
