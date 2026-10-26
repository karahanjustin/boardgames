// Kniffel: the rules and the AI. Run: node tools/tests/kniffel.js
const G = require('../../js/games/kniffel.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(11);
const FIELDS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'kniffel', 'chance'];
let s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
ok(G.current(s) === 0 && G.over(s) === null && s.round === 1, 'a fresh game: player 0 begins in round 1');
ok(K.deepEq(G.actions(s, 0), [{ roll: [] }]) && G.actions(s, 1).length === 0, 'before the first roll the only action is the roll without keeps');
const before = JSON.stringify(s);
let res = G.apply(s, 0, { roll: [] }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.dice.length === 5 && res.state.rolls === 1 && res.events.some((e) => e.e === 'dice' && e.v.length === 5), 'the first roll gives five dice and a dice event');
s = res.state;
const acts = G.actions(s, 0);
ok(acts.filter((a) => a.roll).length === 31 && acts.filter((a) => a.score).length === 13, 'after a roll: 31 keep patterns and 13 free fields');
ok(!acts.some((a) => a.roll && a.roll.every((k) => k)), 'keeping all five dice is not a roll');
// kept dice stay, the others change over many seeds
let kept = true;
for (let i = 0; i < 20; i++) { const rr = K.rng(i + 1); let t = G.create({ n: 1, names: ['A'], opts: {} }, rr); t = G.apply(t, 0, { roll: [] }, rr).state; const d = t.dice.slice(); t = G.apply(t, 0, { roll: [true, true, false, false, true] }, rr).state; if (t.dice[0] !== d[0] || t.dice[1] !== d[1] || t.dice[4] !== d[4]) kept = false; }
ok(kept, 'kept dice keep their value on the next roll');
s = G.apply(s, 0, { roll: [false, false, false, false, false] }, r).state;
s = G.apply(s, 0, { roll: [false, false, false, false, false] }, r).state;
ok(s.rolls === 3 && G.actions(s, 0).every((a) => a.score), 'after three rolls only scoring remains');
// scoring with fixed dice: build a state by hand
function withDice(st, dice) { const c = JSON.parse(JSON.stringify(st)); c.dice = dice; c.rolls = 3; return c; }
let t = withDice(s, [2, 2, 2, 5, 5]);
let sc = {};
['twos', 'three', 'four', 'full', 'small', 'large', 'kniffel', 'chance', 'fives'].forEach((f) => { sc[f] = G.apply(t, 0, { score: f }, r).state.sheet[0][f]; });
ok(sc.twos === 6 && sc.fives === 10 && sc.three === 16 && sc.four === 0 && sc.full === 25 && sc.small === 0 && sc.large === 0 && sc.kniffel === 0 && sc.chance === 16, 'the scores of 2 2 2 5 5 are right (' + JSON.stringify(sc) + ')');
t = withDice(s, [1, 2, 3, 4, 6]);
ok(G.apply(t, 0, { score: 'small' }, r).state.sheet[0].small === 30 && G.apply(t, 0, { score: 'large' }, r).state.sheet[0].large === 0, 'a small straight is 30 and not a large one');
t = withDice(s, [2, 3, 4, 5, 6]);
ok(G.apply(t, 0, { score: 'large' }, r).state.sheet[0].large === 40 && G.apply(t, 0, { score: 'small' }, r).state.sheet[0].small === 30, 'a large straight scores both straights');
t = withDice(s, [4, 4, 4, 4, 4]);
res = G.apply(t, 0, { score: 'kniffel' }, r);
ok(res.state.sheet[0].kniffel === 50 && res.state.turn === 1 && res.state.rolls === 0 && res.state.dice.length === 0, 'a Kniffel scores 50 and passes the turn with fresh dice');
// a second Kniffel: bonus and joker
let j = JSON.parse(JSON.stringify(res.state)); j.turn = 0; j.dice = [6, 6, 6, 6, 6]; j.rolls = 1;
let jr = G.apply(j, 0, { score: 'large' }, r);
ok(jr.state.sheet[0].large === 40 && jr.state.bonus[0] === 1, 'a second Kniffel is a joker for the large straight and pays the bonus');
jr = G.apply(j, 0, { score: 'full' }, r);
ok(jr.state.sheet[0].full === 25 && jr.state.bonus[0] === 1, 'the joker fills the full house with 25');
jr = G.apply(j, 0, { score: 'sixes' }, r);
ok(jr.state.sheet[0].sixes === 30 && jr.state.bonus[0] === 1, 'the joker may also go into the matching upper field');
jr = G.apply(j, 0, { score: 'ones' }, r);
ok(jr.state.sheet[0].ones === 0 && jr.state.bonus[0] === 1, 'an upper field without the number stays zero, the bonus still counts');
j.sheet[0].kniffel = 0;
jr = G.apply(j, 0, { score: 'small' }, r);
ok(jr.state.sheet[0].small === 30 && jr.state.bonus[0] === 0, 'with a zero in the Kniffel field the joker works but pays no bonus');
// the upper bonus and the totals through a whole scripted solo game
let solo = G.create({ n: 1, names: ['A'], opts: {} }, r);
const plan = { ones: [1, 1, 1, 2, 3], twos: [2, 2, 2, 1, 3], threes: [3, 3, 3, 1, 2], fours: [4, 4, 4, 1, 2], fives: [5, 5, 5, 1, 2], sixes: [6, 6, 6, 1, 2], three: [6, 6, 6, 5, 5], four: [1, 1, 1, 1, 2], full: [2, 2, 3, 3, 3], small: [1, 2, 3, 4, 6], large: [1, 2, 3, 4, 5], kniffel: [5, 5, 5, 5, 5], chance: [6, 6, 6, 6, 5] };
FIELDS.forEach((f) => { solo = G.apply(solo, 0, { roll: [] }, r).state; solo = G.apply(withDice(solo, plan[f]), 0, { score: f }, r).state; });
const ov = G.over(solo);
ok(ov && ov.winner === 0 && ov.totals[0] === 63 + 35 + 28 + 6 + 25 + 30 + 40 + 50 + 29, 'the solo game ends after 13 rounds with the upper bonus (' + JSON.stringify(ov) + ')');
ok(G.current(solo) === -1 && G.actions(solo, 0).length === 0 && solo.round === 13, 'nobody acts after the end');
// a two player game decided by the totals, with a tie as a draw
let two = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
for (let k = 0; k < 13; k++) for (let p = 0; p < 2; p++) { two = G.apply(two, p, { roll: [] }, r).state; two = G.apply(withDice(two, [1, 1, 1, 1, 1]), p, { score: FIELDS[k] }, r).state; }
ok(G.over(two) && G.over(two).winner === -1 && K.deepEq(G.over(two).ranking, [0, 1]), 'equal totals are a draw with a ranking');
// the AI writes a Kniffel when it has one and keeps four of a kind
let ai = G.create({ n: 1, names: ['A'], opts: {} }, r);
ai = G.apply(ai, 0, { roll: [] }, r).state;
ok(K.deepEq(G.ai(withDice(ai, [3, 3, 3, 3, 3]), 0, 3, r), { score: 'kniffel' }) && K.deepEq(G.ai(withDice(ai, [3, 3, 3, 3, 3]), 0, 2, r), { score: 'kniffel' }), 'the AI writes a Kniffel at once');
let q = JSON.parse(JSON.stringify(ai)); q.dice = [6, 6, 6, 6, 2]; q.rolls = 1;
const a3 = G.ai(q, 0, 3, r), a2 = G.ai(q, 0, 2, r);
ok(a3.roll && K.deepEq(a3.roll, [true, true, true, true, false]), 'the hard AI keeps four sixes and rolls the fifth die (' + JSON.stringify(a3) + ')');
ok(a2.roll && K.deepEq(a2.roll, [true, true, true, true, false]), 'the normal AI keeps four sixes too (' + JSON.stringify(a2) + ')');
q.dice = [1, 2, 3, 4, 6]; q.rolls = 2;
const a4 = G.ai(q, 0, 3, r);
ok(a4.roll && K.deepEq(a4.roll, [true, true, true, true, false]), 'the hard AI keeps 1 2 3 4 and goes for the large straight (' + JSON.stringify(a4) + ')');
// the hard AI takes a decent time per decision
const t0 = Date.now(); for (let i = 0; i < 10; i++) G.ai(q, 0, 3, r); const ms = (Date.now() - t0) / 10;
ok(ms < 300, 'a hard decision takes under 300 ms (' + ms.toFixed(1) + ' ms)');
// the hard AI scores far better than the random one over solo games
function soloScore(level, seed) { const rr = K.rng(seed); let st = G.create({ n: 1, names: ['A'], opts: {} }, rr); while (!G.over(st)) st = G.apply(st, 0, G.ai(st, 0, level, rr), rr).state; return G.over(st).totals[0]; }
let s1 = 0, s2 = 0, s3 = 0; const N = 12;
for (let i = 0; i < N; i++) { s1 += soloScore(1, 100 + i); s2 += soloScore(2, 100 + i); s3 += soloScore(3, 100 + i); }
ok(s3 / N > 170 && s3 > s1 * 1.5, 'the hard AI averages well over the random one (' + (s1 / N).toFixed(0) + ' / ' + (s2 / N).toFixed(0) + ' / ' + (s3 / N).toFixed(0) + ')');
ok(s2 > s1 * 1.3, 'the normal AI beats the random one clearly');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 4, maxTurns: 1000 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
