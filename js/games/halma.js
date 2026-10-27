/* Sternhalma / Chinese Checkers: the six pointed star board with 121 fields in cube coordinates, ten pieces per
   player, a single step or a chain of jumps per move, the opposite corner as the goal. Rules, a distance based AI
   and a canvas board, following docs/CONTRACT.md. */
(function (root) {
  'use strict';
  var DIRS = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
  /* The star is the union of two large triangles; every cell is [x, y, z] with x + y + z = 0. */
  var CELLS = [], KEY = {};
  (function () {
    for (var x = -8; x <= 8; x++) for (var y = -8; y <= 8; y++) {
      var z = -x - y;
      if ((x >= -4 && y >= -4 && z >= -4) || (x <= 4 && y <= 4 && z <= 4)) { KEY[x + ',' + y + ',' + z] = CELLS.length; CELLS.push([x, y, z]); }
    }
  })();
  var N = CELLS.length;
  var NEIGH = CELLS.map(function (c) {
    return DIRS.map(function (d) { var k = KEY[(c[0] + d[0]) + ',' + (c[1] + d[1]) + ',' + (c[2] + d[2])]; return k === undefined ? -1 : k; });
  });
  /* The six corners clockwise from the top, each marked by an axis and a sign: the ten cells with that coordinate
     at five or beyond, the tip at eight. The corner opposite to k is k + 3. */
  var CORNER_DEF = [[2, -1], [0, 1], [1, -1], [2, 1], [0, -1], [1, 1]];
  var CORNER_OF = CELLS.map(function () { return -1; });
  var CORNERS = CORNER_DEF.map(function (def, k) {
    var cells = [], tip = -1;
    CELLS.forEach(function (c, i) { if (c[def[0]] * def[1] >= 5) { cells.push(i); CORNER_OF[i] = k; if (c[def[0]] * def[1] === 8) tip = i; } });
    return { cells: cells, tip: tip };
  });
  function hexDist(i, j) { var a = CELLS[i], b = CELLS[j]; return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
  var DIST = CELLS.map(function (c, i) { return CELLS.map(function (d, j) { return hexDist(i, j); }); });
  var TIPDIST = CORNERS.map(function (k) { return DIST[k.tip]; });
  var SEATS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
  function targetOf(seat) { return (seat + 3) % 6; }
  /* Every field a piece may reach from here: the free neighbours by a step, and every landing of a chain of jumps
     over single pieces of any colour; the chain may stop anywhere but never returns to the origin. */
  function landings(board, from) {
    var out = [], seen = {}, stack = [from], b = board.slice(), d, nb, land, i;
    b[from] = -1; seen[from] = true;
    for (d = 0; d < 6; d++) { nb = NEIGH[from][d]; if (nb >= 0 && b[nb] < 0 && !seen[nb]) { seen[nb] = true; out.push(nb); } }
    while (stack.length) {
      i = stack.pop();
      for (d = 0; d < 6; d++) {
        nb = NEIGH[i][d];
        if (nb < 0 || b[nb] < 0) continue;
        land = NEIGH[nb][d];
        if (land < 0 || b[land] >= 0 || seen[land]) continue;
        seen[land] = true; out.push(land); stack.push(land);
      }
    }
    return out.sort(function (a, c) { return a - c; });
  }
  function moves(board, p) {
    var out = [];
    for (var i = 0; i < N; i++) if (board[i] === p) landings(board, i).forEach(function (to) { out.push({ from: i, to: to }); });
    return out;
  }
  function finished(board, p, seat) {
    var cells = CORNERS[targetOf(seat)].cells;
    for (var k = 0; k < cells.length; k++) if (board[cells[k]] !== p) return false;
    return true;
  }
  function distSum(board, p, seat) { var td = TIPDIST[targetOf(seat)], sum = 0; for (var i = 0; i < N; i++) if (board[i] === p) sum += td[i]; return sum; }
  /* The evaluation for one player: the summed distance to the target tip, a penalty for the piece left furthest
     behind, guidance towards the nearest free target field for pieces still outside, and a penalty for sitting in a
     corner another player needs. Higher is better. */
  function evaluate(board, p, seats) {
    var seat = seats[p], tgt = targetOf(seat), td = TIPDIST[tgt], cells = CORNERS[tgt].cells, sum = 0, worst = 0, foreign = 0, outside = [], free = [], guide = 0, i, k, best, c, q;
    var others = [];
    for (q = 0; q < seats.length; q++) if (q !== p) others.push(targetOf(seats[q]));
    for (i = 0; i < N; i++) if (board[i] === p) {
      sum += td[i];
      if (td[i] > worst) worst = td[i];
      if (td[i] > 3) outside.push(i);
      c = CORNER_OF[i];
      if (c >= 0 && c !== tgt && others.indexOf(c) >= 0) foreign++;
    }
    for (k = 0; k < cells.length; k++) if (board[cells[k]] < 0) free.push(cells[k]);
    for (i = 0; i < outside.length; i++) {
      best = 99;
      for (k = 0; k < free.length; k++) if (DIST[outside[i]][free[k]] < best) best = DIST[outside[i]][free[k]];
      if (best < 99) guide += best;
    }
    return -(sum * 10 + worst * 5 + guide * 2 + foreign * 6);
  }
  function after(board, p, a) { var b = board.slice(); b[a.to] = p; b[a.from] = -1; return b; }
  /* The best gain the player could make with one more move on this board, used by the hard level as a look ahead. */
  function bestGain(board, p, seats) {
    var base = evaluate(board, p, seats), best = -1e9, ms = moves(board, p), i, g;
    for (i = 0; i < ms.length; i++) { g = evaluate(after(board, p, ms[i]), p, seats) - base; if (g > best) best = g; }
    return best > -1e9 ? best : 0;
  }
  var G = {
    id: 'halma',
    name: { de: 'Sternhalma', en: 'Chinese Checkers' },
    blurb: { de: 'Zehn Steine über den Stern in die gegenüberliegende Spitze bringen.', en: 'Bring ten pieces across the star to the opposite point.' },
    icon: '⭐',
    counts: [2, 3, 4, 6],
    ai: true,
    hidden: false,
    strings: {
      de: {
        pick: 'Tippe einen deiner Steine an', dest: 'Tippe ein markiertes Feld an', nomove: 'Kein Zug möglich', pass: 'Weiter', finished: '{0} hat alle Steine im Ziel',
        rules: 'Jeder Spieler hat zehn Steine in einer Spitze des Sterns und muss sie in die gegenüberliegende Spitze bringen. Ein Zug ist entweder ein Schritt auf ein freies Nachbarfeld oder eine Kette von Sprüngen über jeweils einen beliebigen Stein, eigene wie fremde, auf das freie Feld dahinter; die Kette darf an jeder Stelle enden. Wer zuerst alle zehn Steine in der Zielspitze hat, gewinnt, die anderen werden nach ihrem Abstand zum Ziel platziert.'
      },
      en: {
        pick: 'Tap one of your pieces', dest: 'Tap a highlighted field', nomove: 'No move possible', pass: 'Continue', finished: '{0} has brought every piece home',
        rules: 'Each player has ten pieces in one point of the star and has to bring them to the opposite point. A move is either a step onto a free neighbouring field or a chain of jumps, each over a single piece of any colour onto the free field behind it; the chain may stop anywhere along the way. The first player with all ten pieces in the target point wins, the others are placed by their distance to the goal.'
      }
    },
    create: function (cfg) {
      var n = cfg.n, seats = SEATS[n].slice(), board = [], p, k;
      for (k = 0; k < N; k++) board.push(-1);
      for (p = 0; p < n; p++) CORNERS[seats[p]].cells.forEach(function (i) { board[i] = p; });
      return { n: n, seats: seats, board: board, turn: 0, finished: [], last: null };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      var ms = moves(s.board, p);
      return ms.length ? ms : [{ pass: true }];
    },
    apply: function (s, p, a) {
      var next = JSON.parse(JSON.stringify(s)), ev = [], q;
      if (!a.pass) {
        next.board[a.to] = p; next.board[a.from] = -1;
        next.last = { p: p, from: a.from, to: a.to };
        ev.push({ e: 'move', p: p, from: a.from, to: a.to, jump: DIST[a.from][a.to] > 1 });
        if (finished(next.board, p, s.seats[p])) { next.finished.push(p); ev.push({ e: 'finish', p: p, place: next.finished.length }); }
      }
      q = p;
      do { q = (q + 1) % s.n; } while (next.finished.indexOf(q) >= 0 && q !== p);
      next.turn = q;
      return { state: next, events: ev };
    },
    over: function (s) {
      if (!s.finished.length) return null;
      var rest = [], p;
      for (p = 0; p < s.n; p++) if (s.finished.indexOf(p) < 0) rest.push(p);
      rest.sort(function (a, b) { return distSum(s.board, a, s.seats[a]) - distSum(s.board, b, s.seats[b]) || a - b; });
      var ranking = s.finished.concat(rest);
      return { winner: ranking[0], ranking: ranking };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (acts[0].pass) return acts[0];
      var base = evaluate(s.board, p, s.seats), scored = [], i, b, g, good, best, bv;
      for (i = 0; i < acts.length; i++) {
        b = after(s.board, p, acts[i]);
        g = evaluate(b, p, s.seats) - base;
        if (level === 3) g += 0.5 * bestGain(b, p, s.seats);
        /* Undoing the own last move leads nowhere, so it is only taken when nothing else is left. */
        if (s.last && s.last.p === p && s.last.from === acts[i].to && s.last.to === acts[i].from) g -= 100;
        scored.push({ a: acts[i], g: g });
      }
      if (level === 1) {
        good = scored.filter(function (x) { return x.g > 0; });
        if (good.length) return rng.pick(good).a;
      }
      best = null; bv = -1e9;
      for (i = 0; i < scored.length; i++) {
        g = scored[i].g + rng.next() * (level === 2 ? 4 : 0.5);
        if (g > bv) { bv = g; best = scored[i].a; }
      }
      return best;
    },
    ui: {
      mount: function (el, api) {
        var Gfx = root.Gfx;
        var wrap = document.createElement('div'); wrap.className = 'hm';
        var board = document.createElement('div'); board.className = 'hm-board gfx-wood';
        var base = document.createElement('canvas'); base.className = 'hm-canvas';
        var over = document.createElement('canvas'); over.className = 'hm-canvas';
        var hint = document.createElement('div'); hint.className = 'hm-hint';
        var btn = document.createElement('button'); btn.className = 'hm-btn'; btn.type = 'button'; btn.textContent = api.t('pass'); btn.style.display = 'none';
        board.appendChild(base); board.appendChild(over);
        wrap.appendChild(board); wrap.appendChild(btn); wrap.appendChild(hint); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.hm{display:flex;flex-direction:column;align-items:center;gap:10px}' +
          '.hm{width:100%;min-width:0}.hm-board{position:relative;width:min(100%,612px);aspect-ratio:100/113;border:6px solid #5a3a20;border-image:linear-gradient(135deg,#8a5a36,#4e2d16 40%,#6b3f20 60%,#3a2010) 1;border-radius:3px;box-shadow:0 12px 30px rgba(0,0,0,.5),inset 0 0 40px rgba(0,0,0,.25);touch-action:manipulation;cursor:pointer}' +
          '.hm-canvas{position:absolute;left:0;top:0;display:block}' +
          '.hm-marble{position:absolute;pointer-events:none;transition:left .16s ease-in-out,top .16s ease-in-out,transform .18s ease;z-index:2;isolation:isolate}' +
          '.hm-marble svg{width:100%;height:100%;display:block;overflow:visible}' +
          '.hm-marble.hm-sel{z-index:6;transform:translateY(-22%) scale(1.12)}' +
          '.hm-marble.hm-sel:before{content:"";position:absolute;left:5%;width:90%;top:70%;height:36%;border-radius:50%;z-index:-1;background:radial-gradient(ellipse at center,rgba(0,0,0,.5),rgba(0,0,0,.25) 50%,transparent 72%)}' +
          '.hm-marble.hm-hop{z-index:8;animation:hmHop var(--hop,160ms) ease-in-out}' +
          '@keyframes hmHop{0%{transform:translateY(0) scale(1)}50%{transform:translateY(-45%) scale(1.22)}100%{transform:translateY(0) scale(1)}}' +
          '.hm-hint{text-align:center;font-size:14px;opacity:.85;min-height:1.4em}' +
          '.hm-btn{min-height:44px;padding:0 26px;border-radius:999px;border:0;font-size:16px;font-weight:700;cursor:pointer;background:#2456c8;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.35)}';
        el.appendChild(style);
        var view = null, info = null, sel = -1, acts = [], geom = null, ro = null, marbleAt = {}, timers = [], busyUntil = {};
        function layout() {
          /* The board is sized by CSS (full width up to 600 px, aspect 1 to 1.13); the canvases follow its content box. */
          var W = board.clientWidth || 348, H = board.clientHeight || Math.round(W * 1.13), dpr = window.devicePixelRatio || 1;
          [base, over].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + 'px'; c.style.height = H + 'px'; });
          geom = { W: W, H: H, dpr: dpr, s: W / 23.4, cx: W / 2, cy: H / 2 };
          geom.D = Math.sqrt(3) * geom.s;
        }
        function pt(i) { var c = CELLS[i]; return { x: geom.cx + Math.sqrt(3) * geom.s * (c[0] + c[2] / 2), y: geom.cy + 1.5 * geom.s * c[2] }; }
        function hexToRgba(hex, a) {
          var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
          return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : hex;
        }
        function circle(ctx, q, r) { ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); }
        /* The star outline: the six tips and the six inner corners, scaled a little beyond the outer holes. */
        function starPath(ctx, grow) {
          var k, tips = [], c = { x: geom.cx, y: geom.cy }, v, w, f;
          for (k = 0; k < 6; k++) tips.push(pt(CORNERS[k].tip));
          f = 1 + grow * geom.D / Math.sqrt(Math.pow(tips[0].x - c.x, 2) + Math.pow(tips[0].y - c.y, 2));
          ctx.beginPath();
          for (k = 0; k < 6; k++) {
            v = tips[k]; w = tips[(k + 1) % 6];
            if (k === 0) ctx.moveTo(c.x + (v.x - c.x) * f, c.y + (v.y - c.y) * f); else ctx.lineTo(c.x + (v.x - c.x) * f, c.y + (v.y - c.y) * f);
            ctx.lineTo(c.x + ((v.x - c.x) + (w.x - c.x)) / 3 * f, c.y + ((v.y - c.y) + (w.y - c.y)) / 3 * f);
          }
          ctx.closePath();
        }
        /* The board itself, drawn once per layout: the star carved a shade darker with a soft inner shadow, the
           holes as dimples with a dark upper rim and a light lower rim, and painted rings on the corner holes in
           the players' colours. */
        function drawBase() {
          if (!geom || !view) return;
          var ctx = base.getContext('2d'), D = geom.D, i, q, r = D * 0.23, corner, homeOf = [], tgt6 = [], p, g, col;
          for (p = 0; p < view.n; p++) { homeOf[view.seats[p]] = p; tgt6[targetOf(view.seats[p])] = p; }
          ctx.setTransform(geom.dpr, 0, 0, geom.dpr, 0, 0);
          ctx.clearRect(0, 0, geom.W, geom.H);
          ctx.save(); starPath(ctx, 0.95); ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.fill();
          ctx.clip(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = D * 0.5; ctx.shadowOffsetY = D * 0.12; ctx.lineWidth = D * 0.3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; starPath(ctx, 1.08); ctx.stroke(); ctx.restore();
          ctx.save(); starPath(ctx, 0.95); ctx.strokeStyle = 'rgba(255,220,170,.22)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
          for (i = 0; i < N; i++) {
            q = pt(i); corner = CORNER_OF[i]; col = null;
            if (corner >= 0 && homeOf[corner] !== undefined) col = hexToRgba(info.colors[homeOf[corner]], 0.75);
            else if (corner >= 0 && tgt6[corner] !== undefined) col = hexToRgba(info.colors[tgt6[corner]], 0.3);
            if (col) { ctx.strokeStyle = col; ctx.lineWidth = D * 0.07; circle(ctx, q, r * 1.45); ctx.stroke(); }
            g = ctx.createRadialGradient(q.x, q.y + r * 0.45, r * 0.1, q.x, q.y + r * 0.2, r * 1.15);
            g.addColorStop(0, '#4a2e16'); g.addColorStop(0.7, '#2a180a'); g.addColorStop(1, '#140a03');
            ctx.fillStyle = g; circle(ctx, q, r); ctx.fill();
            ctx.strokeStyle = 'rgba(255,230,190,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.x, q.y, r - 0.3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
          }
        }
        /* The overlay: the last move, the pieces that may move, the holes a selected marble can reach, the turn. */
        function drawOver() {
          if (!geom || !view) return;
          var ctx = over.getContext('2d'), D = geom.D, v = view, inf = info, ov = G.over(v), q;
          ctx.setTransform(geom.dpr, 0, 0, geom.dpr, 0, 0);
          ctx.clearRect(0, 0, geom.W, geom.H);
          if (v.last) {
            ctx.strokeStyle = 'rgba(255,240,200,.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
            circle(ctx, pt(v.last.from), D * 0.3); ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(255,240,200,.6)'; circle(ctx, pt(v.last.to), D * 0.46); ctx.stroke();
          }
          if (inf.canAct && !ov && sel < 0) {
            ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.shadowColor = '#fff'; ctx.shadowBlur = 4;
            acts.forEach(function (a, k) { if (k === 0 || acts[k - 1].from !== a.from) { circle(ctx, pt(a.from), D * 0.46); ctx.stroke(); } });
            ctx.shadowBlur = 0;
          }
          if (sel >= 0) {
            ctx.shadowColor = inf.colors[inf.me]; ctx.shadowBlur = D * 0.35; ctx.lineWidth = D * 0.09; ctx.strokeStyle = hexToRgba(inf.colors[inf.me], 0.9);
            acts.forEach(function (a) { if (a.from === sel) { q = pt(a.to); circle(ctx, q, D * 0.3); ctx.stroke(); } });
            ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.35)';
            acts.forEach(function (a) { if (a.from === sel) { circle(ctx, pt(a.to), D * 0.3); ctx.fill(); } });
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle = ov ? inf.colors[ov.winner] : inf.colors[v.turn];
          circle(ctx, { x: geom.W - 16, y: 16 }, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
        }
        /* The marbles are DOM nodes over the canvas so they can slide and hop; each node sits on one hole. */
        function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
        function pending(key) { return (busyUntil[key] || 0) > Date.now(); }
        function at(key, t, fn) { later(fn, Math.max(0, t - Date.now())); if (t > (busyUntil[key] || 0)) busyUntil[key] = t; }
        function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
        function placeMarble(node, i, instant) {
          var q = pt(i), w = geom.D * 0.92;
          if (instant) node.style.transition = 'none';
          node.style.width = w + 'px'; node.style.height = w + 'px';
          node.style.left = (q.x - w / 2) + 'px'; node.style.top = (q.y - w / 2) + 'px';
          if (instant) { void node.offsetWidth; node.style.transition = ''; }
        }
        function makeMarble(p, i) {
          var node = document.createElement('div'); node.className = 'hm-marble'; node.dataset.p = p;
          node.innerHTML = Gfx.marble(info.colors[p], 40); board.appendChild(node); marbleAt[i] = node; placeMarble(node, i, true);
          return node;
        }
        function rebuildMarbles() {
          Object.keys(marbleAt).forEach(function (k) { if (marbleAt[k].parentNode) marbleAt[k].parentNode.removeChild(marbleAt[k]); });
          marbleAt = {}; busyUntil = {};
          for (var i = 0; i < N; i++) if (view.board[i] >= 0) makeMarble(view.board[i], i);
        }
        function consistent() {
          for (var i = 0; i < N; i++) {
            var m = marbleAt[i];
            if (view.board[i] < 0 ? !!m : (!m || +m.dataset.p !== view.board[i])) return false;
          }
          return true;
        }
        /* The chain of jumps the piece took, found by a search over the board before the move; a single step is
           just the two holes. */
        function chain(boardBefore, from, to) {
          if (DIST[from][to] === 1) return [from, to];
          var b = boardBefore.slice(), parent = {}, queue = [from], i, d, nb, land, path;
          b[from] = -1; parent[from] = -1;
          while (queue.length) {
            i = queue.shift();
            if (i === to) break;
            for (d = 0; d < 6; d++) {
              nb = NEIGH[i][d];
              if (nb < 0 || b[nb] < 0) continue;
              land = NEIGH[nb][d];
              if (land < 0 || b[land] >= 0 || parent[land] !== undefined) continue;
              parent[land] = i; queue.push(land);
            }
          }
          if (parent[to] === undefined) return [from, to];
          path = [to]; while (path[0] !== from) path.unshift(parent[path[0]]);
          return path;
        }
        function animateMove(e) {
          var node = marbleAt[e.from], before = view.board.slice(), path, t0, per = 170, key;
          if (!node) return false;
          before[e.from] = e.p; before[e.to] = -1;
          path = chain(before, e.from, e.to);
          delete marbleAt[e.from]; marbleAt[e.to] = node;
          key = 'm' + e.from + '-' + e.to; t0 = Date.now();
          node.style.setProperty('--hop', per + 'ms');
          path.forEach(function (cell, idx) {
            if (idx === 0) return;
            at(key, t0 + (idx - 1) * per, function () { placeMarble(node, cell); restart(node, 'hm-hop'); });
          });
          at(key, t0 + (path.length - 1) * per + 20, function () { node.classList.remove('hm-hop'); });
          return true;
        }
        function nearest(x, y) {
          var best = -1, bd = 1e9, i, q, d;
          for (i = 0; i < N; i++) { q = pt(i); d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y); if (d < bd) { bd = d; best = i; } }
          return bd <= Math.pow(geom.D * 0.5, 2) ? best : -1;
        }
        function markSel() { Object.keys(marbleAt).forEach(function (k) { marbleAt[k].classList.toggle('hm-sel', +k === sel); }); }
        board.onclick = function (ev) {
          if (!view || !info || !info.canAct || G.over(view)) return;
          var rect = board.getBoundingClientRect(), i = nearest(ev.clientX - rect.left, ev.clientY - rect.top);
          if (i < 0) return;
          if (sel >= 0 && acts.some(function (a) { return a.from === sel && a.to === i; })) { var a = { from: sel, to: i }; sel = -1; markSel(); api.act(a); return; }
          if (view.board[i] === info.me && acts.some(function (a) { return a.from === i; })) { sel = sel === i ? -1 : i; }
          else { if (sel >= 0) sel = -1; else api.sound('wrong'); }
          markSel(); drawOver(); setHint();
        };
        btn.onclick = function () { if (info && info.canAct && acts.length && acts[0].pass) api.act({ pass: true }); };
        function setHint() {
          var v = view, inf = info, ov = G.over(v);
          if (ov) hint.textContent = api.t('wins', inf.names[ov.winner]);
          else if (!inf.canAct) hint.textContent = api.t('wait', inf.names[v.turn]);
          else if (acts.length && acts[0].pass) hint.textContent = api.t('nomove');
          else hint.textContent = sel >= 0 ? api.t('dest') : api.t('pick');
          btn.style.display = inf.canAct && !ov && acts.length && acts[0].pass ? '' : 'none';
        }
        function relayout() {
          layout();
          if (!view) return;
          drawBase(); drawOver();
          Object.keys(marbleAt).forEach(function (k) { placeMarble(marbleAt[k], +k, true); });
        }
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(relayout); ro.observe(board); } else window.addEventListener('resize', relayout);
        layout();
        return {
          update: function (v, inf) {
            var first = !view, fast = root.App && root.App.fast, moved = null;
            view = v; info = inf; sel = -1;
            var ov = G.over(v), ev = inf.events || [];
            acts = inf.canAct && !ov ? G.actions(v, inf.me) : [];
            if (first) drawBase();
            ev.forEach(function (e) { if (e.e === 'move') moved = e; });
            if (!first && !fast && moved) animateMove(moved);
            if (!consistent()) rebuildMarbles();
            markSel();
            if (ev.some(function (e) { return e.e === 'finish'; })) api.sound('win');
            else if (moved) api.sound('move');
            ev.forEach(function (e) { if (e.e === 'finish') api.toast(api.t('finished', inf.names[e.p])); });
            drawOver(); setHint();
          },
          destroy: function () {
            if (ro) ro.disconnect(); else window.removeEventListener('resize', relayout);
            timers.forEach(clearTimeout);
            el.innerHTML = '';
          }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
