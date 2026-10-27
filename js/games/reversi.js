/* Reversi / Othello: 8 by 8, a move must flip at least one line, a player without a move passes, the game ends
   when neither side can move and the side with more discs wins. Rules, a three level AI (greedy, positional
   search, alpha-beta with mobility and an exact endgame) and a green DOM board with a flip animation.
   Player 0 holds the dark discs and moves first. */
(function (root) {
  'use strict';
  var SIZE = 8, CELLS = 64;
  var DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var WEIGHTS = [
    100, -20, 10, 5, 5, 10, -20, 100,
    -20, -50, -2, -2, -2, -2, -50, -20,
    10, -2, -1, -1, -1, -1, -2, 10,
    5, -2, -1, -1, -1, -1, -2, 5,
    5, -2, -1, -1, -1, -1, -2, 5,
    10, -2, -1, -1, -1, -1, -2, 10,
    -20, -50, -2, -2, -2, -2, -50, -20,
    100, -20, 10, 5, 5, 10, -20, 100];
  var CORNERS = [0, 7, 56, 63];
  function inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

  /* The discs a move at i by player p would flip, an empty list when the move is not legal. */
  function flips(cells, i, p) {
    var out = [], r = i >> 3, c = i & 7, d, rr, cc, run, j;
    if (cells[i] !== -1) return out;
    for (d = 0; d < 8; d++) {
      rr = r + DIRS[d][0]; cc = c + DIRS[d][1]; run = [];
      while (inside(rr, cc) && cells[rr * SIZE + cc] === 1 - p) { run.push(rr * SIZE + cc); rr += DIRS[d][0]; cc += DIRS[d][1]; }
      if (run.length && inside(rr, cc) && cells[rr * SIZE + cc] === p) for (j = 0; j < run.length; j++) out.push(run[j]);
    }
    return out;
  }
  function movesFor(cells, p) { var out = [], i; for (i = 0; i < CELLS; i++) if (cells[i] === -1 && flips(cells, i, p).length) out.push(i); return out; }
  function place(cells, i, p) { var f = flips(cells, i, p), j; cells[i] = p; for (j = 0; j < f.length; j++) cells[f[j]] = p; return f; }
  function counts(cells) { var n = [0, 0], i; for (i = 0; i < CELLS; i++) if (cells[i] >= 0) n[cells[i]]++; return n; }

  /* The positional evaluation from the view of p: square weights, and at the hard level mobility and corners. */
  function evaluate(cells, p, mob) {
    var score = 0, i, v, k;
    for (i = 0; i < CELLS; i++) { v = cells[i]; if (v === p) score += WEIGHTS[i]; else if (v >= 0) score -= WEIGHTS[i]; }
    if (mob) {
      score += 8 * (movesFor(cells, p).length - movesFor(cells, 1 - p).length);
      for (k = 0; k < 4; k++) { v = cells[CORNERS[k]]; if (v === p) score += 40; else if (v >= 0) score -= 40; }
    }
    return score;
  }
  function finalValue(cells, p, exact) {
    var n = counts(cells), diff = n[p] - n[1 - p];
    if (exact) return diff;
    return diff > 0 ? 100000 + diff : diff < 0 ? -100000 + diff : 0;
  }

  var deadline = 0, nodes = 0, aborted = false;
  /* Negamax with alpha-beta from the view of the side to move. A pass does not cost depth. In exact mode the
     search runs to the end of the game and returns the disc difference. */
  function search(cells, p, depth, alpha, beta, mob, exact) {
    if ((++nodes & 255) === 0 && Date.now() > deadline) { aborted = true; return 0; }
    var moves = movesFor(cells, p), best = -1e9, i, next, v;
    if (!moves.length) {
      if (!movesFor(cells, 1 - p).length) return finalValue(cells, p, exact);
      return -search(cells, 1 - p, depth, -beta, -alpha, mob, exact);
    }
    if (depth <= 0 && !exact) return evaluate(cells, p, mob);
    if (mob) moves.sort(function (a, b) { return WEIGHTS[b] - WEIGHTS[a]; });
    for (i = 0; i < moves.length; i++) {
      next = cells.slice(); place(next, moves[i], p);
      v = -search(next, 1 - p, depth - 1, -beta, -alpha, mob, exact);
      if (aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  /* Picks the best root move by iterative deepening up to maxDepth; the last finished iteration counts. With
     exact set and the clock allowing, a final exact pass settles the endgame. */
  function think(cells, p, moves, maxDepth, mob, exact, noise) {
    var best = moves[0], depth, i, iterBest, iterVal, alpha, next, v, passes = exact ? maxDepth + 1 : maxDepth;
    for (depth = 1; depth <= passes; depth++) {
      var isExact = exact && depth === passes;
      aborted = false; nodes = 0; iterBest = null; iterVal = -1e9; alpha = -1e9;
      for (i = 0; i < moves.length; i++) {
        next = cells.slice(); place(next, moves[i], p);
        v = -search(next, 1 - p, depth - 1, -1e9, -alpha, mob, isExact) + noise[i];
        if (aborted) break;
        if (v > iterVal) { iterVal = v; iterBest = moves[i]; alpha = iterVal - 1; }
      }
      if (aborted) break;
      best = iterBest;
      if (!isExact && iterVal > 90000) break;
    }
    return best;
  }

  var G = {
    id: 'reversi',
    name: { de: 'Reversi', en: 'Reversi' },
    blurb: { de: 'Einklemmen und umdrehen, am Ende zählen die Steine.', en: 'Flank and flip, most discs at the end win.' },
    icon: '🟢',
    counts: [2],
    ai: true,
    hidden: false,
    strings: {
      de: {
        hint: 'Tippe ein markiertes Feld an',
        noMoves: 'Du kannst nicht setzen und musst passen',
        pass: 'Passen',
        passed: '{0} passt',
        won: '{0} gewinnt',
        drawn: 'Unentschieden',
        rules: 'Abwechselnd wird ein Stein so gesetzt, dass er mit einem eigenen Stein eine Reihe gegnerischer Steine einklemmt, waagerecht, senkrecht oder schräg. Alle eingeklemmten Steine werden umgedreht; jeder Zug muss mindestens einen Stein umdrehen. Wer nicht setzen kann, passt. Können beide nicht mehr setzen, endet die Partie und die meisten Steine gewinnen, bei Gleichstand ist es unentschieden.'
      },
      en: {
        hint: 'Tap a marked square',
        noMoves: 'You have no move and must pass',
        pass: 'Pass',
        passed: '{0} passes',
        won: '{0} wins',
        drawn: 'Draw',
        rules: 'Players take turns placing a disc so that it flanks a line of enemy discs with one of their own, across, down or diagonally. All flanked discs are flipped; every move must flip at least one disc. A player without a move passes. When neither can move the game ends and the most discs win, equal counts are a draw.'
      }
    },
    create: function () {
      var cells = [], i;
      for (i = 0; i < CELLS; i++) cells.push(-1);
      cells[27] = 1; cells[28] = 0; cells[35] = 0; cells[36] = 1;
      return { cells: cells, turn: 0, last: -1, flipped: [], moves: 0 };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      var m = movesFor(s.cells, p);
      if (!m.length) return [{ pass: true }];
      return m.map(function (i) { return { at: i }; });
    },
    apply: function (s, p, a) {
      if (a.pass) return { state: { cells: s.cells.slice(), turn: 1 - p, last: -1, flipped: [], moves: s.moves + 1 }, events: [{ e: 'pass', p: p }] };
      var cells = s.cells.slice(), f = place(cells, a.at, p);
      return { state: { cells: cells, turn: 1 - p, last: a.at, flipped: f, moves: s.moves + 1 }, events: [{ e: 'place', at: a.at, p: p }, { e: 'flip', at: f, p: p }] };
    },
    over: function (s) {
      if (movesFor(s.cells, s.turn).length || movesFor(s.cells, 1 - s.turn).length) return null;
      var n = counts(s.cells);
      return { winner: n[0] > n[1] ? 0 : n[1] > n[0] ? 1 : -1, counts: n };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p), moves, i, best = -1e9, bi = 0, v, noise = [], empties = 0, at;
      if (!acts.length) return null;
      if (acts[0].pass) return acts[0];
      moves = acts.map(function (a) { return a.at; });
      if (moves.length === 1) return acts[0];
      if (level === 1) {
        for (i = 0; i < moves.length; i++) { v = flips(s.cells, moves[i], p).length + rng.next() * 3; if (v > best) { best = v; bi = i; } }
        return acts[bi];
      }
      for (i = 0; i < moves.length; i++) noise.push(rng.next() * 0.5);
      for (i = 0; i < CELLS; i++) if (s.cells[i] === -1) empties++;
      deadline = Date.now() + (level === 2 ? 400 : 330);
      if (level === 2) at = think(s.cells, p, moves, 3, false, false, noise);
      else at = think(s.cells, p, moves, 6, true, empties <= 10, noise);
      for (i = 0; i < acts.length; i++) if (acts[i].at === at) return acts[i];
      return acts[0];
    },
    ui: {
      mount: function (el, api) {
        var Gfx = root.Gfx;
        var wrap = document.createElement('div'); wrap.className = 'rv-wrap';
        var bar = document.createElement('div'); bar.className = 'rv-bar';
        var board = document.createElement('div'); board.className = 'rv-board gfx-felt gfx-frame';
        var hint = document.createElement('div'); hint.className = 'rv-hint';
        var passBtn = document.createElement('button'); passBtn.className = 'rv-pass'; passBtn.type = 'button'; passBtn.style.display = 'none';
        wrap.appendChild(bar); wrap.appendChild(board); wrap.appendChild(hint); wrap.appendChild(passBtn); el.appendChild(wrap);
        var sq = [], discs = [], view = null, info = null, acts = [], timers = [], k;
        for (k = 0; k < CELLS; k++) {
          var d = document.createElement('div'); d.className = 'rv-sq'; d.dataset.i = k;
          d.onclick = function (ev) {
            if (!info || !info.canAct) return;
            var i = +ev.currentTarget.dataset.i, q;
            for (q = 0; q < acts.length; q++) if (acts[q].at === i) { api.act(acts[q]); return; }
          };
          board.appendChild(d); sq.push(d); discs.push(null);
        }
        passBtn.onclick = function () { if (info && info.canAct && acts.length && acts[0].pass) api.act(acts[0]); };
        /* Sets the disc of square i to colour p (or none), reusing the element when only the colour changes. */
        function setDisc(i, p, drop) {
          var d = discs[i];
          if (p < 0) { if (d) { sq[i].removeChild(d); discs[i] = null; } return; }
          if (!d) { d = document.createElement('div'); d.className = 'rv-disc'; sq[i].appendChild(d); discs[i] = d; d.dataset.p = ''; }
          if (d.dataset.p !== String(p)) { d.dataset.p = p; d.innerHTML = Gfx.disc(info.colors[p], 40); }
          d.classList.toggle('drop', !!drop);
        }
        function later(f, ms) { timers.push(setTimeout(f, ms)); }
        function stopAnim() {
          timers.forEach(clearTimeout); timers = [];
          discs.forEach(function (d) { if (d) { d.style.transform = ''; d.style.transition = ''; } });
        }
        /* The flip ripples outward from the placed disc: each disc squashes to a line, swaps colour and opens again. */
        function animateFlip(at, flipped, p) {
          var r0 = at >> 3, c0 = at & 7;
          flipped.forEach(function (i) {
            var d = discs[i], dist = Math.max(Math.abs((i >> 3) - r0), Math.abs((i & 7) - c0)), delay = 60 + dist * 70;
            if (!d) return;
            later(function () {
              d.style.transition = 'transform .13s ease-in'; d.style.transform = 'scaleY(0.04)';
            }, delay);
            later(function () {
              setDisc(i, p, false);
              d.style.transition = 'transform .15s cubic-bezier(.2,.8,.3,1.25)'; d.style.transform = 'scaleY(1)';
            }, delay + 140);
            later(function () { d.style.transform = ''; d.style.transition = ''; }, delay + 320);
          });
        }
        /* A count as a small stack of discs with the number beside it. */
        function stack(color, n) {
          var h = '', q, size = 24, show = Math.min(Math.ceil(n / 4), 10), lift = 4;
          for (q = 0; q < show; q++) h += '<span style="bottom:' + (q * lift) + 'px">' + Gfx.disc(color, size) + '</span>';
          return '<div class="rv-stack" style="width:' + size + 'px;height:' + (size * 0.8 + Math.max(show - 1, 0) * lift) + 'px">' + h + '</div>';
        }
        function paint() {
          if (!view || !info) return;
          var ov = G.over(view), legal = {}, i, n = counts(view.cells);
          acts.forEach(function (a) { if (a.at !== undefined) legal[a.at] = true; });
          for (i = 0; i < CELLS; i++) {
            sq[i].classList.toggle('legal', !!legal[i] && info.canAct);
            sq[i].classList.toggle('last', i === view.last);
          }
          bar.innerHTML = '';
          for (i = 0; i < 2; i++) {
            var side = document.createElement('div'); side.className = 'rv-side' + (!ov && view.turn === i ? ' on' : '') + (i === 1 ? ' right' : '');
            var st = document.createElement('div'); st.className = 'rv-hand'; st.innerHTML = stack(info.colors[i], n[i]);
            var who = document.createElement('div'); who.className = 'rv-who';
            var name = document.createElement('small'); name.textContent = info.names[i];
            var num = document.createElement('b'); num.textContent = n[i];
            who.appendChild(num); who.appendChild(name);
            if (i === 0) { side.appendChild(st); side.appendChild(who); } else { side.appendChild(who); side.appendChild(st); }
            bar.appendChild(side);
          }
          var mustPass = info.canAct && acts.length && acts[0].pass;
          passBtn.style.display = mustPass ? '' : 'none';
          passBtn.textContent = api.t('pass');
          board.style.cursor = info.canAct && !mustPass ? 'pointer' : 'default';
          if (ov) hint.textContent = ov.winner < 0 ? api.t('drawn') : api.t('won', info.names[ov.winner]);
          else if (!info.canAct) hint.textContent = api.t('wait', info.names[view.turn]);
          else hint.textContent = mustPass ? api.t('noMoves') : api.t('hint');
        }
        var style = document.createElement('style');
        style.textContent = '.rv-wrap{max-width:min(100%,540px);margin:0 auto}' +
          '.rv-board{position:relative;display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;padding:1.2%;user-select:none;box-shadow:0 14px 34px rgba(0,0,0,.5),inset 0 0 0 2px rgba(0,0,0,.35),inset 0 3px 8px rgba(0,0,0,.35)}' +
          '.rv-sq{position:relative;aspect-ratio:1;box-shadow:inset 0 0 0 1px rgba(0,0,0,.4),inset 1px 1px 0 rgba(255,255,255,.05)}' +
          '.rv-sq.legal::after{content:"";position:absolute;inset:40%;border-radius:50%;background:rgba(255,255,255,.4);box-shadow:0 0 0 2px rgba(255,255,255,.2),0 0 6px rgba(255,255,255,.35)}' +
          '.rv-sq.last::before{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 2px rgba(255,235,120,.9);pointer-events:none;z-index:2}' +
          '.rv-disc{position:absolute;inset:7% 6% 1% 6%;display:flex;align-items:center;transform-origin:50% 52%;will-change:transform}' +
          '.rv-disc svg{width:100%;height:auto;overflow:visible}' +
          '.rv-disc.drop{animation:rvdrop .28s cubic-bezier(.2,.8,.3,1.2)}' +
          '@keyframes rvdrop{from{transform:translateY(-50%) scale(1.3);opacity:0}}' +
          '.rv-bar{display:flex;justify-content:space-between;gap:10px;margin:0 0 10px;font-size:15px}' +
          '.rv-side{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 12px;border-radius:12px;opacity:.6}' +
          '.rv-side.on{opacity:1;background:rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(255,255,255,.25)}' +
          '.rv-side.right{text-align:right}' +
          '.rv-who{display:flex;flex-direction:column;line-height:1.15}.rv-who b{font-size:20px}.rv-who small{opacity:.75;font-size:12px}' +
          '.rv-hand{display:flex;align-items:flex-end;min-width:24px}' +
          '.rv-stack{position:relative}.rv-stack span{position:absolute;left:0;display:block;width:100%}.rv-stack svg{width:100%;height:auto;overflow:visible}' +
          '.rv-hint{text-align:center;margin-top:12px;font-size:14px;opacity:.85;min-height:18px}' +
          '.rv-pass{display:block;margin:10px auto 0;min-height:44px;padding:8px 24px;border-radius:999px;border:0;background:#ffd54a;color:#222;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.35)}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            var prev = view, fast = root.App && root.App.fast, placed = -1, flipped = null, p = -1, i;
            stopAnim();
            view = v; info = inf;
            acts = inf.canAct ? G.actions(v, inf.me) : [];
            (inf.events || []).forEach(function (e) { if (e.e === 'place') { placed = e.at; p = e.p; } else if (e.e === 'flip') flipped = e.at; });
            var anim = prev && !fast && placed >= 0 && flipped && flipped.length;
            for (i = 0; i < CELLS; i++) {
              if (anim && flipped.indexOf(i) >= 0 && prev.cells[i] >= 0) setDisc(i, prev.cells[i], false);
              else setDisc(i, v.cells[i], anim && i === placed);
            }
            if (anim) animateFlip(placed, flipped, p);
            paint();
          },
          destroy: function () { stopAnim(); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
