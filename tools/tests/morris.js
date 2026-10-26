// Mühle: the rules and the AI. Run: node tools/tests/morris.js
const G = require('../../js/games/morris.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(5);
const cfg = { n: 2, names: ['A', 'B'], opts: {} };
// Builds a state from a sparse board { index: player } with the given hands.
function pos(pieces, hand, turn, take) {
  const cells = []; for (let i = 0; i < 24; i++) cells.push(-1);
  Object.keys(pieces).forEach((k) => { cells[+k] = pieces[k]; });
  return { cells, hand: hand || [0, 0], turn: turn || 0, take: !!take, quiet: 0, moves: 0, last: -1, removed: -1 };
}
let s = G.create(cfg, r);
ok(G.current(s) === 0 && s.hand[0] === 9 && s.hand[1] === 9, 'player 0 begins with nine men each in hand');
ok(G.actions(s, 0).length === 24 && G.actions(s, 0).every((a) => a.place !== undefined) && G.actions(s, 1).length === 0, 'all 24 points are open for the first placement, player 1 has no move');
ok(G.over(s) === null, 'a fresh game is not over');
const before = JSON.stringify(s);
let res = G.apply(s, 0, { place: 0 }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.cells[0] === 0 && res.state.hand[0] === 8 && res.state.turn === 1, 'a placed man leaves the hand and the turn passes');
// a mill in the placing phase: the same player must take next
s = res.state;
[[1, 8], [0, 1], [1, 9], [0, 2]].forEach(([p, i]) => { s = G.apply(s, p, { place: i }, r).state; });
ok(s.take === true && G.current(s) === 0, 'closing a mill keeps the turn for the removal');
let acts = G.actions(s, 0);
ok(acts.length === 2 && acts.every((a) => a.take === 8 || a.take === 9), 'the removal offers every enemy man (' + JSON.stringify(acts) + ')');
ok(G.actions(s, 0).every((a) => a.place === undefined), 'no placement while a removal is due');
res = G.apply(s, 0, { take: 8 }, r);
ok(res.state.cells[8] === -1 && res.state.take === false && res.state.turn === 1 && res.state.quiet === 0 && res.events.some((e) => e.e === 'remove'), 'the man is removed, the turn passes and the counter resets');
// men inside a mill are protected unless every enemy man stands in a mill
s = pos({ 0: 0, 1: 0, 2: 0, 8: 1, 9: 1, 10: 1, 16: 1 }, [0, 0], 0, true);
acts = G.actions(s, 0);
ok(acts.length === 1 && acts[0].take === 16, 'only the man outside the mill may be taken');
s = pos({ 0: 0, 1: 0, 2: 0, 8: 1, 9: 1, 10: 1 }, [0, 0], 0, true);
ok(G.actions(s, 0).length === 3, 'with every enemy man in a mill any one may be taken');
// the moving phase follows the lines
s = pos({ 0: 0, 3: 0, 5: 0, 9: 0, 23: 1, 22: 1, 21: 1, 20: 1 }, [0, 0], 0);
acts = G.actions(s, 0);
ok(acts.every((a) => a.move !== undefined), 'with empty hands men move');
ok(acts.some((a) => a.move[0] === 0 && a.move[1] === 1) && !acts.some((a) => a.move[0] === 0 && a.move[1] === 3) && !acts.some((a) => a.move[0] === 0 && a.move[1] === 8), 'a man moves only to a free neighbour along a line');
ok(acts.some((a) => a.move[0] === 9 && a.move[1] === 17) && acts.some((a) => a.move[0] === 9 && a.move[1] === 8), 'the middle point of a side connects along the cross line too');
res = G.apply(s, 0, { move: [3, 11] }, r);
ok(res.state.cells[3] === -1 && res.state.cells[11] === 0 && res.state.turn === 1 && !res.state.take, 'a move without a mill passes the turn');
s = pos({ 0: 0, 1: 0, 4: 0, 12: 0, 23: 1, 22: 1, 21: 1, 20: 1 }, [0, 0], 0);
res = G.apply(s, 0, { move: [4, 2] }, r);
ok(res.state.take === true && res.state.turn === 0 && res.events.some((e) => e.e === 'mill'), 'a move that closes a mill is followed by a removal');
// three men fly
s = pos({ 0: 0, 3: 0, 5: 0, 23: 1, 22: 1, 21: 1, 20: 1 }, [0, 0], 0);
acts = G.actions(s, 0);
ok(acts.length === 3 * 17 && acts.some((a) => a.move[0] === 0 && a.move[1] === 12), 'with three men every free point is reachable');
// a player with two men has lost
s = pos({ 0: 0, 3: 0, 23: 1, 22: 1, 21: 1 }, [0, 0], 0);
ok(G.over(s) && G.over(s).winner === 1 && G.current(s) === -1 && G.actions(s, 0).length === 0, 'two men lose the game');
// a player without a legal move has lost
s = pos({ 0: 0, 2: 0, 5: 0, 7: 0, 1: 1, 3: 1, 4: 1, 6: 1, 8: 1 }, [0, 0], 0);
ok(G.over(s) && G.over(s).winner === 1, 'a blocked player loses (' + JSON.stringify(G.over(s)) + ')');
// the 50 move rule
s = pos({ 0: 0, 3: 0, 5: 0, 9: 0, 23: 1, 22: 1, 21: 1, 20: 1 }, [0, 0], 0); s.quiet = 49;
ok(G.over(s) === null, '49 quiet moves are not yet a draw');
res = G.apply(s, 0, { move: [3, 11] }, r);
ok(G.over(res.state) && G.over(res.state).winner === -1, 'the 50th quiet move is a draw');
// the hard AI closes a mill when it can, and blocks one when it must
s = pos({ 0: 0, 1: 0, 8: 1, 11: 1 }, [7, 7], 0);
ok(G.ai(s, 0, 3, r).place === 2, 'the hard AI closes an open mill');
s = pos({ 0: 0, 8: 1, 9: 1, 16: 0 }, [7, 7], 0);
ok(G.ai(s, 0, 3, r).place === 10, 'the hard AI blocks an enemy mill');
const t0 = Date.now(); G.ai(G.create(cfg, r), 0, 3, r); const dt = Date.now() - t0;
ok(dt < 450, 'the hard AI answers within 450 ms (' + dt + ' ms)');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 12, levels: [1, 2] });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'levels 1 and 2 never play an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game at levels 1 and 2 ends (' + rr.ended + ' of ' + rr.played + ', ' + rr.turns + ' turns)');
const r3 = K.playRandomGames(G, { games: 3, levels: [3] });
ok(r3.illegal === 0 && r3.mutated === 0 && !r3.err, 'level 3 never plays an illegal action');
ok(r3.ended === r3.played, 'every random game at level 3 ends (' + r3.ended + ' of ' + r3.played + ', ' + r3.turns + ' turns)');
K.done();
