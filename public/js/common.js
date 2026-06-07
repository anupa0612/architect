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

function money(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US');
}

function starHtml(rating, count) {
  const r = Math.round(Number(rating) || 0);
  const stars = '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
  return `<span class="stars">${stars}${count != null ? ` <span class="count">(${count})</span>` : (rating ? ` <span class="count">${Number(rating).toFixed(1)}</span>` : '')}</span>`;
}

// Shared order message thread modal (used by customer + architect dashboards).
function ensureMsgModal() {
  let m = document.getElementById('msg-modal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'msg-modal';
  m.className = 'modal-overlay';
  m.innerHTML = `<div class="modal"><div class="modal-pad" id="msg-modal-body"></div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target.id === 'msg-modal') m.classList.remove('open'); });
  return m;
}

async function openMessages(orderId) {
  const me = await getCurrentUser();
  const modal = ensureMsgModal();
  const body = document.getElementById('msg-modal-body');
  async function paint() {
    const { order, messages } = await api(`/api/orders/${orderId}/messages`);
    const other = me.id === order.customer_id ? order.architect_name : order.customer_name;
    body.innerHTML = `
      <div class="modal-head">
        <div>
          <h3>Order #${order.id}</h3>
          <div class="muted" style="font-size:0.8rem">${escapeHtml(order.title || '')} · with ${escapeHtml(other)}</div>
        </div>
        <button class="modal-x" onclick="document.getElementById('msg-modal').classList.remove('open')">✕</button>
      </div>
      <div class="thread" id="thread">${
        messages.length ? messages.map(m => `
          <div class="msg ${m.sender_id === me.id ? 'me' : 'them'}">
            ${escapeHtml(m.body)}
            <div class="meta">${escapeHtml(m.sender_name)} · ${timeAgo(m.created_at)}</div>
          </div>`).join('') : '<p class="muted" style="text-align:center;padding:1rem">No messages yet. Say hello!</p>'
      }</div>
      <form class="msg-form" id="msg-form">
        <input id="msg-input" placeholder="Type a message..." autocomplete="off" required>
        <button class="btn-primary" type="submit">Send</button>
      </form>`;
    const thread = document.getElementById('thread');
    thread.scrollTop = thread.scrollHeight;
    document.getElementById('msg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('msg-input');
      const val = input.value.trim();
      if (!val) return;
      try { await api(`/api/orders/${orderId}/messages`, { method: 'POST', body: { body: val } }); input.value = ''; await paint(); }
      catch (err) { toast(err.message, true); }
    });
  }
  await paint();
  modal.classList.add('open');
}

function closeMobileNav() {
  document.querySelectorAll('.nav-links').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.nav-backdrop').forEach(el => el.classList.remove('open'));
  document.body.style.overflow = '';
}

function toggleMobileNav() {
  const links = document.querySelector('.nav-links');
  const backdrop = document.querySelector('.nav-backdrop');
  if (!links) return;
  const open = !links.classList.contains('open');
  links.classList.toggle('open', open);
  if (backdrop) backdrop.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

// Renders the top nav based on auth state.
async function renderNav() {
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
      <li><a href="/login.html" class="nav-login">Log in</a></li>
      <li><a href="/register.html" class="nav-cta">Sign up</a></li>`;
  }
  nav.innerHTML = `
    <a href="/" class="nav-logo">Arch<span>Hire</span></a>
    <button type="button" class="nav-toggle" aria-label="Open menu" onclick="toggleMobileNav()">☰</button>
    <ul class="nav-links">
      <li><a href="/#services" onclick="closeMobileNav()">Hire architects</a></li>
      <li><a href="/register.html" onclick="closeMobileNav()">Find work</a></li>
      <li><a href="/#how" onclick="closeMobileNav()">How it works</a></li>
      ${right}
    </ul>`;
  let backdrop = document.querySelector('.nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.onclick = closeMobileNav;
    nav.parentNode.insertBefore(backdrop, nav.nextSibling);
  }
  return user;
}

function renderFooter() {
  if (document.getElementById('site-footer')) return;
  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="footer-inner">
      <a href="/" class="nav-logo">Arch<span>Hire</span></a>
      <p class="footer-tagline">The marketplace for architecture</p>
      <p class="footer-credit">Developed by <strong>Anupa Wimalasiri</strong></p>
    </div>`;
  document.body.appendChild(footer);
}

document.addEventListener('DOMContentLoaded', renderFooter);
