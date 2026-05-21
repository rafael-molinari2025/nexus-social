// ============================================================
//  NEXUS — Shared Utilities
// ============================================================

// ── Avatar helpers ──────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: '#FBEAF0', color: '#993556' },
  { bg: '#E6F1FB', color: '#185FA5' },
];

function getAvatarColor(uid = '') {
  const idx = uid.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function avatarHTML(user, size = 40) {
  const cl = getAvatarColor(user.uid || user.displayName || '');
  const cls = `avatar avatar-${size}`;
  if (user.photoURL) {
    return `<div class="${cls}" style="background:${cl.bg}"><img src="${user.photoURL}" alt="${user.displayName}"></div>`;
  }
  return `<div class="${cls}" style="background:${cl.bg};color:${cl.color}">${getInitials(user.displayName)}</div>`;
}

// ── Time formatting ──────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`;
  return date.toLocaleDateString('pt-BR');
}

// ── Toast notifications ──────────────────────────────────────
function showToast(msg, duration = 3000) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── Auth guard ────────────────────────────────────────────────
function requireAuth(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = '/pages/login.html';
    } else {
      callback(user);
    }
  });
}

// ── Redirect if already logged in ────────────────────────────
function redirectIfLoggedIn() {
  auth.onAuthStateChanged(user => {
    if (user) window.location.href = '/index.html';
  });
}

// ── Firestore helpers ─────────────────────────────────────────
async function getUserData(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? { uid, ...snap.data() } : null;
}

async function updateUserData(uid, data) {
  await db.collection('users').doc(uid).set(data, { merge: true });
}

// ── Topbar renderer ───────────────────────────────────────────
function renderTopbar(user, activePage = 'feed') {
  const nav = document.getElementById('topbar');
  if (!nav) return;
  const cl = getAvatarColor(user.uid);
  const av = user.photoURL
    ? `<img src="${user.photoURL}" alt="${user.displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="color:${cl.color}">${getInitials(user.displayName)}</span>`;

  nav.innerHTML = `
    <a href="/index.html" class="topbar-logo">nexus</a>
    <div class="topbar-search">
      <i class="ti ti-search" aria-hidden="true"></i>
      <input type="text" placeholder="Buscar pessoas, comunidades..." id="search-input">
    </div>
    <nav class="topbar-nav">
      <button class="topbar-nav-btn${activePage==='feed'?' active':''}" title="Início" onclick="location.href='/index.html'"><i class="ti ti-home" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='friends'?' active':''}" title="Amigos" onclick="location.href='/pages/amigos.html'"><i class="ti ti-users" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='communities'?' active':''}" title="Comunidades" onclick="location.href='/pages/comunidades.html'"><i class="ti ti-users-group" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='scraps'?' active':''}" title="Recados" onclick="location.href='/pages/recados.html'"><i class="ti ti-message-circle" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn" title="Notificações" id="notif-btn"><i class="ti ti-bell" aria-hidden="true"></i></button>
    </nav>
    <div class="avatar avatar-32" style="background:${cl.bg};margin-left:.5rem" onclick="location.href='/pages/perfil.html?uid=${user.uid}'">${av}</div>
  `;

  const si = document.getElementById('search-input');
  if (si) {
    si.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = si.value.trim();
        if (q) location.href = `/pages/busca.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
}

// ── Sanitize text (basic XSS prevention) ─────────────────────
function sanitize(str = '') {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
