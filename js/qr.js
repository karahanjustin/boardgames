/* A QR code writer, nothing else: byte mode, error correction level L or M, versions 1 to 20, the mask chosen by
   the four penalty rules. QR.matrix(text, level) gives the modules, QR.svg(text, size, level) an SVG string.
   Written from the specification (ISO 18004) so the app carries no library. */
(function (root) {
  'use strict';
  // the Reed-Solomon field
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function generator(n) { var g = [1]; for (var i = 0; i < n; i++) { var next = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); } g = next; } return g; }
  function rsRemainder(data, n) { var g = generator(n), res = new Array(n).fill(0); for (var i = 0; i < data.length; i++) { var f = data[i] ^ res[0]; res.shift(); res.push(0); if (f) for (var j = 0; j < n; j++) res[j] ^= mul(g[j + 1], f); } return res; }
  // the tables for versions 1..20: total codewords, then per level L and M: [ec codewords per block, blocks group 1, data per block 1, blocks group 2, data per block 2]
  var TOTAL = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085];
  var EC = {
    L: [null, [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69], [20, 4, 81, 0, 0], [24, 2, 92, 2, 93], [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88], [24, 5, 98, 1, 99], [28, 1, 107, 5, 108], [30, 5, 120, 1, 121], [28, 3, 113, 4, 114], [28, 3, 107, 5, 108]],
    M: [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44], [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42], [28, 7, 45, 3, 46], [28, 10, 46, 1, 47], [26, 9, 43, 4, 44], [26, 3, 44, 11, 45], [26, 3, 41, 13, 42]]
  };
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];
  function utf8(str) { return Array.prototype.slice.call(new TextEncoder().encode(str)); }
  function capacity(v, level) { var e = EC[level][v]; return e[1] * e[2] + e[3] * e[4]; }
  function encode(text, level) {
    level = level || 'L';
    var bytes = utf8(text), v = 1;
    while (v <= 20 && capacity(v, level) < bytes.length + (v < 10 ? 2 : 3) + 1) v++;
    if (v > 20) throw new Error('too long for a QR code');
    var cap = capacity(v, level), bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    push(0, Math.min(4, cap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    for (var pad = 0; data.length < cap; pad++) data.push(pad % 2 ? 0x11 : 0xec);
    // the blocks and their error correction, interleaved
    var e = EC[level][v], blocks = [], ecs = [], pos = 0;
    for (var g = 0; g < 2; g++) for (var bI = 0; bI < e[1 + g * 2]; bI++) { var len = e[2 + g * 2], blk = data.slice(pos, pos + len); pos += len; blocks.push(blk); ecs.push(rsRemainder(blk, e[0])); }
    var out = [], maxLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (var c = 0; c < maxLen; c++) blocks.forEach(function (b) { if (c < b.length) out.push(b[c]); });
    for (var c2 = 0; c2 < e[0]; c2++) ecs.forEach(function (b) { out.push(b[c2]); });
    return { v: v, codewords: out };
  }
  function matrix(text, level) {
    level = level || 'L';
    var enc = encode(text, level), v = enc.v, n = v * 4 + 17;
    var m = [], fixed = [];
    for (var y = 0; y < n; y++) { m.push(new Array(n).fill(0)); fixed.push(new Array(n).fill(false)); }
    function set(x, y, val) { m[y][x] = val; fixed[y][x] = true; }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue; var d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d === 4 || d === 2 ? 0 : 1); } }
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    for (var i = 8; i < n - 8; i++) { set(i, 6, i % 2 === 0 ? 1 : 0); set(6, i, i % 2 === 0 ? 1 : 0); }
    var al = ALIGN[v];
    // the alignment patterns, except where one would overlap a finder (they may cross the timing lines)
    al.forEach(function (cy) { al.forEach(function (cx) { if ((cx - 2 <= 8 && cy - 2 <= 8) || (cx + 2 >= n - 9 && cy - 2 <= 8) || (cx - 2 <= 8 && cy + 2 >= n - 9)) return; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d === 1 ? 0 : 1); } }); });
    // the format and version areas are reserved now and written after the mask is chosen
    for (var f = 0; f < 9; f++) { set(f, 8, 0); set(8, f, 0); }
    for (var f2 = 0; f2 < 8; f2++) { set(n - 1 - f2, 8, 0); set(8, n - 1 - f2, 0); }
    set(8, n - 8, 1);
    if (v >= 7) for (var a = 0; a < 6; a++) for (var b = 0; b < 3; b++) { set(a, n - 11 + b, 0); set(n - 11 + b, a, 0); }
    // the data, zigzag from the bottom right, skipping column 6
    var bits = []; enc.codewords.forEach(function (cw) { for (var k = 7; k >= 0; k--) bits.push((cw >> k) & 1); });
    var bi = 0, up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var row = 0; row < n; row++) {
        var y2 = up ? n - 1 - row : row;
        for (var c = 0; c < 2; c++) { var x2 = col - c; if (fixed[y2][x2]) continue; m[y2][x2] = bi < bits.length ? bits[bi] : 0; bi++; }
      }
      up = !up;
    }
    // the masks, scored by the four penalties
    var MASK = [function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; }, function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; }, function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }];
    var FORMAT = { L: 1, M: 0 };
    function formatBits(mask) { var data = (FORMAT[level] << 3) | mask, r = data << 10; for (var k = 4; k >= 0; k--) if (r & (1 << (k + 10))) r ^= 0x537 << k; return ((data << 10) | r) ^ 0x5412; }
    function applyMask(mask) {
      var out = m.map(function (r) { return r.slice(); });
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (!fixed[y][x] && MASK[mask](x, y)) out[y][x] ^= 1;
      var fb = formatBits(mask);
      for (var k = 0; k < 15; k++) {
        var bit = (fb >> k) & 1;
        if (k < 6) out[k][8] = bit; else if (k < 8) out[k + 1][8] = bit; else if (k === 8) out[8][7] = bit; else out[8][14 - k] = bit;
        if (k < 8) out[8][n - 1 - k] = bit; else out[n - 15 + k][8] = bit;
      }
      if (v >= 7) {
        var vb = v << 12; for (var k2 = 5; k2 >= 0; k2--) if (vb & (1 << (k2 + 12))) vb ^= 0x1f25 << k2; vb |= v << 12;
        for (var k3 = 0; k3 < 18; k3++) { var b3 = (vb >> k3) & 1; out[Math.floor(k3 / 3)][n - 11 + (k3 % 3)] = b3; out[n - 11 + (k3 % 3)][Math.floor(k3 / 3)] = b3; }
      }
      return out;
    }
    function penalty(g) {
      var p = 0, y, x;
      for (y = 0; y < n; y++) { var run = 1; for (x = 1; x < n; x++) { if (g[y][x] === g[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (x = 0; x < n; x++) { var run2 = 1; for (y = 1; y < n; y++) { if (g[y][x] === g[y - 1][x]) { run2++; if (run2 === 5) p += 3; else if (run2 > 5) p++; } else run2 = 1; } }
      for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { var s = g[y][x] + g[y][x + 1] + g[y + 1][x] + g[y + 1][x + 1]; if (s === 0 || s === 4) p += 3; }
      var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (y = 0; y < n; y++) for (x = 0; x <= n - 11; x++) { var ok1 = true, ok2 = true, ok3 = true, ok4 = true; for (var k = 0; k < 11; k++) { if (g[y][x + k] !== pat[k]) ok1 = false; if (g[y][x + k] !== pat2[k]) ok2 = false; if (g[x + k][y] !== pat[k]) ok3 = false; if (g[x + k][y] !== pat2[k]) ok4 = false; } p += (ok1 + ok2 + ok3 + ok4) * 40; }
      var dark = 0; for (y = 0; y < n; y++) for (x = 0; x < n; x++) dark += g[y][x];
      var ratio = Math.abs(dark * 100 / (n * n) - 50) / 5; p += Math.floor(ratio) * 10;
      return p;
    }
    var best = null, bestP = 1e9;
    for (var mk = 0; mk < 8; mk++) { var cand = applyMask(mk), pe = penalty(cand); if (pe < bestP) { bestP = pe; best = cand; } }
    return best;
  }
  function svg(text, size, level) {
    var g = matrix(text, level), n = g.length, q = 2, s = n + q * 2, path = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (g[y][x]) path += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + (size || 220) + '" height="' + (size || 220) + '" shape-rendering="crispEdges"><rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + path + '" fill="#111"/></svg>';
  }
  var api = { matrix: matrix, svg: svg, encode: encode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QR = api;
})(typeof self !== 'undefined' ? self : this);
