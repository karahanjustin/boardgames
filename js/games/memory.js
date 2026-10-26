/* Memory: pairs of emoji cards lie face down, a player turns two, a pair is kept and earns another turn. Two to six
   players, 24 pairs for two and 30 pairs for more. Rules, three AI levels (no memory, the last eight cards, perfect
   memory) and a DOM grid with a flip animation. */
(function (root) {
  'use strict';
  var EMOJI = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍉', '🥝', '🍍', '🥕', '🌽', '🍄', '🌵', '🌻', '🌈', '⭐', '🔥', '🌙', '⚡', '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐸', '🐙', '🦋', '🐝', '🚗', '🚀', '⚽', '🎲', '🎸', '🎈'];
  var REMEMBER_L2 = 8;
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  function pairsFor(n) { return n <= 2 ? 24 : 30; }
  /* A card is face down when it is neither matched nor lying open on the table. */
  function faceDown(s, i) { return s.matched[i] < 0 && s.open.indexOf(i) < 0; }
  function legalFlips(s, p) {
    if (s.turn !== p || G.over(s)) return [];
    var out = [];
    for (var i = 0; i < s.cards.length; i++) {
      if (s.matched[i] >= 0) continue;
      // While a mismatched pair is still lying open it counts as face down again for the next player.
      if (!s.pending && s.open.indexOf(i) >= 0) continue;
      out.push({ flip: i });
    }
    return out;
  }
  /* The cards the AI remembers at this level: nothing, the last eight distinct cards seen, or everything seen. */
  function remembered(s, level) {
    if (level <= 1) return [];
    var seen = level === 2 ? s.seen.slice(-REMEMBER_L2) : s.seen.slice();
    return seen.filter(function (i) { return s.matched[i] < 0; });
  }
  var G = {
    id: 'memory',
    name: { de: 'Memory', en: 'Memory' },
    blurb: { de: 'Paare finden, wer sich am meisten merkt gewinnt.', en: 'Find the pairs, the best memory wins.' },
    icon: '🃏',
    counts: [2, 3, 4, 5, 6],
    ai: true,
    hidden: true,
    strings: {
      de: {
        pairs: '{0} Paare', pair: '{0} Paar', flipHint: 'Decke eine Karte auf', second: 'Decke eine zweite Karte auf', match: 'Ein Paar! Du bist noch einmal dran', noMatch: 'Kein Paar',
        matchOf: '{0} hat ein Paar gefunden', notOpen: 'Diese Karte liegt schon offen', tie: 'Gleichstand',
        rules: 'Alle Karten liegen verdeckt, jedes Bild gibt es zweimal. Wer dran ist, deckt zwei Karten auf. Zeigen sie dasselbe Bild, behält man das Paar und ist noch einmal dran. Sonst werden beide wieder umgedreht und der Nächste ist dran. Sind alle Paare gefunden, gewinnt, wer die meisten hat. Zu zweit liegen 24 Paare, ab drei Spielern 30.'
      },
      en: {
        pairs: '{0} pairs', pair: '{0} pair', flipHint: 'Turn over a card', second: 'Turn over a second card', match: 'A pair! You go again', noMatch: 'No pair',
        matchOf: '{0} found a pair', notOpen: 'That card is already face up', tie: 'Tie',
        rules: 'All cards lie face down, every picture is there twice. On your turn you turn over two cards. If they show the same picture you keep the pair and go again. Otherwise both are turned back and the next player goes. When all pairs are found, the player with the most pairs wins. Two players play with 24 pairs, three or more with 30.'
      }
    },
    create: function (cfg, rng) {
      var n = cfg.n, pairs = pairsFor(n), cards = [], matched = [], scores = [], i;
      for (i = 0; i < pairs; i++) { cards.push(EMOJI[i]); cards.push(EMOJI[i]); }
      rng.shuffle(cards);
      for (i = 0; i < cards.length; i++) matched.push(-1);
      for (i = 0; i < n; i++) scores.push(0);
      return { n: n, cards: cards, matched: matched, open: [], pending: false, turn: 0, scores: scores, seen: [], last: null };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: legalFlips,
    apply: function (s, p, a) {
      var next = copy(s), events = [], i = a.flip;
      if (next.pending) { next.open = []; next.pending = false; }
      next.open.push(i);
      // The seen log keeps every card once, the most recently seen last.
      var at = next.seen.indexOf(i);
      if (at >= 0) next.seen.splice(at, 1);
      next.seen.push(i);
      events.push({ e: 'flip', at: i, v: next.cards[i], p: p });
      if (next.open.length === 2) {
        var a0 = next.open[0], a1 = next.open[1];
        if (next.cards[a0] === next.cards[a1]) {
          next.matched[a0] = p; next.matched[a1] = p;
          next.scores[p]++;
          next.open = [];
          next.seen = next.seen.filter(function (k) { return k !== a0 && k !== a1; });
          next.last = { cards: [a0, a1], match: true, p: p };
          events.push({ e: 'match', cards: [a0, a1], p: p });
        } else {
          next.pending = true;
          next.turn = (p + 1) % next.n;
          next.last = { cards: [a0, a1], match: false, p: p };
          events.push({ e: 'miss', cards: [a0, a1], p: p });
        }
      }
      return { state: next, events: events };
    },
    /* Most pairs wins; ties share a place, and a tie for the first place is a draw (winner -1). */
    over: function (s) {
      for (var i = 0; i < s.matched.length; i++) if (s.matched[i] < 0) return null;
      var order = [], places = [], k;
      for (k = 0; k < s.n; k++) order.push(k);
      order.sort(function (a, b) { return s.scores[b] - s.scores[a] || a - b; });
      for (k = 0; k < order.length; k++) places[order[k]] = k > 0 && s.scores[order[k]] === s.scores[order[k - 1]] ? places[order[k - 1]] : k + 1;
      var tiedTop = order.length > 1 && s.scores[order[0]] === s.scores[order[1]];
      return { winner: tiedTop ? -1 : order[0], ranking: order, places: places, scores: s.scores.slice() };
    },
    /* Face down cards have no value in the view. The view is the same for every player. */
    view: function (s) {
      var v = copy(s);
      for (var i = 0; i < v.cards.length; i++) if (faceDown(s, i)) v.cards[i] = null;
      return v;
    },
    ai: function (s, p, level, rng) {
      var acts = legalFlips(s, p);
      if (!acts.length) return null;
      if (level <= 1) return rng.pick(acts);
      var known = remembered(s, level), legal = {}, i, j;
      acts.forEach(function (a) { legal[a.flip] = 1; });
      var unknown = acts.filter(function (a) { return known.indexOf(a.flip) < 0; });
      if (s.open.length === 1 && !s.pending) {
        // The second card: a remembered partner wins the pair, otherwise an unseen card is the better gamble.
        var first = s.open[0];
        for (i = 0; i < known.length; i++) if (known[i] !== first && legal[known[i]] && s.cards[known[i]] === s.cards[first]) return { flip: known[i] };
        return unknown.length ? rng.pick(unknown) : rng.pick(acts);
      }
      // The first card: a remembered pair is taken right away, otherwise an unseen card.
      for (i = 0; i < known.length; i++) for (j = i + 1; j < known.length; j++) {
        if (s.cards[known[i]] === s.cards[known[j]] && legal[known[i]]) return { flip: known[i] };
      }
      return unknown.length ? rng.pick(unknown) : rng.pick(acts);
    },
    ui: {
      mount: function (el, api) {
        var scoreBar = document.createElement('div'); scoreBar.className = 'me-scores';
        var grid = document.createElement('div'); grid.className = 'me-grid';
        var hint = document.createElement('div'); hint.className = 'me-hint';
        el.appendChild(scoreBar); el.appendChild(grid); el.appendChild(hint);
        var cards = [], view = null, info = null;
        function build(count) {
          grid.innerHTML = ''; cards = [];
          for (var i = 0; i < count; i++) {
            var c = document.createElement('div'); c.className = 'me-card'; c.dataset.i = i;
            c.innerHTML = '<div class="me-inner"><div class="me-face me-back"></div><div class="me-face me-front"></div></div>';
            grid.appendChild(c); cards.push(c);
          }
        }
        grid.onclick = function (ev) {
          var t = ev.target;
          while (t && t !== grid && !(t.classList && t.classList.contains('me-card'))) t = t.parentNode;
          if (!t || t === grid || !view || !info || !info.canAct) return;
          var i = +t.dataset.i;
          if (view.matched[i] >= 0) return;
          if (!view.pending && view.open.indexOf(i) >= 0) { api.toast(api.t('notOpen')); return; }
          api.act({ flip: i });
        };
        function columns(count) {
          var w = el.clientWidth || 360;
          if (w < 560) return 6;
          return count === 48 ? 8 : 10;
        }
        function render() {
          if (!view || !info) return;
          var v = view, ov = G.over(v), i;
          if (cards.length !== v.cards.length) build(v.cards.length);
          grid.style.gridTemplateColumns = 'repeat(' + columns(v.cards.length) + ',1fr)';
          for (i = 0; i < v.cards.length; i++) {
            var c = cards[i], val = v.cards[i], owner = v.matched[i];
            c.classList.toggle('up', val != null);
            c.classList.toggle('done', owner >= 0);
            c.classList.toggle('open', owner < 0 && v.open.indexOf(i) >= 0);
            c.querySelector('.me-front').textContent = val == null ? '' : val;
            c.style.setProperty('--pc', owner >= 0 ? info.colors[owner] : 'transparent');
          }
          scoreBar.innerHTML = '';
          for (i = 0; i < v.n; i++) {
            var sc = document.createElement('div'); sc.className = 'me-score' + (!ov && v.turn === i ? ' turn' : '') + (ov && ov.places[i] === 1 ? ' top' : '');
            sc.style.setProperty('--pc', info.colors[i]);
            var dot = document.createElement('i'); sc.appendChild(dot);
            var name = document.createElement('span'); name.textContent = info.names[i]; sc.appendChild(name);
            var num = document.createElement('b'); num.textContent = api.t(v.scores[i] === 1 ? 'pair' : 'pairs', v.scores[i]); sc.appendChild(num);
            scoreBar.appendChild(sc);
          }
          var text;
          if (ov) text = ov.winner < 0 ? api.t('tie') : ov.winner === info.me ? api.t('youWin') : api.t('wins', info.names[ov.winner]);
          else if (info.canAct) text = v.open.length === 1 && !v.pending ? api.t('second') : api.t('flipHint');
          else text = api.t('wait', info.names[v.turn]);
          hint.textContent = text;
        }
        var style = document.createElement('style');
        style.textContent = '.me-scores{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px}' +
          '.me-score{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:13px;border:2px solid transparent}' +
          '.me-score.turn{border-color:var(--pc);background:rgba(255,255,255,.14)}.me-score.top{box-shadow:0 0 0 2px #ffd54f}' +
          '.me-score i{width:12px;height:12px;border-radius:50%;background:var(--pc);display:inline-block}.me-score b{opacity:.85}' +
          '.me-grid{display:grid;gap:6px;max-width:720px;margin:0 auto}' +
          '.me-card{aspect-ratio:3/4;perspective:600px;cursor:pointer}' +
          '.me-inner{position:relative;width:100%;height:100%;transition:transform .45s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}' +
          '.me-card.up .me-inner{transform:rotateY(180deg)}' +
          '.me-face{position:absolute;inset:0;border-radius:10px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;align-items:center;justify-content:center}' +
          '.me-back{background:#3949ab;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 6px,transparent 6px 12px);box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),0 2px 6px rgba(0,0,0,.4)}' +
          '.me-card:hover .me-back{filter:brightness(1.15)}' +
          '.me-front{background:#fdfcf7;color:#222;transform:rotateY(180deg);font-size:clamp(20px,5vw,40px);box-shadow:inset 0 0 0 3px var(--pc),0 2px 6px rgba(0,0,0,.4)}' +
          '.me-card.done{cursor:default}.me-card.done .me-front{opacity:.75}.me-card.open .me-front{box-shadow:inset 0 0 0 3px #ffd54f,0 2px 6px rgba(0,0,0,.4)}' +
          '.me-card.won .me-inner{animation:mePulse .5s ease-out}@keyframes mePulse{0%{transform:rotateY(180deg) scale(1)}50%{transform:rotateY(180deg) scale(1.15)}100%{transform:rotateY(180deg) scale(1)}}' +
          '.me-hint{text-align:center;margin-top:12px;font-size:14px;opacity:.85;min-height:18px}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            render();
            (inf.events || []).forEach(function (e) {
              if (e.e === 'flip') api.sound('card');
              if (e.e === 'match') {
                e.cards.forEach(function (i) { var c = cards[i]; if (c) { c.classList.remove('won'); void c.offsetWidth; c.classList.add('won'); } });
                api.sound('capture');
                if (e.p !== inf.me) api.toast(api.t('matchOf', inf.names[e.p]));
              }
            });
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
