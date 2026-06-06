// Shared helpers for the ArchHire front-end.

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function getCurrentUser() {
  try {
    const { user } = await api('/api/auth/me');
    return user;
  } catch (_) {
    return null;
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  location.href = '/';
}

function dashboardFor(role) {
  return role === 'admin' ? '/admin.html'
    : role === 'architect' ? '/architect.html'
    : '/customer.html';
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

let _toastTimer;
function toast(msg, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// Renders the top nav based on auth state. Pass {active} to highlight.
async function renderNav(opts = {}) {
  const nav = document.getElementById('nav');
  if (!nav) return null;
  const user = await getCurrentUser();
  let right;
  if (user) {
    right = `
      <li><a href="${dashboardFor(user.role)}">Dashboard</a></li>
      <li class="nav-user"><span class="nav-pill">${escapeHtml(user.role)}</span> ${escapeHtml(user.name)}</li>
      <li><a href="#" onclick="logout();return false" class="nav-cta">Log Out</a></li>`;
  } else {
    right = `
      <li><a href="/login.html">Log In</a></li>
      <li><a href="/register.html" class="nav-cta">Get Started</a></li>`;
  }
  nav.innerHTML = `
    <a href="/" class="nav-logo">Arch<span>Hire</span></a>
    <ul class="nav-links">
      <li><a href="/#architects">Find Architects</a></li>
      <li><a href="/#how">How It Works</a></li>
      ${right}
    </ul>`;
  return user;
}
