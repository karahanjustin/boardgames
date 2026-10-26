// Backgammon: the rules and the AI. Run: node tools/tests/backgammon.js
const G = require('../../js/games/backgammon.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(21);
const mk = () => G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
const pips = (s, p) => s.bar[p] * 25 + s.pts[p].reduce((sum, c, i) => sum + c * (p === 0 ? i + 1 : 24 - i), 0);
const total = (s, p) => s.bar[p] + s.off[p] + s.pts[p].reduce((a, b) => a + b, 0);
const has = (acts, mv) => acts.some((a) => JSON.stringify(a.move) === JSON.stringify(mv));
/* A position from scratch: lists of [point, count] per player, with optional bar and off counts. */
function pos(p0, p1, extra) {
  const s = mk();
  s.pts = [new Array(24).fill(0), new Array(24).fill(0)];
  p0.forEach(([i, c]) => { s.pts[0][i] = c; }); p1.forEach(([i, c]) => { s.pts[1][i] = c; });
  s.bar = [0, 0]; s.off = [0, 0];
  Object.assign(s, extra || {});
  return s;
}
let s = mk();
ok(total(s, 0) === 15 && total(s, 1) === 15 && pips(s, 0) === 167 && pips(s, 1) === 167, 'the standard setup has 15 checkers and 167 pips per side');
ok(s.pts[0][23] === 2 && s.pts[0][12] === 5 && s.pts[0][7] === 3 && s.pts[0][5] === 5 && s.pts[1][0] === 2 && s.pts[1][11] === 5 && s.pts[1][16] === 3 && s.pts[1][18] === 5, 'the checkers stand on the standard points');
ok(G.current(s) === 0 && JSON.stringify(G.actions(s, 0)) === '[{"roll":true}]' && G.actions(s, 1).length === 0, 'player 0 begins and must roll, player 1 has no action');
ok(G.over(s) === null && G.strings.de.rules && G.strings.en.rules, 'a fresh game is not over and the rules exist in both languages');
// rolling
const before = JSON.stringify(s);
let res = G.apply(s, 0, { roll: true }, r);
ok(JSON.stringify(s) === before, 'rolling does not mutate');
ok(res.state.dice && res.state.dice.length === 2 && res.state.dice.every((d) => d >= 1 && d <= 6) && res.events.some((e) => e.e === 'dice' && e.v.length === 2), 'a roll sets two dice and emits a dice event');
ok(res.state.turn === 0 && !G.actions(res.state, 0).some((a) => a.roll), 'after rolling the same player moves and cannot roll again');
// the opening 3-1 makes the 5 point (index 4)
s = mk(); s.dice = [3, 1];
let acts = G.actions(s, 0);
ok(acts.length > 0 && acts.every((a) => a.move.length === 2), 'with 3-1 every complete move uses both dice (' + acts.length + ' moves)');
ok(has(acts, [[7, 4], [5, 4]]) || has(acts, [[5, 4], [7, 4]]), 'making the point with 7>4 and 5>4 is among the moves');
ok(!acts.some((a) => a.move.some((m) => m[1] === 18 || m[1] === 16 || m[1] === 11)), 'no move lands on a point held by two or more enemy checkers');
// every action leads to a different position
const keys = new Set(acts.map((a) => JSON.stringify(G.apply(s, 0, a, r).state.pts)));
ok(keys.size === acts.length, 'the moves are deduplicated by resulting position (' + keys.size + ' of ' + acts.length + ')');
const beforeMove = JSON.stringify(s);
res = G.apply(s, 0, acts[0], r);
ok(JSON.stringify(s) === beforeMove && res.state.turn === 1 && res.state.dice === null && total(res.state, 0) === 15, 'a move does not mutate, passes the turn and clears the dice');
ok(res.events.filter((e) => e.e === 'move').length === 2, 'a two step move emits two move events');
// doubles count four times
s = mk(); s.dice = [6, 6];
acts = G.actions(s, 0);
ok(acts.length > 0 && acts.every((a) => a.move.length === 4), 'with 6-6 every complete move has four steps (' + acts.length + ' moves)');
const sameSteps = (a, mv) => JSON.stringify(a.move.slice().sort()) === JSON.stringify(mv.slice().sort());
ok(acts.some((a) => sameSteps(a, [[23, 17], [23, 17], [12, 6], [12, 6]])), 'the standard 6-6 opening is among the moves (in one step order)');
// opponent moves in the same absolute coordinates, going up
s = mk(); s.turn = 1; s.dice = [3, 1];
acts = G.actions(s, 1);
ok(acts.length > 0 && acts.every((a) => a.move.every((m) => m[1] > m[0])) && (has(acts, [[16, 19], [18, 19]]) || has(acts, [[18, 19], [16, 19]])), 'player 1 moves upward in absolute coordinates and can make point 19');
// only one die usable: the larger must be used
s = pos([[10, 1]], [[3, 2], [0, 13]], { off: [14, 0], dice: [5, 2] });
acts = G.actions(s, 0);
ok(acts.length === 1 && has(acts, [[10, 5]]), 'when only one die can be used it must be the larger (' + JSON.stringify(acts) + ')');
// only the smaller die is usable
s = pos([[10, 1]], [[3, 2], [5, 2], [0, 11]], { off: [14, 0], dice: [5, 2] });
acts = G.actions(s, 0);
ok(acts.length === 1 && has(acts, [[10, 8]]), 'when only the smaller die works it is played (' + JSON.stringify(acts) + ')');
// the bar: enter first, and pass when both entry points are blocked
s = pos([[12, 5], [7, 3], [5, 5], [23, 1]], [[18, 2], [0, 2], [11, 5], [16, 3], [21, 3]], { bar: [1, 0], dice: [6, 1] });
acts = G.actions(s, 0);
ok(acts.length > 0 && acts.every((a) => a.move[0][0] === 24 && a.move[0][1] === 23), 'a checker on the bar enters first, here only with the 1 (' + acts.length + ' moves)');
ok(acts.every((a) => a.move.length === 2), 'after entering the other die is used as well');
s = pos([[12, 5], [7, 3], [5, 5], [23, 1]], [[18, 2], [23, 2], [0, 2], [11, 5], [16, 4]], { bar: [1, 0], dice: [6, 1] });
acts = G.actions(s, 0);
ok(JSON.stringify(acts) === '[{"pass":true}]', 'with both entry points blocked the player can only pass');
res = G.apply(s, 0, { pass: true }, r);
ok(res.state.turn === 1 && res.state.dice === null && res.events.some((e) => e.e === 'pass'), 'passing hands over the turn');
// hitting a blot sends it to the bar
s = pos([[10, 1], [12, 4], [7, 3], [5, 5], [23, 2]], [[7, 0], [8, 1], [0, 2], [11, 5], [16, 3], [18, 4]], { dice: [2, 6] });
acts = G.actions(s, 0);
ok(acts.some((a) => a.move[0][0] === 10 && a.move[0][1] === 8), 'the blot on 8 can be hit');
res = G.apply(s, 0, acts.find((a) => a.move[0][0] === 10 && a.move[0][1] === 8), r);
ok(res.state.bar[1] === 1 && res.state.pts[1][8] === 0 && res.state.pts[0][8] >= 1 && res.events.some((e) => e.e === 'hit' && e.at === 8), 'the hit checker goes to the bar');
ok(total(res.state, 1) === 15, 'no checker is lost by a hit');
// bearing off needs every checker at home, exact rolls or a higher roll for the furthest checker
s = pos([[0, 5], [1, 5], [5, 5]], [[18, 15]], { dice: [6, 2] });
acts = G.actions(s, 0);
ok(has(acts, [[5, 25], [1, 25]]) || has(acts, [[1, 25], [5, 25]]), 'exact rolls bear off from the 6 point and the 2 point');
ok(!acts.some((a) => a.move.some((m) => m[0] === 0 && m[1] === 25)), 'a 2 may not bear off from the 1 point while checkers stand further back');
s = pos([[0, 5], [1, 5], [5, 4], [12, 1]], [[18, 15]], { dice: [6, 2] });
ok(!G.actions(s, 0).some((a) => a.move.some((m) => m[1] === 25)), 'nothing bears off while a checker stays outside the home board');
s = pos([[0, 5], [1, 5], [5, 4], [7, 1]], [[18, 15]], { dice: [6, 2] });
acts = G.actions(s, 0);
ok(acts.some((a) => a.move[1][1] === 25) && acts.every((a) => a.move[0][0] === 7), 'once the last checker comes home mid turn the other die may bear off (' + JSON.stringify(acts) + ')');
s = pos([[2, 15]], [[18, 15]], { dice: [5, 4] });
acts = G.actions(s, 0);
ok(acts.length === 1 && has(acts, [[2, 25], [2, 25]]), 'higher rolls bear off the furthest checker, one deduplicated action (' + JSON.stringify(acts) + ')');
// the win
s = pos([[0, 1]], [[18, 15]], { off: [14, 0], dice: [1, 1] });
acts = G.actions(s, 0);
ok(acts.length === 1 && has(acts, [[0, 25]]), 'the last checker leaves with a single step even on doubles');
res = G.apply(s, 0, acts[0], r);
ok(G.over(res.state) && G.over(res.state).winner === 0 && res.events.some((e) => e.e === 'win') && G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'bearing off the fifteenth checker wins');
// player 1 bears off upward and enters from the bar at die - 1
s = pos([[0, 15]], [[23, 14]], { turn: 1, bar: [0, 1], dice: [3, 4] });
acts = G.actions(s, 1);
ok(acts.length > 0 && acts.every((a) => a.move[0][0] === 24 && (a.move[0][1] === 2 || a.move[0][1] === 3)), 'player 1 enters at point die - 1');
s = pos([[0, 15]], [[22, 15]], { turn: 1, dice: [2, 5] });
acts = G.actions(s, 1);
ok(acts.length === 1 && has(acts, [[22, 25], [22, 25]]), 'player 1 bears off with exact and higher rolls');
// the AI: rolls when it must, never returns an illegal action, takes a winning bear off
s = mk();
ok(JSON.stringify(G.ai(s, 0, 1, r)) === '{"roll":true}' && JSON.stringify(G.ai(s, 0, 3, r)) === '{"roll":true}', 'the AI rolls when no dice are out');
s = pos([[0, 1], [3, 1]], [[18, 15]], { off: [13, 0], dice: [4, 1] });
const aiWin = G.ai(s, 0, 2, r);
ok(JSON.stringify(aiWin.move) === JSON.stringify([[3, 25], [0, 25]]) || JSON.stringify(aiWin.move) === JSON.stringify([[0, 25], [3, 25]]), 'the normal AI bears off both checkers and wins (' + JSON.stringify(aiWin) + ')');
// the hard AI stays under the time budget on a busy position with doubles
s = mk(); s.dice = [4, 4];
let worst = 0;
for (let i = 0; i < 5; i++) { const t0 = Date.now(); const a = G.ai(s, 0, 3, K.rng(300 + i)); worst = Math.max(worst, Date.now() - t0); ok(K.legal(G, s, 0, a), 'the hard AI move is legal on 4-4'); }
ok(worst < 400, 'the hard AI answers 4-4 from the start within 400 ms (worst ' + worst + ' ms)');
// random games with the AI at every level; the easy and normal levels play more games, the hard level fewer
const r12 = K.playRandomGames(G, { games: 12, levels: [1, 2], maxTurns: 20000 });
ok(r12.illegal === 0 && r12.mutated === 0 && !r12.err, 'levels 1 and 2: the AI never plays an illegal action and apply never mutates');
ok(r12.ended === r12.played, 'levels 1 and 2: every random game ends (' + r12.ended + ' of ' + r12.played + ', ' + Math.round(r12.turns / r12.played) + ' actions each)');
const r3 = K.playRandomGames(G, { games: 3, levels: [3], maxTurns: 20000 });
ok(r3.illegal === 0 && r3.mutated === 0 && !r3.err, 'level 3: the AI never plays an illegal action and apply never mutates');
ok(r3.ended === r3.played, 'level 3: every random game ends (' + r3.ended + ' of ' + r3.played + ', ' + Math.round(r3.turns / r3.played) + ' actions each)');
K.done();
