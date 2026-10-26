// Memory: the deck, the hidden view, pairs and turns, ties and the AI. Run: node tools/tests/memory.js
const G = require('../../js/games/memory.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(3);
const cfg = (n) => ({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: {} });
const counts = (cards) => cards.reduce((m, c) => { m[c] = (m[c] || 0) + 1; return m; }, {});
let s = G.create(cfg(2), r);
ok(s.cards.length === 48 && Object.keys(counts(s.cards)).length === 24 && Object.values(counts(s.cards)).every((c) => c === 2), 'two players get 24 pairs, every picture twice');
const s3 = G.create(cfg(3), r), s6 = G.create(cfg(6), r);
ok(s3.cards.length === 60 && s6.cards.length === 60 && Object.values(counts(s6.cards)).every((c) => c === 2) && s6.scores.length === 6, 'three or more players get 30 pairs');
ok(G.current(s) === 0 && G.actions(s, 0).length === 48 && G.actions(s, 1).length === 0 && G.over(s) === null, 'player 0 begins and may flip any card');
// the view hides every face down card
let v = G.view(s, 1);
ok(v.cards.every((c) => c === null) && G.view(s, -1).cards.every((c) => c === null), 'a fresh view shows no picture');
// flip one card: it is visible, the rest stays hidden, the seen log knows it
let before = JSON.stringify(s);
let res = G.apply(s, 0, { flip: 5 }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
s = res.state;
v = G.view(s, 1);
ok(v.cards[5] === s.cards[5] && v.cards.filter((c) => c !== null).length === 1 && s.open[0] === 5 && s.seen[0] === 5 && s.turn === 0, 'the flipped card is visible, nothing else');
ok(!G.actions(s, 0).some((a) => a.flip === 5) && G.actions(s, 0).length === 47, 'the open card cannot be flipped again');
// a mismatch: both lie open, the turn passes, the next player may flip anything unmatched
const partner = (st, i) => st.cards.findIndex((c, k) => k !== i && c === st.cards[i]);
let other = -1; for (let i = 0; i < 48; i++) if (i !== 5 && s.cards[i] !== s.cards[5]) { other = i; break; }
res = G.apply(s, 0, { flip: other }, r);
s = res.state;
ok(s.turn === 1 && s.pending && s.open.length === 2 && res.events.some((e) => e.e === 'miss') && s.scores[0] === 0, 'two different cards pass the turn and stay open for now');
v = G.view(s, 0);
ok(v.cards[5] !== null && v.cards[other] !== null && v.cards.filter((c) => c !== null).length === 2, 'the mismatched pair is still visible to everyone');
ok(G.actions(s, 1).length === 48 && G.actions(s, 1).some((a) => a.flip === 5), 'the next player may flip any unmatched card, the pending ones included');
// player 1 flips: the pending pair closes, then finds a match and goes again
res = G.apply(s, 1, { flip: 7 }, r);
s = res.state;
ok(!s.pending && s.open.length === 1 && s.open[0] === 7 && G.view(s, 0).cards.filter((c) => c !== null).length === 1, 'the first flip of the next player turns the old pair back');
const p7 = partner(s, 7);
res = G.apply(s, 1, { flip: p7 }, r);
s = res.state;
ok(s.turn === 1 && s.scores[1] === 1 && s.matched[7] === 1 && s.matched[p7] === 1 && s.open.length === 0 && res.events.some((e) => e.e === 'match'), 'a pair is kept, counted and earns another turn');
ok(G.view(s, 0).cards[7] !== null && G.view(s, 0).cards[p7] !== null && !G.actions(s, 1).some((a) => a.flip === 7 || a.flip === p7), 'matched cards stay visible and cannot be flipped');
ok(s.seen.indexOf(7) < 0 && s.seen.indexOf(p7) < 0 && s.seen.indexOf(5) >= 0, 'matched cards leave the seen log, the others stay');
// a scripted game: player 1 clears the whole board with full knowledge
let turns = 0;
while (!G.over(s) && turns++ < 100) {
  const a = G.actions(s, 1)[0].flip;
  s = G.apply(s, 1, { flip: a }, r).state;
  s = G.apply(s, 1, { flip: partner(s, a) }, r).state;
}
const ov = G.over(s);
ok(ov && ov.winner === 1 && ov.ranking[0] === 1 && ov.places[1] === 1 && ov.places[0] === 2 && ov.scores[1] === 24, 'the player with all pairs wins (' + JSON.stringify(ov) + ')');
ok(G.current(s) === -1 && G.actions(s, 1).length === 0, 'nobody acts after the end');
// ties: equal pairs share a place, a tie at the top is a draw
const tied = JSON.parse(JSON.stringify(G.create(cfg(2), r)));
tied.matched = tied.matched.map((_, i) => (i % 4 < 2 ? 0 : 1)); tied.scores = [12, 12];
let to = G.over(tied);
ok(to && to.winner === -1 && to.places[0] === 1 && to.places[1] === 1, 'an equal split is a draw with a shared first place');
const three = JSON.parse(JSON.stringify(G.create(cfg(3), r)));
three.matched = three.matched.map(() => 0); three.scores = [12, 9, 9];
to = G.over(three);
ok(to && to.winner === 0 && JSON.stringify(to.ranking) === '[0,1,2]' && JSON.stringify(to.places) === '[1,2,2]', 'a clear winner with two tied behind');
three.scores = [8, 12, 10];
to = G.over(three);
ok(to && to.winner === 1 && JSON.stringify(to.ranking) === '[1,2,0]' && JSON.stringify(to.places) === '[3,1,2]', 'the ranking is ordered by pairs');
// the AI: level 3 remembers both cards of a pair it saw and takes them, level 1 forgets
s = G.create(cfg(2), r);
const a = 0, a2 = partner(s, 0);
let b = -1; for (let i = 1; i < 48; i++) if (i !== a2 && s.cards[i] !== s.cards[a]) { b = i; break; }
let d = -1; for (let i = 1; i < 48; i++) if (i !== a2 && i !== b && s.cards[i] !== s.cards[a] && s.cards[i] !== s.cards[b]) { d = i; break; }
s = G.apply(s, 0, { flip: a }, r).state; s = G.apply(s, 0, { flip: b }, r).state;
s = G.apply(s, 1, { flip: a2 }, r).state; s = G.apply(s, 1, { flip: d }, r).state;
ok(s.turn === 0 && s.seen.length === 4, 'four cards have been seen, player 0 is on turn');
[2, 3].forEach((lv) => {
  const f1 = G.ai(s, 0, lv, K.rng(lv)).flip;
  ok(f1 === a || f1 === a2, 'level ' + lv + ' goes for the remembered pair (' + f1 + ')');
  const st = G.apply(s, 0, { flip: f1 }, r).state;
  const f2 = G.ai(st, 0, lv, K.rng(lv)).flip;
  ok(f2 === (f1 === a ? a2 : a), 'level ' + lv + ' completes the remembered pair');
});
let l1pair = 0;
for (let k = 0; k < 40; k++) { const f1 = G.ai(s, 0, 1, K.rng(k)).flip; if (f1 === a || f1 === a2) l1pair++; }
ok(l1pair < 15, 'level 1 does not remember the pair (' + l1pair + ' of 40 picks)');
// level 2 forgets: after many other cards the first pair is out of its eight card window
let st2 = s;
let seenMany = 0;
for (let i = 0; i < 48 && seenMany < 12; i++) {
  if ([a, a2, b, d].indexOf(i) >= 0 || st2.matched[i] >= 0) continue;
  const p = st2.turn;
  st2 = G.apply(st2, p, { flip: i }, r).state;
  if (st2.open.length === 2 && st2.cards[st2.open[0]] === st2.cards[st2.open[1]]) continue;
  seenMany++;
}
if (st2.open.length === 1) { let j = -1; for (let i = 0; i < 48; i++) if ([a, a2, b, d].indexOf(i) < 0 && st2.matched[i] < 0 && st2.open.indexOf(i) < 0 && st2.cards[i] !== st2.cards[st2.open[0]]) { j = i; break; } st2 = G.apply(st2, st2.turn, { flip: j }, r).state; }
let l2pair = 0, l3pair = 0;
for (let k = 0; k < 20; k++) {
  const f2 = G.ai(st2, st2.turn, 2, K.rng(k)).flip; if (f2 === a || f2 === a2) l2pair++;
  const f3 = G.ai(st2, st2.turn, 3, K.rng(k)).flip; if (f3 === a || f3 === a2) l3pair++;
}
ok(l3pair === 20 && l2pair < 10, 'level 3 still remembers the old pair, level 2 has forgotten it (' + l3pair + ' / ' + l2pair + ')');
// level 3 beats level 1 clearly
let wins3 = 0;
for (let g = 0; g < 20; g++) {
  const rr = K.rng(900 + g);
  let st = G.create(cfg(2), rr), t = 0;
  while (!G.over(st) && t++ < 5000) { const p = G.current(st); st = G.apply(st, p, G.ai(st, p, p === 0 ? 3 : 1, rr), rr).state; }
  if (G.over(st) && G.over(st).winner === 0) wins3++;
}
ok(wins3 >= 17, 'perfect memory beats no memory (' + wins3 + ' of 20)');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 8, maxTurns: 8000 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
