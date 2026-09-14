const CACHE = 'kkpramod-v8';
const SHELL = [
  '/',
  '/index.html',
  '/nepse',
  '/aavnepse',
  '/moneycontrol',
  '/chat',
  '/print',
  '/assets/aaoms-core.css',
  '/assets/aaoms-core.js',
  '/assets/favicon-infinity.png',
  '/manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  var isHtml = e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') !== -1;
  if (isHtml) {
    e.respondWith(fetch(e.request).then(function (resp) {
      if (!resp || resp.status !== 200) return resp;
      var clone = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      return resp;
    }).catch(function () {
      return caches.match(e.request);
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (r) {
    var isJs = e.request.url.indexOf('.js') !== -1;
    if (isJs) return fetch(e.request).then(function (resp) {
      if (resp && resp.status === 200) {
        var clone = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      }
      return resp;
    });
    return r || fetch(e.request).then(function (resp) {
      if (!resp || resp.status !== 200) return resp;
      var clone = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      return resp;
    });
  }).catch(function () {
    if (e.request.destination === 'document') return caches.match('/index.html');
  }));
});

self.addEventListener('push', function (e) {
  var data = { title: 'kkpramod', body: 'New update from aaoms Digital Nepal', url: '/' };
  if (e.data) { try { data = e.data.json(); } catch (err) { data.body = e.data.text(); } }
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/assets/favicon-infinity.png', badge: '/assets/favicon-infinity.png', tag: data.url || '/', data: data }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(function (wl) {
    for (var i = 0; i < wl.length; i++) { if (wl[i].url.includes(url)) return wl[i].focus(); }
    return clients.openWindow(url);
  }));
});
