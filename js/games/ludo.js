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
        var wrap = document.createElement('div'); wrap.className = 'ludo';
        var board = document.createElement('div'); board.className = 'ludo-board';
        var side = document.createElement('div'); side.className = 'ludo-side';
        var die = document.createElement('div'); die.className = 'ludo-die';
        for (var k = 0; k < 9; k++) die.appendChild(document.createElement('i'));
        var btn = document.createElement('button'); btn.className = 'ludo-btn';
        var hint = document.createElement('div'); hint.className = 'ludo-hint';
        side.appendChild(die); side.appendChild(btn); side.appendChild(hint);
        wrap.appendChild(board); wrap.appendChild(side); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.ludo{display:flex;flex-direction:column;align-items:center;gap:14px}' +
          '.ludo-board{position:relative;width:min(100%,520px);aspect-ratio:1;background:#f4ead3;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}' +
          '.ludo-cell{position:absolute;width:9.0909%;height:9.0909%}.ludo-cell:before{content:"";position:absolute;inset:11%;border-radius:50%;background:#fff;border:2px solid #b8a37c;box-sizing:border-box}' +
          '.ludo-cell.s0:before{background:var(--s0)}.ludo-cell.s1:before{background:var(--s1)}.ludo-cell.s2:before{background:var(--s2)}.ludo-cell.s3:before{background:var(--s3)}' +
          '.ludo-cell.house:before,.ludo-cell.home:before{opacity:.75}.ludo-cell.start:before{border-color:#333}' +
          '.ludo-piece{position:absolute;width:9.0909%;height:9.0909%;transition:left .45s ease,top .45s ease;z-index:2}' +
          '.ludo-piece:before{content:"";position:absolute;inset:14%;border-radius:50%;background:var(--pc);box-shadow:inset -2px -4px 0 rgba(0,0,0,.3),inset 2px 3px 0 rgba(255,255,255,.35),0 2px 4px rgba(0,0,0,.45)}' +
          '.ludo-piece.can{cursor:pointer;z-index:3}.ludo-piece.can:before{outline:3px solid #fff;animation:ludoPulse 1s ease-in-out infinite}' +
          '.ludo-piece.last:before{box-shadow:0 0 0 2px rgba(0,0,0,.5),inset -2px -4px 0 rgba(0,0,0,.3)}' +
          '@keyframes ludoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}' +
          '.ludo-side{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center}' +
          '.ludo-die{width:64px;height:64px;border-radius:12px;background:#fff;display:grid;grid-template-columns:repeat(3,1fr);padding:9px;gap:4px;box-sizing:border-box;box-shadow:0 0 0 3px var(--turn,#888),0 4px 10px rgba(0,0,0,.3)}' +
          '.ludo-die i{border-radius:50%;background:#222;display:block;visibility:hidden}.ludo-die.rolling{animation:ludoRoll .6s ease}' +
          '@keyframes ludoRoll{0%{transform:rotate(0) scale(1)}50%{transform:rotate(200deg) scale(1.25)}100%{transform:rotate(360deg) scale(1)}}' +
          '.ludo-btn{padding:10px 22px;border-radius:999px;border:0;font-size:16px;font-weight:600;cursor:pointer;background:#2456c8;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.3)}' +
          '.ludo-hint{width:100%;text-align:center;font-size:14px;opacity:.85}';
        el.appendChild(style);
        var U = 100 / 11;
        function place(node, cr) { node.style.left = (cr[0] * U) + '%'; node.style.top = (cr[1] * U) + '%'; }
        function cell(cr, cls) { var d = document.createElement('div'); d.className = 'ludo-cell ' + cls; place(d, cr); board.appendChild(d); }
        CELLS.forEach(function (cr, idx) { cell(cr, 'track' + (idx % 10 === 0 ? ' start s' + (idx / 10) : '')); });
        for (var seat = 0; seat < 4; seat++) {
          HOMECOL[seat].forEach(function (cr) { cell(cr, 'home s' + seat); });
          HOUSE[seat].forEach(function (cr) { cell(cr, 'house s' + seat); });
        }
        var pieceEls = [], view = null, info = null, acts = [];
        function coords(v, p, i) {
          var r = v.pos[p][i], seat = v.seats[p];
          if (r < 0) return HOUSE[seat][i];
          if (r < TRACK) return CELLS[(seat * 10 + r) % TRACK];
          return HOMECOL[seat][r - TRACK];
        }
        function showDie(v) { for (var k = 0; k < 9; k++) die.children[k].style.visibility = v && DOTS[v].indexOf(k) >= 0 ? 'visible' : 'hidden'; }
        function hasAct(test) { return acts.some(test); }
        btn.onclick = function () {
          if (!info || !info.canAct) return;
          if (hasAct(function (a) { return a.roll; })) api.act({ roll: true });
          else if (hasAct(function (a) { return a.pass; })) api.act({ pass: true });
        };
        function onPiece(ev) {
          if (!info || !info.canAct || !view) return;
          var p = +ev.currentTarget.dataset.p, i = +ev.currentTarget.dataset.i;
          if (p !== info.me) return;
          if (hasAct(function (a) { return a.move === i; })) api.act({ move: i });
          else api.sound('wrong');
        }
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var ov = G.over(v), p, i, node, seatColor = ['#9aa0a6', '#9aa0a6', '#9aa0a6', '#9aa0a6'];
            for (p = 0; p < v.n; p++) seatColor[v.seats[p]] = inf.colors[p];
            for (i = 0; i < 4; i++) board.style.setProperty('--s' + i, seatColor[i]);
            if (!pieceEls.length) {
              for (p = 0; p < v.n; p++) {
                pieceEls.push([]);
                for (i = 0; i < PIECES; i++) {
                  node = document.createElement('div'); node.className = 'ludo-piece'; node.dataset.p = p; node.dataset.i = i;
                  node.style.setProperty('--pc', inf.colors[p]); node.onclick = onPiece; board.appendChild(node); pieceEls[p].push(node);
                }
              }
            }
            acts = inf.canAct && !ov ? G.actions(v, inf.me) : [];
            for (p = 0; p < v.n; p++) for (i = 0; i < PIECES; i++) {
              node = pieceEls[p][i]; place(node, coords(v, p, i));
              node.classList.toggle('can', p === inf.me && hasAct(function (a) { return a.move === i; }));
              node.classList.toggle('last', !!v.last && v.last.p === p && v.last.i === i);
            }
            var ev = inf.events || [];
            if (ev.some(function (e) { return e.e === 'dice'; })) {
              die.classList.remove('rolling');
              void die.offsetWidth;
              die.classList.add('rolling');
              api.sound('dice');
            }
            showDie(v.die);
            if (ev.some(function (e) { return e.e === 'capture'; })) api.sound('capture');
            else if (ev.some(function (e) { return e.e === 'move'; })) api.sound('move');
            var canRoll = hasAct(function (a) { return a.roll; }), canPass = hasAct(function (a) { return a.pass; });
            btn.style.display = canRoll || canPass ? '' : 'none';
            btn.textContent = canRoll ? api.t('roll') : api.t('pass');
            if (ov) hint.textContent = api.t('wins', inf.names[ov.winner]);
            else if (!inf.canAct) hint.textContent = api.t('wait', inf.names[v.turn]);
            else if (canRoll) hint.textContent = v.tries > 0 ? api.t('tries', v.tries + 1) : api.t('rollHint');
            else if (canPass) hint.textContent = api.t('noMove');
            else hint.textContent = api.t('pickHint');
            die.style.setProperty('--turn', ov ? '#888' : inf.colors[v.turn]);
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
