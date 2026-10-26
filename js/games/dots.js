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
        var wrap = document.createElement('div'); wrap.className = 'db-wrap';
        var scores = document.createElement('div'); scores.className = 'db-scores';
        var canvas = document.createElement('canvas'); canvas.className = 'db-canvas';
        var hint = document.createElement('div'); hint.className = 'db-hint';
        wrap.appendChild(scores); wrap.appendChild(canvas); wrap.appendChild(hint); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.db-wrap{max-width:min(100%,560px);margin:0 auto}.db-canvas{display:block;width:100%;border-radius:14px;background:#f4efe3;box-shadow:0 8px 24px rgba(0,0,0,.35);touch-action:manipulation;cursor:pointer}' +
          '.db-scores{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px}.db-score{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:14px}' +
          '.db-score i{width:14px;height:14px;border-radius:50%;background:var(--pc);display:inline-block}.db-score.on{box-shadow:0 0 0 2px var(--pc)}.db-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.8}';
        el.appendChild(style);
        var view = null, info = null, geo = null, hover = null;
        function layout(v) {
          var cssW = Math.max(280, Math.min(el.clientWidth || 320, 560)), dpr = window.devicePixelRatio || 1;
          var pad = cssW * 0.06, cell = (cssW - 2 * pad) / v.w, cssH = pad * 2 + cell * v.h;
          canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
          canvas.style.height = cssH + 'px';
          geo = { pad: pad, cell: cell, dpr: dpr, w: cssW, h: cssH };
        }
        function edgeAt(x, y) {
          if (!geo || !view) return null;
          var best = null, bd = geo.cell * 0.4, r, c, d;
          for (r = 0; r <= view.h; r++) for (c = 0; c < view.w; c++) {
            d = Math.hypot(x - (geo.pad + (c + 0.5) * geo.cell), y - (geo.pad + r * geo.cell));
            if (d < bd) { bd = d; best = { h: r * view.w + c }; }
          }
          for (r = 0; r < view.h; r++) for (c = 0; c <= view.w; c++) {
            d = Math.hypot(x - (geo.pad + c * geo.cell), y - (geo.pad + (r + 0.5) * geo.cell));
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
        function draw() {
          if (!view || !geo) return;
          var ctx = canvas.getContext('2d'), v = view, g = geo, r, c, i;
          ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
          ctx.clearRect(0, 0, g.w, g.h);
          /* Owned boxes first, as soft colour fills. */
          for (i = 0; i < v.owner.length; i++) if (v.owner[i] >= 0) {
            r = Math.floor(i / v.w); c = i % v.w;
            ctx.fillStyle = info.colors[v.owner[i]]; ctx.globalAlpha = 0.45;
            ctx.fillRect(g.pad + c * g.cell + 2, g.pad + r * g.cell + 2, g.cell - 4, g.cell - 4);
            ctx.globalAlpha = 1;
          }
          /* The hovered edge as a faint preview. */
          if (hover) { ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = Math.max(3, g.cell * 0.12); ctx.lineCap = 'round'; strokeEdge(ctx, hover); }
          /* Drawn edges in the colour of whoever drew them, the last one brighter. */
          ctx.lineWidth = Math.max(3, g.cell * 0.12); ctx.lineCap = 'round';
          for (i = 0; i < v.hl.length; i++) if (v.hl[i] >= 0) { ctx.strokeStyle = info.colors[v.hl[i]]; ctx.globalAlpha = v.last && v.last.h === i ? 1 : 0.8; strokeEdge(ctx, { h: i }); }
          for (i = 0; i < v.vl.length; i++) if (v.vl[i] >= 0) { ctx.strokeStyle = info.colors[v.vl[i]]; ctx.globalAlpha = v.last && v.last.v === i ? 1 : 0.8; strokeEdge(ctx, { v: i }); }
          ctx.globalAlpha = 1;
          /* The dots on top. */
          ctx.fillStyle = '#2b2622';
          for (r = 0; r <= v.h; r++) for (c = 0; c <= v.w; c++) { ctx.beginPath(); ctx.arc(g.pad + c * g.cell, g.pad + r * g.cell, Math.max(3, g.cell * 0.1), 0, Math.PI * 2); ctx.fill(); }
        }
        function strokeEdge(ctx, a) {
          var g = geo, v = view, r, c;
          ctx.beginPath();
          if (a.h != null) { r = Math.floor(a.h / v.w); c = a.h % v.w; ctx.moveTo(g.pad + c * g.cell, g.pad + r * g.cell); ctx.lineTo(g.pad + (c + 1) * g.cell, g.pad + r * g.cell); }
          else { r = Math.floor(a.v / (v.w + 1)); c = a.v % (v.w + 1); ctx.moveTo(g.pad + c * g.cell, g.pad + r * g.cell); ctx.lineTo(g.pad + c * g.cell, g.pad + (r + 1) * g.cell); }
          ctx.stroke();
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
              d.innerHTML = '<i></i>' + inf.names[p] + ': ' + api.t('boxes', v.score[p]);
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
