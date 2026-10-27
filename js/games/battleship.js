/* Schiffe versenken / Battleship: two 10 by 10 grids, a fleet of six ships that may not touch (German rule), and a
   hit grants another shot. Rules, three AI levels (random hunt, parity hunt and target, probability density over the
   possible placements) and a DOM board with two grids. */
(function (root) {
  'use strict';
  var N = 10, FLEET = [5, 4, 3, 3, 2, 2];
  function idx(x, y) { return y * N + x; }
  function inside(x, y) { return x >= 0 && x < N && y >= 0 && y < N; }
  /* The cells a ship covers, as indices into the 100 cell grid. */
  function cellsOf(sh) {
    var out = [];
    for (var k = 0; k < sh.len; k++) out.push(sh.dir === 'h' ? idx(sh.x + k, sh.y) : idx(sh.x, sh.y + k));
    return out;
  }
  function shipInside(sh) {
    var ex = sh.dir === 'h' ? sh.x + sh.len - 1 : sh.x, ey = sh.dir === 'v' ? sh.y + sh.len - 1 : sh.y;
    return inside(sh.x, sh.y) && inside(ex, ey);
  }
  /* A placed ship blocks its own cells and every neighbour, diagonals included, because ships may not touch. */
  function block(map, sh) {
    cellsOf(sh).forEach(function (i) {
      var x = i % N, y = (i - x) / N;
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) if (inside(x + dx, y + dy)) map[idx(x + dx, y + dy)] = 1;
    });
  }
  function fits(map, sh) {
    if (!shipInside(sh)) return false;
    var c = cellsOf(sh);
    for (var k = 0; k < c.length; k++) if (map[c[k]]) return false;
    return true;
  }
  function isInt(v) { return typeof v === 'number' && v === Math.floor(v); }
  function shipShape(sh) { return !!sh && isInt(sh.x) && isInt(sh.y) && isInt(sh.len) && (sh.dir === 'h' || sh.dir === 'v'); }
  /* Checks a whole fleet: the right lengths, inside the grid, no overlap and no touching. */
  function fleetOk(ships) {
    if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
    for (var i = 0; i < ships.length; i++) if (!shipShape(ships[i])) return false;
    var lens = ships.map(function (s) { return s.len; }).sort(function (a, b) { return b - a; });
    for (i = 0; i < FLEET.length; i++) if (lens[i] !== FLEET[i]) return false;
    var map = [];
    for (i = 0; i < ships.length; i++) {
      if (!fits(map, ships[i])) return false;
      block(map, ships[i]);
    }
    return true;
  }
  /* A random legal fleet from the rng. The fixed fleet at the end is a safety net that is practically never used. */
  function randomFleet(rng) {
    for (var attempt = 0; attempt < 50; attempt++) {
      var map = [], ships = [], good = true;
      for (var i = 0; i < FLEET.length && good; i++) {
        var placed = false;
        for (var tries = 0; tries < 200 && !placed; tries++) {
          var sh = { x: rng.int(N), y: rng.int(N), len: FLEET[i], dir: rng.next() < 0.5 ? 'h' : 'v' };
          if (fits(map, sh)) { block(map, sh); ships.push(sh); placed = true; }
        }
        if (!placed) good = false;
      }
      if (good) return ships;
    }
    return [{ x: 0, y: 0, len: 5, dir: 'h' }, { x: 0, y: 2, len: 4, dir: 'h' }, { x: 0, y: 4, len: 3, dir: 'h' }, { x: 5, y: 4, len: 3, dir: 'h' }, { x: 0, y: 6, len: 2, dir: 'h' }, { x: 4, y: 6, len: 2, dir: 'h' }];
  }
  function withHits(ships) { return ships.map(function (sh) { return { x: sh.x, y: sh.y, len: sh.len, dir: sh.dir, hits: 0 }; }); }
  function sunk(sh) { return sh.hits >= sh.len; }
  function allSunk(ships) { for (var i = 0; i < ships.length; i++) if (!sunk(ships[i])) return false; return true; }
  function remainingLens(ships) { return ships.filter(function (sh) { return !sunk(sh); }).map(function (sh) { return sh.len; }).sort(function (a, b) { return b - a; }); }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  function neighbours(i) {
    var x = i % N, y = (i - x) / N, out = [];
    if (x > 0) out.push(i - 1);
    if (x < N - 1) out.push(i + 1);
    if (y > 0) out.push(i - N);
    if (y < N - 1) out.push(i + N);
    return out;
  }
  /* What the shooter legitimately knows about the enemy board: the shots fired and the sunk ships that were announced. */
  function knowledge(s, p) {
    var q = 1 - p, shots = s.shots[q], sunkMap = [], openHits = [], sunkShips = s.ships[q].filter(sunk);
    sunkShips.forEach(function (sh) { cellsOf(sh).forEach(function (i) { sunkMap[i] = 1; }); });
    for (var i = 0; i < N * N; i++) if (shots[i] === 2 && !sunkMap[i]) openHits.push(i);
    return { shots: shots, sunkMap: sunkMap, openHits: openHits, remaining: remainingLens(s.ships[q]), sunkShips: sunkShips };
  }
  function unshot(shots, list) { return list.filter(function (i) { return shots[i] === 0; }); }
  function uniq(list) { var seen = {}, out = []; list.forEach(function (i) { if (!seen[i]) { seen[i] = 1; out.push(i); } }); return out; }
  function toAction(i) { return { x: i % N, y: Math.floor(i / N) }; }
  /* The cells where no ship can lie: misses, sunk ships and their neighbours, and the diagonal neighbours of hits. */
  function impossible(k) {
    var bad = [], i, x, y, dx, dy;
    for (i = 0; i < N * N; i++) if (k.shots[i] === 1 || k.sunkMap[i]) bad[i] = 1;
    k.sunkShips.forEach(function (sh) { block(bad, sh); });
    k.openHits.forEach(function (h) {
      x = h % N; y = (h - x) / N;
      for (dx = -1; dx <= 1; dx += 2) for (dy = -1; dy <= 1; dy += 2) if (inside(x + dx, y + dy)) bad[idx(x + dx, y + dy)] = 1;
    });
    return bad;
  }
  /* Target mode for levels 1 and 2: extend a line of open hits at its ends, else try the neighbours of the hits. */
  function targetCells(k) {
    var hits = k.openHits, out = [];
    if (hits.length >= 2) {
      var x0 = hits[0] % N, y0 = Math.floor(hits[0] / N), sameRow = true, sameCol = true;
      hits.forEach(function (h) { if (h % N !== x0) sameCol = false; if (Math.floor(h / N) !== y0) sameRow = false; });
      if (sameRow || sameCol) {
        var sorted = hits.slice().sort(function (a, b) { return a - b; }), step = sameRow ? 1 : N;
        var lo = sorted[0] - step, hi = sorted[sorted.length - 1] + step;
        if (sameRow ? (sorted[0] % N > 0) : lo >= 0) out.push(lo);
        if (sameRow ? (sorted[sorted.length - 1] % N < N - 1) : hi < N * N) out.push(hi);
        out = unshot(k.shots, out);
        if (out.length) return out;
      }
    }
    hits.forEach(function (h) { out = out.concat(neighbours(h)); });
    return unshot(k.shots, uniq(out));
  }
  /* Level 3: for every remaining ship and every placement that is still possible, add weight to its cells. With open
     hits only placements covering a hit count; the cell with the highest weight is the shot. */
  function densityShot(k, rng) {
    var bad = impossible(k), dens = [], i, any = false;
    for (i = 0; i < N * N; i++) dens[i] = 0;
    k.remaining.forEach(function (len) {
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) ['h', 'v'].forEach(function (dir) {
        var sh = { x: x, y: y, len: len, dir: dir };
        if (!shipInside(sh)) return;
        var c = cellsOf(sh), covered = 0;
        for (var j = 0; j < c.length; j++) { if (bad[c[j]]) return; if (k.shots[c[j]] === 2) covered++; }
        if (k.openHits.length && !covered) return;
        var w = 1 + covered * covered * 20;
        for (j = 0; j < c.length; j++) if (k.shots[c[j]] === 0) { dens[c[j]] += w; any = true; }
      });
    });
    if (!any) return null;
    var best = -1, cand = [];
    for (i = 0; i < N * N; i++) if (k.shots[i] === 0) {
      if (dens[i] > best) { best = dens[i]; cand = [i]; } else if (dens[i] === best) cand.push(i);
    }
    return rng.pick(cand);
  }
  var SHIP_KEYS = { 5: 'ship5', 4: 'ship4', 3: 'ship3', 2: 'ship2' };
  var G = {
    id: 'battleship',
    name: { de: 'Schiffe versenken', en: 'Battleship' },
    blurb: { de: 'Flotte verstecken, Felder beschießen, zuerst alles versenken.', en: 'Hide your fleet, call your shots, sink everything first.' },
    icon: '🚢',
    counts: [2],
    ai: true,
    hidden: true,
    strings: {
      de: {
        yours: 'Deine Flotte', enemy: 'Gegner', rotate: 'Drehen', horiz: 'waagerecht', vert: 'senkrecht', placeHere: 'Hier setzen', random: 'Zufällige Flotte', undo: 'Schiff zurück', confirm: 'Flotte bestätigen',
        ghostHint: 'Schiff antippen oder Hier setzen wählen, Drehen dreht es',
        placeHint: 'Tippe ein Feld für das Schiff: {0} ({1} Felder)', placeBad: 'Hier passt das Schiff nicht, Schiffe dürfen sich nicht berühren',
        placedAll: 'Alle Schiffe stehen. Bestätigen?', waitPlace: 'Warte, bis {0} die Flotte aufgestellt hat', placing: '{0} stellt die Flotte auf',
        shoot: 'Tippe ein Feld beim Gegner, um zu schießen', hitAgain: 'Treffer! Du darfst gleich noch einmal schießen', shotAlready: 'Dieses Feld wurde schon beschossen',
        sunk: '{0} versenkt!', sunkYours: 'Dein {0} wurde versenkt', left: 'Noch {0} Schiffe', ship5: 'Schlachtschiff', ship4: 'Kreuzer', ship3: 'Zerstörer', ship2: 'U-Boot',
        rules: 'Jeder stellt verdeckt sechs Schiffe auf: ein Fünfer, ein Vierer, zwei Dreier und zwei Zweier. Schiffe liegen gerade und dürfen sich nicht berühren, auch nicht über Eck. Dann wird abwechselnd auf das gegnerische Feld geschossen. Wer trifft, darf gleich noch einmal schießen. Ein Schiff ist versenkt, wenn alle seine Felder getroffen sind. Wer zuerst alle gegnerischen Schiffe versenkt hat, gewinnt.'
      },
      en: {
        yours: 'Your fleet', enemy: 'Enemy', rotate: 'Rotate', horiz: 'horizontal', vert: 'vertical', placeHere: 'Place here', random: 'Random fleet', undo: 'Undo ship', confirm: 'Confirm fleet',
        ghostHint: 'Tap the ship or choose Place here, Rotate turns it',
        placeHint: 'Tap a cell for the ship: {0} ({1} cells)', placeBad: 'The ship does not fit there, ships may not touch',
        placedAll: 'All ships are placed. Confirm?', waitPlace: 'Waiting for {0} to place the fleet', placing: '{0} is placing the fleet',
        shoot: 'Tap a cell on the enemy grid to fire', hitAgain: 'Hit! You may fire again right away', shotAlready: 'That cell has already been shot',
        sunk: '{0} sunk!', sunkYours: 'Your {0} was sunk', left: '{0} ships left', ship5: 'Battleship', ship4: 'Cruiser', ship3: 'Destroyer', ship2: 'Submarine',
        rules: 'Each player secretly places six ships: one of length five, one of four, two of three and two of two. Ships lie in a straight line and may not touch, not even diagonally. Players then take turns firing at the enemy grid. A hit earns another shot right away. A ship is sunk when all its cells are hit. The first to sink the whole enemy fleet wins.'
      }
    },
    create: function () {
      var z0 = [], z1 = [];
      for (var i = 0; i < N * N; i++) { z0.push(0); z1.push(0); }
      return { phase: 'place', ships: [null, null], shots: [z0, z1], turn: 0, winner: -1 };
    },
    current: function (s) { return s.phase === 'shoot' ? s.turn : -1; },
    canAct: function (s, p) {
      if (s.phase === 'place') return p >= 0 && p < 2 && !s.ships[p];
      return s.phase === 'shoot' && s.turn === p;
    },
    actions: function (s, p) {
      if (s.phase === 'place') return G.canAct(s, p) ? null : [];
      if (!G.canAct(s, p)) return [];
      var out = [], shots = s.shots[1 - p];
      for (var i = 0; i < N * N; i++) if (shots[i] === 0) out.push(toAction(i));
      return out;
    },
    validate: function (s, p, a) {
      if (!a || !G.canAct(s, p)) return false;
      if (s.phase === 'place') return a.auto === true || fleetOk(a.place);
      if (!isInt(a.x) || !isInt(a.y) || !inside(a.x, a.y)) return false;
      return s.shots[1 - p][idx(a.x, a.y)] === 0;
    },
    apply: function (s, p, a, rng) {
      var next = copy(s), events = [];
      if (s.phase === 'place') {
        next.ships[p] = withHits(a.auto ? randomFleet(rng) : a.place);
        if (next.ships[0] && next.ships[1]) next.phase = 'shoot';
        events.push({ e: 'placed', p: p });
        return { state: next, events: events };
      }
      var q = 1 - p, i = idx(a.x, a.y), ship = null;
      for (var k = 0; k < next.ships[q].length; k++) if (cellsOf(next.ships[q][k]).indexOf(i) >= 0) { ship = next.ships[q][k]; break; }
      if (ship) {
        next.shots[q][i] = 2;
        ship.hits++;
        events.push({ e: 'shot', by: p, x: a.x, y: a.y, hit: true });
        if (sunk(ship)) events.push({ e: 'sunk', p: q, ship: { x: ship.x, y: ship.y, len: ship.len, dir: ship.dir } });
        if (allSunk(next.ships[q])) { next.phase = 'over'; next.winner = p; events.push({ e: 'win', p: p }); }
      } else {
        next.shots[q][i] = 1;
        next.turn = q;
        events.push({ e: 'shot', by: p, x: a.x, y: a.y, hit: false });
      }
      return { state: next, events: events };
    },
    over: function (s) { return s.phase === 'over' ? { winner: s.winner, ranking: [s.winner, 1 - s.winner] } : null; },
    /* The view of player p: the enemy fleet reduced to its sunk ships. For p = -1 (hot seat, log) it is the view of
       the player who has to act; after the game everything is shown. */
    view: function (s, p) {
      if (p < 0) p = s.phase === 'shoot' ? s.turn : s.phase === 'place' ? (s.ships[0] ? 1 : 0) : -1;
      var v = copy(s);
      v.you = p;
      v.placed = [!!s.ships[0], !!s.ships[1]];
      v.remaining = [s.ships[0] ? remainingLens(s.ships[0]) : FLEET.slice(), s.ships[1] ? remainingLens(s.ships[1]) : FLEET.slice()];
      if (s.phase !== 'over' && p >= 0) {
        var q = 1 - p;
        v.ships[q] = s.ships[q] ? s.ships[q].filter(sunk) : null;
      }
      return v;
    },
    ai: function (s, p, level, rng) {
      if (s.phase === 'place') return { auto: true };
      if (!G.canAct(s, p)) return null;
      var k = knowledge(s, p), all = [], i;
      for (i = 0; i < N * N; i++) if (k.shots[i] === 0) all.push(i);
      if (!all.length) return null;
      var pick = null;
      if (level >= 3) pick = densityShot(k, rng);
      if (pick === null && k.openHits.length) {
        var t = targetCells(k);
        if (t.length) pick = rng.pick(t);
      }
      if (pick === null && level >= 2) {
        var bad = impossible(k);
        var parity = all.filter(function (c) { return !bad[c] && ((c % N) + Math.floor(c / N)) % 2 === 0; });
        if (!parity.length) parity = all.filter(function (c) { return !bad[c]; });
        if (parity.length) pick = rng.pick(parity);
      }
      if (pick === null) pick = rng.pick(all);
      return toAction(pick);
    },
    ui: {
      mount: function (el, api) {
        /* The board looks like the plastic game: two blue sea grids with a bevelled frame and a letter and number rim,
           the ships as kit silhouettes lying on the grid, white pegs for misses and red pegs for hits. */
        var LETTERS = 'ABCDEFGHIJ';
        var wrap = document.createElement('div'); wrap.className = 'bs-wrap';
        function panel(cls) {
          var pn = document.createElement('div'); pn.className = 'bs-panel ' + cls;
          var head = document.createElement('div'); head.className = 'bs-head';
          var title = document.createElement('div'); title.className = 'bs-title';
          var sub = document.createElement('div'); sub.className = 'bs-sub';
          var fleet = document.createElement('div'); fleet.className = 'bs-fleet';
          head.appendChild(title); head.appendChild(sub);
          var board = document.createElement('div'); board.className = 'bs-board';
          var corner = document.createElement('div'); corner.className = 'bs-corner';
          var top = document.createElement('div'); top.className = 'bs-rim bs-rim-top';
          var left = document.createElement('div'); left.className = 'bs-rim bs-rim-left';
          for (var k = 0; k < N; k++) {
            var a = document.createElement('span'); a.textContent = LETTERS.charAt(k); top.appendChild(a);
            var b = document.createElement('span'); b.textContent = String(k + 1); left.appendChild(b);
          }
          var sea = document.createElement('div'); sea.className = 'bs-sea';
          var grid = document.createElement('div'); grid.className = 'bs-grid';
          var cells = [];
          for (var i = 0; i < N * N; i++) { var d = document.createElement('div'); d.className = 'bs-cell'; d.dataset.i = i; grid.appendChild(d); cells.push(d); }
          var ships = document.createElement('div'); ships.className = 'bs-layer bs-ships';
          var pegs = document.createElement('div'); pegs.className = 'bs-layer bs-pegs';
          var fx = document.createElement('div'); fx.className = 'bs-layer bs-fx';
          sea.appendChild(grid); sea.appendChild(ships); sea.appendChild(pegs); sea.appendChild(fx);
          board.appendChild(corner); board.appendChild(top); board.appendChild(left); board.appendChild(sea);
          pn.appendChild(head); pn.appendChild(fleet); pn.appendChild(board);
          return { el: pn, title: title, sub: sub, fleet: fleet, board: board, sea: sea, grid: grid, cells: cells, ships: ships, pegs: pegs, fx: fx };
        }
        var mine = panel('bs-mine'), foe = panel('bs-foe');
        var hint = document.createElement('div'); hint.className = 'bs-hint';
        var bar = document.createElement('div'); bar.className = 'bs-bar';
        function button(key, fn) { var b = document.createElement('button'); b.className = 'bs-btn'; b.textContent = api.t(key); b.onclick = fn; bar.appendChild(b); return b; }
        var view = null, info = null, me = 0, draft = { ships: [], dir: 'h', you: -1 }, ghost = null, lastHitByMe = false;
        var geo = { cell: 28, rim: 20 };
        function draftMap() { var map = []; draft.ships.forEach(function (sh) { block(map, sh); }); return map; }
        function placing() { return view && view.phase === 'place' && info && info.canAct && !view.placed[me]; }
        var rotateBtn = button('rotate', function () { draft.dir = draft.dir === 'h' ? 'v' : 'h'; if (ghost) ghost.dir = draft.dir; api.sound('move'); render(); });
        var placeBtn = button('placeHere', function () { placeGhost(); });
        var undoBtn = button('undo', function () { draft.ships.pop(); ghost = null; render(); });
        var randomBtn = button('random', function () { if (placing()) api.act({ auto: true }); });
        var confirmBtn = button('confirm', function () { if (placing() && draft.ships.length === FLEET.length) api.act({ place: draft.ships.slice() }); });
        wrap.appendChild(mine.el); wrap.appendChild(foe.el);
        el.appendChild(wrap); el.appendChild(hint); el.appendChild(bar);
        /* The cell size follows the width of the match area: two boards side by side when they fit, else one below the other. */
        function layout() {
          var avail = wrap.clientWidth || el.clientWidth || 360, two = avail >= 2 * 296 + 18;
          var panelW = two ? Math.min(440, Math.floor((avail - 16) / 2)) : Math.min(avail, 440);
          var cell = Math.floor((panelW - 34) / 10.7);
          geo.cell = Math.max(22, cell); geo.rim = Math.round(geo.cell * 0.7);
          wrap.style.setProperty('--cell', geo.cell + 'px'); wrap.style.setProperty('--rim', geo.rim + 'px');
        }
        function cellAt(ev) { var t = ev.target; while (t && t !== el && !(t.classList && t.classList.contains('bs-cell'))) t = t.parentNode; return t && t.classList && t.classList.contains('bs-cell') ? +t.dataset.i : -1; }
        function draftShipAt(i) { return { x: i % N, y: Math.floor(i / N), len: FLEET[draft.ships.length], dir: draft.dir }; }
        function placeGhost() {
          if (!ghost || !placing()) return;
          if (!fits(draftMap(), ghost)) { api.toast(api.t('placeBad')); api.sound('wrong'); return; }
          draft.ships.push(ghost); ghost = null; api.sound('move'); render();
        }
        /* The first tap puts a ghost ship on the grid, a tap on the ghost or the place button sets it down. */
        mine.grid.onclick = function (ev) {
          var i = cellAt(ev);
          if (i < 0 || !placing() || draft.ships.length >= FLEET.length) return;
          if (ghost && shipInside(ghost) && cellsOf(ghost).indexOf(i) >= 0) { placeGhost(); return; }
          ghost = draftShipAt(i); api.sound('move'); render();
        };
        foe.grid.onclick = function (ev) {
          var i = cellAt(ev);
          if (i < 0 || !view || view.phase !== 'shoot' || !info || !info.canAct) return;
          if (view.shots[1 - me][i]) { api.toast(api.t('shotAlready')); return; }
          api.act(toAction(i));
        };
        function pitch() { return geo.cell + 1; }
        function shipEl(sh, color, cls) {
          var c = geo.cell, span = sh.len * c + (sh.len - 1), d = document.createElement('div'), inner = document.createElement('div');
          d.className = 'bs-ship ' + (cls || ''); inner.className = 'bs-shipin';
          inner.innerHTML = Gfx.ship(sh.len, span, color);
          d.style.left = (sh.x * pitch()) + 'px'; d.style.top = (sh.y * pitch()) + 'px';
          if (sh.dir === 'h') { d.style.width = span + 'px'; d.style.height = c + 'px'; }
          else { d.style.width = c + 'px'; d.style.height = span + 'px'; d.className += ' v'; inner.style.width = span + 'px'; inner.style.height = c + 'px'; }
          d.appendChild(inner);
          return d;
        }
        function pegEl(i, hit) {
          var p = document.createElement('i'); p.className = 'bs-peg ' + (hit ? 'hit' : 'miss');
          p.style.left = ((i % N) * pitch()) + 'px'; p.style.top = (Math.floor(i / N) * pitch()) + 'px';
          return p;
        }
        /* A splash of water for a miss, a burst of fire and smoke for a hit, removed again after the animation. */
        function effect(pn, i, hit) {
          var f = document.createElement('div'); f.className = 'bs-f ' + (hit ? 'burst' : 'splash');
          f.style.left = ((i % N) * pitch()) + 'px'; f.style.top = (Math.floor(i / N) * pitch()) + 'px';
          f.innerHTML = hit ? '<i class="fl"></i><i class="sm a"></i><i class="sm b"></i><i class="sm c"></i>' : '<i class="r1"></i><i class="r2"></i><i class="dr a"></i><i class="dr b"></i><i class="dr c"></i>';
          pn.fx.appendChild(f);
          setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1300);
        }
        function fleetStrip(pn, remaining, color, placedCount) {
          var left = remaining.slice(), html = '';
          FLEET.forEach(function (len, k) {
            var alive;
            if (placedCount != null) alive = k < placedCount;
            else { var at = left.indexOf(len); alive = at >= 0; if (alive) left.splice(at, 1); }
            html += '<span class="bs-mini' + (alive ? '' : ' gone') + '">' + Gfx.ship(len, len * 12, color) + '</span>';
          });
          pn.fleet.innerHTML = html;
        }
        function paint(pn, ships, shots, color, ghostSh) {
          pn.ships.innerHTML = ''; pn.pegs.innerHTML = '';
          (ships || []).forEach(function (sh) { pn.ships.appendChild(shipEl(sh, color, sunk(sh) ? 'sunk' : '')); });
          if (ghostSh) pn.ships.appendChild(shipEl(ghostSh, color, 'ghost ' + (fits(draftMap(), ghostSh) ? 'ok' : 'bad')));
          for (var i = 0; i < N * N; i++) if (shots[i]) pn.pegs.appendChild(pegEl(i, shots[i] === 2));
          pn.el.style.setProperty('--pc', color);
        }
        function shipName(len) { return api.t(SHIP_KEYS[len]); }
        function render() {
          if (!view || !info) return;
          var v = view, foeIdx = 1 - me, ov = G.over(v);
          if (draft.you !== me || v.phase !== 'place') { draft.ships = []; draft.you = me; ghost = null; }
          var isPlacing = placing(), complete = draft.ships.length === FLEET.length;
          var myShips = v.phase === 'place' ? draft.ships : v.ships[me];
          paint(mine, myShips, v.shots[me], info.colors[me], isPlacing && !complete ? ghost : null);
          paint(foe, v.ships[foeIdx], v.shots[foeIdx], info.colors[foeIdx], null);
          fleetStrip(mine, v.remaining[me], info.colors[me], v.phase === 'place' ? draft.ships.length : null);
          fleetStrip(foe, v.remaining[foeIdx], info.colors[foeIdx], null);
          mine.title.textContent = info.names[me] === undefined ? api.t('yours') : api.t('yours') + ': ' + info.names[me];
          foe.title.textContent = api.t('enemy') + ': ' + (info.names[foeIdx] || '');
          mine.sub.textContent = v.phase === 'place' ? '' : api.t('left', v.remaining[me].length);
          foe.sub.textContent = v.phase === 'place' ? '' : api.t('left', v.remaining[foeIdx].length);
          foe.el.classList.toggle('dim', !ov && !(v.phase === 'shoot' && !!info.canAct));
          mine.el.classList.toggle('active', v.phase === 'place' && !!info.canAct);
          foe.el.classList.toggle('active', v.phase === 'shoot' && !!info.canAct);
          bar.style.display = isPlacing ? '' : 'none';
          rotateBtn.style.display = complete ? 'none' : ''; placeBtn.style.display = ghost && !complete ? '' : 'none';
          undoBtn.style.display = draft.ships.length ? '' : 'none';
          confirmBtn.style.display = complete ? '' : 'none';
          rotateBtn.textContent = api.t('rotate') + ': ' + api.t(draft.dir === 'h' ? 'horiz' : 'vert');
          var text;
          if (ov) text = ov.winner === me ? api.t('youWin') : api.t('wins', info.names[ov.winner]);
          else if (v.phase === 'place') {
            if (isPlacing) {
              if (complete) text = api.t('placedAll');
              else if (ghost) text = fits(draftMap(), ghost) ? api.t('ghostHint') : api.t('placeBad');
              else text = api.t('placeHint', shipName(FLEET[draft.ships.length]), FLEET[draft.ships.length]);
            } else if (v.placed[me]) text = api.t('waitPlace', info.names[foeIdx]);
            else text = api.t('placing', info.names[me]);
          } else if (info.canAct) text = lastHitByMe ? api.t('hitAgain') : api.t('shoot');
          else text = api.t('wait', info.names[v.turn]);
          hint.textContent = text;
          hint.classList.toggle('bad', !!(isPlacing && ghost && !complete && !fits(draftMap(), ghost)));
        }
        var style = document.createElement('style');
        style.textContent = '.bs-wrap{display:flex;flex-wrap:wrap;gap:16px 18px;justify-content:center;align-items:flex-start}' +
          '.bs-panel{flex:0 0 auto;transition:opacity .3s}' +
          '.bs-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 2px 2px}' +
          '.bs-title{font-weight:700;font-size:14px}.bs-sub{font-size:12px;opacity:.7;white-space:nowrap}' +
          '.bs-fleet{display:flex;gap:5px;align-items:center;margin:0 2px 6px;min-height:14px;flex-wrap:wrap}.bs-mini{display:inline-block;line-height:0;transition:opacity .4s}.bs-mini svg{overflow:visible}.bs-mini.gone{opacity:.3;filter:saturate(.2)}' +
          '.bs-board{display:grid;grid-template-columns:var(--rim) auto;grid-template-rows:var(--rim) auto;padding:6px;border-radius:12px;border:3px solid #16467f;' +
          'background:#2a6ec2;background-image:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0) 35%,rgba(0,0,0,.08));' +
          'box-shadow:inset 0 2px 0 rgba(255,255,255,.4),inset 0 -3px 0 rgba(0,0,0,.4),inset 2px 0 0 rgba(255,255,255,.18),inset -2px 0 0 rgba(0,0,0,.3),0 10px 24px rgba(0,0,0,.45);transition:filter .35s,box-shadow .35s}' +
          '.bs-foe.dim .bs-board{filter:brightness(.55) saturate(.7)}' +
          '.bs-panel.active .bs-board{box-shadow:inset 0 2px 0 rgba(255,255,255,.4),inset 0 -3px 0 rgba(0,0,0,.4),0 10px 24px rgba(0,0,0,.45),0 0 0 3px var(--pc),0 0 14px var(--pc)}' +
          '.bs-rim{display:grid;gap:1px;font-weight:700;font-size:calc(var(--cell) * .42);color:#e6f0ff;text-shadow:0 1px 0 rgba(0,0,0,.6),0 -1px 0 rgba(255,255,255,.15);text-align:center;user-select:none}' +
          '.bs-rim-top{grid-template-columns:repeat(10,var(--cell));line-height:var(--rim)}.bs-rim-left{grid-template-rows:repeat(10,var(--cell));line-height:var(--cell)}' +
          '.bs-sea{position:relative;overflow:hidden;border-radius:4px;box-shadow:inset 0 2px 5px rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.4)}' +
          '.bs-grid{display:grid;grid-template-columns:repeat(10,var(--cell));gap:1px;background:#0f3a73}' +
          '.bs-cell{width:var(--cell);height:var(--cell);cursor:pointer;background-color:#1f63b4;background-image:radial-gradient(circle at 50% 50%,#0a2b57 0,#0a2b57 19%,#164d93 21%,rgba(0,0,0,0) 30%),linear-gradient(180deg,rgba(255,255,255,.16),rgba(0,0,0,.14));box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}' +
          '.bs-layer{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none}' +
          '.bs-ship{position:absolute;line-height:0;transition:filter .5s,opacity .3s;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55))}.bs-ship svg{width:100%;height:100%;display:block;overflow:visible}' +
          '.bs-ship.v .bs-shipin{transform-origin:0 0;transform:translateX(var(--cell)) rotate(90deg)}' +
          '.bs-ship.sunk{filter:brightness(.3) saturate(.5) drop-shadow(0 0 1px #ff2d20) drop-shadow(0 0 2px #ff2d20)}' +
          '.bs-ship.ghost{opacity:.7;animation:bsGhost 1.2s ease-in-out infinite}.bs-ship.ghost.ok{filter:drop-shadow(0 0 3px #7dffa0) drop-shadow(0 0 2px #7dffa0)}.bs-ship.ghost.bad{filter:saturate(0) drop-shadow(0 0 3px #ff2d20) drop-shadow(0 0 2px #ff2d20)}' +
          '@keyframes bsGhost{0%,100%{opacity:.75}50%{opacity:.5}}' +
          '.bs-peg{position:absolute;width:var(--cell);height:var(--cell);display:block;animation:bsPeg .25s ease-out}' +
          '.bs-peg::before{content:"";position:absolute;left:22%;top:20%;width:56%;height:56%;border-radius:50%;box-shadow:0 3px 3px rgba(0,0,0,.55),inset 0 -2px 2px rgba(0,0,0,.2)}' +
          '.bs-peg.miss::before{background:radial-gradient(circle at 35% 30%,#fff 0,#eef1f5 30%,#aeb6c0 70%,#6a7380 100%)}' +
          '.bs-peg.hit::before{background:radial-gradient(circle at 35% 30%,#ffb8ad 0,#f2392a 38%,#a3140a 78%,#5a0803 100%)}' +
          '.bs-peg::after{content:"";position:absolute;left:34%;top:28%;width:16%;height:11%;border-radius:50%;background:rgba(255,255,255,.9);transform:rotate(-25deg)}' +
          '@keyframes bsPeg{from{transform:translateY(-40%) scale(1.3);opacity:0}to{transform:none;opacity:1}}' +
          '.bs-f{position:absolute;width:var(--cell);height:var(--cell)}.bs-f i{position:absolute;display:block;border-radius:50%}' +
          '.bs-f.splash .r1,.bs-f.splash .r2{left:15%;top:15%;width:70%;height:70%;border:2px solid rgba(255,255,255,.9);animation:bsRing .7s ease-out forwards}.bs-f.splash .r2{animation-delay:.15s;border-width:1.5px}' +
          '.bs-f.splash .dr{left:45%;top:40%;width:12%;height:12%;background:#fff;animation:bsDrop .6s ease-out forwards}.bs-f.splash .dr.b{animation-name:bsDropL}.bs-f.splash .dr.c{animation-name:bsDropR}' +
          '@keyframes bsRing{from{transform:scale(.2);opacity:1}to{transform:scale(1.9);opacity:0}}' +
          '@keyframes bsDrop{from{transform:translate(0,0);opacity:1}to{transform:translate(0,-130%);opacity:0}}@keyframes bsDropL{from{transform:translate(0,0);opacity:1}to{transform:translate(-120%,-90%);opacity:0}}@keyframes bsDropR{from{transform:translate(0,0);opacity:1}to{transform:translate(120%,-90%);opacity:0}}' +
          '.bs-f.burst .fl{left:5%;top:5%;width:90%;height:90%;background:radial-gradient(circle,#fff6c4 0,#ffb020 30%,#ff4a1a 60%,rgba(255,60,20,0) 72%);animation:bsFlash .55s ease-out forwards}' +
          '.bs-f.burst .sm{left:25%;top:25%;width:50%;height:50%;background:rgba(70,70,70,.75);filter:blur(2px);animation:bsSmoke 1.1s ease-out forwards}.bs-f.burst .sm.b{animation-delay:.15s;left:35%}.bs-f.burst .sm.c{animation-delay:.3s;left:15%}' +
          '@keyframes bsFlash{0%{transform:scale(.2);opacity:1}60%{transform:scale(1.5);opacity:.9}100%{transform:scale(1.8);opacity:0}}' +
          '@keyframes bsSmoke{0%{transform:translateY(0) scale(.6);opacity:.9}100%{transform:translateY(-140%) scale(1.8);opacity:0}}' +
          '.bs-hint{text-align:center;margin-top:12px;font-size:14px;opacity:.85;min-height:18px}.bs-hint.bad{color:#ff8a80;opacity:1}' +
          '.bs-bar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px}' +
          '.bs-btn{font:inherit;font-size:14px;font-weight:600;min-height:42px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:inherit;cursor:pointer}.bs-btn:active{background:rgba(255,255,255,.25)}';
        el.appendChild(style);
        var onResize = function () { layout(); render(); };
        window.addEventListener('resize', onResize);
        layout();
        return {
          update: function (v, inf) {
            view = v; info = inf;
            me = v.you >= 0 ? v.you : inf.me >= 0 ? inf.me : 0;
            var evs = inf.events || [];
            evs.forEach(function (e) { if (e.e === 'shot') lastHitByMe = e.hit && e.by === me; });
            render();
            evs.forEach(function (e) {
              if (e.e === 'shot') {
                effect((1 - e.by) === me ? mine : foe, idx(e.x, e.y), e.hit);
                api.sound(e.hit ? 'capture' : 'move');
              } else if (e.e === 'sunk') {
                api.toast(e.p === me ? api.t('sunkYours', shipName(e.ship.len)) : api.t('sunk', shipName(e.ship.len)));
              }
            });
          },
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
