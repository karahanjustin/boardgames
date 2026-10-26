// Black Jack: the rules and the AI. Run: node tools/tests/blackjack.js
const G = require('../../js/games/blackjack.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(5);
// card helpers for scripted hands: rank index 0 is the ace, 9 the ten, 10 to 12 the pictures
const card = (rankIdx, suitIdx) => suitIdx * 13 + rankIdx;
const A = card(0, 0), K10 = card(9, 1), S5 = card(4, 0), S6 = card(5, 0), S7 = card(6, 2), S9 = card(8, 3), J = card(10, 0), Q = card(11, 1), S2 = card(1, 2), S3 = card(2, 3), S8 = card(7, 0);
let s = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r);
ok(s.round === 1 && s.chips[0] === 100 && s.chips[1] === 100 && s.hands[0].length === 2 && s.hands[1].length === 2 && s.dealer.length === 1, 'a fresh round: two cards each, one for the dealer, 100 chips');
ok(s.deck.length === 52 - 5 && s.bets[0] === 10 && s.bets[1] === 10, 'the deck holds the rest, every bet is 10');
ok(G.over(s) === null, 'a fresh game is not over');
// a scripted round: set the hands by hand (deep copies, so the state stays plain JSON)
function script(st, hands, dealer, deckTop) {
  const c = JSON.parse(JSON.stringify(st));
  c.hands = hands.map((h) => h.slice()); c.dealer = dealer.slice(); c.status = hands.map(() => 'play'); c.bets = hands.map(() => 10); c.results = hands.map(() => null);
  c.deck = deckTop.slice().reverse(); // pop takes the last, so the first card listed is the next drawn
  c.turn = 0; c.phase = 'play';
  return c;
}
// player 0 holds 5 and 6 (11), player 1 holds 10 and 7, the dealer shows a 6; the next cards: K for player 0, dealer 10 then 3
let t = script(s, [[S5, S6], [K10, S7]], [S6], [J, K10, S3]);
ok(G.current(t) === 0 && K.deepEq(G.actions(t, 0), [{ hit: true }, { stand: true }, { double: true }]) && G.actions(t, 1).length === 0, 'the first open seat may hit, stand or double');
const before = JSON.stringify(t);
let res = G.apply(t, 0, { double: true }, r);
ok(JSON.stringify(t) === before, 'apply does not mutate');
ok(res.state.bets[0] === 20 && res.state.hands[0].length === 3 && res.state.status[0] === 'stand' && res.state.turn === 1, 'doubling takes one card for a doubled bet and passes the turn');
ok(K.deepEq(G.actions(res.state, 1), [{ hit: true }, { stand: true }, { double: true }]), 'the next seat is open');
res = G.apply(res.state, 1, { stand: true }, r);
ok(res.state.phase === 'settled' && res.state.dealer.length === 3 && res.events.filter((e) => e.e === 'dealer').length === 2, 'after the last stand the dealer draws within the same apply (6 + 10 + 3 = 19)');
ok(res.state.results[0] === 20 && res.state.results[1] === -10 && res.state.chips[0] === 120 && res.state.chips[1] === 90, 'the settlement: 21 beats 19 for the doubled bet, 17 loses (' + JSON.stringify(res.state.results) + ')');
ok(G.current(res.state) === 0 && K.deepEq(G.actions(res.state, 0), [{ next: true }]) && G.actions(res.state, 1).length === 0, 'player 0 starts the next round');
res = G.apply(res.state, 0, { next: true }, r);
ok(res.state.round === 2 && res.state.deck.length === 52 - 5 && res.state.phase === 'play' && res.events.some((e) => e.e === 'deal'), 'the next round is dealt from a fresh deck');
// a bust
t = script(s, [[K10, S9], [S5, S6]], [S6], [S8, S2, K10, S3]);
res = G.apply(t, 0, { hit: true }, r);
ok(res.state.status[0] === 'bust' && res.events.some((e) => e.e === 'bust') && res.state.turn === 1, 'over 21 busts and the turn moves on');
// blackjack pays 3 to 2, a dealer blackjack pushes it
t = script(s, [[A, K10], [S9, S8]], [S6], [K10, S5]);
t.status[0] = 'bj'; t.turn = 1;
res = G.apply(t, 1, { stand: true }, r);
ok(res.state.results[0] === 15 && res.state.chips[0] === 115, 'blackjack pays 15 on a bet of 10');
ok(res.state.results[1] === -10, 'the dealer draws 6 + 10 + 5 to 21 and beats 17');
// a plain comparison: the dealer stands on soft 17 (ace and six)
t = script(s, [[K10, S7]], [A], [S6, S9]);
t.n = 1; t.chips = [100];
res = G.apply(t, 0, { stand: true }, r);
ok(res.state.dealer.length === 2 && res.state.results[0] === 0, 'the dealer stands on soft 17 against 17: a push (' + JSON.stringify(res.state.dealer) + ')');
// the dealer draws on hard 16
t = script(s, [[K10, S7]], [K10], [S6, S2]);
t.n = 1; t.chips = [100];
res = G.apply(t, 0, { stand: true }, r);
ok(res.state.dealer.length === 3 && res.state.results[0] === -10, 'the dealer draws on 16 and makes 18');
// the dealer blackjack beats a stand and pushes a blackjack
t = script(s, [[A, K10], [K10, S9]], [A], [K10]);
t.status[0] = 'bj'; t.turn = 1;
res = G.apply(t, 1, { stand: true }, r);
ok(res.state.results[0] === 0 && res.state.results[1] === -10, 'a dealer blackjack pushes a blackjack and beats 19');
// everyone busts: the dealer still takes the hidden card but draws no further
t = script(s, [[K10, S9]], [S6], [S8, S2, S3, S5]);
t.n = 1; t.chips = [100];
res = G.apply(t, 0, { hit: true }, r);
ok(res.state.status[0] === 'bust' && res.state.phase === 'settled' && res.state.dealer.length === 2, 'with every seat bust the dealer only reveals the second card');
// an initial blackjack skips the seat; when every seat has one the dealer plays at once
t = script(s, [[A, K10], [A, Q]], [S6], [K10, S5]);
t.status = ['bj', 'bj']; t.turn = -1; t.phase = 'settled';
ok(G.current(t) === 0, 'with no open seat the round is settled');
// five rounds end the game, ranking by chips
let g = G.create({ n: 3, names: ['A', 'B', 'C'], opts: {} }, r);
let guard = 0;
while (!G.over(g) && guard++ < 500) { const p = G.current(g); g = G.apply(g, p, G.ai(g, p, 3, r), r).state; }
const ov = G.over(g);
ok(ov && ov.ranking.length === 3 && g.round === 5 && g.phase === 'over', 'a full game ends after round 5 with a ranking (' + JSON.stringify(ov) + ')');
ok(ov.chips[ov.ranking[0]] >= ov.chips[ov.ranking[1]] && ov.chips[ov.ranking[1]] >= ov.chips[ov.ranking[2]], 'the ranking is by chips');
ok(G.current(g) === -1 && G.actions(g, 0).length === 0, 'nobody acts after the end');
// a tie at the top is a draw
let tie = JSON.parse(JSON.stringify(g)); tie.chips = [110, 110, 90];
ok(G.over(tie).winner === -1 && K.deepEq(G.over(tie).ranking, [0, 1, 2]), 'equal chips at the top are a draw');
// chips never go below zero over many games
let minChips = 1000;
for (let i = 0; i < 40; i++) { const rr = K.rng(900 + i); let st = G.create({ n: 2, names: ['A', 'B'], opts: {} }, rr); let gg = 0; while (!G.over(st) && gg++ < 500) { const p = G.current(st); st = G.apply(st, p, G.ai(st, p, 3, rr), rr).state; } st.chips.forEach((c) => { if (c < minChips) minChips = c; }); }
ok(minChips >= 0, 'chips never go negative (' + minChips + ')');
// the strategy: the hard AI stands on 13 against a 6, hits 16 against a 10, doubles 11, stands on soft 19
function aiOn(hand, up, level) { const st = script(s, [hand], [up], [S2, S3, S5, S6]); st.n = 1; st.chips = [100]; return G.ai(st, 0, level, r); }
ok(K.deepEq(aiOn([K10, S3], S6, 3), { stand: true }), 'hard AI stands on 13 against a 6');
ok(K.deepEq(aiOn([K10, S6], K10, 3), { hit: true }), 'hard AI hits 16 against a 10');
ok(K.deepEq(aiOn([S5, S6], S9, 3), { double: true }), 'hard AI doubles 11');
ok(K.deepEq(aiOn([A, S8], S6, 3), { stand: true }), 'hard AI stands on soft 19');
ok(K.deepEq(aiOn([A, S7], S5, 3), { double: true }), 'hard AI doubles soft 18 against a 5');
ok(K.deepEq(aiOn([K10, S3], S6, 1), { hit: true }) && K.deepEq(aiOn([K10, S5], S6, 1), { stand: true }), 'easy AI hits under 15 and stands from 15');
// double is not offered on three cards
t = script(s, [[S2, S3, S5]], [S6], [S8]); t.n = 1; t.chips = [100];
ok(K.deepEq(G.actions(t, 0), [{ hit: true }, { stand: true }]), 'no double on three cards');
// the hard AI loses fewer chips than the easy one over many games against the dealer
function chipsAt(level, seed) { const rr = K.rng(seed); let st = G.create({ n: 1, names: ['A'], opts: {} }, rr); let gg = 0; while (!G.over(st) && gg++ < 200) st = G.apply(st, 0, G.ai(st, 0, level, rr), rr).state; return st.chips[0]; }
let c1 = 0, c3 = 0; const N = 300;
for (let i = 0; i < N; i++) { c1 += chipsAt(1, 2000 + i); c3 += chipsAt(3, 2000 + i); }
ok(c3 > c1, 'basic strategy keeps more chips than hitting under 15 (' + (c1 / N).toFixed(1) + ' vs ' + (c3 / N).toFixed(1) + ')');
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 20, maxTurns: 500 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
