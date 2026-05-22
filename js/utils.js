// ============================================================
//  NEXUS — Shared Utilities  (js/utils.js)
// ============================================================

// ── Detectar prefixo de path para navegação ───────────────────
const _isInPages = location.pathname.includes('/pages/');
const ROOT = _isInPages ? '../' : './';
const PAGES = _isInPages ? '' : 'pages/';

// ── Avatar helpers ───────────────────────────────────────────
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
function showToast(msg, duration = 3500) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Theme (dark / light) ──────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('nexus-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nexus-theme', next);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.querySelector('i').className = next === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
}

// Inicializar tema imediatamente
initTheme();

// ── Auth guard ────────────────────────────────────────────────
function requireAuth(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      // Redirecionar para login (path relativo)
      const loginPath = _isInPages ? 'login.html' : 'pages/login.html';
      window.location.href = loginPath;
    } else {
      callback(user);
    }
  });
}

// ── Redirect if already logged in ────────────────────────────
function redirectIfLoggedIn() {
  auth.onAuthStateChanged(user => {
    if (user) {
      const profilePath = _isInPages
        ? `perfil.html?uid=${user.uid}`
        : `pages/perfil.html?uid=${user.uid}`;
      window.location.href = profilePath;
    }
  });
}

// ── Firestore helpers ─────────────────────────────────────────
async function getUserData(uid) {
  if (!uid) return null;
  try {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? { uid, ...snap.data() } : null;
  } catch (e) {
    return null;
  }
}

async function updateUserData(uid, data) {
  await db.collection('users').doc(uid).set(data, { merge: true });
}

// ── Notificações ──────────────────────────────────────────────
let _notifUnsub = null;

function initNotifications(uid) {
  if (_notifUnsub) _notifUnsub();
  _notifUnsub = db.collection('notifications').doc(uid)
    .collection('items')
    .where('read', '==', false)
    .onSnapshot(snap => {
      const count = snap.size;
      // Badge no topbar (desktop)
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = count > 0 ? 'block' : 'none';
      // Dot no bottom nav (mobile)
      const dot = document.getElementById('notif-dot');
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
    }, () => {});
}

async function createNotification(toUid, type, data) {
  try {
    await db.collection('notifications').doc(toUid).collection('items').add({
      type,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...data
    });
  } catch (e) { /* silencioso */ }
}

