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
      de: { drop: 'Spalte antippen, um einen Stein fallen zu lassen', full: 'Diese Spalte ist voll', rules: 'Abwechselnd fällt ein Stein in eine Spalte. Wer zuerst vier Steine in einer Reihe hat, waagerecht, senkrecht oder schräg, gewinnt. Ist das Brett voll, endet es unentschieden.' },
      en: { drop: 'Tap a column to drop a disc', full: 'That column is full', rules: 'Players take turns dropping a disc into a column. The first to line up four discs, across, down or diagonally, wins. A full board is a draw.' }
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
        var board = document.createElement('div'); board.className = 'c4-board';
        var hint = document.createElement('div'); hint.className = 'c4-hint'; hint.textContent = api.t('drop');
        el.appendChild(board); el.appendChild(hint);
        var cellsEl = [], view = null, info = null;
        for (var r = ROWS - 1; r >= 0; r--) for (var c = 0; c < COLS; c++) {
          var d = document.createElement('div'); d.className = 'c4-cell'; d.dataset.col = c; d.dataset.i = r * COLS + c;
          d.onclick = function (ev) { if (!info || !info.canAct) return; var col = +ev.currentTarget.dataset.col; if (view.cells[(ROWS - 1) * COLS + col] >= 0) { api.toast(api.t('full')); return; } api.act({ col: col }); };
          board.appendChild(d); cellsEl[r * COLS + c] = d;
        }
        var style = document.createElement('style');
        style.textContent = '.c4-board{display:grid;grid-template-columns:repeat(7,1fr);gap:4%;padding:4%;background:#2456c8;border-radius:14px;box-shadow:inset 0 0 0 3px #173e9a,0 8px 24px rgba(0,0,0,.35);max-width:min(100%,520px);margin:0 auto;aspect-ratio:7/6}' +
          '.c4-cell{aspect-ratio:1;border-radius:50%;background:#0b1a3a;box-shadow:inset 0 3px 8px rgba(0,0,0,.6);position:relative;cursor:pointer}' +
          '.c4-cell i{position:absolute;inset:8%;border-radius:50%;background:var(--pc);box-shadow:inset -3px -5px 0 rgba(0,0,0,.25),inset 3px 4px 0 rgba(255,255,255,.3);animation:c4drop .3s ease-out}' +
          '.c4-cell.win i{box-shadow:0 0 0 4px #fff,inset -3px -5px 0 rgba(0,0,0,.25)}.c4-cell.last i{outline:2px solid rgba(255,255,255,.7)}' +
          '@keyframes c4drop{from{transform:translateY(-300%)}to{transform:none}}.c4-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.8}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), line = ov && ov.line ? ov.line : [];
            for (var i = 0; i < COLS * ROWS; i++) {
              var p = v.cells[i], d = cellsEl[i];
              d.innerHTML = p >= 0 ? '<i style="--pc:' + inf.colors[p] + '"></i>' : '';
              d.classList.toggle('win', line.indexOf(i) >= 0); d.classList.toggle('last', i === v.last);
            }
            board.style.cursor = inf.canAct ? 'pointer' : 'default';
            hint.textContent = ov ? '' : inf.canAct ? api.t('drop') : api.t('wait', inf.names[v.turn]);
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
