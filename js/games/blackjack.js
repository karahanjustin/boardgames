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
      mount: function (el, api) {
        var SUITS = ['♠', '♥', '♦', '♣'];
        var wrap = document.createElement('div'); wrap.className = 'bj';
        var head = document.createElement('div'); head.className = 'bj-head';
        var dealerEl = document.createElement('div'); dealerEl.className = 'bj-dealer';
        var seats = document.createElement('div'); seats.className = 'bj-seats';
        var bar = document.createElement('div'); bar.className = 'bj-bar';
        var hint = document.createElement('div'); hint.className = 'bj-hint';
        wrap.appendChild(head); wrap.appendChild(dealerEl); wrap.appendChild(seats); wrap.appendChild(hint); wrap.appendChild(bar); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.bj{max-width:860px;margin:0 auto;padding:8px;background:radial-gradient(ellipse at top,#1f6b3a,#0d3b20 70%);border-radius:18px;box-shadow:inset 0 0 0 6px #5a3a1e,0 10px 30px rgba(0,0,0,.4);color:#fff}' +
          '.bj-head{text-align:center;font-size:13px;opacity:.85;margin-bottom:6px}.bj-dealer{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:96px;margin-bottom:10px}' +
          '.bj-label{font-size:13px;font-weight:700;letter-spacing:.5px}.bj-cards{display:flex;gap:-10px}.bj-cards .bj-card{margin-left:-14px}.bj-cards .bj-card:first-child{margin-left:0}' +
          '.bj-card{width:46px;height:64px;border-radius:6px;background:#fff;color:#111;box-shadow:0 2px 6px rgba(0,0,0,.45);position:relative;font-weight:700;animation:bjdeal .25s ease-out;flex:none}' +
          '.bj-card.red{color:#c8232c}.bj-card .r{position:absolute;top:3px;left:5px;font-size:13px;line-height:1}.bj-card .s{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px}' +
          '.bj-card.back{background:repeating-linear-gradient(45deg,#1d3f8f 0 4px,#2b5bc9 4px 8px)}' +
          '@keyframes bjdeal{from{transform:translateY(-20px);opacity:0}to{transform:none;opacity:1}}' +
          '.bj-seats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.bj-seat{background:rgba(0,0,0,.25);border-radius:12px;padding:8px;border:2px solid transparent;display:flex;flex-direction:column;align-items:center;gap:4px}' +
          '.bj-seat.turn{border-color:#fff;box-shadow:0 0 12px rgba(255,255,255,.4)}.bj-name{font-weight:700;font-size:14px;padding:2px 8px;border-radius:8px;color:#fff;background:var(--pc,#555)}' +
          '.bj-chips{font-size:12px;opacity:.9}.bj-val{font-size:13px}.bj-res{font-weight:700;font-size:14px}.bj-res.win{color:#8ef0a0}.bj-res.lose{color:#ff8a8a}.bj-stat{font-size:12px;opacity:.8}' +
          '.bj-bar{display:flex;justify-content:center;gap:10px;margin-top:10px;min-height:44px}.bj-bar button{padding:10px 18px;border-radius:10px;border:0;font-size:15px;font-weight:600;cursor:pointer;background:#f5c542;color:#222}' +
          '.bj-bar button.alt{background:#eee}.bj-bar button:disabled{opacity:.4;cursor:default}.bj-hint{text-align:center;font-size:13px;opacity:.85;margin-top:8px;min-height:18px}';
        el.appendChild(style);
        var view = null, info = null;
        function cardHtml(c) {
          var ranks = api.t('ranks').split(','), s = suit(c);
          return '<div class="bj-card' + (s === 1 || s === 2 ? ' red' : '') + '"><span class="r">' + ranks[rank(c)] + '</span><span class="s">' + SUITS[s] + '</span></div>';
        }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function render() {
          var v = view, inf = info, ov = G.over(v), i;
          head.textContent = api.t('round', v.round, ROUNDS);
          var dh = '<div class="bj-label">' + api.t('dealer') + '</div><div class="bj-cards">';
          for (i = 0; i < v.dealer.length; i++) dh += cardHtml(v.dealer[i]);
          if (v.dealer.length === 1) dh += '<div class="bj-card back"></div>';
          dh += '</div><div class="bj-val">' + handValue(v.dealer).total + '</div>';
          dealerEl.innerHTML = dh;
          var sh = '';
          for (i = 0; i < v.n; i++) {
            var hv = handValue(v.hands[i]), st = v.status[i], res = v.results[i];
            sh += '<div class="bj-seat' + (v.phase === 'play' && v.turn === i ? ' turn' : '') + '"><div class="bj-name" style="--pc:' + inf.colors[i] + '">' + esc(inf.names[i]) + '</div>' +
              '<div class="bj-chips">' + api.t('chips', v.chips[i]) + ' · ' + api.t('bet', v.bets[i]) + '</div><div class="bj-cards">';
            for (var k = 0; k < v.hands[i].length; k++) sh += cardHtml(v.hands[i][k]);
            sh += '</div><div class="bj-val">' + hv.total + '</div>';
            if (st === 'bust') sh += '<div class="bj-stat">' + api.t('bust') + '</div>';
            else if (st === 'bj') sh += '<div class="bj-stat">' + api.t('bj') + '</div>';
            else if (st === 'stand' && v.phase === 'play') sh += '<div class="bj-stat">' + api.t('standing') + '</div>';
            if (res !== null && res !== undefined) sh += '<div class="bj-res ' + (res > 0 ? 'win' : res < 0 ? 'lose' : '') + '">' + (res > 0 ? api.t('won', res) : res < 0 ? api.t('lost', res) : api.t('push')) + '</div>';
            sh += '</div>';
          }
          seats.innerHTML = sh;
          var acts = inf.canAct && inf.me >= 0 ? G.actions(v, inf.me) : [];
          var has = function (key) { return acts.some(function (a) { return a[key]; }); };
          var bh = '';
          if (v.phase === 'play') bh = '<button data-a="hit"' + (has('hit') ? '' : ' disabled') + '>' + api.t('hit') + '</button><button class="alt" data-a="stand"' + (has('stand') ? '' : ' disabled') + '>' + api.t('stand') + '</button><button class="alt" data-a="double"' + (has('double') ? '' : ' disabled') + '>' + api.t('double') + '</button>';
          else if (v.phase === 'settled') bh = '<button data-a="next"' + (has('next') ? '' : ' disabled') + '>' + api.t('next') + '</button>';
          bar.innerHTML = bh;
          if (ov) hint.textContent = api.t('final', inf.names[ov.ranking[0]], ov.chips[ov.ranking[0]]);
          else if (v.phase === 'settled') hint.textContent = inf.canAct ? '' : api.t('nextHint', inf.names[0]);
          else hint.textContent = inf.canAct ? api.t('yourMove') : v.turn >= 0 ? api.t('wait', inf.names[v.turn]) : api.t('waitDealer');
        }
        bar.onclick = function (ev) {
          var b = ev.target.closest ? ev.target.closest('button') : null;
          if (!b || b.disabled || !info || !info.canAct) return;
          var a = {}; a[b.dataset.a] = true; api.act(a);
        };
        return {
          update: function (v, inf) {
            view = v; info = inf;
            (inf.events || []).forEach(function (e) {
              if (e.e === 'card' || e.e === 'dealer' || e.e === 'deal') api.sound('card');
              if (e.e === 'bust') api.sound('wrong');
            });
            render();
          },
          destroy: function () { el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
