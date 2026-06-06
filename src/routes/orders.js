const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware');
const { log } = require('../activity');

const router = express.Router();
router.use(requireAuth);

// Load an order the current user is allowed to see (its customer, its architect, or an admin).
function loadOrder(req, res, next) {
  const u = req.session.user;
  const o = db.prepare(`
    SELECT o.*, uc.name AS customer_name, ua.name AS architect_name,
           apc.img AS customer_img, apa.img AS architect_img
    FROM orders o
    JOIN users uc ON uc.id = o.customer_id
    JOIN users ua ON ua.id = o.architect_id
    LEFT JOIN architect_profiles apc ON apc.user_id = o.customer_id
    LEFT JOIN architect_profiles apa ON apa.user_id = o.architect_id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const isParticipant = u.id === o.customer_id || u.id === o.architect_id || u.role === 'admin';
  if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
  req.order = o;
  next();
}

router.get('/:id', loadOrder, (req, res) => {
  res.json({ order: req.order });
});

router.get('/:id/messages', loadOrder, (req, res) => {
  const msgs = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.order_id = ? ORDER BY m.created_at ASC
  `).all(req.order.id);
  res.json({ order: req.order, messages: msgs });
});

router.post('/:id/messages', loadOrder, (req, res) => {
  const u = req.session.user;
  if (u.role === 'admin') return res.status(403).json({ error: 'Admins cannot post in order threads.' });
  const body = (req.body && req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
  const info = db.prepare('INSERT INTO messages (order_id, sender_id, body) VALUES (?,?,?)').run(req.order.id, u.id, body);
  log(req, 'message_sent', `Order #${req.order.id}`);
  res.json({ id: info.lastInsertRowid });
});

module.exports = router;