async function loadNotifications(uid) {
  const snap = await db.collection('notifications').doc(uid)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markAllNotificationsRead(uid) {
  const snap = await db.collection('notifications').doc(uid)
    .collection('items')
    .where('read', '==', false)
    .get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

function notifIcon(type) {
  const map = {
    friend_request: { icon: 'ti-user-plus', bg: '#EEEDFE', color: '#534AB7' },
    friend_accept:  { icon: 'ti-users',     bg: '#E1F5EE', color: '#0F6E56' },
    post_like:      { icon: 'ti-heart',     bg: '#FBEAF0', color: '#993556' },
    post_comment:   { icon: 'ti-message-circle', bg: '#FAEEDA', color: '#854F0B' },
    scrap:          { icon: 'ti-mail',      bg: '#E6F1FB', color: '#185FA5' },
    community_join: { icon: 'ti-users-group', bg: '#E1F5EE', color: '#0F6E56' },
  };
  return map[type] || { icon: 'ti-bell', bg: '#F1EFE8', color: '#5F5E5A' };
}

// ── Topbar renderer ───────────────────────────────────────────
function renderTopbar(user, activePage = 'feed') {
  const nav = document.getElementById('topbar');
  if (!nav) return;
  const cl = getAvatarColor(user.uid);
  const av = user.photoURL
    ? `<img src="${user.photoURL}" alt="${user.displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="color:${cl.color}">${getInitials(user.displayName)}</span>`;

  const themeIcon = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'ti-sun' : 'ti-moon';

  nav.innerHTML = `
    <a href="${PAGES}perfil.html?uid=${user.uid}" class="topbar-logo">nexus</a>
    <div class="topbar-search">
      <i class="ti ti-search" aria-hidden="true"></i>
      <input type="text" placeholder="Buscar pessoas, comunidades..." id="search-input" autocomplete="off">
    </div>
    <nav class="topbar-nav">
      <button class="topbar-nav-btn${activePage==='feed'?' active':''}" title="Início" onclick="location.href='${ROOT}index.html'"><i class="ti ti-home" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='friends'?' active':''}" title="Amigos" onclick="location.href='${PAGES}amigos.html'"><i class="ti ti-users" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='messages'?' active':''}" title="Mensagens" onclick="location.href='${PAGES}mensagens.html'"><i class="ti ti-message-circle-2" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='communities'?' active':''}" title="Comunidades" onclick="location.href='${PAGES}comunidades.html'"><i class="ti ti-users-group" aria-hidden="true"></i></button>
      <div class="notif-topbar-wrap">
        <button class="topbar-nav-btn${activePage==='notifications'?' active':''}" title="Notificações" id="notif-btn" onclick="toggleNotifPanel('${user.uid}')">
          <i class="ti ti-bell" aria-hidden="true"></i>
          <span class="notif-badge" id="notif-badge" style="display:none"></span>
        </button>
      </div>
    </nav>
    <button class="theme-toggle-btn" id="theme-toggle-btn" onclick="toggleTheme()" title="Alternar tema">
      <i class="ti ${themeIcon}" aria-hidden="true"></i>
    </button>
    <div class="user-menu" id="user-menu">
      <div class="avatar avatar-32" style="background:${cl.bg};cursor:pointer">${av}</div>
    </div>
  `;

  // Setup user menu dropdown
  (function setupUserMenu() {
    const wrap = document.getElementById('user-menu');
    if (!wrap) return;
    wrap.addEventListener('click', e => {
      e.stopPropagation();
      const existing = document.getElementById('user-dropdown');
      if (existing) { existing.remove(); return; }
      const dd = document.createElement('div');
      dd.id = 'user-dropdown';
      dd.className = 'user-dropdown';
      dd.innerHTML = `
        <a href="${PAGES}perfil.html?uid=${user.uid}" class="user-dropdown-item">
          <i class="ti ti-user-circle" aria-hidden="true"></i> Meu perfil
        </a>
        <a href="${PAGES}configuracoes.html" class="user-dropdown-item">
          <i class="ti ti-settings" aria-hidden="true"></i> Configurações
        </a>
        <div class="user-dropdown-divider"></div>
        <button class="user-dropdown-item danger" onclick="handleSignOut()">
          <i class="ti ti-logout" aria-hidden="true"></i> Sair
        </button>
      `;
      wrap.appendChild(dd);
    });
  })();

  // Botão de tema fica visível no mobile (fora do topbar-nav)
  // Já inserido acima do avatar

  const si = document.getElementById('search-input');
  if (si) {
    si.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = si.value.trim();
        if (q) location.href = `${PAGES}busca.html?q=${encodeURIComponent(q)}`;
      }
    });
  }

  // ── Bottom navigation (mobile) ──────────────────────────────
  if (!document.getElementById('bottom-nav')) {
    const bnav = document.createElement('nav');
    bnav.id = 'bottom-nav';
    bnav.className = 'bottom-nav';
    bnav.setAttribute('aria-label', 'Navegação principal');
    bnav.innerHTML = `
      <button class="bottom-nav-btn${activePage==='feed'?' active':''}" onclick="location.href='${ROOT}index.html'" title="Início">
        <i class="ti ti-home" aria-hidden="true"></i>
        <span>Início</span>
      </button>
      <button class="bottom-nav-btn${activePage==='friends'?' active':''}" onclick="location.href='${PAGES}amigos.html'" title="Amigos">
        <i class="ti ti-users" aria-hidden="true"></i>
        <span>Amigos</span>
      </button>
      <button class="bottom-nav-btn${activePage==='messages'?' active':''}" onclick="location.href='${PAGES}mensagens.html'" title="Mensagens">
        <i class="ti ti-message-circle-2" aria-hidden="true"></i>
        <span>Chat</span>
      </button>
      <button class="bottom-nav-btn${activePage==='communities'?' active':''}" onclick="location.href='${PAGES}comunidades.html'" title="Comunidades">
        <i class="ti ti-users-group" aria-hidden="true"></i>
        <span>Grupos</span>
      </button>
      <button class="bottom-nav-btn${activePage==='notifications'?' active':''}" id="bnav-notif-btn" onclick="toggleNotifPanel('${user.uid}')" title="Notificações">
        <i class="ti ti-bell" aria-hidden="true"></i>
        <span class="notif-dot" id="notif-dot"></span>
        <span>Avisos</span>
      </button>
    `;
    document.body.appendChild(bnav);
  }

  // Iniciar listener de notificações
  initNotifications(user.uid);
}

