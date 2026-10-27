/* Käsekästchen / Dots and Boxes: draw one edge per turn, the fourth side of a box scores it and gives another turn.
   A 6x6 grid for two players, 8x8 for three or four. Rules, a chain counting AI and a canvas board (see
   docs/CONTRACT.md).
   Edges are indexed like this for a board of w by h boxes: horizontal edge h = row * w + col with row 0..h and
   col 0..w-1, vertical edge v = row * (w + 1) + col with row 0..h-1 and col 0..w. Box (row, col) = row * w + col. */
(function (root) {
  'use strict';
  function sizeFor(n) { return n > 2 ? 8 : 6; }
  /* The four edges of a box as { h: [top, bottom], v: [left, right] } indices. */
  function boxEdges(s, b) {
    var row = Math.floor(b / s.w), col = b % s.w;
    return { h: [row * s.w + col, (row + 1) * s.w + col], v: [row * (s.w + 1) + col, row * (s.w + 1) + col + 1] };
  }
  function sides(s, b) {
    var e = boxEdges(s, b), k = 0;
    if (s.hl[e.h[0]] >= 0) k++; if (s.hl[e.h[1]] >= 0) k++; if (s.vl[e.v[0]] >= 0) k++; if (s.vl[e.v[1]] >= 0) k++;
    return k;
  }
  /* The boxes an edge borders (one or two). */
  function boxesOf(s, a) {
    var out = [];
    if (a.h != null) {
      var row = Math.floor(a.h / s.w), col = a.h % s.w;
      if (row > 0) out.push((row - 1) * s.w + col);
      if (row < s.h) out.push(row * s.w + col);
    } else {
      var r2 = Math.floor(a.v / (s.w + 1)), c2 = a.v % (s.w + 1);
      if (c2 > 0) out.push(r2 * s.w + c2 - 1);
      if (c2 < s.w) out.push(r2 * s.w + c2);
    }
    return out;
  }
  function isDrawn(s, a) { return a.h != null ? s.hl[a.h] >= 0 : s.vl[a.v] >= 0; }
  function allFree(s) {
    var out = [], i;
    for (i = 0; i < s.hl.length; i++) if (s.hl[i] < 0) out.push({ h: i });
    for (i = 0; i < s.vl.length; i++) if (s.vl[i] < 0) out.push({ v: i });
    return out;
  }
  /* Draws an edge for player p in place and returns the boxes it closed. */
  function drawEdge(s, p, a) {
    if (a.h != null) s.hl[a.h] = p; else s.vl[a.v] = p;
    var closed = [], bs = boxesOf(s, a);
    for (var i = 0; i < bs.length; i++) if (s.owner[bs[i]] < 0 && sides(s, bs[i]) === 4) { s.owner[bs[i]] = p; s.score[p]++; closed.push(bs[i]); }
    return closed;
  }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  /* How many boxes the edge closes right away. */
  function closes(s, a) {
    var bs = boxesOf(s, a), k = 0;
    for (var i = 0; i < bs.length; i++) if (s.owner[bs[i]] < 0 && sides(s, bs[i]) === 3) k++;
    return k;
  }
  /* Whether the edge leaves a box with exactly three sides, a gift for the next player. */
  function givesAway(s, a) {
    var bs = boxesOf(s, a);
    for (var i = 0; i < bs.length; i++) if (s.owner[bs[i]] < 0 && sides(s, bs[i]) === 2) return true;
    return false;
  }
  /* The number of boxes the next player could take greedily after this edge: the chain the edge opens. */
  function sacrifice(s, p, a) {
    var t = copy(s), count = 0, guard = 0, q = (p + 1) % s.n;
    drawEdge(t, p, a);
    for (;;) {
      var free = allFree(t), found = null;
      for (var i = 0; i < free.length; i++) if (closes(t, free[i]) > 0) { found = free[i]; break; }
      if (!found || guard++ > 200) break;
      count += drawEdge(t, q, found).length;
    }
    return count;
  }
  function ranking(s) {
    var ps = [];
    for (var i = 0; i < s.n; i++) ps.push(i);
    ps.sort(function (a, b) { return s.score[b] - s.score[a] || a - b; });
    return ps;
  }
  var G = {
    id: 'dots',
    name: { de: 'Käsekästchen', en: 'Dots and Boxes' },
    blurb: { de: 'Linien ziehen, Kästchen schließen, die meisten gewinnen.', en: 'Draw lines, close boxes, most boxes win.' },
    icon: '🔲',
    counts: [2, 3, 4],
    ai: true,
    hidden: false,
    strings: {
      de: {
        tap: 'Zwischen zwei Punkten antippen, um eine Linie zu ziehen', drawn: 'Diese Linie ist schon da', again: 'Kästchen geschlossen, noch ein Zug', boxes: '{0} Kästchen', tie: 'Gleichstand',
        rules: 'Die Spieler ziehen abwechselnd eine Linie zwischen zwei benachbarten Punkten. Wer mit seiner Linie die vierte Seite eines Kästchens schließt, bekommt das Kästchen und muss sofort noch einmal ziehen. Sind alle Kästchen vergeben, gewinnt, wer die meisten hat. Zu zweit ist das Feld 6x6 Kästchen groß, zu dritt und zu viert 8x8.'
      },
      en: {
        tap: 'Tap between two dots to draw a line', drawn: 'That line is already drawn', again: 'Box closed, move again', boxes: '{0} boxes', tie: 'Tie',
        rules: 'Players take turns drawing a line between two neighbouring dots. Whoever draws the fourth side of a box takes that box and must move again at once. When every box is taken, the player with the most boxes wins. The grid is 6x6 boxes for two players and 8x8 for three or four.'
      }
    },
    create: function (cfg) {
      var n = cfg.n, w = sizeFor(n), h = w, i;
      var s = { n: n, w: w, h: h, hl: [], vl: [], owner: [], score: [], turn: 0, last: null, free: (h + 1) * w + h * (w + 1) };
      for (i = 0; i < (h + 1) * w; i++) s.hl.push(-1);
      for (i = 0; i < h * (w + 1); i++) s.vl.push(-1);
      for (i = 0; i < w * h; i++) s.owner.push(-1);
      for (i = 0; i < n; i++) s.score.push(0);
      return s;
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      return allFree(s);
    },
    apply: function (s, p, a) {
      var next = copy(s);
      var closed = drawEdge(next, p, a);
      next.free--;
      next.last = a.h != null ? { h: a.h } : { v: a.v };
      if (!closed.length) next.turn = (p + 1) % s.n;
      var events = [{ e: 'line', p: p, h: a.h, v: a.v }];
      for (var i = 0; i < closed.length; i++) events.push({ e: 'box', p: p, at: closed[i] });
      return { state: next, events: events };
    },
    over: function (s) {
      if (s.free > 0) return null;
      var rank = ranking(s), top = rank[0];
      var tied = s.n > 1 && s.score[rank[1]] === s.score[top];
      return { winner: tied ? -1 : top, ranking: rank };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      var taking = [], safe = [], i;
      for (i = 0; i < acts.length; i++) {
        if (closes(s, acts[i]) > 0) taking.push(acts[i]);
        else if (!givesAway(s, acts[i])) safe.push(acts[i]);
      }
      if (level === 1) {
        /* Easy: random, but avoid handing over a box when any other move exists. */
        var ok1 = taking.concat(safe);
        return rng.pick(ok1.length ? ok1 : acts);
      }
      if (taking.length) {
        /* Take the box that also keeps us from opening something: prefer double closes, then random. */
        var two = taking.filter(function (a) { return closes(s, a) === 2; });
        return rng.pick(two.length ? two : taking);
      }
      if (safe.length) return rng.pick(safe);
      if (level === 2) return rng.pick(acts);
      /* Hard: every move opens a chain, so give away the smallest one. */
      var best = [], bestCost = 1e9;
      for (i = 0; i < acts.length; i++) {
        var cost = sacrifice(s, p, acts[i]);
        if (cost < bestCost) { bestCost = cost; best = [acts[i]]; } else if (cost === bestCost) best.push(acts[i]);
      }
      return rng.pick(best);
    },
    ui: {
      mount: function (el, api) {
        /* A sheet of squared paper: light pencil squares, ink dots, the lines as felt pen strokes in the player
           colours with a little wobble, a light wash with the owner's initial in every closed box, and a glow under
           the last line drawn. */
        var wrap = document.createElement('div'); wrap.className = 'db-wrap';
        var scores = document.createElement('div'); scores.className = 'db-scores';
        var canvas = document.createElement('canvas'); canvas.className = 'db-canvas gfx-paper';
        var hint = document.createElement('div'); hint.className = 'db-hint';
        wrap.appendChild(scores); wrap.appendChild(canvas); wrap.appendChild(hint); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.db-wrap{max-width:min(100%,560px);margin:0 auto}' +
          '.db-canvas{display:block;width:100%;border-radius:3px;box-shadow:0 10px 26px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.2),inset 0 0 40px rgba(120,90,40,.08);touch-action:manipulation;cursor:pointer}' +
          '.db-scores{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px}' +
          '.db-score{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.08);font-size:14px;border:2px solid transparent}' +
          '.db-score i{width:20px;height:7px;border-radius:4px;background:var(--pc);display:inline-block;transform:rotate(-8deg);opacity:.9}' +
          '.db-score.on{border-color:var(--pc);background:rgba(255,255,255,.14);box-shadow:0 0 10px var(--pc)}' +
          '.db-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.8}';
        el.appendChild(style);
        var view = null, info = null, geo = null, hover = null;
        var PEN = '"Marker Felt","Chalkboard SE","Comic Sans MS","Segoe Print",cursive';
        /* A deterministic jitter in 0..1 from a seed, so the wobble of a line stays the same on every redraw. */
        function jit(seed) { var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
        function layout(v) {
          var cssW = Math.max(280, Math.min(el.clientWidth || 320, 560)), dpr = window.devicePixelRatio || 1;
          var pad = cssW * 0.08, cell = (cssW - 2 * pad) / v.w, cssH = pad * 2 + cell * v.h;
          canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
          canvas.style.height = cssH + 'px';
          geo = { pad: pad, cell: cell, dpr: dpr, w: cssW, h: cssH };
        }
        function edgeAt(x, y) {
          if (!geo || !view) return null;
          var best = null, bd = geo.cell * 0.4, r, c, d, dx, dy;
          for (r = 0; r <= view.h; r++) for (c = 0; c < view.w; c++) {
            dx = x - (geo.pad + (c + 0.5) * geo.cell); dy = y - (geo.pad + r * geo.cell); d = Math.sqrt(dx * dx + dy * dy);
            if (d < bd) { bd = d; best = { h: r * view.w + c }; }
          }
          for (r = 0; r < view.h; r++) for (c = 0; c <= view.w; c++) {
            dx = x - (geo.pad + c * geo.cell); dy = y - (geo.pad + (r + 0.5) * geo.cell); d = Math.sqrt(dx * dx + dy * dy);
            if (d < bd) { bd = d; best = { v: r * (view.w + 1) + c }; }
          }
          return best;
        }
        function pos(ev) { var b = canvas.getBoundingClientRect(); return { x: (ev.clientX - b.left) * (geo.w / b.width), y: (ev.clientY - b.top) * (geo.h / b.height) }; }
        canvas.onclick = function (ev) {
          if (!info || !info.canAct || !view) return;
          var q = pos(ev), a = edgeAt(q.x, q.y);
          if (!a) return;
          if (isDrawn(view, a)) { api.toast(api.t('drawn')); return; }
          api.act(a);
        };
        canvas.onmousemove = function (ev) { if (!info || !info.canAct) { hover = null; return; } var q = pos(ev); var a = edgeAt(q.x, q.y); hover = a && !isDrawn(view, a) ? a : null; draw(); };
        canvas.onmouseleave = function () { hover = null; draw(); };
        /* The two ends of an edge in canvas coordinates. */
        function ends(a) {
          var g = geo, v = view, r, c;
          if (a.h != null) { r = Math.floor(a.h / v.w); c = a.h % v.w; return [g.pad + c * g.cell, g.pad + r * g.cell, g.pad + (c + 1) * g.cell, g.pad + r * g.cell]; }
          r = Math.floor(a.v / (v.w + 1)); c = a.v % (v.w + 1);
          return [g.pad + c * g.cell, g.pad + r * g.cell, g.pad + c * g.cell, g.pad + (r + 1) * g.cell];
        }
        /* A felt pen stroke: a slightly bowed line with rounded ends, drawn twice like a marker that was gone over. */
        function penStroke(ctx, a, color, alpha, widthK) {
          var e = ends(a), g = geo, seed = a.h != null ? a.h * 2 + 1 : a.v * 2 + 2;
          var mx = (e[0] + e[2]) / 2, my = (e[1] + e[3]) / 2, bow = (jit(seed) - 0.5) * g.cell * 0.09;
          var horizontal = e[1] === e[3], cx = horizontal ? mx : mx + bow, cy = horizontal ? my + bow : my;
          var o1 = (jit(seed + 11) - 0.5) * g.cell * 0.05, o2 = (jit(seed + 23) - 0.5) * g.cell * 0.05;
          ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(3, g.cell * 0.13) * (widthK || 1);
          ctx.beginPath(); ctx.moveTo(e[0] + (horizontal ? -1 : o1), e[1] + (horizontal ? o1 : -1)); ctx.quadraticCurveTo(cx, cy, e[2] + (horizontal ? 1 : o2), e[3] + (horizontal ? o2 : 1)); ctx.stroke();
          ctx.globalAlpha = alpha * 0.55; ctx.lineWidth = ctx.lineWidth * 0.5;
          ctx.beginPath(); ctx.moveTo(e[0] + (horizontal ? 2 : o1 * 0.5), e[1] + (horizontal ? o1 * 0.5 : 2)); ctx.quadraticCurveTo(cx, cy, e[2] - (horizontal ? 2 : -o2 * 0.5), e[3] - (horizontal ? -o2 * 0.5 : 2)); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        function draw() {
          if (!view || !geo) return;
          var ctx = canvas.getContext('2d'), v = view, g = geo, r, c, i, x, y;
          ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
          ctx.clearRect(0, 0, g.w, g.h);
          /* The squares of the paper: a pencil grid at half the pitch of the dots. */
          var step = g.cell / 2, off = g.pad % step;
          ctx.strokeStyle = 'rgba(75,105,175,.22)'; ctx.lineWidth = 1;
          ctx.beginPath();
          for (x = off; x <= g.w + 0.5; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, g.h); }
          for (y = off; y <= g.h + 0.5; y += step) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(g.w, Math.round(y) + 0.5); }
          ctx.stroke();
          /* Closed boxes: a light wash in the owner's colour, slightly uneven like a quick fill, and the initial. */
          for (i = 0; i < v.owner.length; i++) if (v.owner[i] >= 0) {
            r = Math.floor(i / v.w); c = i % v.w;
            var x0 = g.pad + c * g.cell, y0 = g.pad + r * g.cell, m = g.cell * 0.09, col = info.colors[v.owner[i]];
            var j1 = (jit(i * 7 + 1) - 0.5) * m, j2 = (jit(i * 7 + 2) - 0.5) * m, j3 = (jit(i * 7 + 3) - 0.5) * m, j4 = (jit(i * 7 + 4) - 0.5) * m;
            ctx.fillStyle = col; ctx.globalAlpha = 0.26;
            ctx.beginPath();
            ctx.moveTo(x0 + m + j1, y0 + m + j2); ctx.lineTo(x0 + g.cell - m + j3, y0 + m + j1);
            ctx.lineTo(x0 + g.cell - m + j2, y0 + g.cell - m + j4); ctx.lineTo(x0 + m + j4, y0 + g.cell - m + j3);
            ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.9; ctx.fillStyle = col;
            ctx.font = '700 ' + Math.round(g.cell * 0.5) + 'px ' + PEN; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.save(); ctx.translate(x0 + g.cell / 2, y0 + g.cell / 2 + g.cell * 0.03); ctx.rotate((jit(i * 7 + 5) - 0.5) * 0.25);
            ctx.fillText((info.names[v.owner[i]] || '').charAt(0).toUpperCase(), 0, 0); ctx.restore();
            ctx.globalAlpha = 1;
          }
          /* The hovered edge as a faint pencil preview. */
          if (hover) penStroke(ctx, hover, '#555', 0.25, 0.8);
          /* The strokes in the colour of whoever drew them, the last one with a glow beneath. */
          for (i = 0; i < v.hl.length; i++) if (v.hl[i] >= 0 && !(v.last && v.last.h === i)) penStroke(ctx, { h: i }, info.colors[v.hl[i]], 0.85);
          for (i = 0; i < v.vl.length; i++) if (v.vl[i] >= 0 && !(v.last && v.last.v === i)) penStroke(ctx, { v: i }, info.colors[v.vl[i]], 0.85);
          if (v.last) {
            var lp = v.last.h != null ? v.hl[v.last.h] : v.vl[v.last.v];
            if (lp >= 0) { penStroke(ctx, v.last, info.colors[lp], 0.28, 2.6); penStroke(ctx, v.last, info.colors[lp], 1); }
          }
          /* The ink dots on top, each a little uneven. */
          ctx.fillStyle = '#1b1f3a';
          var rad = Math.max(3, g.cell * 0.085);
          for (r = 0; r <= v.h; r++) for (c = 0; c <= v.w; c++) {
            var k = r * (v.w + 1) + c, q = jit(k * 3 + 100);
            ctx.save(); ctx.translate(g.pad + c * g.cell, g.pad + r * g.cell); ctx.rotate(q * Math.PI);
            ctx.beginPath(); ctx.ellipse(0, 0, rad * (1 + q * 0.12), rad * (1 - q * 0.1), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          }
        }
        var onResize = function () { if (view) { layout(view); draw(); } };
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            layout(v); draw();
            scores.innerHTML = '';
            var ov = G.over(v);
            for (var p = 0; p < v.n; p++) {
              var d = document.createElement('div'); d.className = 'db-score' + (!ov && v.turn === p ? ' on' : ''); d.style.setProperty('--pc', inf.colors[p]);
              var pen = document.createElement('i'); d.appendChild(pen);
              d.appendChild(document.createTextNode(inf.names[p] + ': ' + api.t('boxes', v.score[p])));
              scores.appendChild(d);
            }
            if (ov) hint.textContent = ov.winner >= 0 ? api.t('wins', inf.names[ov.winner]) : api.t('tie');
            else if (inf.canAct) { var closedNow = (inf.events || []).some(function (e) { return e.e === 'box' && e.p === v.turn; }); hint.textContent = closedNow ? api.t('again') : api.t('tap'); }
            else hint.textContent = api.t('wait', inf.names[v.turn]);
          },
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
