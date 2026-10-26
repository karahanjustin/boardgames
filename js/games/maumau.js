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
      mount: function (el, api) {
        var wrap = h('div', 'mm'), table = h('div', 'mm-table'), others = h('div', 'mm-others'), mid = h('div', 'mm-mid'), hand = h('div', 'mm-hand'), bar = h('div', 'mm-bar');
        wrap.appendChild(others); wrap.appendChild(mid); wrap.appendChild(hand); wrap.appendChild(bar); table.appendChild(wrap); el.appendChild(table);
        function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
        function cardEl(c, small) { var d = h('div', 'mm-card' + (small ? ' small' : '') + (suit(c) === 'h' || suit(c) === 'd' ? ' red' : '')); d.innerHTML = '<b>' + rank(c) + '</b><i>' + SUIT_GLYPH[suit(c)] + '</i>'; return d; }
        var style = h('style'); style.textContent = '.mm{display:flex;flex-direction:column;gap:12px}.mm-others{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.mm-other{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.2);border:2px solid transparent;font-size:13px}.mm-other.on{border-color:var(--pc)}.mm-backs{display:flex}.mm-back{width:22px;height:32px;border-radius:4px;background:#a8322a repeating-linear-gradient(45deg,rgba(255,255,255,.18) 0 3px,transparent 3px 7px);margin-left:-12px;box-shadow:0 1px 2px #000}.mm-back:first-child{margin-left:0}' +
          '.mm-mid{display:flex;align-items:center;justify-content:center;gap:24px;min-height:110px}.mm-pile{position:relative}.mm-card{display:inline-flex;flex-direction:column;justify-content:space-between;width:62px;height:88px;border-radius:8px;background:#fff;color:#222;padding:6px;box-shadow:0 2px 6px rgba(0,0,0,.5);font-weight:800;cursor:pointer;transition:transform .12s;user-select:none}.mm-card.red{color:#d02030}.mm-card b{font-size:18px}.mm-card i{font-style:normal;font-size:26px;align-self:flex-end}.mm-card.small{width:48px;height:68px;padding:4px}.mm-card.small b{font-size:14px}.mm-card.small i{font-size:20px}' +
          '.mm-hand{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:96px}.mm-hand .mm-card.ok{box-shadow:0 0 0 3px #f2b632,0 2px 6px rgba(0,0,0,.5)}.mm-hand .mm-card.ok:hover{transform:translateY(-8px)}.mm-hand .mm-card.no{opacity:.55;cursor:default}.mm-draw{width:62px;height:88px;border-radius:8px;background:#a8322a repeating-linear-gradient(45deg,rgba(255,255,255,.18) 0 4px,transparent 4px 9px);box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;cursor:pointer;text-align:center;font-size:13px;padding:4px}.mm-draw.no{opacity:.5;cursor:default}.mm-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;min-height:34px;align-items:center}.mm-wish{font-weight:700}.mm-wishbtn{font-size:22px;width:48px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:#fff;color:#222;cursor:pointer}.mm-wishbtn.red{color:#d02030}';
        el.appendChild(style);
        var pendingJack = null;
        return {
          update: function (v, info) {
            var me = info.me, names = info.names;
            others.innerHTML = '';
            v.counts.forEach(function (n, i) { if (i === me) return; var o = h('div', 'mm-other' + (i === v.turn ? ' on' : '')); o.style.setProperty('--pc', info.colors[i]); var backs = h('div', 'mm-backs'); for (var k = 0; k < Math.min(n, 8); k++) backs.appendChild(h('div', 'mm-back')); o.appendChild(backs); o.appendChild(h('span', '', names[i] + ': ' + (n === 1 ? api.t('card') : api.t('cards', n)))); others.appendChild(o); });
            mid.innerHTML = '';
            var drawBtn = h('div', 'mm-draw' + (info.canAct ? '' : ' no'), v.pending > 0 ? api.t('drawN', v.pending) : api.t('draw'));
            drawBtn.onclick = function () { if (!info.canAct) return; if (v.drewThis != null) { api.act({ pass: true }); return; } api.act({ draw: true }); };
            if (v.drewThis != null && info.canAct) drawBtn.textContent = api.t('pass');
            mid.appendChild(drawBtn);
            var pile = h('div', 'mm-pile'); pile.appendChild(cardEl(v.pile[v.pile.length - 1])); mid.appendChild(pile);
            var side = h('div', ''); side.appendChild(h('div', '', api.t('pile', v.drawCount))); if (v.wish) side.appendChild(h('div', 'mm-wish', api.t('wished', api.t({ c: 'clubs', s: 'spades', h: 'hearts', d: 'diamonds' }[v.wish])) + ' ' + SUIT_GLYPH[v.wish])); mid.appendChild(side);
            hand.innerHTML = '';
            var mine = v.hands[me] || [], acts = {};
            if (info.canAct) { var hs = { hands: v.hands.map(function (x) { return x || []; }), pile: v.pile, turn: v.turn, wish: v.wish, pending: v.pending, drewThis: v.drewThis, out: v.out, ranking: v.ranking }; G.actions(hs, me).forEach(function (a) { if (a.play != null) acts[a.play] = true; }); }
            mine.forEach(function (c, i) {
              var d = cardEl(c); d.classList.add(acts[i] ? 'ok' : 'no');
              d.onclick = function () { if (!acts[i]) return; if (rank(c) === 'J') { pendingJack = i; renderBar(); return; } api.act({ play: i }); };
              hand.appendChild(d);
            });
            function renderBar() {
              bar.innerHTML = '';
              if (pendingJack != null) { bar.appendChild(h('span', 'mm-wish', api.t('wish'))); SUITS.forEach(function (w) { var b = h('button', 'mm-wishbtn' + (w === 'h' || w === 'd' ? ' red' : ''), SUIT_GLYPH[w]); b.onclick = function () { var i = pendingJack; pendingJack = null; api.act({ play: i, wish: w }); }; bar.appendChild(b); }); }
              else bar.appendChild(h('span', '', info.over ? '' : info.canAct ? api.t('play') : ''));
            }
            pendingJack = null; renderBar();
            (info.events || []).forEach(function (e) { if (e.e === 'mau') api.toast(names[e.p] + ': ' + api.t('mau')); else if (e.e === 'out') api.toast(names[e.p] + ': ' + api.t('maumau')); else if (e.e === 'skip') api.toast(api.t('skipped', names[e.p])); else if (e.e === 'draw' && e.n > 1) api.toast(api.t('drew', names[e.p], api.t('cards', e.n))); else if (e.e === 'card') api.sound('card'); });
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
