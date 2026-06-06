# ArchHire — Architect Hiring Platform

A web-based, multi-page platform that connects clients with architects. It has a real
backend (Node + Express + SQLite), session-based authentication, and three role-based
logins: **Admin**, **Customer**, and **Architect**.

## Features

### Admin (full monitoring & control)
- Live dashboard with platform-wide stats (users, projects, proposals, hires, daily actions)
- 7-day activity trend chart + live activity feed
- **Activity Monitor** — every page view and action across the site is logged (who, what, IP, when)
- User management — view all users, **suspend / activate / delete** accounts
- View & delete any project; view all proposals

### Customer (client)
- Post project briefs (type, budget, location, style, timeline)
- Track projects and the number of proposals received
- Review proposals from architects and **accept / decline** them

### Architect
- Browse all open project requests on the platform
- Send tailored proposals (package, quote, timeline, message)
- Track sent proposals and their status
- Edit a public studio profile (shown on the homepage)

## Tech Stack
- **Backend:** Node.js, Express, better-sqlite3, express-session, bcryptjs
- **Frontend:** Multi-page HTML/CSS/JS (no framework), luxury editorial design
- **Storage:** SQLite (`data.sqlite`), sessions in `sessions.sqlite`

## Getting Started

```bash
npm install
npm start
```

Then open http://localhost:3000

The database is auto-created and seeded on first run.

### Demo accounts
| Role      | Email                   | Password |
|-----------|-------------------------|----------|
| Admin     | admin@archhire.test     | admin123 |
| Customer  | customer@archhire.test  | cust123  |
| Architect | nadia@archhire.test     | arch123  |

(All seeded architects use `arch123`. New customers and architects can self-register
from the **Get Started** page; admin accounts cannot be self-registered.)

## Project Structure
```
server.js              # Express app, session, route wiring, page guards
src/
  db.js                # SQLite schema
  seed.js              # Demo data
  activity.js          # Activity logger + auto-tracking middleware
  middleware.js        # Auth / role guards
  routes/
    auth.js            # register / login / logout / me
    public.js          # public architects + stats
    customer.js        # projects + proposal decisions
    architect.js       # requests, proposals, profile
    admin.js           # stats, users, projects, proposals, activity
public/
  index.html           # Home / browse architects
  login.html, register.html
  customer.html, architect.html, admin.html
  css/styles.css
  js/common.js
```

## Notes
- For production, set a strong `SESSION_SECRET` env var and serve over HTTPS.
- `data.sqlite` and `sessions.sqlite` are git-ignored.
