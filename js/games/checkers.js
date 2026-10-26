/* Dame / Checkers with the German rules: men move and capture forwards only, the Dame flies along the diagonals,
   capturing is mandatory and the player picks which capture sequence to play. Rules, an alpha-beta AI with
   iterative deepening and a wooden DOM board. Piece codes in cells: 0 empty, 1 man and 2 Dame of player 0,
   3 man and 4 Dame of player 1. Row 0 is the home row of player 0, who moves towards row 7. */
(function (root) {
  'use strict';
  var SIZE = 8, CELLS = 64, QUIET_LIMIT = 50;
  var DIRS = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  function inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function owner(v) { return v <= 0 ? -1 : v <= 2 ? 0 : 1; }
  function isKing(v) { return v === 2 || v === 4; }
  function lastRank(p) { return p === 0 ? SIZE - 1 : 0; }
  function forward(p) { return p === 0 ? 1 : -1; }
  function playable(i) { return (((i >> 3) + (i & 7)) % 2) === 0; }

  /* Collects every complete capture sequence that starts at square i and appends it to out. The origin square is
     already empty in cells; the captured men stay on the board as blockers until the sequence ends and may not be
     jumped twice. Returns whether any capture was possible from i at all. */
  function captureSeqs(cells, i, p, king, taken, path, out) {
    var r = i >> 3, c = i & 7, any = false, d, dr, dc, rr, cc, m, l, sub;
    for (d = 0; d < 4; d++) {
      dr = DIRS[d][0]; dc = DIRS[d][1];
      if (!king) {
        if (dr !== forward(p)) continue;
        if (!inside(r + 2 * dr, c + 2 * dc)) continue;
        m = (r + dr) * SIZE + c + dc; l = (r + 2 * dr) * SIZE + c + 2 * dc;
        if (owner(cells[m]) !== 1 - p || taken.indexOf(m) >= 0 || cells[l] !== 0) continue;
        any = true;
        /* A man that reaches the last rank becomes a Dame and the move ends there. */
        if ((l >> 3) === lastRank(p)) { out.push(path.concat([l])); continue; }
        sub = captureSeqs(cells, l, p, false, taken.concat([m]), path.concat([l]), out);
        if (!sub) out.push(path.concat([l]));
      } else {
        rr = r + dr; cc = c + dc;
        while (inside(rr, cc) && cells[rr * SIZE + cc] === 0) { rr += dr; cc += dc; }
        if (!inside(rr, cc)) continue;
        m = rr * SIZE + cc;
        if (owner(cells[m]) !== 1 - p || taken.indexOf(m) >= 0) continue;
        rr += dr; cc += dc;
        while (inside(rr, cc) && cells[rr * SIZE + cc] === 0) {
          any = true; l = rr * SIZE + cc;
          sub = captureSeqs(cells, l, p, true, taken.concat([m]), path.concat([l]), out);
          if (!sub) out.push(path.concat([l]));
          rr += dr; cc += dc;
        }
      }
    }
    return any;
  }

  /* Every legal path for player p: all complete capture sequences when any capture exists, else the simple moves.
     The result is { paths: [[from, ..., to], ...], cap: boolean }. */
  function genRaw(cells, p) {
    var paths = [], i, v, r, c, d, dr, dc, rr, cc;
    for (i = 0; i < CELLS; i++) {
      v = cells[i]; if (owner(v) !== p) continue;
      cells[i] = 0;
      captureSeqs(cells, i, p, isKing(v), [], [i], paths);
      cells[i] = v;
    }
    if (paths.length) return { paths: paths, cap: true };
    for (i = 0; i < CELLS; i++) {
      v = cells[i]; if (owner(v) !== p) continue;
      r = i >> 3; c = i & 7;
      for (d = 0; d < 4; d++) {
        dr = DIRS[d][0]; dc = DIRS[d][1];
        if (!isKing(v)) {
          if (dr !== forward(p)) continue;
          if (inside(r + dr, c + dc) && cells[(r + dr) * SIZE + c + dc] === 0) paths.push([i, (r + dr) * SIZE + c + dc]);
        } else {
          rr = r + dr; cc = c + dc;
          while (inside(rr, cc) && cells[rr * SIZE + cc] === 0) { paths.push([i, rr * SIZE + cc]); rr += dr; cc += dc; }
        }
      }
    }
    return { paths: paths, cap: false };
  }
  function toAction(path) { return { from: path[0], to: path[path.length - 1], path: path }; }

  /* Plays a path on cells in place and returns what happened: the captured squares and whether a man was promoted. */
  function doMove(cells, p, path) {
    var v = cells[path[0]], caps = [], k, a, b, dr, dc, r, c, j, to = path[path.length - 1], promoted = false;
    cells[path[0]] = 0;
    for (k = 1; k < path.length; k++) {
      a = path[k - 1]; b = path[k];
      dr = (b >> 3) > (a >> 3) ? 1 : -1; dc = (b & 7) > (a & 7) ? 1 : -1;
      r = (a >> 3) + dr; c = (a & 7) + dc;
      while (r !== (b >> 3)) { j = r * SIZE + c; if (cells[j] !== 0) { caps.push(j); cells[j] = 0; } r += dr; c += dc; }
    }
    if (!isKing(v) && (to >> 3) === lastRank(p)) { v = p === 0 ? 2 : 4; promoted = true; }
    cells[to] = v;
    return { caps: caps, promoted: promoted };
  }

  /* The evaluation from the view of player p: material, advancement of the men, a guard bonus on the home row and
     a cheap mobility term counting the free squares a piece could step to. */
  function evaluate(cells, p) {
    var score = 0, i, v, o, r, c, d, rr, cc, val;
    for (i = 0; i < CELLS; i++) {
      v = cells[i]; if (!v) continue;
      o = owner(v); r = i >> 3; c = i & 7;
      if (isKing(v)) val = 300;
      else { val = 100 + 4 * (o === 0 ? r : SIZE - 1 - r); if (r === (o === 0 ? 0 : SIZE - 1)) val += 6; if (c === 0 || c === SIZE - 1) val += 2; }
      for (d = 0; d < 4; d++) {
        if (!isKing(v) && DIRS[d][0] !== forward(o)) continue;
        rr = r + DIRS[d][0]; cc = c + DIRS[d][1];
        if (inside(rr, cc) && cells[rr * SIZE + cc] === 0) val += 2;
      }
      score += o === p ? val : -val;
    }
    return score;
  }

  var deadline = 0, nodes = 0, aborted = false;
  /* Negamax with alpha-beta from the view of the side to move. Forced captures are searched past the horizon so
     the evaluation never lands in the middle of an exchange. Every 256 nodes the clock is checked. */
  function search(cells, p, depth, alpha, beta) {
    if ((++nodes & 255) === 0 && Date.now() > deadline) { aborted = true; return 0; }
    var g = genRaw(cells, p), paths = g.paths, best = -1e9, i, next, v;
    if (!paths.length) return -(10000 + depth);
    if (depth <= 0 && !g.cap) return evaluate(cells, p);
    if (paths.length > 1 && g.cap) paths.sort(function (a, b) { return b.length - a.length; });
    for (i = 0; i < paths.length; i++) {
      next = cells.slice(); doMove(next, p, paths[i]);
      v = -search(next, 1 - p, depth > 0 ? depth - 1 : 0, -beta, -alpha);
      if (aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  var G = {
    id: 'checkers',
    name: { de: 'Dame', en: 'Checkers' },
    blurb: { de: 'Schlagen ist Pflicht, die Dame fliegt über das Brett.', en: 'Captures are mandatory and the king flies across the board.' },
    icon: '⚪',
    counts: [2],
    ai: true,
    hidden: false,
    strings: {
      de: {
        pick: 'Tippe einen deiner Steine an',
        target: 'Tippe das Zielfeld an',
        more: 'Weiter schlagen: tippe das nächste Feld an',
        must: 'Du musst schlagen',
        noMove: 'Dieser Stein kann nicht ziehen',
        men: 'Steine',
        won: '{0} gewinnt',
        drawn: 'Unentschieden',
        rules: 'Jeder hat 12 Steine auf den dunklen Feldern. Steine ziehen ein Feld schräg vorwärts und schlagen nur vorwärts, indem sie über einen gegnerischen Stein auf ein freies Feld springen. Schlagen ist Pflicht und wird in einem Zug fortgesetzt, solange es geht; bei mehreren Möglichkeiten darfst du wählen. Ein Stein auf der letzten Reihe wird zur Dame: sie zieht beliebig weit schräg und schlägt aus jeder Entfernung, hinter dem geschlagenen Stein darf sie auf jedem freien Feld landen. Wer nicht mehr ziehen kann, verliert. Nach 50 Zügen ohne Schlag oder Umwandlung endet die Partie unentschieden.'
      },
      en: {
        pick: 'Tap one of your pieces',
        target: 'Tap the target square',
        more: 'Keep capturing: tap the next square',
        must: 'You have to capture',
        noMove: 'This piece cannot move',
        men: 'Pieces',
        won: '{0} wins',
        drawn: 'Draw',
        rules: 'Each side has 12 men on the dark squares. Men move one square diagonally forwards and capture forwards only, by jumping over an enemy piece onto a free square. Capturing is mandatory and continues within the move as long as it can; with several options you choose. A man reaching the last rank becomes a king: it moves any distance diagonally and captures from any distance, landing on any free square behind the captured piece. A player who cannot move loses. After 50 moves without a capture or a promotion the game is a draw.'
      }
    },
    create: function () {
      var cells = [], i;
      for (i = 0; i < CELLS; i++) cells.push(0);
      for (i = 0; i < CELLS; i++) if (playable(i)) { if ((i >> 3) < 3) cells[i] = 1; else if ((i >> 3) > 4) cells[i] = 3; }
      return { cells: cells, turn: 0, quiet: 0, moves: 0, last: null };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      return genRaw(s.cells.slice(), p).paths.map(toAction);
    },
    apply: function (s, p, a) {
      var cells = s.cells.slice(), res = doMove(cells, p, a.path), events = [{ e: 'move', from: a.from, to: a.to, path: a.path }];
      if (res.caps.length) events.push({ e: 'capture', at: res.caps });
      if (res.promoted) events.push({ e: 'promote', at: a.to });
      var next = { cells: cells, turn: 1 - p, quiet: res.caps.length || res.promoted ? 0 : s.quiet + 1, moves: s.moves + 1, last: a.path.slice() };
      return { state: next, events: events };
    },
    over: function (s) {
      if (s.quiet >= QUIET_LIMIT) return { winner: -1 };
      if (!genRaw(s.cells.slice(), s.turn).paths.length) return { winner: 1 - s.turn };
      return null;
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p), i, depth, maxDepth, noiseMax, noise = [], best, iterBest, iterVal, alpha, next, v;
      if (!acts.length) return null;
      if (acts.length === 1) return acts[0];
      maxDepth = level === 1 ? 2 : level === 2 ? 4 : 7;
      noiseMax = level === 1 ? 80 : 0.5;
      for (i = 0; i < acts.length; i++) noise.push(rng.next() * noiseMax);
      deadline = Date.now() + (level === 3 ? 330 : 400);
      best = acts[0];
      for (depth = 1; depth <= maxDepth; depth++) {
        aborted = false; nodes = 0; iterBest = null; iterVal = -1e9; alpha = -1e9;
        for (i = 0; i < acts.length; i++) {
          next = s.cells.slice(); doMove(next, p, acts[i].path);
          v = -search(next, 1 - p, depth - 1, -1e9, -alpha) + noise[i];
          if (aborted) break;
          if (v > iterVal) { iterVal = v; iterBest = acts[i]; alpha = iterVal - noiseMax; }
        }
        if (aborted) break;
        best = iterBest;
        if (iterVal > 9000) break;
      }
      return best;
    },
    ui: {
      mount: function (el, api) {
        var wrap = document.createElement('div'); wrap.className = 'ck-wrap';
        var bar = document.createElement('div'); bar.className = 'ck-bar';
        var board = document.createElement('div'); board.className = 'ck-board';
        var hint = document.createElement('div'); hint.className = 'ck-hint';
        wrap.appendChild(bar); wrap.appendChild(board); wrap.appendChild(hint); el.appendChild(wrap);
        var sq = [], view = null, info = null, acts = [], sel = -1, partial = [], flipped = false, seenMoves = -1, k;
        for (k = 0; k < CELLS; k++) {
          var d = document.createElement('div');
          d.className = 'ck-sq ' + (playable(k) ? 'dark' : 'light'); d.dataset.i = k; d.onclick = onTap; sq.push(d);
        }
        function layout() {
          board.innerHTML = '';
          for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
            var rr = flipped ? r : SIZE - 1 - r, cc = flipped ? SIZE - 1 - c : c;
            board.appendChild(sq[rr * SIZE + cc]);
          }
        }
        layout();
        function candidates() {
          return acts.filter(function (a) {
            if (a.from !== sel) return false;
            for (var j = 0; j < partial.length; j++) if (a.path[j + 1] !== partial[j]) return false;
            return true;
          });
        }
        function onTap(ev) {
          if (!info || !info.canAct || !view) return;
          var i = +ev.currentTarget.dataset.i, v = view.cells[i], step, cand;
          if (owner(v) === info.me && partial.length === 0) {
            if (acts.some(function (a) { return a.from === i; })) { sel = i; }
            else { api.toast(api.t(acts.length && acts[0].path.length && isCapture(acts[0]) ? 'must' : 'noMove')); }
            paint(); return;
          }
          if (sel < 0) return;
          step = partial.length + 1;
          cand = candidates().filter(function (a) { return a.path[step] === i; });
          if (!cand.length) { if (!partial.length) { sel = -1; paint(); } return; }
          if (cand.length === 1 && cand[0].path.length === step + 1) { api.act(cand[0]); sel = -1; partial = []; return; }
          /* Several sequences run through this square, so the next tap picks the continuation. */
          partial.push(i); paint();
        }
        function isCapture(a) { return Math.abs((a.path[1] >> 3) - (a.path[0] >> 3)) > 1; }
        function paint() {
          if (!view || !info) return;
          var ov = G.over(view), cand = sel >= 0 ? candidates() : [], step = partial.length + 1, targets = {}, movers = {}, i, v, d, counts = [0, 0];
          cand.forEach(function (a) { targets[a.path[step]] = true; });
          if (info.canAct && sel < 0) acts.forEach(function (a) { movers[a.from] = true; });
          for (i = 0; i < CELLS; i++) {
            v = view.cells[i]; d = sq[i];
            if (v) counts[owner(v)]++;
            d.innerHTML = v ? '<i class="ck-man' + (isKing(v) ? ' king' : '') + '" style="--pc:' + info.colors[owner(v)] + '"></i>' : '';
            d.classList.toggle('sel', i === sel);
            d.classList.toggle('tgt', !!targets[i]);
            d.classList.toggle('mover', !!movers[i]);
            d.classList.toggle('last', !!view.last && view.last.indexOf(i) >= 0);
          }
          bar.innerHTML = '';
          for (i = 0; i < 2; i++) {
            var side = document.createElement('div'); side.className = 'ck-side' + (!ov && view.turn === i ? ' on' : '');
            var disc = document.createElement('i'); disc.className = 'ck-man small'; disc.style.setProperty('--pc', info.colors[i]);
            var txt = document.createElement('span'); txt.textContent = info.names[i] + ': ' + counts[i];
            side.appendChild(disc); side.appendChild(txt); bar.appendChild(side);
          }
          board.style.cursor = info.canAct ? 'pointer' : 'default';
          if (ov) hint.textContent = ov.winner < 0 ? api.t('drawn') : api.t('won', info.names[ov.winner]);
          else if (!info.canAct) hint.textContent = api.t('wait', info.names[view.turn]);
          else if (partial.length) hint.textContent = api.t('more');
          else if (sel >= 0) hint.textContent = api.t('target');
          else hint.textContent = acts.length && isCapture(acts[0]) ? api.t('must') : api.t('pick');
        }
        var style = document.createElement('style');
        style.textContent = '.ck-wrap{max-width:min(100%,560px);margin:0 auto}' +
          '.ck-board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;border:14px solid #5a3a1e;border-radius:8px;background:repeating-linear-gradient(90deg,#6b4423 0 6px,#5a3a1e 6px 14px);box-shadow:inset 0 0 0 2px #3b2411,0 10px 28px rgba(0,0,0,.4);user-select:none}' +
          '.ck-sq{position:relative;aspect-ratio:1}' +
          '.ck-sq.light{background:linear-gradient(135deg,#eed7a9,#d8b980)}' +
          '.ck-sq.dark{background:linear-gradient(135deg,#8c5a2b,#6a4120)}' +
          '.ck-sq.last{box-shadow:inset 0 0 0 100px rgba(255,235,150,.18)}' +
          '.ck-sq.mover{box-shadow:inset 0 0 0 2px rgba(255,255,255,.45)}' +
          '.ck-sq.sel{box-shadow:inset 0 0 0 3px #ffd54a}' +
          '.ck-sq.tgt::after{content:"";position:absolute;inset:36%;border-radius:50%;background:rgba(255,215,80,.9);box-shadow:0 0 8px rgba(255,215,80,.8)}' +
          '.ck-man{position:absolute;inset:11%;border-radius:50%;background:var(--pc);box-shadow:inset -3px -5px 0 rgba(0,0,0,.3),inset 3px 4px 0 rgba(255,255,255,.3),0 3px 4px rgba(0,0,0,.45)}' +
          '.ck-man.king::after{content:"\\2655";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:min(5vw,26px);color:rgba(255,255,255,.95);text-shadow:0 1px 2px rgba(0,0,0,.8)}' +
          '.ck-bar{display:flex;justify-content:space-between;gap:12px;margin:0 0 10px;font-size:15px}' +
          '.ck-side{display:flex;align-items:center;gap:8px;padding:4px 10px;border-radius:999px;opacity:.6}' +
          '.ck-side.on{opacity:1;background:rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(255,255,255,.25)}' +
          '.ck-man.small{position:static;display:inline-block;width:18px;height:18px}' +
          '.ck-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.85;min-height:18px}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            if (v.moves !== seenMoves) { sel = -1; partial = []; seenMoves = v.moves; }
            acts = inf.canAct ? G.actions(v, inf.me) : [];
            var others = inf.players && inf.players[0] ? (inf.players[0].ai || inf.players[0].remote) : false;
            var flip = inf.me === 1 && !!others;
            if (flip !== flipped) { flipped = flip; layout(); }
            paint();
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
