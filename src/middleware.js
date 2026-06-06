// Auth/role guards for API routes and protected pages.

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login.html');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    }
    next();
  };
}

// Page guard: redirects to login or to the role's own dashboard.
function pageGuard(role) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.redirect('/login.html');
    if (user.role !== role) return res.redirect(`/${user.role}.html`);
    next();
  };
}

module.exports = { requireAuth, requireRole, pageGuard };
