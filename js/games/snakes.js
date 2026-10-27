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
        var Gfx = root.Gfx;
        var wrap = document.createElement('div'); wrap.className = 'sl';
        var board = document.createElement('div'); board.className = 'sl-board gfx-paper';
        var canvas = document.createElement('canvas'); canvas.className = 'sl-canvas';
        var startLane = document.createElement('div'); startLane.className = 'sl-lane'; startLane.textContent = api.t('start');
        var side = document.createElement('div'); side.className = 'sl-side';
        var dieBox = document.createElement('button'); dieBox.className = 'sl-die'; dieBox.type = 'button';
        var btn = document.createElement('button'); btn.className = 'sl-btn'; btn.type = 'button'; btn.textContent = api.t('roll');
        var hint = document.createElement('div'); hint.className = 'sl-hint';
        side.appendChild(dieBox); side.appendChild(btn); side.appendChild(hint);
        wrap.appendChild(board); wrap.appendChild(side); el.appendChild(wrap);
        var style = document.createElement('style');
        /* The board is ten rows of squares plus a start lane below, so one row is 100 / 10.8 percent of the height.
           A figure is PW percent of the width wide and PH percent of the height tall (the pawn is 58 by 40). */
        var RH = 100 / 10.8, PW = 5.6, PH = PW * 58 / 40 * 10 / 10.8;
        style.textContent = '.sl{display:flex;flex-direction:column;align-items:center;gap:14px}' +
          '.sl-board{position:relative;width:min(100%,560px);aspect-ratio:10/10.8;border:7px solid #7a4a2a;border-image:linear-gradient(135deg,#a9753f,#6b3f20 40%,#8a5a36 60%,#4e2d16) 1;box-shadow:0 10px 26px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.35)}' +
          '.sl-board>svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}' +
          '.sl-canvas{position:absolute;left:0;top:0;width:100%;height:' + (RH * 10) + '%;pointer-events:none}' +
          '.sl-lane{position:absolute;left:0;top:' + (RH * 10) + '%;width:100%;height:' + (RH * 0.8) + '%;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(70,50,30,.6);display:flex;align-items:center;padding-left:10px;box-sizing:border-box;pointer-events:none}' +
          '.sl-piece{position:absolute;width:' + PW + '%;height:' + PH + '%;transition:left .085s linear,top .085s linear;z-index:2;pointer-events:none}' +
          '.sl-piece svg{width:100%;height:100%;display:block;overflow:visible}' +
          '.sl-piece.sl-slide{transition:left .09s linear,top .09s linear}' +
          '.sl-piece{isolation:isolate}.sl-piece:before{content:"";position:absolute;left:2%;width:96%;top:78%;height:30%;border-radius:50%;z-index:-1;opacity:0;background:radial-gradient(ellipse at center,rgba(255,255,255,.95) 0,var(--pc) 40%,transparent 72%);box-shadow:0 0 8px 2px var(--pc);transition:opacity .2s}' +
          '.sl-piece.sl-turn{z-index:5}.sl-piece.sl-turn:before{opacity:.95;animation:slGlow 1.1s ease-in-out infinite}' +
          '@keyframes slGlow{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}' +
          '.sl-piece.sl-hop{animation:slHop var(--hop,85ms) ease-out}' +
          '@keyframes slHop{0%{transform:translateY(0) scale(1)}45%{transform:translateY(-30%) scale(1.08)}100%{transform:translateY(0) scale(1)}}' +
          '.sl-side{display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center}' +
          '.sl-die{width:84px;height:84px;padding:4px 4px 0;border:0;background:transparent;border-radius:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--turn,#888);transition:box-shadow .3s}' +
          '.sl-die svg{width:70px;height:77px;display:block;transition:transform .05s linear}' +
          '.sl-die.sl-tumble svg{animation:slTumble .35s ease-out}' +
          '@keyframes slTumble{0%{transform:translateY(-40%) rotate(-30deg) scale(1.15)}60%{transform:translateY(8%) rotate(10deg) scale(.95)}100%{transform:translateY(0) rotate(0) scale(1)}}' +
          '.sl-btn{min-height:46px;padding:0 28px;border-radius:999px;border:0;font-size:17px;font-weight:700;cursor:pointer;background:#2456c8;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.25)}' +
          '.sl-btn:active{transform:translateY(1px)}' +
          '.sl-hint{width:100%;text-align:center;font-size:14px;opacity:.85;min-height:1.4em}';
        el.appendChild(style);
        /* The printed squares as an SVG in a 100 by 108 space: two soft tones, a thin print line, the number in the
           corner, the goal in gold, the start lane below. */
        (function () {
          var s = '<svg viewBox="0 0 100 108" xmlns="http://www.w3.org/2000/svg">', sq, cr, x, y, fill;
          for (sq = 1; sq <= GOAL; sq++) {
            cr = cellOf(sq); x = cr[0] * 10; y = cr[1] * 10;
            fill = sq === GOAL ? '#f1c95c' : (cr[0] + cr[1]) % 2 ? '#e4d5ae' : '#f7f0dc';
            s += '<rect x="' + x + '" y="' + y + '" width="10" height="10" fill="' + fill + '" stroke="rgba(80,60,30,.28)" stroke-width="0.25"/>';
            if (sq === GOAL) s += '<path d="M5 1.6 L6 4 L8.5 4.2 L6.6 5.8 L7.2 8.3 L5 7 L2.8 8.3 L3.4 5.8 L1.5 4.2 L4 4 Z" transform="translate(' + x + ',' + (y + 0.8) + ')" fill="rgba(140,90,20,.35)"/>';
            s += '<text x="' + (x + 1.1) + '" y="' + (y + 3.1) + '" font-size="2.7" font-weight="700" font-family="-apple-system,Segoe UI,system-ui,sans-serif" fill="rgba(70,50,30,.72)">' + sq + '</text>';
          }
          s += '<rect x="0" y="100" width="100" height="8" fill="rgba(120,90,50,.22)"/><path d="M0 100 H100" stroke="rgba(80,60,30,.5)" stroke-width="0.4"/>';
          board.innerHTML = s + '</svg>';
        })();
        board.appendChild(canvas); board.appendChild(startLane);
        /* All geometry lives in the 100 by 100 space of the ten rows (one square is 10 units); the canvas scales it
           to pixels, the figures to percent. */
        function centre(sq) { var cr = cellOf(sq); return { x: (cr[0] + 0.5) * 10, y: (cr[1] + 0.5) * 10 }; }
        var SNAKE_COLORS = [['#3d8f3a', '#1f4f1e', '#9bd27a'], ['#7b45a8', '#45245f', '#c9a3e8'], ['#c9552c', '#742c12', '#f3b58a'], ['#2f72b5', '#163b63', '#9cc6ee']];
        var snakes = Object.keys(SNAKES).map(function (k, idx) {
          var h = centre(+k), t = centre(SNAKES[k]), dx = t.x - h.x, dy = t.y - h.y, len = Math.sqrt(dx * dx + dy * dy);
          var nx = -dy / len, ny = dx / len, pts = [], i, u, amp, waves = Math.max(1.5, len / 10 * 0.55), M = 48;
          for (i = 0; i <= M; i++) { u = i / M; amp = Math.sin(u * Math.PI * waves) * 3.4 * (1 - u * 0.35); pts.push([h.x + dx * u + nx * amp, h.y + dy * u + ny * amp]); }
          return { head: +k, pts: pts, colors: SNAKE_COLORS[idx % 4] };
        });
        var ladders = Object.keys(LADDERS).map(function (k) { return { a: centre(+k), b: centre(LADDERS[k]) }; });
        function drawBoard() {
          var w = board.clientWidth || 360, k = w / 100, c = 10, dpr = window.devicePixelRatio || 1, ctx;
          if (!w) return;
          canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
          ctx = canvas.getContext('2d'); ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          /* Ladders: two rails and rungs with a soft shadow underneath. */
          ladders.forEach(function (L) {
            var a = L.a, b = L.b, dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
            var nx = -dy / len * c * 0.17, ny = dx / len * c * 0.17, steps = Math.max(2, Math.round(len / (c * 0.42))), i, t;
            [[0.25, 0.3, 'rgba(0,0,0,.22)', 0.9, 'rgba(0,0,0,.18)'], [0, 0, '#7d4a1f', 0, '#c48a44']].forEach(function (pass, n) {
              var ox = pass[0], oy = pass[1];
              ctx.strokeStyle = pass[2]; ctx.lineWidth = c * (n ? 0.09 : 0.13);
              ctx.beginPath(); ctx.moveTo(a.x + nx + ox, a.y + ny + oy); ctx.lineTo(b.x + nx + ox, b.y + ny + oy); ctx.moveTo(a.x - nx + ox, a.y - ny + oy); ctx.lineTo(b.x - nx + ox, b.y - ny + oy); ctx.stroke();
              ctx.strokeStyle = pass[4]; ctx.lineWidth = c * (n ? 0.065 : 0.1); ctx.beginPath();
              for (i = 1; i < steps; i++) { t = i / steps; ctx.moveTo(a.x + dx * t + nx + ox, a.y + dy * t + ny + oy); ctx.lineTo(a.x + dx * t - nx + ox, a.y + dy * t - ny + oy); }
              ctx.stroke();
            });
            ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = c * 0.025;
            ctx.beginPath(); ctx.moveTo(a.x + nx - 0.25, a.y + ny - 0.25); ctx.lineTo(b.x + nx - 0.25, b.y + ny - 0.25); ctx.moveTo(a.x - nx - 0.25, a.y - ny - 0.25); ctx.lineTo(b.x - nx - 0.25, b.y - ny - 0.25); ctx.stroke();
          });
          /* Snakes: a tapered body with dark bands and a belly sheen, a head with eyes and a forked tongue. */
          snakes.forEach(function (S) {
            var pts = S.pts, n = pts.length, left = [], right = [], i, u, hw, tx, ty, tl, col = S.colors;
            for (i = 0; i < n; i++) {
              u = i / (n - 1);
              tx = pts[Math.min(n - 1, i + 1)][0] - pts[Math.max(0, i - 1)][0]; ty = pts[Math.min(n - 1, i + 1)][1] - pts[Math.max(0, i - 1)][1]; tl = Math.sqrt(tx * tx + ty * ty) || 1;
              hw = c * (0.035 + 0.16 * (1 - u)) * (0.72 + 0.28 * Math.min(1, u / 0.1));
              left.push([pts[i][0] - ty / tl * hw, pts[i][1] + tx / tl * hw]); right.push([pts[i][0] + ty / tl * hw, pts[i][1] - tx / tl * hw]);
            }
            function body(ox, oy) {
              ctx.beginPath(); ctx.moveTo(left[0][0] + ox, left[0][1] + oy);
              for (i = 1; i < n; i++) ctx.lineTo(left[i][0] + ox, left[i][1] + oy);
              for (i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0] + ox, right[i][1] + oy);
              ctx.closePath();
            }
            ctx.fillStyle = 'rgba(0,0,0,.22)'; body(0.3, 0.4); ctx.fill();
            ctx.fillStyle = col[0]; body(0, 0); ctx.fill();
            ctx.save(); ctx.clip();
            ctx.fillStyle = col[1];
            for (i = 3; i < n - 2; i += 3) { ctx.beginPath(); ctx.moveTo(left[i][0], left[i][1]); ctx.lineTo(left[i + 1][0], left[i + 1][1]); ctx.lineTo(right[i + 1][0], right[i + 1][1]); ctx.lineTo(right[i][0], right[i][1]); ctx.closePath(); ctx.fill(); }
            ctx.strokeStyle = col[2]; ctx.globalAlpha = 0.55; ctx.lineWidth = c * 0.05; ctx.beginPath();
            for (i = 1; i < n; i++) { var lx = pts[i][0] * 0.55 + right[i][0] * 0.45, ly = pts[i][1] * 0.55 + right[i][1] * 0.45; if (i === 1) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly); }
            ctx.stroke(); ctx.globalAlpha = 1; ctx.restore();
            ctx.strokeStyle = col[1]; ctx.lineWidth = c * 0.03; body(0, 0); ctx.stroke();
            /* The head faces away from the body. */
            var hx = pts[0][0], hy = pts[0][1], dx = pts[0][0] - pts[3][0], dy = pts[0][1] - pts[3][1], dl = Math.sqrt(dx * dx + dy * dy) || 1, ang = Math.atan2(dy, dx), rx = c * 0.27, ry = c * 0.2;
            ctx.save(); ctx.translate(hx + dx / dl * c * 0.06, hy + dy / dl * c * 0.06); ctx.rotate(ang);
            ctx.strokeStyle = '#d2302a'; ctx.lineWidth = Math.max(0.3, c * 0.035); ctx.beginPath(); ctx.moveTo(rx * 0.8, 0); ctx.lineTo(rx + c * 0.2, 0); ctx.lineTo(rx + c * 0.3, -c * 0.07); ctx.moveTo(rx + c * 0.2, 0); ctx.lineTo(rx + c * 0.3, c * 0.07); ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0.3, 0.4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = col[0]; ctx.strokeStyle = col[1]; ctx.lineWidth = c * 0.03; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = col[2]; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(-rx * 0.1, -ry * 0.3, rx * 0.6, ry * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
            [-1, 1].forEach(function (sgn) {
              ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rx * 0.3, sgn * ry * 0.5, c * 0.065, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(rx * 0.36, sgn * ry * 0.5, c * 0.032, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rx * 0.33, sgn * ry * 0.5 - c * 0.015, c * 0.012, 0, Math.PI * 2); ctx.fill();
            });
            ctx.restore();
          });
        }
        var pieceEls = [], view = null, info = null, timers = [], dieTimers = [], ro = null, busyUntil = {};
        function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
        /* Animations are queued per figure: a new move starts when the figure's pending one has ended, so a six and
           the next roll play one after the other and the host's next update never cuts a slide short. */
        function pending(p) { return (busyUntil[p] || 0) > Date.now(); }
        function startAt(p) { return Math.max(Date.now(), busyUntil[p] || 0); }
        function at(p, t, fn) { later(fn, Math.max(0, t - Date.now())); if (t > (busyUntil[p] || 0)) busyUntil[p] = t; }
        function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
        /* The figure's base centre in percent of the board: the square with a small offset per player, or the lane. */
        function spot(sq, p, n) {
          if (sq === 0) return { x: 100 - (n - p) * 7 - 2, y: RH * 10.55 };
          var c = centre(sq);
          return { x: c.x + ((p % 3) - 1) * 2.6, y: (c.y + 2.2 + (Math.floor(p / 3) - 0.5) * 2.2) * RH / 10 };
        }
        function placeAt(node, x, y, instant) {
          if (instant) node.style.transition = 'none';
          node.style.left = (x - PW / 2) + '%'; node.style.top = (y - PH * 0.93) + '%';
          if (instant) { void node.offsetWidth; node.style.transition = ''; }
        }
        function placePiece(node, sq, p, n, instant) { var q = spot(sq, p, n); placeAt(node, q.x, q.y, instant); }
        /* The figure hops square by square up to the foot or head, then slides up the ladder or down along the
           snake's body. */
        function travel(node, p, n, from, via, to) {
          var t0 = startAt(p), per = 85, k, idx = 0, last = via > 0 ? via : to, S, i;
          at(p, t0, function () { node.style.setProperty('--hop', per + 'ms'); placePiece(node, from, p, n, true); });
          for (k = from + 1; k <= last; k++) (function (sq) { at(p, t0 + 10 + idx * per, function () { placePiece(node, sq, p, n); restart(node, 'sl-hop'); }); idx++; })(k);
          var t1 = t0 + 10 + idx * per + 60;
          if (via > 0) {
            at(p, t1, function () { node.classList.remove('sl-hop'); node.classList.add('sl-slide'); });
            if (SNAKES[via]) {
              S = null; snakes.forEach(function (s) { if (s.head === via) S = s; });
              for (i = 4; i < S.pts.length; i += 4) (function (pt, step) {
                at(p, t1 + step * 90, function () { placeAt(node, pt[0], pt[1] * RH / 10 + 1.5); });
              })(S.pts[i], i / 4);
              at(p, t1 + 12 * 90 + 10, function () { placePiece(node, to, p, n); });
              at(p, t1 + 12 * 90 + 120, function () { node.classList.remove('sl-slide'); });
            } else {
              at(p, t1 + 10, function () { node.style.transition = 'left .55s ease-in-out,top .55s ease-in-out'; placePiece(node, to, p, n); });
              at(p, t1 + 600, function () { node.style.transition = ''; node.classList.remove('sl-slide'); });
            }
          } else at(p, t1, function () { node.classList.remove('sl-hop'); });
        }
        function showDie(v, cls) { dieBox.innerHTML = Gfx.die(v, 70); if (cls) restart(dieBox, cls); }
        function roll() { if (info && info.canAct && view && G.actions(view, info.me).length) api.act({ roll: true }); }
        btn.onclick = roll; dieBox.onclick = roll;
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(drawBoard); ro.observe(board); } else window.addEventListener('resize', drawBoard);
        drawBoard();
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), p, node, ev = inf.events || [], moved = null, fast = root.App && root.App.fast;
            if (!pieceEls.length) {
              for (p = 0; p < v.n; p++) {
                node = document.createElement('div'); node.className = 'sl-piece'; node.style.setProperty('--pc', inf.colors[p]);
                node.innerHTML = Gfx.pawn(inf.colors[p], 40); node.title = inf.names[p]; board.appendChild(node); pieceEls.push(node);
              }
            }
            ev.forEach(function (e) { if (e.e === 'move') moved = e; });
            if (fast) { moved = null; busyUntil = {}; }
            for (p = 0; p < v.n; p++) {
              node = pieceEls[p];
              node.classList.toggle('sl-turn', !ov && p === v.turn);
              if (pending(p)) continue;
              node.classList.remove('sl-hop'); node.classList.remove('sl-slide');
              placePiece(node, moved && moved.p === p ? moved.from : v.pos[p], p, v.n, true);
            }
            if (moved) travel(pieceEls[moved.p], moved.p, v.n, moved.from, v.last ? v.last.via : -1, moved.to);
            dieTimers.forEach(clearTimeout); dieTimers = [];
            if (ev.some(function (e) { return e.e === 'dice'; }) && !fast) {
              /* The die tumbles: seven faces in quick succession, then the value. */
              var faces = 7, f;
              for (f = 0; f < faces; f++) (function (idx) {
                dieTimers.push(setTimeout(function () {
                  if (idx < faces - 1) { showDie(1 + Math.floor(Math.random() * 6)); dieBox.firstChild.style.transform = 'rotate(' + (Math.random() * 50 - 25) + 'deg) scale(' + (1 + Math.random() * 0.1) + ')'; }
                  else showDie(v.die, 'sl-tumble');
                }, idx * 50));
              })(f);
              api.sound('dice');
            } else showDie(v.die);
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
            dieBox.style.setProperty('--turn', ov ? '#888' : inf.colors[v.turn]);
          },
          destroy: function () {
            if (ro) ro.disconnect(); else window.removeEventListener('resize', drawBoard);
            timers.concat(dieTimers).forEach(clearTimeout);
            el.innerHTML = '';
          }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
