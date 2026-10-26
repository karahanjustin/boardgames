/* Spielkiste as an app on a phone: the service worker keeps every file for offline play and updates in the background. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(function () { /* no offline copy then */ });
})();
