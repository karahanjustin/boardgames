/* Backgammon: two dice, 15 checkers each, bear them all off to win. The rules, an AI with a one ply evaluation and a
   21 roll expectation over the reply at the hard level, and a canvas board (see docs/CONTRACT.md).
   Coordinates are absolute, from player 0's view: points 0..23, the bar is 24 and off is 25. Player 0 moves from 23
   down to 0 (home board 0..5) and enters from the bar at 24 - die; player 1 moves from 0 up to 23 (home board
   18..23) and enters at die - 1. The state keeps pts[p][i] as the number of player p's checkers on point i. */
(function (root) {
  'use strict';
  var START = [[23, 2], [12, 5], [7, 3], [5, 5]];
  function newPos() {
    var pos = { pts: [[], []], bar: [0, 0], off: [0, 0] }, i;
    for (i = 0; i < 24; i++) { pos.pts[0].push(0); pos.pts[1].push(0); }
    for (i = 0; i < START.length; i++) { pos.pts[0][START[i][0]] = START[i][1]; pos.pts[1][23 - START[i][0]] = START[i][1]; }
    return pos;
  }
  function clonePos(pos) { return { pts: [pos.pts[0].slice(), pos.pts[1].slice()], bar: pos.bar.slice(), off: pos.off.slice() }; }
  function posOf(s) { return { pts: s.pts, bar: s.bar, off: s.off }; }
  function posKey(pos) { return pos.pts[0].join(',') + '|' + pos.pts[1].join(',') + '|' + pos.bar.join(',') + '|' + pos.off.join(','); }
  /* Bearing off is allowed once every checker of p is in the home board and none is on the bar. */
  function homeReady(pos, p) {
    if (pos.bar[p]) return false;
    var me = pos.pts[p], i;
    if (p === 0) { for (i = 6; i < 24; i++) if (me[i]) return false; }
    else { for (i = 0; i < 18; i++) if (me[i]) return false; }
    return true;
  }
  /* Whether p has a checker further from off than point i. */
  function furtherBack(me, p, i) {
    var k;
    if (p === 0) { for (k = i + 1; k < 24; k++) if (me[k]) return true; }
    else { for (k = 0; k < i; k++) if (me[k]) return true; }
    return false;
  }
  /* Every single checker move for p with one die of value d. A checker on the bar must enter first. */
  function singleMoves(pos, p, d) {
    var me = pos.pts[p], op = pos.pts[1 - p], out = [], i, to;
    if (pos.bar[p] > 0) {
      to = p === 0 ? 24 - d : d - 1;
      if (op[to] < 2) out.push({ from: 24, to: to, die: d });
      return out;
    }
    var canOff = homeReady(pos, p);
    for (i = 0; i < 24; i++) {
      if (!me[i]) continue;
      to = p === 0 ? i - d : i + d;
      if (to >= 0 && to < 24) { if (op[to] < 2) out.push({ from: i, to: to, die: d }); }
      else if (canOff) {
        var need = p === 0 ? i + 1 : 24 - i;
        if (d === need || (d > need && !furtherBack(me, p, i))) out.push({ from: i, to: 25, die: d });
      }
    }
    return out;
  }
  /* Applies one checker move in place and reports whether an enemy blot was hit. */
  function applyMove(pos, p, m) {
    var me = pos.pts[p], op = pos.pts[1 - p];
    if (m.from === 24) pos.bar[p]--; else me[m.from]--;
    if (m.to === 25) { pos.off[p]++; return false; }
    var hit = op[m.to] === 1;
    if (hit) { op[m.to] = 0; pos.bar[1 - p]++; }
    me[m.to]++;
    return hit;
  }
  function diceList(dice) { return dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]]; }
  function without(list, k) { var r = list.slice(); r.splice(k, 1); return r; }
  /* All maximal legal sequences for the roll, deduplicated by the position they reach. Both dice must be used when
     possible; when only one can be used, the larger one must be used if it can. */
  function sequences(pos, p, dice) {
    var out = [], seen = {}, best = 0;
    function gen(cur, rest, seq) {
      var moved = false, tried = {}, k, j;
      for (k = 0; k < rest.length; k++) {
        var d = rest[k];
        if (tried[d]) continue;
        tried[d] = true;
        var ms = singleMoves(cur, p, d);
        for (j = 0; j < ms.length; j++) {
          moved = true;
          var np = clonePos(cur);
          applyMove(np, p, ms[j]);
          var nr = without(rest, k), key = nr.join('') + ':' + posKey(np);
          if (seen[key]) continue;
          seen[key] = true;
          gen(np, nr, seq.concat([ms[j]]));
        }
      }
      if (!moved) { out.push({ moves: seq, pos: cur, key: posKey(cur) }); if (seq.length > best) best = seq.length; }
    }
    gen(pos, diceList(dice), []);
    if (best === 0) return [];
    var res = out.filter(function (q) { return q.moves.length === best; });
    if (best === 1 && dice[0] !== dice[1]) {
      var hi = Math.max(dice[0], dice[1]);
      var withHi = res.filter(function (q) { return q.moves[0].die === hi; });
      if (withHi.length) res = withHi;
    }
    var byKey = {}, fin = [];
    res.forEach(function (q) { if (!byKey[q.key]) { byKey[q.key] = true; fin.push(q); } });
    return fin;
  }
  /* The largest number of checker moves still possible with the remaining dice (used by the UI to keep a partial
     sequence completable). */
  function maxMoves(pos, p, rest) {
    var best = 0, tried = {}, k, j;
    for (k = 0; k < rest.length; k++) {
      var d = rest[k];
      if (tried[d]) continue;
      tried[d] = true;
      var ms = singleMoves(pos, p, d);
      for (j = 0; j < ms.length; j++) {
        var np = clonePos(pos);
        applyMove(np, p, ms[j]);
        var v = 1 + maxMoves(np, p, without(rest, k));
        if (v > best) best = v;
        if (best === rest.length) return best;
      }
    }
    return best;
  }
  function toAction(q) { return { move: q.moves.map(function (m) { return [m.from, m.to]; }) }; }
  function pips(pos, p) {
    var sum = pos.bar[p] * 25, me = pos.pts[p], i;
    for (i = 0; i < 24; i++) if (me[i]) sum += me[i] * (p === 0 ? i + 1 : 24 - i);
    return sum;
  }
  /* Whether the two armies can still meet: some player 1 checker is still behind some player 0 checker. */
  function contact(pos) {
    var hi0 = pos.bar[0] ? 24 : -1, lo1 = pos.bar[1] ? -1 : 24, i;
    if (hi0 < 0) for (i = 23; i >= 0; i--) if (pos.pts[0][i]) { hi0 = i; break; }
    if (lo1 > 23) for (i = 0; i < 24; i++) if (pos.pts[1][i]) { lo1 = i; break; }
    return lo1 < hi0;
  }
  /* How exposed a blot of p on point i is: 2 for a direct shot, 1 for an indirect one, 0 for none. */
  function shots(pos, p, i) {
    var op = pos.pts[1 - p], best = 0, j, d;
    if (pos.bar[1 - p]) { d = p === 0 ? i + 1 : 24 - i; if (d <= 6) return 2; if (d <= 12) best = 1; }
    for (j = 0; j < 24; j++) {
      if (!op[j]) continue;
      d = p === 0 ? i - j : j - i;
      if (d >= 1 && d <= 6) return 2;
      if (d > 6 && d <= 12) best = 1;
    }
    return best;
  }
  /* A static evaluation from p's view: race, checkers off and on the bar, blots, made points, primes, home board. */
  function evaluate(pos, p) {
    var o = 1 - p, me = pos.pts[p], op = pos.pts[o], score = 0, i;
    if (pos.off[p] === 15) return 1e6;
    if (pos.off[o] === 15) return -1e6;
    score += pips(pos, o) - pips(pos, p);
    score += (pos.off[p] - pos.off[o]) * 6;
    if (!contact(pos)) return score;
    score += (pos.bar[o] - pos.bar[p]) * 12;
    var run = 0, bestRun = 0;
    for (i = 0; i < 24; i++) {
      var c = me[i];
      if (c === 1) {
        var sh = shots(pos, p, i), lose = p === 0 ? 24 - i : i + 1;
        score -= (sh === 2 ? 9 : sh === 1 ? 3 : 0.5) * (1 + lose / 24);
      } else if (c >= 2) {
        score += 3;
        if (p === 0 ? i <= 5 : i >= 18) score += 3;
        if ((p === 0 && (i === 4 || i === 6)) || (p === 1 && (i === 19 || i === 17))) score += 3;
        if (c > 4) score -= (c - 4) * 1.5;
      }
      if (c >= 2) { run++; if (run > bestRun) bestRun = run; } else run = 0;
      if (op[i] === 1) score += 1.5;
    }
    if (bestRun >= 3) score += bestRun * bestRun;
    if (pos.bar[o]) {
      var hb = 0;
      for (i = 0; i < 6; i++) if (me[p === 0 ? i : 23 - i] >= 2) hb++;
      score += hb * 4 * pos.bar[o];
    }
    return score;
  }
  /* The expected value for p after the opponent answers each of the 21 rolls with their best one ply reply. */
  function expectReply(pos, p) {
    var o = 1 - p, total = 0, a, b, k;
    for (a = 1; a <= 6; a++) for (b = a; b <= 6; b++) {
      var w = a === b ? 1 : 2, replies = sequences(pos, o, [a, b]), worst;
      if (!replies.length) worst = evaluate(pos, p);
      else { worst = Infinity; for (k = 0; k < replies.length; k++) { var v = evaluate(replies[k].pos, p); if (v < worst) worst = v; } }
      total += w * worst;
    }
    return total / 36;
  }
  var G = {
    id: 'backgammon',
    name: { de: 'Backgammon', en: 'Backgammon' },
    blurb: { de: 'Würfeln, ziehen, schlagen, alle Steine nach Hause bringen.', en: 'Roll, move, hit, bring every checker home.' },
    icon: '🎲',
    counts: [2],
    ai: true,
    hidden: false,
    strings: {
      de: {
        roll: 'Würfeln', undo: 'Zug zurück', pass: 'Passen', noMove: 'Kein Zug möglich', rollHint: 'Du bist dran, würfle', pick: 'Stein antippen', target: 'Ziel antippen', doubles: 'Pasch, vier Züge',
        pips: 'Pips', off: 'Raus', badMove: 'Dieser Zug geht nicht',
        rules: 'Jeder hat 15 Steine und zieht sie mit zwei Würfeln um das Brett in sein Heimfeld, Spieler 1 nach unten rechts, Spieler 2 nach oben rechts. Jede Augenzahl ist ein eigener Zug, ein Pasch zählt vierfach; wer kann, muss beide Würfel nutzen, geht nur einer, dann der höhere. Auf ein Feld mit zwei oder mehr gegnerischen Steinen darf man nicht. Ein einzelner gegnerischer Stein wird geschlagen und kommt auf die Bar; er muss zuerst wieder ins Spiel gebracht werden. Stehen alle eigenen Steine im Heimfeld, darf man sie mit passender oder höherer Augenzahl herauswürfeln. Wer zuerst alle 15 Steine draußen hat, gewinnt. Ohne Verdopplungswürfel und ohne Gammon: ein Sieg ist ein Sieg.'
      },
      en: {
        roll: 'Roll', undo: 'Undo move', pass: 'Pass', noMove: 'No move possible', rollHint: 'Your turn, roll the dice', pick: 'Tap a checker', target: 'Tap a target', doubles: 'Doubles, four moves',
        pips: 'Pips', off: 'Off', badMove: 'That move is not possible',
        rules: 'Each player has 15 checkers and moves them with two dice around the board into their home board, player 1 to the bottom right, player 2 to the top right. Each die is a separate move and doubles count four times; you must use both dice if you can, and the higher one if only one can be used. You may not land on a point with two or more enemy checkers. A single enemy checker is hit and goes to the bar; it must re-enter before anything else moves. Once all your checkers are in your home board you bear them off with an exact or higher roll. The first to bear off all 15 checkers wins. No doubling cube and no gammons: a win is a win.'
      }
    },
    create: function () {
      var pos = newPos();
      return { pts: pos.pts, bar: pos.bar, off: pos.off, turn: 0, dice: null, last: null, plies: 0 };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      if (!s.dice) return [{ roll: true }];
      var seqs = sequences(posOf(s), p, s.dice);
      if (!seqs.length) return [{ pass: true }];
      return seqs.map(toAction);
    },
    apply: function (s, p, a, rng) {
      var next = JSON.parse(JSON.stringify(s)), events = [], i;
      if (a.roll) {
        next.dice = [rng.int(6) + 1, rng.int(6) + 1];
        events.push({ e: 'dice', v: next.dice.slice() });
      } else if (a.pass) {
        next.turn = 1 - p; next.dice = null; next.last = { p: p, moves: [] };
        events.push({ e: 'pass', p: p });
      } else {
        var pos = posOf(next);
        for (i = 0; i < a.move.length; i++) {
          var m = { from: a.move[i][0], to: a.move[i][1] }, hit = applyMove(pos, p, m);
          events.push({ e: 'move', p: p, from: m.from, to: m.to });
          if (hit) events.push({ e: 'hit', p: 1 - p, at: m.to });
          if (m.to === 25) events.push({ e: 'off', p: p });
        }
        next.turn = 1 - p; next.dice = null; next.last = { p: p, moves: a.move.map(function (x) { return [x[0], x[1]]; }) };
        if (next.off[p] === 15) events.push({ e: 'win', p: p });
      }
      next.plies++;
      return { state: next, events: events };
    },
    over: function (s) {
      if (s.off[0] === 15) return { winner: 0 };
      if (s.off[1] === 15) return { winner: 1 };
      return null;
    },
    ai: function (s, p, level, rng) {
      if (G.over(s) || s.turn !== p) return null;
      if (!s.dice) return { roll: true };
      var seqs = sequences(posOf(s), p, s.dice);
      if (!seqs.length) return { pass: true };
      if (seqs.length === 1) return toAction(seqs[0]);
      if (level === 1) return toAction(rng.pick(seqs));
      var scored = seqs.map(function (q) { return { q: q, v: evaluate(q.pos, p) + rng.next() * 0.01 }; });
      scored.sort(function (a, b) { return b.v - a.v; });
      if (level === 2 || scored[0].v > 1e5) return toAction(scored[0].q);
      /* Hard: a two ply search over the best one ply candidates, pruned to a handful and guarded by the clock. */
      var start = Date.now(), n = Math.min(scored.length, 7), best = scored[0].q, bv = -Infinity, i;
      for (i = 0; i < n; i++) {
        if (i > 0 && Date.now() - start > 300) break;
        var v = expectReply(scored[i].q.pos, p) + scored[i].v * 0.05;
        if (v > bv) { bv = v; best = scored[i].q; }
      }
      return toAction(best);
    },
    ui: {
      mount: function (el, api) {
        var wrap = document.createElement('div'); wrap.className = 'bg-wrap';
        var canvas = document.createElement('canvas'); canvas.className = 'bg-canvas';
        var bar = document.createElement('div'); bar.className = 'bg-bar';
        var status = document.createElement('div'); status.className = 'bg-status';
        var btnRoll = document.createElement('button'); btnRoll.className = 'bg-btn'; btnRoll.textContent = api.t('roll');
        var btnUndo = document.createElement('button'); btnUndo.className = 'bg-btn'; btnUndo.textContent = api.t('undo');
        var btnPass = document.createElement('button'); btnPass.className = 'bg-btn'; btnPass.textContent = api.t('pass');
        var pipsEl = document.createElement('div'); pipsEl.className = 'bg-pips';
        bar.appendChild(status); bar.appendChild(btnRoll); bar.appendChild(btnUndo); bar.appendChild(btnPass);
        wrap.appendChild(canvas); wrap.appendChild(bar); wrap.appendChild(pipsEl); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.bg-wrap{max-width:min(100%,760px);margin:0 auto}.bg-canvas{display:block;width:100%;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.4);touch-action:manipulation;cursor:pointer}' +
          '.bg-bar{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}.bg-status{flex:1;min-width:120px;font-size:14px;opacity:.85}' +
          '.bg-btn{padding:8px 14px;border-radius:999px;border:0;background:#3b6fd6;color:#fff;font-weight:600;cursor:pointer;font-size:14px}.bg-btn[hidden]{display:none}.bg-btn:active{transform:scale(.97)}' +
          '.bg-pips{display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:13px;opacity:.7}';
        el.appendChild(style);
        var view = null, info = null, geo = null, viewKey = '', seq = [], sel = null, work = null, maxLen = 0, byKey = {}, steps = [], seqs = [];
        function layout() {
          var W = Math.max(300, Math.min(el.clientWidth || 320, 760)), H = Math.round(W * 0.62), dpr = window.devicePixelRatio || 1;
          canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.height = H + 'px';
          var m = W * 0.015, tray = W * 0.085, barW = W * 0.07, inner = W - 2 * m - tray - barW, pw = inner / 12;
          geo = { W: W, H: H, dpr: dpr, m: m, tray: tray, barW: barW, pw: pw, r: Math.min(pw * 0.46, H * 0.085), ph: H * 0.4 };
        }
        function colX(c) { return geo.m + c * geo.pw + (c >= 6 ? geo.barW : 0); }
        function colOf(i) { return i >= 12 ? i - 12 : 11 - i; }
        /* The board location of a tap: a point index, 24 for the bar, 25 for the off trays or -1. */
        function placeAt(x, y) {
          var g = geo;
          if (x > g.W - g.m - g.tray) return 25;
          var xr = x - g.m;
          if (xr < 0) return -1;
          if (xr >= 6 * g.pw && xr < 6 * g.pw + g.barW) return 24;
          var c = xr < 6 * g.pw ? Math.floor(xr / g.pw) : 6 + Math.floor((xr - 6 * g.pw - g.barW) / g.pw);
          if (c < 0 || c > 11) return -1;
          return y < g.H / 2 ? 12 + c : 11 - c;
        }
        /* The centre of the k-th checker on a place (0 is the first one on the point). */
        function slot(place, p, k) {
          var g = geo, x, y, step = g.r * 1.9;
          if (place === 24) { x = g.m + 6 * g.pw + g.barW / 2; y = p === 0 ? g.H / 2 - g.r * 1.3 - k * step : g.H / 2 + g.r * 1.3 + k * step; return { x: x, y: y }; }
          if (place === 25) { x = g.W - g.m - g.tray / 2; y = p === 0 ? g.H - g.m - g.r * 0.4 - k * g.r * 0.5 : g.m + g.r * 0.4 + k * g.r * 0.5; return { x: x, y: y }; }
          x = colX(colOf(place)) + g.pw / 2;
          y = place >= 12 ? g.m + g.r + k * step : g.H - g.m - g.r - k * step;
          return { x: x, y: y };
        }
        function remaining() {
          var rest = diceList(view.dice);
          for (var i = 0; i < seq.length; i++) { var k = rest.indexOf(seq[i].die); if (k >= 0) rest.splice(k, 1); }
          return rest;
        }
        /* The checker moves allowed as the next step of the partial sequence, the smaller die preferred when both fit. */
        function computeSteps() {
          if (!view.dice || maxLen === 0 || seq.length >= maxLen) return [];
          var p = view.turn, out = [], has = {}, i, j;
          function add(m) { var k = m.from + '>' + m.to; if (!has[k]) { has[k] = true; out.push(m); } }
          if (maxLen === 1) { for (i = 0; i < seqs.length; i++) add(seqs[i].moves[0]); return out; }
          var rest = remaining().slice().sort(function (a, b) { return a - b; }), tried = {};
          for (i = 0; i < rest.length; i++) {
            var d = rest[i];
            if (tried[d]) continue;
            tried[d] = true;
            var ms = singleMoves(work, p, d);
            for (j = 0; j < ms.length; j++) {
              var np = clonePos(work);
              applyMove(np, p, ms[j]);
              if (seq.length + 1 + maxMoves(np, p, without(rest, i)) === maxLen) add(ms[j]);
            }
          }
          return out;
        }
        function recompute() {
          work = clonePos(posOf(view)); seq = []; sel = null; byKey = {}; seqs = []; maxLen = 0;
          if (view.dice && !G.over(view)) {
            seqs = sequences(posOf(view), view.turn, view.dice);
            maxLen = seqs.length ? seqs[0].moves.length : 0;
            seqs.forEach(function (q) { byKey[q.key] = toAction(q); });
          }
          steps = computeSteps();
        }
        function takeStep(m) {
          seq.push(m); applyMove(work, view.turn, m); sel = null;
          if (seq.length >= maxLen) {
            var a = byKey[posKey(work)];
            if (a) { api.act(a); steps = []; }
            else { api.toast(api.t('badMove')); recompute(); }
          } else steps = computeSteps();
          draw(); setStatus();
        }
        function undo() {
          if (!seq.length) return;
          seq.pop(); sel = null;
          work = clonePos(posOf(view));
          for (var i = 0; i < seq.length; i++) applyMove(work, view.turn, seq[i]);
          steps = computeSteps(); draw(); setStatus();
        }
        function tapPos(ev) { var b = canvas.getBoundingClientRect(); return { x: (ev.clientX - b.left) * (geo.W / b.width), y: (ev.clientY - b.top) * (geo.H / b.height) }; }
        canvas.onclick = function (ev) {
          if (!info || !info.canAct || !view || !view.dice || G.over(view)) return;
          var q = tapPos(ev), i = placeAt(q.x, q.y), k;
          if (i < 0) return;
          if (sel != null) {
            for (k = 0; k < steps.length; k++) if (steps[k].from === sel && steps[k].to === i) { takeStep(steps[k]); return; }
          }
          var isSource = false;
          for (k = 0; k < steps.length; k++) if (steps[k].from === i) isSource = true;
          if (isSource && i !== sel) sel = i; else { if (!isSource && sel == null) api.sound('wrong'); sel = null; }
          draw(); setStatus();
        };
        btnRoll.onclick = function () { if (info && info.canAct && view && !view.dice) api.act({ roll: true }); };
        btnPass.onclick = function () { if (info && info.canAct && view && view.dice && maxLen === 0) api.act({ pass: true }); };
        btnUndo.onclick = undo;
        function setStatus() {
          var ov = G.over(view), text;
          if (ov) text = api.t('wins', info.names[ov.winner]);
          else if (!info.canAct) text = api.t('wait', info.names[view.turn]);
          else if (!view.dice) text = api.t('rollHint');
          else if (maxLen === 0) text = api.t('noMove');
          else text = (sel == null ? api.t('pick') : api.t('target')) + (view.dice[0] === view.dice[1] ? ' (' + api.t('doubles') + ')' : '');
          status.textContent = text;
          btnRoll.hidden = !(info.canAct && !view.dice && !ov);
          btnPass.hidden = !(info.canAct && view.dice && maxLen === 0 && !ov);
          btnUndo.hidden = !(info.canAct && seq.length > 0);
          var pos = posOf(view);
          pipsEl.innerHTML = '';
          for (var p = 0; p < 2; p++) {
            var d = document.createElement('span');
            d.textContent = info.names[p] + ': ' + api.t('pips') + ' ' + pips(pos, p) + ', ' + api.t('off') + ' ' + view.off[p];
            d.style.color = info.colors[p];
            if (!ov && view.turn === p) d.style.fontWeight = '700';
            pipsEl.appendChild(d);
          }
        }
        function checker(ctx, x, y, color, ring) {
          var r = geo.r;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
          if (ring) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
        }
        function die(ctx, x, y, size, v, dim) {
          ctx.globalAlpha = dim ? 0.35 : 1;
          ctx.fillStyle = '#fbf7ee'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
          roundRect(ctx, x - size / 2, y - size / 2, size, size, size * 0.18); ctx.fill(); ctx.stroke();
          var pipR = size * 0.09, o = size * 0.26, dots = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v] || [];
          ctx.fillStyle = '#222';
          for (var i = 0; i < dots.length; i++) { ctx.beginPath(); ctx.arc(x + dots[i][0] * o, y + dots[i][1] * o, pipR, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
        function roundRect(ctx, x, y, w, h, r) {
          ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
        }
        function draw() {
          if (!view || !geo) return;
          var ctx = canvas.getContext('2d'), g = geo, i, k, p, pos = work || posOf(view), ov = G.over(view);
          ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
          ctx.fillStyle = '#5a3a22'; ctx.fillRect(0, 0, g.W, g.H);
          ctx.fillStyle = '#c9a86f'; ctx.fillRect(g.m, g.m, 6 * g.pw, g.H - 2 * g.m); ctx.fillRect(g.m + 6 * g.pw + g.barW, g.m, 6 * g.pw, g.H - 2 * g.m);
          ctx.fillStyle = '#3e2816'; ctx.fillRect(g.W - g.m - g.tray, g.m, g.tray, g.H - 2 * g.m);
          /* The 24 points as triangles. */
          for (i = 0; i < 24; i++) {
            var c = colOf(i), x0 = colX(c), top = i >= 12;
            ctx.beginPath();
            if (top) { ctx.moveTo(x0, g.m); ctx.lineTo(x0 + g.pw, g.m); ctx.lineTo(x0 + g.pw / 2, g.m + g.ph); }
            else { ctx.moveTo(x0, g.H - g.m); ctx.lineTo(x0 + g.pw, g.H - g.m); ctx.lineTo(x0 + g.pw / 2, g.H - g.m - g.ph); }
            ctx.closePath();
            ctx.fillStyle = (i % 2 === 0) === top ? '#8b5a2b' : '#efdcb0'; ctx.fill();
            var lastHere = view.last && view.last.moves.some(function (m) { return m[1] === i; });
            if (lastHere) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill(); }
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = Math.round(g.pw * 0.28) + 'px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(String(i + 1), x0 + g.pw / 2, top ? g.H / 2 - g.pw * 0.25 : g.H / 2 + g.pw * 0.45);
          }
          /* Checkers on the points, on the bar and in the trays. */
          var sourceSet = {}, targetSet = {};
          if (info && info.canAct) for (k = 0; k < steps.length; k++) { if (sel == null) sourceSet[steps[k].from] = true; else if (steps[k].from === sel) targetSet[steps[k].to] = true; }
          for (p = 0; p < 2; p++) {
            for (i = 0; i < 24; i++) {
              var n = pos.pts[p][i];
              for (k = 0; k < Math.min(n, 5); k++) { var sl = slot(i, p, k); checker(ctx, sl.x, sl.y, info.colors[p], k === Math.min(n, 5) - 1 && (sourceSet[i] || sel === i) && view.turn === p); }
              if (n > 5) { var tl = slot(i, p, 4); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(g.r) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), tl.x, tl.y); ctx.textBaseline = 'alphabetic'; }
            }
            for (k = 0; k < Math.min(pos.bar[p], 5); k++) { var bs = slot(24, p, k); checker(ctx, bs.x, bs.y, info.colors[p], k === Math.min(pos.bar[p], 5) - 1 && (sourceSet[24] || sel === 24) && view.turn === p); }
            if (pos.bar[p] > 5) { var bl = slot(24, p, 4); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(g.r) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(pos.bar[p]), bl.x, bl.y); ctx.textBaseline = 'alphabetic'; }
            for (k = 0; k < pos.off[p]; k++) { var os = slot(25, p, k); ctx.fillStyle = info.colors[p]; roundRect(ctx, os.x - g.tray * 0.38, os.y - g.r * 0.2, g.tray * 0.76, g.r * 0.4, 3); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke(); }
            if (pos.off[p]) { var ol = slot(25, p, 0); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(g.r * 0.9) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(pos.off[p]), ol.x, p === 0 ? ol.y - g.r * 1.2 : ol.y + g.r * 2); }
          }
          /* Legal targets as glowing markers. */
          if (sel != null) {
            for (var tKey in targetSet) {
              var t = +tKey, tp = view.turn, cnt = t === 25 ? pos.off[tp] : pos.pts[tp][t], ts = slot(t, tp, Math.min(cnt, 5));
              if (t === 25) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(g.W - g.m - g.tray, tp === 0 ? g.H / 2 : g.m, g.tray, g.H / 2 - g.m); }
              else { ctx.beginPath(); ctx.arc(ts.x, ts.y, g.r * 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
            }
          }
          /* Dice in the middle of the quadrant on the mover's side, used dice dimmed. */
          if (view.dice && !ov) {
            var list = diceList(view.dice), rest = remaining().slice(), size = Math.min(g.pw * 0.85, g.H * 0.11), cx = view.turn === 0 ? colX(8) + g.pw : colX(2) + g.pw;
            var gap = size * 1.25, startX = cx - gap * (list.length - 1) / 2;
            for (i = 0; i < list.length; i++) {
              var idx = rest.indexOf(list[i]), used = idx < 0;
              if (!used) rest.splice(idx, 1);
              die(ctx, startX + i * gap, g.H / 2, size, list[i], used);
            }
          }
          /* The result inside the board as well. */
          if (ov) {
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(g.W * 0.2, g.H / 2 - g.H * 0.09, g.W * 0.6, g.H * 0.18);
            ctx.fillStyle = info.colors[ov.winner]; ctx.font = 'bold ' + Math.round(g.H * 0.07) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(api.t('wins', info.names[ov.winner]), g.W / 2, g.H / 2); ctx.textBaseline = 'alphabetic';
          }
        }
        var onResize = function () { if (view) { layout(); draw(); } };
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var k = JSON.stringify(v);
            if (k !== viewKey) { viewKey = k; recompute(); }
            (inf.events || []).forEach(function (e) { if (e.e === 'dice') api.sound('dice'); else if (e.e === 'hit') api.sound('capture'); });
            layout(); draw(); setStatus();
          },
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
