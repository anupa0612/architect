const express = require('express');
const db = require('../db');

const router = express.Router();

function mapArchitect(row) {
  return {
    id: row.user_id,
    name: row.name,
    studio: row.studio,
    title: row.title,
    specialty: row.specialty,
    location: row.location,
    experience: row.experience,
    bio: row.bio,
    rating: row.rating,
    projects: row.projects,
    price: row.price,
    badge: row.badge,
    img: row.img,
    tags: JSON.parse(row.tags || '[]'),
    packages: JSON.parse(row.packages || '[]')
  };
}

// Public list of architects (active accounts only).
router.get('/architects', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id AS user_id, u.name, u.status, p.*
    FROM architect_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE u.status = 'active'
    ORDER BY p.rating DESC, p.projects DESC
  `).all();
  res.json({ architects: rows.map(mapArchitect) });
});

router.get('/architects/:id', (req, res) => {
  const row = db.prepare(`
    SELECT u.id AS user_id, u.name, u.status, p.*
    FROM architect_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE u.id = ? AND u.status = 'active'
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Architect not found' });
  res.json({ architect: mapArchitect(row) });
});

// Public platform stats for the homepage.
router.get('/stats', (req, res) => {
  const architects = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='architect' AND status='active'`).get().n;
  const projects = db.prepare(`SELECT COUNT(*) AS n FROM projects`).get().n;
  const countries = db.prepare(`SELECT COUNT(DISTINCT location) AS n FROM architect_profiles WHERE location <> ''`).get().n;
  res.json({ architects, projects, countries });
});

module.exports = router;
