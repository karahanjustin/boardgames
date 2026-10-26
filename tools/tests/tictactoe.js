// Tic-tac-toe: the rules and the AI. Run: node tools/tests/tictactoe.js
const G = require('../../js/games/tictactoe.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(11);
let s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
ok(G.current(s) === 0 && G.actions(s, 0).length === 9 && G.actions(s, 1).length === 0, 'player 0 begins with nine squares, player 1 has no move');
ok(G.over(s) === null, 'a fresh game is not over');
ok(G.strings.de.rules && G.strings.en.rules, 'the rules are given in both languages');
// a scripted win along the top row for player 0
[0, 3, 1, 4].forEach((c, i) => { s = G.apply(s, i % 2, { at: c }, r).state; });
ok(G.over(s) === null, 'two in a row is not yet a win');
ok(!G.actions(s, 0).some((a) => a.at === 0), 'a taken square cannot be played');
const before = JSON.stringify(s);
const res = G.apply(s, 0, { at: 2 }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(G.over(res.state) && G.over(res.state).winner === 0 && res.events.some((e) => e.e === 'win'), 'three in a row wins for player 0');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'nobody moves after the end');
// a draw
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
[0, 4, 8, 2, 6, 3, 5, 7, 1].forEach((c, i) => { s = G.apply(s, i % 2, { at: c }, r).state; });
ok(G.over(s) && G.over(s).winner === -1 && s.moves === 9, 'a full board without a line is a draw');
// the normal AI takes a win and blocks a threat
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
[0, 4, 1].forEach((c, i) => { s = G.apply(s, i % 2, { at: c }, r).state; });
ok(G.ai(s, 1, 2, r).at === 2, 'the normal AI blocks two in a row');
ok(G.ai(s, 1, 3, r).at === 2, 'the hard AI blocks two in a row');
s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
[0, 4, 1, 8].forEach((c, i) => { s = G.apply(s, i % 2, { at: c }, r).state; });
ok(G.ai(s, 0, 2, r).at === 2, 'the normal AI completes its own line');
// the perfect AI never loses: as second player against every first move and random play, and as first player
let lost = 0, gamesPlayed = 0;
for (let seed = 0; seed < 120; seed++) {
  const rr = K.rng(500 + seed), aiP = seed % 2;
  let g = G.create({ n: 2, names: ['A', 'B'], opts: {} }, rr);
  while (!G.over(g)) {
    const p = G.current(g);
    const a = p === aiP ? G.ai(g, p, 3, rr) : rr.pick(G.actions(g, p));
    g = G.apply(g, p, a, rr).state;
  }
  gamesPlayed++;
  if (G.over(g).winner === 1 - aiP) lost++;
}
ok(lost === 0, 'the perfect AI never loses against random play (' + lost + ' of ' + gamesPlayed + ')');
// two perfect players always draw
let draws = 0;
for (let seed = 0; seed < 20; seed++) {
  const rr = K.rng(900 + seed);
  let g = G.create({ n: 2, names: ['A', 'B'], opts: {} }, rr);
  while (!G.over(g)) { const p = G.current(g); g = G.apply(g, p, G.ai(g, p, 3, rr), rr).state; }
  if (G.over(g).winner === -1) draws++;
}
ok(draws === 20, 'two perfect players always draw (' + draws + ' of 20)');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 100 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
