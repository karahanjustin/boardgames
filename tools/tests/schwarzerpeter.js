// Schwarzer Peter: the rules, the hidden view and the AI. Run: node tools/tests/schwarzerpeter.js
const G = require('../../js/games/schwarzerpeter.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(3);
const PETER = 36;
let s = G.create({ n: 3, names: ['A', 'B', 'C'], opts: {} }, r);
const total = s.hands.reduce((a, h) => a + h.length, 0) + s.pairs.reduce((a, p) => a + 2 * p.length, 0);
ok(total === 37, 'all 37 cards are dealt: in hands or laid down as pairs (' + total + ')');
ok(s.hands.every((h) => h.every((c) => c === PETER || h.indexOf(c ^ 1) < 0)), 'no hand holds a pair after the deal');
ok(s.pairs.every((ps) => ps.every(([a, b]) => b === a + 1 && a % 2 === 0)), 'every laid pair is a real pair');
ok(G.current(s) === s.turn && K.deepEq(G.actions(s, s.turn), [{ draw: true }]) && G.actions(s, (s.turn + 1) % 3).length === 0, 'the player at turn may only draw');
ok(G.over(s) === null, 'a fresh game is not over');
// the view leaks nothing
const v0 = G.view(s, 0);
ok(v0.hands === undefined && K.deepEq(v0.counts, s.hands.map((h) => h.length)), 'the view shows other hands as counts');
ok(K.deepEq(v0.hand.slice().sort((a, b) => a - b), s.hands[0].slice().sort((a, b) => a - b)), 'the view holds the own hand');
ok(!JSON.stringify(v0).includes(JSON.stringify(s.hands[1])) || s.hands[1].length === 0, 'the view does not carry another hand');
const vHot = G.view(s, -1);
ok(vHot.me === s.turn && K.deepEq(vHot.hand.slice().sort((a, b) => a - b), s.hands[s.turn].slice().sort((a, b) => a - b)), 'the hot seat view shows the current player');
ok(v0.giver === (s.turn === 0 ? 2 : s.turn - 1) || s.hands[(s.turn + 2) % 3].length === 0, 'the giver is the player before the drawer');
// a scripted draw: the drawer takes a card from the giver, a pair goes down
function script(st, hands) { const c = JSON.parse(JSON.stringify(st)); c.hands = hands.map((h) => h.slice()); c.pairs = hands.map(() => []); c.finished = []; c.turn = 0; c.over = false; c.loser = -1; return c; }
let t = script(s, [[0, 4], [1, 7, PETER], [5, 6]]);
// player 0 draws from player 2 (the one before): 5 or 6; make the rng pick index 0 by trying seeds
const before = JSON.stringify(t);
let res = G.apply(t, 0, { draw: true }, K.rng(1));
ok(JSON.stringify(t) === before, 'apply does not mutate');
ok(res.state.hands[2].length === 1 && res.state.hands[0].length === 3 && res.events[0].e === 'draw' && res.events[0].from === 2 && res.events[0].to === 0, 'the drawer takes one card from the giver');
ok(!JSON.stringify(res.events).includes('"card"'), 'the draw event does not name the card');
ok(res.state.turn === 1, 'the turn moves on');
// a pair forms when the drawn card matches
t = script(s, [[0, 4], [1, PETER], [5]]);
res = G.apply(t, 0, { draw: true }, r);
ok(K.deepEq(res.state.hands[0], [0]) && K.deepEq(res.state.pairs[0], [[4, 5]]) && res.events.some((e) => e.e === 'pair' && e.p === 0), 'the drawn 5 pairs with the 4');
ok(res.state.hands[2].length === 0 && K.deepEq(res.state.finished, [2]) && res.events.some((e) => e.e === 'out' && e.p === 2), 'the giver who gave the last card is out');
ok(res.state.turn === 1 && G.over(res.state) === null, 'the game goes on with two players');
// player 1 now draws from player 0 (the only other player with cards): the 0 pairs with the 1
res = G.apply(res.state, 1, { draw: true }, r);
ok(K.deepEq(res.state.pairs[1], [[0, 1]]) && res.state.hands[0].length === 0, 'player 1 pairs 0 and 1 and empties player 0');
ok(res.state.over && res.state.loser === 1 && res.events.some((e) => e.e === 'peter' && e.p === 1), 'player 1 is left with the Schwarzer Peter and loses');
const ov = G.over(res.state);
ok(ov && K.deepEq(ov.ranking, [2, 0, 1]) && ov.winner === 2 && ov.loser === 1, 'ranking: the finishers in order, the loser last (' + JSON.stringify(ov) + ')');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'nobody acts after the end');
ok(K.deepEq(G.view(res.state, 1).hand, [PETER]) && K.deepEq(G.view(res.state, -1).hand, [PETER]) && G.view(res.state, 0).hand.length === 0, 'at the end the Schwarzer Peter is shown to the loser and the hot seat');
// the drawer who pairs their last card is out and the Schwarzer Peter stays with the other player
t = script(s, [[4], [7, PETER, 5]]); t.n = 2; t.pairs = [[], []];
res = G.apply(t, 0, { draw: true }, K.rng(9));
if (res.state.pairs[0].length) ok(res.state.over && res.state.loser === 1 && K.deepEq(G.over(res.state).ranking, [0, 1]), 'the drawer pairs the last card and the giver keeps the Schwarzer Peter');
else ok(res.state.hands[0].length === 2 && res.state.turn === 1, 'the drawer took the Schwarzer Peter or the 7 and the game goes on');
// drawing the Schwarzer Peter moves it
t = script(s, [[4], [PETER]]); t.n = 2; t.pairs = [[], []];
res = G.apply(t, 0, { draw: true }, r);
ok(res.state.over && res.state.loser === 0 && res.state.hands[1].length === 0 && K.deepEq(G.over(res.state).ranking, [1, 0]), 'taking the Schwarzer Peter as the last card loses');
// full games: every player count ends with the loser holding the Schwarzer Peter
let fine = true;
[2, 3, 4, 5, 6].forEach((n) => { for (let g = 0; g < 10; g++) { const rr = K.rng(100 * n + g); let st = G.create({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: {} }, rr); let k = 0; while (!G.over(st) && k++ < 3000) st = G.apply(st, G.current(st), G.ai(st, G.current(st), 2, rr), rr).state; const o = G.over(st); if (!o || !K.deepEq(st.hands[st.loser], [PETER]) || o.ranking.length !== n || new Set(o.ranking).size !== n) fine = false; } });
ok(fine, 'every game ends with the loser holding only the Schwarzer Peter and a full ranking');
// the views never leak another hand during a game
let leak = false;
{ const rr = K.rng(77); let st = G.create({ n: 4, names: ['A', 'B', 'C', 'D'], opts: {} }, rr); let k = 0; while (!G.over(st) && k++ < 3000) { for (let p = 0; p < 4; p++) { const v = G.view(st, p); if (v.hands || JSON.stringify(v.hand) !== JSON.stringify(st.hands[p].slice().sort((a, b) => a - b))) leak = true; } st = G.apply(st, G.current(st), { draw: true }, rr).state; } }
ok(!leak, 'views during a game only ever hold the own hand');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 20, maxTurns: 3000 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
