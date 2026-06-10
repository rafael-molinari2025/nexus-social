// ============================================================
//  NEXUS — Shared Utilities  (js/utils.js)
// ============================================================

// ── Detectar prefixo de path para navegação ───────────────────
const _isInPages = location.pathname.includes('/pages/');
const ROOT = _isInPages ? '../' : './';
const PAGES = _isInPages ? '' : 'pages/';

// ── Avatar helpers ───────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: '#EEF2FF', color: '#6366F1' },
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
    return `<div class="${cls}" style="background:${cl.bg}"><img src="${user.photoURL}" alt="${sanitize(user.displayName)}"></div>`;
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
  const saved = localStorage.getItem('nexus-theme');
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
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
  let _inited = false;
  _notifUnsub = db.collection('notifications').doc(uid)
    .collection('items')
    .where('read', '==', false)
    .onSnapshot(snap => {
      const count = snap.size;
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = count > 0 ? 'block' : 'none';
      const dot = document.getElementById('notif-dot');
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
      if (_inited) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') _fireBrowserNotif(change.doc.data());
        });
      }
      _inited = true;
    }, () => {});
}

function _fireBrowserNotif(notif) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('Nexus', {
      body: notif.message || 'Você tem uma nova notificação',
      icon: '/icons/icon-192.png',
      tag: `nexus-${notif.type || 'notif'}`,
      renotify: true
    });
    if (notif.link) n.onclick = () => { window.focus(); location.href = notif.link; };
  } catch(e) {}
}

function requestBrowserNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  Notification.requestPermission();
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
    friend_request: { icon: 'ti-user-plus',      bg: '#EEF2FF', color: '#6366F1' },
    friend_accept:  { icon: 'ti-users',          bg: '#E1F5EE', color: '#0F6E56' },
    post_like:      { icon: 'ti-heart',          bg: '#FBEAF0', color: '#993556' },
    post_comment:   { icon: 'ti-message-circle', bg: '#FAEEDA', color: '#854F0B' },
    scrap:          { icon: 'ti-mail',           bg: '#E6F1FB', color: '#185FA5' },
    community_join: { icon: 'ti-users-group',    bg: '#E1F5EE', color: '#0F6E56' },
    mention:        { icon: 'ti-at',             bg: '#E0F2FE', color: '#0369A1' },
    poll_vote:      { icon: 'ti-chart-bar',      bg: '#F5F3FF', color: '#7C3AED' },
  };
  return map[type] || { icon: 'ti-bell', bg: '#F1EFE8', color: '#5F5E5A' };
}

