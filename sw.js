/* Boardgames offline: every file of the app cached on install, served from the cache, refreshed from the network. */
var VERSION = 'd78a76fda39a';
var FILES = ['./', 'css/style.css','icon.png','index.html','js/core.js','js/games/backgammon.js','js/games/battleship.js','js/games/blackjack.js','js/games/checkers.js','js/games/connect4.js','js/games/domino.js','js/games/dots.js','js/games/halma.js','js/games/kniffel.js','js/games/ludo.js','js/games/mastermind.js','js/games/maumau.js','js/games/memory.js','js/games/morris.js','js/games/reversi.js','js/games/schwarzerpeter.js','js/games/snakes.js','js/games/tictactoe.js','js/gfx.js','js/i18n.js','js/icons.js','js/net.js','js/pwa.js','js/qr.js','manifest.webmanifest'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open('sk-' + VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== 'sk-' + VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    var fetched = fetch(e.request).then(function (res) { if (res && res.ok) caches.open('sk-' + VERSION).then(function (c) { c.put(e.request, res.clone()); }); return res; }).catch(function () { return hit; });
    return hit || fetched;
  }));
});
