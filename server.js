const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const seed = require('./src/seed');
const { tracker } = require('./src/activity');
const { pageGuard } = require('./src/middleware');

const authRoutes = require('./src/routes/auth');
const publicRoutes = require('./src/routes/public');
const customerRoutes = require('./src/routes/customer');
const architectRoutes = require('./src/routes/architect');
const adminRoutes = require('./src/routes/admin');
const orderRoutes = require('./src/routes/orders');

seed(); // ensure demo data exists on first run

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: __dirname }),
  secret: process.env.SESSION_SECRET || 'archhire-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true, sameSite: 'lax' }
}));

// Make the session user available to all responses + activity tracking.
app.use(tracker);

// --- API ---
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/architect', architectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);

// --- Role-protected pages (must come before the static handler) ---
app.get('/admin.html', pageGuard('admin'), (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/customer.html', pageGuard('customer'), (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'customer.html')));
app.get('/architect.html', pageGuard('architect'), (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'architect.html')));

// --- Static assets / public pages ---
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => {
  console.log(`\nArchHire platform running at http://localhost:${PORT}`);
  console.log('Demo logins:');
  console.log('  Admin     -> admin@archhire.test / admin123');
  console.log('  Customer  -> customer@archhire.test / cust123');
  console.log('  Architect -> nadia@archhire.test / arch123\n');
});
