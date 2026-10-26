// Käsekästchen / Dots and Boxes: the rules and the AI. Run: node tools/tests/dots.js
const G = require('../../js/games/dots.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(5);
const mk = (n) => G.create({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: {} }, r);
let s = mk(2);
ok(s.w === 6 && s.h === 6 && s.hl.length === 42 && s.vl.length === 42 && s.owner.length === 36, 'two players get a 6x6 grid with 84 edges');
ok(mk(3).w === 8 && mk(4).w === 8 && mk(4).hl.length === 72 && mk(4).vl.length === 72, 'three and four players get an 8x8 grid with 144 edges');
ok(G.current(s) === 0 && G.actions(s, 0).length === 84 && G.actions(s, 1).length === 0, 'player 0 begins with every edge, player 1 has no move');
ok(G.over(s) === null, 'a fresh game is not over');
ok(G.strings.de.rules && G.strings.en.rules, 'the rules are given in both languages');
// three sides of the top left box, then the fourth closes it and keeps the turn
const before0 = JSON.stringify(s);
let res = G.apply(s, 0, { h: 0 }, r);
ok(JSON.stringify(s) === before0, 'apply does not mutate');
s = res.state;
ok(s.turn === 1 && s.hl[0] === 0 && s.free === 83, 'a plain line passes the turn');
ok(!G.actions(s, 1).some((a) => a.h === 0), 'a drawn edge is no longer an action');
s = G.apply(s, 1, { v: 0 }, r).state;
s = G.apply(s, 0, { v: 1 }, r).state;
ok(s.turn === 1 && s.owner[0] === -1, 'three sides do not close the box');
res = G.apply(s, 1, { h: 6 }, r);
s = res.state;
ok(s.owner[0] === 1 && s.score[1] === 1 && s.turn === 1 && res.events.some((e) => e.e === 'box' && e.at === 0), 'the fourth side scores the box and gives another turn');
// an edge between two three-sided boxes closes both at once
s = mk(2);
[{ h: 0 }, { v: 0 }, { h: 6 }, { h: 1 }, { v: 2 }, { h: 7 }].forEach((a) => { s = G.apply(s, s.turn, a, r).state; });
ok(s.owner[0] === -1 && s.owner[1] === -1 && s.turn === 0, 'both boxes wait for the shared edge');
res = G.apply(s, 0, { v: 1 }, r);
ok(res.state.owner[0] === 0 && res.state.owner[1] === 0 && res.state.score[0] === 2 && res.events.filter((e) => e.e === 'box').length === 2, 'one edge closes two boxes');
// playing every edge in order ends the game with a ranking and a single winner or a tie
s = mk(2);
let guard = 0;
while (!G.over(s) && guard++ < 200) { const acts = G.actions(s, s.turn); s = G.apply(s, s.turn, acts[0], r).state; }
const ov = G.over(s);
ok(ov && ov.ranking && ov.ranking.length === 2 && s.score[0] + s.score[1] === 36 && s.free === 0, 'the game ends when every box is taken (' + JSON.stringify(s.score) + ')');
ok(ov.winner === -1 ? s.score[0] === s.score[1] : s.score[ov.winner] > s.score[1 - ov.winner], 'the winner has the most boxes, a tie gives winner -1');
ok(G.current(s) === -1 && G.actions(s, 0).length === 0, 'nobody moves after the end');
// a tie is reported with winner -1: build it by hand
s = mk(2); s.free = 0; s.score = [18, 18];
ok(G.over(s).winner === -1 && G.over(s).ranking.length === 2, 'equal scores are a tie in the ranking');
s = mk(3); s.free = 0; s.score = [20, 30, 14];
ok(G.over(s).winner === 1 && JSON.stringify(G.over(s).ranking) === '[1,0,2]', 'the ranking sorts by boxes for three players');
// the normal and hard AI take a box that is on offer; the easy one avoids giving away when it can
s = mk(2);
[{ h: 0 }, { v: 0 }, { v: 1 }].forEach((a) => { s = G.apply(s, s.turn, a, r).state; });
ok(s.turn === 1, 'player 1 is to move with a box on offer');
ok(G.ai(s, 1, 2, r).h === 6 && G.ai(s, 1, 3, r).h === 6, 'the normal and hard AI take the open box');
// the easy AI, on the same board, never creates a new three sided box (box 0 already has three)
function sidesOf(t, b) { const row = Math.floor(b / t.w), col = b % t.w; let k = 0; if (t.hl[row * t.w + col] >= 0) k++; if (t.hl[(row + 1) * t.w + col] >= 0) k++; if (t.vl[row * (t.w + 1) + col] >= 0) k++; if (t.vl[row * (t.w + 1) + col + 1] >= 0) k++; return k; }
let gifts = 0;
for (let i = 0; i < 50; i++) {
  const a = G.ai(s, 1, 1, K.rng(i)), t = G.apply(s, 1, a, r).state;
  for (let b = 1; b < 36; b++) if (t.owner[b] < 0 && sidesOf(t, b) === 3) gifts++;
}
ok(gifts === 0, 'the easy AI never creates a new three sided box while safe moves exist (' + gifts + ')');
// the hard AI sacrifices the smaller chain when every move gives something away: build an end position with a
// closed corridor of two boxes (0 and 1, free edges h0, v1, h1) and one of six boxes (the bottom row, free edges
// v35..v41); every other edge is drawn and every other box owned.
let t = mk(2);
const freeH = new Set([0, 1]), freeV = new Set([1, 35, 36, 37, 38, 39, 40, 41]);
for (let i = 0; i < t.hl.length; i++) if (!freeH.has(i)) t.hl[i] = i % 2;
for (let i = 0; i < t.vl.length; i++) if (!freeV.has(i)) t.vl[i] = i % 2;
for (let b = 0; b < 36; b++) if (sidesOf(t, b) === 4) { t.owner[b] = b % 2; t.score[b % 2]++; }
t.free = freeH.size + freeV.size; t.turn = 0;
ok(G.actions(t, 0).length === 10 && [0, 1].every((b) => sidesOf(t, b) === 2) && [30, 31, 32, 33, 34, 35].every((b) => sidesOf(t, b) === 2), 'the end position has ten free edges and two closed corridors');
const chosen = {};
for (let i = 0; i < 20; i++) { const a = G.ai(t, 0, 3, K.rng(100 + i)); chosen[a.h != null ? 'h' + a.h : 'v' + a.v] = true; }
ok(Object.keys(chosen).every((k) => k === 'h0' || k === 'h1' || k === 'v1'), 'the hard AI opens the two box corridor, never the six box one (' + Object.keys(chosen).join(',') + ')');
// the normal AI, faced with the same choice, may open either, but the hard AI gives away exactly two boxes
let t2 = G.apply(t, 0, G.ai(t, 0, 3, K.rng(3)), r).state, taken = 0;
while (G.actions(t2, 1).some((a) => { const u = G.apply(t2, 1, a, r).state; return u.score[1] > t2.score[1]; })) {
  const a = G.actions(t2, 1).find((x) => G.apply(t2, 1, x, r).state.score[1] > t2.score[1]);
  const u = G.apply(t2, 1, a, r).state; taken += u.score[1] - t2.score[1]; t2 = u;
}
ok(taken === 2, 'the opponent can collect exactly two boxes after the sacrifice (' + taken + ')');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 12 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
