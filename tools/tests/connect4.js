// Vier gewinnt: the rules and the AI. Run: node tools/tests/connect4.js
const G = require('../../js/games/connect4.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(7);
let s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
ok(G.current(s) === 0 && G.actions(s, 0).length === 7 && G.actions(s, 1).length === 0, 'player 0 begins with seven columns, player 1 has no move');
ok(G.over(s) === null, 'a fresh game is not over');
// a scripted win down column 3 for player 0
[3, 0, 3, 0, 3, 0].forEach((c, i) => { s = G.apply(s, i % 2, { col: c }, r).state; });
ok(G.over(s) === null, 'three in a column is not yet a win');
const before = JSON.stringify(s);
const res = G.apply(s, 0, { col: 3 }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state && G.over(res.state) && G.over(res.state).winner === 0 && res.events.some((e) => e.e === 'win'), 'four in a column wins for player 0');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'nobody moves after the end');
// a full column is not an action
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
for (let i = 0; i < 6; i++) s = G.apply(s, i % 2, { col: 0 }, r).state;
ok(!G.actions(s, 0).some((a) => a.col === 0), 'a full column cannot be played');
// a draw: fill the board without four in a row (a known pattern: columns in pairs)
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
const seq = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
let p = 0; seq.forEach((c) => { if (G.over(s)) return; s = G.apply(s, p, { col: c }, r).state; p = 1 - p; });
ok(G.over(s) && G.over(s).winner === -1 && s.moves === 42, 'the full board without a line is a draw (' + JSON.stringify(G.over(s)) + ')');
// the hard AI blocks an open three and takes a win
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
[0, 6, 1, 6, 2].forEach((c, i) => { s = G.apply(s, i % 2, { col: c }, r).state; });
ok(G.ai(s, 1, 3, r).col === 3, 'the hard AI blocks three in a row');
[3, 5, 5].forEach((c, i) => { s = G.apply(s, [1, 0, 1][i], { col: c }, r).state; });
// player 0 (after 0,1,2 blocked at 3) plays column 4 later; set up a win for player 0 at column 4 bottom: 0,1,2 and 4 empty -> 4 wins only with 3 missing; test another: give player 1 three at column 6 and the AI must finish
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
[6, 0, 6, 1, 6, 5].forEach((c, i) => { s = G.apply(s, [0, 1, 0, 1, 0, 1][i], { col: c }, r).state; });
ok(G.ai(s, 0, 3, r).col === 6, 'the hard AI completes four in a column');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 15 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
