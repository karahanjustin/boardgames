/* Schwarzer Peter / Old Maid: 18 pairs and the Schwarzer Peter, 37 cards. Everything is dealt, pairs go down, then
   each player in turn draws one card blind from the player before them and lays down any pair that forms. Whoever
   runs out of cards is safe; the one left holding the Schwarzer Peter loses. */
(function (root) {
  'use strict';
  var PAIRS = 18, PETER = 2 * PAIRS, CARDS = PETER + 1;
  var EMOJI = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦆'];
  function face(c) { return c === PETER ? '🎩' : EMOJI[Math.floor(c / 2)]; }
  function partner(c) { return c === PETER ? -1 : (c ^ 1); }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  /* Takes every pair out of a hand and lays it down; returns the pairs laid. */
  function layPairs(hand, pairs) {
    var laid = [];
    for (var i = 0; i < hand.length; i++) {
      var j = hand.indexOf(partner(hand[i]));
      if (hand[i] !== PETER && j >= 0) {
        var a = Math.min(hand[i], hand[j]), b = Math.max(hand[i], hand[j]);
        hand.splice(Math.max(i, j), 1); hand.splice(Math.min(i, j), 1);
        pairs.push([a, b]); laid.push([a, b]); i = -1;
      }
    }
    return laid;
  }
  function active(s) { var out = []; for (var i = 0; i < s.n; i++) if (s.hands[i].length) out.push(i); return out; }
  function nextWithCards(s, p, dir) { for (var k = 1; k <= s.n; k++) { var q = (p + dir * k + s.n * k) % s.n; if (s.hands[q].length) return q; } return -1; }
  /* The giver is the player before the drawer who still holds cards. */
  function giver(s, p) { return nextWithCards(s, p, -1); }
  var G = {
    id: 'schwarzerpeter',
    name: { de: 'Schwarzer Peter', en: 'Old Maid' },
    blurb: { de: 'Paare ablegen, nur den Schwarzen Peter nicht behalten.', en: 'Shed your pairs, just do not get stuck with the Old Maid.' },
    icon: '🎩',
    counts: [2, 3, 4, 5, 6],
    ai: true,
    hidden: true,
    strings: {
      de: {
        draw: 'Karte von {0} ziehen', drawing: '{0} zieht von {1}', cards: '{0} Karten', card: '1 Karte', out: 'fertig', pairs: 'Paare', yourHand: 'Deine Karten', noCards: 'Du bist fertig',
        peter: 'Schwarzer Peter', loser: '{0} hat den Schwarzen Peter', youLose: 'Du hast den Schwarzen Peter', pairMade: 'Ein Paar!', peterDrawn: 'Oh nein',
        rules: 'Alle 37 Karten werden verteilt: 18 Paare und der Schwarze Peter. Wer Paare auf der Hand hat, legt sie ab. Dann zieht jeder, der dran ist, blind eine Karte aus der Hand des Spielers vor ihm und legt ein Paar ab, wenn eines entsteht. Wer keine Karten mehr hat, ist aus dem Spiel und sicher. Wer am Ende den Schwarzen Peter in der Hand hält, hat verloren.'
      },
      en: {
        draw: 'Draw a card from {0}', drawing: '{0} draws from {1}', cards: '{0} cards', card: '1 card', out: 'done', pairs: 'Pairs', yourHand: 'Your cards', noCards: 'You are done',
        peter: 'Old Maid', loser: '{0} holds the Old Maid', youLose: 'You hold the Old Maid', pairMade: 'A pair!', peterDrawn: 'Oh no',
        rules: 'All 37 cards are dealt: 18 pairs and the Old Maid. Anyone holding pairs lays them down. Then each player in turn draws one card blind from the hand of the player before them and lays down a pair when one forms. A player with no cards left is out and safe. Whoever holds the Old Maid at the end loses.'
      }
    },
    create: function (cfg, rng) {
      var deck = [], i;
      for (i = 0; i < CARDS; i++) deck.push(i);
      rng.shuffle(deck);
      var s = { n: cfg.n, hands: [], pairs: [], turn: 0, finished: [], over: false, loser: -1, last: null };
      for (i = 0; i < cfg.n; i++) { s.hands.push([]); s.pairs.push([]); }
      for (i = 0; i < deck.length; i++) s.hands[i % cfg.n].push(deck[i]);
      for (i = 0; i < cfg.n; i++) { layPairs(s.hands[i], s.pairs[i]); }
      for (i = 0; i < cfg.n; i++) if (!s.hands[i].length) s.finished.push(i);
      var act = active(s);
      if (act.length <= 1) { s.over = true; s.loser = act.length ? act[0] : -1; }
      else s.turn = act[0];
      return s;
    },
    current: function (s) { return s.over ? -1 : s.turn; },
    actions: function (s, p) { return !s.over && s.turn === p ? [{ draw: true }] : []; },
    apply: function (s, p, a, rng) {
      var next = copy(s), ev = [], q = giver(next, p);
      var from = next.hands[q], idx = rng.int(from.length), card = from.splice(idx, 1)[0];
      next.hands[p].push(card);
      ev.push({ e: 'draw', from: q, to: p });
      var laid = layPairs(next.hands[p], next.pairs[p]);
      for (var i = 0; i < laid.length; i++) ev.push({ e: 'pair', p: p, cards: laid[i] });
      next.last = { from: q, to: p, pair: laid.length > 0 };
      if (!from.length) { next.finished.push(q); ev.push({ e: 'out', p: q }); }
      if (!next.hands[p].length) { next.finished.push(p); ev.push({ e: 'out', p: p }); }
      var act = active(next);
      if (act.length <= 1) { next.over = true; next.loser = act.length ? act[0] : -1; next.turn = -1; ev.push({ e: 'peter', p: next.loser }); }
      else next.turn = nextWithCards(next, p, 1);
      return { state: next, events: ev };
    },
    over: function (s) {
      if (!s.over) return null;
      var ranking = s.finished.slice();
      if (s.loser >= 0) ranking.push(s.loser);
      return { winner: ranking.length > 1 ? ranking[0] : -1, ranking: ranking, loser: s.loser };
    },
    ai: function (s, p) { var acts = G.actions(s, p); return acts.length ? acts[0] : null; },
    /* Other hands are shown as counts only; the viewer sees their own hand, the hot seat sees the current one, and
       at the end the loser's hand (the Schwarzer Peter) is shown to everyone. */
    view: function (s, p) {
      var who = p >= 0 ? p : s.turn, counts = [], i;
      for (i = 0; i < s.n; i++) counts.push(s.hands[i].length);
      var hand = who >= 0 && !s.over ? s.hands[who].slice() : [];
      if (s.over && s.loser >= 0) hand = p === s.loser || p < 0 ? s.hands[s.loser].slice() : [];
      hand.sort(function (a, b) { return a - b; });
      return { n: s.n, me: who, counts: counts, hand: hand, pairs: s.pairs, turn: s.turn, finished: s.finished, over: s.over, loser: s.loser, last: s.last, giver: s.over ? -1 : giver(s, s.turn) };
    },
    ui: {
      mount: function (el, api) {
        var wrap = document.createElement('div'); wrap.className = 'sp';
        var others = document.createElement('div'); others.className = 'sp-others';
        var mid = document.createElement('div'); mid.className = 'sp-mid';
        var mine = document.createElement('div'); mine.className = 'sp-mine';
        wrap.appendChild(others); wrap.appendChild(mid); wrap.appendChild(mine); el.appendChild(wrap);
        var style = document.createElement('style');
        style.textContent = '.sp{max-width:820px;margin:0 auto;padding:6px}.sp-others{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}' +
          '.sp-seat{background:rgba(0,0,0,.25);border-radius:12px;padding:8px;border:2px solid transparent;text-align:center}.sp-seat.turn{border-color:#fff;box-shadow:0 0 10px rgba(255,255,255,.35)}.sp-seat.giver{border-style:dashed;border-color:rgba(255,255,255,.6)}' +
          '.sp-name{display:inline-block;font-weight:700;font-size:13px;padding:2px 8px;border-radius:8px;color:#fff;background:var(--pc,#555);margin-bottom:6px}' +
          '.sp-fan{position:relative;height:54px;margin:0 auto;width:90px}.sp-back{position:absolute;top:0;width:34px;height:48px;border-radius:5px;background:repeating-linear-gradient(45deg,#7a1f2b 0 4px,#a5313f 4px 8px);box-shadow:0 1px 4px rgba(0,0,0,.5);border:2px solid #fff;box-sizing:border-box;transform-origin:bottom center}' +
          '.sp-count{font-size:12px;opacity:.9}.sp-pairs{font-size:16px;letter-spacing:2px;min-height:20px;margin-top:4px;word-break:break-all}' +
          '.sp-mid{text-align:center;padding:12px 0;min-height:60px}.sp-mid button{padding:10px 18px;border-radius:10px;border:0;font-size:15px;font-weight:600;cursor:pointer;background:#f5c542;color:#222}.sp-hint{font-size:13px;opacity:.85;margin-top:6px}' +
          '.sp-mine{background:rgba(0,0,0,.25);border-radius:12px;padding:10px;text-align:center}.sp-title{font-size:13px;opacity:.85;margin-bottom:6px}' +
          '.sp-hand{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}.sp-card{width:48px;height:66px;border-radius:7px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 2px 6px rgba(0,0,0,.45);animation:spin .25s ease-out}' +
          '.sp-card.peter{background:#111;color:#fff;box-shadow:0 0 0 2px #fff,0 2px 8px rgba(0,0,0,.6)}@keyframes spin{from{transform:translateY(-12px);opacity:0}to{transform:none;opacity:1}}' +
          '.sp-big{width:120px;height:170px;font-size:72px;border-radius:14px;margin:8px auto;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 4px #fff,0 10px 30px rgba(0,0,0,.6)}.sp-big small{font-size:13px;margin-top:6px;letter-spacing:1px}.sp-loser{font-weight:700;margin-top:6px}';
        el.appendChild(style);
        var view = null, info = null;
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function fan(count) {
          var n = Math.min(count, 7), h = '<div class="sp-fan">';
          for (var i = 0; i < n; i++) { var ang = (i - (n - 1) / 2) * 9, x = 28 + (i - (n - 1) / 2) * 7; h += '<div class="sp-back" style="left:' + x + 'px;transform:rotate(' + ang + 'deg)"></div>'; }
          return h + '</div>';
        }
        function pairsHtml(pairs) { var h = ''; for (var i = 0; i < pairs.length; i++) h += face(pairs[i][0]); return h; }
        function render() {
          var v = view, inf = info, i, h = '';
          for (i = 0; i < v.n; i++) {
            if (i === v.me && !v.over) continue;
            var done = v.counts[i] === 0;
            h += '<div class="sp-seat' + (v.turn === i && !v.over ? ' turn' : '') + (v.giver === i && inf.canAct ? ' giver' : '') + '"><div class="sp-name" style="--pc:' + inf.colors[i] + '">' + esc(inf.names[i]) + '</div>' +
              (done ? '<div class="sp-count">' + api.t('out') + '</div>' : fan(v.counts[i]) + '<div class="sp-count">' + (v.counts[i] === 1 ? api.t('card') : api.t('cards', v.counts[i])) + '</div>') +
              '<div class="sp-pairs">' + pairsHtml(v.pairs[i]) + '</div></div>';
          }
          others.innerHTML = h;
          if (v.over) {
            mid.innerHTML = '<div class="sp-big">' + face(PETER) + '<small>' + api.t('peter') + '</small></div><div class="sp-loser">' + (v.loser >= 0 ? (inf.me === v.loser ? api.t('youLose') : api.t('loser', esc(inf.names[v.loser]))) : '') + '</div>';
          } else if (inf.canAct && v.giver >= 0) {
            mid.innerHTML = '<button class="sp-draw">' + api.t('draw', esc(inf.names[v.giver])) + '</button>';
          } else {
            mid.innerHTML = '<div class="sp-hint">' + (v.turn >= 0 && v.giver >= 0 ? api.t('drawing', esc(inf.names[v.turn]), esc(inf.names[v.giver])) : '') + '</div>';
          }
          var mh = '<div class="sp-title">' + (v.over && v.loser >= 0 && v.me !== v.loser ? '' : api.t('yourHand')) + '</div><div class="sp-hand">';
          if (!v.over && v.me >= 0 && !v.hand.length) mh += '<div class="sp-title">' + api.t('noCards') + '</div>';
          for (i = 0; i < v.hand.length; i++) mh += '<div class="sp-card' + (v.hand[i] === PETER ? ' peter' : '') + '">' + face(v.hand[i]) + '</div>';
          mh += '</div>';
          if (v.me >= 0 && v.pairs[v.me] && v.pairs[v.me].length) mh += '<div class="sp-title">' + api.t('pairs') + '</div><div class="sp-pairs">' + pairsHtml(v.pairs[v.me]) + '</div>';
          mine.innerHTML = mh;
          mine.style.display = v.over && v.me !== v.loser ? 'none' : '';
        }
        mid.onclick = function (ev) {
          var b = ev.target.closest ? ev.target.closest('button.sp-draw') : null;
          if (!b || !info || !info.canAct) return;
          api.act({ draw: true });
        };
        return {
          update: function (v, inf) {
            view = v; info = inf;
            (inf.events || []).forEach(function (e) {
              if (e.e === 'draw') api.sound('card');
              if (e.e === 'pair') { api.sound('capture'); if (e.p === inf.me) api.toast(api.t('pairMade')); }
              if (e.e === 'peter') api.sound(e.p === inf.me ? 'lose' : 'win');
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
