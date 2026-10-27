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
        /* Cards on a felt table in a wooden frame: kit card backs, faces with a thin inner frame and a big picture, a
           3D flip on turning, and found pairs flying to the owner's pile beside the table (above it on a phone). */
        var BACK = '#23508f';
        var layoutEl = document.createElement('div'); layoutEl.className = 'me-layout';
        var piles = document.createElement('div'); piles.className = 'me-piles';
        var table = document.createElement('div'); table.className = 'me-table gfx-felt gfx-frame';
        var grid = document.createElement('div'); grid.className = 'me-grid';
        table.appendChild(grid);
        var hint = document.createElement('div'); hint.className = 'me-hint';
        layoutEl.appendChild(piles); layoutEl.appendChild(table);
        el.appendChild(layoutEl); el.appendChild(hint);
        var cards = [], view = null, info = null, pileEls = [], holdUp = {}, timers = [], cw = 48;
        function build(count) {
          grid.innerHTML = ''; cards = [];
          for (var i = 0; i < count; i++) {
            var c = document.createElement('div'); c.className = 'me-card'; c.dataset.i = i;
            c.innerHTML = '<div class="me-slot"></div><div class="me-inner"><div class="me-face me-back">' + Gfx.cardBack(60, BACK) + '</div><div class="me-face me-front"><div class="me-frame"></div><span class="me-pic"></span></div></div>';
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
        function layout(count) {
          var w = el.clientWidth || 360, wide = w >= 640;
          layoutEl.classList.toggle('wide', wide);
          var cols = !wide ? 6 : count === 48 ? 8 : 10;
          grid.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
          cw = Math.max(30, Math.floor(((grid.clientWidth || 300) - (cols - 1) * 6) / cols));
          grid.style.setProperty('--cw', cw + 'px');
        }
        function pile(p, v, ov) {
          var d = document.createElement('div'); d.className = 'me-pile' + (!ov && v.turn === p ? ' turn' : '') + (ov && ov.places[p] === 1 ? ' top' : '');
          d.style.setProperty('--pc', info.colors[p]);
          var stack = document.createElement('div'); stack.className = 'me-stack' + (v.scores[p] ? '' : ' empty');
          var n = Math.min(v.scores[p], 4), html = '';
          for (var k = 0; k < n; k++) html += '<span style="left:' + (k * 3) + 'px;top:' + (-k * 3) + 'px">' + Gfx.cardBack(40, info.colors[p]) + '</span>';
          stack.innerHTML = html;
          var count = document.createElement('b'); count.className = 'me-count'; count.textContent = api.t(v.scores[p] === 1 ? 'pair' : 'pairs', v.scores[p]);
          var name = document.createElement('span'); name.className = 'me-name'; name.textContent = info.names[p];
          d.appendChild(stack); d.appendChild(count); d.appendChild(name);
          return { el: d, stack: stack };
        }
        /* A found card flies from its place on the table to the owner's pile. */
        function fly(i, p) {
          var c = cards[i], target = pileEls[p];
          if (!c || !target || !view) return;
          var from = c.getBoundingClientRect(), to = target.stack.getBoundingClientRect();
          if (!from.width || !to.width) return;
          var g = document.createElement('div'); g.className = 'me-fly';
          g.style.left = from.left + 'px'; g.style.top = from.top + 'px'; g.style.width = from.width + 'px'; g.style.height = from.height + 'px';
          g.style.setProperty('--cw', cw + 'px');
          g.innerHTML = '<div class="me-face me-front"><div class="me-frame"></div><span class="me-pic">' + (view.cards[i] || '') + '</span></div>';
          document.body.appendChild(g);
          void g.offsetWidth;
          g.style.transform = 'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px) scale(' + (to.width / from.width) + ',' + (to.height / from.height) + ') rotate(8deg)';
          g.style.opacity = '.85';
          timers.push(setTimeout(function () {
            if (g.parentNode) g.parentNode.removeChild(g);
            target.el.classList.remove('bump'); void target.el.offsetWidth; target.el.classList.add('bump');
          }, 620));
        }
        function render() {
          if (!view || !info) return;
          var v = view, ov = G.over(v), i;
          if (cards.length !== v.cards.length) build(v.cards.length);
          layout(v.cards.length);
          for (i = 0; i < v.cards.length; i++) {
            var c = cards[i], val = v.cards[i], owner = v.matched[i], held = holdUp[i] !== undefined;
            c.classList.toggle('up', val != null);
            c.classList.toggle('done', owner >= 0 && !held);
            c.classList.toggle('held', held);
            c.classList.toggle('open', owner < 0 && v.open.indexOf(i) >= 0);
            c.querySelector('.me-pic').textContent = val == null ? '' : val;
            c.style.setProperty('--pc', owner >= 0 ? info.colors[owner] : 'transparent');
          }
          piles.innerHTML = ''; pileEls = [];
          for (i = 0; i < v.n; i++) { var pe = pile(i, v, ov); piles.appendChild(pe.el); pileEls.push(pe); }
          var text;
          if (ov) text = ov.winner < 0 ? api.t('tie') : ov.winner === info.me ? api.t('youWin') : api.t('wins', info.names[ov.winner]);
          else if (info.canAct) text = v.open.length === 1 && !v.pending ? api.t('second') : api.t('flipHint');
          else text = api.t('wait', info.names[v.turn]);
          hint.textContent = text;
        }
        var style = document.createElement('style');
        style.textContent = '.me-layout{display:flex;flex-direction:column;gap:10px}.me-layout.wide{flex-direction:row;align-items:flex-start;gap:14px}' +
          '.me-piles{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.me-layout.wide .me-piles{flex-direction:column;flex:0 0 96px;flex-wrap:nowrap}' +
          '.me-pile{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 8px 6px;border-radius:12px;background:rgba(255,255,255,.06);border:2px solid transparent;min-width:76px;transition:box-shadow .3s,background .3s}' +
          '.me-pile.turn{border-color:var(--pc);background:rgba(255,255,255,.12);box-shadow:0 0 12px var(--pc)}.me-pile.top .me-count{box-shadow:0 0 0 2px #ffd54f}' +
          '.me-pile.bump{animation:meBump .3s ease-out}@keyframes meBump{50%{transform:scale(1.08)}}' +
          '.me-stack{position:relative;width:40px;height:56px;margin:4px 0 2px}.me-stack span{position:absolute;display:block;line-height:0}.me-stack svg{width:40px;height:56px;overflow:visible}' +
          '.me-stack.empty{border:2px dashed rgba(255,255,255,.3);border-radius:5px;box-sizing:border-box}' +
          '.me-count{font-weight:800;font-size:13px;color:var(--pc);background:rgba(0,0,0,.38);border-radius:999px;padding:2px 10px;white-space:nowrap}' +
          '.me-name{font-size:12px;opacity:.85;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
          '.me-table{flex:1 1 auto;min-width:0;padding:10px;border-radius:6px}' +
          '.me-grid{display:grid;gap:6px}' +
          '.me-card{position:relative;aspect-ratio:5/7;perspective:700px;cursor:pointer}' +
          '.me-slot{position:absolute;left:3px;top:3px;right:3px;bottom:3px;border-radius:7px;background:rgba(0,0,0,.2);box-shadow:inset 0 1px 3px rgba(0,0,0,.45)}' +
          '.me-inner{position:absolute;left:0;top:0;right:0;bottom:0;transition:transform .5s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}' +
          '.me-card.up .me-inner{transform:rotateY(180deg)}.me-card.done .me-inner{visibility:hidden}.me-card.done{cursor:default}' +
          '.me-face{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:7px;backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
          '.me-back svg{width:100%;height:100%;display:block;overflow:visible}' +
          '.me-front{transform:rotateY(180deg);background:#fdfbf5;box-shadow:0 2px 5px rgba(0,0,0,.45),inset 0 0 0 1px #cfc8b8;display:flex;align-items:center;justify-content:center;transition:box-shadow .3s}' +
          '.me-frame{position:absolute;left:5px;top:5px;right:5px;bottom:5px;border:1px solid #b8ad96;border-radius:4px;pointer-events:none}' +
          '.me-pic{font-size:calc(var(--cw) * .52);line-height:1}' +
          '.me-card.open .me-front{box-shadow:0 0 0 3px #ffd54f,0 2px 5px rgba(0,0,0,.45)}' +
          '.me-card.held .me-front{box-shadow:0 0 0 3px var(--pc),0 0 14px var(--pc)}' +
          '.me-fly{position:fixed;z-index:30;pointer-events:none;transition:transform .6s cubic-bezier(.5,.1,.3,1),opacity .6s;transform-origin:0 0;perspective:700px}' +
          '.me-fly .me-front{transform:none;border-radius:7px}' +
          '.me-hint{text-align:center;margin-top:12px;font-size:14px;opacity:.85;min-height:18px}';
        el.appendChild(style);
        var onResize = function () { render(); };
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            var evs = inf.events || [];
            evs.forEach(function (e) { if (e.e === 'match') e.cards.forEach(function (i) { holdUp[i] = e.p; }); });
            render();
            evs.forEach(function (e) {
              if (e.e === 'flip') api.sound('card');
              if (e.e === 'match') {
                api.sound('capture');
                if (e.p !== inf.me) api.toast(api.t('matchOf', inf.names[e.p]));
                timers.push(setTimeout(function () {
                  e.cards.forEach(function (i) { delete holdUp[i]; });
                  render();
                  e.cards.forEach(function (i) { fly(i, e.p); });
                }, 750));
              }
            });
          },
          destroy: function () {
            window.removeEventListener('resize', onResize);
            timers.forEach(function (t) { clearTimeout(t); });
            var flying = document.querySelectorAll('.me-fly');
            for (var k = 0; k < flying.length; k++) flying[k].parentNode.removeChild(flying[k]);
            el.innerHTML = '';
          }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
