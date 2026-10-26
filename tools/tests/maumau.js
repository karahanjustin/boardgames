// Mau-Mau: the rules, the hidden views, the AI. Run: node tools/tests/maumau.js
const G = require('../../js/games/maumau.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(3);
let s = G.create({ n: 3, names: ['A', 'B', 'C'], opts: {} }, r);
ok(s.hands.every((hd) => hd.length === 5) && s.pile.length === 1 && s.draw.length === 32 - 16, 'three players get five cards each, one card lies open');
ok(s.pile[0].slice(1) !== 'J', 'the first card is never a Jack');
ok(G.current(s) === 0 && G.actions(s, 0).length >= 1 && G.actions(s, 1).length === 0, 'player 0 begins');
// the views hide the other hands and the draw pile
const v = G.view(s, 1);
ok(v.hands[1].length === 5 && v.hands[0] === null && v.hands[2] === null && v.draw === undefined && v.counts.join() === '5,5,5' && v.drawCount === 16, 'a view shows only its own hand and the counts');
// a seven makes the next player draw two, two sevens four
{
  const t = JSON.parse(JSON.stringify(s));
  t.pile = ['h9']; t.hands[0] = ['h7', 'cK']; t.hands[1] = ['s7', 'dQ', 'dK']; t.hands[2] = ['cQ', 'c10', 'd9'];
  const a = G.apply(t, 0, { play: 0 }, r);
  ok(a.state.pending === 2 && a.state.turn === 1, 'a seven sets two cards pending for the next player');
  const acts = G.actions(a.state, 1);
  ok(acts.length === 2 && acts.some((x) => x.play === 0) && acts.some((x) => x.draw), 'the next player may answer with a seven or draw');
  const b = G.apply(a.state, 1, { play: 0 }, r);
  ok(b.state.pending === 4 && b.state.turn === 2, 'a second seven stacks to four');
  const c = G.apply(b.state, 2, { draw: true }, r);
  ok(c.state.hands[2].length === 7 && c.state.pending === 0 && c.state.turn === 0, 'the third player draws four and the turn moves on');
}
// an eight skips, an ace plays again, a Jack wishes a suit and the wish binds
{
  const t = JSON.parse(JSON.stringify(s));
  t.pile = ['h9']; t.hands[0] = ['h8', 'hA', 'sJ', 'c10']; t.hands[1] = ['s10', 'dQ']; t.hands[2] = ['cQ', 'd9', 'h10'];
  let x = G.apply(t, 0, { play: 0 }, r);
  ok(x.state.turn === 2 && x.events.some((e) => e.e === 'skip' && e.p === 1), 'an eight skips player 1');
  x = G.apply(x.state, 2, { play: 2 }, r); // h10 on h8
  ok(x.state.turn === 0, 'back to player 0');
  x = G.apply(x.state, 0, { play: 0 }, r); // hA on h10
  ok(x.state.turn === 0 && x.state.again, 'an ace keeps the turn');
  const jacks = G.actions(x.state, 0).filter((a) => a.wish);
  ok(jacks.length === 4, 'a Jack offers the four suits');
  x = G.apply(x.state, 0, { play: 0, wish: 'd' }, r); // sJ, wish diamonds
  ok(x.state.wish === 'd' && x.state.turn === 1, 'the wish is set');
  const a1 = G.actions(x.state, 1);
  ok(a1.some((a) => a.play === 1) && !a1.some((a) => a.play === 0), 'only the wished suit may follow the Jack');
  ok(!G.actions({ ...x.state, hands: [['cJ'], ['sJ'], []] , turn: 1 }, 1).some((a) => a.play != null), 'a Jack may not go on a Jack');
}
// drawing: the drawn card may be played if it fits, else the turn passes at once
{
  const t = JSON.parse(JSON.stringify(s));
  t.pile = ['h9']; t.hands[0] = ['cK']; t.hands[1] = ['s10', 'dQ']; t.hands[2] = ['cQ']; t.draw = ['sQ', 'hK'];
  let x = G.apply(t, 0, { draw: true }, r);
  ok(x.state.hands[0].length === 2 && x.state.drewThis === 1 && x.state.turn === 0, 'a fitting drawn card may be played now');
  ok(G.actions(x.state, 0).some((a) => a.play === 1) && !G.actions(x.state, 0).some((a) => a.play === 0) && G.actions(x.state, 0).some((a) => a.pass), 'only the drawn card, or pass');
  const y = G.apply(t, 0, { draw: true }, r); // draws hK which fits: same as above; now a non-fitting one
  const t2 = JSON.parse(JSON.stringify(t)); t2.draw = ['hK', 'sQ'];
  const z = G.apply(t2, 0, { draw: true }, r);
  ok(z.state.turn === 1 && z.state.drewThis === null, 'a card that does not fit ends the turn');
}
// the end: the first out wins, the rest by cards left; two players end at once
{
  const t = JSON.parse(JSON.stringify(s));
  t.pile = ['h9']; t.hands[0] = ['hK']; t.hands[1] = ['s10', 'dQ', 'c7']; t.hands[2] = ['cQ'];
  const x = G.apply(t, 0, { play: 0 }, r);
  ok(x.events.some((e) => e.e === 'out') && x.state.out[0] === 0 && !G.over(x.state), 'player 0 is out, the game goes on for the places');
  const t2 = JSON.parse(JSON.stringify(x.state)); t2.turn = 2; t2.pile = ['cK'];
  const y = G.apply(t2, 2, { play: 0 }, r);
  ok(G.over(y.state) && G.over(y.state).ranking.join() === '0,2,1', 'the ranking: first out, second out, the one with cards left');
  const u = G.create({ n: 2, names: ['A', 'B'], opts: {} }, r); u.pile = ['h9']; u.hands[0] = ['hK']; u.hands[1] = ['s10', 'dQ'];
  const w = G.apply(u, 0, { play: 0 }, r);
  ok(G.over(w.state) && G.over(w.state).winner === 0, 'with two players the first out ends it');
}
// apply never mutates
{
  const before = JSON.stringify(s);
  G.apply(s, 0, G.actions(s, 0)[0], r);
  ok(JSON.stringify(s) === before, 'apply does not mutate');
}
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 10, maxTurns: 1500 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
