const express = require('express');
const db = require('../db');
const { parseService } = require('../marketplace');

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

// Service categories with counts.
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT s.category AS category, COUNT(*) AS n
    FROM services s JOIN users u ON u.id = s.architect_id
    WHERE s.active = 1 AND u.status = 'active' AND s.category <> ''
    GROUP BY s.category ORDER BY n DESC
  `).all();
  res.json({ categories: rows });
});

// Browse / search services (gigs).
router.get('/services', (req, res) => {
  const { search = '', category = '', sort = 'rating' } = req.query;
  const params = [];
  let where = `s.active = 1 AND u.status = 'active'`;
  if (category && category !== 'All') { where += ` AND s.category = ?`; params.push(category); }
  if (search) {
    where += ` AND (s.title LIKE ? OR s.description LIKE ? OR s.tags LIKE ? OR u.name LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const order = sort === 'orders' ? 's.orders_count DESC' : sort === 'newest' ? 's.created_at DESC' : 's.rating DESC, s.reviews_count DESC';
  const rows = db.prepare(`
    SELECT s.*, u.name AS architect_name, ap.img AS architect_img, ap.location, ap.badge
    FROM services s
    JOIN users u ON u.id = s.architect_id
    LEFT JOIN architect_profiles ap ON ap.user_id = s.architect_id
    WHERE ${where}
    ORDER BY ${order}
  `).all(...params);
  res.json({ services: rows.map(parseService) });
});

// Single service detail with architect info + reviews.
router.get('/services/:id', (req, res) => {
  const s = db.prepare(`
    SELECT s.*, u.name AS architect_name, ap.img AS architect_img, ap.location,
           ap.bio AS architect_bio, ap.experience, ap.studio, ap.badge
    FROM services s
    JOIN users u ON u.id = s.architect_id
    LEFT JOIN architect_profiles ap ON ap.user_id = s.architect_id
    WHERE s.id = ? AND s.active = 1 AND u.status = 'active'
  `).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  const reviews = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.name AS author
    FROM reviews r JOIN users u ON u.id = r.customer_id
    WHERE r.service_id = ? ORDER BY r.created_at DESC LIMIT 20
  `).all(req.params.id);
  res.json({ service: parseService(s), reviews });
});

// Public platform stats for the homepage.
router.get('/stats', (req, res) => {
  const architects = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='architect' AND status='active'`).get().n;
  const services = db.prepare(`SELECT COUNT(*) AS n FROM services WHERE active=1`).get().n;
  const projects = db.prepare(`SELECT COUNT(*) AS n FROM projects`).get().n;
  const orders = db.prepare(`SELECT COUNT(*) AS n FROM orders`).get().n;
  const countries = db.prepare(`SELECT COUNT(DISTINCT location) AS n FROM architect_profiles WHERE location <> ''`).get().n;
  res.json({ architects, services, projects, orders, countries });
});

module.exports = router;
