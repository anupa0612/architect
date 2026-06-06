const db = require('./db');

// Recompute a service's rating + an architect's overall rating from reviews.
function recomputeRatings(serviceId, architectId) {
  if (serviceId) {
    const s = db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE service_id = ?').get(serviceId);
    db.prepare('UPDATE services SET rating = ?, reviews_count = ? WHERE id = ?')
      .run(Math.round((s.avg || 0) * 10) / 10, s.n || 0, serviceId);
  }
  if (architectId) {
    const a = db.prepare('SELECT AVG(rating) AS avg FROM reviews WHERE architect_id = ?').get(architectId);
    if (a.avg != null) {
      db.prepare('UPDATE architect_profiles SET rating = ? WHERE user_id = ?')
        .run(Math.round(a.avg * 10) / 10, architectId);
    }
  }
}

function parseService(row) {
  if (!row) return row;
  row.tags = JSON.parse(row.tags || '[]');
  row.packages = JSON.parse(row.packages || '[]');
  return row;
}

module.exports = { recomputeRatings, parseService };
