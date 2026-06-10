const CACHE_NAME = 'nexus-v3';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/utils.js',
  '/js/firebase-config.js',
  '/offline.html'
];
const NETWORK_TIMEOUT = 8000; // 8s

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      // Notify all open clients that a new version is active
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
  self.clients.claim();
});

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Ignorar requisições do Firebase / Google APIs / CDNs
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  const isStaticAsset = /\.(css|js|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)
    || STATIC_ASSETS.includes(url.pathname);

  const isHtml = e.request.headers.get('accept')?.includes('text/html');

  if (isStaticAsset) {
    // Cache-first: serve do cache imediatamente; busca na rede e atualiza em paralelo
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const networkFetch = fetchWithTimeout(e.request, NETWORK_TIMEOUT).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  if (isHtml) {
    // Network-first com timeout; cai no offline.html se falhar
    e.respondWith(
      fetchWithTimeout(e.request, NETWORK_TIMEOUT)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || caches.match('/offline.html')
          )
        )
    );
    return;
  }

  // Padrão: rede com timeout e fallback no cache
  e.respondWith(
    fetchWithTimeout(e.request, NETWORK_TIMEOUT).catch(() => caches.match(e.request))
  );
});
