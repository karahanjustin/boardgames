# Boardgames: the game contract

Every game is one file, `js/games/<id>.js`, plus its tests in `tools/tests/<id>.js`. The hub, the lobby, the
networking, the AI turn loop and the match screen are shared (`js/core.js`); a game only knows its own rules and how
to draw itself. Rules and AI never touch the DOM, so `node tools/tests/<id>.js` can play the game through.

## The module

```js
(function (root) {
  'use strict';
  var G = {
    id: 'connect4',                         // file name, lower case, letters and digits
    name: { de: 'Vier gewinnt', en: 'Connect Four' },
    blurb: { de: 'Vier in einer Reihe gewinnt.', en: 'Four in a row wins.' },
    icon: '🔴',                              // one emoji
    counts: [2],                             // the player counts the game allows, e.g. [2, 3, 4, 6]
    ai: true,                                // an AI can play it (then ai() is required)
    hidden: false,                           // true when players hold private information (then view() must hide it)
    strings: { de: { drop: 'Spalte wählen' }, en: { drop: 'Pick a column' } },  // the game's own texts, api.t('drop')
    create: function (cfg, rng) { ... return state; },
    current: function (state) { ... return p; },
    actions: function (state, p) { ... return [action, ...]; },
    apply: function (state, p, action, rng) { ... return { state: next, events: [...] }; },
    over: function (state) { ... return null or { winner: p, ranking: [...] }; },
    ai: function (state, p, level, rng) { ... return action; },
    view: function (state, p) { ... return viewState; },   // only when hidden
    ui: { mount: function (el, api) { ... return { update: function (view, info) {}, destroy: function () {} }; } }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
```

In node the module exports `G`; in the browser it registers itself. Keep it to ES5 syntax (var, function), the
other files are written that way too. Comments are full sentences; no em dashes or en dashes anywhere.

## State

`state` is plain JSON: objects, arrays, numbers, strings, booleans. No functions, no class instances, no `undefined`
that matters. The host sends it over the wire and saves it. `create(cfg, rng)` gets `cfg = { n: playerCount,
names: ['Anna', 'Bob', ...], opts: {} }`. Players are `0 .. n - 1`; player 0 moves first unless the rules say otherwise.

`apply` must not mutate the state it is given: copy what changes (a deep copy with `JSON.parse(JSON.stringify(s))`
is fine for small states). Return `{ state: next, events: [] }`. Events are small plain objects the UI may animate
(`{ e: 'dice', v: 5 }`, `{ e: 'capture', at: [x, y] }`); they are optional.

`current(state)` returns the player whose turn it is, or `-1` when nobody may act (the game is over, or a
simultaneous phase). When several players may act at once, also give `canAct(state, p)`.

`actions(state, p)` returns every legal action as small JSON (`{ col: 3 }`, `{ from: 12, to: 15 }`, `{ pass: true }`).
The host validates every incoming action by deep equality against this list, so the list must be complete and
deterministic. If a game has too many actions to list (free text, thousands of placements), give
`validate(state, p, action)` instead and return `null` from `actions`.

`over(state)` returns `null` while the game runs, else `{ winner: p }` (a single winner), `{ winner: -1 }` (a draw)
or `{ ranking: [p, p, ...] }` for games with places (first to last). You may give both.

## Randomness

Dice, cards and shuffles use the `rng` handed in: `rng.next()` (0..1), `rng.int(n)` (0..n-1), `rng.pick(array)`,
`rng.shuffle(array)` (in place, returns it). Never `Math.random()` in the rules or the AI, so a test can replay a seed.
The host owns the rng; clients only receive states.

## Hidden information

A game with cards in hand or a hidden fleet sets `hidden: true` and gives `view(state, p)`: the state as player `p`
is allowed to see it (other hands replaced by counts, the enemy fleet removed). `p` is `-1` for the host's log and
for hot-seat play on one device, where the current player's view is shown. The UI only ever gets views, never the
full state, unless the game is not hidden. `actions` and `apply` always work on the full state (host side).

## The AI

`ai(state, p, level, rng)` returns one legal action for player `p`. `level` is 1 (easy), 2 (normal) or 3 (hard).
It runs on the host's main thread: finish within about 50 ms at level 1 and 400 ms at level 3 on a phone. Make the
easy level beatable by a child (random among decent moves), the hard level a real opponent (search, probabilities).
Never return an illegal action; the core verifies and falls back to a random legal one if you do, which is a bug.

## The UI

`ui.mount(el, api)` builds the game inside `el` (an empty div that fills the match area, at least 320 px wide; use
`el.clientWidth`) and returns `{ update(view, info), destroy() }`. `update` is called with the current view and
`info = { me, current, canAct, over, events, players, names, colors, lang }`:

- `me`: the player index playing on this device, or `-1` when none (spectator). In hot-seat play `me` is the
  current player each turn.
- `canAct`: whether this device may act now. Only then should clicks call `api.act(action)`.
- `events`: the events of the last apply, once; animate them if you like.
- `players`: `[{ name, ai, remote, connected }]`; `colors`: a colour per player (`#rrggbb`), use them for pieces.

`api`: `act(action)` sends an action for `me`; `t(key, ...args)` translates (`{0}` placeholders); `lang` is `'de'`
or `'en'`; `sound(kind)` plays a short sound (`move`, `capture`, `dice`, `card`, `win`, `lose`, `turn`, `wrong`);
`toast(text)` shows a short message; `confirm(text)` returns a promise.

Draw with DOM or a canvas, both are fine. The match area is `el`; make it work from 320 px (a phone, portrait) to
1200 px. Use the player colours; mark whose turn it is; after `over`, show the result in the board as well (the
shell shows a banner too). No external files, no fonts, no images: draw pieces with CSS, canvas or emoji.
Keep all texts in `strings` (German and English both), never literal text in the UI.

## Tests

`tools/tests/<id>.js` runs with plain node, requires `../../js/games/<id>.js` and `../testkit.js`, and checks the
rules: a fresh game, legal actions, a scripted game to a win, the draw case, hidden views leaking nothing, the AI
never returning an illegal action over a few hundred random games at every level and count, and that `apply` never
mutates its input. End with `ALL PASS (n)` and exit code 1 on failure, like the other tests.
