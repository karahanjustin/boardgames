/* The graphics kit of the games: real pieces drawn as SVG with light and shadow (cone figures like the wooden
   ones of Mensch ärgere Dich nicht, turned discs, glass marbles, dice, playing cards, domino tiles, ships), and
   surfaces (wood, felt, paper) as CSS backgrounds with procedural grain. Every function returns an SVG string;
   the colours come from the player palette and are shaded here. Gfx.css() returns the shared stylesheet, added
   once by the shell. */
(function (root) {
  'use strict';
  function hex(c) { c = String(c).replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function rgb(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  // lighter (k > 0, towards white) or darker (k < 0, towards black)
  function shade(c, k) { var a = hex(c); return rgb(a.map(function (v) { return k > 0 ? v + (255 - v) * k : v * (1 + k); })); }
  var uid = 0;
  function id(p) { return p + (++uid); }
  function wrap(size, w, h, body, cls) { return '<svg class="gfx ' + (cls || '') + '" width="' + size + '" height="' + (size * h / w) + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>'; }
  var shadowFilter = '<filter id="gfxsh" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/><feOffset dx="0.6" dy="1.4" result="o"/><feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';

  /* ---------- the cone figure: a wooden pawn with a ball head ---------- */
  function pawn(color, size, opts) {
    opts = opts || {};
    var g = id('pg'), hi = shade(color, 0.45), lo = shade(color, -0.4), mid = color;
    var body = '<defs><linearGradient id="' + g + '" x1="0" x2="1"><stop offset="0" stop-color="' + hi + '"/><stop offset="0.45" stop-color="' + mid + '"/><stop offset="1" stop-color="' + lo + '"/></linearGradient><radialGradient id="' + g + 'r" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="' + shade(color, 0.6) + '"/><stop offset="0.5" stop-color="' + mid + '"/><stop offset="1" stop-color="' + lo + '"/></radialGradient>' + (opts.noShadow ? '' : shadowFilter) + '</defs>' +
      '<ellipse cx="20" cy="54" rx="13" ry="3.2" fill="rgba(0,0,0,0.28)"/>' +
      '<g' + (opts.noShadow ? '' : ' filter="url(#gfxsh)"') + '>' +
      '<path d="M8 52 L13.5 24 Q20 20 26.5 24 L32 52 Q20 57 8 52 Z" fill="url(#' + g + ')"/>' +
      '<ellipse cx="20" cy="52" rx="12" ry="3" fill="' + lo + '" opacity="0.55"/>' +
      '<ellipse cx="20" cy="23" rx="6.5" ry="2.2" fill="' + lo + '" opacity="0.5"/>' +
      '<circle cx="20" cy="14" r="9" fill="url(#' + g + 'r)"/>' +
      '<ellipse cx="16.5" cy="10" rx="3" ry="2" fill="#fff" opacity="0.55"/>' +
      '</g>';
    return wrap(size || 40, 40, 58, body, 'gfx-pawn');
  }
  /* ---------- a turned disc: a checker or a morris man ---------- */
  function disc(color, size, opts) {
    opts = opts || {};
    var g = id('dg'), hi = shade(color, 0.35), lo = shade(color, -0.45);
    var body = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hi + '"/><stop offset="1" stop-color="' + lo + '"/></linearGradient><radialGradient id="' + g + 't" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="' + shade(color, 0.3) + '"/><stop offset="0.7" stop-color="' + color + '"/><stop offset="1" stop-color="' + shade(color, -0.2) + '"/></radialGradient></defs>' +
      '<ellipse cx="20" cy="24" rx="17" ry="7" fill="rgba(0,0,0,0.3)"/>' +
      '<path d="M3 15 v5 a17 7 0 0 0 34 0 v-5 z" fill="url(#' + g + ')"/>' +
      '<ellipse cx="20" cy="15" rx="17" ry="7" fill="url(#' + g + 't)"/>' +
      '<ellipse cx="20" cy="15" rx="13" ry="5.2" fill="none" stroke="' + shade(color, -0.25) + '" stroke-width="0.8" opacity="0.8"/>' +
      '<ellipse cx="20" cy="15" rx="9" ry="3.6" fill="none" stroke="' + shade(color, 0.25) + '" stroke-width="0.7" opacity="0.7"/>' +
      '<ellipse cx="15" cy="12" rx="5" ry="1.6" fill="#fff" opacity="0.35"/>' +
      (opts.king ? '<text x="20" y="18" text-anchor="middle" font-size="9" font-family="Georgia,serif" font-weight="700" fill="' + (opts.kingColor || '#f3d36b') + '" stroke="rgba(0,0,0,0.35)" stroke-width="0.4">♛</text>' : '');
    return wrap(size || 40, 40, 32, body, 'gfx-disc');
  }
  /* ---------- a glass marble ---------- */
  function marble(color, size) {
    var g = id('mg');
    var body = '<defs><radialGradient id="' + g + '" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="' + shade(color, 0.7) + '"/><stop offset="0.35" stop-color="' + color + '"/><stop offset="1" stop-color="' + shade(color, -0.55) + '"/></radialGradient></defs>' +
      '<ellipse cx="20" cy="36" rx="12" ry="3" fill="rgba(0,0,0,0.3)"/><circle cx="20" cy="20" r="15" fill="url(#' + g + ')"/><ellipse cx="14.5" cy="12.5" rx="4.5" ry="2.8" fill="#fff" opacity="0.6" transform="rotate(-30 14.5 12.5)"/>';
    return wrap(size || 40, 40, 40, body, 'gfx-marble');
  }
  /* ---------- a die ---------- */
  var PIPS = { 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]] };
  function die(value, size, color, pip) {
    color = color || '#f6f1e6'; pip = pip || '#1d1a17';
    var g = id('dd');
    var body = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + shade(color, 0.3) + '"/><stop offset="1" stop-color="' + shade(color, -0.18) + '"/></linearGradient></defs>' +
      '<rect x="4" y="6" width="36" height="36" rx="7" fill="rgba(0,0,0,0.3)"/><rect x="2" y="2" width="36" height="36" rx="7" fill="url(#' + g + ')" stroke="' + shade(color, -0.35) + '" stroke-width="0.8"/>' +
      '<rect x="4" y="4" width="32" height="14" rx="6" fill="#fff" opacity="0.18"/>';
    (PIPS[value] || []).forEach(function (p) { body += '<circle cx="' + (2 + 36 * p[0]) + '" cy="' + (2 + 36 * p[1]) + '" r="3.4" fill="' + pip + '"/><circle cx="' + (2 + 36 * p[0] - 1) + '" cy="' + (2 + 36 * p[1] - 1) + '" r="1" fill="#fff" opacity="0.25"/>'; });
    return wrap(size || 40, 40, 44, body, 'gfx-die');
  }
  /* ---------- playing cards ---------- */
  var SUIT = { c: '♣', s: '♠', h: '♥', d: '♦' }, RED = { h: 1, d: 1 };
  var FACE = { J: '♞', Q: '♛', K: '♚' };
  function card(rank, suit, size, opts) {
    opts = opts || {};
    var col = RED[suit] ? '#c8202a' : '#1d1a17', glyph = SUIT[suit] || '', w = 60, h = 84;
    var body = '<rect x="2" y="3" width="' + (w - 2) + '" height="' + (h - 2) + '" rx="6" fill="rgba(0,0,0,0.28)"/><rect x="0.5" y="0.5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="6" fill="#fdfbf5" stroke="#cfc8b8" stroke-width="1"/>' +
      '<text x="6" y="16" font-size="13" font-weight="800" font-family="Georgia,serif" fill="' + col + '">' + rank + '</text><text x="6" y="28" font-size="11" fill="' + col + '">' + glyph + '</text>' +
      '<g transform="rotate(180 ' + (w / 2) + ' ' + (h / 2) + ')"><text x="6" y="16" font-size="13" font-weight="800" font-family="Georgia,serif" fill="' + col + '">' + rank + '</text><text x="6" y="28" font-size="11" fill="' + col + '">' + glyph + '</text></g>';
    if (FACE[rank]) body += '<rect x="16" y="20" width="28" height="44" rx="2" fill="none" stroke="' + col + '" stroke-width="0.8" opacity="0.6"/><text x="30" y="52" text-anchor="middle" font-size="30" fill="' + col + '">' + FACE[rank] + '</text><text x="30" y="30" text-anchor="middle" font-size="9" fill="' + col + '">' + glyph + '</text>';
    else if (rank === 'A') body += '<text x="30" y="56" text-anchor="middle" font-size="38" fill="' + col + '">' + glyph + '</text>';
    else body += '<text x="30" y="55" text-anchor="middle" font-size="30" fill="' + col + '">' + glyph + '</text>';
    if (opts.dim) body += '<rect x="0.5" y="0.5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="6" fill="rgba(40,30,20,0.35)"/>';
    return wrap(size || 60, w, h, body, 'gfx-card');
  }
  function cardBack(size, color) {
    color = color || '#8b1e1e';
    var g = id('cb'), w = 60, h = 84;
    var body = '<defs><pattern id="' + g + '" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="' + color + '"/><path d="M0 4h8M4 0v8" stroke="' + shade(color, 0.35) + '" stroke-width="1"/></pattern></defs>' +
      '<rect x="2" y="3" width="' + (w - 2) + '" height="' + (h - 2) + '" rx="6" fill="rgba(0,0,0,0.28)"/><rect x="0.5" y="0.5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="6" fill="#fdfbf5" stroke="#cfc8b8"/><rect x="5" y="5" width="' + (w - 10) + '" height="' + (h - 10) + '" rx="4" fill="url(#' + g + ')"/><rect x="5" y="5" width="' + (w - 10) + '" height="' + (h - 10) + '" rx="4" fill="none" stroke="' + shade(color, 0.5) + '" stroke-width="1"/><ellipse cx="30" cy="42" rx="11" ry="15" fill="' + shade(color, -0.3) + '" stroke="' + shade(color, 0.5) + '" stroke-width="1"/>';
    return wrap(size || 60, w, h, body, 'gfx-card');
  }
  /* ---------- a domino tile ---------- */
  function domino(a, b, size, vertical) {
    var w = 80, h = 40, body = '<rect x="2" y="3" width="80" height="40" rx="5" fill="rgba(0,0,0,0.3)"/><rect x="0.5" y="0.5" width="79" height="39" rx="5" fill="#f5efe0" stroke="#b9ad96"/><rect x="2" y="2" width="76" height="12" rx="4" fill="#fff" opacity="0.5"/><path d="M40 5v30" stroke="#a79b84" stroke-width="1.5"/>';
    var half = function (v, ox) { (PIPS[v] || []).forEach(function (p) { body += '<circle cx="' + (ox + 4 + 32 * p[0]) + '" cy="' + (4 + 32 * p[1]) + '" r="3" fill="#1d1a17"/>'; }); };
    half(a, 0); half(b, 40);
    var svg = wrap(size || 80, w, h, body, 'gfx-domino');
    return vertical ? svg.replace('class="gfx gfx-domino"', 'class="gfx gfx-domino" style="transform:rotate(90deg)"') : svg;
  }
  /* ---------- a ship, seen from above, len squares long ---------- */
  function ship(len, size, color) {
    color = color || '#6b7280';
    var w = len * 40, h = 40, g = id('sg');
    var body = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(color, 0.35) + '"/><stop offset="1" stop-color="' + shade(color, -0.35) + '"/></linearGradient></defs>' +
      '<path d="M6 20 Q10 6 22 6 H' + (w - 12) + ' Q' + (w - 2) + ' 6 ' + (w - 2) + ' 20 Q' + (w - 2) + ' 34 ' + (w - 12) + ' 34 H22 Q10 34 6 20 Z" fill="rgba(0,0,0,0.3)" transform="translate(1,3)"/>' +
      '<path d="M6 20 Q10 6 22 6 H' + (w - 12) + ' Q' + (w - 2) + ' 6 ' + (w - 2) + ' 20 Q' + (w - 2) + ' 34 ' + (w - 12) + ' 34 H22 Q10 34 6 20 Z" fill="url(#' + g + ')" stroke="' + shade(color, -0.5) + '" stroke-width="1"/>';
    for (var i = 1; i < len; i++) body += '<rect x="' + (i * 40 - 10) + '" y="13" width="20" height="14" rx="3" fill="' + shade(color, 0.15) + '" stroke="' + shade(color, -0.4) + '" stroke-width="0.8"/>';
    if (len >= 3) body += '<rect x="' + (w / 2 - 6) + '" y="9" width="12" height="22" rx="2" fill="' + shade(color, -0.1) + '" stroke="' + shade(color, -0.5) + '" stroke-width="0.8"/>';
    body += '<circle cx="' + (w - 14) + '" cy="20" r="3" fill="' + shade(color, 0.4) + '"/>';
    return wrap(size || w, w, h, body, 'gfx-ship');
  }
  /* ---------- a crown, a star, a flag for markers ---------- */
  function crown(size, color) { color = color || '#f0c050'; return wrap(size || 20, 24, 20, '<path d="M3 16 L5 6 L9 11 L12 3 L15 11 L19 6 L21 16 Z" fill="' + color + '" stroke="' + shade(color, -0.45) + '" stroke-width="1" stroke-linejoin="round"/><rect x="3" y="15" width="18" height="3" fill="' + shade(color, -0.2) + '"/>', 'gfx-crown'); }
  /* ---------- the surfaces: wood, felt, paper, as data URIs with grain ---------- */
  var noise = function (seed, base, freq, octaves) { return 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="' + octaves + '" seed="' + seed + '"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.22 0"/></filter><rect width="300" height="300" fill="' + base + '"/><rect width="300" height="300" filter="url(#n)"/></svg>') + '")'; };
  function css() {
    return '.gfx{display:block;overflow:visible}' +
      '.gfx-wood{background-color:#9a6a3e;background-image:' + noise(3, '#9a6a3e', '0.9 0.015', 3) + ';box-shadow:inset 0 0 0 1px rgba(0,0,0,.25),inset 0 2px 0 rgba(255,255,255,.12)}' +
      '.gfx-wood-dark{background-color:#5c3a22;background-image:' + noise(7, '#5c3a22', '0.9 0.015', 3) + '}' +
      '.gfx-felt{background-color:#2c6b4a;background-image:' + noise(11, '#2c6b4a', '0.6', 2) + '}' +
      '.gfx-paper{background-color:#f3ecdc;background-image:' + noise(5, '#f3ecdc', '0.5', 2) + '}' +
      '.gfx-ivory{background-color:#efe6d2;background-image:' + noise(9, '#efe6d2', '0.4', 2) + '}' +
      '.gfx-frame{border:10px solid #7a4a2a;border-image:linear-gradient(135deg,#a9753f,#6b3f20 40%,#8a5a36 60%,#4e2d16) 1;box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 0 0 2px rgba(0,0,0,.35)}';
  }
  root.Gfx = { shade: shade, pawn: pawn, disc: disc, marble: marble, die: die, card: card, cardBack: cardBack, domino: domino, ship: ship, crown: crown, css: css, noise: noise, PIPS: PIPS, SUIT: SUIT };
})(typeof self !== 'undefined' ? self : this);
