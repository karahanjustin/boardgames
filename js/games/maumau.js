/* Mau-Mau, the German card game, 2 to 6 players, hidden hands. The second reference game: hidden information
   (view hides the other hands and the draw pile), several players, cards. The rules as commonly played: 32 cards
   (7 to Ace in four suits), 5 cards each, play a card of the same suit or rank; 7 makes the next player draw two
   (stackable), 8 skips the next player, a Jack may be put on anything and the player wishes a suit (a Jack on a
   Jack is not allowed), an Ace lets you play again; a player who cannot play draws one card and may play it if it
   fits; the first to empty the hand wins, the rest are ranked by the cards left. */
(function (root) {
  'use strict';
  var SUITS = ['c', 's', 'h', 'd'], RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var SUIT_GLYPH = { c: '♣', s: '♠', h: '♥', d: '♦' };
  function deck() { var d = []; SUITS.forEach(function (s) { RANKS.forEach(function (r) { d.push(s + r); }); }); return d; }
  var suit = function (c) { return c.charAt(0); }, rank = function (c) { return c.slice(1); };
  function fits(s, c) {
    var top = s.pile[s.pile.length - 1];
    if (rank(c) === 'J') return rank(top) !== 'J';
    if (s.wish) return suit(c) === s.wish;
    return suit(c) === suit(top) || rank(c) === rank(top);
  }
  function refill(s) {
    if (s.draw.length) return;
    var top = s.pile.pop();
    s.draw = s.pile.slice(); s.pile = [top];
    // the discard pile turned into the draw pile, shuffled with a seed the host wrote in the state (no rng in hand here)
    var seed = s.shuffleSeed || 1; s.shuffleSeed = (seed * 1103515245 + 12345) >>> 0;
    var x = s.shuffleSeed; for (var i = s.draw.length - 1; i > 0; i--) { x = (x + 0x6D2B79F5) >>> 0; var t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); var j = (((t ^ (t >>> 14)) >>> 0) / 4294967296 * (i + 1)) | 0; var tmp = s.draw[i]; s.draw[i] = s.draw[j]; s.draw[j] = tmp; }
  }
  function drawOne(s, p) { refill(s); if (!s.draw.length) return null; var c = s.draw.pop(); s.hands[p].push(c); return c; }
  function nextPlayer(s, from, step) { var n = s.hands.length, p = from; for (var k = 0; k < (step || 1); k++) { do { p = (p + 1) % n; } while (s.out.indexOf(p) >= 0 && s.out.length < n - 1); } return p; }
  var G = {
    id: 'maumau',
    name: { de: 'Mau-Mau', en: 'Mau-Mau' },
    blurb: { de: 'Farbe oder Zahl bedienen, Buben wünschen, Siebener ärgern.', en: 'Match suit or rank; Jacks wish, sevens punish.' },
    icon: '🃏',
    counts: [2, 3, 4, 5, 6],
    ai: true,
    hidden: true,
    strings: {
      de: { rules: 'Jeder bekommt fünf Karten, eine liegt offen. Wer dran ist, legt eine Karte mit derselben Farbe oder demselben Wert. Eine 7 lässt den Nächsten zwei Karten ziehen (mehrere Siebener zählen zusammen). Eine 8 lässt den Nächsten aussetzen. Ein Bube darf auf alles gelegt werden und wünscht eine Farbe (nicht auf einen Buben). Nach einem Ass darf man noch einmal legen. Wer nicht legen kann, zieht eine Karte und darf sie legen, wenn sie passt. Wer zuerst keine Karten mehr hat, gewinnt; die anderen werden nach den Restkarten gereiht.', play: 'Karte antippen, um sie zu legen', draw: 'Karte ziehen', drawN: '{0} Karten ziehen', pass: 'Weiter', wish: 'Welche Farbe?', wished: 'Gewünscht: {0}', pile: 'Stapel: {0}', cards: '{0} Karten', card: '1 Karte', mau: 'Mau!', maumau: 'Mau-Mau!', drew: '{0} zieht {1}', skipped: '{0} setzt aus', clubs: 'Kreuz', spades: 'Pik', hearts: 'Herz', diamonds: 'Karo' },
      en: { rules: 'Everyone gets five cards, one card lies face up. On your turn, play a card of the same suit or the same rank. A 7 makes the next player draw two cards (several sevens add up). An 8 skips the next player. A Jack goes on anything and names a suit (not on a Jack). After an Ace you play again. If you cannot play, draw a card; if it fits you may play it. The first to shed all cards wins; the rest are ranked by the cards they hold.', play: 'Tap a card to play it', draw: 'Draw a card', drawN: 'Draw {0} cards', pass: 'Pass', wish: 'Which suit?', wished: 'Wished: {0}', pile: 'Pile: {0}', cards: '{0} cards', card: '1 card', mau: 'Mau!', maumau: 'Mau-Mau!', drew: '{0} draws {1}', skipped: '{0} is skipped', clubs: 'Clubs', spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds' }
    },
    create: function (cfg, rng) {
      var d = rng.shuffle(deck()), hands = [];
      for (var p = 0; p < cfg.n; p++) { hands.push([]); for (var k = 0; k < 5; k++) hands[p].push(d.pop()); }
      var first = d.pop();
      while (rank(first) === 'J') { d.unshift(first); first = d.pop(); }
      var s = { hands: hands, draw: d, pile: [first], turn: 0, wish: null, pending: 0, drewThis: null, out: [], ranking: [], shuffleSeed: rng.int(1e9), again: false };
      // a 7 or 8 as the first card works on the first player; keep it simple: the first card has no effect
      return s;
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      var out = [], hand = s.hands[p];
      if (s.pending > 0) {
        // a seven is waiting: play a seven on it or draw the stack
        hand.forEach(function (c, i) { if (rank(c) === '7') out.push({ play: i }); });
        out.push({ draw: true });
        return out;
      }
      hand.forEach(function (c, i) {
        if (!fits(s, c)) return;
        if (s.drewThis != null && i !== s.drewThis) return; // after drawing only the drawn card may go
        if (rank(c) === 'J') SUITS.forEach(function (w) { out.push({ play: i, wish: w }); }); else out.push({ play: i });
      });
      if (s.drewThis == null) out.push({ draw: true }); else out.push({ pass: true });
      return out;
    },
    apply: function (s0, p, a, rng) {
      var s = JSON.parse(JSON.stringify(s0)), ev = [], n = s.hands.length;
      s.again = false;
      if (a.draw) {
        var k = s.pending > 0 ? s.pending : 1, drawn = [];
        for (var i = 0; i < k; i++) { var c = drawOne(s, p); if (c) drawn.push(c); }
        ev.push({ e: 'draw', p: p, n: drawn.length });
        if (s.pending > 0) { s.pending = 0; s.drewThis = null; s.turn = nextPlayer(s, p); return { state: s, events: ev }; }
        s.drewThis = s.hands[p].length - 1;
        // the drawn card may be played if it fits; if it cannot, the turn passes at once
        if (!drawn.length || !fits(s, drawn[0]) || (rank(drawn[0]) === 'J' && rank(s.pile[s.pile.length - 1]) === 'J')) { s.drewThis = null; s.turn = nextPlayer(s, p); }
        return { state: s, events: ev };
      }
      if (a.pass) { s.drewThis = null; s.turn = nextPlayer(s, p); return { state: s, events: ev }; }
      var card = s.hands[p].splice(a.play, 1)[0];
      s.pile.push(card); s.drewThis = null; s.wish = null;
      ev.push({ e: 'card', p: p, card: card });
      var r = rank(card);
      if (r === 'J') { s.wish = a.wish || SUITS[0]; ev.push({ e: 'wish', p: p, suit: s.wish }); }
      if (!s.hands[p].length) {
        s.out.push(p); s.ranking.push(p);
        ev.push({ e: 'out', p: p });
        if (s.out.length >= n - 1) {
          var rest = []; for (var q = 0; q < n; q++) if (s.out.indexOf(q) < 0) rest.push(q);
          rest.sort(function (x, y) { return s.hands[x].length - s.hands[y].length; });
          s.ranking = s.ranking.concat(rest);
          return { state: s, events: ev };
        }
      }
      if (s.hands[p].length === 1) ev.push({ e: 'mau', p: p });
      if (r === '7') { s.pending += 2; s.turn = nextPlayer(s, p); }
      else if (r === '8') { var sk = nextPlayer(s, p); ev.push({ e: 'skip', p: sk }); s.turn = nextPlayer(s, sk); }
      else if (r === 'A' && s.hands[p].length) { s.again = true; s.turn = p; }
      else s.turn = nextPlayer(s, p);
      if (s.out.indexOf(s.turn) >= 0) s.turn = nextPlayer(s, s.turn);
      return { state: s, events: ev };
    },
    over: function (s) {
      var n = s.hands.length;
      if (s.out.length >= n - 1 && s.ranking.length === n) return { winner: s.ranking[0], ranking: s.ranking };
      if (n === 2 && s.out.length === 1) return { winner: s.out[0], ranking: [s.out[0], 1 - s.out[0]] };
      return null;
    },
    view: function (s, p) {
      var v = JSON.parse(JSON.stringify(s));
      v.counts = s.hands.map(function (hd) { return hd.length; });
      v.hands = s.hands.map(function (hd, i) { return i === p ? hd : null; });
      v.drawCount = s.draw.length; delete v.draw; delete v.shuffleSeed;
      return v;
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p), plays = acts.filter(function (a) { return a.play != null; });
      if (!plays.length) return acts[0];
      if (level === 1) return rng.pick(plays);
      var hand = s.hands[p];
      // what the others hold: the suits in my hand I can keep playing, the sevens against the next player's short hand
      var bySuit = {}; hand.forEach(function (c) { bySuit[suit(c)] = (bySuit[suit(c)] || 0) + 1; });
      var next = nextPlayer(s, p), nextShort = s.hands[next].length <= 2;
      var best = null, bv = -1e9;
      plays.forEach(function (a) {
        var c = hand[a.play], r = rank(c), v = rng.next() * 0.3;
        if (r === '7') v += nextShort ? 6 : 3;
        if (r === '8') v += nextShort ? 5 : 2;
        if (r === 'A') v += 4;
        if (r === 'J') { v += level === 3 ? -1 : 0; v += (bySuit[a.wish] || 0) * 2; if (hand.length === 1) v += 10; }
        else v += (bySuit[suit(c)] || 0) * 0.8;
        if (level === 3 && hand.length === 2 && r !== 'J') { var other = hand[1 - a.play]; if (rank(other) === rank(c) || suit(other) === suit(c) || rank(other) === 'J') v += 3; }
        if (v > bv) { bv = v; best = a; }
      });
      return best;
    },
    ui: {
      /* The table: a green felt in a dark wooden rail. The other players sit along the top with fanned backs, the
         draw pile (a stack of backs) and the discard pile (faces thrown at slightly random angles) lie in the
         middle, the wished suit stands beside the pile as a small card, and the own hand is fanned along the bottom
         with the playable cards lifted. Cards fly between hand and piles on every play and draw. */
      mount: function (el, api) {
        var Gfx = root.Gfx;
        function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function hash(str) { var x = 7; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }
        /* A small card that shows nothing but a suit: the wish beside the pile and the four buttons of the chooser. */
        function suitCard(s, size) {
          var col = s === 'h' || s === 'd' ? '#c8202a' : '#1d1a17', g = SUIT_GLYPH[s];
          return '<svg class="gfx gfx-card" width="' + size + '" height="' + (size * 1.4) + '" viewBox="0 0 60 84" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="58" height="82" rx="6" fill="rgba(0,0,0,0.28)"/><rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="#fdfbf5" stroke="#cfc8b8"/><text x="5" y="16" font-size="12" fill="' + col + '">' + g + '</text><g transform="rotate(180 30 42)"><text x="5" y="16" font-size="12" fill="' + col + '">' + g + '</text></g><text x="30" y="58" text-anchor="middle" font-size="44" fill="' + col + '">' + g + '</text></svg>';
        }
        var rail = h('div', 'mm-rail gfx-wood-dark'), table = h('div', 'mm-table gfx-felt'), seats = h('div', 'mm-seats'), mid = h('div', 'mm-mid'), handZone = h('div', 'mm-handzone'), bar = h('div', 'mm-bar'), fx = h('div', 'mm-fx');
        rail.appendChild(table); table.appendChild(seats); table.appendChild(mid); table.appendChild(handZone); table.appendChild(bar); table.appendChild(fx); el.appendChild(rail);
        var style = h('style');
        style.textContent = '.mm-rail{border-radius:26px;padding:10px;box-shadow:0 14px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 0 rgba(0,0,0,.4)}' +
          '.mm-table{position:relative;border-radius:16px;padding:10px 8px 8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),inset 0 0 90px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:8px;color:#fff;user-select:none;-webkit-user-select:none}' +
          '.mm-seats{display:flex;gap:6px;justify-content:center;align-items:flex-end}.mm-seat{flex:1 1 0;min-width:0;max-width:150px;display:flex;flex-direction:column;align-items:center;gap:3px;transition:opacity .3s}.mm-seat.out{opacity:.45}' +
          '.mm-fan{position:relative;margin:0 auto}.mm-fancard{position:absolute;bottom:0;transform-origin:50% 100%}' +
          '.mm-name{display:flex;flex-direction:column;align-items:center;font-size:11px;line-height:1.2;max-width:100%;padding:3px 8px;border-radius:11px;background:rgba(0,0,0,.4);border:2px solid var(--pc);text-align:center;box-sizing:border-box}.mm-name b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
          '.mm-seat.on .mm-name{box-shadow:0 0 0 2px rgba(255,255,255,.9),0 0 16px var(--pc);background:rgba(0,0,0,.55)}' +
          '.mm-mid{display:flex;align-items:flex-start;justify-content:center;padding-top:4px}.mm-pile{position:relative;flex:none}.mm-stackcard{position:absolute;left:0;top:0;transform-origin:50% 50%}' +
          '.mm-drawpile{cursor:default}.mm-drawpile.hot{cursor:pointer}.mm-ring{position:absolute;left:-5px;top:-5px;right:-5px;bottom:-5px;border-radius:9px;box-shadow:0 0 0 3px #f2b632,0 0 18px #f2b632;opacity:0;transition:opacity .25s;pointer-events:none}.mm-drawpile.hot .mm-ring{opacity:1}' +
          '.mm-slot{position:absolute;left:1px;top:1px;right:1px;bottom:1px;border-radius:7px;border:2px dashed rgba(255,255,255,.35)}' +
          '.mm-count{position:absolute;left:50%;top:100%;margin-top:8px;transform:translateX(-50%);font-size:11px;white-space:nowrap;background:rgba(0,0,0,.45);padding:2px 8px;border-radius:9px}' +
          '.mm-wishslot{display:flex;align-items:center;justify-content:center}.mm-wish{animation:mmpop .3s ease-out}@keyframes mmpop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}' +
          '.mm-handzone{position:relative}.mm-hcard{position:absolute;transform-origin:50% 100%;transition:transform .18s}.mm-hcard.ok{cursor:pointer}.mm-hcard.ok svg{filter:drop-shadow(0 0 2px #f2b632) drop-shadow(0 0 5px rgba(242,182,50,.9))}.mm-hcard.sel svg{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 8px #f2b632)}' +
          '.mm-bar{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;min-height:50px}.mm-hint{font-size:13px;opacity:.92;text-shadow:0 1px 2px rgba(0,0,0,.6);text-align:center}' +
          '.mm-btn{min-height:44px;padding:0 20px;border-radius:22px;border:0;background:linear-gradient(#ffd45a,#e9a820);color:#2a1a05;font-weight:800;font-size:15px;box-shadow:0 3px 0 #9a6a10,0 5px 10px rgba(0,0,0,.45);cursor:pointer}.mm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #9a6a10}' +
          '.mm-suitbtn{height:54px;width:42px;padding:0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center}.mm-suitbtn:active{transform:translateY(2px)}' +
          '.mm-fx{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:60;overflow:visible}.mm-fly{position:absolute;transform-origin:50% 50%}';
        el.appendChild(style);
        var view = null, info = null, pendingJack = null, prevHand = null, prevRects = null, prevMe = -2, first = true, W = 320, cw = 60, ch = 84;
        var cardEls = [], seatEls = [], drawPile = null, topCardEl = null;
        function measure() { W = Math.max(290, (el.clientWidth || 360) - 38); cw = Math.max(48, Math.min(84, Math.floor(W / 7.5))); ch = Math.round(cw * 1.4); }
        function rectOf(e) { var r = e.getBoundingClientRect(), t = table.getBoundingClientRect(); return { left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }; }
        /* Lets an element that is already in its final place arrive there from a given rectangle (a FLIP move). */
        function flip(e, from, ms, delay, fromTf) {
          var to = rectOf(e), base = e.getAttribute('data-tf') || '';
          var dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
          e.style.transition = 'none'; e.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (fromTf || '');
          void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms'; e.style.transform = base;
        }
        /* A loose card that flies from one rectangle to another and vanishes (a back going to another player). */
        function fly(html, from, to, ms, delay) {
          var e = h('div', 'mm-fly', html); e.style.left = from.left + 'px'; e.style.top = from.top + 'px'; e.style.width = from.width + 'px'; e.style.height = from.height + 'px';
          fx.appendChild(e); void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms, opacity 160ms ' + ((delay || 0) + ms - 120) + 'ms';
          e.style.transform = 'translate(' + (to.left + to.width / 2 - from.left - from.width / 2).toFixed(1) + 'px,' + (to.top + to.height / 2 - from.top - from.height / 2).toFixed(1) + 'px) scale(' + (to.width / from.width).toFixed(3) + ')';
          e.style.opacity = '0';
          setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, ms + (delay || 0) + 80);
        }
        function playable() {
          var v = view, acts = {};
          if (!info.canAct || info.me < 0 || !v.hands[info.me]) return acts;
          var hs = { hands: v.hands.map(function (x) { return x || []; }), pile: v.pile, turn: v.turn, wish: v.wish, pending: v.pending, drewThis: v.drewThis, out: v.out, ranking: v.ranking };
          G.actions(hs, info.me).forEach(function (a) { if (a.play != null) acts[a.play] = true; });
          return acts;
        }
        function render(animate) {
          var v = view, inf = info, me = inf.me, names = inf.names, n = v.counts.length, i, k, c;
          prevRects = me === prevMe ? cardEls.map(rectOf) : null;
          measure();
          /* the other players along the top */
          seats.innerHTML = ''; seatEls = [];
          var bw = Math.round(cw * 0.46), bh = Math.round(bw * 1.4);
          for (i = 0; i < n; i++) {
            if (i === me) { seatEls.push(null); continue; }
            var cnt = v.counts[i], s = h('div', 'mm-seat' + (i === v.turn && !inf.over ? ' on' : '') + (v.out.indexOf(i) >= 0 ? ' out' : ''));
            s.style.setProperty('--pc', inf.colors[i]);
            var fanN = Math.min(cnt, 7), fan = h('div', 'mm-fan'); fan.style.width = Math.round(bw * 2.4) + 'px'; fan.style.height = (bh + 8) + 'px';
            for (k = 0; k < fanN; k++) { c = h('div', 'mm-fancard', Gfx.cardBack(bw)); var off = k - (fanN - 1) / 2; c.style.left = Math.round(bw * 0.7 + off * bw * 0.3) + 'px'; c.style.transform = 'rotate(' + (off * 9) + 'deg)'; fan.appendChild(c); }
            s.appendChild(fan);
            s.appendChild(h('div', 'mm-name', '<b>' + esc(names[i]) + '</b><span>' + (cnt === 1 ? api.t('card') : api.t('cards', cnt)) + '</span>'));
            seats.appendChild(s); seatEls.push(s);
          }
          /* the piles in the middle: a stack of backs, the thrown discards, the wished suit */
          mid.innerHTML = ''; mid.style.height = (ch + 34) + 'px'; mid.style.gap = Math.round(cw * 0.4) + 'px';
          var canDraw = inf.canAct && v.drewThis == null;
          drawPile = h('div', 'mm-pile mm-drawpile' + (canDraw ? ' hot' : '')); drawPile.style.width = cw + 'px'; drawPile.style.height = ch + 'px';
          var layers = v.drawCount ? Math.min(6, Math.ceil(v.drawCount / 5)) : 0;
          if (!layers) drawPile.appendChild(h('div', 'mm-slot'));
          for (k = 0; k < layers; k++) { c = h('div', 'mm-stackcard', Gfx.cardBack(cw)); c.style.left = (-k * 1.7).toFixed(1) + 'px'; c.style.top = (-k * 1.7).toFixed(1) + 'px'; drawPile.appendChild(c); }
          drawPile.appendChild(h('div', 'mm-ring'));
          drawPile.appendChild(h('div', 'mm-count', api.t('pile', v.drawCount)));
          drawPile.onclick = function () { if (!info.canAct || view.drewThis != null) return; api.act({ draw: true }); };
          var disc = h('div', 'mm-pile mm-discard'); disc.style.width = cw + 'px'; disc.style.height = ch + 'px';
          topCardEl = null;
          for (k = Math.max(0, v.pile.length - 7); k < v.pile.length; k++) {
            var cid = v.pile[k], hs = hash(cid + ':' + k), tf = 'translate(' + ((hs >> 4) % 7 - 3) + 'px,' + ((hs >> 8) % 7 - 3) + 'px) rotate(' + ((hs % 29) - 14) + 'deg)';
            c = h('div', 'mm-stackcard', Gfx.card(rank(cid), suit(cid), cw)); c.setAttribute('data-tf', tf); c.style.transform = tf; disc.appendChild(c); topCardEl = c;
          }
          var wishSlot = h('div', 'mm-wishslot'); wishSlot.style.width = Math.round(cw * 0.62) + 'px'; wishSlot.style.height = ch + 'px';
          if (v.wish) wishSlot.appendChild(h('div', 'mm-wish', suitCard(v.wish, Math.round(cw * 0.62))));
          mid.appendChild(drawPile); mid.appendChild(disc); mid.appendChild(wishSlot);
          /* the own hand, fanned */
          handZone.innerHTML = ''; cardEls = [];
          var mine = (me >= 0 && v.hands[me]) || [], acts = playable(), nH = mine.length;
          var lift = Math.round(cw * 0.3), step = nH > 1 ? Math.min(cw * 0.72, (W - cw - 6) / (nH - 1)) : 0, x0 = (W - (cw + step * (nH - 1))) / 2;
          handZone.style.height = (ch + lift + 16) + 'px';
          mine.forEach(function (cid, i) {
            var off = i - (nH - 1) / 2, ang = off * Math.min(4, 36 / Math.max(nH, 1)), bow = Math.abs(off) * Math.min(3, 24 / Math.max(nH, 1)), ok = !!acts[i], sel = pendingJack === i;
            var d = h('div', 'mm-hcard' + (ok ? ' ok' : '') + (sel ? ' sel' : ''), Gfx.card(rank(cid), suit(cid), cw, { dim: inf.canAct && !ok }));
            d.style.left = Math.round(x0 + i * step) + 'px'; d.style.top = Math.round(lift + 8 + bow) + 'px'; d.style.zIndex = sel ? 50 : 10 + i;
            var tf = 'rotate(' + ang.toFixed(2) + 'deg) translateY(' + (sel ? -lift - 8 : ok ? -Math.round(lift * 0.55) : 0) + 'px)';
            d.setAttribute('data-tf', tf); d.style.transform = tf;
            d.onclick = function () { if (!acts[i] || !info.canAct) return; if (rank(cid) === 'J') { pendingJack = pendingJack === i ? null : i; render(false); return; } api.act({ play: i }); };
            handZone.appendChild(d); cardEls.push(d);
          });
          /* the bar: the draw or pass button, the suit chooser, the hints, the result */
          bar.innerHTML = '';
          var ov = inf.over;
          if (ov) bar.appendChild(h('div', 'mm-hint', esc(names[ov.winner]) + ': ' + api.t('maumau')));
          else if (pendingJack != null) {
            bar.appendChild(h('span', 'mm-hint', api.t('wish')));
            SUITS.forEach(function (w) { var b = h('button', 'mm-suitbtn', suitCard(w, 36)); b.onclick = function () { var i = pendingJack; pendingJack = null; api.act({ play: i, wish: w }); }; bar.appendChild(b); });
          } else if (inf.canAct) {
            var b = h('button', 'mm-btn', v.drewThis != null ? api.t('pass') : v.pending > 0 ? api.t('drawN', v.pending) : api.t('draw'));
            b.onclick = function () { if (!info.canAct) return; api.act(view.drewThis != null ? { pass: true } : { draw: true }); };
            bar.appendChild(b);
            if (Object.keys(acts).length) bar.appendChild(h('span', 'mm-hint', api.t('play')));
          } else bar.appendChild(h('span', 'mm-hint', v.turn >= 0 ? api.t('wait', names[v.turn]) : ''));
          /* the moves of the last apply, animated */
          var pileRect = rectOf(drawPile);
          (animate ? (inf.events || []) : []).forEach(function (e) {
            if (e.e === 'card' && topCardEl) {
              var src = null;
              if (e.p === me && prevRects && prevHand) { var idx = prevHand.indexOf(e.card); if (idx >= 0 && prevRects[idx]) src = prevRects[idx]; }
              if (!src && seatEls[e.p]) src = rectOf(seatEls[e.p].firstChild);
              if (src) flip(topCardEl, src, 320, 0, 'rotate(0deg)');
            } else if (e.e === 'draw') {
              if (e.p === me) { for (k = Math.max(0, cardEls.length - e.n); k < cardEls.length; k++) flip(cardEls[k], pileRect, 320, (k - (cardEls.length - e.n)) * 90, 'rotate(0deg)'); }
              else if (seatEls[e.p]) for (k = 0; k < Math.min(e.n, 4); k++) fly(Gfx.cardBack(cw), pileRect, rectOf(seatEls[e.p].firstChild), 340, k * 90);
            }
          });
          if (first && animate) { first = false; cardEls.forEach(function (d, k) { flip(d, pileRect, 300, k * 70, 'rotate(0deg)'); }); if (topCardEl) flip(topCardEl, pileRect, 300, cardEls.length * 70, 'rotate(0deg)'); }
          prevHand = mine.slice(); prevMe = me;
        }
        function onResize() { if (view && info) render(false); }
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf; pendingJack = null;
            render(true);
            (inf.events || []).forEach(function (e) { if (e.e === 'mau') api.toast(inf.names[e.p] + ': ' + api.t('mau')); else if (e.e === 'out') api.toast(inf.names[e.p] + ': ' + api.t('maumau')); else if (e.e === 'skip') api.toast(api.t('skipped', inf.names[e.p])); else if (e.e === 'draw' && e.n > 1) api.toast(api.t('drew', inf.names[e.p], api.t('cards', e.n))); else if (e.e === 'card') api.sound('card'); });
          },
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
