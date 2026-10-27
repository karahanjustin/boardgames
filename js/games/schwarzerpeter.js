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
      /* The table: green felt in a dark wooden rail. The other players sit along the top with fanned backs and
         their pairs laid beside them as small stacks; the own hand is fanned along the bottom as picture cards
         (the pair animal large, the pair number small in the corners; the Schwarzer Peter a black card with a white
         top hat). Drawing slides a card from the neighbour's fan into the hand, a pair pops onto the stacks. */
      mount: function (el, api) {
        var Gfx = root.Gfx;
        function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        var FRAME = '<rect x="2" y="3" width="58" height="82" rx="6" fill="rgba(0,0,0,0.3)"/>';
        function svg(size, body) { return '<svg class="gfx gfx-card" width="' + size + '" height="' + (size * 1.4) + '" viewBox="0 0 60 84" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>'; }
        /* A picture card in the frame of the kit's playing card: the animal large, the pair number in the corners. */
        function faceCard(c, size) {
          if (c === PETER) return svg(size, FRAME + '<rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="#161616" stroke="#4a4a4a"/><rect x="4" y="4" width="52" height="76" rx="4" fill="none" stroke="#fff" stroke-width="1" opacity="0.75"/>' +
            '<path d="M18 50 V23 Q18 19 22 19 H38 Q42 19 42 23 V50 Z" fill="#f2f2f2"/><rect x="21" y="22" width="4" height="24" rx="2" fill="#fff"/><rect x="18" y="41" width="24" height="5" fill="#8c8c8c"/>' +
            '<ellipse cx="30" cy="51" rx="20" ry="5.5" fill="#fff"/><ellipse cx="30" cy="51" rx="20" ry="5.5" fill="none" stroke="#b5b5b5" stroke-width="0.8"/><path d="M18 50 H42" stroke="#cfcfcf" stroke-width="0.8"/>');
          var idx = Math.floor(c / 2) + 1, em = EMOJI[Math.floor(c / 2)];
          var corner = '<text x="5" y="14" font-size="10" font-weight="700" font-family="Georgia,serif" fill="#7a6648">' + idx + '</text>';
          return svg(size, FRAME + '<rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="#fdfbf5" stroke="#cfc8b8"/><rect x="7" y="18" width="46" height="48" rx="3" fill="#f3ecdc" stroke="#e2d9c4"/>' + corner + '<g transform="rotate(180 30 42)">' + corner + '</g><text x="30" y="55" text-anchor="middle" font-size="34">' + em + '</text>');
        }
        /* A laid pair: two small cards, one a little askew on the other. */
        function pairStack(pair, size) {
          return '<div class="sp-pair" style="width:' + Math.round(size * 1.25) + 'px;height:' + Math.round(size * 1.5) + 'px"><div class="sp-pcard" style="transform:rotate(-7deg)">' + faceCard(pair[0], size) + '</div><div class="sp-pcard" style="left:' + Math.round(size * 0.22) + 'px;top:' + Math.round(size * 0.06) + 'px;transform:rotate(6deg)">' + faceCard(pair[1], size) + '</div></div>';
        }
        var rail = h('div', 'sp-rail gfx-wood-dark'), table = h('div', 'sp-table gfx-felt'), seats = h('div', 'sp-seats'), mid = h('div', 'sp-mid'), handZone = h('div', 'sp-handzone'), myPairs = h('div', 'sp-mypairs'), fx = h('div', 'sp-fx');
        rail.appendChild(table); table.appendChild(seats); table.appendChild(mid); table.appendChild(handZone); table.appendChild(myPairs); table.appendChild(fx); el.appendChild(rail);
        var style = h('style');
        style.textContent = '.sp-rail{border-radius:26px;padding:10px;box-shadow:0 14px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 0 rgba(0,0,0,.4)}' +
          '.sp-table{position:relative;border-radius:16px;padding:10px 8px 8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),inset 0 0 90px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:8px;color:#fff;user-select:none;-webkit-user-select:none}' +
          '.sp-seats{display:flex;gap:6px;justify-content:center;align-items:flex-start}.sp-seat{flex:1 1 0;min-width:0;max-width:170px;display:flex;flex-direction:column;align-items:center;gap:3px}.sp-seat.done .sp-name{opacity:.6}' +
          '.sp-fan{position:relative;margin:0 auto;border-radius:8px}.sp-fancard{position:absolute;bottom:0;transform-origin:50% 100%}' +
          '.sp-seat.giver .sp-fan{cursor:pointer}.sp-ring{position:absolute;left:-4px;top:-4px;right:-4px;bottom:-4px;border-radius:10px;box-shadow:0 0 0 3px #f2b632,0 0 18px #f2b632;opacity:0;transition:opacity .25s;pointer-events:none}.sp-seat.giver .sp-ring{opacity:1}' +
          '.sp-name{display:flex;flex-direction:column;align-items:center;font-size:11px;line-height:1.2;max-width:100%;padding:3px 8px;border-radius:11px;background:rgba(0,0,0,.4);border:2px solid var(--pc);text-align:center;box-sizing:border-box}.sp-name b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}' +
          '.sp-seat.on .sp-name{box-shadow:0 0 0 2px rgba(255,255,255,.9),0 0 16px var(--pc);background:rgba(0,0,0,.55)}' +
          '.sp-pairs{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 4px;min-height:4px;width:100%}.sp-pair{position:relative;flex:none}.sp-pcard{position:absolute;left:0;top:0;transform-origin:50% 100%}' +
          '.sp-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:52px}.sp-hint{font-size:13px;opacity:.92;text-shadow:0 1px 2px rgba(0,0,0,.6);text-align:center}' +
          '.sp-btn{min-height:44px;padding:0 20px;border-radius:22px;border:0;background:linear-gradient(#ffd45a,#e9a820);color:#2a1a05;font-weight:800;font-size:15px;box-shadow:0 3px 0 #9a6a10,0 5px 10px rgba(0,0,0,.45);cursor:pointer}.sp-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #9a6a10}' +
          '.sp-big{animation:sppop .5s cubic-bezier(.2,.8,.3,1.2)}@keyframes sppop{from{transform:scale(.3) rotate(-20deg);opacity:0}to{transform:none;opacity:1}}.sp-loser{font-weight:700;font-size:15px;text-shadow:0 1px 2px rgba(0,0,0,.6)}' +
          '.sp-handzone{position:relative}.sp-hcard{position:absolute;transform-origin:50% 100%;transition:transform .18s}.sp-title{font-size:12px;opacity:.85;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,.6)}' +
          '.sp-mypairs{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 6px;min-height:4px}' +
          '.sp-fx{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:60}.sp-fly{position:absolute;transform-origin:50% 50%}';
        el.appendChild(style);
        var view = null, info = null, prevHand = null, prevMe = -2, first = true, W = 320, cw = 60, ch = 84, ps = 22;
        var cardEls = [], seatEls = [], fanEls = [], pairRows = [];
        function measure() { W = Math.max(290, (el.clientWidth || 360) - 38); cw = Math.max(44, Math.min(76, Math.floor(W / 8))); ch = Math.round(cw * 1.4); ps = Math.max(18, Math.round(cw * 0.34)); }
        function rectOf(e) { var r = e.getBoundingClientRect(), t = table.getBoundingClientRect(); return { left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }; }
        function flip(e, from, ms, delay, fromTf) {
          var to = rectOf(e), base = e.getAttribute('data-tf') || '';
          var dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
          e.style.transition = 'none'; e.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (fromTf || '');
          void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms'; e.style.transform = base;
        }
        function fly(html, from, to, ms, delay) {
          var e = h('div', 'sp-fly', html); e.style.left = from.left + 'px'; e.style.top = from.top + 'px'; e.style.width = from.width + 'px'; e.style.height = from.height + 'px';
          fx.appendChild(e); void e.offsetWidth;
          e.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.25,1) ' + (delay || 0) + 'ms, opacity 160ms ' + ((delay || 0) + ms - 120) + 'ms';
          e.style.transform = 'translate(' + (to.left + to.width / 2 - from.left - from.width / 2).toFixed(1) + 'px,' + (to.top + to.height / 2 - from.top - from.height / 2).toFixed(1) + 'px) scale(' + (to.width / from.width).toFixed(3) + ')';
          e.style.opacity = '0';
          setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, ms + (delay || 0) + 80);
        }
        function render(animate) {
          var v = view, inf = info, me = v.me, names = inf.names, i, k, c;
          var prevRects = me === prevMe ? cardEls.map(rectOf) : null;
          measure();
          var bw = Math.round(cw * 0.46), bh = Math.round(bw * 1.4);
          seats.innerHTML = ''; seatEls = []; fanEls = []; pairRows = [];
          for (i = 0; i < v.n; i++) {
            if (i === me && !v.over) { seatEls.push(null); fanEls.push(null); pairRows.push(null); continue; }
            var cnt = v.counts[i], done = cnt === 0, isGiver = v.giver === i && inf.canAct && !v.over;
            var s = h('div', 'sp-seat' + (v.turn === i && !v.over ? ' on' : '') + (isGiver ? ' giver' : '') + (done ? ' done' : ''));
            s.style.setProperty('--pc', inf.colors[i]);
            var fanN = Math.min(cnt, 7), fan = h('div', 'sp-fan'); fan.style.width = Math.round(bw * 2.4) + 'px'; fan.style.height = (bh + 8) + 'px';
            for (k = 0; k < fanN; k++) { c = h('div', 'sp-fancard', Gfx.cardBack(bw, '#7a1f2b')); var off = k - (fanN - 1) / 2; c.style.left = Math.round(bw * 0.7 + off * bw * 0.3) + 'px'; c.style.transform = 'rotate(' + (off * 9) + 'deg)'; fan.appendChild(c); }
            fan.appendChild(h('div', 'sp-ring'));
            if (isGiver) fan.onclick = function () { if (info && info.canAct) api.act({ draw: true }); };
            s.appendChild(fan);
            s.appendChild(h('div', 'sp-name', '<b>' + esc(names[i]) + '</b><span>' + (done ? api.t('out') : cnt === 1 ? api.t('card') : api.t('cards', cnt)) + '</span>'));
            var row = h('div', 'sp-pairs');
            for (k = 0; k < v.pairs[i].length; k++) row.innerHTML += pairStack(v.pairs[i][k], ps);
            s.appendChild(row);
            seats.appendChild(s); seatEls.push(s); fanEls.push(fan); pairRows.push(row);
          }
          /* the middle: the draw button, the waiting text, or the Schwarzer Peter at the end */
          mid.innerHTML = '';
          if (v.over) {
            mid.appendChild(h('div', 'sp-big', faceCard(PETER, Math.round(cw * 1.5))));
            mid.appendChild(h('div', 'sp-loser', v.loser >= 0 ? (inf.me === v.loser ? api.t('youLose') : api.t('loser', esc(names[v.loser]))) : ''));
          } else if (inf.canAct && v.giver >= 0) {
            var b = h('button', 'sp-btn', api.t('draw', esc(names[v.giver]))); b.onclick = function () { if (info && info.canAct) api.act({ draw: true }); }; mid.appendChild(b);
          } else mid.appendChild(h('div', 'sp-hint', v.turn >= 0 && v.giver >= 0 ? api.t('drawing', esc(names[v.turn]), esc(names[v.giver])) : ''));
          /* the own hand, fanned along the bottom */
          handZone.innerHTML = ''; cardEls = [];
          var hand = v.hand || [], nH = hand.length, showHand = !(v.over && v.me !== v.loser);
          if (showHand) {
            var step = nH > 1 ? Math.min(cw * 0.7, (W - cw - 6) / (nH - 1)) : 0, x0 = (W - (cw + step * (nH - 1))) / 2;
            handZone.style.height = (ch + 22) + 'px';
            hand.forEach(function (cid, i) {
              var off = i - (nH - 1) / 2, ang = off * Math.min(4, 40 / Math.max(nH, 1)), bow = Math.abs(off) * Math.min(3, 24 / Math.max(nH, 1));
              var d = h('div', 'sp-hcard', faceCard(cid, cw));
              d.style.left = Math.round(x0 + i * step) + 'px'; d.style.top = Math.round(14 + bow) + 'px'; d.style.zIndex = 10 + i;
              var tf = 'rotate(' + ang.toFixed(2) + 'deg)'; d.setAttribute('data-tf', tf); d.style.transform = tf;
              handZone.appendChild(d); cardEls.push(d);
            });
            if (!nH && !v.over && me >= 0) handZone.appendChild(h('div', 'sp-title', api.t('noCards')));
          } else handZone.style.height = '0px';
          myPairs.innerHTML = '';
          if (me >= 0 && v.pairs[me] && v.pairs[me].length && !v.over) for (k = 0; k < v.pairs[me].length; k++) myPairs.innerHTML += pairStack(v.pairs[me][k], Math.round(ps * 1.2));
          /* the moves of the last apply, animated */
          var evs = animate ? (inf.events || []) : [], handRect = cardEls.length ? rectOf(handZone) : null;
          if (handRect) { handRect.left += handRect.width / 2 - cw / 2; handRect.width = cw; }
          evs.forEach(function (e, ei) {
            if (e.e === 'draw') {
              var src = fanEls[e.from] ? rectOf(fanEls[e.from]) : handRect;
              if (e.to === me && showHand) {
                var fresh = -1; if (prevHand) for (k = 0; k < hand.length; k++) if (prevHand.indexOf(hand[k]) < 0) fresh = k;
                if (fresh >= 0 && src) flip(cardEls[fresh], src, 340, 0, 'rotate(0deg)');
                else if (src && handRect) fly(Gfx.cardBack(cw, '#7a1f2b'), src, handRect, 340, 0);
              } else if (fanEls[e.to] && src) fly(Gfx.cardBack(cw, '#7a1f2b'), src, rectOf(fanEls[e.to]), 340, 0);
            } else if (e.e === 'pair') {
              var row = e.p === me && !v.over ? myPairs : pairRows[e.p], stack = row && row.lastElementChild, from = e.p === me && !v.over ? handRect : (fanEls[e.p] ? rectOf(fanEls[e.p]) : null);
              if (stack && from) { stack.style.position = 'relative'; flip(stack, from, 320, 300, 'scale(2)'); }
            }
          });
          if (first && animate && handRect) { first = false; var mr = rectOf(mid); cardEls.forEach(function (d, k) { flip(d, mr, 300, k * 40, 'rotate(0deg)'); }); }
          prevHand = hand.slice(); prevMe = me;
        }
        function onResize() { if (view && info) render(false); }
        window.addEventListener('resize', onResize);
        return {
          update: function (v, inf) {
            view = v; info = inf;
            (inf.events || []).forEach(function (e) {
              if (e.e === 'draw') api.sound('card');
              if (e.e === 'pair') { api.sound('capture'); if (e.p === inf.me) api.toast(api.t('pairMade')); }
              if (e.e === 'peter') api.sound(e.p === inf.me ? 'lose' : 'win');
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
