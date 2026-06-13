importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCPRFqmP5Zp7Bk1dpbnLeHyXoHAmt6TW6k',
  authDomain:        'rede-social-acf40.firebaseapp.com',
  projectId:         'rede-social-acf40',
  storageBucket:     'rede-social-acf40.firebasestorage.app',
  messagingSenderId: '930877572432',
  appId:             '1:930877572432:web:bdb6e937b5f4e747c89855'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title = 'Nexus', body = '', icon } = payload.notification || {};
  const url = payload.data?.url || '/';
  return self.registration.showNotification(title, {
    body,
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: { url },
    tag: payload.data?.tag || 'nexus-notif',
    renotify: true
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const w = list.find(c => c.url.startsWith(self.location.origin));
      if (w) { w.focus(); return w.navigate(url); }
      return clients.openWindow(url);
    })
  );
});
