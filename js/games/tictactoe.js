/* Tic-tac-toe: three by three, three in a row wins. The rules, a perfect minimax AI at the hard level and a DOM
   board with big tappable cells (see docs/CONTRACT.md). */
(function (root) {
  'use strict';
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function winner(cells) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i], v = cells[l[0]];
      if (v >= 0 && v === cells[l[1]] && v === cells[l[2]]) return { p: v, line: l };
    }
    return null;
  }
  function empties(cells) { var out = []; for (var i = 0; i < 9; i++) if (cells[i] < 0) out.push(i); return out; }
  /* The cell that completes a line for player q, or -1 when there is none. */
  function winningCell(cells, q) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i], mine = 0, free = -1;
      for (var k = 0; k < 3; k++) { var v = cells[l[k]]; if (v === q) mine++; else if (v < 0) free = l[k]; }
      if (mine === 2 && free >= 0) return free;
    }
    return -1;
  }
  /* Full minimax from the view of player me; wins are better when they come sooner. */
  function minimax(cells, p, me, depth) {
    var w = winner(cells);
    if (w) return w.p === me ? 10 - depth : depth - 10;
    var free = empties(cells);
    if (!free.length) return 0;
    var best = p === me ? -100 : 100;
    for (var i = 0; i < free.length; i++) {
      cells[free[i]] = p;
      var v = minimax(cells, 1 - p, me, depth + 1);
      cells[free[i]] = -1;
      if (p === me ? v > best : v < best) best = v;
    }
    return best;
  }
  var G = {
    id: 'tictactoe',
    name: { de: 'Tic Tac Toe', en: 'Tic-tac-toe' },
    blurb: { de: 'Drei in einer Reihe auf neun Feldern.', en: 'Three in a row on nine squares.' },
    icon: '❌',
    counts: [2],
    ai: true,
    hidden: false,
    strings: {
      de: {
        tap: 'Feld antippen', taken: 'Dieses Feld ist schon besetzt', plays: '{0} spielt {1}',
        rules: 'Zwei Spieler setzen abwechselnd ihr Zeichen auf ein freies Feld des 3x3-Bretts. Wer zuerst drei eigene Zeichen in einer Reihe hat, waagerecht, senkrecht oder schräg, gewinnt. Sind alle neun Felder belegt, ohne dass jemand eine Reihe hat, endet es unentschieden.'
      },
      en: {
        tap: 'Tap a square', taken: 'That square is taken', plays: '{0} plays {1}',
        rules: 'Two players take turns marking a free square on the 3x3 board. The first to get three of their marks in a row, across, down or diagonally, wins. When all nine squares are filled without a line the game is a draw.'
      }
    },
    create: function () { return { cells: [-1, -1, -1, -1, -1, -1, -1, -1, -1], turn: 0, moves: 0, last: -1 }; },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      return empties(s.cells).map(function (i) { return { at: i }; });
    },
    apply: function (s, p, a) {
      var cells = s.cells.slice();
      cells[a.at] = p;
      var w = winner(cells);
      var next = { cells: cells, turn: 1 - p, moves: s.moves + 1, last: a.at };
      return { state: next, events: [{ e: 'mark', at: a.at, p: p }].concat(w ? [{ e: 'win', line: w.line }] : []) };
    },
    over: function (s) {
      var w = winner(s.cells);
      if (w) return { winner: w.p, line: w.line };
      if (s.moves >= 9) return { winner: -1 };
      return null;
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (level === 1) return rng.pick(acts);
      var win = winningCell(s.cells, p);
      if (win >= 0) return { at: win };
      var block = winningCell(s.cells, 1 - p);
      if (block >= 0) return { at: block };
      if (level === 2) return rng.pick(acts);
      var cells = s.cells.slice(), bestV = -1000, best = [];
      for (var i = 0; i < acts.length; i++) {
        cells[acts[i].at] = p;
        var v = minimax(cells, 1 - p, p, 1);
        cells[acts[i].at] = -1;
        if (v > bestV) { bestV = v; best = [acts[i]]; } else if (v === bestV) best.push(acts[i]);
      }
      return rng.pick(best);
    },
    ui: {
      mount: function (el, api) {
        var board = document.createElement('div'); board.className = 'ttt-board';
        var hint = document.createElement('div'); hint.className = 'ttt-hint';
        el.appendChild(board); el.appendChild(hint);
        var cellsEl = [], view = null, info = null, marks = ['X', 'O'];
        for (var i = 0; i < 9; i++) {
          var d = document.createElement('div'); d.className = 'ttt-cell'; d.dataset.i = i;
          d.onclick = function (ev) {
            if (!info || !info.canAct) return;
            var at = +ev.currentTarget.dataset.i;
            if (view.cells[at] >= 0) { api.toast(api.t('taken')); return; }
            api.act({ at: at });
          };
          board.appendChild(d); cellsEl.push(d);
        }
        var style = document.createElement('style');
        style.textContent = '.ttt-board{display:grid;grid-template-columns:repeat(3,1fr);gap:3%;padding:3%;background:#1e2a3a;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:min(100%,420px);margin:0 auto;aspect-ratio:1}' +
          '.ttt-cell{display:flex;align-items:center;justify-content:center;background:#0e1724;border-radius:12px;cursor:pointer;font-weight:800;font-size:min(18vw,90px);line-height:1;user-select:none;transition:background .15s}' +
          '.ttt-cell:hover{background:#15223a}.ttt-cell span{color:var(--pc);animation:tttpop .2s ease-out}.ttt-cell.last span{text-shadow:0 0 12px var(--pc)}' +
          '.ttt-cell.win{background:#2a3b22;box-shadow:inset 0 0 0 3px #fff}' +
          '@keyframes tttpop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}.ttt-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.8}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), line = ov && ov.line ? ov.line : [];
            for (var i = 0; i < 9; i++) {
              var p = v.cells[i], d = cellsEl[i];
              d.innerHTML = p >= 0 ? '<span style="--pc:' + inf.colors[p] + '">' + marks[p] + '</span>' : '';
              d.classList.toggle('win', line.indexOf(i) >= 0);
              d.classList.toggle('last', i === v.last);
            }
            board.style.cursor = inf.canAct ? 'pointer' : 'default';
            if (ov) hint.textContent = ov.winner >= 0 ? api.t('wins', inf.names[ov.winner]) : api.t('draw');
            else hint.textContent = inf.canAct ? api.t('tap') + ' (' + api.t('plays', inf.names[v.turn], marks[v.turn]) + ')' : api.t('wait', inf.names[v.turn]);
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
