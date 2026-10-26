// Dame: the rules and the AI. Run: node tools/tests/checkers.js
const G = require('../../js/games/checkers.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(11);
// Builds a state from a sparse board: { index: code }, codes 1 man 2 king of player 0, 3 man 4 king of player 1.
function pos(pieces, turn) {
  const cells = []; for (let i = 0; i < 64; i++) cells.push(0);
  Object.keys(pieces).forEach((k) => { cells[+k] = pieces[k]; });
  return { cells, turn: turn || 0, quiet: 0, moves: 0, last: null };
}
const sq = (r, c) => r * 8 + c;
let s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
ok(s.cells.filter((v) => v === 1).length === 12 && s.cells.filter((v) => v === 3).length === 12, 'twelve men each at the start');
ok(s.cells.every((v, i) => v === 0 || ((i >> 3) + (i & 7)) % 2 === 0), 'all men stand on the dark squares');
ok(G.current(s) === 0 && G.actions(s, 0).length === 7 && G.actions(s, 1).length === 0, 'player 0 begins with seven moves, player 1 has none');
ok(G.over(s) === null, 'a fresh game is not over');
// a simple move: the action carries from, to and the path
const a0 = G.actions(s, 0)[0];
ok(a0.path.length === 2 && a0.from === a0.path[0] && a0.to === a0.path[1], 'a simple move has a two square path');
const before = JSON.stringify(s);
let res = G.apply(s, 0, a0, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.turn === 1 && res.state.cells[a0.to] === 1 && res.state.cells[a0.from] === 0 && res.state.quiet === 1, 'the man moved and the quiet counter grew');
// mandatory capture: the man with a capture is the only one allowed to move
s = pos({ [sq(2, 2)]: 1, [sq(3, 3)]: 3, [sq(0, 6)]: 1 });
let acts = G.actions(s, 0);
ok(acts.length === 1 && acts[0].from === sq(2, 2) && acts[0].to === sq(4, 4) && acts[0].path.length === 2, 'capturing is mandatory and lists only the capture');
res = G.apply(s, 0, acts[0], r);
ok(res.state.cells[sq(3, 3)] === 0 && res.state.cells[sq(4, 4)] === 1 && res.state.quiet === 0, 'the captured man is removed and the counter resets');
ok(res.events.some((e) => e.e === 'capture' && e.at[0] === sq(3, 3)), 'a capture event names the square');
// a double capture is one action, the shorter stop is not offered
s = pos({ [sq(2, 2)]: 1, [sq(3, 3)]: 3, [sq(5, 5)]: 3 });
acts = G.actions(s, 0);
ok(acts.length === 1 && JSON.stringify(acts[0].path) === JSON.stringify([sq(2, 2), sq(4, 4), sq(6, 6)]), 'a double capture is listed as one sequence (' + JSON.stringify(acts) + ')');
res = G.apply(s, 0, acts[0], r);
ok(G.over(res.state) && G.over(res.state).winner === 0, 'player 1 without pieces has lost');
// men do not capture backwards
s = pos({ [sq(4, 4)]: 1, [sq(3, 3)]: 3, [sq(7, 7)]: 3 });
acts = G.actions(s, 0);
ok(acts.length === 2 && acts.every((a) => a.path.length === 2 && (a.to >> 3) === 5), 'a man never captures backwards');
// the choice between captures is free, no maximum rule
s = pos({ [sq(2, 2)]: 1, [sq(3, 3)]: 3, [sq(5, 5)]: 3, [sq(3, 1)]: 3, [sq(7, 1)]: 3 });
acts = G.actions(s, 0);
ok(acts.length === 2 && acts.some((a) => a.path.length === 3) && acts.some((a) => a.path.length === 2 && a.to === sq(4, 0)), 'both capture sequences are offered');
ok(G.ai(s, 0, 3, r).path.length === 3, 'the hard AI takes the double capture');
// promotion, also when the last capture lands on the back rank
s = pos({ [sq(6, 1)]: 1, [sq(0, 7)]: 3 });
res = G.apply(s, 0, { from: sq(6, 1), to: sq(7, 0), path: [sq(6, 1), sq(7, 0)] }, r);
ok(res.state.cells[sq(7, 0)] === 2 && res.events.some((e) => e.e === 'promote') && res.state.quiet === 0, 'a man on the last rank becomes a Dame');
s = pos({ [sq(5, 2)]: 1, [sq(6, 3)]: 3, [sq(6, 5)]: 3, [sq(0, 0)]: 3 });
acts = G.actions(s, 0);
ok(acts.length === 1 && acts[0].to === sq(7, 4) && acts[0].path.length === 2, 'a capture onto the last rank ends the move');
// the flying Dame: long moves and long captures with a free landing square
s = pos({ [sq(0, 0)]: 2, [sq(7, 0)]: 3 }, 0);
acts = G.actions(s, 0);
ok(acts.length === 7 && acts.every((a) => a.from === 0), 'a lone Dame slides the whole diagonal');
s = pos({ [sq(0, 0)]: 2, [sq(5, 5)]: 3 }, 0);
acts = G.actions(s, 0);
ok(acts.length === 2 && acts.some((a) => a.to === sq(6, 6)) && acts.some((a) => a.to === sq(7, 7)), 'the Dame captures from afar and picks a landing square (' + JSON.stringify(acts.map((a) => a.to)) + ')');
// the Dame may not jump two men in a row and cannot capture a man that is backed up
s = pos({ [sq(0, 0)]: 2, [sq(4, 4)]: 3, [sq(5, 5)]: 3 }, 0);
ok(G.actions(s, 0).every((a) => a.to < sq(4, 4)), 'two men in a row block the Dame');
// the Dame turns the corner in a multi capture
s = pos({ [sq(0, 0)]: 2, [sq(3, 3)]: 3, [sq(5, 3)]: 3, [sq(7, 7)]: 3 }, 0);
acts = G.actions(s, 0);
ok(acts.some((a) => a.path.length === 3 && a.path[1] === sq(4, 4) && a.to === sq(6, 2)), 'the Dame captures twice around a corner');
// without a legal move the side to move loses
s = pos({ [sq(0, 0)]: 1, [sq(1, 1)]: 3, [sq(2, 2)]: 3 }, 0);
ok(G.over(s) && G.over(s).winner === 1 && G.current(s) === -1 && G.actions(s, 0).length === 0, 'a blocked player loses');
// the 50 move rule
s = pos({ [sq(0, 0)]: 2, [sq(7, 7)]: 4 }, 0); s.quiet = 49;
ok(G.over(s) === null, '49 quiet moves are not yet a draw');
res = G.apply(s, 0, G.actions(s, 0)[0], r);
ok(G.over(res.state) && G.over(res.state).winner === -1, 'the 50th quiet move is a draw');
// the hard AI avoids giving away a man when it has a safe alternative
s = pos({ [sq(2, 2)]: 1, [sq(2, 6)]: 1, [sq(4, 4)]: 3, [sq(7, 7)]: 3 }, 0);
const safe = G.ai(s, 0, 3, r);
ok(safe.to !== sq(3, 3), 'the hard AI does not walk into a capture (' + JSON.stringify(safe) + ')');
// the hard AI answers within its budget
const t0 = Date.now(); G.ai(G.create({ n: 2, names: ['A', 'B'], opts: {} }, r), 0, 3, r); const dt = Date.now() - t0;
ok(dt < 450, 'the hard AI answers within 450 ms (' + dt + ' ms)');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 12, levels: [1, 2] });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'levels 1 and 2 never play an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game at levels 1 and 2 ends (' + rr.ended + ' of ' + rr.played + ', ' + rr.turns + ' turns)');
const r3 = K.playRandomGames(G, { games: 3, levels: [3] });
ok(r3.illegal === 0 && r3.mutated === 0 && !r3.err, 'level 3 never plays an illegal action');
ok(r3.ended === r3.played, 'every random game at level 3 ends (' + r3.ended + ' of ' + r3.played + ', ' + r3.turns + ' turns)');
K.done();
