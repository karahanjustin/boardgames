// Leiterspiel: the rules. Run: node tools/tests/snakes.js
const G = require('../../js/games/snakes.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(5);
// a die that always shows the given number, for scripted turns
const fixed = (v) => ({ next: () => 0, int: () => v - 1, pick: (a) => a[0], shuffle: (a) => a });
const roll = (s, p, v) => G.apply(s, p, { roll: true }, fixed(v));
const mk = (n) => G.create({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: {} }, r);
let s = mk(2);
ok(G.current(s) === 0 && K.deepEq(G.actions(s, 0), [{ roll: true }]) && G.actions(s, 1).length === 0, 'player 0 begins with a roll, player 1 has no action');
ok(G.over(s) === null && s.pos.every((x) => x === 0), 'a fresh game is not over and everyone is before square 1');
// a one lands on the first ladder and climbs to 38
const before = JSON.stringify(s);
let res = roll(s, 0, 1);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.pos[0] === 38 && res.events.some((e) => e.e === 'ladder' && e.from === 1 && e.to === 38) && res.state.turn === 1, 'a one climbs the ladder from 1 to 38 and the turn passes');
ok(res.events[0].e === 'dice' && res.events[0].v === 1 && res.state.die === 1, 'the die is reported and stored');
// a six rolls again
s = res.state;
res = roll(s, 1, 6);
ok(res.state.pos[1] === 6 && res.state.turn === 1 && res.events.some((e) => e.e === 'again'), 'a six keeps the turn');
// a snake head sends the piece down
s = res.state; s.pos[1] = 15;
res = roll(s, 1, 1);
ok(res.state.pos[1] === 6 && res.events.some((e) => e.e === 'snake' && e.from === 16 && e.to === 6), 'square 16 is a snake head leading to 6');
// the goal must be hit exactly
s = mk(2); s.pos[0] = 97;
res = roll(s, 0, 5);
ok(res.state.pos[0] === 97 && res.events.some((e) => e.e === 'stay') && res.state.turn === 1, 'overshooting the goal leaves the piece where it is');
res = roll(s, 0, 3);
ok(res.state.pos[0] === 100 && res.events.some((e) => e.e === 'arrive') && G.over(res.state) && G.over(res.state).winner === 0 && K.deepEq(G.over(res.state).ranking, [0, 1]), 'the exact roll arrives and ends a two player game');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'nobody rolls after the end');
// a six that arrives does not roll again, and arrived players are skipped
s = mk(3); s.pos[0] = 94; s.pos[1] = 50; s.pos[2] = 20;
res = roll(s, 0, 6);
ok(res.state.pos[0] === 100 && res.state.turn === 1 && G.over(res.state) === null, 'with three players the first arrival keeps the game going');
s = res.state; s.turn = 2;
res = roll(s, 2, 2);
ok(res.state.turn === 1, 'the arrived player is skipped in the turn order');
s = res.state; s.pos[1] = 99;
res = roll(s, 1, 1);
ok(G.over(res.state) && K.deepEq(G.over(res.state).ranking, [0, 1, 2]), 'the second arrival ends a three player game with a full ranking');
// the ranking of those still on the way follows their position
s = mk(4); s.pos = [100, 30, 99, 100]; s.arrived = [3, 0]; s.turn = 2;
res = roll(s, 2, 1);
ok(K.deepEq(G.over(res.state).ranking, [3, 0, 2, 1]), 'the remaining players are ranked by their square');
ok(G.ai(mk(2), 0, 1, r).roll === true && G.ai(mk(2), 1, 3, r) === null, 'the AI rolls on its turn and has nothing otherwise');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 15, maxTurns: 5000 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ', ' + Math.round(rr.turns / rr.played) + ' rolls on average)');
K.done();
