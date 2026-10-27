/* Domino, the block game with a double six set: 28 tiles, 7 each for two players, 5 for three or four, the rest
   is the boneyard. The highest double starts (or the highest tile). Tiles go on either end of the line; who cannot
   play draws, and passes once the boneyard is empty. The first to empty the hand wins, or, when the game is
   blocked, the lowest pip count. */
(function (root) {
  'use strict';
  var HAND = { 2: 7, 3: 5, 4: 5 };
  function allTiles() { var out = []; for (var a = 0; a <= 6; a++) for (var b = a; b <= 6; b++) out.push([a, b]); return out; }
  function norm(t) { return t[0] <= t[1] ? [t[0], t[1]] : [t[1], t[0]]; }
  function same(a, b) { var x = norm(a), y = norm(b); return x[0] === y[0] && x[1] === y[1]; }
  function indexOfTile(hand, t) { for (var i = 0; i < hand.length; i++) if (same(hand[i], t)) return i; return -1; }
  function pips(hand) { var s = 0; for (var i = 0; i < hand.length; i++) s += hand[i][0] + hand[i][1]; return s; }
  function ends(line) { return line.length ? [line[0][0], line[line.length - 1][1]] : null; }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  /* Every legal placement of a hand against the open ends: the tile in the orientation it is laid, and the end. */
  function plays(hand, line, start) {
    var out = [], i;
    if (!line.length) return start ? [{ play: norm(start), end: 'R' }] : [];
    var e = ends(line), L = e[0], R = e[1];
    for (i = 0; i < hand.length; i++) {
      var a = hand[i][0], b = hand[i][1];
      if (b === L) out.push({ play: [a, b], end: 'L' });
      if (a === L && a !== b) out.push({ play: [b, a], end: 'L' });
      if (a === R) out.push({ play: [a, b], end: 'R' });
      if (b === R && a !== b) out.push({ play: [b, a], end: 'R' });
    }
    return out;
  }
  function nextPlayer(s, p) { return (p + 1) % s.n; }
  function finish(s, winner, blocked) {
    s.over = true; s.winner = winner; s.blocked = blocked; s.turn = -1;
  }
  var G = {
    id: 'domino',
    name: { de: 'Domino', en: 'Dominoes' },
    blurb: { de: 'Steine anlegen, als Erster die Hand leeren.', en: 'Match the ends, be the first to empty your hand.' },
    icon: '🁫',
    counts: [2, 3, 4],
    ai: true,
    hidden: true,
    strings: {
      de: {
        draw: 'Ziehen ({0} im Talon)', pass: 'Passen', boneyard: 'Talon: {0}', tiles: '{0} Steine', tile: '1 Stein', pickTile: 'Stein antippen, dann ein Ende', pickEnd: 'Links oder rechts anlegen?',
        noFit: 'Der Stein passt da nicht', mustDraw: 'Nichts passt: ziehen', mustPass: 'Nichts passt und der Talon ist leer: passen', startWith: 'Der höchste Stein beginnt', left: 'Links', right: 'Rechts',
        blocked: 'Blockiert: die wenigsten Augen gewinnen', won: '{0} hat die Hand geleert', pipsOf: '{0}: {1} Augen', yourHand: 'Deine Steine', passed: '{0} passt',
        rules: 'Doppel-Sechs-Satz mit 28 Steinen. Zu zweit bekommt jeder 7, zu dritt oder viert 5; der Rest ist der Talon. Wer den höchsten Pasch hat (sonst den höchsten Stein), legt ihn hin. Dann legt jeder einen passenden Stein an eines der beiden Enden der Reihe. Wer nicht anlegen kann, zieht aus dem Talon, bis er kann; ist der Talon leer, passt er. Wer zuerst keine Steine mehr hat, gewinnt. Kann niemand mehr anlegen, gewinnt, wer die wenigsten Augen in der Hand hält.'
      },
      en: {
        draw: 'Draw ({0} in the boneyard)', pass: 'Pass', boneyard: 'Boneyard: {0}', tiles: '{0} tiles', tile: '1 tile', pickTile: 'Tap a tile, then an end', pickEnd: 'Lay it left or right?',
        noFit: 'That tile does not fit there', mustDraw: 'Nothing fits: draw', mustPass: 'Nothing fits and the boneyard is empty: pass', startWith: 'The highest tile opens', left: 'Left', right: 'Right',
        blocked: 'Blocked: the fewest pips win', won: '{0} emptied the hand', pipsOf: '{0}: {1} pips', yourHand: 'Your tiles', passed: '{0} passes',
        rules: 'A double six set of 28 tiles. Two players get 7 each, three or four get 5; the rest is the boneyard. Whoever holds the highest double (otherwise the highest tile) sets it. Then each player adds a matching tile to either end of the line. If you cannot play you draw from the boneyard until you can; once it is empty you pass. The first to run out of tiles wins. If nobody can play any more, the fewest pips in hand win.'
      }
    },
    create: function (cfg, rng) {
      var tiles = rng.shuffle(allTiles()), n = cfg.n, per = HAND[n] || 5, s = { n: n, hands: [], boneyard: [], line: [], turn: 0, start: null, passes: 0, missed: [], over: false, winner: -1, blocked: false, last: null }, i, j;
      for (i = 0; i < n; i++) { s.hands.push([]); s.missed.push([false, false, false, false, false, false, false]); }
      for (j = 0; j < per; j++) for (i = 0; i < n; i++) s.hands[i].push(tiles.pop());
      s.boneyard = tiles;
      /* The opener: the highest double, otherwise the heaviest tile (ties by the higher pip). */
      var best = null, who = 0;
      for (i = 0; i < n; i++) for (j = 0; j < s.hands[i].length; j++) {
        var t = s.hands[i][j], dbl = t[0] === t[1], rank = (dbl ? 100 : 0) + (t[0] + t[1]) * 7 + t[1];
        if (best === null || rank > best) { best = rank; who = i; s.start = norm(t); }
      }
      s.turn = who;
      return s;
    },
    current: function (s) { return s.over ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.over || s.turn !== p) return [];
      var pl = plays(s.hands[p], s.line, s.start);
      if (pl.length) return pl;
      return s.boneyard.length ? [{ draw: true }] : [{ pass: true }];
    },
    apply: function (s, p, a) {
      var next = copy(s), ev = [], e = ends(s.line);
      if (a.play) {
        var hand = next.hands[p], i = indexOfTile(hand, a.play);
        hand.splice(i, 1);
        if (a.end === 'L') next.line.unshift([a.play[0], a.play[1]]); else next.line.push([a.play[0], a.play[1]]);
        next.passes = 0; next.last = { p: p, tile: [a.play[0], a.play[1]], end: a.end };
        ev.push({ e: 'play', p: p, tile: [a.play[0], a.play[1]], end: a.end });
        if (!hand.length) { finish(next, p, false); ev.push({ e: 'out', p: p }); }
        else next.turn = nextPlayer(next, p);
      } else if (a.draw) {
        if (e) { next.missed[p][e[0]] = true; next.missed[p][e[1]] = true; }
        next.hands[p].push(next.boneyard.pop());
        ev.push({ e: 'draw', p: p });
      } else {
        if (e) { next.missed[p][e[0]] = true; next.missed[p][e[1]] = true; }
        next.passes = s.passes + 1; next.last = { p: p, pass: true };
        ev.push({ e: 'pass', p: p });
        if (next.passes >= s.n) { finish(next, -1, true); ev.push({ e: 'blocked' }); }
        else next.turn = nextPlayer(next, p);
      }
      return { state: next, events: ev };
    },
    over: function (s) {
      if (!s.over) return null;
      var pp = [], order = [], i;
      for (i = 0; i < s.n; i++) { pp.push(pips(s.hands[i])); order.push(i); }
      order.sort(function (a, b) { if (a === s.winner) return -1; if (b === s.winner) return 1; return pp[a] - pp[b] || a - b; });
      var winner = s.winner >= 0 ? s.winner : (pp[order[0]] < pp[order[1]] ? order[0] : -1);
      return { winner: winner, ranking: order, pips: pp, blocked: s.blocked };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (acts.length === 1 || level === 1) return rng.pick(acts);
      /* The hard player counts: the tiles not on the line and not in its hand are what the others may hold, so an
         open end that few unseen tiles match, or that an opponent has already shown to lack, is hard for them;
         an end it still holds copies of keeps its own next move safe. Pips shed count a little, and a double goes
         out early, since it fits only one number. */
      var unseen = [], hand = s.hands[p], best = null, bv = -1e9, i, k, q, a, b;
      if (level === 3) {
        for (a = 0; a <= 6; a++) for (b = a; b <= 6; b++) {
          var known = false;
          for (k = 0; k < s.line.length && !known; k++) if (same(s.line[k], [a, b])) known = true;
          for (k = 0; k < hand.length && !known; k++) if (same(hand[k], [a, b])) known = true;
          if (!known) unseen.push([a, b]);
        }
      }
      for (i = 0; i < acts.length; i++) {
        var act = acts[i], t = act.play, v = rng.next() * 0.3;
        if (level === 2) { v += t[0] + t[1]; }
        else {
          var line = s.line.slice();
          if (act.end === 'L') line.unshift(t); else line.push(t);
          var e = ends(line), own = 0, un = 0;
          v += 0.5 * (t[0] + t[1]);
          for (q = 0; q < s.n; q++) if (q !== p) { if (s.missed[q][e[0]]) v += 4; if (s.missed[q][e[1]]) v += 4; }
          for (k = 0; k < hand.length; k++) if (!same(hand[k], t)) { if (hand[k][0] === e[0] || hand[k][1] === e[0]) own++; if (hand[k][0] === e[1] || hand[k][1] === e[1]) own++; }
          for (k = 0; k < unseen.length; k++) { if (unseen[k][0] === e[0] || unseen[k][1] === e[0]) un++; if (unseen[k][0] === e[1] || unseen[k][1] === e[1]) un++; }
          v += 2 * own - un;
          if (t[0] === t[1]) v += 1;
        }
        if (v > bv) { bv = v; best = act; }
      }
      return best;
    },
    /* Other hands and the boneyard are shown as counts; the viewer sees their own hand, the hot seat the current
       one, and after the end every hand is open. */
    view: function (s, p) {
      var who = p >= 0 ? p : s.turn, counts = [], hands = [], i;
      for (i = 0; i < s.n; i++) { counts.push(s.hands[i].length); hands.push(s.over || i === who ? s.hands[i].slice() : null); }
      return { n: s.n, me: who, hands: hands, counts: counts, boneyard: s.boneyard.length, line: s.line, turn: s.turn, start: s.start, passes: s.passes, missed: s.missed, over: s.over, winner: s.winner, blocked: s.blocked, last: s.last };
    },
    ui: {
      /* The table: a wooden board in a dark rail. The players sit along the top (their tiles standing as backs),
         the boneyard is a face-down stack beside them, the line of ivory tiles runs across the middle (doubles
         across the line, the two open ends marked with their pips, scrolling when it outgrows the table), and
         the own tiles stand on an ivory tray at the bottom, the playable ones lifted and glowing. A played tile
         slides from the tray into the line, a drawn one from the boneyard onto the tray. */
      mount: function (el, api) {
        var Gfx = root.Gfx;
        function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        /* A tile from the kit; the vertical one is the horizontal tile turned inside a box of the right size. */
        function tileHtml(t, size, vertical, cls) {
          var inner = Gfx.domino(t[0], t[1], size, false);
          if (!vertical) return '<div class="dm-tile' + (cls ? ' ' + cls : '') + '" style="width:' + size + 'px;height:' + (size / 2) + 'px">' + inner + '</div>';
          return '<div class="dm-tile' + (cls ? ' ' + cls : '') + '" style="width:' + (size / 2) + 'px;height:' + size + 'px"><div class="dm-rot" style="left:' + (-size / 4) + 'px;top:' + (size / 4) + 'px">' + inner + '</div></div>';
        }
        /* The back of a tile: dark wood with a brass diamond. */
        function backSvg(size) {
          return '<svg class="gfx" width="' + size + '" height="' + (size / 2) + '" viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="80" height="40" rx="5" fill="rgba(0,0,0,0.35)"/><rect x="0.5" y="0.5" width="79" height="39" rx="5" fill="#2e2521" stroke="#15100e"/><rect x="5" y="5" width="70" height="30" rx="3" fill="none" stroke="#8a6a3c" stroke-width="1.2"/><path d="M40 10 L50 20 L40 30 L30 20 Z" fill="#b08a4a"/><path d="M40 14 L46 20 L40 26 L34 20 Z" fill="#2e2521"/><rect x="2" y="2" width="76" height="10" rx="4" fill="#fff" opacity="0.08"/></svg>';
        }
        function backHtml(size, vertical, cls) {
          if (!vertical) return '<div class="dm-tile' + (cls ? ' ' + cls : '') + '" style="width:' + size + 'px;height:' + (size / 2) + 'px">' + backSvg(size) + '</div>';
          return '<div class="dm-tile' + (cls ? ' ' + cls : '') + '" style="width:' + (size / 2) + 'px;height:' + size + 'px"><div class="dm-rot" style="left:' + (-size / 4) + 'px;top:' + (size / 4) + 'px">' + backSvg(size) + '</div></div>';
        }
        /* An open end: a brass ring showing the pips that may be laid against it. */
        function endHtml(n, size, end, cls) {
          var pips = '';
          (Gfx.PIPS[n] || []).forEach(function (p) { pips += '<circle cx="' + (6 + 28 * p[0]) + '" cy="' + (6 + 28 * p[1]) + '" r="3.2" fill="#f3e9d2"/>'; });
          return '<div class="dm-end' + (cls ? ' ' + cls : '') + '" data-end="' + end + '" style="width:' + size + 'px;height:' + size + 'px"><svg class="gfx" width="' + size + '" height="' + size + '" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.35)" stroke="#c9a35a" stroke-width="2.5"/>' + pips + '</svg></div>';
        }
        var rail = h('div', 'dm-rail gfx-wood-dark'), table = h('div', 'dm-table gfx-wood'), seats = h('div', 'dm-seats'), lineBox = h('div', 'dm-linebox'), lineEl = h('div', 'dm-line'), hint = h('div', 'dm-hint'), bar = h('div', 'dm-bar'), tray = h('div', 'dm-tray gfx-ivory'), fx = h('div', 'dm-fx');
        lineBox.appendChild(lineEl); rail.appendChild(table); table.appendChild(seats); table.appendChild(lineBox); table.appendChild(hint); table.appendChild(bar); table.appendChild(tray); table.appendChild(fx); el.appendChild(rail);
        var style = h('style');
        style.textContent = '.dm-rail{border-radius:26px;padding:10px;box-shadow:0 14px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 0 rgba(0,0,0,.4)}' +
          '.dm-table{position:relative;border-radius:16px;padding:10px 8px 8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),inset 0 0 70px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:8px;color:#fff;user-select:none;-webkit-user-select:none}' +
          '.dm-tile{position:relative;flex:none;overflow:visible}.dm-rot{position:absolute;transform:rotate(90deg);transform-origin:50% 50%}' +
          '.dm-seats{display:flex;gap:6px;justify-content:center;align-items:flex-start;flex-wrap:wrap}.dm-seat{flex:1 1 0;min-width:0;max-width:170px;display:flex;flex-direction:column;align-items:center;gap:4px}' +
          '.dm-backs{display:flex;gap:2px;min-height:4px}.dm-name{display:flex;flex-direction:column;align-items:center;font-size:11px;line-height:1.2;max-width:100%;padding:3px 8px;border-radius:11px;background:rgba(0,0,0,.45);border:2px solid var(--pc);text-align:center;box-sizing:border-box}.dm-name b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
          '.dm-seat.on .dm-name{box-shadow:0 0 0 2px rgba(255,255,255,.9),0 0 16px var(--pc);background:rgba(0,0,0,.6)}' +
          '.dm-bone{flex:none;display:flex;flex-direction:column;align-items:center;gap:4px}.dm-stack{position:relative}.dm-stack .dm-tile{position:absolute;left:0;top:0}.dm-stack.hot{cursor:pointer}.dm-ring{position:absolute;left:-5px;top:-5px;right:-5px;bottom:-5px;border-radius:9px;box-shadow:0 0 0 3px #f2b632,0 0 18px #f2b632;opacity:0;transition:opacity .25s;pointer-events:none}.dm-stack.hot .dm-ring{opacity:1}' +
          '.dm-count{font-size:11px;white-space:nowrap;background:rgba(0,0,0,.45);padding:2px 8px;border-radius:9px}' +
          '.dm-linebox{overflow-x:auto;overflow-y:hidden;contain:inline-size;width:0;min-width:100%;box-sizing:border-box;border-radius:12px;box-shadow:inset 0 3px 12px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.3);background:rgba(0,0,0,.14);padding:12px 10px;-webkit-overflow-scrolling:touch}.dm-line{display:flex;align-items:center;gap:2px;width:max-content;margin:0 auto}' +
          '.dm-end{flex:none;margin:0 6px;opacity:.55;transition:opacity .2s,transform .2s;border-radius:50%}.dm-end.fit{opacity:1;cursor:pointer;transform:scale(1.08);box-shadow:0 0 0 3px #f2b632,0 0 18px #f2b632}.dm-end.off{display:none}' +
          '.dm-hint{text-align:center;font-size:13px;opacity:.92;min-height:18px;text-shadow:0 1px 2px rgba(0,0,0,.6)}.dm-bar{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;min-height:0}' +
          '.dm-btn{min-height:44px;padding:0 20px;border-radius:22px;border:0;background:linear-gradient(#ffd45a,#e9a820);color:#2a1a05;font-weight:800;font-size:15px;box-shadow:0 3px 0 #9a6a10,0 5px 10px rgba(0,0,0,.45);cursor:pointer}.dm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #9a6a10}' +
          '.dm-tray{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:8px;padding:18px 10px 10px;border-radius:12px;border:4px solid #6b4121;box-shadow:inset 0 4px 10px rgba(0,0,0,.35),0 4px 10px rgba(0,0,0,.4);min-height:60px}' +
          '.dm-tray .dm-tile{transition:transform .18s}.dm-tray .dm-tile.ok{cursor:pointer;transform:translateY(-8px)}.dm-tray .dm-tile.ok svg{filter:drop-shadow(0 0 2px #f2b632) drop-shadow(0 0 6px rgba(242,182,50,.9))}.dm-tray .dm-tile.sel{transform:translateY(-16px)}.dm-tray .dm-tile.sel svg{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 8px #f2b632)}.dm-tray .dm-tile.dead{opacity:.5}' +
          '.dm-fx{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:60}.dm-fly{position:absolute;transform-origin:50% 50%}';
        el.appendChild(style);
        var view = null, info = null, sel = -1, prevHand = null, prevMe = -2, W = 320, L = 60, HL = 80, first = true;
        var handEls = [], seatEls = [], boneEl = null;
        function measure() { W = Math.max(290, (el.clientWidth || 360) - 38); L = Math.max(44, Math.min(68, Math.floor(W / 7))); HL = Math.max(72, Math.min(96, Math.floor(W / 4.2))); }
        function rectOf(e) { var r = e.getBoundingClientRect(), t = table.getBoundingClientRect(); return { left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }; }
        function flip(e, from, ms, delay, fromTf) {
          var to = rectOf(e), base = e.getAttribute('data-tf') || '';
          var dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
          e.style.transition = 'none'; e.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (fromTf || '');
          void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms'; e.style.transform = base;
        }
        function fly(html, from, to, ms, delay) {
          var e = h('div', 'dm-fly', html); e.style.left = from.left + 'px'; e.style.top = from.top + 'px'; e.style.width = from.width + 'px'; e.style.height = from.height + 'px';
          fx.appendChild(e); void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms, opacity 160ms ' + ((delay || 0) + ms - 120) + 'ms';
          e.style.transform = 'translate(' + (to.left + to.width / 2 - from.left - from.width / 2).toFixed(1) + 'px,' + (to.top + to.height / 2 - from.top - from.height / 2).toFixed(1) + 'px) scale(' + (to.width / from.width).toFixed(3) + ')';
          e.style.opacity = '0';
          setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, ms + (delay || 0) + 80);
        }
        function myActions() { return info && info.canAct && view && view.me >= 0 && view.hands[view.me] ? plays(view.hands[view.me], view.line, view.start) : []; }
        function render(animate) {
          var v = view, inf = info, ov = G.over(v), me = v.me, i, k;
          var prevRects = me === prevMe ? handEls.map(rectOf) : null;
          measure();
          /* the players and the boneyard along the top */
          seats.innerHTML = ''; seatEls = [];
          var bs = Math.round(L * 0.5);
          for (i = 0; i < v.n; i++) {
            var s = h('div', 'dm-seat' + (v.turn === i && !v.over ? ' on' : '')); s.style.setProperty('--pc', inf.colors[i]);
            var backs = h('div', 'dm-backs');
            if (i !== me) for (k = 0; k < Math.min(v.counts[i], 8); k++) backs.innerHTML += backHtml(bs, true);
            s.appendChild(backs);
            s.appendChild(h('div', 'dm-name', '<b>' + esc(inf.names[i]) + '</b><span>' + (v.counts[i] === 1 ? api.t('tile') : api.t('tiles', v.counts[i])) + (ov ? ' / ' + ov.pips[i] : '') + '</span>'));
            seats.appendChild(s); seatEls.push(s);
          }
          var bone = h('div', 'dm-bone'), stack = h('div', 'dm-stack'), layers = v.boneyard ? Math.min(5, Math.ceil(v.boneyard / 3)) : 0;
          stack.style.width = L + 'px'; stack.style.height = (L / 2 + layers * 2) + 'px';
          for (k = 0; k < layers; k++) { var b = h('div', '', backHtml(L, false)); b = b.firstChild; b.style.position = 'absolute'; b.style.left = (k * 1.5) + 'px'; b.style.top = (layers - 1 - k) * 2 + 'px'; stack.appendChild(b); }
          stack.appendChild(h('div', 'dm-ring'));
          var all = inf.canAct && me >= 0 ? G.actions({ n: v.n, hands: v.hands.map(function (x) { return x || []; }), line: v.line, start: v.start, boneyard: new Array(v.boneyard), turn: v.turn, over: v.over }, me) : [];
          var mayDraw = all.some(function (a) { return a.draw; }), mayPass = all.some(function (a) { return a.pass; });
          if (mayDraw) { stack.className += ' hot'; stack.onclick = function () { if (info && info.canAct) api.act({ draw: true }); }; }
          bone.appendChild(stack); bone.appendChild(h('div', 'dm-count', api.t('boneyard', v.boneyard)));
          seats.appendChild(bone); boneEl = stack;
          /* the line with its two open ends */
          var acts = myActions(), selTile = sel >= 0 && v.hands[me] ? v.hands[me][sel] : null;
          var fitL = !!selTile && acts.some(function (a) { return a.end === 'L' && same(a.play, selTile); }), fitR = !!selTile && acts.some(function (a) { return a.end === 'R' && same(a.play, selTile); });
          var e = ends(v.line), lh = '';
          if (e) lh += endHtml(e[0], Math.round(L * 0.5), 'L', fitL ? 'fit' : '');
          for (i = 0; i < v.line.length; i++) { var t = v.line[i], isLast = v.last && v.last.tile && i === (v.last.end === 'L' ? 0 : v.line.length - 1); lh += tileHtml(t, L, t[0] === t[1], isLast ? 'last' : ''); }
          if (e) lh += endHtml(e[1], Math.round(L * 0.5), 'R', fitR ? 'fit' : '');
          lineEl.innerHTML = lh;
          lineBox.style.minHeight = (L + 24) + 'px';
          /* the own tiles on the tray */
          var mine = (me >= 0 && v.hands[me]) || [], hh = '';
          for (i = 0; i < mine.length; i++) { var fits = acts.some(function (a) { return same(a.play, mine[i]); }); hh += tileHtml(mine[i], HL, true, (fits ? 'ok' : '') + (i === sel ? ' sel' : '') + (acts.length && !fits ? ' dead' : '')).replace('class="dm-tile', 'data-i="' + i + '" class="dm-tile'); }
          tray.innerHTML = hh; handEls = Array.prototype.slice.call(tray.children);
          /* buttons: draw, pass, and the two ends when a tile fits both */
          var bh = '';
          if (mayDraw) bh += '<button class="dm-btn" data-a="draw">' + api.t('draw', v.boneyard) + '</button>';
          if (mayPass) bh += '<button class="dm-btn" data-a="pass">' + api.t('pass') + '</button>';
          if (fitL && fitR) bh += '<button class="dm-btn" data-end="L">' + api.t('left') + '</button><button class="dm-btn" data-end="R">' + api.t('right') + '</button>';
          bar.innerHTML = bh;
          if (ov) hint.textContent = ov.blocked ? api.t('blocked') + (ov.winner >= 0 ? ' / ' + api.t('pipsOf', inf.names[ov.winner], ov.pips[ov.winner]) : '') : api.t('won', inf.names[ov.winner]);
          else if (!inf.canAct) hint.textContent = v.last && v.last.pass ? api.t('passed', inf.names[v.last.p]) + ' / ' + api.t('wait', inf.names[v.turn]) : api.t('wait', inf.names[v.turn]);
          else if (!v.line.length) hint.textContent = api.t('startWith');
          else if (!acts.length) hint.textContent = v.boneyard ? api.t('mustDraw') : api.t('mustPass');
          else hint.textContent = sel >= 0 ? api.t('pickEnd') : api.t('pickTile');
          /* keep the newest tile in view */
          var lastEl = lineEl.querySelector('.dm-tile.last');
          if (lastEl && lineBox.scrollWidth > lineBox.clientWidth) { var want = lastEl.offsetLeft + lastEl.offsetWidth / 2 - lineBox.clientWidth / 2; lineBox.scrollLeft = Math.max(0, want); }
          /* the moves of the last apply */
          if (animate) {
            var boneRect = rectOf(boneEl);
            (inf.events || []).forEach(function (ev) {
              if (ev.e === 'play' && lastEl) {
                var src = null;
                if (ev.p === me && prevRects && prevHand) { for (k = 0; k < prevHand.length; k++) if (same(prevHand[k], ev.tile) && prevRects[k]) src = prevRects[k]; }
                if (!src && seatEls[ev.p]) src = rectOf(seatEls[ev.p]);
                if (src) flip(lastEl, src, 320, 0, 'rotate(' + (ev.tile[0] === ev.tile[1] ? 0 : 90) + 'deg)');
              } else if (ev.e === 'draw') {
                if (ev.p === me && handEls.length) flip(handEls[handEls.length - 1], boneRect, 320, 0, 'rotate(-90deg)');
                else if (seatEls[ev.p]) fly(backHtml(L, false), boneRect, rectOf(seatEls[ev.p].firstChild), 340, 0);
              }
            });
            if (first) { first = false; handEls.forEach(function (d, k) { flip(d, boneRect, 300, k * 60, 'rotate(-90deg)'); }); }
          }
          prevHand = mine.slice(); prevMe = me;
        }
        tray.onclick = function (ev) {
          var t = ev.target.closest ? ev.target.closest('.dm-tile') : null;
          if (!t || !info || !info.canAct) return;
          var i = +t.getAttribute('data-i'), acts = myActions(), tile = view.hands[view.me][i];
          if (!acts.length) return;
          var fits = acts.filter(function (a) { return same(a.play, tile); });
          if (!fits.length) { api.toast(api.t('noFit')); return; }
          if (fits.length === 1 || !view.line.length) { api.act(fits[0]); sel = -1; return; }
          sel = sel === i ? -1 : i; render(false);
        };
        function playEnd(end) {
          if (!info || !info.canAct || sel < 0) return;
          var tile = view.hands[view.me][sel], fits = myActions().filter(function (a) { return a.end === end && same(a.play, tile); });
          if (!fits.length) { api.toast(api.t('noFit')); return; }
          api.act(fits[0]); sel = -1;
        }
        lineEl.onclick = function (ev) { var e = ev.target.closest ? ev.target.closest('.dm-end') : null; if (e) playEnd(e.getAttribute('data-end')); };
        bar.onclick = function (ev) {
          var b = ev.target.closest ? ev.target.closest('button') : null;
          if (!b || !info || !info.canAct) return;
          if (b.getAttribute('data-end')) { playEnd(b.getAttribute('data-end')); return; }
          var a = {}; a[b.getAttribute('data-a')] = true; api.act(a);
        };
        function onResize() { if (view && info) render(false); }
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf; sel = -1;
            (inf.events || []).forEach(function (e) { if (e.e === 'play') api.sound('move'); if (e.e === 'draw') api.sound('card'); if (e.e === 'pass') api.sound('turn'); });
            render(true);
          },
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
