# Boardgames: the graphics of the games

The games must look like the real things on a table: wooden boards, turned pieces, cone figures, glass marbles,
proper playing cards, ivory dominoes, dice with pips, not coloured dots on flat rectangles. `js/gfx.js` is the shared
kit; use it for every piece so all games share one look. Everything is SVG strings and CSS classes; no images, no
fonts, no libraries.

## The kit (window.Gfx)

- `Gfx.pawn(color, size)`: the classic cone figure with a ball head (Mensch ärgere Dich nicht, Leiterspiel, Halma
  when you prefer figures). `size` is the width in px, the figure is taller than wide (40 x 58 units).
- `Gfx.disc(color, size, { king, kingColor })`: a turned wooden disc seen a little from above (Dame, Mühle, Reversi
  with two discs, Vier gewinnt counters). 40 x 32 units.
- `Gfx.marble(color, size)`: a glass marble (Halma, Mastermind pegs, Memory markers).
- `Gfx.die(value, size, color, pipColor)`: a die face 1..6 with a bevel. Animate a roll by swapping values quickly.
- `Gfx.card(rank, suit, size, { dim })`: a playing card face, ranks '7'..'10', 'J', 'Q', 'K', 'A', suits 'c' 's' 'h' 'd'.
  `Gfx.cardBack(size, color)`: the back. 60 x 84 units.
- `Gfx.domino(a, b, size, vertical)`: a tile with pips.
- `Gfx.ship(len, size, color)`: a ship seen from above, `len` squares long (horizontal; rotate with CSS for vertical).
- `Gfx.crown(size, color)`: a small crown marker.
- `Gfx.shade(hex, k)`: a lighter (k > 0) or darker (k < 0) shade of a colour, for your own drawings.
- CSS classes (already on the page): `gfx-wood`, `gfx-wood-dark`, `gfx-felt`, `gfx-paper`, `gfx-ivory` for surfaces
  with grain, `gfx-frame` for a wooden frame round a board.

The player colours come in `info.colors`; always draw a player's pieces with `info.colors[p]`.

## What a game should do

- The board is a real board: wood, felt, cardboard or paper with the kit classes, a frame where the real thing has one,
  printed lines and fields with a little depth (inset shadows, a bevel on the edge), the start fields and home
  columns in the player colours where the real game has them.
- Pieces are kit pieces, sized to the squares, with their drop shadow. The piece that may move glows or lifts; the
  selected one lifts more. Target squares get a soft ring, not a flat flood fill.
- Movement animates: a piece slides from square to square (CSS transition on transform or position, 180 to 300 ms),
  a captured piece pops away, a card flies to the pile, a die tumbles (several faces in quick succession, then the
  value), a dropped disc falls.
- The whole thing stays readable on a phone: the board scales to `el.clientWidth` (min 320 px), controls are at
  least 40 px tall, nothing needs hover.
- Keep every rule and action exactly as it is; change only the `ui` part of the module (and only strings if you need
  new ones). Tests must keep passing: `node tools/tests/<id>.js`.

## Checking your work

Screenshots with headless Chrome against a local server of your own (pick a free port, kill it when done):

```
cd /Users/justin/Desktop/CC-Projects/Games/Boardgames
python3 -m http.server 5131 --bind 127.0.0.1 >/dev/null 2>&1 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --no-first-run --user-data-dir="$(mktemp -d)" --window-size=1280,900 --virtual-time-budget=6000 \
  --screenshot=/tmp/x.png "http://localhost:5131/?game=ludo&start=ai&n=4"
```

Chrome may hang after writing the PNG: run it in the background, poll for the file, then kill it. The link
`?game=<id>&start=ai&n=<players>` starts a match against the computer at once; the human is player 0 and nothing has
moved yet, so the screenshot shows the fresh board. To see a mid-game, add `&demo=<n>` (the shell plays n random
moves for everyone before the first frame when that parameter is present). For a phone width, wrap the page in an
iframe of 390 px inside a small wrapper HTML (Chrome will not go narrower than about 500 px on its own).
Look at your screenshots (the Read tool shows PNGs) and fix what looks wrong before reporting.
