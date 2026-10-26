/* The pictograms of the games: one line style, 24 x 24, drawn by hand as paths. Icons.get(id, size) -> SVG string. */
(function (root) {
  'use strict';
  var P = {
    connect4: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8" cy="9" r="1.6"/><circle cx="12" cy="9" r="1.6"/><circle cx="16" cy="9" r="1.6"/><circle cx="8" cy="15" r="1.6" fill="currentColor"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/><circle cx="16" cy="15" r="1.6"/>',
    tictactoe: '<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M4.5 4.5l3 3M7.5 4.5l-3 3"/><circle cx="18" cy="18" r="1.8"/>',
    ludo: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="6" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/><circle cx="12" cy="6" r="1.2"/><circle cx="12" cy="18" r="1.2"/>',
    battleship: '<path d="M3 15h18l-2 4H5z"/><path d="M7 15V9h10v6M10 9V5h4v4"/><path d="M2 21c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/>',
    checkers: '<ellipse cx="12" cy="15" rx="8" ry="3.5"/><path d="M4 15v-3c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v3"/><ellipse cx="12" cy="9" rx="8" ry="3.5"/><path d="M4 9V6.5C4 4.6 7.6 3 12 3s8 1.6 8 3.5V9"/>',
    morris: '<rect x="3" y="3" width="18" height="18"/><rect x="7" y="7" width="10" height="10"/><rect x="10" y="10" width="4" height="4"/><path d="M12 3v7M12 14v7M3 12h7M14 12h7"/>',
    reversi: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    backgammon: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M5 3l2.5 9L10 3M14 3l2.5 9L19 3"/><path d="M5 21l2.5-9 2.5 9M14 21l2.5-9 2.5 9" fill="currentColor"/>',
    halma: '<path d="M12 2l2.6 6.4H21l-5.3 4.1 2 6.5-5.7-4-5.7 4 2-6.5L3 8.4h6.4z"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    snakes: '<path d="M7 3v18M13 3v18M7 7h6M7 11h6M7 15h6M7 19h6"/><path d="M16 4c3 0 3 3 0 3s-3 3 0 3 3 3 0 3-3 3 0 3" /><circle cx="19.5" cy="4.5" r="1" fill="currentColor"/>',
    dots: '<circle cx="5" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="19" cy="5" r="1.4" fill="currentColor"/><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/><circle cx="5" cy="19" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/><circle cx="19" cy="19" r="1.4" fill="currentColor"/><path d="M5 5h7v7H5zM12 12h7M19 12v7"/>',
    memory: '<rect x="3" y="5" width="9" height="13" rx="1.2"/><rect x="12" y="6" width="9" height="13" rx="1.2" fill="currentColor" opacity=".15"/><rect x="12" y="6" width="9" height="13" rx="1.2"/><path d="M6 9.5h3M6 13.5h3"/><path d="M14.5 10.5l1.5 1.5 3-3"/>',
    mastermind: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="8" r="1.6"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="8" cy="13" r="1.6"/><circle cx="12" cy="13" r="1.6" fill="currentColor"/><circle cx="16" cy="13" r="1.6"/><path d="M7 17.5h10"/>',
    kniffel: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>',
    maumau: '<rect x="5" y="2.5" width="13" height="18" rx="1.5" transform="rotate(-8 11.5 11.5)"/><rect x="8" y="4" width="13" height="18" rx="1.5" fill="#fff" transform="rotate(8 14.5 13)"/><rect x="8" y="4" width="13" height="18" rx="1.5" transform="rotate(8 14.5 13)"/><path d="M13 10.5l1.6-1.6 1.6 1.6-1.6 1.6z" fill="currentColor"/>',
    schwarzerpeter: '<path d="M4 16h16"/><path d="M7 16V7.5A1.5 1.5 0 0 1 8.5 6h7A1.5 1.5 0 0 1 17 7.5V16"/><path d="M7 11h10"/><ellipse cx="12" cy="16.5" rx="9" ry="2.5"/>',
    domino: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 12h16"/><circle cx="9" cy="7" r="1.3" fill="currentColor"/><circle cx="15" cy="7" r="1.3" fill="currentColor"/><circle cx="9" cy="17" r="1.3" fill="currentColor"/><circle cx="12" cy="17" r="1.3" fill="currentColor"/><circle cx="15" cy="17" r="1.3" fill="currentColor"/>',
    blackjack: '<rect x="3" y="4" width="11" height="15" rx="1.5" transform="rotate(-10 8.5 11.5)"/><rect x="10" y="5" width="11" height="15" rx="1.5" fill="#fff" transform="rotate(10 15.5 12.5)"/><rect x="10" y="5" width="11" height="15" rx="1.5" transform="rotate(10 15.5 12.5)"/><path d="M13.5 9.5l1.4-1.5 1.4 1.5-1.4 2.2z" fill="currentColor"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8h3v3H8zM13 8h3M13 11h3M8 13h3M13 13h3v3h-3zM8 16h3"/>',
    sound: '<path d="M4 10v4h3l4 3V7l-4 3z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 10v4h3l4 3V7l-4 3z"/><path d="M15 9l5 6M20 9l-5 6"/>'
  };
  function get(id, size, cls) { var p = P[id] || P.dice; return '<svg class="ico ' + (cls || '') + '" width="' + (size || 24) + '" height="' + (size || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  root.Icons = { get: get, has: function (id) { return !!P[id]; } };
})(typeof self !== 'undefined' ? self : this);
