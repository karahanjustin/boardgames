/* The test kit for the games: a seeded rng like the app's, a checker, and a runner that plays random games with
   the AI at every level and player count to catch illegal actions and mutations. */
const assert = require('assert');
let fails = 0, checks = 0;
function ok(c, msg) { checks++; if (!c) { fails++; console.log('FAIL: ' + msg); } }
function done() { console.log(fails ? fails + ' FAILED of ' + checks : 'ALL PASS (' + checks + ')'); process.exit(fails ? 1 : 0); }
function rng(seed) {
  let s = (seed >>> 0) || 1;
  const r = {
    next() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
    int(n) { return Math.floor(r.next() * n); },
    pick(a) { return a[r.int(a.length)]; },
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  };
  return r;
}
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const legal = (G, s, p, a) => G.validate ? G.validate(s, p, a) : (G.actions(s, p) || []).some((x) => deepEq(x, a));
/* Plays `games` random games per count and level: the AI for every player, the state copied and compared after
   each apply (no mutation), every action checked for legality, the game ending within `maxTurns`. */
function playRandomGames(G, opts) {
  opts = opts || {};
  const counts = opts.counts || G.counts, levels = opts.levels || [1, 2, 3], games = opts.games || 20, maxTurns = opts.maxTurns || 2000;
  let played = 0, ended = 0, turns = 0, illegal = 0, mutated = 0, err = null;
  counts.forEach((n) => levels.forEach((lv) => {
    for (let g = 0; g < games; g++) {
      const r = rng(1000 * n + 100 * lv + g);
      let s;
      try { s = G.create({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: opts.opts || {} }, r); } catch (e) { err = err || e; return; }
      let t = 0;
      try {
        while (!G.over(s) && t < maxTurns) {
          let p = G.current(s);
          if (p < 0) { // a simultaneous phase: every player who may act does, in order
            let any = false;
            for (let q = 0; q < n; q++) if (G.canAct && G.canAct(s, q)) { any = true; p = q; break; }
            if (!any) break;
          }
          const a = G.ai(s, p, lv, r);
          if (!legal(G, s, p, a)) { illegal++; console.log('illegal action by AI', G.id, 'n', n, 'lv', lv, 'p', p, JSON.stringify(a)); break; }
          const before = JSON.stringify(s);
          const res = G.apply(s, p, a, r);
          if (JSON.stringify(s) !== before) { mutated++; console.log('apply mutated the state', G.id); break; }
          s = res.state; t++;
        }
      } catch (e) { err = err || e; }
      played++; turns += t;
      if (G.over(s)) ended++;
    }
  }));
  if (err) console.log('error during random games: ' + (err.stack || err));
  return { played, ended, turns, illegal, mutated, err };
}
module.exports = { ok, done, rng, deepEq, legal, playRandomGames, assert };
