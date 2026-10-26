/* Leiterspiel / Snakes and Ladders: 100 squares, eight ladders, eight snakes, one die. The move is forced, so the
   only action is the roll; the goal must be hit exactly and a six rolls again. Follows docs/CONTRACT.md. */
(function (root) {
  'use strict';
  var GOAL = 100;
  /* The classic positions: the foot of a ladder leads to its top, the head of a snake to its tail. */
  var LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91 };
  var SNAKES = { 16: 6, 47: 26, 49: 11, 62: 19, 64: 60, 87: 24, 93: 73, 98: 78 };
  var DOTS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function nextPlayer(s, p) {
    var q = p;
    do { q = (q + 1) % s.n; } while (s.arrived.indexOf(q) >= 0 && q !== p);
    return q;
  }
  /* Square 1 is bottom left, the rows snake back and forth (boustrophedon); returns [column, row from the top]. */
  function cellOf(k) {
    var row = Math.floor((k - 1) / 10), col = (k - 1) % 10;
    if (row % 2 === 1) col = 9 - col;
    return [col, 9 - row];
  }
  var G = {
    id: 'snakes',
    name: { de: 'Leiterspiel', en: 'Snakes and Ladders' },
    blurb: { de: 'Leitern hoch, Schlangen runter, wer zuerst auf 100 steht.', en: 'Up the ladders, down the snakes, first to 100.' },
    icon: '🪜',
    counts: [2, 3, 4, 5, 6],
    ai: true,
    hidden: false,
    strings: {
      de: {
        roll: 'Würfeln', rollHint: 'Du bist dran, würfle', start: 'Start', goal: 'Ziel', again: 'Eine Sechs, noch einmal', stay: 'Zu viel, {0} bleibt stehen',
        ladder: 'Leiter hoch auf {0}', snake: 'Schlange runter auf {0}', arrived: '{0} ist im Ziel',
        rules: 'Alle starten vor Feld 1 und würfeln abwechselnd mit einem Würfel. Wer am Fuß einer Leiter landet, klettert zu ihrem oberen Ende; wer auf einem Schlangenkopf landet, rutscht zum Schwanz hinunter. Eine Sechs erlaubt einen weiteren Wurf. Feld 100 muss genau getroffen werden, wer zu viel würfelt, bleibt stehen. Die Reihenfolge der Ankunft ergibt die Plätze; das Spiel endet, wenn nur noch einer unterwegs ist.'
      },
      en: {
        roll: 'Roll', rollHint: 'Your turn, roll the die', start: 'Start', goal: 'Goal', again: 'A six, roll again', stay: 'Too many, {0} stays put',
        ladder: 'Up the ladder to {0}', snake: 'Down the snake to {0}', arrived: '{0} has arrived',
        rules: 'Everyone starts before square 1 and takes turns rolling one die. Landing at the foot of a ladder takes you to its top; landing on the head of a snake slides you down to its tail. A six grants another roll. Square 100 has to be hit exactly, a roll that is too high leaves you where you are. The order of arrival gives the places; the game ends when only one player is still on the way.'
      }
    },
    create: function (cfg) {
      var pos = [];
      for (var p = 0; p < cfg.n; p++) pos.push(0);
      return { n: cfg.n, pos: pos, turn: 0, die: 0, arrived: [], last: null };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) { return s.turn === p && !G.over(s) ? [{ roll: true }] : []; },
    apply: function (s, p, a, rng) {
      var next = JSON.parse(JSON.stringify(s)), v = 1 + rng.int(6), from = s.pos[p], to = from + v, via = -1, ev = [{ e: 'dice', v: v }];
      next.die = v;
      if (to > GOAL) {
        ev.push({ e: 'stay', p: p, at: from });
        next.last = { p: p, from: from, to: from, via: -1 };
      } else {
        if (LADDERS[to]) { via = to; to = LADDERS[to]; ev.push({ e: 'ladder', p: p, from: via, to: to }); }
        else if (SNAKES[to]) { via = to; to = SNAKES[to]; ev.push({ e: 'snake', p: p, from: via, to: to }); }
        next.pos[p] = to;
        next.last = { p: p, from: from, to: to, via: via };
        ev.push({ e: 'move', p: p, from: from, to: to });
        if (to === GOAL) { next.arrived.push(p); ev.push({ e: 'arrive', p: p, place: next.arrived.length }); }
      }
      if (v === 6 && next.pos[p] !== GOAL) ev.push({ e: 'again', p: p });
      else next.turn = nextPlayer(next, p);
      return { state: next, events: ev };
    },
    over: function (s) {
      var need = s.n === 2 ? 1 : s.n - 1;
      if (s.arrived.length < need) return null;
      var rest = [];
      for (var p = 0; p < s.n; p++) if (s.arrived.indexOf(p) < 0) rest.push(p);
      rest.sort(function (a, b) { return s.pos[b] - s.pos[a] || a - b; });
      var ranking = s.arrived.concat(rest);
      return { winner: ranking[0], ranking: ranking };
    },
    ai: function (s, p) { return G.actions(s, p).length ? { roll: true } : null; },
    ui: {
      mount: function (el, api) {
        var wrap = document.createElement('div'); wrap.className = 'sl';
        var board = document.createElement('div'); board.className = 'sl-board';
        var canvas = document.createElement('canvas'); canvas.className = 'sl-canvas';
        var startLane = document.createElement('div'); startLane.className = 'sl-lane'; startLane.textContent = api.t('start');
        var side = document.createElement('div'); side.className = 'sl-side';
        var die = document.createElement('div'); die.className = 'sl-die';
        for (var k = 0; k < 9; k++) die.appendChild(document.createElement('i'));
        var btn = document.createElement('button'); btn.className = 'sl-btn'; btn.textContent = api.t('roll');
        var hint = document.createElement('div'); hint.className = 'sl-hint';
        side.appendChild(die); side.appendChild(btn); side.appendChild(hint);
        wrap.appendChild(board); wrap.appendChild(side); el.appendChild(wrap);
        var style = document.createElement('style');
        /* The board is ten rows of squares plus a start lane below, so one row is 100 / 10.8 percent of the height. */
        var RH = 100 / 10.8;
        style.textContent = '.sl{display:flex;flex-direction:column;align-items:center;gap:14px}' +
          '.sl-board{position:relative;width:min(100%,540px);aspect-ratio:10/10.8;background:#e8dcc0;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35)}' +
          '.sl-sq{position:absolute;width:10%;height:' + RH + '%;box-sizing:border-box;border:1px solid rgba(0,0,0,.08);font-size:11px;padding:2px 4px;color:rgba(0,0,0,.6);font-weight:600}' +
          '.sl-sq.a{background:#f7efd9}.sl-sq.b{background:#e3d4ac}.sl-sq.goal{background:#ffd76a}' +
          '.sl-canvas{position:absolute;left:0;top:0;width:100%;height:' + (RH * 10) + '%;pointer-events:none}' +
          '.sl-lane{position:absolute;left:0;top:' + (RH * 10) + '%;width:100%;height:' + (RH * 0.8) + '%;background:#cdbd93;font-size:12px;font-weight:600;color:rgba(0,0,0,.55);display:flex;align-items:center;padding-left:8px;box-sizing:border-box}' +
          '.sl-piece{position:absolute;width:5%;aspect-ratio:1;border-radius:50%;background:var(--pc);box-shadow:inset -2px -3px 0 rgba(0,0,0,.3),inset 2px 2px 0 rgba(255,255,255,.35),0 2px 4px rgba(0,0,0,.45);transition:left .45s ease,top .45s ease;z-index:2;box-sizing:border-box}' +
          '.sl-piece.turn{outline:3px solid #fff;z-index:3}' +
          '.sl-side{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center}' +
          '.sl-die{width:64px;height:64px;border-radius:12px;background:#fff;display:grid;grid-template-columns:repeat(3,1fr);padding:9px;gap:4px;box-sizing:border-box;box-shadow:0 0 0 3px var(--turn,#888),0 4px 10px rgba(0,0,0,.3)}' +
          '.sl-die i{border-radius:50%;background:#222;display:block;visibility:hidden}.sl-die.rolling{animation:slRoll .6s ease}' +
          '@keyframes slRoll{0%{transform:rotate(0) scale(1)}50%{transform:rotate(200deg) scale(1.25)}100%{transform:rotate(360deg) scale(1)}}' +
          '.sl-btn{padding:10px 22px;border-radius:999px;border:0;font-size:16px;font-weight:600;cursor:pointer;background:#2456c8;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.3)}' +
          '.sl-hint{width:100%;text-align:center;font-size:14px;opacity:.85}';
        el.appendChild(style);
        for (var sq = 1; sq <= GOAL; sq++) {
          var cr = cellOf(sq), d = document.createElement('div');
          d.className = 'sl-sq ' + ((cr[0] + cr[1]) % 2 ? 'b' : 'a') + (sq === GOAL ? ' goal' : '');
          d.style.left = (cr[0] * 10) + '%'; d.style.top = (cr[1] * RH) + '%'; d.textContent = sq;
          board.appendChild(d);
        }
        board.appendChild(canvas); board.appendChild(startLane);
        /* The centre of a square in pixels of the drawn board, used by the canvas. */
        function centre(sq, w) { var cr = cellOf(sq), c = w / 10; return { x: (cr[0] + 0.5) * c, y: (cr[1] + 0.5) * c }; }
        function drawBoard() {
          var w = board.clientWidth || 360, c = w / 10, dpr = window.devicePixelRatio || 1, ctx;
          if (!w) return;
          canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
          ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          Object.keys(LADDERS).forEach(function (k) {
            var a = centre(+k, w), b = centre(LADDERS[k], w), dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
            var nx = -dy / len * c * 0.17, ny = dx / len * c * 0.17, steps = Math.max(2, Math.round(len / (c * 0.45))), i, t;
            ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(3, c * 0.09);
            ctx.beginPath(); ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny); ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(b.x - nx, b.y - ny); ctx.stroke();
            ctx.strokeStyle = '#c98a3e'; ctx.lineWidth = Math.max(2, c * 0.07); ctx.beginPath();
            for (i = 1; i < steps; i++) { t = i / steps; ctx.moveTo(a.x + dx * t + nx, a.y + dy * t + ny); ctx.lineTo(a.x + dx * t - nx, a.y + dy * t - ny); }
            ctx.stroke();
          });
          Object.keys(SNAKES).forEach(function (k, idx) {
            var h = centre(+k, w), t = centre(SNAKES[k], w), dx = t.x - h.x, dy = t.y - h.y, len = Math.sqrt(dx * dx + dy * dy);
            var nx = -dy / len, ny = dx / len, pts = [], i, u, amp, px, py, waves = Math.max(1.5, len / c * 0.6);
            for (i = 0; i <= 40; i++) { u = i / 40; amp = Math.sin(u * Math.PI * waves) * c * 0.35 * (1 - u * 0.3); pts.push([h.x + dx * u + nx * amp, h.y + dy * u + ny * amp]); }
            var colors = [['#2f7d3a', '#1b4f23'], ['#7a3fa0', '#4a2463'], ['#c0532b', '#7a2f14'], ['#2b6fb3', '#173f6b']][idx % 4];
            [[colors[1], 0.3], [colors[0], 0.2]].forEach(function (layer) {
              ctx.strokeStyle = layer[0]; ctx.beginPath();
              for (i = 0; i < pts.length; i++) { ctx.lineWidth = c * layer[1] * (1 - i / pts.length * 0.75); if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]); else { ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); } }
            });
            ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(h.x, h.y, c * 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(h.x - c * 0.07, h.y - c * 0.06, c * 0.05, 0, Math.PI * 2); ctx.arc(h.x + c * 0.07, h.y - c * 0.06, c * 0.05, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(h.x - c * 0.07, h.y - c * 0.06, c * 0.02, 0, Math.PI * 2); ctx.arc(h.x + c * 0.07, h.y - c * 0.06, c * 0.02, 0, Math.PI * 2); ctx.fill();
          });
        }
        var pieceEls = [], view = null, info = null, timer = null, ro = null;
        /* Where a piece sits, in percent of the board: on its square with a small offset per player, or in the lane. */
        function placePiece(node, sq, p, n) {
          var PW = 5, PH = PW / 1.08, cx, cy;
          if (sq === 0) { cx = 100 - (n - p) * 6.5; cy = RH * 10.4; }
          else { var cr = cellOf(sq); cx = cr[0] * 10 + 5 + ((p % 3) - 1) * 2.4; cy = cr[1] * RH + RH / 2 + (Math.floor(p / 3) - 0.5) * 2.2 + 0.6; }
          node.style.left = (cx - PW / 2) + '%'; node.style.top = (cy - PH / 2) + '%';
        }
        function showDie(v) { for (var k = 0; k < 9; k++) die.children[k].style.visibility = v && DOTS[v].indexOf(k) >= 0 ? 'visible' : 'hidden'; }
        btn.onclick = function () { if (info && info.canAct && G.actions(view, info.me).length) api.act({ roll: true }); };
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(drawBoard); ro.observe(board); } else window.addEventListener('resize', drawBoard);
        drawBoard();
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), p, node, ev = inf.events || [], moved = null;
            if (!pieceEls.length) {
              for (p = 0; p < v.n; p++) {
                node = document.createElement('div'); node.className = 'sl-piece'; node.style.setProperty('--pc', inf.colors[p]);
                node.title = inf.names[p]; board.appendChild(node); pieceEls.push(node);
              }
            }
            if (timer) { clearTimeout(timer); timer = null; }
            ev.forEach(function (e) { if (e.e === 'move') moved = e; });
            for (p = 0; p < v.n; p++) {
              node = pieceEls[p];
              node.classList.toggle('turn', !ov && p === v.turn);
              if (moved && moved.p === p && v.last && v.last.via > 0) {
                /* First onto the foot or head, then along the ladder or snake. */
                placePiece(node, v.last.via, p, v.n);
                (function (nd, pp) { timer = setTimeout(function () { placePiece(nd, v.last.to, pp, v.n); timer = null; }, 500); })(node, p);
              } else placePiece(node, v.pos[p], p, v.n);
            }
            if (ev.some(function (e) { return e.e === 'dice'; })) {
              die.classList.remove('rolling'); void die.offsetWidth; die.classList.add('rolling'); api.sound('dice');
            }
            showDie(v.die);
            if (ev.some(function (e) { return e.e === 'arrive'; })) api.sound('win');
            else if (ev.some(function (e) { return e.e === 'snake'; })) api.sound('lose');
            else if (moved) api.sound('move');
            ev.forEach(function (e) {
              if (e.e === 'ladder') api.toast(api.t('ladder', e.to));
              else if (e.e === 'snake') api.toast(api.t('snake', e.to));
              else if (e.e === 'stay') api.toast(api.t('stay', inf.names[e.p]));
              else if (e.e === 'arrive') api.toast(api.t('arrived', inf.names[e.p]));
            });
            var canRoll = inf.canAct && !ov && G.actions(v, inf.me).length > 0;
            btn.style.display = canRoll ? '' : 'none';
            if (ov) hint.textContent = api.t('wins', inf.names[ov.winner]);
            else if (canRoll) hint.textContent = ev.some(function (e) { return e.e === 'again' && e.p === inf.me; }) ? api.t('again') : api.t('rollHint');
            else hint.textContent = api.t('wait', inf.names[v.turn]);
            die.style.setProperty('--turn', ov ? '#888' : inf.colors[v.turn]);
          },
          destroy: function () {
            if (ro) ro.disconnect(); else window.removeEventListener('resize', drawBoard);
            if (timer) clearTimeout(timer);
            el.innerHTML = '';
          }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