// ── Topbar renderer ───────────────────────────────────────────
function renderTopbar(user, activePage = 'feed') {
  const nav = document.getElementById('topbar');
  if (!nav) return;
  const cl = getAvatarColor(user.uid);
  const av = user.photoURL
    ? `<img src="${user.photoURL}" alt="${sanitize(user.displayName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="color:${cl.color}">${getInitials(user.displayName)}</span>`;

  const themeIcon = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'ti-sun' : 'ti-moon';
  const mainNavPages = ['feed', 'friends', 'messages', 'communities', 'trends'];
  const showBack = !mainNavPages.includes(activePage);

  nav.innerHTML = `
    ${showBack ? `<button class="topbar-nav-btn topbar-back-btn" onclick="history.back()" title="Voltar" aria-label="Voltar"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>` : ''}
    <a href="${ROOT}index.html" class="topbar-logo">nexus</a>
    <div class="topbar-search">
      <i class="ti ti-search" aria-hidden="true"></i>
      <input type="text" placeholder="Buscar pessoas, comunidades..." id="search-input" autocomplete="off">
    </div>
    <nav class="topbar-nav">
      <button class="topbar-nav-btn${activePage==='feed'?' active':''}" title="Início" onclick="location.href='${ROOT}index.html'"><i class="ti ti-home" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='friends'?' active':''}" title="Amigos" onclick="location.href='${PAGES}amigos.html'"><i class="ti ti-users" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='messages'?' active':''}" title="Mensagens" onclick="location.href='${PAGES}mensagens.html'"><i class="ti ti-message-circle-2" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='communities'?' active':''}" title="Comunidades" onclick="location.href='${PAGES}comunidades.html'"><i class="ti ti-users-group" aria-hidden="true"></i></button>
      <button class="topbar-nav-btn${activePage==='trends'?' active':''}" title="Tendências" onclick="location.href='${PAGES}tendencias.html'"><i class="ti ti-trending-up" aria-hidden="true"></i></button>
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
        <a href="${PAGES}galeria.html" class="user-dropdown-item">
          <i class="ti ti-photo" aria-hidden="true"></i> Minha galeria
        </a>
        <a href="${PAGES}salvos.html" class="user-dropdown-item">
          <i class="ti ti-bookmark" aria-hidden="true"></i> Posts salvos
        </a>
        <a href="${PAGES}tendencias.html" class="user-dropdown-item">
          <i class="ti ti-trending-up" aria-hidden="true"></i> Tendências
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
    // History stored as JSON array in localStorage
    const HIST_KEY = 'nexus-search-history';
    const getHistory = () => JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    const saveHistory = q => {
      let h = getHistory().filter(x => x !== q);
      h.unshift(q);
      localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 8)));
    };
    const removeHistory = q => {
      localStorage.setItem(HIST_KEY, JSON.stringify(getHistory().filter(x => x !== q)));
    };

    function renderSearchHistory() {
      const hist = getHistory();
      let dd = document.getElementById('search-history-dd');
      if (!hist.length) { if (dd) dd.remove(); return; }
      if (!dd) {
        dd = document.createElement('div');
        dd.id = 'search-history-dd';
        dd.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:500;margin-top:6px;overflow:hidden';
        si.parentElement.style.position = 'relative';
        si.parentElement.appendChild(dd);
      }
      dd.innerHTML = hist.map(q => {
        const safe = q.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        return `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .875rem;cursor:pointer;transition:background var(--transition);font-size:13px;color:var(--text-primary)" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='none'" onclick="document.getElementById('search-input').value='${safe}';this.closest('#search-history-dd').remove();location.href='${PAGES}busca.html?q=${encodeURIComponent(q)}'">
          <i class="ti ti-history" style="font-size:14px;color:var(--text-muted);flex-shrink:0"></i>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>
          <button onclick="event.stopPropagation();removeSearchHistory('${safe}');renderTopbarSearchHistory()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px;font-size:13px;display:flex;align-items:center" title="Remover"><i class="ti ti-x"></i></button>
        </div>`;
      }).join('');
    }

    window.removeSearchHistory = q => removeHistory(q);
    window.renderTopbarSearchHistory = renderSearchHistory;

    si.addEventListener('focus', () => { if (!si.value.trim()) renderSearchHistory(); });
    si.addEventListener('input', () => { if (!si.value.trim()) renderSearchHistory(); else document.getElementById('search-history-dd')?.remove(); });
    si.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = si.value.trim();
        if (q) { saveHistory(q); location.href = `${PAGES}busca.html?q=${encodeURIComponent(q)}`; }
      }
      if (e.key === 'Escape') document.getElementById('search-history-dd')?.remove();
    });
    document.addEventListener('click', e => {
      if (!si.contains(e.target)) document.getElementById('search-history-dd')?.remove();
    }, true);
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

// ── Agrupamento de notificações ───────────────────────────────
function groupNotifications(notifs) {
  const groups = [];
  const byKey  = {};
  for (const n of notifs) {
    const groupable = ['post_like', 'post_comment'].includes(n.type);
    if (!groupable) { groups.push(n); continue; }
    const key = `${n.type}:${n.link || ''}`;
    if (byKey[key]) {
      byKey[key]._extra = (byKey[key]._extra || 0) + 1;
    } else {
      byKey[key] = { ...n, _extra: 0 };
      groups.push(byKey[key]);
    }
  }
  return groups.map(n => {
    if (!n._extra) return n;
    const suffix = n._extra === 1 ? 'mais 1 pessoa' : `mais ${n._extra} pessoas`;
    return { ...n, message: `${(n.message || '').replace(/\.$/, '')} e ${suffix}.` };
  });
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

  // Prompt to enable browser notifications if not yet decided
  if ('Notification' in window && Notification.permission === 'default') {
    const hint = document.createElement('div');
    hint.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:.6rem 1rem;background:var(--indigo-50);font-size:12.5px;color:var(--indigo-700);border-bottom:1px solid var(--border)';
    hint.innerHTML = `<i class="ti ti-bell-ringing" style="font-size:16px;flex-shrink:0"></i>
      <span style="flex:1">Ative as notificações do browser para ser alertado mesmo fora da aba.</span>
      <button onclick="requestBrowserNotifications();this.closest('div').remove()" style="background:var(--indigo-600);color:#fff;border:none;border-radius:var(--radius-sm);padding:.25rem .65rem;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap">Ativar</button>`;
    panel.querySelector('.notif-panel-body').before(hint);
  }

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

  const grouped = groupNotifications(notifs);
  body.innerHTML = grouped.map(n => {
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

// ── Rate limiter ──────────────────────────────────────────────
const _rateLimits = {};

function checkRateLimit(key, maxCalls, windowMs) {
  const now = Date.now();
  if (!_rateLimits[key]) _rateLimits[key] = [];
  _rateLimits[key] = _rateLimits[key].filter(t => now - t < windowMs);
  if (_rateLimits[key].length >= maxCalls) return false;
  _rateLimits[key].push(now);
  return true;
}

// ── Image compression ─────────────────────────────────────────
function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight) { resolve(file); return; }
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Cloudinary upload ─────────────────────────────────────────
const _CLOUDINARY_CLOUD  = 'dyoi5mrdc';
const _CLOUDINARY_PRESET = 'nexus_uploads';

async function uploadToCloudinary(file, options = {}) {
  const { compress = true, maxWidth = 1280, maxHeight = 1280, quality = 0.82 } = options;
  if (compress) file = await compressImage(file, maxWidth, maxHeight, quality);

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

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'SW_UPDATED') return;
    const existing = document.getElementById('sw-update-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.style.cssText = [
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
      'background:var(--gradient-primary);color:#fff',
      'padding:.6rem 1.1rem;border-radius:var(--radius-full)',
      'font-size:13px;font-weight:600;z-index:9999',
      'display:flex;align-items:center;gap:.75rem;box-shadow:var(--shadow-lg)',
      'white-space:nowrap'
    ].join(';');
    banner.innerHTML = `<i class="ti ti-refresh" aria-hidden="true"></i> Nova versão disponível
      <button onclick="location.reload()" style="background:rgba(255,255,255,.25);border:none;color:#fff;border-radius:var(--radius-sm);padding:.25rem .65rem;cursor:pointer;font-size:12px;font-weight:600">Atualizar</button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:16px;line-height:1;padding:0">×</button>`;
    document.body.appendChild(banner);
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

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(srcs, startIdx = 0) {
  if (typeof srcs === 'string') srcs = [srcs];
  window._lbList = srcs;
  window._lbIdx  = Math.max(0, Math.min(startIdx, srcs.length - 1));

  let lb = document.getElementById('_lb');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = '_lb';
    lb.style.cssText = [
      'position:fixed;inset:0;z-index:3000',
      'background:rgba(0,0,0,.93)',
      'display:flex;align-items:center;justify-content:center',
      'cursor:zoom-out;-webkit-tap-highlight-color:transparent'
    ].join(';');
    lb.innerHTML = `
      <button id="_lb_close" onclick="closeLightbox()" aria-label="Fechar"
        style="position:absolute;top:.75rem;right:.75rem;width:40px;height:40px;
               border-radius:50%;background:rgba(255,255,255,.18);border:none;
               color:#fff;font-size:20px;cursor:pointer;display:flex;
               align-items:center;justify-content:center;z-index:1">
        <i class="ti ti-x"></i>
      </button>
      <button id="_lb_prev" onclick="event.stopPropagation();_lbNav(-1)" aria-label="Anterior"
        style="position:absolute;left:.75rem;width:44px;height:44px;border-radius:50%;
               background:rgba(255,255,255,.18);border:none;color:#fff;font-size:22px;
               cursor:pointer;display:none;align-items:center;justify-content:center;z-index:1">
        <i class="ti ti-chevron-left"></i>
      </button>
      <img id="_lb_img" src="" alt="Foto"
        style="max-width:92vw;max-height:88vh;object-fit:contain;border-radius:8px;
               cursor:default;user-select:none;display:block;box-shadow:0 8px 40px rgba(0,0,0,.5)"
        onclick="event.stopPropagation()" draggable="false">
      <button id="_lb_next" onclick="event.stopPropagation();_lbNav(1)" aria-label="Próxima"
        style="position:absolute;right:.75rem;width:44px;height:44px;border-radius:50%;
               background:rgba(255,255,255,.18);border:none;color:#fff;font-size:22px;
               cursor:pointer;display:none;align-items:center;justify-content:center;z-index:1">
        <i class="ti ti-chevron-right"></i>
      </button>
      <div id="_lb_counter"
        style="position:absolute;bottom:1.25rem;left:50%;transform:translateX(-50%);
               color:rgba(255,255,255,.65);font-size:12px;font-weight:500;pointer-events:none">
      </div>`;
    lb.addEventListener('click', closeLightbox);
    document.body.appendChild(lb);
    document.addEventListener('keydown', e => {
      const el = document.getElementById('_lb');
      if (!el || el.style.display === 'none') return;
      if (e.key === 'Escape')      closeLightbox();
      if (e.key === 'ArrowLeft')   _lbNav(-1);
      if (e.key === 'ArrowRight')  _lbNav(1);
    });
  }

  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _lbRender();
}

function _lbRender() {
  const img     = document.getElementById('_lb_img');
  const prev    = document.getElementById('_lb_prev');
  const next    = document.getElementById('_lb_next');
  const counter = document.getElementById('_lb_counter');
  if (!img) return;
  img.src = window._lbList[window._lbIdx];
  const multi = window._lbList.length > 1;
  if (prev)    prev.style.display    = multi ? 'flex' : 'none';
  if (next)    next.style.display    = multi ? 'flex' : 'none';
  if (counter) counter.textContent   = multi ? `${window._lbIdx + 1} / ${window._lbList.length}` : '';
}

function _lbNav(dir) {
  if (!window._lbList) return;
  window._lbIdx = (window._lbIdx + dir + window._lbList.length) % window._lbList.length;
  _lbRender();
}

function closeLightbox() {
  const lb = document.getElementById('_lb');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}
