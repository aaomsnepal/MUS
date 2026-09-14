/* aaoms e-aaoms Billing — service worker
   FIX (Sep 2026): the app was cache-first for everything, so once a phone
   installed it, edits made to index.html / app.js / hospitals.js never
   reached that phone again — it just kept serving whatever was cached on
   day one. This version:
   1. Bumps the cache name (CACHE) — bump this string on every deploy that
      must force a refresh.
   2. Serves the app shell (HTML/JS/CSS) network-first, so today's edits
      show up the moment the phone is online, and only falls back to the
      cached copy when offline.
   3. Responds to a SKIP_WAITING message so a waiting update activates
      immediately instead of waiting for every open tab to be closed.
*/
const CACHE = 'aaoms-billing-v2';
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/store.js',
  './js/app.js',
  './js/hospitals.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const isAppShell = req.mode === 'navigate' || APP_SHELL.some(a => req.url.endsWith(a.replace('./', '/')));

  if (isAppShell) {
    // Network-first: always try today's real file before touching the cache.
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  } else {
    // Icons/logo etc: cache-first is fine, they rarely change.
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
