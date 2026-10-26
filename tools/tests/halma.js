// Sternhalma: the rules and the AI. Run: node tools/tests/halma.js
const G = require('../../js/games/halma.js');
const K = require('../testkit.js'), ok = K.ok;
const r = K.rng(3);
// the same enumeration of the star as in the game, so scenarios can name fields by cube coordinates
const CELLS = [], KEY = {};
for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
  const z = -x - y;
  if ((x >= -4 && y >= -4 && z >= -4) || (x <= 4 && y <= 4 && z <= 4)) { KEY[x + ',' + y + ',' + z] = CELLS.length; CELLS.push([x, y, z]); }
}
const at = (x, y, z) => KEY[x + ',' + y + ',' + z];
const dist = (i, j) => Math.max(Math.abs(CELLS[i][0] - CELLS[j][0]), Math.abs(CELLS[i][1] - CELLS[j][1]), Math.abs(CELLS[i][2] - CELLS[j][2]));
const mk = (n) => G.create({ n, names: Array.from({ length: n }, (_, i) => 'P' + i), opts: {} }, r);
ok(CELLS.length === 121, 'the star has 121 fields');
let s = mk(2);
ok(s.board.length === 121 && s.board.filter((v) => v === 0).length === 10 && s.board.filter((v) => v === 1).length === 10, 'two players with ten pieces each');
ok(s.board.filter((v, i) => v === 0 && CELLS[i][2] <= -5).length === 10 && s.board.filter((v, i) => v === 1 && CELLS[i][2] >= 5).length === 10, 'two players sit in opposite points');
ok(G.current(s) === 0 && G.actions(s, 1).length === 0 && G.over(s) === null, 'player 0 begins, player 1 has no action, the game is not over');
let acts = G.actions(s, 0);
ok(acts.length > 0 && acts.every((a) => s.board[a.from] === 0 && s.board[a.to] === -1), 'every opening move starts on an own piece and ends on a free field');
ok(acts.some((a) => dist(a.from, a.to) > 1), 'the opening includes jumps over own pieces');
// steps and jump chains on an almost empty board
s = mk(2); s.board = s.board.map(() => -1);
s.board[at(0, 0, 0)] = 0; s.board[at(1, -1, 0)] = 1; s.board[at(3, -3, 0)] = 1; s.board[at(-1, 0, 1)] = 0;
acts = G.actions(s, 0).filter((a) => a.from === at(0, 0, 0)).map((a) => a.to);
ok(acts.indexOf(at(0, 1, -1)) >= 0 && acts.indexOf(at(1, 0, -1)) >= 0, 'a step onto a free neighbour is allowed');
ok(acts.indexOf(at(1, -1, 0)) < 0 && acts.indexOf(at(-1, 0, 1)) < 0, 'occupied neighbours are not landings');
ok(acts.indexOf(at(2, -2, 0)) >= 0, 'a jump over an enemy piece lands behind it');
ok(acts.indexOf(at(4, -4, 0)) >= 0, 'the chain continues over the second piece');
ok(acts.indexOf(at(-2, 0, 2)) >= 0, 'a jump over an own piece is allowed too');
ok(acts.indexOf(at(0, 0, 0)) < 0, 'the chain never returns to the origin');
ok(acts.indexOf(at(5, -5, 0)) < 0, 'a jump needs exactly one piece in between');
const before = JSON.stringify(s);
let res = G.apply(s, 0, { from: at(0, 0, 0), to: at(4, -4, 0) }, r);
ok(JSON.stringify(s) === before, 'apply does not mutate');
ok(res.state.board[at(4, -4, 0)] === 0 && res.state.board[at(0, 0, 0)] === -1 && res.state.turn === 1 && res.events[0].jump === true, 'the jump chain moves the piece and passes the turn');
// the win: the tenth piece enters the target point
s = mk(2); s.board = s.board.map(() => -1);
[[-3, -2, 5], [-2, -3, 5], [-1, -4, 5], [-4, -2, 6], [-3, -3, 6], [-2, -4, 6], [-4, -3, 7], [-3, -4, 7], [-4, -4, 8]].forEach((c) => { s.board[at(c[0], c[1], c[2])] = 0; });
s.board[at(-4, 0, 4)] = 0; s.board[at(4, 4, -8)] = 1;
ok(G.over(s) === null, 'nine pieces in the point do not win yet');
res = G.apply(s, 0, { from: at(-4, 0, 4), to: at(-4, -1, 5) }, r);
ok(res.events.some((e) => e.e === 'finish') && G.over(res.state) && G.over(res.state).winner === 0 && K.deepEq(G.over(res.state).ranking, [0, 1]), 'all ten pieces in the target point win');
ok(G.current(res.state) === -1 && G.actions(res.state, 1).length === 0, 'nobody moves after the end');
// a player without a move passes
s = mk(2); s.board = s.board.map(() => -1);
s.board[at(4, 4, -8)] = 0; s.board[at(4, 3, -7)] = 1; s.board[at(3, 4, -7)] = 1; s.board[at(4, 2, -6)] = 1; s.board[at(2, 4, -6)] = 1; s.board[at(3, 3, -6)] = 1;
ok(K.deepEq(G.actions(s, 0), [{ pass: true }]), 'a boxed in player can only pass');
ok(G.apply(s, 0, { pass: true }, r).state.turn === 1, 'the pass hands the turn on');
// the AI moves forward from the start at every level
s = mk(2);
const tip = at(-4, -4, 8);
[1, 2, 3].forEach((lv) => { const a = G.ai(s, 0, lv, r); ok(dist(a.to, tip) < dist(a.from, tip), 'level ' + lv + ' opens with a move towards the target'); });
// random games with the AI at every level and count
const rr = K.playRandomGames(G, { games: 6, maxTurns: 6000 });
ok(rr.illegal === 0 && rr.mutated === 0 && !rr.err, 'the AI never plays an illegal action and apply never mutates');
ok(rr.ended === rr.played, 'every random game ends (' + rr.ended + ' of ' + rr.played + ', ' + Math.round(rr.turns / rr.played) + ' moves on average)');
K.done();
