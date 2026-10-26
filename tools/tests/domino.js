// Domino: the rules, the hidden view and the AI. Run: node tools/tests/domino.js
const G = require('../../js/games/domino.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(21);
let s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
ok(s.hands[0].length === 7 && s.hands[1].length === 7 && s.boneyard.length === 14, 'two players get 7 tiles each, 14 stay in the boneyard');
let s3 = G.create({ n: 3, names: ['A', 'B', 'C'], opts: {} }, r), s4 = G.create({ n: 4, names: ['A', 'B', 'C', 'D'], opts: {} }, r);
ok(s3.hands.every((h) => h.length === 5) && s3.boneyard.length === 13 && s4.hands.every((h) => h.length === 5) && s4.boneyard.length === 8, 'three and four players get 5 tiles each');
const all = s.hands[0].concat(s.hands[1], s.boneyard).map((t) => t.join('')).sort();
ok(all.length === 28 && new Set(all).size === 28 && all.every((t) => t[0] <= t[1]), 'the set is the full double six set, every tile once');
// the opener holds the start tile, the highest double or the highest tile
const holder = s.hands.findIndex((h) => h.some((t) => t[0] === s.start[0] && t[1] === s.start[1]));
ok(holder === s.turn, 'the player with the start tile begins');
const doubles = s.hands[0].concat(s.hands[1]).filter((t) => t[0] === t[1]);
ok(doubles.length ? (s.start[0] === s.start[1] && s.start[0] === Math.max(...doubles.map((t) => t[0]))) : true, 'the start tile is the highest double in play');
ok(K.deepEq(G.actions(s, s.turn), [{ play: s.start, end: 'R' }]) && G.actions(s, 1 - s.turn).length === 0, 'the first move is forced: the start tile');
ok(G.over(s) === null, 'a fresh game is not over');
// a scripted game on a known layout
function script(hands, boneyard, line, turn) {
  return { n: hands.length, hands: hands.map((h) => h.map((t) => t.slice())), boneyard: boneyard.map((t) => t.slice()), line: line.map((t) => t.slice()), turn, start: [6, 6], passes: 0, missed: hands.map(() => [false, false, false, false, false, false, false]), over: false, winner: -1, blocked: false, last: null };
}
let t = script([[[6, 6], [2, 6], [0, 3]], [[6, 1], [1, 1], [4, 5]]], [[3, 5], [0, 0]], [], 0);
const before = JSON.stringify(t);
let res = G.apply(t, 0, { play: [6, 6], end: 'R' }, r);
ok(JSON.stringify(t) === before, 'apply does not mutate');
ok(K.deepEq(res.state.line, [[6, 6]]) && res.state.hands[0].length === 2 && res.state.turn === 1, 'the opener lays the double six');
let acts = G.actions(res.state, 1);
ok(K.deepEq(acts, [{ play: [1, 6], end: 'L' }, { play: [6, 1], end: 'R' }]), 'the 6 1 fits both ends, oriented for each (' + JSON.stringify(acts) + ')');
res = G.apply(res.state, 1, { play: [6, 1], end: 'R' }, r);
ok(K.deepEq(res.state.line, [[6, 6], [6, 1]]) && res.state.turn === 0, 'the tile lies in the given orientation at the right end');
acts = G.actions(res.state, 0);
ok(K.deepEq(acts, [{ play: [2, 6], end: 'L' }]), 'the 2 6 only fits the left end as 2 6 (' + JSON.stringify(acts) + ')');
res = G.apply(res.state, 0, { play: [2, 6], end: 'L' }, r);
ok(K.deepEq(res.state.line, [[2, 6], [6, 6], [6, 1]]), 'the tile is prepended');
// player 1 holds 1 1 and 4 5: the double fits the right end only, in one orientation
acts = G.actions(res.state, 1);
ok(K.deepEq(acts, [{ play: [1, 1], end: 'R' }]), 'a double fits one way only (' + JSON.stringify(acts) + ')');
res = G.apply(res.state, 1, { play: [1, 1], end: 'R' }, r);
// player 0 holds 0 3 against the ends 2 and 1: must draw (boneyard 3 5, 0 0)
acts = G.actions(res.state, 0);
ok(K.deepEq(acts, [{ draw: true }]), 'without a fitting tile and with a boneyard the only action is to draw');
res = G.apply(res.state, 0, { draw: true }, r);
ok(res.state.hands[0].length === 2 && res.state.boneyard.length === 1 && res.state.turn === 0 && res.events[0].e === 'draw', 'the drawer takes the top tile and keeps the turn');
ok(res.state.missed[0][2] && res.state.missed[0][1] && !res.state.missed[0][6], 'the draw records that the player lacked both ends');
// the drawn tile was 0 0 (the last of the list), still no fit: draw again, then pass
res = G.apply(res.state, 0, { draw: true }, r);
ok(res.state.boneyard.length === 0 && res.state.hands[0].length === 3, 'the boneyard is empty after the second draw');
ok(K.deepEq(res.state.hands[0].map((x) => x.join('')), ['03', '00', '35']), 'the drawn tiles are 0 0 then 3 5 (' + JSON.stringify(res.state.hands[0]) + ')');
acts = G.actions(res.state, 0);
ok(K.deepEq(acts, [{ pass: true }]), 'with nothing to play and an empty boneyard the only action is to pass');
res = G.apply(res.state, 0, { pass: true }, r);
ok(res.state.turn === 1 && res.state.passes === 1 && G.over(res.state) === null, 'a pass moves the turn on');
// player 1 holds 4 5 against ends 2 and 1: also passes, the game is blocked
ok(K.deepEq(G.actions(res.state, 1), [{ pass: true }]), 'player 1 cannot play either');
res = G.apply(res.state, 1, { pass: true }, r);
let ov = G.over(res.state);
ok(res.state.over && res.state.blocked && ov && ov.blocked && res.events.some((e) => e.e === 'blocked'), 'two passes in a row block the game');
ok(ov.pips[0] === 3 + 0 + 8 && ov.pips[1] === 9 && ov.winner === 1 && K.deepEq(ov.ranking, [1, 0]), 'the fewest pips win the blocked game (' + JSON.stringify(ov) + ')');
ok(G.current(res.state) === -1 && G.actions(res.state, 0).length === 0, 'nobody acts after the end');
// going out wins regardless of pips
t = script([[[2, 3]], [[6, 6], [5, 5], [4, 4]]], [], [[1, 2]], 0);
res = G.apply(t, 0, { play: [2, 3], end: 'R' }, r);
ov = G.over(res.state);
ok(res.state.over && ov.winner === 0 && K.deepEq(ov.ranking, [0, 1]) && res.events.some((e) => e.e === 'out'), 'emptying the hand wins the game');
// a blocked tie is a draw with a ranking
t = script([[[2, 3]], [[0, 5]]], [], [[6, 6]], 0);
t.passes = 1;
res = G.apply(t, 0, { pass: true }, r);
ok(res.state.over && G.over(res.state).winner === -1 && K.deepEq(G.over(res.state).ranking, [0, 1]), 'equal pips in a blocked game are a draw');
// three players: a double fits once, the ranking after a win is by pips
t = script([[[1, 2]], [[6, 6], [0, 0]], [[0, 1]]], [], [[3, 1]], 0);
res = G.apply(t, 0, { play: [1, 2], end: 'R' }, r);
ok(K.deepEq(G.over(res.state).ranking, [0, 2, 1]), 'after a win the others rank by pips');
// the view hides other hands and the boneyard
s = G.create({ n: 3, names: ['A', 'B', 'C'], opts: {} }, r);
const v1 = G.view(s, 1);
ok(v1.hands[0] === null && v1.hands[2] === null && K.deepEq(v1.hands[1], s.hands[1]) && K.deepEq(v1.counts, [5, 5, 5]) && v1.boneyard === 13, 'the view shows only the own hand and counts');
ok(!JSON.stringify(v1).includes(JSON.stringify(s.boneyard[0])) || s.hands[1].some((x) => K.deepEq(x, s.boneyard[0])), 'the view does not carry the boneyard tiles');
const vh = G.view(s, -1);
ok(K.deepEq(vh.hands[s.turn], s.hands[s.turn]) && vh.me === s.turn, 'the hot seat view shows the current player');
let played = JSON.parse(JSON.stringify(s)); played.over = true; played.winner = 0;
ok(G.view(played, 1).hands.every((h, i) => K.deepEq(h, s.hands[i])), 'after the end every hand is open');
// the AI: level 2 plays the heaviest tile; level 3 prefers an end the opponent is known to lack
t = script([[[6, 6], [1, 6], [0, 6]], [[6, 6], [5, 5], [4, 4]]], [], [[3, 6]], 0);
t.start = [6, 6];
ok(K.deepEq(G.ai(t, 0, 2, r), { play: [6, 6], end: 'R' }), 'the normal AI plays the heaviest fitting tile');
t = script([[[6, 1], [6, 2]], [[0, 0], [3, 3]]], [], [[3, 6]], 0);
t.missed[1] = [false, true, false, false, false, false, false];
ok(K.deepEq(G.ai(t, 0, 3, r), { play: [6, 1], end: 'R' }), 'the hard AI opens an end the opponent is known to lack');
// the hard AI beats the random one over many two player games
function duel(levelA, levelB, seed) { const rr = K.rng(seed); let st = G.create({ n: 2, names: ['A', 'B'], opts: {} }, rr); let k = 0; while (!G.over(st) && k++ < 500) { const p = G.current(st); st = G.apply(st, p, G.ai(st, p, p === 0 ? levelA : levelB, rr), rr).state; } return G.over(st).winner; }
let w3 = 0, w1 = 0; const N = 150;
for (let i = 0; i < N; i++) { const w = duel(3, 1, 3000 + i); if (w === 0) w3++; else if (w === 1) w1++; const w2 = duel(1, 3, 4000 + i); if (w2 === 1) w3++; else if (w2 === 0) w1++; }
ok(w3 > w1 * 1.3, 'the hard AI beats the random one (' + w3 + ' to ' + w1 + ')');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 30, maxTurns: 500 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
