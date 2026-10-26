/* Mühle / Nine Men's Morris: place nine men each, then move them along the lines, fly with three men left. A mill
   removes an enemy man that is not in a mill. Rules, an alpha-beta AI with iterative deepening and an SVG board.
   The 24 points sit on a 7 by 7 grid: outer square 0 to 7, middle square 8 to 15, inner square 16 to 23, each
   square listed row by row from the top left. */
(function (root) {
  'use strict';
  var MEN = 9, QUIET_LIMIT = 50;
  var PTS = [[0, 0], [3, 0], [6, 0], [0, 3], [6, 3], [0, 6], [3, 6], [6, 6],
    [1, 1], [3, 1], [5, 1], [1, 3], [5, 3], [1, 5], [3, 5], [5, 5],
    [2, 2], [3, 2], [4, 2], [2, 3], [4, 3], [2, 4], [3, 4], [4, 4]];
  var MILLS = [[0, 1, 2], [5, 6, 7], [0, 3, 5], [2, 4, 7],
    [8, 9, 10], [13, 14, 15], [8, 11, 13], [10, 12, 15],
    [16, 17, 18], [21, 22, 23], [16, 19, 21], [18, 20, 23],
    [1, 9, 17], [22, 14, 6], [3, 11, 19], [20, 12, 4]];
  var ADJ = [], MILLS_AT = [], i, m;
  for (i = 0; i < 24; i++) { ADJ.push([]); MILLS_AT.push([]); }
  for (m = 0; m < MILLS.length; m++) {
    var a = MILLS[m][0], b = MILLS[m][1], c = MILLS[m][2];
    ADJ[a].push(b); ADJ[b].push(a); ADJ[b].push(c); ADJ[c].push(b);
    MILLS_AT[a].push(m); MILLS_AT[b].push(m); MILLS_AT[c].push(m);
  }
  function inMill(cells, i, p) {
    var k, mm;
    for (k = 0; k < MILLS_AT[i].length; k++) {
      mm = MILLS[MILLS_AT[i][k]];
      if (cells[mm[0]] === p && cells[mm[1]] === p && cells[mm[2]] === p) return true;
    }
    return false;
  }
  function count(cells, p) { var n = 0, k; for (k = 0; k < 24; k++) if (cells[k] === p) n++; return n; }
  function total(s, p) { return count(s.cells, p) + s.hand[p]; }

  /* Every legal action of player p in state s: a removal when a mill was just closed, a placement while men are in
     hand, else a move along a line or, with three men left, a flight to any free point. */
  function gen(s, p) {
    var out = [], cells = s.cells, k, j, n, anyFree = false;
    if (s.take) {
      for (k = 0; k < 24; k++) if (cells[k] === 1 - p && !inMill(cells, k, 1 - p)) { anyFree = true; break; }
      for (k = 0; k < 24; k++) if (cells[k] === 1 - p && (!anyFree || !inMill(cells, k, 1 - p))) out.push({ take: k });
      return out;
    }
    if (s.hand[p] > 0) {
      for (k = 0; k < 24; k++) if (cells[k] < 0) out.push({ place: k });
      return out;
    }
    n = count(cells, p);
    for (k = 0; k < 24; k++) {
      if (cells[k] !== p) continue;
      if (n === 3) { for (j = 0; j < 24; j++) if (cells[j] < 0) out.push({ move: [k, j] }); }
      else for (j = 0; j < ADJ[k].length; j++) if (cells[ADJ[k][j]] < 0) out.push({ move: [k, ADJ[k][j]] });
    }
    return out;
  }

  /* Applies an action to a copy of the state and returns { state, events }. */
  function step(s, p, a) {
    var cells = s.cells.slice(), hand = s.hand.slice(), events = [], at, next;
    next = { cells: cells, hand: hand, turn: p, take: false, quiet: s.quiet, moves: s.moves + 1, last: s.last, removed: -1 };
    if (a.take !== undefined) {
      cells[a.take] = -1; next.turn = 1 - p; next.quiet = 0; next.removed = a.take;
      events.push({ e: 'remove', at: a.take, p: 1 - p });
      return { state: next, events: events };
    }
    if (a.place !== undefined) { at = a.place; cells[at] = p; hand[p]--; events.push({ e: 'place', at: at, p: p }); }
    else { at = a.move[1]; cells[a.move[0]] = -1; cells[at] = p; events.push({ e: 'move', from: a.move[0], to: at, p: p }); }
    next.last = at; next.quiet = s.quiet + 1;
    if (inMill(cells, at, p)) { next.take = true; events.push({ e: 'mill', at: at, p: p }); }
    else next.turn = 1 - p;
    return { state: next, events: events };
  }

  function overRaw(s, moves) {
    var p;
    for (p = 0; p < 2; p++) if (total(s, p) < 3) return { winner: 1 - p };
    if (s.quiet >= QUIET_LIMIT) return { winner: -1 };
    if (!s.take && !(moves || gen(s, s.turn)).length) return { winner: 1 - s.turn };
    return null;
  }

  /* The evaluation from the view of player p: material, closed mills, open twos and mobility of both sides. */
  function evaluate(s, p) {
    var score = 0, side, sign, cells = s.cells, k, j, mm, mine, free, mills, twos, mob, n, moving = s.hand[0] === 0 && s.hand[1] === 0;
    for (side = 0; side < 2; side++) {
      sign = side === p ? 1 : -1;
      mills = 0; twos = 0; mob = 0; n = count(cells, side);
      for (k = 0; k < MILLS.length; k++) {
        mm = MILLS[k]; mine = 0; free = 0;
        for (j = 0; j < 3; j++) { if (cells[mm[j]] === side) mine++; else if (cells[mm[j]] < 0) free++; }
        if (mine === 3) mills++; else if (mine === 2 && free === 1) twos++;
      }
      if (n === 3 && s.hand[side] === 0) mob = 24 - count(cells, 0) - count(cells, 1);
      else for (k = 0; k < 24; k++) if (cells[k] === side) for (j = 0; j < ADJ[k].length; j++) if (cells[ADJ[k][j]] < 0) mob++;
      score += sign * (100 * (n + s.hand[side]) + 14 * mills + 7 * twos + (moving ? 4 : 2) * mob);
    }
    return score;
  }

  var deadline = 0, nodes = 0, aborted = false;
  /* Negamax with alpha-beta from the view of the side to move. A removal after a mill keeps the turn, so it is
     searched at the same depth and with the same sign. */
  function search(s, depth, alpha, beta) {
    if ((++nodes & 255) === 0 && Date.now() > deadline) { aborted = true; return 0; }
    var moves = gen(s, s.turn), ov = overRaw(s, moves), best = -1e9, k, child, v;
    if (ov) return ov.winner < 0 ? 0 : ov.winner === s.turn ? 10000 + depth : -(10000 + depth);
    if (depth <= 0) return evaluate(s, s.turn);
    for (k = 0; k < moves.length; k++) {
      child = step(s, s.turn, moves[k]).state;
      if (child.turn === s.turn) v = search(child, depth, alpha, beta);
      else v = -search(child, depth - 1, -beta, -alpha);
      if (aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  var G = {
    id: 'morris',
    name: { de: 'Mühle', en: 'Nine Men\'s Morris' },
    blurb: { de: 'Drei in einer Linie nehmen dem Gegner einen Stein.', en: 'Three in a line take an enemy man.' },
    icon: '⚫',
    counts: [2],
    ai: true,
    hidden: false,
    strings: {
      de: {
        placeHint: 'Setze einen Stein auf einen freien Punkt',
        moveHint: 'Tippe einen Stein an und ziehe ihn entlang einer Linie',
        flyHint: 'Nur noch drei Steine: springe auf einen beliebigen freien Punkt',
        targetHint: 'Tippe den Zielpunkt an',
        takeHint: 'Mühle! Nimm einen gegnerischen Stein',
        inHand: 'Hand {0}',
        onBoard: 'Brett {0}',
        won: '{0} gewinnt',
        drawn: 'Unentschieden',
        rules: 'Jeder Spieler setzt abwechselnd 9 Steine auf freie Punkte. Sind alle gesetzt, wird entlang der Linien auf einen freien Nachbarpunkt gezogen; wer nur noch drei Steine hat, darf auf jeden freien Punkt springen. Drei eigene Steine in einer Linie bilden eine Mühle: dann nimmst du einen gegnerischen Stein, der nicht in einer Mühle steht (stehen alle in Mühlen, einen beliebigen). Wer nur noch zwei Steine hat oder nicht mehr ziehen kann, verliert. Nach 50 Zügen ohne Mühle endet die Partie unentschieden.'
      },
      en: {
        placeHint: 'Place a man on a free point',
        moveHint: 'Tap a man and move it along a line',
        flyHint: 'Only three men left: jump to any free point',
        targetHint: 'Tap the target point',
        takeHint: 'Mill! Take an enemy man',
        inHand: 'Hand {0}',
        onBoard: 'Board {0}',
        won: '{0} wins',
        drawn: 'Draw',
        rules: 'The players take turns placing 9 men each on free points. Once all are placed, men move along the lines to a free neighbouring point; a player down to three men may fly to any free point. Three of your men in a line form a mill: you then remove an enemy man that is not part of a mill (any man if all are). A player left with two men or without a legal move loses. After 50 moves without a mill the game is a draw.'
      }
    },
    create: function () {
      var cells = [], k;
      for (k = 0; k < 24; k++) cells.push(-1);
      return { cells: cells, hand: [MEN, MEN], turn: 0, take: false, quiet: 0, moves: 0, last: -1, removed: -1 };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) { if (s.turn !== p || G.over(s)) return []; return gen(s, p); },
    apply: function (s, p, a) { return step(s, p, a); },
    over: function (s) { return overRaw(s); },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p), k, depth, maxDepth, noiseMax, noise = [], best, iterBest, iterVal, alpha, child, v;
      if (!acts.length) return null;
      if (acts.length === 1) return acts[0];
      maxDepth = level === 1 ? 2 : level === 2 ? 4 : 7;
      noiseMax = level === 1 ? 60 : 0.5;
      for (k = 0; k < acts.length; k++) noise.push(rng.next() * noiseMax);
      deadline = Date.now() + (level === 3 ? 330 : 400);
      best = acts[0];
      for (depth = 1; depth <= maxDepth; depth++) {
        aborted = false; nodes = 0; iterBest = null; iterVal = -1e9; alpha = -1e9;
        for (k = 0; k < acts.length; k++) {
          child = step(s, p, acts[k]).state;
          if (child.turn === p) v = search(child, depth, alpha, 1e9);
          else v = -search(child, depth - 1, -1e9, -alpha);
          v += noise[k];
          if (aborted) break;
          if (v > iterVal) { iterVal = v; iterBest = acts[k]; alpha = iterVal - noiseMax; }
        }
        if (aborted) break;
        best = iterBest;
        if (iterVal > 9000) break;
      }
      return best;
    },
    ui: {
      mount: function (el, api) {
        var NS = 'http://www.w3.org/2000/svg';
        function mk(tag, attrs, parent) { var n = document.createElementNS(NS, tag), k; for (k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
        var wrap = document.createElement('div'); wrap.className = 'mo-wrap';
        var bar = document.createElement('div'); bar.className = 'mo-bar';
        var svg = mk('svg', { viewBox: '0 0 700 700', 'class': 'mo-board' });
        var hint = document.createElement('div'); hint.className = 'mo-hint';
        wrap.appendChild(bar); wrap.appendChild(svg); wrap.appendChild(hint); el.appendChild(wrap);
        function px(i) { return 50 + PTS[i][0] * 100; }
        function py(i) { return 50 + PTS[i][1] * 100; }
        mk('rect', { x: 0, y: 0, width: 700, height: 700, rx: 18, 'class': 'mo-bg' }, svg);
        var k, j;
        for (k = 0; k < MILLS.length; k++) {
          var mm = MILLS[k];
          mk('line', { x1: px(mm[0]), y1: py(mm[0]), x2: px(mm[2]), y2: py(mm[2]), 'class': 'mo-line' }, svg);
        }
        var dots = [], rings = [], men = [], hits = [];
        for (k = 0; k < 24; k++) dots.push(mk('circle', { cx: px(k), cy: py(k), r: 9, 'class': 'mo-dot' }, svg));
        for (k = 0; k < 24; k++) rings.push(mk('circle', { cx: px(k), cy: py(k), r: 36, 'class': 'mo-ring' }, svg));
        for (k = 0; k < 24; k++) men.push(mk('circle', { cx: px(k), cy: py(k), r: 28, 'class': 'mo-man' }, svg));
        for (k = 0; k < 24; k++) {
          var h = mk('circle', { cx: px(k), cy: py(k), r: 44, 'class': 'mo-hit' }, svg);
          h.dataset.i = k; h.addEventListener('click', onTap); hits.push(h);
        }
        var view = null, info = null, acts = [], sel = -1, seenMoves = -1;
        function onTap(ev) {
          if (!info || !info.canAct || !view) return;
          var i = +ev.currentTarget.dataset.i, a;
          if (view.take) { a = find(function (x) { return x.take === i; }); if (a) api.act(a); return; }
          if (view.hand[info.me] > 0) { a = find(function (x) { return x.place === i; }); if (a) api.act(a); return; }
          if (view.cells[i] === info.me) { sel = acts.some(function (x) { return x.move[0] === i; }) ? i : -1; paint(); return; }
          if (sel < 0) return;
          a = find(function (x) { return x.move[0] === sel && x.move[1] === i; });
          if (a) { sel = -1; api.act(a); } else { sel = -1; paint(); }
        }
        function find(f) { for (var q = 0; q < acts.length; q++) if (f(acts[q])) return acts[q]; return null; }
        function paint() {
          if (!view || !info) return;
          var ov = G.over(view), i, v, play = {}, own = {}, flying = false, n;
          if (info.canAct) acts.forEach(function (a) {
            if (a.take !== undefined) play[a.take] = true;
            else if (a.place !== undefined) play[a.place] = true;
            else { own[a.move[0]] = true; if (sel === a.move[0]) play[a.move[1]] = true; }
          });
          for (i = 0; i < 24; i++) {
            v = view.cells[i];
            men[i].style.display = v >= 0 ? '' : 'none';
            if (v >= 0) men[i].setAttribute('fill', info.colors[v]);
            men[i].classList.toggle('sel', i === sel);
            men[i].classList.toggle('last', i === view.last && !ov);
            rings[i].classList.toggle('on', !!play[i] || (!!own[i] && sel < 0));
            rings[i].classList.toggle('take', !!play[i] && view.take);
            hits[i].style.cursor = info.canAct && (play[i] || own[i]) ? 'pointer' : 'default';
          }
          bar.innerHTML = '';
          for (i = 0; i < 2; i++) {
            var side = document.createElement('div'); side.className = 'mo-side' + (!ov && view.turn === i ? ' on' : '');
            var disc = document.createElement('i'); disc.className = 'mo-disc'; disc.style.background = info.colors[i];
            var txt = document.createElement('span'); txt.textContent = info.names[i] + ' ' + api.t('onBoard', count(view.cells, i)) + ', ' + api.t('inHand', view.hand[i]);
            side.appendChild(disc); side.appendChild(txt); bar.appendChild(side);
          }
          if (ov) hint.textContent = ov.winner < 0 ? api.t('drawn') : api.t('won', info.names[ov.winner]);
          else if (!info.canAct) hint.textContent = api.t('wait', info.names[view.turn]);
          else if (view.take) hint.textContent = api.t('takeHint');
          else if (view.hand[info.me] > 0) hint.textContent = api.t('placeHint');
          else if (sel >= 0) hint.textContent = api.t('targetHint');
          else { n = count(view.cells, info.me); flying = n === 3; hint.textContent = api.t(flying ? 'flyHint' : 'moveHint'); }
        }
        var style = document.createElement('style');
        style.textContent = '.mo-wrap{max-width:min(100%,560px);margin:0 auto}' +
          '.mo-board{display:block;width:100%;aspect-ratio:1;user-select:none}' +
          '.mo-bg{fill:#2b2f3a;stroke:#4a5063;stroke-width:4}' +
          '.mo-line{stroke:#b9c1d6;stroke-width:5;stroke-linecap:round}' +
          '.mo-dot{fill:#b9c1d6}' +
          '.mo-ring{fill:none;stroke:rgba(255,215,80,.9);stroke-width:4;stroke-dasharray:8 6;opacity:0;transition:opacity .15s}' +
          '.mo-ring.on{opacity:1}.mo-ring.take{stroke:#ff6b6b}' +
          '.mo-man{stroke:rgba(0,0,0,.45);stroke-width:3;filter:drop-shadow(0 3px 3px rgba(0,0,0,.5))}' +
          '.mo-man.sel{stroke:#ffd54a;stroke-width:6}.mo-man.last{stroke:rgba(255,255,255,.85);stroke-width:4}' +
          '.mo-hit{fill:transparent}' +
          '.mo-bar{display:flex;justify-content:space-between;gap:12px;margin:0 0 10px;font-size:14px;flex-wrap:wrap}' +
          '.mo-side{display:flex;align-items:center;gap:8px;padding:4px 10px;border-radius:999px;opacity:.6}' +
          '.mo-side.on{opacity:1;background:rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(255,255,255,.25)}' +
          '.mo-disc{display:inline-block;width:16px;height:16px;border-radius:50%;box-shadow:inset -2px -3px 0 rgba(0,0,0,.3)}' +
          '.mo-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.85;min-height:18px}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            if (v.moves !== seenMoves) { sel = -1; seenMoves = v.moves; }
            acts = inf.canAct ? G.actions(v, inf.me) : [];
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
