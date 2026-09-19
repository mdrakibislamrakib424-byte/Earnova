// EARNOVA — Firebase Messaging Service Worker
// App বন্ধ থাকলেও background push notification দেখাবে
// ⚠️ এই ফাইলে FCM_CONFIG এর সাথে হুবহু একই values বসান

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyAd4bVUjuvIC7P30og4UckLbCcCNB0VuR8',
  authDomain:        'earnova-9cf91.firebaseapp.com',
  projectId:         'earnova-9cf91',
  storageBucket:     'earnova-9cf91.firebasestorage.app',
  messagingSenderId: '1040669106457',
  appId:             '1:1040669106457:web:7c8553740da017c0b2e588',
});

const messaging = firebase.messaging();

// Background notification handler
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'EARNOVA';
  const body  = payload.notification?.body  || '';
  const url   = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon:     '/icon.png',
    badge:    '/icon.png',
    tag:      'earnova-notif',
    renotify: true,
    data:     { url },
    actions:  [
      { action: 'open',    title: '🚀 Open App' },
      { action: 'dismiss', title: '✕ Dismiss'  },
    ],
  });
});

// Click → app খুলবে
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url); return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
