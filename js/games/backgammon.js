/* Backgammon: two dice, 15 checkers each, bear them all off to win. The rules, an AI with a one ply evaluation and a
   21 roll expectation over the reply at the hard level, and a folding wooden board drawn with the kit (see docs/CONTRACT.md).
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
        var Gfx = root.Gfx;
        function div(cls, parent) { var d = document.createElement('div'); d.className = cls; if (parent) parent.appendChild(d); return d; }
        function button(key, parent) { var b = document.createElement('button'); b.className = 'bgm-btn'; b.textContent = api.t(key); parent.appendChild(b); return b; }
        /* The folding board: a dark wooden frame, two leather fields, the bar with its hinges and recess in the middle,
           the two off trays at the right. The points live in one SVG layer, the checkers are persistent elements so
           a move can fly along an arc, rings and badges sit in their own layer, the dice in another. */
        var wrap = div('bgm-wrap', el), board = div('bgm-board gfx-wood-dark', wrap);
        var fieldL = div('bgm-field', board), fieldR = div('bgm-field', board);
        var midEl = div('bgm-mid gfx-wood-dark', board), slotT = div('bgm-slot', midEl), slotB = div('bgm-slot', midEl), hingeT = div('bgm-hinge', midEl), hingeB = div('bgm-hinge', midEl);
        var trays = [div('bgm-tray', board), div('bgm-tray', board)];
        var pointsEl = div('bgm-layer', board), piecesEl = div('bgm-layer', board), ringsEl = div('bgm-layer', board), diceEl = div('bgm-layer', board), plaque = div('bgm-plaque', board);
        plaque.hidden = true;
        var ctl = div('bgm-ctl', wrap), status = div('bgm-status', ctl);
        var btnRoll = button('roll', ctl), btnUndo = button('undo', ctl), btnPass = button('pass', ctl);
        var pipsEl = div('bgm-pips', wrap);
        var style = document.createElement('style');
        style.textContent = '.bgm-wrap{width:0;min-width:100%;margin:0 auto;user-select:none;-webkit-user-select:none}' +
          '.bgm-board{position:relative;margin:0 auto;border-radius:10px;overflow:hidden;touch-action:manipulation;cursor:pointer;box-shadow:0 14px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16),inset 0 -2px 0 rgba(0,0,0,.5)}' +
          '.bgm-field{position:absolute;border-radius:3px;background-color:#c9a66a;background-image:' + Gfx.noise(23, '#c9a66a', '0.75', 2) + ';box-shadow:inset 0 3px 10px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,255,255,.25)}' +
          '.bgm-mid{position:absolute;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),-3px 0 8px rgba(0,0,0,.45),3px 0 8px rgba(0,0,0,.45)}' +
          '.bgm-slot{position:absolute;left:14%;width:72%;border-radius:4px;background:rgba(0,0,0,.38);box-shadow:inset 0 2px 6px rgba(0,0,0,.75),inset 0 -1px 0 rgba(255,255,255,.08)}' +
          '.bgm-hinge{position:absolute;left:16%;width:68%;border-radius:2px;background:linear-gradient(#f6dc8e,#a07c2a 55%,#dcb95e);box-shadow:0 1px 2px rgba(0,0,0,.7)}' +
          '.bgm-tray{position:absolute;border-radius:4px;background:rgba(0,0,0,.4);box-shadow:inset 0 2px 6px rgba(0,0,0,.75),inset 0 -1px 0 rgba(255,255,255,.08);transition:box-shadow .2s}' +
          '.bgm-tray.hot{box-shadow:inset 0 0 0 2px rgba(255,255,255,.9),0 0 14px rgba(255,240,180,.9);animation:bgmpulse 1.1s ease-in-out infinite}' +
          '.bgm-layer{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}.bgm-layer svg{display:block}' +
          '.bgm-pc{position:absolute;left:0;top:0;will-change:transform}.bgm-pc .gfx{width:100%;height:100%;transition:transform .18s,filter .18s}' +
          '.bgm-pc.lift .gfx{transform:translateY(-16%);filter:drop-shadow(0 0 5px rgba(255,236,170,.95))}' +
          '.bgm-pc.sel .gfx{transform:translateY(-34%) scale(1.08);filter:drop-shadow(0 0 7px #fff)}.bgm-pc.lift,.bgm-pc.sel,.bgm-pc.fly{z-index:60!important}' +
          '.bgm-edge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.35)}' +
          '.bgm-pc.off .gfx{display:none}.bgm-pc:not(.off) .bgm-edge{display:none}' +
          '.bgm-ring{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.92);box-shadow:0 0 10px 3px rgba(255,240,190,.6),inset 0 0 8px rgba(255,255,255,.45);animation:bgmpulse 1.1s ease-in-out infinite}' +
          '@keyframes bgmpulse{50%{box-shadow:0 0 16px 6px rgba(255,240,190,.85),inset 0 0 10px rgba(255,255,255,.55)}}' +
          '.bgm-cnt{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#1d1a17;color:#fff;font:700 11px/18px sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,255,255,.25)}' +
          '.bgm-off{position:absolute;color:#f1e6c8;font:700 12px/1 sans-serif;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,.8);width:40px;margin-left:-20px}' +
          '.bgm-die{position:absolute;transition:opacity .25s;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}.bgm-die.used{opacity:.32}.bgm-die.tumble{animation:bgmtumble .5s ease-out}' +
          '@keyframes bgmtumble{0%{transform:translateY(-34px) rotate(-220deg) scale(.6)}65%{transform:translateY(3px) rotate(18deg) scale(1.04)}100%{transform:none}}' +
          '.bgm-plaque{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(22,14,8,.86);color:#fff;padding:10px 22px;border-radius:12px;font-weight:800;font-size:18px;white-space:nowrap;box-shadow:0 8px 30px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.22)}.bgm-plaque[hidden]{display:none}' +
          '.bgm-ctl{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}.bgm-status{flex:1;min-width:120px;font-size:14px;opacity:.9}' +
          '.bgm-btn{min-height:42px;padding:8px 18px;border-radius:999px;border:0;background:linear-gradient(#f3c75c,#c48f1e);color:#2a1a05;font-weight:700;cursor:pointer;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5)}.bgm-btn[hidden]{display:none}.bgm-btn:active{transform:scale(.97)}' +
          '.bgm-pips{display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:13px;opacity:.85;flex-wrap:wrap}';
        el.appendChild(style);
        var view = null, info = null, geo = null, viewKey = '', seq = [], sel = null, work = null, maxLen = 0, byKey = {}, steps = [], seqs = [];
        var pieces = [], destroyed = false, tumbleTimer = 0, tumbleEnd = 0;
        /* The width on offer: the wrapper never pushes its container, so its width is the real room. */
        function avail() { return Math.max(300, Math.min(wrap.clientWidth || el.clientWidth || 320, 760)); }
        function fast() { return !!(root.App && root.App.fast); }
        function px(n) { return Math.round(n * 100) / 100 + 'px'; }
        function layout() {
          var W = avail(), H = Math.round(W * 0.62);
          var m = W * 0.032, tray = W * 0.085, barW = W * 0.075, fs = m * 0.6, inner = W - 2 * m - barW - tray - fs, pw = inner / 12;
          var dw = pw * 0.9, dh = dw * 0.8, step = dh * 0.8, trayH = H / 2 - m * 1.5;
          var bt = Math.min(dh * 0.35, (trayH - dh * 0.9) / 16.5);
          geo = { W: W, H: H, m: m, tray: tray, barW: barW, fs: fs, pw: pw, dw: dw, dh: dh, step: step, ph: (H - 2 * m) * 0.42, trayH: trayH, bt: bt };
          board.style.width = px(W); board.style.height = px(H);
          fieldL.style.left = px(m); fieldL.style.top = px(m); fieldL.style.width = px(6 * pw); fieldL.style.height = px(H - 2 * m);
          fieldR.style.left = px(m + 6 * pw + barW); fieldR.style.top = px(m); fieldR.style.width = px(6 * pw); fieldR.style.height = px(H - 2 * m);
          midEl.style.left = px(m + 6 * pw); midEl.style.top = '0'; midEl.style.width = px(barW); midEl.style.height = px(H);
          var slotH = H / 2 - m - dh * 0.35;
          slotT.style.top = px(m); slotT.style.height = px(slotH); slotB.style.bottom = px(m); slotB.style.height = px(slotH);
          hingeT.style.top = px(m * 0.25); hingeT.style.height = px(m * 0.5); hingeB.style.bottom = px(m * 0.25); hingeB.style.height = px(m * 0.5);
          trays[1].style.left = trays[0].style.left = px(W - m - tray); trays[1].style.width = trays[0].style.width = px(tray);
          trays[1].style.top = px(m); trays[1].style.height = px(trayH); trays[0].style.top = px(H / 2 + m * 0.5); trays[0].style.height = px(trayH);
          drawPoints();
        }
        function colX(c) { return geo.m + c * geo.pw + (c >= 6 ? geo.barW : 0); }
        function colOf(i) { return i >= 12 ? i - 12 : 11 - i; }
        /* The board location of a tap: a point index, 24 for the bar, 25 for the off trays or -1. */
        function placeAt(x, y) {
          var g = geo;
          if (x > g.W - g.m - g.tray - g.fs) return 25;
          var xr = x - g.m;
          if (xr < 0) return -1;
          if (xr >= 6 * g.pw && xr < 6 * g.pw + g.barW) return 24;
          var c = xr < 6 * g.pw ? Math.floor(xr / g.pw) : 6 + Math.floor((xr - 6 * g.pw - g.barW) / g.pw);
          if (c < 0 || c > 11) return -1;
          return y < g.H / 2 ? 12 + c : 11 - c;
        }
        /* The centre of the k-th checker on a place (0 is the first one on the point); beyond five they share the fifth slot. */
        function slot(place, p, k) {
          var g = geo, x, y, kk = Math.min(k, 4);
          if (place === 24) { x = g.m + 6 * g.pw + g.barW / 2; y = p === 0 ? g.H / 2 - g.dh * 0.95 - kk * g.step : g.H / 2 + g.dh * 0.95 + kk * g.step; return { x: x, y: y }; }
          if (place === 25) { x = g.W - g.m - g.tray / 2; y = p === 0 ? g.H - g.m - g.bt * 0.7 - k * g.bt * 1.1 : g.m + g.bt * 0.7 + k * g.bt * 1.1; return { x: x, y: y }; }
          x = colX(colOf(place)) + g.pw / 2;
          y = place >= 12 ? g.m + g.dh * 0.52 + kk * g.step : g.H - g.m - g.dh * 0.52 - kk * g.step;
          return { x: x, y: y };
        }
        function stacksDown(place, p) { return (place >= 12 && place < 24) || (place === 24 && p === 1); }
        /* The 24 points as long triangles in two alternating colours, with a gradient from base to tip, a thin
           outline, the point numbers on the frame and a sheen on the points of the last move. */
        function drawPoints() {
          var g = geo, s, i, last = {};
          if (view && view.last) view.last.moves.forEach(function (mv) { last[mv[1]] = true; });
          s = '<svg width="' + g.W + '" height="' + g.H + '" viewBox="0 0 ' + g.W + ' ' + g.H + '"><defs>';
          [['bgmAT', '#8a5428', '#5c3416', 0, 1], ['bgmAB', '#8a5428', '#5c3416', 1, 0], ['bgmBT', '#f1e2bd', '#d2b67f', 0, 1], ['bgmBB', '#f1e2bd', '#d2b67f', 1, 0]].forEach(function (d) {
            s += '<linearGradient id="' + d[0] + '" x1="0" y1="' + d[3] + '" x2="0" y2="' + d[4] + '"><stop offset="0" stop-color="' + d[1] + '"/><stop offset="1" stop-color="' + d[2] + '"/></linearGradient>';
          });
          s += '</defs>';
          var fs = Math.min(g.pw * 0.32, g.m * 0.78);
          for (i = 0; i < 24; i++) {
            var c = colOf(i), x0 = colX(c), top = i >= 12, dark = (i % 2 === 0) === top, path;
            if (top) path = 'M' + x0 + ' ' + g.m + ' L' + (x0 + g.pw) + ' ' + g.m + ' L' + (x0 + g.pw / 2) + ' ' + (g.m + g.ph) + ' Z';
            else path = 'M' + x0 + ' ' + (g.H - g.m) + ' L' + (x0 + g.pw) + ' ' + (g.H - g.m) + ' L' + (x0 + g.pw / 2) + ' ' + (g.H - g.m - g.ph) + ' Z';
            s += '<path d="' + path + '" fill="url(#' + (dark ? 'bgmA' : 'bgmB') + (top ? 'T' : 'B') + ')" stroke="rgba(50,25,8,.5)" stroke-width="1" stroke-linejoin="round"/>';
            if (last[i]) s += '<path d="' + path + '" fill="rgba(255,255,255,.16)"/>';
            if (fs >= 7) s += '<text x="' + (x0 + g.pw / 2) + '" y="' + (top ? g.m * 0.5 + fs * 0.36 : g.H - g.m * 0.5 + fs * 0.36) + '" text-anchor="middle" font-size="' + fs + '" font-family="Georgia,serif" fill="rgba(240,220,170,.6)">' + (i + 1) + '</text>';
          }
          s += '</svg>';
          pointsEl.innerHTML = s;
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
          draw(true); setStatus();
        }
        function undo() {
          if (!seq.length) return;
          seq.pop(); sel = null;
          work = clonePos(posOf(view));
          for (var i = 0; i < seq.length; i++) applyMove(work, view.turn, seq[i]);
          steps = computeSteps(); draw(true); setStatus();
        }
        board.onclick = function (ev) {
          if (!info || !info.canAct || !view || !view.dice || G.over(view)) return;
          var b = board.getBoundingClientRect(), i = placeAt(ev.clientX - b.left, ev.clientY - b.top), k;
          if (i < 0) return;
          if (sel != null) {
            for (k = 0; k < steps.length; k++) if (steps[k].from === sel && steps[k].to === i) { takeStep(steps[k]); return; }
          }
          var isSource = false;
          for (k = 0; k < steps.length; k++) if (steps[k].from === i) isSource = true;
          if (isSource && i !== sel) sel = i; else { if (!isSource && sel == null) api.sound('wrong'); sel = null; }
          draw(false); setStatus();
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
          plaque.hidden = !ov;
          if (ov) { plaque.textContent = api.t('wins', info.names[ov.winner]); plaque.style.color = Gfx.shade(info.colors[ov.winner], 0.35); }
        }
        /* ---------- the checkers as persistent elements ---------- */
        function makePiece(p, place) {
          var d = div('bgm-pc', piecesEl), edge = div('bgm-edge');
          d.innerHTML = Gfx.disc(info.colors[p], 40);
          edge.style.background = 'linear-gradient(' + Gfx.shade(info.colors[p], 0.3) + ',' + info.colors[p] + ' 50%,' + Gfx.shade(info.colors[p], -0.4) + ')';
          d.appendChild(edge);
          return { p: p, place: place, k: 0, x: -1, y: -1, el: d, edge: edge, raf: 0 };
        }
        function groupPieces() {
          var g = {};
          pieces.forEach(function (pc) { var key = pc.p + ':' + pc.place; (g[key] = g[key] || []).push(pc); });
          for (var key in g) g[key].sort(function (a, b) { return a.k - b.k; });
          return g;
        }
        function countAt(pos, p, place) { return place === 24 ? pos.bar[p] : place === 25 ? pos.off[p] : pos.pts[p][place]; }
        /* Brings the checker elements to the given position: checkers that left a place fly to the places that
           gained one, the rest stay where they are. */
        function reconcile(pos, animate) {
          var groups = groupPieces(), surplus = [[], []], deficit = [[], []], moved = [], p, place, key, arr, n, j;
          if (!pieces.length) {
            for (p = 0; p < 2; p++) for (place = 0; place < 26; place++) for (j = 0; j < countAt(pos, p, place); j++) pieces.push(makePiece(p, place));
            groups = groupPieces(); animate = false;
          }
          for (p = 0; p < 2; p++) for (place = 0; place < 26; place++) {
            key = p + ':' + place; arr = groups[key] || []; n = countAt(pos, p, place);
            if (arr.length > n) surplus[p] = surplus[p].concat(arr.slice(n));
            else for (j = arr.length; j < n; j++) deficit[p].push(place);
          }
          for (p = 0; p < 2; p++) for (j = 0; j < deficit[p].length; j++) {
            var pc = surplus[p].shift();
            if (!pc) { pc = makePiece(p, deficit[p][j]); pieces.push(pc); animate = false; }
            pc.place = deficit[p][j]; pc.k = 99; moved.push(pc);
          }
          for (p = 0; p < 2; p++) surplus[p].forEach(function (pc) { piecesEl.removeChild(pc.el); pieces.splice(pieces.indexOf(pc), 1); });
          groups = groupPieces();
          for (key in groups) groups[key].forEach(function (pc, k) { pc.k = k; });
          var delay = 0;
          pieces.forEach(function (pc) {
            var s = slot(pc.place, pc.p, pc.k), down = stacksDown(pc.place, pc.p), z = 10 + (pc.place === 25 ? pc.k : down ? Math.min(pc.k, 4) : 9 - Math.min(pc.k, 4));
            pc.el.style.width = px(geo.dw); pc.el.style.height = px(geo.dh); pc.el.style.marginLeft = px(-geo.dw / 2); pc.el.style.marginTop = px(-geo.dh / 2);
            pc.edge.style.width = px(geo.tray * 0.74); pc.edge.style.height = px(geo.bt);
            pc.el.classList.toggle('off', pc.place === 25);
            pc.z = z; pc.el.style.zIndex = z;
            var wasMoved = moved.indexOf(pc) >= 0 && pc.x >= 0;
            if (animate && !fast() && wasMoved) { fly(pc, pc.x, pc.y, s.x, s.y, delay); delay += 110; }
            else { if (pc.raf) { cancelAnimationFrame(pc.raf); pc.raf = 0; pc.el.classList.remove('fly'); } pc.el.style.transform = 'translate(' + px(s.x) + ',' + px(s.y) + ')'; }
            pc.x = s.x; pc.y = s.y;
          });
        }
        /* A checker flies along an arc: it lifts, grows a little at the top and settles on the target. */
        function fly(pc, x0, y0, x1, y1, delay) {
          var t0 = null, dur = 320, lift = geo.dh * 0.7;
          pc.el.classList.add('fly');
          function frame(ts) {
            if (destroyed) return;
            if (t0 === null) t0 = ts;
            var t = (ts - t0 - delay) / dur;
            if (t < 0) t = 0; if (t > 1) t = 1;
            var e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, a = Math.sin(Math.PI * t);
            var x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - a * lift, s = 1 + 0.18 * a;
            pc.el.style.transform = 'translate(' + px(x) + ',' + px(y) + ') scale(' + s.toFixed(3) + ')';
            if (t < 1) pc.raf = requestAnimationFrame(frame);
            else { pc.raf = 0; pc.el.classList.remove('fly'); pc.el.style.transform = 'translate(' + px(x1) + ',' + px(y1) + ')'; }
          }
          if (pc.raf) cancelAnimationFrame(pc.raf);
          pc.raf = requestAnimationFrame(frame);
        }
        /* Lifts the movable checkers, rings the legal targets, counts the tall stacks and the borne off checkers. */
        function decorate(pos) {
          var groups = groupPieces(), sourceSet = {}, targetSet = {}, k, key, h = '';
          if (info && info.canAct && !G.over(view)) for (k = 0; k < steps.length; k++) { sourceSet[steps[k].from] = true; if (sel != null && steps[k].from === sel) targetSet[steps[k].to] = true; }
          for (key in groups) {
            var arr = groups[key], top = arr[arr.length - 1], p = top.p, place = top.place;
            arr.forEach(function (pc) { pc.el.classList.remove('lift'); pc.el.classList.remove('sel'); });
            if (place === 25) {
              var ls = slot(25, p, 0);
              h += '<div class="bgm-off" style="left:' + px(ls.x) + ';top:' + px(p === 0 ? geo.H / 2 + geo.m * 0.5 + geo.bt * 0.6 : geo.H / 2 - geo.m * 0.5 - geo.bt * 0.6 - 12) + '">' + arr.length + '</div>';
              continue;
            }
            if (arr.length > 5) { var ts = slot(place, p, 4); h += '<div class="bgm-cnt" style="left:' + px(ts.x) + ';top:' + px(ts.y - geo.dh * 0.05) + ';z-index:70">' + arr.length + '</div>'; }
            if (view.turn === p && info.canAct && sourceSet[place]) top.el.classList.add(sel === place ? 'sel' : 'lift');
          }
          trays[0].classList.remove('hot'); trays[1].classList.remove('hot');
          if (sel != null) for (var tk in targetSet) {
            var t = +tk, tp = view.turn;
            if (t === 25) { trays[tp].classList.add('hot'); continue; }
            var cnt = countAt(pos, tp, t), rs = slot(t, tp, Math.min(cnt, 5)), rw = geo.dw * 0.92, rh = geo.dh * 0.5;
            h += '<div class="bgm-ring" style="left:' + px(rs.x - rw / 2) + ';top:' + px(rs.y - rh / 2 - geo.dh * 0.08) + ';width:' + px(rw) + ';height:' + px(rh) + '"></div>';
          }
          ringsEl.innerHTML = h;
        }
        /* The dice on the mover's side, used dice dimmed; a roll tumbles through random faces first. */
        function renderDice(tumble) {
          diceEl.innerHTML = '';
          if (!view.dice || G.over(view)) return;
          var g = geo, list = diceList(view.dice), rest = remaining().slice(), i;
          var size = Math.min(list.length > 2 ? g.pw * 0.78 : g.pw * 0.95, (g.H - 2 * g.m) * 0.15), gap = size * 1.25;
          var cx = (view.turn === 0 ? colX(6) : colX(0)) + 3 * g.pw, startX = cx - gap * (list.length - 1) / 2;
          for (i = 0; i < list.length; i++) {
            var idx = rest.indexOf(list[i]), used = idx < 0;
            if (!used) rest.splice(idx, 1);
            var d = div('bgm-die' + (used ? ' used' : '') + (tumble && !used ? ' tumble' : ''), diceEl);
            d.style.left = px(startX + i * gap - size / 2); d.style.top = px(g.H / 2 - size * 0.55); d.style.width = px(size);
            d.innerHTML = Gfx.die(list[i], size); d.dataset.v = list[i];
          }
          if (tumble) {
            clearInterval(tumbleTimer); tumbleEnd = Date.now() + 420;
            tumbleTimer = setInterval(function () {
              var ds = diceEl.querySelectorAll('.bgm-die.tumble'), done = Date.now() >= tumbleEnd, j;
              for (j = 0; j < ds.length; j++) ds[j].innerHTML = Gfx.die(done ? +ds[j].dataset.v : 1 + Math.floor(Math.random() * 6), parseFloat(ds[j].style.width));
              if (done) clearInterval(tumbleTimer);
            }, 70);
          }
        }
        function draw(animate, tumble) {
          if (!view || !geo) return;
          var pos = work || posOf(view);
          reconcile(pos, animate);
          decorate(pos);
          renderDice(tumble);
        }
        var onResize = function () { if (view) { layout(); draw(false); } };
        window.addEventListener('resize', onResize);
        /* The first update may run before the panel has its final width: measure again on the next frame and on every resize of the panel. */
        var ro = null, raf = requestAnimationFrame(onResize);
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(function () { if (view && geo && avail() !== geo.W) onResize(); }); ro.observe(el); }
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var k = JSON.stringify(v), changed = k !== viewKey, evs = inf.events || [];
            if (changed) { viewKey = k; recompute(); }
            evs.forEach(function (e) { if (e.e === 'dice') api.sound('dice'); else if (e.e === 'hit') api.sound('capture'); });
            if (!geo || avail() !== geo.W) layout(); else drawPoints();
            draw(changed, !fast() && evs.some(function (e) { return e.e === 'dice'; }));
            setStatus();
          },
          destroy: function () { destroyed = true; clearInterval(tumbleTimer); cancelAnimationFrame(raf); if (ro) ro.disconnect(); pieces.forEach(function (pc) { if (pc.raf) cancelAnimationFrame(pc.raf); }); window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
