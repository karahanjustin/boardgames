# Spielkiste

Die Klassiker im Browser, auf Deutsch und Englisch: Mensch ärgere Dich nicht, Schiffe versenken, Dame, Mühle, Vier gewinnt, Backgammon, Halma, Kniffel, Mau-Mau und mehr. Jedes Spiel gegen den Computer, am selben Gerät oder über das Netz mit bis zu sechs Spielern, ohne Server: die Geräte verbinden sich direkt (WebRTC), der Gastgeber führt das Spiel.

The classics in the browser, German and English. Every game against the computer, on one device, or over a direct connection with up to six players and no server: the host's device runs the game.

- Static site, no build step: open `index.html` or serve the folder.
- A game is one file in `js/games/`, see `docs/CONTRACT.md`. Tests: `node tools/tests/<id>.js`, all: `sh tools/test_all.sh`.
- Deploy: push to the Pages repo (see `tools/deploy.sh`).
