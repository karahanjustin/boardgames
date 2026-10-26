// Mastermind: the rules, the feedback, the hidden code and the AI. Run: node tools/tests/mastermind.js
const G = require('../../js/games/mastermind.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(5);
const cfg = { n: 2, names: ['A', 'B'], opts: {} };
let s = G.create(cfg, r);
ok(G.current(s) === 0 && G.actions(s, 0) === null && G.actions(s, 1).length === 0 && G.over(s) === null, 'the codemaker (player 0) begins, the breaker waits');
ok(G.validate(s, 0, { code: [0, 1, 2, 3] }) && G.validate(s, 0, { code: [5, 5, 5, 5] }) && G.validate(s, 0, { auto: true }), 'legal codes and the random code validate');
ok(!G.validate(s, 0, { code: [0, 1, 2] }) && !G.validate(s, 0, { code: [0, 1, 2, 6] }) && !G.validate(s, 0, { code: [0, 1, 2, -1] }) && !G.validate(s, 0, { code: [0, 1, 2, 1.5] }), 'short codes and colours out of range are rejected');
ok(!G.validate(s, 1, { code: [0, 1, 2, 3] }) && !G.validate(s, 0, { guess: [0, 1, 2, 3] }) && !G.validate(s, 0, {}), 'the breaker cannot set the code and nobody guesses before it is set');
let before = JSON.stringify(s);
let res = G.apply(s, 0, { code: [0, 1, 2, 3] }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate when the code is set');
s = res.state;
ok(G.current(s) === 1 && G.actions(s, 1).length === 1296 && G.actions(s, 0).length === 0 && G.validate(s, 1, { guess: [0, 0, 0, 0] }) && !G.validate(s, 0, { guess: [0, 0, 0, 0] }), 'the breaker has all 1296 guesses, the maker none');
// the hidden view
ok(G.view(s, 1).code === null && G.view(s, 1).codeSet === true && G.view(s, -1).code === null, 'the breaker and the hot seat view do not see the code');
ok(JSON.stringify(G.view(s, 0).code) === '[0,1,2,3]', 'the maker sees the code');
// feedback cases against the code 0 1 2 3
const fb = (g) => { const rr = G.apply(s, 1, { guess: g }, r); const last = rr.state.guesses[rr.state.guesses.length - 1]; return last.b + '/' + last.w; };
ok(fb([3, 2, 1, 0]) === '0/4', 'all colours right, all misplaced gives 0 black 4 white');
ok(fb([0, 0, 0, 0]) === '1/0', 'one repeated colour counts once');
ok(fb([1, 1, 0, 0]) === '1/1', 'a repeat is matched only as often as it occurs in the code');
ok(fb([4, 4, 5, 5]) === '0/0', 'no colour in common gives nothing');
ok(fb([0, 1, 5, 5]) === '2/0', 'two exact matches');
ok(fb([0, 1, 3, 2]) === '2/2', 'two exact and two swapped');
before = JSON.stringify(s);
res = G.apply(s, 1, { guess: [0, 1, 2, 3] }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate on a guess');
ok(G.over(res.state) && G.over(res.state).winner === 1 && G.over(res.state).cracked && res.events.some((e) => e.e === 'cracked'), 'the right guess wins for the breaker');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0 && !G.validate(res.state, 1, { guess: [0, 0, 0, 0] }), 'nobody acts after the end');
ok(JSON.stringify(G.view(res.state, 1).code) === '[0,1,2,3]', 'after the game the breaker sees the code');
// ten wrong guesses: the codemaker wins
let t = s;
for (let i = 0; i < 10; i++) { ok(G.over(t) === null, 'the game runs before guess ' + (i + 1)); t = G.apply(t, 1, { guess: [5, 5, 5, 5] }, r).state; }
ok(G.over(t) && G.over(t).winner === 0 && !G.over(t).cracked && t.guesses.length === 10, 'ten misses win for the codemaker');
ok(JSON.stringify(G.view(t, 1).code) === '[0,1,2,3]' && JSON.stringify(G.view(t, -1).code) === '[0,1,2,3]', 'the code is revealed when the breaker fails');
// the random code is legal and the maker AI uses it
s = G.create(cfg, r);
ok(JSON.stringify(G.ai(s, 0, 2, r)) === '{"auto":true}', 'the AI codemaker asks for a random code');
s = G.apply(s, 0, { auto: true }, r).state;
ok(Array.isArray(s.code) && s.code.length === 4 && s.code.every((c) => c >= 0 && c < 6 && c === Math.floor(c)), 'the random code is legal');
// level 2 and 3 are consistent with every feedback, level 3 opens with 0 0 1 1 and cracks fast
const consistentWith = (guess, guesses) => guesses.every((g) => { const code = guess; let b = 0, cc = [0, 0, 0, 0, 0, 0], gc = [0, 0, 0, 0, 0, 0]; for (let k = 0; k < 4; k++) { if (code[k] === g.g[k]) b++; else { cc[code[k]]++; gc[g.g[k]]++; } } let w = 0; for (let k = 0; k < 6; k++) w += Math.min(cc[k], gc[k]); return b === g.b && w === g.w; });
ok(JSON.stringify(G.ai(s, 1, 3, r).guess) === '[0,0,1,1]', 'level 3 opens with the Knuth guess');
let worst = 0, slowest = 0, consistentOk = true, cracked = 0;
for (let g = 0; g < 40; g++) {
  const rr = K.rng(100 + g);
  let st = G.create(cfg, rr);
  st = G.apply(st, 0, { auto: true }, rr).state;
  while (!G.over(st)) {
    const t0 = Date.now();
    const a = G.ai(st, 1, 3, rr);
    slowest = Math.max(slowest, Date.now() - t0);
    if (st.guesses.some((g) => JSON.stringify(g.g) === JSON.stringify(a.guess))) consistentOk = false;
    st = G.apply(st, 1, a, rr).state;
  }
  if (G.over(st).cracked) cracked++;
  worst = Math.max(worst, st.guesses.length);
}
ok(consistentOk, 'level 3 never repeats a guess (a probe outside the consistent set is allowed by Knuth)');
ok(cracked === 40 && worst <= 6, 'level 3 cracks every code, worst case ' + worst + ' guesses');
ok(slowest < 400, 'level 3 stays under 400 ms per move (slowest ' + slowest + ' ms)');
let l2ok = true, l2cracked = 0;
for (let g = 0; g < 40; g++) {
  const rr = K.rng(300 + g);
  let st = G.create(cfg, rr);
  st = G.apply(st, 0, { auto: true }, rr).state;
  while (!G.over(st)) { const a = G.ai(st, 1, 2, rr); if (!consistentWith(a.guess, st.guesses)) l2ok = false; st = G.apply(st, 1, a, rr).state; }
  if (G.over(st).cracked) l2cracked++;
}
ok(l2ok && l2cracked >= 36, 'level 2 is consistent and cracks almost every code (' + l2cracked + ' of 40)');
// random games with the AI at every level
const rr = K.playRandomGames(G, { games: 20 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ')');
K.done();
