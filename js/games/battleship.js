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
        yours: 'Deine Flotte', enemy: 'Gegner', rotate: 'Drehen', random: 'Zufällige Flotte', undo: 'Schiff zurück', confirm: 'Flotte bestätigen',
        placeHint: 'Tippe ein Feld für das Schiff: {0} ({1} Felder)', placeBad: 'Hier passt das Schiff nicht, Schiffe dürfen sich nicht berühren',
        placedAll: 'Alle Schiffe stehen. Bestätigen?', waitPlace: 'Warte, bis {0} die Flotte aufgestellt hat', placing: '{0} stellt die Flotte auf',
        shoot: 'Tippe ein Feld beim Gegner, um zu schießen', hitAgain: 'Treffer! Du darfst gleich noch einmal schießen', shotAlready: 'Dieses Feld wurde schon beschossen',
        sunk: '{0} versenkt!', sunkYours: 'Dein {0} wurde versenkt', left: 'Noch {0} Schiffe', ship5: 'Schlachtschiff', ship4: 'Kreuzer', ship3: 'Zerstörer', ship2: 'U-Boot',
        rules: 'Jeder stellt verdeckt sechs Schiffe auf: ein Fünfer, ein Vierer, zwei Dreier und zwei Zweier. Schiffe liegen gerade und dürfen sich nicht berühren, auch nicht über Eck. Dann wird abwechselnd auf das gegnerische Feld geschossen. Wer trifft, darf gleich noch einmal schießen. Ein Schiff ist versenkt, wenn alle seine Felder getroffen sind. Wer zuerst alle gegnerischen Schiffe versenkt hat, gewinnt.'
      },
      en: {
        yours: 'Your fleet', enemy: 'Enemy', rotate: 'Rotate', random: 'Random fleet', undo: 'Undo ship', confirm: 'Confirm fleet',
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
        var wrap = document.createElement('div'); wrap.className = 'bs-wrap';
        function panel(cls, title) {
          var pn = document.createElement('div'); pn.className = 'bs-panel ' + cls;
          var h = document.createElement('div'); h.className = 'bs-title'; h.textContent = title;
          var sub = document.createElement('div'); sub.className = 'bs-sub';
          var grid = document.createElement('div'); grid.className = 'bs-grid';
          var cells = [];
          for (var i = 0; i < N * N; i++) { var d = document.createElement('div'); d.className = 'bs-cell'; d.dataset.i = i; grid.appendChild(d); cells.push(d); }
          pn.appendChild(h); pn.appendChild(sub); pn.appendChild(grid);
          return { el: pn, title: h, sub: sub, grid: grid, cells: cells };
        }
        var mine = panel('bs-mine', api.t('yours')), foe = panel('bs-foe', api.t('enemy'));
        var hint = document.createElement('div'); hint.className = 'bs-hint';
        var bar = document.createElement('div'); bar.className = 'bs-bar';
        function button(key, fn) { var b = document.createElement('button'); b.className = 'bs-btn'; b.textContent = api.t(key); b.onclick = fn; bar.appendChild(b); return b; }
        var view = null, info = null, me = 0, draft = { ships: [], dir: 'h', you: -1 }, ghost = [], lastHitByMe = false;
        function draftMap() { var map = []; draft.ships.forEach(function (sh) { block(map, sh); }); return map; }
        function placing() { return view && view.phase === 'place' && info && info.canAct && !view.placed[me]; }
        var rotateBtn = button('rotate', function () { draft.dir = draft.dir === 'h' ? 'v' : 'h'; ghost = []; render(); });
        var undoBtn = button('undo', function () { draft.ships.pop(); ghost = []; render(); });
        var randomBtn = button('random', function () { if (placing()) api.act({ auto: true }); });
        var confirmBtn = button('confirm', function () { if (placing() && draft.ships.length === FLEET.length) api.act({ place: draft.ships.slice() }); });
        wrap.appendChild(mine.el); wrap.appendChild(foe.el);
        el.appendChild(wrap); el.appendChild(hint); el.appendChild(bar);
        function cellAt(ev) { var t = ev.target; while (t && t !== el && !(t.classList && t.classList.contains('bs-cell'))) t = t.parentNode; return t && t.classList && t.classList.contains('bs-cell') ? +t.dataset.i : -1; }
        function draftShipAt(i) { return { x: i % N, y: Math.floor(i / N), len: FLEET[draft.ships.length], dir: draft.dir }; }
        mine.grid.onclick = function (ev) {
          var i = cellAt(ev);
          if (i < 0 || !placing() || draft.ships.length >= FLEET.length) return;
          var sh = draftShipAt(i);
          if (!fits(draftMap(), sh)) { api.toast(api.t('placeBad')); api.sound('wrong'); return; }
          draft.ships.push(sh); ghost = []; api.sound('move'); render();
        };
        mine.grid.onmousemove = function (ev) {
          var i = cellAt(ev);
          if (i < 0 || !placing() || draft.ships.length >= FLEET.length) { if (ghost.length) { ghost = []; render(); } return; }
          var sh = draftShipAt(i), g = shipInside(sh) ? cellsOf(sh) : [i];
          if (g.join() !== ghost.join()) { ghost = g; render(); }
        };
        mine.grid.onmouseleave = function () { if (ghost.length) { ghost = []; render(); } };
        foe.grid.onclick = function (ev) {
          var i = cellAt(ev);
          if (i < 0 || !view || view.phase !== 'shoot' || !info || !info.canAct) return;
          if (view.shots[1 - me][i]) { api.toast(api.t('shotAlready')); return; }
          api.act(toAction(i));
        };
        function paint(pn, ships, shots, color, ghostCells) {
          var owner = [], caps = [], gm = {};
          (ships || []).forEach(function (sh, si) {
            var c = cellsOf(sh);
            c.forEach(function (i, k) {
              owner[i] = sh;
              caps[i] = (k === 0 ? (sh.dir === 'h' ? ' cap-l' : ' cap-t') : '') + (k === c.length - 1 ? (sh.dir === 'h' ? ' cap-r' : ' cap-b') : '');
            });
          });
          (ghostCells || []).forEach(function (i) { gm[i] = 1; });
          var ghostOk = ghostCells && ghostCells.length > 1 && fits(draftMap(), draftShipAt(ghostCells[0]));
          for (var i = 0; i < N * N; i++) {
            var d = pn.cells[i], cls = 'bs-cell', sh = owner[i];
            if (sh) { cls += ' ship' + caps[i]; if (sunk(sh)) cls += ' sunk'; d.style.setProperty('--pc', color); }
            if (shots[i] === 2) cls += ' hit'; else if (shots[i] === 1) cls += ' miss';
            if (gm[i]) cls += ghostOk ? ' ghost' : ' ghost bad';
            d.className = cls;
          }
        }
        function shipName(len) { return api.t(SHIP_KEYS[len]); }
        function render() {
          if (!view || !info) return;
          var v = view, foeIdx = 1 - me, ov = G.over(v);
          if (draft.you !== me || v.phase !== 'place') { draft.ships = []; draft.you = me; }
          var myShips = v.phase === 'place' ? draft.ships : v.ships[me];
          paint(mine, myShips, v.shots[me], info.colors[me], v.phase === 'place' ? ghost : []);
          paint(foe, v.ships[foeIdx], v.shots[foeIdx], info.colors[foeIdx], []);
          mine.title.textContent = info.names[me] === undefined ? api.t('yours') : api.t('yours') + ': ' + info.names[me];
          foe.title.textContent = api.t('enemy') + ': ' + (info.names[foeIdx] || '');
          mine.sub.textContent = v.phase === 'place' ? '' : api.t('left', v.remaining[me].length);
          foe.sub.textContent = v.phase === 'place' ? '' : api.t('left', v.remaining[foeIdx].length);
          foe.el.classList.toggle('dim', v.phase === 'place');
          mine.el.classList.toggle('active', v.phase === 'place' && !!info.canAct);
          foe.el.classList.toggle('active', v.phase === 'shoot' && !!info.canAct);
          var isPlacing = placing(), complete = draft.ships.length === FLEET.length;
          bar.style.display = isPlacing ? '' : 'none';
          rotateBtn.style.display = complete ? 'none' : ''; undoBtn.style.display = draft.ships.length ? '' : 'none';
          confirmBtn.style.display = complete ? '' : 'none';
          rotateBtn.textContent = api.t('rotate') + ' (' + (draft.dir === 'h' ? '↔' : '↕') + ')';
          var text;
          if (ov) text = ov.winner === me ? api.t('youWin') : api.t('wins', info.names[ov.winner]);
          else if (v.phase === 'place') {
            if (isPlacing) text = complete ? api.t('placedAll') : api.t('placeHint', shipName(FLEET[draft.ships.length]), FLEET[draft.ships.length]);
            else if (v.placed[me]) text = api.t('waitPlace', info.names[foeIdx]);
            else text = api.t('placing', info.names[me]);
          } else if (info.canAct) text = lastHitByMe ? api.t('hitAgain') : api.t('shoot');
          else text = api.t('wait', info.names[v.turn]);
          hint.textContent = text;
        }
        var style = document.createElement('style');
        style.textContent = '.bs-wrap{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;align-items:flex-start}' +
          '.bs-panel{flex:1 1 280px;max-width:420px;min-width:260px;border-radius:12px;padding:8px;background:rgba(255,255,255,.04);transition:opacity .3s}' +
          '.bs-panel.dim{opacity:.4}.bs-panel.active{box-shadow:0 0 0 2px rgba(255,255,255,.35)}' +
          '.bs-title{font-weight:600;font-size:14px;margin:2px 4px}.bs-sub{font-size:12px;opacity:.7;margin:0 4px 6px;min-height:14px}' +
          '.bs-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;aspect-ratio:1;background:#0d2a52;padding:4px;border-radius:8px;box-shadow:inset 0 0 0 2px #0a2041}' +
          '.bs-cell{position:relative;background:#1f5fae;border-radius:3px;cursor:pointer;background-image:linear-gradient(rgba(255,255,255,.06),rgba(0,0,0,.08))}' +
          '.bs-foe .bs-cell:hover{filter:brightness(1.25)}' +
          '.bs-cell.ship{background:var(--pc);box-shadow:inset 0 2px 0 rgba(255,255,255,.3),inset 0 -3px 0 rgba(0,0,0,.3)}' +
          '.bs-cell.ship.cap-l{border-radius:45% 3px 3px 45%}.bs-cell.ship.cap-r{border-radius:3px 45% 45% 3px}.bs-cell.ship.cap-t{border-radius:45% 45% 3px 3px}.bs-cell.ship.cap-b{border-radius:3px 3px 45% 45%}' +
          '.bs-cell.ship.sunk{filter:saturate(.3) brightness(.7)}' +
          '.bs-cell.miss::after{content:"";position:absolute;left:35%;top:35%;width:30%;height:30%;border-radius:50%;background:rgba(255,255,255,.75);animation:bsPop .3s ease-out}' +
          '.bs-cell.hit::before,.bs-cell.hit::after{content:"";position:absolute;left:46%;top:12%;width:8%;height:76%;background:#ff3b30;border-radius:2px;transform:rotate(45deg);box-shadow:0 0 4px rgba(0,0,0,.5)}' +
          '.bs-cell.hit::after{transform:rotate(-45deg)}.bs-cell.hit{background:#8a2a2a}.bs-cell.ship.hit{background:#c0392b}' +
          '.bs-cell.boom{animation:bsBoom .6s ease-out}' +
          '.bs-cell.ghost{outline:2px solid rgba(255,255,255,.8);outline-offset:-2px;background:rgba(255,255,255,.35)}.bs-cell.ghost.bad{outline-color:#ff3b30;background:rgba(255,59,48,.4)}' +
          '@keyframes bsBoom{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,120,0,.9)}50%{transform:scale(1.35);box-shadow:0 0 16px 8px rgba(255,120,0,.6)}100%{transform:scale(1);box-shadow:none}}' +
          '@keyframes bsPop{from{transform:scale(0)}to{transform:scale(1)}}' +
          '.bs-hint{text-align:center;margin-top:12px;font-size:14px;opacity:.85;min-height:18px}' +
          '.bs-bar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px}' +
          '.bs-btn{font:inherit;font-size:14px;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:inherit;cursor:pointer}.bs-btn:hover{background:rgba(255,255,255,.2)}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            me = v.you >= 0 ? v.you : inf.me >= 0 ? inf.me : 0;
            var evs = inf.events || [];
            evs.forEach(function (e) { if (e.e === 'shot') lastHitByMe = e.hit && e.by === me; });
            render();
            evs.forEach(function (e) {
              if (e.e === 'shot') {
                var pn = (1 - e.by) === me ? mine : foe, d = pn.cells[idx(e.x, e.y)];
                if (e.hit) { d.classList.remove('boom'); void d.offsetWidth; d.classList.add('boom'); }
                api.sound(e.hit ? 'capture' : 'move');
              } else if (e.e === 'sunk') {
                api.toast(e.p === me ? api.t('sunkYours', shipName(e.ship.len)) : api.t('sunk', shipName(e.ship.len)));
              }
            });
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
