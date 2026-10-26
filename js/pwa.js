/* Spielkiste as an app on a phone: the service worker keeps every file for offline play and updates in the
   background. Not on localhost, where a cached copy would hide every edit. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  navigator.serviceWorker.register('sw.js').catch(function () { /* no offline copy then */ });
})();
