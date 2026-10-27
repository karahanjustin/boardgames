/* Vier gewinnt / Connect Four: 7 columns, 6 rows, four in a row wins. The reference game for the contract
   (docs/CONTRACT.md): rules, AI (alpha-beta with a line count evaluation) and a DOM board. */
(function (root) {
  'use strict';
  var COLS = 7, ROWS = 6;
  var LINES = (function () {
    var out = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      [[1, 0], [0, 1], [1, 1], [1, -1]].forEach(function (d) {
        var line = [];
        for (var k = 0; k < 4; k++) { var cc = c + d[0] * k, rr = r + d[1] * k; if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) return; line.push(rr * COLS + cc); }
        out.push(line);
      });
    }
    return out;
  })();
  function winner(cells) {
    for (var i = 0; i < LINES.length; i++) { var l = LINES[i], v = cells[l[0]]; if (v >= 0 && v === cells[l[1]] && v === cells[l[2]] && v === cells[l[3]]) return { p: v, line: l }; }
    return null;
  }
  function drop(cells, col, p) { for (var r = 0; r < ROWS; r++) { var i = r * COLS + col; if (cells[i] < 0) { cells[i] = p; return i; } } return -1; }
  function evaluate(cells, p) {
    var score = 0;
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i], mine = 0, theirs = 0;
      for (var k = 0; k < 4; k++) { var v = cells[l[k]]; if (v === p) mine++; else if (v >= 0) theirs++; }
      if (mine && theirs) continue;
      if (mine === 3) score += 60; else if (mine === 2) score += 8; else if (mine === 1) score += 1;
      if (theirs === 3) score -= 70; else if (theirs === 2) score -= 8; else if (theirs === 1) score -= 1;
    }
    for (var r = 0; r < ROWS; r++) { var cv = cells[r * COLS + 3]; if (cv === p) score += 3; else if (cv >= 0) score -= 3; }
    return score;
  }
  var ORDER = [3, 2, 4, 1, 5, 0, 6];
  function search(cells, p, me, depth, alpha, beta) {
    var w = winner(cells);
    if (w) return w.p === me ? 10000 + depth : -10000 - depth;
    if (depth === 0) return evaluate(cells, me);
    var full = true;
    for (var c = 0; c < COLS; c++) if (cells[(ROWS - 1) * COLS + c] < 0) { full = false; break; }
    if (full) return 0;
    var best = p === me ? -1e9 : 1e9;
    for (var oi = 0; oi < COLS; oi++) {
      var col = ORDER[oi], i = drop(cells, col, p);
      if (i < 0) continue;
      var v = search(cells, 1 - p, me, depth - 1, alpha, beta);
      cells[i] = -1;
      if (p === me) { if (v > best) best = v; if (best > alpha) alpha = best; } else { if (v < best) best = v; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }
  var G = {
    id: 'connect4',
    name: { de: 'Vier gewinnt', en: 'Connect Four' },
    blurb: { de: 'Steine fallen lassen, vier in einer Reihe gewinnen.', en: 'Drop discs, make four in a row.' },
    icon: '🔴',
    counts: [2],
    ai: true,
    hidden: false,
    strings: {
      de: { drop: 'Spalte antippen, um einen Stein fallen zu lassen', full: 'Diese Spalte ist voll', won: '{0} gewinnt', drawn: 'Unentschieden', rules: 'Abwechselnd fällt ein Stein in eine Spalte. Wer zuerst vier Steine in einer Reihe hat, waagerecht, senkrecht oder schräg, gewinnt. Ist das Brett voll, endet es unentschieden.' },
      en: { drop: 'Tap a column to drop a disc', full: 'That column is full', won: '{0} wins', drawn: 'Draw', rules: 'Players take turns dropping a disc into a column. The first to line up four discs, across, down or diagonally, wins. A full board is a draw.' }
    },
    create: function (cfg) { var cells = []; for (var i = 0; i < COLS * ROWS; i++) cells.push(-1); return { cells: cells, turn: 0, last: -1, moves: 0 }; },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      var out = [];
      for (var c = 0; c < COLS; c++) if (s.cells[(ROWS - 1) * COLS + c] < 0) out.push({ col: c });
      return out;
    },
    apply: function (s, p, a) {
      var cells = s.cells.slice(), i = drop(cells, a.col, p);
      var next = { cells: cells, turn: 1 - p, last: i, moves: s.moves + 1 };
      var w = winner(cells);
      return { state: next, events: [{ e: 'drop', at: i, p: p }].concat(w ? [{ e: 'win', line: w.line }] : []) };
    },
    over: function (s) {
      var w = winner(s.cells);
      if (w) return { winner: w.p, line: w.line };
      if (s.moves >= COLS * ROWS) return { winner: -1 };
      return null;
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (level === 1 && rng.next() < 0.35) return rng.pick(acts);
      var depth = level === 1 ? 2 : level === 2 ? 4 : 7, best = null, bv = -1e9;
      acts.forEach(function (a) {
        var cells = s.cells.slice(), i = drop(cells, a.col, p);
        var v = search(cells, 1 - p, p, depth - 1, -1e9, 1e9) + rng.next() * 0.5;
        cells[i] = -1;
        if (v > bv) { bv = v; best = a; }
      });
      return best;
    },
    ui: {
      mount: function (el, api) {
        var Gfx = root.Gfx;
        var wrap = document.createElement('div'); wrap.className = 'c4-wrap';
        var stand = document.createElement('div'); stand.className = 'c4-stand';
        var board = document.createElement('div'); board.className = 'c4-board';
        var back = document.createElement('div'); back.className = 'c4-back';
        var discLayer = document.createElement('div'); discLayer.className = 'c4-grid c4-discs';
        var plate = document.createElement('div'); plate.className = 'c4-grid c4-plate';
        var gloss = document.createElement('div'); gloss.className = 'c4-gloss';
        var cols = document.createElement('div'); cols.className = 'c4-cols';
        var base = document.createElement('div'); base.className = 'c4-base';
        var hint = document.createElement('div'); hint.className = 'c4-hint'; hint.textContent = api.t('drop');
        board.appendChild(back); board.appendChild(discLayer); board.appendChild(plate); board.appendChild(gloss); board.appendChild(cols);
        stand.appendChild(board); stand.appendChild(base);
        wrap.appendChild(stand); wrap.appendChild(hint); el.appendChild(wrap);
        var slots = [], holes = [], discs = [], colEls = [], view = null, info = null, r, c;
        for (r = ROWS - 1; r >= 0; r--) for (c = 0; c < COLS; c++) {
          var s = document.createElement('div'); s.className = 'c4-slot'; discLayer.appendChild(s); slots[r * COLS + c] = s; discs[r * COLS + c] = null;
          var h = document.createElement('div'); h.className = 'c4-hole'; plate.appendChild(h); holes[r * COLS + c] = h;
        }
        for (c = 0; c < COLS; c++) {
          var col = document.createElement('div'); col.className = 'c4-col'; col.dataset.col = c;
          col.onclick = function (ev) {
            if (!info || !info.canAct) return;
            var cc = +ev.currentTarget.dataset.col;
            if (view.cells[(ROWS - 1) * COLS + cc] >= 0) { api.toast(api.t('full')); return; }
            api.act({ col: cc });
          };
          cols.appendChild(col); colEls.push(col);
        }
        /* A counter seen face on: a round disc lit from the top left, a darker rim ring and a small specular highlight. */
        var discId = 0;
        function counter(color) {
          var g = 'c4g' + (++discId), hi = Gfx.shade(color, 0.45), lo = Gfx.shade(color, -0.5), rim = Gfx.shade(color, -0.3);
          return '<svg class="gfx" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="' + g + '" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="' + hi + '"/><stop offset="0.45" stop-color="' + color + '"/><stop offset="1" stop-color="' + lo + '"/></radialGradient></defs>' +
            '<circle cx="20" cy="20" r="19.5" fill="url(#' + g + ')"/>' +
            '<circle cx="20" cy="20" r="17.2" fill="none" stroke="' + rim + '" stroke-width="1.6" opacity="0.75"/>' +
            '<circle cx="20" cy="20" r="14.5" fill="none" stroke="' + Gfx.shade(color, 0.2) + '" stroke-width="0.8" opacity="0.55"/>' +
            '<ellipse cx="14" cy="12" rx="5" ry="3" fill="#fff" opacity="0.45" transform="rotate(-35 14 12)"/></svg>';
        }
        /* Puts a disc of player p into cell i; a new one falls from above the board and bounces once. */
        function setDisc(i, p, fall) {
          var d = discs[i];
          if (p < 0) { if (d) { slots[i].removeChild(d); discs[i] = null; } return; }
          if (d && d.dataset.p === String(p)) return;
          if (d) slots[i].removeChild(d);
          d = document.createElement('div'); d.className = 'c4-disc' + (fall ? ' fall' : ''); d.dataset.p = p;
          d.style.setProperty('--n', ROWS - (i / COLS >> 0) + 0.6);
          d.innerHTML = counter(info.colors[p]);
          slots[i].appendChild(d); discs[i] = d;
        }
        var style = document.createElement('style');
        style.textContent = '.c4-wrap{max-width:min(100%,520px);margin:0 auto;user-select:none}' +
          '.c4-stand{position:relative;padding-bottom:34px}' +
          '.c4-board{position:relative;aspect-ratio:7/6;border-radius:4.5%/5.2%;background:linear-gradient(160deg,#4a84f0,#2a60d8 45%,#1f4fbd 75%,#1a44a8);box-shadow:0 18px 36px rgba(0,0,0,.55),0 2px 0 rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.45),inset 0 -4px 0 rgba(0,0,0,.4),inset 3px 0 0 rgba(255,255,255,.18),inset -3px 0 0 rgba(0,0,0,.28),inset 0 0 0 7px rgba(255,255,255,.06),inset 0 0 0 8px rgba(0,0,0,.14)}' +
          '.c4-back{position:absolute;inset:4.6% 4.2%;border-radius:6px;background:radial-gradient(ellipse at 50% 30%,#162a55,#070e22 85%)}' +
          '.c4-grid{position:absolute;inset:4.6% 4.2%;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(6,1fr)}' +
          '.c4-slot{position:relative}' +
          '.c4-disc{position:absolute;inset:14.5%;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.5)}' +
          '.c4-disc svg{display:block;width:100%;height:100%}' +
          '.c4-disc.fall{animation:c4fall .55s cubic-bezier(.4,0,1,1) both}' +
          '@keyframes c4fall{0%{transform:translateY(calc(var(--n) * -100%))}62%{transform:translateY(0);animation-timing-function:ease-out}80%{transform:translateY(-10%);animation-timing-function:ease-in}100%{transform:translateY(0)}}' +
          '.c4-plate{pointer-events:none}' +
          '.c4-hole{position:relative;background:radial-gradient(circle farthest-side at 50% 50%,transparent 0 77%,rgba(0,0,0,.55) 78% 82%,#1b47ae 84%,#2a60d8 88%,#2a60d8 100%)}' +
          '.c4-hole::before{content:"";position:absolute;inset:10%;border-radius:50%;pointer-events:none;box-shadow:inset 0 4px 7px rgba(0,0,0,.75),inset 0 -1px 2px rgba(255,255,255,.22)}' +
          '.c4-hole::after{content:"";position:absolute;inset:6%;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .2s}' +
          '.c4-hole.last::after{opacity:1;box-shadow:inset 0 0 0 2px rgba(255,255,255,.55)}' +
          '.c4-hole.win::after{opacity:1;inset:9%;box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(255,235,130,.9),0 0 18px 6px rgba(255,240,150,.85);animation:c4win 1s ease-in-out infinite}' +
          '@keyframes c4win{50%{box-shadow:0 0 0 3px rgba(255,255,255,.7),0 0 0 5px rgba(255,235,130,.5),0 0 8px 2px rgba(255,240,150,.5)}}' +
          '.c4-slot.win .c4-disc{animation:c4lit .5s ease-in-out infinite alternate}' +
          '@keyframes c4lit{to{filter:brightness(1.6) saturate(1.2)}}' +
          '.c4-gloss{position:absolute;inset:0;border-radius:4.5%/5.2%;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.38) 0,rgba(255,255,255,.16) 3.5%,rgba(255,255,255,0) 8%),linear-gradient(165deg,rgba(255,255,255,.18),rgba(255,255,255,.04) 35%,rgba(255,255,255,0) 55%,rgba(0,0,0,.08) 100%)}' +
          '.c4-cols{position:absolute;inset:0 4.2%;display:grid;grid-template-columns:repeat(7,1fr)}' +
          '.c4-col{position:relative;border-radius:8px;transition:background .15s}' +
          '.c4-col::before{content:"";position:absolute;left:14%;right:14%;top:-9%;aspect-ratio:1;border-radius:50%;background:var(--pc,#fff);opacity:0;transition:opacity .15s;box-shadow:inset -3px -5px 0 rgba(0,0,0,.25),0 4px 8px rgba(0,0,0,.4)}' +
          '.c4-cols.live .c4-col{cursor:pointer}' +
          '.c4-cols.live .c4-col:hover,.c4-cols.live .c4-col:active{background:rgba(255,255,255,.14)}' +
          '.c4-cols.live .c4-col:hover::before,.c4-cols.live .c4-col:active::before{opacity:.95}' +
          '.c4-base{position:absolute;left:2%;right:2%;bottom:0;height:40px;pointer-events:none}' +
          '.c4-base::before,.c4-base::after{content:"";position:absolute;bottom:0;width:26%;height:40px;background:linear-gradient(90deg,#163a94,#2a60d8 30%,#4a84f0 48%,#2a60d8 66%,#163a94),linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 40%);background-blend-mode:multiply;border-radius:0 0 6px 6px;clip-path:polygon(30% 0,70% 0,100% 100%,0 100%);box-shadow:0 8px 14px rgba(0,0,0,.45),inset 0 -3px 0 rgba(0,0,0,.35)}' +
          '.c4-base::before{left:0}.c4-base::after{right:0}' +
          '.c4-hint{text-align:center;margin-top:12px;font-size:14px;opacity:.85;min-height:18px}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            var prev = view, fast = root.App && root.App.fast, dropped = -1, i;
            view = v; info = inf;
            (inf.events || []).forEach(function (e) { if (e.e === 'drop') dropped = e.at; });
            var ov = G.over(v), line = ov && ov.line ? ov.line : [];
            for (i = 0; i < COLS * ROWS; i++) {
              setDisc(i, v.cells[i], !!prev && !fast && i === dropped);
              holes[i].classList.toggle('win', line.indexOf(i) >= 0);
              slots[i].classList.toggle('win', line.indexOf(i) >= 0);
              holes[i].classList.toggle('last', i === v.last && !line.length);
            }
            cols.classList.toggle('live', !!inf.canAct);
            cols.style.setProperty('--pc', inf.me >= 0 ? inf.colors[inf.me] : '#fff');
            hint.textContent = ov ? (ov.winner < 0 ? api.t('drawn') : api.t('won', inf.names[ov.winner])) : inf.canAct ? api.t('drop') : api.t('wait', inf.names[v.turn]);
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
