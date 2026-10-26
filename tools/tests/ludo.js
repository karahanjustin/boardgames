// Mensch ärgere Dich nicht: the rules and the AI. Run: node tools/tests/ludo.js
const G = require('../../js/games/ludo.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(11);
// a die that always shows the given number, for scripted turns
const fixed = (v) => ({ next: () => 0, int: () => v - 1, pick: (a) => a[0], shuffle: (a) => a });
const roll = (s, p, v) => G.apply(s, p, { roll: true }, fixed(v)).state;
const mk = (n) => G.create({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: {} }, r);
let s = mk(2);
ok(G.current(s) === 0 && K.deepEq(G.actions(s, 0), [{ roll: true }]) && G.actions(s, 1).length === 0, 'player 0 begins with a roll, player 1 has no action');
ok(G.over(s) === null && s.seats[1] === 2, 'a fresh game is not over and two players sit opposite');
// three tries for a six with everything in the house
s = roll(s, 0, 3);
ok(s.die === 3 && K.deepEq(G.actions(s, 0), [{ pass: true }]), 'a three with everything in the house leaves only the pass');
s = G.apply(s, 0, { pass: true }, r).state;
ok(s.turn === 0 && s.tries === 1 && s.die === 0, 'the first failed try keeps the turn');
s = G.apply(roll(s, 0, 2), 0, { pass: true }, r).state;
ok(s.turn === 0 && s.tries === 2, 'the second failed try keeps the turn');
s = G.apply(roll(s, 0, 5), 0, { pass: true }, r).state;
ok(s.turn === 1 && s.tries === 0, 'the third failed try passes the turn');
// a six brings one piece out and grants another roll; the house pieces are listed only once
s = mk(2);
s = roll(s, 0, 6);
ok(K.deepEq(G.actions(s, 0), [{ move: 0 }]), 'a six offers exactly one house piece');
let res = G.apply(s, 0, { move: 0 }, r);
s = res.state;
ok(s.pos[0][0] === 0 && s.turn === 0 && s.die === 0 && res.events.some((e) => e.e === 'out'), 'the piece stands on the start and the player rolls again');
// the piece on the start square must move on while pieces wait in the house
s = roll(s, 0, 6);
ok(K.deepEq(G.actions(s, 0), [{ move: 0 }]), 'with a six the start piece is forced to move on');
s = G.apply(s, 0, { move: 0 }, r).state;
ok(s.pos[0][0] === 6, 'the start piece advanced six squares');
s = roll(s, 0, 6);
ok(K.deepEq(G.actions(s, 0), [{ move: 1 }]), 'with the start free a six must bring the next piece out');
s = G.apply(s, 0, { move: 1 }, r).state;
s = roll(s, 0, 3);
ok(K.deepEq(G.actions(s, 0), [{ move: 1 }]), 'a three forces the start piece on, not the piece ahead');
s = G.apply(s, 0, { move: 1 }, r).state;
ok(s.pos[0][1] === 3 && s.turn === 1, 'after a plain roll the turn passes');
// own pieces block landing and jumping
s = mk(2); s.pos[0] = [2, 5, -1, -1]; s.turn = 0;
ok(G.actions(roll(s, 0, 3), 0).every((a) => a.move !== 0), 'a piece may not land on an own piece');
ok(G.actions(roll(s, 0, 4), 0).every((a) => a.move !== 0), 'a piece may not jump over an own piece');
ok(G.actions(roll(s, 0, 2), 0).some((a) => a.move === 0), 'a short move in front of the own piece is fine');
// a capture sends the enemy home; seat 2 starts on square 20, so its relative 25 is absolute 5
s = mk(2); s.pos[0] = [2, -1, -1, -1]; s.pos[1] = [25, -1, -1, -1]; s.turn = 0;
s = roll(s, 0, 3);
const before = JSON.stringify(s);
res = G.apply(s, 0, { move: 0 }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.pos[0][0] === 5 && res.state.pos[1][0] === -1 && res.events.some((e) => e.e === 'capture' && e.p === 1), 'landing on an enemy sends it home');
// the home column needs the exact number
s = mk(2); s.pos[0] = [38, -1, -1, -1]; s.turn = 0;
ok(G.actions(roll(s, 0, 3), 0).some((a) => a.move === 0), 'a 38 with a three enters the home column');
s.pos[0] = [41, -1, -1, -1];
ok(K.deepEq(G.actions(roll(s, 0, 3), 0), [{ pass: true }]), 'overshooting the last home square is not allowed');
ok(G.actions(roll(s, 0, 2), 0).some((a) => a.move === 0), 'the exact number reaches the last home square');
// finishing: two players end at once, three players play on for the places
s = mk(2); s.pos[0] = [43, 42, 41, 38]; s.turn = 0;
res = G.apply(roll(s, 0, 2), 0, { move: 3 }, r);
ok(res.events.some((e) => e.e === 'finish') && G.over(res.state) && G.over(res.state).winner === 0 && K.deepEq(G.over(res.state).ranking, [0, 1]), 'all four at home wins a two player game');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'nobody moves after the end');
s = mk(3); s.pos[0] = [43, 42, 41, 38]; s.turn = 0;
s = G.apply(roll(s, 0, 2), 0, { move: 3 }, r).state;
ok(G.over(s) === null && s.turn === 1 && s.finished[0] === 0, 'with three players the game goes on after the first finisher');
s.pos[2] = [40, 41, 42, 43]; s.turn = 1; s.pos[1] = [43, 42, 41, 39];
s = G.apply(roll(s, 1, 1), 1, { move: 3 }, r).state;
ok(G.over(s) && K.deepEq(G.over(s).ranking, [0, 1, 2]), 'the second finisher ends a three player game with a full ranking');
// a six without a legal move still grants another roll, three failed tries do not apply then
s = mk(2); s.pos[0] = [37, 43, 42, 41]; s.turn = 0;
s = roll(s, 0, 6);
ok(K.deepEq(G.actions(s, 0), [{ pass: true }]), 'a six with every piece blocked by own pieces has no move');
s = G.apply(s, 0, { pass: true }, r).state;
ok(s.turn === 0 && s.die === 0, 'after a six the same player rolls again');
// the AI: level 2 and 3 take a capture when offered
s = mk(2); s.pos[0] = [2, 10, -1, -1]; s.pos[1] = [25, -1, -1, -1]; s.turn = 0;
s = roll(s, 0, 3);
ok(G.ai(s, 0, 2, r).move === 0 && G.ai(s, 0, 3, r).move === 0, 'the AI prefers the capture');
ok(G.ai(mk(2), 0, 3, r).roll === true, 'the AI rolls when the roll is due');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 12, maxTurns: 30000 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ', ' + Math.round(rr.turns / rr.played) + ' actions on average)');
K.done();
