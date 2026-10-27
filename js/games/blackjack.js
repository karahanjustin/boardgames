/* Black Jack (17 und 4 style): everyone plays against the dealer, which the rules play themselves. Two cards each,
   the dealer shows one, hit, stand or double on the first two cards, blackjack pays 3 to 2, the dealer draws to 17
   and stands on soft 17. Five rounds with a fixed bet of 10 from 100 chips, the most chips win. */
(function (root) {
  'use strict';
  var ROUNDS = 5, BET = 10, START = 100;
  /* A card is 0..51: the rank is card % 13 (0 is the ace, 9 the ten, 10 to 12 the pictures), the suit card / 13. */
  function rank(c) { return c % 13; }
  function suit(c) { return Math.floor(c / 13); }
  function cardValue(c) { var r = rank(c); return r === 0 ? 11 : r >= 9 ? 10 : r + 1; }
  function handValue(cards) {
    var total = 0, aces = 0;
    for (var i = 0; i < cards.length; i++) { var v = cardValue(cards[i]); total += v; if (v === 11) aces++; }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 };
  }
  function isBlackjack(cards) { return cards.length === 2 && handValue(cards).total === 21; }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  function firstOpen(s, from) { for (var i = from; i < s.n; i++) if (s.status[i] === 'play') return i; return -1; }
  /* Deals a fresh round into the state (which is already a copy): a new shuffled deck, two cards each, one for the
     dealer, blackjacks marked at once. */
  function deal(s, rng, ev) {
    var deck = []; for (var c = 0; c < 52; c++) deck.push(c);
    rng.shuffle(deck);
    s.deck = deck; s.hands = []; s.dealer = []; s.status = []; s.bets = []; s.results = []; s.phase = 'play';
    for (var i = 0; i < s.n; i++) { s.hands.push([deck.pop(), deck.pop()]); s.bets.push(BET); s.results.push(null); s.status.push('play'); }
    s.dealer.push(deck.pop());
    for (i = 0; i < s.n; i++) if (isBlackjack(s.hands[i])) s.status[i] = 'bj';
    ev.push({ e: 'deal', round: s.round });
    s.turn = firstOpen(s, 0);
    if (s.turn < 0) dealerPlays(s, ev);
  }
  /* The dealer takes the hidden second card and draws to 17, then every hand is settled. */
  function dealerPlays(s, ev) {
    var anyLive = false, i;
    for (i = 0; i < s.n; i++) if (s.status[i] === 'stand' || s.status[i] === 'bj') anyLive = true;
    s.dealer.push(s.deck.pop()); ev.push({ e: 'dealer', c: s.dealer[s.dealer.length - 1] });
    if (anyLive) {
      while (handValue(s.dealer).total < 17 && s.deck.length) { s.dealer.push(s.deck.pop()); ev.push({ e: 'dealer', c: s.dealer[s.dealer.length - 1] }); }
    }
    var dv = handValue(s.dealer).total, dbj = isBlackjack(s.dealer);
    for (i = 0; i < s.n; i++) {
      var st = s.status[i], bet = s.bets[i], pv = handValue(s.hands[i]).total, delta;
      if (st === 'bj') delta = dbj ? 0 : Math.floor(bet * 1.5);
      else if (st === 'bust') delta = -bet;
      else if (dbj) delta = -bet;
      else if (dv > 21) delta = bet;
      else if (pv > dv) delta = bet;
      else if (pv < dv) delta = -bet;
      else delta = 0;
      s.results[i] = delta; s.chips[i] += delta;
    }
    s.turn = -1;
    s.phase = s.round >= ROUNDS ? 'over' : 'settled';
    ev.push({ e: 'settle', results: s.results.slice(), dealer: dv });
  }
  function canDouble(s, p) { return s.hands[p].length === 2 && s.chips[p] >= 2 * BET; }
  /* Basic strategy without splits: hard and soft totals against the dealer's up card. */
  function basic(hand, up, dbl) {
    var hv = handValue(hand), t = hv.total;
    if (hv.soft) {
      if (t >= 19) return 'stand';
      if (t === 18) { if (up >= 3 && up <= 6) return dbl ? 'double' : 'stand'; return up <= 8 ? 'stand' : 'hit'; }
      if (t === 17) return up >= 3 && up <= 6 && dbl ? 'double' : 'hit';
      if (t >= 15) return up >= 4 && up <= 6 && dbl ? 'double' : 'hit';
      return up >= 5 && up <= 6 && dbl ? 'double' : 'hit';
    }
    if (t >= 17) return 'stand';
    if (t >= 13) return up <= 6 ? 'stand' : 'hit';
    if (t === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
    if (t === 11) return dbl ? 'double' : 'hit';
    if (t === 10) return dbl && up <= 9 ? 'double' : 'hit';
    if (t === 9) return dbl && up >= 3 && up <= 6 ? 'double' : 'hit';
    return 'hit';
  }
  var G = {
    id: 'blackjack',
    name: { de: 'Black Jack', en: 'Black Jack' },
    blurb: { de: 'Näher an 21 als die Bank, fünf Runden um Chips.', en: 'Closer to 21 than the dealer, five rounds for chips.' },
    icon: '🃏',
    counts: [1, 2, 3, 4, 5, 6],
    ai: true,
    hidden: false,
    strings: {
      de: {
        hit: 'Karte', stand: 'Halten', double: 'Verdoppeln', next: 'Nächste Runde', dealer: 'Bank', chips: '{0} Chips', bet: 'Einsatz {0}', round: 'Runde {0} von {1}',
        bust: 'Zu viel', bj: 'Black Jack', standing: 'hält', push: 'Unentschieden', won: '+{0}', lost: '{0}', yourMove: 'Karte, halten oder verdoppeln?', waitDealer: 'Die Bank zieht',
        ranks: 'A,2,3,4,5,6,7,8,9,10,B,D,K', nextHint: '{0} startet die nächste Runde', final: 'Endstand: {0} mit {1} Chips',
        rules: 'Alle spielen gegen die Bank. Jeder setzt 10 Chips und bekommt zwei Karten, die Bank zeigt eine. Wer dran ist, nimmt Karten, hält oder verdoppelt mit den ersten beiden Karten den Einsatz für genau eine Karte. Über 21 ist verloren. Dann zieht die Bank bis mindestens 17 und bleibt auf einer weichen 17 stehen. Näher an 21 als die Bank gewinnt den Einsatz, ein Black Jack (Ass und Zehnerkarte) bringt das Anderthalbfache, Gleichstand ist ein Unentschieden. Nach fünf Runden gewinnt, wer die meisten Chips hat.'
      },
      en: {
        hit: 'Hit', stand: 'Stand', double: 'Double', next: 'Next round', dealer: 'Dealer', chips: '{0} chips', bet: 'Bet {0}', round: 'Round {0} of {1}',
        bust: 'Bust', bj: 'Black Jack', standing: 'stands', push: 'Push', won: '+{0}', lost: '{0}', yourMove: 'Hit, stand or double?', waitDealer: 'The dealer draws',
        ranks: 'A,2,3,4,5,6,7,8,9,10,J,Q,K', nextHint: '{0} starts the next round', final: 'Final: {0} with {1} chips',
        rules: 'Everyone plays against the dealer. Each player bets 10 chips and gets two cards, the dealer shows one. On your turn you hit, stand, or double your bet on the first two cards for exactly one more card. Over 21 loses. Then the dealer draws to at least 17 and stands on a soft 17. Closer to 21 than the dealer wins the bet, a blackjack (ace and a ten card) pays one and a half times, a tie is a push. After five rounds the most chips win.'
      }
    },
    create: function (cfg, rng) {
      var s = { n: cfg.n, round: 1, chips: [], hands: [], dealer: [], deck: [], status: [], bets: [], results: [], turn: -1, phase: 'play' };
      for (var i = 0; i < cfg.n; i++) s.chips.push(START);
      deal(s, rng, []);
      return s;
    },
    current: function (s) { return s.phase === 'play' ? s.turn : s.phase === 'settled' ? 0 : -1; },
    actions: function (s, p) {
      if (s.phase === 'settled') return p === 0 ? [{ next: true }] : [];
      if (s.phase !== 'play' || s.turn !== p) return [];
      var out = [{ hit: true }, { stand: true }];
      if (canDouble(s, p)) out.push({ double: true });
      return out;
    },
    apply: function (s, p, a, rng) {
      var next = copy(s), ev = [];
      if (a.next) { next.round = s.round + 1; deal(next, rng, ev); return { state: next, events: ev }; }
      var hand = next.hands[p];
      if (a.hit || a.double) {
        if (a.double) { next.bets[p] = 2 * BET; ev.push({ e: 'double', p: p }); }
        var c = next.deck.pop(); hand.push(c); ev.push({ e: 'card', p: p, c: c });
        var t = handValue(hand).total;
        if (t > 21) { next.status[p] = 'bust'; ev.push({ e: 'bust', p: p }); }
        else if (t === 21 || a.double) next.status[p] = 'stand';
      } else if (a.stand) {
        next.status[p] = 'stand';
      }
      if (next.status[p] === 'play') return { state: next, events: ev };
      next.turn = firstOpen(next, p + 1);
      if (next.turn < 0) dealerPlays(next, ev);
      return { state: next, events: ev };
    },
    over: function (s) {
      if (s.phase !== 'over') return null;
      var order = [];
      for (var i = 0; i < s.n; i++) order.push(i);
      order.sort(function (a, b) { return s.chips[b] - s.chips[a] || a - b; });
      var winner = s.n === 1 ? (s.chips[0] > START ? 0 : -1) : (s.chips[order[0]] > s.chips[order[1]] ? order[0] : -1);
      return { winner: winner, ranking: order, chips: s.chips.slice() };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (s.phase === 'settled') return acts[0];
      var hand = s.hands[p], up = cardValue(s.dealer[0]);
      if (level === 1) return handValue(hand).total < 15 ? { hit: true } : { stand: true };
      if (level === 2 && rng.next() < 0.25) return rng.pick(acts);
      var move = basic(hand, up, canDouble(s, p));
      return move === 'double' ? { double: true } : move === 'hit' ? { hit: true } : { stand: true };
    },
    ui: {
      /* The table: a casino felt with a rounded front edge in a dark wooden rail. The dealer's cards lie at the
         top centre, the shoe stands at the top right, the seats sit along the curved front edge with their cards
         fanned, their chips stacked and their totals on small badges. Cards slide out of the shoe when dealt, the
         dealer's hidden card is a back that turns over, a busted hand goes dim, and Hit, Stand and Double are big
         round buttons. */
      mount: function (el, api) {
        var Gfx = root.Gfx, SUITCODE = ['s', 'h', 'd', 'c'];
        function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function cardSvg(c, size, dim) { var ranks = api.t('ranks').split(','); return Gfx.card(ranks[rank(c)], SUITCODE[suit(c)], size, { dim: dim }); }
        /* A casino chip: the colour says the value, the edge has the white spots. */
        var CHIP = [[100, '#1d1d1d'], [25, '#1f7a3a'], [10, '#1e4fb5'], [5, '#c8202a'], [1, '#e9e2d2']];
        function chipSvg(color, size, label) {
          var spots = '', k;
          for (k = 0; k < 8; k++) { var a = k * Math.PI / 4; spots += '<rect x="-3" y="-20" width="6" height="7" rx="1" fill="#fff" opacity="0.92" transform="rotate(' + (k * 45) + ' 20 20) translate(20 20)"/>'; }
          return '<svg class="gfx" width="' + size + '" height="' + size + '" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="22" r="19" fill="rgba(0,0,0,0.35)"/><circle cx="20" cy="20" r="19" fill="' + color + '" stroke="' + Gfx.shade(color, -0.4) + '" stroke-width="1"/>' + spots + '<circle cx="20" cy="20" r="12.5" fill="' + Gfx.shade(color, 0.08) + '" stroke="' + Gfx.shade(color, 0.5) + '" stroke-width="1.2"/><text x="20" y="24" text-anchor="middle" font-size="10" font-weight="800" font-family="Georgia,serif" fill="' + (color === '#e9e2d2' ? '#333' : '#fff') + '">' + label + '</text></svg>';
        }
        /* A stack of chips worth the amount: the biggest denominations first, at most six chips high. */
        function stackHtml(amount, size) {
          var chips = [], rest = Math.max(0, amount), k;
          CHIP.forEach(function (d) { while (rest >= d[0] && chips.length < 6) { chips.push(d); rest -= d[0]; } });
          if (!chips.length) return '<div class="bj-stack" style="width:' + size + 'px;height:' + size + 'px"></div>';
          var html = '<div class="bj-stack" style="width:' + size + 'px;height:' + (size + chips.length * 3) + 'px">';
          for (k = chips.length - 1; k >= 0; k--) html += '<div class="bj-chip" style="bottom:' + ((chips.length - 1 - k) * 3) + 'px">' + chipSvg(chips[k][1], size, chips[k][0]) + '</div>';
          return html + '</div>';
        }
        var rail = h('div', 'bj-rail gfx-wood-dark'), table = h('div', 'bj-table gfx-felt'), head = h('div', 'bj-head'), shoe = h('div', 'bj-shoe'), dealerEl = h('div', 'bj-dealer'), seats = h('div', 'bj-seats'), bar = h('div', 'bj-bar'), hint = h('div', 'bj-hint'), fx = h('div', 'bj-fx');
        rail.appendChild(table); table.appendChild(h('div', 'bj-arc')); table.appendChild(head); table.appendChild(shoe); table.appendChild(dealerEl); table.appendChild(seats); table.appendChild(hint); table.appendChild(bar); table.appendChild(fx); el.appendChild(rail);
        var style = h('style');
        style.textContent = '.bj-rail{border-radius:28px 28px 46% 46% / 28px 28px 22% 22%;padding:10px;box-shadow:0 14px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 0 rgba(0,0,0,.4)}' +
          '.bj-table{position:relative;border-radius:18px 18px 45% 45% / 18px 18px 20% 20%;padding:10px 8px 14px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),inset 0 0 90px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:8px;color:#fff;user-select:none;-webkit-user-select:none}' +
          '.bj-arc{position:absolute;left:6%;right:6%;top:32%;height:40%;border:2px solid rgba(255,255,255,.18);border-top:0;border-radius:0 0 50% 50% / 0 0 100% 100%;pointer-events:none}' +
          '.bj-head{position:absolute;left:12px;top:10px;font-size:12px;font-weight:700;background:rgba(0,0,0,.4);padding:3px 10px;border-radius:9px;z-index:2}' +
          '.bj-shoe{position:absolute;right:12px;top:10px;z-index:2}.bj-shoebox{position:relative;border-radius:6px;background:linear-gradient(#3a2a22,#1e1410);box-shadow:0 3px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1);padding:6px 6px 4px}.bj-shoebox .gfx{display:block}.bj-shoecard{position:absolute;left:6px;top:6px}' +
          '.bj-dealer{display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;z-index:1}.bj-label{font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;opacity:.9;background:rgba(0,0,0,.35);padding:2px 10px;border-radius:9px}' +
          '.bj-fan{position:relative}.bj-fcard{position:absolute;left:0;top:0;transform-origin:50% 100%;backface-visibility:hidden}.bj-flipin{animation:bjflip .4s ease-out}@keyframes bjflip{0%{transform:rotateY(90deg)}100%{transform:none}}' +
          '.bj-total{font-size:12px;font-weight:800;background:#f3e9d2;color:#2a1a05;padding:2px 9px;border-radius:9px;box-shadow:0 1px 3px rgba(0,0,0,.5)}.bj-total.bust{background:#c8202a;color:#fff}.bj-total.bj{background:#f2b632;color:#2a1a05}.bj-total.stand{background:#d9d2c0}' +
          '.bj-seats{position:relative;z-index:1}.bj-seat{position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateX(-50%)}.bj-seat.busted .bj-fan{opacity:.55;filter:saturate(.4)}' +
          '.bj-name{display:flex;flex-direction:column;align-items:center;font-size:11px;line-height:1.2;max-width:100%;padding:3px 8px;border-radius:11px;background:rgba(0,0,0,.45);border:2px solid var(--pc);text-align:center;box-sizing:border-box}.bj-name b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
          '.bj-seat.on .bj-name{box-shadow:0 0 0 2px rgba(255,255,255,.9),0 0 16px var(--pc);background:rgba(0,0,0,.6)}' +
          '.bj-chips{display:flex;align-items:flex-end;gap:6px}.bj-stack{position:relative}.bj-chip{position:absolute;left:0}.bj-stack .gfx{display:block}.bj-amount{font-size:11px;background:rgba(0,0,0,.45);padding:1px 7px;border-radius:8px;white-space:nowrap}' +
          '.bj-res{font-weight:800;font-size:13px;padding:2px 9px;border-radius:9px;background:rgba(0,0,0,.5)}.bj-res.win{color:#8ef0a0}.bj-res.lose{color:#ff8a8a}' +
          '.bj-bar{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;min-height:0;position:relative;z-index:2}' +
          '.bj-round{width:68px;height:68px;border-radius:50%;border:0;color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.45),0 6px 12px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.1;padding:4px}.bj-round:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.45)}.bj-round:disabled{opacity:.35;cursor:default;transform:none}' +
          '.bj-round.hit{background:radial-gradient(circle at 35% 30%,#4fd07a,#1f8a3f)}.bj-round.stand{background:radial-gradient(circle at 35% 30%,#ff6b60,#b52a22)}.bj-round.double{background:radial-gradient(circle at 35% 30%,#5b8dff,#2447b5)}' +
          '.bj-btn{min-height:44px;padding:0 22px;border-radius:22px;border:0;background:linear-gradient(#ffd45a,#e9a820);color:#2a1a05;font-weight:800;font-size:15px;box-shadow:0 3px 0 #9a6a10,0 5px 10px rgba(0,0,0,.45);cursor:pointer}.bj-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #9a6a10}.bj-btn:disabled{opacity:.4;cursor:default}' +
          '.bj-hint{text-align:center;font-size:13px;opacity:.92;min-height:18px;text-shadow:0 1px 2px rgba(0,0,0,.6);position:relative;z-index:1}' +
          '.bj-fx{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:60}.bj-fly{position:absolute;transform-origin:50% 50%}';
        el.appendChild(style);
        var view = null, info = null, W = 320, cw = 50, ch = 70, first = true;
        var dealerCards = [], seatCards = [], seatEls = [], hiddenEl = null;
        function measure() { W = Math.max(290, (el.clientWidth || 360) - 38); }
        function rectOf(e) { var r = e.getBoundingClientRect(), t = table.getBoundingClientRect(); return { left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }; }
        function flip(e, from, ms, delay, fromTf) {
          var to = rectOf(e), base = e.getAttribute('data-tf') || '';
          var dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
          e.style.transition = 'none'; e.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (fromTf || '');
          void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms'; e.style.transform = base;
        }
        /* A fan of cards: each one a little further right and a little more turned. */
        function fanHtml(cards, size, step, dim, hidden) {
          var n = cards.length + (hidden ? 1 : 0), w = size + step * (n - 1), html = '<div class="bj-fan" style="width:' + w + 'px;height:' + Math.round(size * 1.4 + 8) + 'px">', els = [];
          for (var k = 0; k < n; k++) {
            var ang = (k - (n - 1) / 2) * Math.min(5, 14 / n), tf = 'rotate(' + ang.toFixed(1) + 'deg)';
            html += '<div class="bj-fcard" data-tf="' + tf + '" style="left:' + Math.round(k * step) + 'px;top:4px;z-index:' + (10 + k) + ';transform:' + tf + '">' + (k < cards.length ? cardSvg(cards[k], size, dim) : Gfx.cardBack(size, '#1d3f8f')) + '</div>';
          }
          return html + '</div>';
        }
        function render(animate) {
          var v = view, inf = info, ov = G.over(v), me = inf.me, i, k;
          measure();
          var n = v.n, seatW = Math.min(160, Math.floor((W - 8) / n));
          cw = Math.max(34, Math.min(72, Math.floor(seatW * 0.62))); ch = Math.round(cw * 1.4);
          var dcw = Math.max(cw, Math.min(76, Math.floor(W / 8))), step = Math.round(cw * 0.42);
          head.textContent = api.t('round', v.round, ROUNDS);
          /* the shoe */
          var sw = Math.round(dcw * 0.8);
          shoe.innerHTML = '<div class="bj-shoebox" style="width:' + (sw + 12) + 'px;height:' + (Math.round(sw * 1.4) + 10) + 'px">' + Gfx.cardBack(sw, '#1d3f8f') + '<div class="bj-shoecard" style="transform:translate(-2px,-2px)">' + Gfx.cardBack(sw, '#1d3f8f') + '</div></div>';
          /* the dealer */
          var dv = handValue(v.dealer).total, dhidden = v.dealer.length === 1;
          dealerEl.innerHTML = '<div class="bj-label">' + api.t('dealer') + '</div>' + fanHtml(v.dealer, dcw, Math.round(dcw * 0.5), false, dhidden) + '<div class="bj-total' + (dv > 21 ? ' bust' : v.dealer.length === 2 && isBlackjack(v.dealer) ? ' bj' : '') + '">' + dv + '</div>';
          dealerCards = Array.prototype.slice.call(dealerEl.querySelectorAll('.bj-fcard'));
          hiddenEl = dhidden ? dealerCards[1] : null;
          /* the seats along the front edge */
          var arcH = n > 1 ? Math.round(Math.min(34, W * 0.05)) : 0, seatH = ch + 12 + 24 + 24 + Math.round(seatW * 0.24) + 18 + 22 + 26;
          seats.style.height = (seatH + arcH) + 'px'; seats.innerHTML = ''; seatEls = []; seatCards = [];
          for (i = 0; i < n; i++) {
            var hv = handValue(v.hands[i]), st = v.status[i], res = v.results[i], busted = st === 'bust';
            var s = h('div', 'bj-seat' + (v.phase === 'play' && v.turn === i ? ' on' : '') + (busted ? ' busted' : ''));
            s.style.setProperty('--pc', inf.colors[i]); s.style.width = seatW + 'px';
            var u = n > 1 ? (2 * i / (n - 1) - 1) : 0;
            s.style.left = Math.round(W / 2 + u * (W - seatW) / 2 * 0.98) + 'px'; s.style.top = Math.round(arcH * (1 - u * u)) + 'px';
            var html = fanHtml(v.hands[i], cw, step, busted, false);
            html += '<div class="bj-total' + (busted ? ' bust' : st === 'bj' ? ' bj' : st === 'stand' && v.phase === 'play' ? ' stand' : '') + '">' + (busted ? api.t('bust') : st === 'bj' ? api.t('bj') : st === 'stand' && v.phase === 'play' ? hv.total + ' / ' + api.t('standing') : hv.total) + '</div>';
            html += '<div class="bj-name"><b>' + esc(inf.names[i]) + '</b></div>';
            var chipSize = Math.max(22, Math.min(34, Math.round(seatW * 0.24)));
            html += '<div class="bj-chips">' + stackHtml(v.chips[i], chipSize) + stackHtml(v.bets[i], Math.round(chipSize * 0.75)) + '</div><div class="bj-amount">' + api.t('chips', v.chips[i]) + (seatW >= 120 ? ' / ' + api.t('bet', v.bets[i]) : '') + '</div>';
            if (res !== null && res !== undefined) html += '<div class="bj-res ' + (res > 0 ? 'win' : res < 0 ? 'lose' : '') + '">' + (res > 0 ? api.t('won', res) : res < 0 ? api.t('lost', res) : api.t('push')) + '</div>';
            s.innerHTML = html;
            seats.appendChild(s); seatEls.push(s); seatCards.push(Array.prototype.slice.call(s.querySelectorAll('.bj-fcard')));
          }
          /* the buttons */
          var acts = inf.canAct && me >= 0 ? G.actions(v, me) : [];
          var has = function (key) { return acts.some(function (a) { return a[key]; }); };
          var bh = '';
          if (v.phase === 'play') bh = '<button class="bj-round hit" data-a="hit"' + (has('hit') ? '' : ' disabled') + '>' + api.t('hit') + '</button><button class="bj-round stand" data-a="stand"' + (has('stand') ? '' : ' disabled') + '>' + api.t('stand') + '</button><button class="bj-round double" data-a="double"' + (has('double') ? '' : ' disabled') + '>' + api.t('double') + '</button>';
          else if (v.phase === 'settled') bh = '<button class="bj-btn" data-a="next"' + (has('next') ? '' : ' disabled') + '>' + api.t('next') + '</button>';
          bar.innerHTML = bh;
          if (ov) hint.textContent = api.t('final', inf.names[ov.ranking[0]], ov.chips[ov.ranking[0]]);
          else if (v.phase === 'settled') hint.textContent = inf.canAct ? '' : api.t('nextHint', inf.names[0]);
          else hint.textContent = inf.canAct ? api.t('yourMove') : v.turn >= 0 ? api.t('wait', inf.names[v.turn]) : api.t('waitDealer');
          /* the cards of the last apply slide out of the shoe */
          if (animate) {
            var shoeRect = rectOf(shoe), delay = 0, dealt = false, dealerDealt = 0;
            (inf.events || []).forEach(function (e) {
              if (e.e === 'deal' || (first && !dealt)) {
                if (dealt) return; dealt = true;
                for (k = 0; k < 2; k++) for (i = 0; i < n; i++) if (seatCards[i][k]) { flip(seatCards[i][k], shoeRect, 320, delay, 'rotate(0deg)'); delay += 70; }
                if (dealerCards[0]) { flip(dealerCards[0], shoeRect, 320, delay, 'rotate(0deg)'); delay += 70; }
                if (hiddenEl) { flip(hiddenEl, shoeRect, 320, delay, 'rotate(0deg)'); delay += 70; }
              } else if (e.e === 'card' && seatCards[e.p] && seatCards[e.p].length) { flip(seatCards[e.p][seatCards[e.p].length - 1], shoeRect, 320, delay, 'rotate(0deg)'); delay += 120; }
              else if (e.e === 'dealer') {
                var idx = 1 + dealerDealt; dealerDealt++;
                if (!dealerCards[idx]) return;
                if (idx === 1) { dealerCards[idx].classList.add('bj-flipin'); dealerCards[idx].style.animationDelay = delay + 'ms'; delay += 300; }
                else { flip(dealerCards[idx], shoeRect, 320, delay, 'rotate(0deg)'); delay += 160; }
              }
            });
            if (first && !dealt) {
              for (k = 0; k < 2; k++) for (i = 0; i < n; i++) if (seatCards[i][k]) { flip(seatCards[i][k], shoeRect, 320, delay, 'rotate(0deg)'); delay += 70; }
              if (dealerCards[0]) flip(dealerCards[0], shoeRect, 320, delay, 'rotate(0deg)');
              if (hiddenEl) flip(hiddenEl, shoeRect, 320, delay + 70, 'rotate(0deg)');
            }
            first = false;
          }
        }
        bar.onclick = function (ev) {
          var b = ev.target.closest ? ev.target.closest('button') : null;
          if (!b || b.disabled || !info || !info.canAct) return;
          var a = {}; a[b.getAttribute('data-a')] = true; api.act(a);
        };
        function onResize() { if (view && info) render(false); }
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            (inf.events || []).forEach(function (e) {
              if (e.e === 'card' || e.e === 'dealer' || e.e === 'deal') api.sound('card');
              if (e.e === 'bust') api.sound('wrong');
            });
            render(true);
          },
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
