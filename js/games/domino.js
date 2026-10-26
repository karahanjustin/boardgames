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
      mount: function (el, api) {
        var wrap = document.createElement('div'); wrap.className = 'dm';
        var seats = document.createElement('div'); seats.className = 'dm-seats';
        var lineBox = document.createElement('div'); lineBox.className = 'dm-linebox';
        var lineEl = document.createElement('div'); lineEl.className = 'dm-line';
        var hint = document.createElement('div'); hint.className = 'dm-hint';
        var bar = document.createElement('div'); bar.className = 'dm-bar';
        var hand = document.createElement('div'); hand.className = 'dm-hand';
        lineBox.appendChild(lineEl); wrap.appendChild(seats); wrap.appendChild(lineBox); wrap.appendChild(hint); wrap.appendChild(bar); wrap.appendChild(hand); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.dm{max-width:960px;margin:0 auto;padding:6px}.dm-seats{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:8px}' +
          '.dm-seat{padding:4px 10px;border-radius:10px;background:rgba(0,0,0,.25);font-size:13px;border:2px solid transparent}.dm-seat.turn{border-color:#fff}.dm-seat b{color:var(--pc,#fff)}' +
          '.dm-linebox{overflow-x:auto;background:#1f6b3a;border-radius:14px;box-shadow:inset 0 0 0 5px #5a3a1e;padding:16px 10px;min-height:96px}.dm-line{display:flex;align-items:center;gap:3px;width:max-content;margin:0 auto}' +
          '.dm-tile{display:flex;background:#fdfdf6;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,.5);border:1px solid #bbb;flex:none}.dm-tile.h{flex-direction:row;width:64px;height:32px}.dm-tile.v{flex-direction:column;width:32px;height:64px}' +
          '.dm-half{flex:1;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:3px;box-sizing:border-box;position:relative}.dm-tile.h .dm-half:first-child{border-right:1px solid #999}.dm-tile.v .dm-half:first-child{border-bottom:1px solid #999}' +
          '.dm-half i{display:block;width:6px;height:6px;border-radius:50%;background:#222;margin:auto;visibility:hidden}.dm-half i.on{visibility:visible}' +
          '.dm-end{flex:none;width:44px;height:64px;border-radius:8px;border:2px dashed rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;cursor:pointer;opacity:.5}.dm-end.fit{opacity:1;border-color:#f5c542;background:rgba(245,197,66,.25)}.dm-end.off{visibility:hidden}' +
          '.dm-hint{text-align:center;font-size:13px;opacity:.85;margin:8px 0;min-height:18px}.dm-bar{display:flex;justify-content:center;gap:10px;min-height:40px}.dm-bar button{padding:8px 16px;border-radius:10px;border:0;font-size:14px;font-weight:600;cursor:pointer;background:#f5c542;color:#222}' +
          '.dm-hand{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:10px;background:rgba(0,0,0,.25);border-radius:12px;margin-top:8px;min-height:60px}.dm-hand .dm-tile{cursor:pointer;transition:transform .12s}.dm-hand .dm-tile.sel{transform:translateY(-8px);box-shadow:0 0 0 3px #f5c542,0 6px 12px rgba(0,0,0,.5)}.dm-hand .dm-tile.dead{opacity:.45}' +
          '.dm-tile.last{box-shadow:0 0 0 2px #fff,0 2px 5px rgba(0,0,0,.5)}.dm-tile.v.hand{width:32px;height:64px}';
        el.appendChild(style);
        var PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
        var view = null, info = null, sel = -1;
        function half(n) { var h = '<div class="dm-half">'; for (var k = 0; k < 9; k++) h += '<i class="' + (PIPS[n].indexOf(k) >= 0 ? 'on' : '') + '"></i>'; return h + '</div>'; }
        function tileHtml(t, vertical, cls, attrs) { return '<div class="dm-tile ' + (vertical ? 'v' : 'h') + (cls ? ' ' + cls : '') + '"' + (attrs || '') + '>' + half(t[0]) + half(t[1]) + '</div>'; }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function myActions() { return info && info.canAct && view && view.me >= 0 && view.hands[view.me] ? plays(view.hands[view.me], view.line, view.start) : []; }
        function render() {
          var v = view, inf = info, ov = G.over(v), i, h = '';
          for (i = 0; i < v.n; i++) h += '<div class="dm-seat' + (v.turn === i && !v.over ? ' turn' : '') + '"><b style="--pc:' + inf.colors[i] + '">' + esc(inf.names[i]) + '</b> · ' + (v.counts[i] === 1 ? api.t('tile') : api.t('tiles', v.counts[i])) + (ov ? ' · ' + api.t('pipsOf', '', ov.pips[i]).replace(/^[^0-9]*/, '') : '') + '</div>';
          h += '<div class="dm-seat">' + api.t('boneyard', v.boneyard) + '</div>';
          seats.innerHTML = h;
          var acts = myActions(), selTile = sel >= 0 && v.hands[v.me] ? v.hands[v.me][sel] : null;
          var fitL = selTile && acts.some(function (a) { return a.end === 'L' && same(a.play, selTile); }), fitR = selTile && acts.some(function (a) { return a.end === 'R' && same(a.play, selTile); });
          var lh = '<div class="dm-end' + (fitL ? ' fit' : '') + (v.line.length && acts.length ? '' : ' off') + '" data-end="L">' + api.t('left') + '</div>';
          for (i = 0; i < v.line.length; i++) { var t = v.line[i], isLast = v.last && v.last.tile && i === (v.last.end === 'L' ? 0 : v.line.length - 1); lh += tileHtml(t, t[0] === t[1], isLast ? 'last' : ''); }
          lh += '<div class="dm-end' + (fitR ? ' fit' : '') + (acts.length ? '' : ' off') + '" data-end="R">' + api.t('right') + '</div>';
          lineEl.innerHTML = lh;
          var mine = v.hands[v.me] || [], hh = '';
          for (i = 0; i < mine.length; i++) { var fits = acts.some(function (a) { return same(a.play, mine[i]); }); hh += tileHtml(mine[i], true, 'hand' + (i === sel ? ' sel' : '') + (acts.length && !fits ? ' dead' : ''), ' data-i="' + i + '"'); }
          hand.innerHTML = hh;
          var all = inf.canAct && v.me >= 0 ? G.actions({ n: v.n, hands: v.hands.map(function (x) { return x || []; }), line: v.line, start: v.start, boneyard: new Array(v.boneyard), turn: v.turn, over: v.over }, v.me) : [];
          var bh = '';
          if (all.some(function (a) { return a.draw; })) bh += '<button data-a="draw">' + api.t('draw', v.boneyard) + '</button>';
          if (all.some(function (a) { return a.pass; })) bh += '<button data-a="pass">' + api.t('pass') + '</button>';
          bar.innerHTML = bh;
          if (ov) hint.textContent = ov.blocked ? api.t('blocked') + (ov.winner >= 0 ? ' · ' + api.t('pipsOf', inf.names[ov.winner], ov.pips[ov.winner]) : '') : api.t('won', inf.names[ov.winner]);
          else if (!inf.canAct) hint.textContent = v.last && v.last.pass ? api.t('passed', inf.names[v.last.p]) + ' · ' + api.t('wait', inf.names[v.turn]) : api.t('wait', inf.names[v.turn]);
          else if (!v.line.length) hint.textContent = api.t('startWith');
          else if (!acts.length) hint.textContent = v.boneyard ? api.t('mustDraw') : api.t('mustPass');
          else hint.textContent = sel >= 0 ? api.t('pickEnd') : api.t('pickTile');
        }
        hand.onclick = function (ev) {
          var t = ev.target.closest ? ev.target.closest('.dm-tile') : null;
          if (!t || !info || !info.canAct) return;
          var i = +t.dataset.i, acts = myActions(), tile = view.hands[view.me][i];
          if (!acts.length) return;
          var fits = acts.filter(function (a) { return same(a.play, tile); });
          if (!fits.length) { api.toast(api.t('noFit')); return; }
          if (fits.length === 1 || !view.line.length) { api.act(fits[0]); sel = -1; return; }
          sel = sel === i ? -1 : i; render();
        };
        lineEl.onclick = function (ev) {
          var e = ev.target.closest ? ev.target.closest('.dm-end') : null;
          if (!e || !info || !info.canAct || sel < 0) return;
          var tile = view.hands[view.me][sel], fits = myActions().filter(function (a) { return a.end === e.dataset.end && same(a.play, tile); });
          if (!fits.length) { api.toast(api.t('noFit')); return; }
          api.act(fits[0]); sel = -1;
        };
        bar.onclick = function (ev) {
          var b = ev.target.closest ? ev.target.closest('button') : null;
          if (!b || !info || !info.canAct) return;
          var a = {}; a[b.dataset.a] = true; api.act(a);
        };
        return {
          update: function (v, inf) {
            view = v; info = inf; sel = -1;
            (inf.events || []).forEach(function (e) { if (e.e === 'play') api.sound('move'); if (e.e === 'draw') api.sound('card'); if (e.e === 'pass') api.sound('turn'); });
            render();
            if ((inf.events || []).some(function (e) { return e.e === 'play'; })) { var last = lineEl.querySelector('.dm-tile.last'); if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
