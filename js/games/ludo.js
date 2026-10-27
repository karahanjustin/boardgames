/* Mensch ärgere Dich nicht / Ludo: the classic cross board with 40 track squares, four pieces per player in the house,
   a start square and a four square home column each. Rules, a dice aware AI and a DOM board, following
   docs/CONTRACT.md. Positions are stored relative to the owner's start square: -1 is the house, 0 to 39 the track
   (0 is the start square), 40 to 43 the home column. */
(function (root) {
  'use strict';
  var TRACK = 40, HOME = 4, PIECES = 4, LAST = TRACK + HOME - 1;
  /* Which of the four seats the players take; two players sit opposite each other. */
  var SEATS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
  /* The 40 track squares on the 11 by 11 cross as [column, row], clockwise, starting on the left arm. Seat k starts
     on square 10 * k and enters its home column from the square before it. */
  var CELLS = (function () {
    var t = [], c, r;
    for (c = 0; c <= 4; c++) t.push([c, 4]);
    for (r = 3; r >= 0; r--) t.push([4, r]);
    t.push([5, 0]);
    for (r = 0; r <= 4; r++) t.push([6, r]);
    for (c = 7; c <= 10; c++) t.push([c, 4]);
    t.push([10, 5]);
    for (c = 10; c >= 6; c--) t.push([c, 6]);
    for (r = 7; r <= 10; r++) t.push([6, r]);
    t.push([5, 10]);
    for (r = 10; r >= 6; r--) t.push([4, r]);
    for (c = 3; c >= 0; c--) t.push([c, 6]);
    t.push([0, 5]);
    return t;
  })();
  /* The home columns (from the entry towards the centre) and the houses per seat, four [column, row] cells each. */
  var HOMECOL = [[[1, 5], [2, 5], [3, 5], [4, 5]], [[5, 1], [5, 2], [5, 3], [5, 4]], [[9, 5], [8, 5], [7, 5], [6, 5]], [[5, 9], [5, 8], [5, 7], [5, 6]]];
  var HOUSE = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[9, 0], [10, 0], [9, 1], [10, 1]], [[9, 9], [10, 9], [9, 10], [10, 10]], [[0, 9], [1, 9], [0, 10], [1, 10]]];

  function absSq(s, p, rel) { return (s.seats[p] * 10 + rel) % TRACK; }
  /* The index of the own piece standing on the relative square, or -1. */
  function ownAt(s, p, rel) { for (var j = 0; j < PIECES; j++) if (s.pos[p][j] === rel) return j; return -1; }
  /* The enemy piece on an absolute track square, or null. */
  function enemyAt(s, p, sq) {
    for (var q = 0; q < s.n; q++) {
      if (q === p) continue;
      for (var j = 0; j < PIECES; j++) { var r = s.pos[q][j]; if (r >= 0 && r < TRACK && absSq(s, q, r) === sq) return { p: q, i: j }; }
    }
    return null;
  }
  function inHouse(s, p) { var c = 0; for (var j = 0; j < PIECES; j++) if (s.pos[p][j] < 0) c++; return c; }
  function allHome(pos) { for (var j = 0; j < PIECES; j++) if (pos[j] < TRACK) return false; return true; }
  /* The relative square the piece would reach with this die, or -1 when the move is not allowed: a piece leaves the
     house only with a six onto a free start square, nothing may overshoot the last home square, and own pieces may
     neither be jumped over nor landed on. */
  function target(s, p, i, die) {
    var rel = s.pos[p][i], t, k;
    if (rel < 0) { if (die !== 6) return -1; return ownAt(s, p, 0) >= 0 ? -1 : 0; }
    t = rel + die;
    if (t > LAST) return -1;
    for (k = rel + 1; k <= t; k++) if (ownAt(s, p, k) >= 0) return -1;
    return t;
  }
  /* The pieces that may move with this die, with the forcing rules applied: a piece on the start square has to move
     on while pieces wait in the house, a six has to bring a piece out while the start square is free, and the pieces
     in the house are interchangeable, so only the first of them is listed. */
  function movable(s, p, die) {
    var out = [], i, startPiece = ownAt(s, p, 0), house = inHouse(s, p), seenHouse = false;
    if (house > 0 && startPiece >= 0 && target(s, p, startPiece, die) >= 0) return [startPiece];
    if (die === 6 && house > 0 && startPiece < 0) { for (i = 0; i < PIECES; i++) if (s.pos[p][i] < 0) return [i]; }
    for (i = 0; i < PIECES; i++) {
      if (s.pos[p][i] < 0) { if (seenHouse) continue; seenHouse = true; }
      if (target(s, p, i, die) >= 0) out.push(i);
    }
    return out;
  }
  /* True when no piece of the player can move with any die: nothing on the track and every home piece packed in. */
  function stuck(s, p) {
    for (var i = 0; i < PIECES; i++) {
      var r = s.pos[p][i];
      if (r >= 0 && r < TRACK) return false;
      if (r >= TRACK) for (var k = r + 1; k <= LAST; k++) if (ownAt(s, p, k) < 0) return false;
    }
    return true;
  }
  function nextPlayer(s, p) {
    var q = p;
    do { q = (q + 1) % s.n; } while (s.finished.indexOf(q) >= 0 && q !== p);
    return q;
  }
  function endTurn(next, p) { next.die = 0; next.tries = 0; next.turn = nextPlayer(next, p); }
  /* How many enemy pieces could reach the player's relative square with their next roll. A piece in the house
     threatens its own start square. */
  function threats(s, p, rel) {
    if (rel < 0 || rel >= TRACK) return 0;
    var sq = absSq(s, p, rel), c = 0, q, j, r, d;
    for (q = 0; q < s.n; q++) {
      if (q === p) continue;
      for (j = 0; j < PIECES; j++) {
        r = s.pos[q][j];
        if (r < 0) { if (absSq(s, q, 0) === sq) c++; continue; }
        if (r >= TRACK) continue;
        for (d = 1; d <= 6; d++) if (r + d < TRACK && absSq(s, q, r + d) === sq) c++;
      }
    }
    return c;
  }
  /* The value of a piece: nothing in the house, progress on the track, a safe bonus at home. */
  function pieceValue(r) { return r < 0 ? 0 : r >= TRACK ? 52 : 4 + r; }
  /* A one ply evaluation from the view of player p: own material against the average of the others, each piece
     discounted by the chance of being hit before it moves again. */
  function evaluate(s, p) {
    var v = 0, q, j, r, val;
    for (q = 0; q < s.n; q++) {
      val = 0;
      for (j = 0; j < PIECES; j++) {
        r = s.pos[q][j];
        val += pieceValue(r);
        if (r >= 0 && r < TRACK) val -= Math.min(1, threats(s, q, r) * 0.2) * (4 + r);
      }
      v += q === p ? val : -val / (s.n - 1);
    }
    return v;
  }
  var DOTS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  var G = {
    id: 'ludo',
    name: { de: 'Mensch ärgere Dich nicht', en: 'Ludo' },
    blurb: { de: 'Würfeln, rauskommen, schlagen, alle vier nach Hause bringen.', en: 'Roll, get out, capture, bring all four home.' },
    icon: '🎲',
    counts: [2, 3, 4],
    ai: true,
    hidden: false,
    strings: {
      de: {
        roll: 'Würfeln', pass: 'Weiter', rollHint: 'Du bist dran, würfle', pickHint: 'Tippe eine markierte Figur an', noMove: 'Keine Figur kann ziehen',
        again: 'Eine Sechs, du darfst noch einmal', tries: 'Versuch {0} von 3', captured: '{0} wurde geschlagen', finished: '{0} hat alle Figuren im Ziel',
        rules: 'Jeder hat vier Figuren im Haus. Nur mit einer Sechs kommt eine Figur auf das Startfeld, danach darf noch einmal gewürfelt werden; wer nichts auf dem Brett hat, würfelt bis zu dreimal. Eine Figur auf dem Startfeld muss weiterziehen, solange noch Figuren im Haus warten. Wer auf eine fremde Figur trifft, schlägt sie zurück ins Haus; eigene Figuren dürfen weder übersprungen noch besetzt werden. Wer ziehen kann, muss ziehen. In die vier Zielfelder kommt man nur mit der passenden Augenzahl. Wer zuerst alle vier Figuren im Ziel hat, gewinnt; bei mehr als zwei Spielern wird um die weiteren Plätze weitergespielt.'
      },
      en: {
        roll: 'Roll', pass: 'Continue', rollHint: 'Your turn, roll the die', pickHint: 'Tap a highlighted piece', noMove: 'No piece can move',
        again: 'A six, roll again', tries: 'Try {0} of 3', captured: '{0} was sent home', finished: '{0} has brought every piece home',
        rules: 'Everyone has four pieces in the house. Only a six brings a piece onto the start square and grants another roll; a player with nothing on the board may roll up to three times. A piece on the start square has to move on while pieces are still waiting in the house. Landing on an opposing piece sends it home; your own pieces can neither be jumped over nor landed on. If you can move, you must. The four home squares are reached only with the exact number. The first to bring all four pieces home wins; with more than two players the game goes on for the remaining places.'
      }
    },
    create: function (cfg) {
      var n = cfg.n, pos = [];
      for (var p = 0; p < n; p++) pos.push([-1, -1, -1, -1]);
      return { n: n, seats: SEATS[n].slice(), pos: pos, turn: 0, die: 0, tries: 0, finished: [], last: null };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      if (s.die === 0) return [{ roll: true }];
      var mv = movable(s, p, s.die);
      if (!mv.length) return [{ pass: true }];
      return mv.map(function (i) { return { move: i }; });
    },
    apply: function (s, p, a, rng) {
      var next = JSON.parse(JSON.stringify(s)), ev = [], i, from, t, hit;
      if (a.roll) {
        next.die = 1 + rng.int(6);
        ev.push({ e: 'dice', v: next.die });
        return { state: next, events: ev };
      }
      if (a.pass) {
        if (s.die === 6) next.die = 0;
        else if (stuck(s, p) && s.tries < 2) { next.tries = s.tries + 1; next.die = 0; }
        else endTurn(next, p);
        return { state: next, events: ev };
      }
      i = a.move; from = s.pos[p][i]; t = target(s, p, i, s.die);
      next.pos[p][i] = t; next.tries = 0;
      if (from < 0) ev.push({ e: 'out', p: p, i: i });
      if (t < TRACK) {
        hit = enemyAt(s, p, absSq(s, p, t));
        if (hit) { next.pos[hit.p][hit.i] = -1; ev.push({ e: 'capture', p: hit.p, i: hit.i, by: p }); }
      }
      ev.push({ e: 'move', p: p, i: i, from: from, to: t });
      if (t >= TRACK) ev.push({ e: 'home', p: p, i: i });
      next.last = { p: p, i: i, from: from, to: t };
      if (allHome(next.pos[p])) { next.finished.push(p); ev.push({ e: 'finish', p: p, place: next.finished.length }); endTurn(next, p); }
      else if (s.die === 6) next.die = 0;
      else endTurn(next, p);
      return { state: next, events: ev };
    },
    over: function (s) {
      var need = s.n === 2 ? 1 : s.n - 1;
      if (s.finished.length < need) return null;
      var ranking = s.finished.slice();
      for (var p = 0; p < s.n; p++) if (ranking.indexOf(p) < 0) ranking.push(p);
      return { winner: ranking[0], ranking: ranking };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (acts[0].roll || acts[0].pass) return acts[0];
      if (level === 1) return rng.pick(acts);
      var best = null, bv = -1e9;
      acts.forEach(function (a) {
        var from = s.pos[p][a.move], t = target(s, p, a.move, s.die), v;
        if (level === 2) {
          v = t * 0.05 + rng.next();
          if (from < 0) v += 6;
          if (t >= TRACK) v += 4;
          else if (enemyAt(s, p, absSq(s, p, t))) v += 10;
        } else {
          v = evaluate(G.apply(s, p, a, rng).state, p) + rng.next() * 0.1;
        }
        if (v > bv) { bv = v; best = a; }
      });
      return best;
    },
    ui: {
      mount: function (el, api) {
        var Gfx = root.Gfx;
        var wrap = document.createElement('div'); wrap.className = 'ludo';
        var board = document.createElement('div'); board.className = 'ludo-board gfx-paper gfx-frame';
        var side = document.createElement('div'); side.className = 'ludo-side';
        var dieBox = document.createElement('button'); dieBox.className = 'ludo-die'; dieBox.type = 'button';
        var btn = document.createElement('button'); btn.className = 'ludo-btn'; btn.type = 'button';
        var hint = document.createElement('div'); hint.className = 'ludo-hint';
        side.appendChild(dieBox); side.appendChild(btn); side.appendChild(hint);
        wrap.appendChild(board); wrap.appendChild(side); el.appendChild(wrap);
        /* The cross takes 11 by 11 cells; the paper keeps 0.85 cells of headroom above it so the tallest figure in
           the top row ends at the frame, and a quarter cell below. Horizontal sizes are percent of the width, vertical
           sizes percent of the height. */
        var UX = 100 / 11, UY = 100 / 12.1, OY = 0.85, PW = UX, PH = UY * 58 / 40;
        var style = document.createElement('style');
        style.textContent = '.ludo{display:flex;flex-direction:column;align-items:center;gap:14px}' +
          '.ludo-board{position:relative;width:min(100%,560px);aspect-ratio:110/121;border-radius:4px}' +
          '.ludo-board>svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}' +
          '.ludo-piece{position:absolute;width:' + PW + '%;height:' + PH + '%;transition:left .09s linear,top .09s linear,transform .2s ease,filter .2s ease;z-index:2;cursor:default}' +
          '.ludo-piece svg{width:100%;height:100%;display:block;overflow:visible}' +
          '.ludo-piece{isolation:isolate}.ludo-piece:before{content:"";position:absolute;left:2%;width:96%;top:78%;height:30%;border-radius:50%;z-index:-1;opacity:0;background:radial-gradient(ellipse at center,rgba(255,255,255,.95) 0,var(--pc) 40%,transparent 72%);box-shadow:0 0 10px 3px var(--pc);transition:opacity .2s}' +
          '.ludo-piece.ludo-can{cursor:pointer;z-index:20;animation:ludoLift 1.1s ease-in-out infinite}.ludo-piece.ludo-can:before{opacity:.95;animation:ludoGlow 1.1s ease-in-out infinite}' +
          '@keyframes ludoGlow{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}' +
          '@keyframes ludoLift{0%,100%{transform:translateY(-5%)}50%{transform:translateY(-11%)}}' +
          '.ludo-piece.ludo-hop{animation:ludoHop var(--hop,90ms) ease-out}' +
          '@keyframes ludoHop{0%{transform:translateY(0) scale(1)}45%{transform:translateY(-28%) scale(1.08)}100%{transform:translateY(0) scale(1)}}' +
          '.ludo-piece.ludo-pop{animation:ludoPop .28s ease-in forwards;z-index:30}' +
          '@keyframes ludoPop{0%{transform:scale(1);opacity:1}100%{transform:scale(1.7) translateY(-30%);opacity:0}}' +
          '.ludo-piece.ludo-in{animation:ludoIn .3s ease-out}' +
          '@keyframes ludoIn{0%{transform:scale(.3) translateY(-60%);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}' +
          '.ludo-side{display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center}' +
          '.ludo-die{width:84px;height:84px;padding:4px 4px 0;border:0;background:transparent;border-radius:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--turn,#888);transition:box-shadow .3s}' +
          '.ludo-die svg{width:70px;height:77px;display:block;transition:transform .05s linear}' +
          '.ludo-die.ludo-tumble svg{animation:ludoTumble .35s ease-out}' +
          '@keyframes ludoTumble{0%{transform:translateY(-40%) rotate(-30deg) scale(1.15)}60%{transform:translateY(8%) rotate(10deg) scale(.95)}100%{transform:translateY(0) rotate(0) scale(1)}}' +
          '.ludo-btn{min-height:46px;padding:0 28px;border-radius:999px;border:0;font-size:17px;font-weight:700;cursor:pointer;background:#2456c8;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.25)}' +
          '.ludo-btn:active{transform:translateY(1px)}' +
          '.ludo-hint{width:100%;text-align:center;font-size:14px;opacity:.85;min-height:1.4em}';
        el.appendChild(style);
        /* The printed board, drawn once per match as an SVG: thin track lines, the circles with a drop of shadow,
           the coloured start fields, home columns and houses, and an arrow from each house to its start field. */
        var ARROWS = [[[5, 21], [5, 38]], [[89, 5], [72, 5]], [[105, 89], [105, 72]], [[21, 105], [38, 105]]];
        function cx(cr) { return cr[0] * 10 + 5; }
        function cy(cr) { return cr[1] * 10 + 5; }
        function field(cr, fill, rim, seat) {
          var x = cx(cr), y = cy(cr);
          return '<circle cx="' + (x + 0.35) + '" cy="' + (y + 0.55) + '" r="3.9" fill="rgba(60,40,20,.22)"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="3.9" fill="' + fill + '" stroke="' + rim + '" stroke-width="0.45"/>' +
            (seat ? '<circle cx="' + x + '" cy="' + y + '" r="3.1" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="0.7"/>' :
              '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="none" stroke="rgba(90,70,40,.18)" stroke-width="0.6"/>');
        }
        function buildBoard(seatColor) {
          var s = '<svg viewBox="0 -8.5 110 121" xmlns="http://www.w3.org/2000/svg">', k, seat, col, a, dx, dy, len, ux, uy;
          s += '<path d="M' + CELLS.map(function (cr) { return cx(cr) + ' ' + cy(cr); }).join(' L') + ' Z" fill="none" stroke="rgba(70,50,30,.55)" stroke-width="0.5"/>';
          for (seat = 0; seat < 4; seat++) {
            col = seatColor[seat];
            s += '<path d="M' + cx(CELLS[seat * 10]) + ' ' + cy(CELLS[seat * 10]) + ' L' + HOMECOL[seat].map(function (cr) { return cx(cr) + ' ' + cy(cr); }).join(' L') + '" fill="none" stroke="rgba(70,50,30,.45)" stroke-width="0.5"/>';
            a = ARROWS[seat]; dx = a[1][0] - a[0][0]; dy = a[1][1] - a[0][1]; len = Math.sqrt(dx * dx + dy * dy); ux = dx / len; uy = dy / len;
            s += '<path d="M' + a[0][0] + ' ' + a[0][1] + ' L' + (a[1][0] - ux * 3) + ' ' + (a[1][1] - uy * 3) + '" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round"/>' +
              '<path d="M' + a[1][0] + ' ' + a[1][1] + ' L' + (a[1][0] - ux * 4.2 - uy * 2.6) + ' ' + (a[1][1] - uy * 4.2 + ux * 2.6) + ' L' + (a[1][0] - ux * 4.2 + uy * 2.6) + ' ' + (a[1][1] - uy * 4.2 - ux * 2.6) + ' Z" fill="' + col + '"/>';
          }
          for (k = 0; k < CELLS.length; k++) {
            seat = k % 10 === 0 ? k / 10 : -1;
            s += seat >= 0 ? field(CELLS[k], seatColor[seat], Gfx.shade(seatColor[seat], -0.45), true) : field(CELLS[k], '#fdfaf1', '#4a3b2a', false);
          }
          for (seat = 0; seat < 4; seat++) {
            col = seatColor[seat];
            HOMECOL[seat].forEach(function (cr) { s += field(cr, col, Gfx.shade(col, -0.45), true); });
            HOUSE[seat].forEach(function (cr) { s += field(cr, col, Gfx.shade(col, -0.45), true); });
          }
          return s + '</svg>';
        }
        var pieceEls = [], view = null, info = null, acts = [], timers = [], built = false, busyUntil = {};
        var dieTimers = [];
        function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
        function clearTimers() { timers.concat(dieTimers).forEach(clearTimeout); timers = []; dieTimers = []; }
        /* Animations are queued per figure: a new move of a figure starts when its pending one has ended, so a
           six followed by a second move plays as two hops in a row, and the host's next update never cuts it. */
        function pending(key) { return (busyUntil[key] || 0) > Date.now(); }
        function startAt(key) { return Math.max(Date.now(), busyUntil[key] || 0); }
        function at(key, t, fn) { later(fn, Math.max(0, t - Date.now())); if (t > (busyUntil[key] || 0)) busyUntil[key] = t; }
        function coords(v, p, i) { return relCoords(v, p, i, v.pos[p][i]); }
        function relCoords(v, p, i, r) {
          var seat = v.seats[p];
          if (r < 0) return HOUSE[seat][i];
          if (r < TRACK) return CELLS[(seat * 10 + r) % TRACK];
          return HOMECOL[seat][r - TRACK];
        }
        /* A figure stands with its base on the circle: the base ellipse sits at 93 percent of the figure's height. */
        function place(node, cr, instant) {
          if (instant) node.style.transition = 'none';
          node.style.left = (cr[0] * UX) + '%';
          node.style.top = ((cr[1] + OY + 0.5) * UY - PH * 0.93) + '%';
          node.style.zIndex = node.classList.contains('ludo-can') ? 20 : 2 + cr[1];
          if (instant) { void node.offsetWidth; node.style.transition = ''; }
        }
        function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
        function showDie(v, cls) { dieBox.innerHTML = Gfx.die(v, 70); if (cls) restart(dieBox, cls); }
        function hasAct(test) { return acts.some(test); }
        function roll() {
          if (!info || !info.canAct) return;
          if (hasAct(function (a) { return a.roll; })) api.act({ roll: true });
          else if (hasAct(function (a) { return a.pass; })) api.act({ pass: true });
        }
        btn.onclick = roll; dieBox.onclick = roll;
        function onPiece(ev) {
          if (!info || !info.canAct || !view) return;
          var p = +ev.currentTarget.dataset.p, i = +ev.currentTarget.dataset.i;
          if (p !== info.me) return;
          if (hasAct(function (a) { return a.move === i; })) api.act({ move: i });
          else api.sound('wrong');
        }
        /* The figure hops square by square from its old square to the new one, one hop per square, the whole move
           inside about 400 ms so the next turn never catches it half way. Returns the duration. */
        function hopAlong(node, v, p, i, from, to) {
          var path = [], k, per, key = p + ':' + i, t0 = startAt(key);
          if (from < 0) path.push(0); else for (k = from + 1; k <= to; k++) path.push(k);
          per = Math.min(95, Math.round(400 / path.length));
          at(key, t0, function () { node.style.setProperty('--hop', per + 'ms'); place(node, relCoords(v, p, i, from), true); });
          path.forEach(function (r, idx) {
            at(key, t0 + idx * per + 10, function () { place(node, relCoords(v, p, i, r)); restart(node, 'ludo-hop'); });
          });
          at(key, t0 + path.length * per + 20, function () { node.classList.remove('ludo-hop'); });
          return t0 + path.length * per + 20;
        }
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), p, i, node, seatColor = ['#cfc5b0', '#cfc5b0', '#cfc5b0', '#cfc5b0'];
            for (p = 0; p < v.n; p++) seatColor[v.seats[p]] = inf.colors[p];
            if (!built) {
              built = true;
              board.innerHTML = buildBoard(seatColor);
              for (p = 0; p < v.n; p++) {
                pieceEls.push([]);
                for (i = 0; i < PIECES; i++) {
                  node = document.createElement('div'); node.className = 'ludo-piece'; node.dataset.p = p; node.dataset.i = i;
                  node.style.setProperty('--pc', inf.colors[p]); node.innerHTML = Gfx.pawn(inf.colors[p], 40);
                  node.onclick = onPiece; board.appendChild(node); pieceEls[p].push(node);
                }
              }
            }
            acts = inf.canAct && !ov ? G.actions(v, inf.me) : [];
            var ev = inf.events || [], moved = null, hit = null, fast = root.App && root.App.fast;
            ev.forEach(function (e) { if (e.e === 'move') moved = e; else if (e.e === 'capture') hit = e; });
            if (fast) { moved = null; hit = null; busyUntil = {}; }
            for (p = 0; p < v.n; p++) for (i = 0; i < PIECES; i++) {
              node = pieceEls[p][i];
              node.classList.toggle('ludo-can', p === inf.me && hasAct(function (a) { return a.move === i; }));
              if (pending(p + ':' + i)) continue;
              node.classList.remove('ludo-hop'); node.classList.remove('ludo-pop'); node.classList.remove('ludo-in');
              if (moved && moved.p === p && moved.i === i) place(node, relCoords(v, p, i, moved.from), true);
              else if (hit && hit.p === p && hit.i === i) place(node, relCoords(v, moved.p, moved.i, moved.to), true);
              else place(node, coords(v, p, i), true);
            }
            if (moved) {
              var mover = pieceEls[moved.p][moved.i], tEnd = hopAlong(mover, v, moved.p, moved.i, moved.from, moved.to);
              if (hit) {
                /* The hit figure waits on the square, pops away when the mover arrives and drops back into its house. */
                var victim = pieceEls[hit.p][hit.i], vkey = hit.p + ':' + hit.i;
                at(vkey, tEnd, function () { restart(victim, 'ludo-pop'); api.sound('capture'); });
                at(vkey, tEnd + 300, function () { victim.classList.remove('ludo-pop'); place(victim, coords(v, hit.p, hit.i), true); restart(victim, 'ludo-in'); });
                at(vkey, tEnd + 620, function () { victim.classList.remove('ludo-in'); });
              }
            }
            if (ev.some(function (e) { return e.e === 'dice'; }) && !fast) {
              /* The die tumbles: seven faces in quick succession, then the value. */
              var faces = 7, f;
              dieTimers.forEach(clearTimeout); dieTimers = [];
              for (f = 0; f < faces; f++) (function (idx) {
                dieTimers.push(setTimeout(function () {
                  if (idx < faces - 1) { showDie(1 + Math.floor(Math.random() * 6)); dieBox.firstChild.style.transform = 'rotate(' + (Math.random() * 50 - 25) + 'deg) scale(' + (1 + Math.random() * 0.1) + ')'; }
                  else showDie(v.die, 'ludo-tumble');
                }, idx * 50));
              })(f);
              api.sound('dice');
            } else { dieTimers.forEach(clearTimeout); dieTimers = []; showDie(v.die); }
            if (!hit && moved) api.sound('move');
            else if (hit && fast) api.sound('capture');
            var canRoll = hasAct(function (a) { return a.roll; }), canPass = hasAct(function (a) { return a.pass; });
            btn.style.display = canRoll || canPass ? '' : 'none';
            btn.textContent = canRoll ? api.t('roll') : api.t('pass');
            if (ov) hint.textContent = api.t('wins', inf.names[ov.winner]);
            else if (!inf.canAct) hint.textContent = api.t('wait', inf.names[v.turn]);
            else if (canRoll) hint.textContent = v.tries > 0 ? api.t('tries', v.tries + 1) : api.t('rollHint');
            else if (canPass) hint.textContent = api.t('noMove');
            else hint.textContent = api.t('pickHint');
            dieBox.style.setProperty('--turn', ov ? '#888' : inf.colors[v.turn]);
          },
          destroy: function () { clearTimers(); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