// ── Painel de notificações ────────────────────────────────────
let _notifPanelOpen = false;

async function toggleNotifPanel(uid) {
  let panel = document.getElementById('notif-panel');
  if (panel) {
    panel.remove();
    _notifPanelOpen = false;
    return;
  }
  _notifPanelOpen = true;

  panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.className = 'notif-panel';
  panel.innerHTML = `
    <div class="notif-panel-header">
      <span class="notif-panel-title">Notificações</span>
      <button class="btn btn-sm" id="_notif-mark-btn">Marcar tudo lido</button>
    </div>
    <div class="notif-panel-body" id="notif-panel-body">
      <div style="display:flex;align-items:center;justify-content:center;padding:2rem">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>
  `;
  // Appended to body so position:fixed works on mobile (topbar-nav is hidden)
  document.body.appendChild(panel);

  panel.querySelector('#_notif-mark-btn').addEventListener('click', () => {
    markAllNotificationsRead(uid).then(() => {
      showToast('Tudo marcado como lido');
      const p = document.getElementById('notif-panel');
      if (p) { p.remove(); _notifPanelOpen = false; }
    }).catch(() => {});
  });

  const notifs = await loadNotifications(uid);
  const body = document.getElementById('notif-panel-body');
  if (!body) return;

  if (!notifs.length) {
    body.innerHTML = `<div class="empty-state" style="padding:1.5rem"><i class="ti ti-bell-off"></i><p>Sem notificações</p></div>`;
    return;
  }

  body.innerHTML = notifs.map(n => {
    const ic = notifIcon(n.type);
    return `
      <div class="notif-item${n.read ? '' : ' unread'}" data-href="${n.link || ''}">
        <div class="notif-icon" style="background:${ic.bg}">
          <i class="ti ${ic.icon}" style="color:${ic.color}"></i>
        </div>
        <div class="notif-text">
          <p>${sanitize(n.message || '')}</p>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>
      </div>`;
  }).join('');

  body.addEventListener('click', e => {
    const item = e.target.closest('.notif-item[data-href]');
    if (item && item.dataset.href) location.href = item.dataset.href;
  });

  markAllNotificationsRead(uid).catch(() => {});
}

// ── Sign out ──────────────────────────────────────────────────
function handleSignOut() {
  auth.signOut().then(() => {
    window.location.href = _isInPages ? 'login.html' : 'pages/login.html';
  }).catch(() => showToast('Erro ao sair. Tente novamente.'));
}

// Fechar painéis ao clicar fora
document.addEventListener('click', e => {
  if (_notifPanelOpen
      && !e.target.closest('#notif-panel')
      && !e.target.closest('.notif-topbar-wrap')
      && !e.target.closest('#bnav-notif-btn')) {
    const panel = document.getElementById('notif-panel');
    if (panel) { panel.remove(); _notifPanelOpen = false; }
  }
  if (!e.target.closest('.user-menu')) {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.remove();
  }
});

// ── Cloudinary upload ─────────────────────────────────────────
const _CLOUDINARY_CLOUD  = 'dyoi5mrdc';
const _CLOUDINARY_PRESET = 'nexus_uploads';

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', _CLOUDINARY_PRESET);

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 30000);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${_CLOUDINARY_CLOUD}/image/upload`,
      { method: 'POST', body: formData, signal: ctrl.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `Falha no upload (${res.status})`);
    }
    const data = await res.json();
    return data.secure_url;
  } catch(e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('O upload demorou demais. Tente com uma imagem menor.');
    throw e;
  }
}

// ── PWA Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ── Sanitize text (basic XSS prevention) ─────────────────────
function sanitize(str = '') {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ── Online status ─────────────────────────────────────────────
function isOnline(user) {
  if (!user || !user.lastSeen) return false;
  const ms = user.lastSeen.toMillis ? user.lastSeen.toMillis() : Number(user.lastSeen);
  return (Date.now() - ms) < 5 * 60 * 1000;
}

function updateOnlineStatus(uid) {
  if (!uid) return;
  const ping = () => db.collection('users').doc(uid)
    .update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(() => {});
  ping();
  setInterval(ping, 2 * 60 * 1000);
}
