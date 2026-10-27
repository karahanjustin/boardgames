/* Tic-tac-toe: three by three, three in a row wins. The rules, a perfect minimax AI at the hard level and a chalkboard
   with chalk strokes for the marks (see docs/CONTRACT.md). */
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
        var Gfx = root.Gfx;
        function div(cls, parent) { var d = document.createElement('div'); d.className = cls; if (parent) parent.appendChild(d); return d; }
        /* A chalkboard in a wooden frame: the grid, the marks and the winning line are chalk strokes in one SVG,
           a wooden chalk tray below holds a stick of chalk per player, the current player's one is picked up. */
        var wrap = div('ttt', el), frame = div('ttt-frame gfx-frame', wrap), slate = div('ttt-slate', frame), svgHost = div('ttt-svg', slate), grid = div('ttt-grid', slate);
        var tray = div('ttt-tray gfx-wood', frame), chalks = [div('ttt-chalk', tray), div('ttt-chalk', tray)];
        var hint = div('ttt-hint', wrap);
        var cellsEl = [], view = null, info = null, marks = ['X', 'O'], drawn = {}, lineDrawn = false, i;
        for (i = 0; i < 9; i++) {
          var d = div('ttt-cell', grid); d.dataset.i = i;
          d.onclick = function (ev) {
            if (!info || !info.canAct) return;
            var at = +ev.currentTarget.dataset.i;
            if (view.cells[at] >= 0) { api.toast(api.t('taken')); return; }
            api.act({ at: at });
          };
          cellsEl.push(d);
        }
        var style = document.createElement('style');
        style.textContent = '.ttt{width:0;min-width:100%}.ttt-frame{max-width:440px;margin:0 auto;border-radius:4px}' +
          '.ttt-slate{position:relative;aspect-ratio:1;background-color:#2e4a3d;background-image:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.07),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(255,255,255,.05),transparent 50%),' + Gfx.noise(13, '#2e4a3d', '0.8', 3) + ';box-shadow:inset 0 0 40px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.4)}' +
          '.ttt-svg{position:absolute;inset:0}.ttt-svg svg{display:block;width:100%;height:100%}' +
          '.ttt-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}.ttt-cell{cursor:pointer;-webkit-tap-highlight-color:transparent}' +
          '.ttt-stroke{fill:none;stroke-linecap:round;stroke-linejoin:round}' +
          '.ttt-anim{stroke-dasharray:1;stroke-dashoffset:1;animation:tttdraw .38s ease-out forwards}' +
          '@keyframes tttdraw{to{stroke-dashoffset:0}}' +
          '.ttt-tray{position:relative;height:30px;margin-top:6px;border-radius:2px;box-shadow:inset 0 3px 6px rgba(0,0,0,.5),0 -1px 0 rgba(0,0,0,.4)}' +
          '.ttt-chalk{position:absolute;top:9px;width:46px;height:11px;border-radius:3px;transition:transform .25s,box-shadow .25s;box-shadow:0 2px 3px rgba(0,0,0,.6)}' +
          '.ttt-chalk.on{transform:translateY(-7px) rotate(-8deg);box-shadow:0 6px 10px rgba(0,0,0,.6),0 0 10px rgba(255,255,255,.35)}' +
          '.ttt-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.85}';
        el.appendChild(style);
        /* A deterministic wobble per stroke, so a redraw keeps the same chalk marks. */
        function jit(seed, amp) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return ((x - Math.floor(x)) - 0.5) * 2 * amp; }
        function chalk(color) { return Gfx.shade(color, 0.3); }
        function stroke(d, color, w, cls, delay) {
          var s = 'stroke="' + color + '" class="ttt-stroke ' + cls + '" pathLength="1" style="animation-delay:' + delay + 's"';
          return '<path d="' + d + '" ' + s + ' stroke-width="' + (w * 1.6) + '" opacity=".22"/>' +
            '<path d="' + d + '" ' + s + ' stroke-width="' + w + '" opacity=".92"/>';
        }
        function cellCentre(c) { return { x: 50 + (c % 3) * 100, y: 50 + Math.floor(c / 3) * 100 }; }
        function markPath(c, p, anim) {
          var o = cellCentre(c), r = 28, s, col = chalk(info.colors[p]), a = anim ? 'ttt-anim' : '';
          if (p === 0) {
            var k = c * 4;
            s = stroke('M' + (o.x - r + jit(k, 3)) + ' ' + (o.y - r + jit(k + 1, 3)) + ' Q' + (o.x + jit(k + 2, 6)) + ' ' + (o.y + jit(k + 3, 6)) + ' ' + (o.x + r + jit(k + 4, 3)) + ' ' + (o.y + r + jit(k + 5, 3)), col, 7, a, 0);
            s += stroke('M' + (o.x + r + jit(k + 6, 3)) + ' ' + (o.y - r + jit(k + 7, 3)) + ' Q' + (o.x + jit(k + 8, 6)) + ' ' + (o.y + jit(k + 9, 6)) + ' ' + (o.x - r + jit(k + 10, 3)) + ' ' + (o.y + r + jit(k + 11, 3)), col, 7, a, anim ? 0.28 : 0);
            return s;
          }
          var a0 = -1.9 + jit(c * 9, 0.3), a1 = a0 + 6.0, rx = r + jit(c * 9 + 1, 2), ry = r + jit(c * 9 + 2, 2);
          var x0 = o.x + rx * Math.cos(a0), y0 = o.y + ry * Math.sin(a0), x1 = o.x + rx * Math.cos(a1), y1 = o.y + ry * Math.sin(a1);
          var mid = a0 + 3.0, xm = o.x + rx * Math.cos(mid), ym = o.y + ry * Math.sin(mid);
          return stroke('M' + x0 + ' ' + y0 + ' A' + rx + ' ' + ry + ' 0 0 1 ' + xm + ' ' + ym + ' A' + rx + ' ' + ry + ' 0 0 1 ' + x1 + ' ' + y1, col, 7, a, 0);
        }
        function draw(newMarks, newLine) {
          var v = view, ov = G.over(v), s, c;
          s = '<svg viewBox="0 0 300 300"><defs><filter id="tttchalk" x="-10%" y="-10%" width="120%" height="120%">' +
            '<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="5" result="g"/>' +
            '<feColorMatrix in="g" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 2.4 -0.55" result="m"/>' +
            '<feComposite in="SourceGraphic" in2="m" operator="in" result="t"/>' +
            '<feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="9" result="w"/>' +
            '<feDisplacementMap in="t" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#tttchalk)">';
          var white = '#eef0e6';
          s += stroke('M' + (100 + jit(1, 2)) + ' 12 Q' + (100 + jit(2, 4)) + ' 150 ' + (100 + jit(3, 2)) + ' 288', white, 3.5, '', 0);
          s += stroke('M' + (200 + jit(4, 2)) + ' 12 Q' + (200 + jit(5, 4)) + ' 150 ' + (200 + jit(6, 2)) + ' 288', white, 3.5, '', 0);
          s += stroke('M12 ' + (100 + jit(7, 2)) + ' Q150 ' + (100 + jit(8, 4)) + ' 288 ' + (100 + jit(9, 2)), white, 3.5, '', 0);
          s += stroke('M12 ' + (200 + jit(10, 2)) + ' Q150 ' + (200 + jit(11, 4)) + ' 288 ' + (200 + jit(12, 2)), white, 3.5, '', 0);
          for (c = 0; c < 9; c++) if (v.cells[c] >= 0) s += markPath(c, v.cells[c], newMarks[c]);
          if (ov && ov.line) {
            var a = cellCentre(ov.line[0]), b = cellCentre(ov.line[2]), dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), ex = dx / len * 22, ey = dy / len * 22;
            s += stroke('M' + (a.x - ex) + ' ' + (a.y - ey) + ' Q' + ((a.x + b.x) / 2 + jit(20, 5)) + ' ' + ((a.y + b.y) / 2 + jit(21, 5)) + ' ' + (b.x + ex) + ' ' + (b.y + ey), white, 6, newLine ? 'ttt-anim' : '', newLine ? 0.55 : 0);
          }
          svgHost.innerHTML = s + '</g></svg>';
        }
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), fast = !!(root.App && root.App.fast), newMarks = {}, c;
            for (c = 0; c < 9; c++) { if (v.cells[c] >= 0 && !drawn[c] && !fast) newMarks[c] = true; drawn[c] = v.cells[c] >= 0; }
            if (v.moves === 0) { drawn = {}; lineDrawn = false; }
            var newLine = !!(ov && ov.line) && !lineDrawn && !fast;
            lineDrawn = !!(ov && ov.line);
            draw(newMarks, newLine);
            for (c = 0; c < 2; c++) {
              var ch = chalks[c], col = chalk(inf.colors[c]);
              ch.style.left = c === 0 ? '22px' : 'auto'; ch.style.right = c === 1 ? '22px' : 'auto';
              ch.style.background = 'linear-gradient(' + Gfx.shade(col, 0.35) + ',' + col + ' 55%,' + Gfx.shade(col, -0.25) + ')';
              ch.classList.toggle('on', !ov && v.turn === c);
            }
            grid.style.cursor = inf.canAct ? 'pointer' : 'default';
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
