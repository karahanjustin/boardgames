// Reversi: the rules and the AI. Run: node tools/tests/reversi.js
const G = require('../../js/games/reversi.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(3);
const cfg = { n: 2, names: ['A', 'B'], opts: {} };
// Builds a state from a sparse board { index: player }.
function pos(pieces, turn) {
  const cells = []; for (let i = 0; i < 64; i++) cells.push(-1);
  Object.keys(pieces).forEach((k) => { cells[+k] = pieces[k]; });
  return { cells, turn: turn || 0, last: -1, flipped: [], moves: 0 };
}
const count = (s, p) => s.cells.filter((v) => v === p).length;
let s = G.create(cfg, r);
ok(G.current(s) === 0 && count(s, 0) === 2 && count(s, 1) === 2 && s.cells[28] === 0 && s.cells[27] === 1, 'the standard start with two discs each, player 0 moves first');
let acts = G.actions(s, 0);
ok(JSON.stringify(acts.map((a) => a.at)) === JSON.stringify([19, 26, 37, 44]) && G.actions(s, 1).length === 0, 'the four opening moves (' + JSON.stringify(acts) + ')');
ok(G.over(s) === null, 'a fresh game is not over');
const before = JSON.stringify(s);
let res = G.apply(s, 0, { at: 19 }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.cells[19] === 0 && res.state.cells[27] === 0 && count(res.state, 0) === 4 && count(res.state, 1) === 1 && res.state.turn === 1, 'the move flips the flanked disc');
ok(res.events.some((e) => e.e === 'flip' && e.at.length === 1 && e.at[0] === 27), 'the flip event names the flipped disc');
// a move must flip at least one disc: an isolated square is not legal
ok(!G.actions(s, 0).some((a) => a.at === 0), 'a square that flips nothing is not a move');
// several lines flip at once
s = pos({ 27: 0, 28: 1, 29: 1, 36: 1, 45: 0, 19: 1, 11: 0 }, 0);
res = G.apply(s, 0, { at: 30 }, r);
ok(res.state.cells[28] === 0 && res.state.cells[29] === 0 && res.state.cells[36] !== 0 && res.state.cells[19] !== 0, 'only the flanked line flips, not the neighbours in other directions');
s = pos({ 28: 1, 36: 0, 27: 1, 34: 0, 19: 1, 18: 0, 29: 1 }, 0);
res = G.apply(s, 0, { at: 20 }, r);
ok(res.state.cells[19] === 0 && res.state.cells[28] === 0 && res.state.cells[27] === 0 && res.state.cells[29] === 1 && res.events[1].at.length === 3, 'three lines flip in one move');
// a pass only when no placing move exists, and only then
s = pos({ 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 16: 0 }, 0);
acts = G.actions(s, 0);
ok(acts.length === 1 && acts[0].pass === true && G.over(s) === null, 'without a move the only action is a pass');
res = G.apply(s, 0, { pass: true }, r);
ok(res.state.turn === 1 && JSON.stringify(res.state.cells) === JSON.stringify(s.cells) && res.events[0].e === 'pass', 'a pass changes only the turn');
ok(G.actions(res.state, 1).some((a) => a.at === 24) && !G.actions(res.state, 1).some((a) => a.pass), 'the opponent then moves and may not pass');
// the game ends when neither side can move, most discs win, equal is a draw
s = pos({ 0: 0, 63: 1 }, 0);
ok(G.over(s) && G.over(s).winner === -1 && G.current(s) === -1 && G.actions(s, 0).length === 0, 'two isolated discs: nobody can move, a draw');
s = pos({ 0: 0, 1: 0, 63: 1 }, 1);
ok(G.over(s) && G.over(s).winner === 0, 'more discs win when the game is over');
// the AI: level 1 flips greedily, level 3 grabs a corner and finishes an endgame exactly
s = G.create(cfg, r);
const a1 = G.ai(s, 0, 1, r);
ok(a1 && G.actions(s, 0).some((a) => a.at === a1.at), 'the easy AI plays a legal move');
s = pos({ 9: 1, 18: 0, 27: 0, 28: 1, 35: 1, 36: 0, 29: 0, 37: 1, 44: 0 }, 0);
ok(G.ai(s, 0, 3, r).at === 0, 'the hard AI takes a free corner (' + JSON.stringify(G.ai(s, 0, 3, r)) + ')');
// an endgame with few empties: the exact search ends within the budget
s = G.create(cfg, r);
let p = 0, guard = 0;
while (!G.over(s) && s.cells.filter((v) => v === -1).length > 12 && guard++ < 100) { const a = G.ai(s, G.current(s), 2, r); s = G.apply(s, G.current(s), a, r).state; }
if (!G.over(s)) { const t0 = Date.now(); const a3 = G.ai(s, G.current(s), 3, r); const dt = Date.now() - t0; ok(K.legal(G, s, G.current(s), a3) && dt < 450, 'the hard AI handles the endgame within 450 ms (' + dt + ' ms)'); }
const t1 = Date.now(); G.ai(G.create(cfg, r), 0, 3, r); const dt1 = Date.now() - t1;
ok(dt1 < 450, 'the hard AI answers the opening within 450 ms (' + dt1 + ' ms)');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 15, levels: [1, 2] });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'levels 1 and 2 never play an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game at levels 1 and 2 ends (' + rr.ended + ' of ' + rr.played + ', ' + rr.turns + ' turns)');
const r3 = K.playRandomGames(G, { games: 4, levels: [3] });
ok(r3.illegal === 0 && r3.mutated === 0 && !r3.err, 'level 3 never plays an illegal action');
ok(r3.ended === r3.played, 'every random game at level 3 ends (' + r3.ended + ' of ' + r3.played + ', ' + r3.turns + ' turns)');
K.done();
