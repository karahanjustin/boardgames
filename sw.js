/* Spielkiste offline: every file of the app cached on install, served from the cache, refreshed from the network. */
var VERSION = 'dev';
var FILES = ['./', 'index.html', 'css/style.css', 'js/i18n.js', 'js/net.js', 'js/core.js', 'js/pwa.js', 'manifest.webmanifest', 'icon.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open('sk-' + VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== 'sk-' + VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    var fetched = fetch(e.request).then(function (res) { if (res && res.ok) caches.open('sk-' + VERSION).then(function (c) { c.put(e.request, res.clone()); }); return res; }).catch(function () { return hit; });
    return hit || fetched;
  }));
});
