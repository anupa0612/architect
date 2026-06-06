const db = require('./db');

const insertLog = db.prepare(
  `INSERT INTO activity_logs (user_id, role, action, detail, ip) VALUES (?, ?, ?, ?, ?)`
);

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
}

/** Explicitly record an action. */
function log(req, action, detail = '') {
  const user = req.session && req.session.user;
  try {
    insertLog.run(user ? user.id : null, user ? user.role : 'guest', action, detail, getIp(req));
  } catch (e) {
    console.error('activity log failed:', e.message);
  }
}

/**
 * Express middleware that auto-records meaningful page/API hits so the admin
 * can monitor full webpage actions.
 */
function tracker(req, res, next) {
  const url = req.originalUrl.split('?')[0];
  const isAsset = /\.(css|js|png|jpg|jpeg|svg|ico|woff2?|map)$/i.test(url);
  const isLogRead = url.startsWith('/api/admin'); // avoid logging the admin polling its own logs
  if (!isAsset && !isLogRead) {
    log(req, `${req.method} ${url}`, '');
  }
  next();
}

module.exports = { log, tracker };
