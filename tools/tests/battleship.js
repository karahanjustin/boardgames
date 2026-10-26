// Schiffe versenken: the rules, the hidden view and the AI. Run: node tools/tests/battleship.js
const G = require('../../js/games/battleship.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(11);
const cfg = { n: 2, names: ['A', 'B'], opts: {} };
const idx = (x, y) => y * 10 + x;
const cellsOf = (sh) => Array.from({ length: sh.len }, (_, k) => sh.dir === 'h' ? idx(sh.x + k, sh.y) : idx(sh.x, sh.y + k));
const FLEET_A = [{ x: 0, y: 0, len: 5, dir: 'h' }, { x: 0, y: 2, len: 4, dir: 'h' }, { x: 0, y: 4, len: 3, dir: 'h' }, { x: 5, y: 4, len: 3, dir: 'h' }, { x: 0, y: 6, len: 2, dir: 'h' }, { x: 4, y: 6, len: 2, dir: 'h' }];
const FLEET_B = [{ x: 9, y: 0, len: 5, dir: 'v' }, { x: 7, y: 0, len: 4, dir: 'v' }, { x: 5, y: 0, len: 3, dir: 'v' }, { x: 5, y: 5, len: 3, dir: 'v' }, { x: 3, y: 0, len: 2, dir: 'v' }, { x: 3, y: 4, len: 2, dir: 'v' }];
let s = G.create(cfg, r);
ok(s.phase === 'place' && G.current(s) === -1 && G.canAct(s, 0) && G.canAct(s, 1), 'a fresh game is in placement and both players may act');
ok(G.actions(s, 0) === null && G.over(s) === null, 'placement has no action list and the game is not over');
ok(G.validate(s, 0, { place: FLEET_A }) && G.validate(s, 1, { place: FLEET_B }) && G.validate(s, 0, { auto: true }), 'legal fleets and auto placement validate');
// illegal fleets: touching (diagonally), overlapping, outside the grid, wrong lengths, too few ships
const touching = FLEET_A.map((sh) => Object.assign({}, sh)); touching[1] = { x: 5, y: 1, len: 4, dir: 'h' };
ok(!G.validate(s, 0, { place: touching }), 'ships that touch diagonally are rejected');
const overlap = FLEET_A.map((sh) => Object.assign({}, sh)); overlap[1] = { x: 2, y: 0, len: 4, dir: 'v' };
ok(!G.validate(s, 0, { place: overlap }), 'overlapping ships are rejected');
const outside = FLEET_A.map((sh) => Object.assign({}, sh)); outside[0] = { x: 7, y: 0, len: 5, dir: 'h' };
ok(!G.validate(s, 0, { place: outside }), 'a ship outside the grid is rejected');
const wrongLen = FLEET_A.map((sh) => Object.assign({}, sh)); wrongLen[5] = { x: 4, y: 6, len: 3, dir: 'h' };
ok(!G.validate(s, 0, { place: wrongLen }), 'the wrong set of lengths is rejected');
ok(!G.validate(s, 0, { place: FLEET_A.slice(0, 5) }) && !G.validate(s, 0, {}) && !G.validate(s, 0, { x: 1, y: 1 }), 'an incomplete fleet, an empty action and a shot during placement are rejected');
// placement: player 0 by hand, player 1 at random
let before = JSON.stringify(s);
let res = G.apply(s, 0, { place: FLEET_A }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate during placement');
s = res.state;
ok(s.phase === 'place' && !G.canAct(s, 0) && G.canAct(s, 1) && G.actions(s, 0).length === 0, 'after placing, player 0 waits for player 1');
ok(!G.validate(s, 0, { auto: true }), 'a player cannot place twice');
s = G.apply(s, 1, { auto: true }, r).state;
ok(s.phase === 'shoot' && G.current(s) === 0 && s.ships[1].length === 6, 'both fleets placed, player 0 shoots first');
ok(G.validate(G.create(cfg, r), 1, { place: s.ships[1].map((sh) => ({ x: sh.x, y: sh.y, len: sh.len, dir: sh.dir })) }), 'the random fleet is itself a legal fleet');
ok(G.actions(s, 0).length === 100 && G.actions(s, 1).length === 0, 'the shooter has 100 cells, the other player none');
// the hidden view: the enemy fleet is invisible, the own fleet is not
let v1 = G.view(s, 1), v0 = G.view(s, 0);
ok(v1.ships[0].length === 0 && v1.ships[1].length === 6 && v0.ships[0].length === 6 && v0.ships[1].length === 0, 'each view hides the unsunk enemy ships');
ok(!JSON.stringify(v1).includes(JSON.stringify(FLEET_A[0])) && v1.you === 1 && v0.you === 0, 'the view carries no enemy ship and knows its owner');
ok(G.view(s, -1).you === 0 && G.view(s, -1).ships[1].length === 0, 'the hot seat view is the view of the player to act');
// scripted shooting: player 0 sinks the whole fleet of player 1, every hit keeps the turn, a miss passes it
const fleetB = s.ships[1];
const shipCells = fleetB.map(cellsOf);
let allShip = {}; shipCells.forEach((c) => c.forEach((i) => { allShip[i] = 1; }));
let missCell = -1; for (let i = 0; i < 100; i++) if (!allShip[i]) { missCell = i; break; }
before = JSON.stringify(s);
res = G.apply(s, 0, { x: missCell % 10, y: Math.floor(missCell / 10) }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate during shooting');
ok(res.state.turn === 1 && res.events[0].e === 'shot' && res.events[0].hit === false && res.state.shots[1][missCell] === 1, 'a miss passes the turn and is marked');
ok(!G.validate(res.state, 0, { x: 0, y: 0 }), 'the player who missed cannot shoot now');
// player 1 misses back so player 0 is on turn again
let missB = -1; const cellsA = {}; FLEET_A.forEach((sh) => cellsOf(sh).forEach((i) => { cellsA[i] = 1; }));
for (let i = 0; i < 100; i++) if (!cellsA[i]) { missB = i; break; }
s = G.apply(res.state, 1, { x: missB % 10, y: Math.floor(missB / 10) }, r).state;
ok(G.current(s) === 0, 'player 0 is on turn again after the enemy miss');
ok(!G.validate(s, 0, { x: missCell % 10, y: Math.floor(missCell / 10) }), 'a cell cannot be shot twice');
let sunkEvents = 0, turnsKept = true, shots = 0, hitAnnounced = true;
shipCells.forEach((cells, si) => {
  cells.forEach((i, k) => {
    if (G.over(s)) return;
    const rr = G.apply(s, 0, { x: i % 10, y: Math.floor(i / 10) }, r);
    shots++;
    if (!rr.events.some((e) => e.e === 'shot' && e.hit)) hitAnnounced = false;
    if (k === cells.length - 1) { if (rr.events.some((e) => e.e === 'sunk' && e.ship.len === fleetB[si].len)) sunkEvents++; }
    else if (rr.events.some((e) => e.e === 'sunk')) sunkEvents += 100;
    s = rr.state;
    if (!G.over(s) && s.turn !== 0) turnsKept = false;
  });
});
ok(hitAnnounced && turnsKept && shots === 19, 'every hit is announced and keeps the turn (' + shots + ' shots)');
ok(sunkEvents === 6, 'each ship is announced as sunk exactly once when its last cell is hit (' + sunkEvents + ')');
ok(G.over(s) && G.over(s).winner === 0 && G.over(s).ranking[0] === 0 && G.current(s) === -1, 'sinking the whole fleet wins for player 0');
ok(G.actions(s, 0).length === 0 && !G.validate(s, 0, { x: 0, y: 1 }) && !G.canAct(s, 0) && !G.canAct(s, 1), 'nobody acts after the end');
ok(G.view(s, 1).ships[0].length === 6, 'after the game the view shows everything');
// partially sunk fleet: the view shows sunk ships but no others
s = G.create(cfg, r); s = G.apply(s, 0, { place: FLEET_A }, r).state; s = G.apply(s, 1, { place: FLEET_B }, r).state;
[idx(3, 0), idx(3, 1)].forEach((i) => { s = G.apply(s, 0, { x: i % 10, y: Math.floor(i / 10) }, r).state; });
v0 = G.view(s, 0);
ok(v0.ships[1].length === 1 && v0.ships[1][0].len === 2 && v0.remaining[1].length === 5 && v0.remaining[1].indexOf(2) >= 0, 'a sunk enemy ship appears in the view, the others stay hidden');
// the AI: after a single hit, levels 1 to 3 shoot next to it; level 3 never shoots a cell that cannot hold a ship
s = G.create(cfg, r); s = G.apply(s, 0, { place: FLEET_A }, r).state; s = G.apply(s, 1, { place: FLEET_B }, r).state;
s = G.apply(s, 0, { x: 9, y: 2 }, r).state; // a hit on the vertical five of player 1
[1, 2, 3].forEach((lv) => {
  for (let k = 0; k < 10; k++) {
    const a = G.ai(s, 0, lv, K.rng(k + 1));
    const near = (a.x === 9 && (a.y === 1 || a.y === 3)) || (a.x === 8 && a.y === 2);
    ok(near, 'level ' + lv + ' targets a neighbour of a hit (' + JSON.stringify(a) + ')');
  }
});
s = G.apply(s, 0, { x: 9, y: 3 }, r).state; // a second hit in the same column
[2, 3].forEach((lv) => {
  const a = G.ai(s, 0, lv, K.rng(5));
  ok(a.x === 9 && (a.y === 1 || a.y === 4), 'level ' + lv + ' extends the line of two hits (' + JSON.stringify(a) + ')');
});
// level 3 never fires next to a sunk ship: sink the two at (3,0),(3,1), then every shot must avoid their neighbourhood
s = G.create(cfg, r); s = G.apply(s, 0, { place: FLEET_A }, r).state; s = G.apply(s, 1, { place: FLEET_B }, r).state;
[idx(3, 0), idx(3, 1)].forEach((i) => { s = G.apply(s, 0, { x: i % 10, y: Math.floor(i / 10) }, r).state; });
let avoided = true;
for (let k = 0; k < 20; k++) { const a = G.ai(s, 0, 3, K.rng(k + 3)); if (Math.abs(a.x - 3) <= 1 && a.y <= 2) avoided = false; }
ok(avoided, 'level 3 does not fire into the ring around a sunk ship');
// level 3 timing
let t0 = Date.now(); for (let k = 0; k < 20; k++) G.ai(s, 0, 3, K.rng(k)); const ms = (Date.now() - t0) / 20;
ok(ms < 100, 'level 3 answers quickly (' + ms.toFixed(1) + ' ms)');
// level 3 beats level 1 clearly over a set of games
let wins3 = 0, games = 30;
for (let g = 0; g < games; g++) {
  const rr = K.rng(500 + g);
  let st = G.create(cfg, rr);
  st = G.apply(st, 0, { auto: true }, rr).state; st = G.apply(st, 1, { auto: true }, rr).state;
  let t = 0;
  while (!G.over(st) && t++ < 400) { const p = G.current(st); st = G.apply(st, p, G.ai(st, p, p === 0 ? 3 : 1, rr), rr).state; }
  if (G.over(st) && G.over(st).winner === 0) wins3++;
}
ok(wins3 >= 24, 'level 3 beats level 1 in most games (' + wins3 + ' of ' + games + ')');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 15, maxTurns: 500 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
