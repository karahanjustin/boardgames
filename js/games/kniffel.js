/* Kniffel / Yahtzee: five dice, up to three rolls per turn, thirteen fields on the sheet. The upper section pays
   a bonus of 35 from 63 points, a second Kniffel pays 50 and works as a joker. Rules, an expected value AI over
   the rolls of a turn, a felt dice pad and a paper score sheet drawn with the kit. */
(function (root) {
  'use strict';
  var UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  var LOWER = ['three', 'four', 'full', 'small', 'large', 'kniffel', 'chance'];
  var FIELDS = UPPER.concat(LOWER);
  var ROUNDS = 13;
  /* The par of a field is roughly what a decent player scores there on average; the AI measures a score against it,
     so a zero in the ones hurts far less than a zero in the large straight. */
  var PAR = { ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2, three: 21.7, four: 13.1, full: 22.6, small: 29.5, large: 32.7, kniffel: 16.9, chance: 22 };
  /* A hand is a count vector over the six faces; its key is the counts in base six, so adding the keys of two
     disjoint groups of dice gives the key of their union without a carry. */
  var KEYW = [1, 6, 36, 216, 1296, 7776], FACT = [1, 1, 2, 6, 24, 120];
  function vectors(total) {
    var out = [];
    (function rec(i, left, cur) {
      if (i === 5) { out.push(cur.concat([left])); return; }
      for (var c = 0; c <= left; c++) rec(i + 1, left - c, cur.concat([c]));
    })(0, total, []);
    return out;
  }
  function keyOf(cnt) { var k = 0; for (var i = 0; i < 6; i++) k += cnt[i] * KEYW[i]; return k; }
  function countsOf(dice) { var cnt = [0, 0, 0, 0, 0, 0]; for (var i = 0; i < dice.length; i++) cnt[dice[i] - 1]++; return cnt; }
  function countsOfKey(key) { var cnt = []; for (var i = 0; i < 6; i++) { cnt.push(key % 6); key = Math.floor(key / 6); } return cnt; }
  /* ROLLS[k] lists every outcome of rolling k dice as a key with its probability. */
  var ROLLS = [];
  for (var rk = 0; rk <= 5; rk++) {
    ROLLS[rk] = (function (k) {
      return vectors(k).map(function (cnt) { var ways = FACT[k]; for (var i = 0; i < 6; i++) ways /= FACT[cnt[i]]; return { key: keyOf(cnt), p: ways / Math.pow(6, k) }; });
    })(rk);
  }
  var HANDS = vectors(5).map(function (cnt) { return { cnt: cnt, key: keyOf(cnt) }; });
  function scoreOf(cnt, field, joker) {
    var sum = 0, maxc = 0, i;
    for (i = 0; i < 6; i++) { sum += cnt[i] * (i + 1); if (cnt[i] > maxc) maxc = cnt[i]; }
    var ui = UPPER.indexOf(field);
    if (ui >= 0) return cnt[ui] * (ui + 1);
    if (field === 'three') return maxc >= 3 ? sum : 0;
    if (field === 'four') return maxc >= 4 ? sum : 0;
    if (field === 'chance') return sum;
    if (field === 'kniffel') return maxc === 5 ? 50 : 0;
    if (joker) return field === 'full' ? 25 : field === 'small' ? 30 : 40;
    if (field === 'full') { var has3 = false, has2 = false; for (i = 0; i < 6; i++) { if (cnt[i] === 3) has3 = true; if (cnt[i] === 2) has2 = true; } return has3 && has2 ? 25 : 0; }
    var run = 0, best = 0;
    for (i = 0; i < 6; i++) { if (cnt[i] > 0) { run++; if (run > best) best = run; } else run = 0; }
    if (field === 'small') return best >= 4 ? 30 : 0;
    return best >= 5 ? 40 : 0;
  }
  /* A Kniffel in hand is a joker once the Kniffel field is already written (with 50 or with 0). */
  function isJoker(cnt, sheet) { for (var i = 0; i < 6; i++) if (cnt[i] === 5) return sheet.kniffel !== null; return false; }
  function totals(sheet, bonusCount) {
    var upper = 0, lower = 0, i;
    for (i = 0; i < UPPER.length; i++) upper += sheet[UPPER[i]] || 0;
    for (i = 0; i < LOWER.length; i++) lower += sheet[LOWER[i]] || 0;
    var ub = upper >= 63 ? 35 : 0, kb = 50 * bonusCount;
    return { upper: upper, upperBonus: ub, lower: lower, kniffelBonus: kb, total: upper + ub + lower + kb };
  }
  function filled(sheet) { var c = 0; for (var i = 0; i < FIELDS.length; i++) if (sheet[FIELDS[i]] !== null) c++; return c; }
  function emptySheet() { var sh = {}; for (var i = 0; i < FIELDS.length; i++) sh[FIELDS[i]] = null; return sh; }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  /* ---------- the AI ---------- */
  /* The context of one decision: the free fields and how the upper bonus stands, plus a memo of the leaf values. */
  function makeCtx(sheet) {
    var free = FIELDS.filter(function (f) { return sheet[f] === null; });
    var upper = 0, upperMax = 0;
    for (var i = 0; i < 6; i++) { if (sheet[UPPER[i]] !== null) upper += sheet[UPPER[i]]; else upperMax += 5 * (i + 1); }
    return { sheet: sheet, free: free, upper: upper, bonusOpen: upper < 63 && upper + upperMax >= 63, leaf: [] };
  }
  /* The worth of writing a score into a field: the points, measured against par, with the upper bonus in view and
     the 50 of a second Kniffel. */
  function fieldValue(ctx, cnt, field, joker) {
    var sc = scoreOf(cnt, field, joker), v = sc - PAR[field], ui = UPPER.indexOf(field);
    if (ui >= 0 && ctx.bonusOpen) { v += 0.5 * (sc - 3 * (ui + 1)); if (ctx.upper + sc >= 63) v += 20; }
    if (joker && ctx.sheet.kniffel === 50) v += 50;
    return { field: field, score: sc, v: v };
  }
  function bestField(ctx, cnt) {
    var joker = isJoker(cnt, ctx.sheet), best = null;
    for (var i = 0; i < ctx.free.length; i++) { var fv = fieldValue(ctx, cnt, ctx.free[i], joker); if (!best || fv.v > best.v) best = fv; }
    return best;
  }
  function leaf(ctx, key) {
    if (ctx.leaf[key] === undefined) ctx.leaf[key] = bestField(ctx, countsOfKey(key)).v;
    return ctx.leaf[key];
  }
  /* Every way to keep part of a hand: the kept counts, their key, how many dice are rolled again. Keeping all
     five is not a roll, so it is left out. */
  function keeps(cnt) {
    var out = [];
    (function rec(i, kept, n) {
      if (i === 6) { if (n < 5) out.push({ kept: kept, key: keyOf(kept), roll: 5 - n }); return; }
      for (var c = 0; c <= cnt[i]; c++) rec(i + 1, kept.concat([c]), n + c);
    })(0, [], 0);
    return out;
  }
  /* The expected value after one more roll from a hand, given a table of values of the hands that can result. */
  function expectAfterRoll(cnt, table) {
    var ks = keeps(cnt), best = null;
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], outs = ROLLS[k.roll], e = 0;
      for (var j = 0; j < outs.length; j++) e += outs[j].p * table[k.key + outs[j].key];
      if (!best || e > best.e) best = { e: e, kept: k.kept };
    }
    return best;
  }
  function keepMask(dice, kept) {
    var left = kept.slice(), mask = [];
    for (var i = 0; i < 5; i++) { var f = dice[i] - 1; if (left[f] > 0) { left[f]--; mask.push(true); } else mask.push(false); }
    return mask;
  }
  var G = {
    id: 'kniffel',
    name: { de: 'Kniffel', en: 'Kniffel (Yahtzee)' },
    blurb: { de: 'Fünf Würfel, drei Würfe, dreizehn Felder.', en: 'Five dice, three rolls, thirteen boxes.' },
    icon: '🎲',
    counts: [1, 2, 3, 4, 5, 6],
    ai: true,
    hidden: false,
    strings: {
      de: {
        roll: 'Würfeln (noch {0})', rolled: 'Keine Würfe mehr: trag ein Feld ein', keepHint: 'Würfel antippen zum Behalten, dann würfeln oder ein Feld eintragen', firstHint: 'Würfle zuerst',
        keepAll: 'Alle fünf behalten? Dann trag lieber gleich ein Feld ein', round: 'Runde {0} von 13', upperPart: 'Oberer Teil', lowerPart: 'Unterer Teil', upperSum: 'Summe oben', bonus: 'Bonus ab 63', lowerSum: 'Summe unten', kBonus: 'Kniffel-Bonus', total: 'Gesamt',
        ones: 'Einser', twos: 'Zweier', threes: 'Dreier', fours: 'Vierer', fives: 'Fünfer', sixes: 'Sechser',
        three: 'Dreierpasch', four: 'Viererpasch', full: 'Full House', small: 'Kleine Straße', large: 'Große Straße', kniffel: 'Kniffel', chance: 'Chance',
        kniffelMade: 'Kniffel!', result: '{0}: {1} Punkte',
        rules: 'Jeder hat pro Runde bis zu drei Würfe mit fünf Würfeln; nach jedem Wurf darf man Würfel behalten. Dann wird genau ein Feld eingetragen, auch eine Null. Oben zählen die Augen der gewählten Zahl, ab 63 Punkten gibt es 35 Bonus. Unten: Dreierpasch und Viererpasch zählen alle Augen, Full House 25, kleine Straße 30, große Straße 40, Kniffel 50, Chance alle Augen. Ein zweiter Kniffel bringt 50 Bonus und darf als Joker in ein freies Feld. Nach dreizehn Runden gewinnt die höchste Summe.'
      },
      en: {
        roll: 'Roll ({0} left)', rolled: 'No rolls left: write a box', keepHint: 'Tap dice to keep them, then roll or write a box', firstHint: 'Roll first',
        keepAll: 'Keeping all five? Then write a box instead', round: 'Round {0} of 13', upperPart: 'Upper section', lowerPart: 'Lower section', upperSum: 'Upper total', bonus: 'Bonus from 63', lowerSum: 'Lower total', kBonus: 'Kniffel bonus', total: 'Total',
        ones: 'Aces', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
        three: 'Three of a kind', four: 'Four of a kind', full: 'Full house', small: 'Small straight', large: 'Large straight', kniffel: 'Kniffel', chance: 'Chance',
        kniffelMade: 'Kniffel!', result: '{0}: {1} points',
        rules: 'Each turn you roll five dice up to three times and may keep any dice between rolls. Then you write exactly one box, even a zero. The upper boxes count the pips of that number, and 63 points or more earn a bonus of 35. Below: three and four of a kind count all pips, full house 25, small straight 30, large straight 40, Kniffel 50, chance all pips. A second Kniffel earns a 50 bonus and may be used as a joker in a free box. After thirteen rounds the highest total wins.'
      }
    },
    create: function (cfg) {
      var sheet = [], bonus = [];
      for (var i = 0; i < cfg.n; i++) { sheet.push(emptySheet()); bonus.push(0); }
      return { n: cfg.n, turn: 0, rolls: 0, dice: [], sheet: sheet, bonus: bonus, moves: 0, round: 1, last: null };
    },
    current: function (s) { return G.over(s) ? -1 : s.turn; },
    actions: function (s, p) {
      if (s.turn !== p || G.over(s)) return [];
      if (s.rolls === 0) return [{ roll: [] }];
      var out = [], i;
      if (s.rolls < 3) for (var m = 0; m < 31; m++) { var keep = []; for (i = 0; i < 5; i++) keep.push(!!(m & (1 << i))); out.push({ roll: keep }); }
      for (i = 0; i < FIELDS.length; i++) if (s.sheet[p][FIELDS[i]] === null) out.push({ score: FIELDS[i] });
      return out;
    },
    apply: function (s, p, a, rng) {
      var next = copy(s), ev = [], i;
      if (a.roll) {
        var dice = [];
        for (i = 0; i < 5; i++) dice.push(s.rolls > 0 && a.roll[i] ? s.dice[i] : rng.int(6) + 1);
        next.dice = dice; next.rolls = s.rolls + 1;
        ev.push({ e: 'dice', v: dice, kept: s.rolls > 0 ? a.roll.slice() : [false, false, false, false, false] });
        var cnt = countsOf(dice);
        for (i = 0; i < 6; i++) if (cnt[i] === 5) ev.push({ e: 'kniffel', p: p });
      } else {
        var c = countsOf(s.dice), joker = isJoker(c, s.sheet[p]), sc = scoreOf(c, a.score, joker);
        next.sheet[p][a.score] = sc;
        if (joker && s.sheet[p].kniffel === 50) next.bonus[p]++;
        ev.push({ e: 'score', p: p, field: a.score, v: sc, joker: joker });
        next.last = { p: p, field: a.score, v: sc };
        next.moves = s.moves + 1; next.rolls = 0; next.dice = []; next.turn = (p + 1) % s.n;
        next.round = Math.min(ROUNDS, Math.floor(next.moves / s.n) + 1);
      }
      return { state: next, events: ev };
    },
    over: function (s) {
      if (s.moves < ROUNDS * s.n) return null;
      var tot = [], order = [], i;
      for (i = 0; i < s.n; i++) { tot.push(totals(s.sheet[i], s.bonus[i]).total); order.push(i); }
      order.sort(function (a, b) { return tot[b] - tot[a] || a - b; });
      var winner = s.n === 1 ? 0 : (tot[order[0]] > tot[order[1]] ? order[0] : -1);
      return { winner: winner, ranking: order, totals: tot };
    },
    ai: function (s, p, level, rng) {
      var acts = G.actions(s, p);
      if (!acts.length) return null;
      if (s.rolls === 0) return acts[0];
      if (level === 1) return rng.pick(acts);
      var ctx = makeCtx(s.sheet[p]), cnt = countsOf(s.dice), key = keyOf(cnt), now = bestField(ctx, cnt);
      if (s.rolls >= 3) return { score: now.field };
      var deadline = Date.now() + 300, table = [], i;
      if (level === 3 && s.rolls === 1) {
        /* Two rolls left: the value of each hand after the second roll is the better of writing it and rolling once
           more; the first roll is then weighed against that table. The clock guards the phone. */
        for (i = 0; i < HANDS.length; i++) {
          var h = HANDS[i], lv = leaf(ctx, h.key);
          if (Date.now() > deadline) { table[h.key] = lv; continue; }
          var e1 = expectAfterRoll(h.cnt, leafTable(ctx));
          table[h.key] = Math.max(lv, e1.e);
        }
      } else {
        table = leafTable(ctx);
      }
      var best = expectAfterRoll(cnt, table);
      if (now.v + rng.next() * 0.01 >= best.e) return { score: now.field };
      return { roll: keepMask(s.dice, best.kept) };
    },
    ui: {
      mount: function (el, api) {
        var Gfx = root.Gfx;
        function div(cls, parent) { var d = document.createElement('div'); d.className = cls; if (parent) parent.appendChild(d); return d; }
        /* A felt dice pad in a wooden rim at the top (or at the left when there is room), the kept dice slide down
           onto a wooden ledge, the score sheet is a printed paper block with a pen for the written scores. */
        var wrap = div('kn', el), main = div('kn-main', wrap), left = div('kn-left', main);
        var pad = div('kn-pad gfx-frame gfx-felt', left), ledge = div('kn-ledge gfx-wood', pad), diceEl = div('kn-dice', pad);
        var rollBtn = document.createElement('button'); rollBtn.className = 'kn-roll'; left.appendChild(rollBtn);
        var hint = div('kn-hint', left);
        var sheet = div('kn-sheet gfx-paper', main), table = div('kn-table', sheet);
        var style = document.createElement('style');
        style.textContent = '.kn{width:0;min-width:100%;margin:0 auto;user-select:none;-webkit-user-select:none}.kn-main{display:flex;flex-direction:column;gap:14px}' +
          '.kn.wide .kn-main{flex-direction:row;align-items:flex-start}.kn.wide .kn-left{flex:0 0 290px;position:sticky;top:70px}.kn-sheet{flex:1;min-width:0}' +
          '.kn-pad{position:relative;border-radius:6px;overflow:hidden}.kn-ledge{position:absolute;left:0;right:0;bottom:0;box-shadow:inset 0 3px 6px rgba(0,0,0,.55),0 -2px 4px rgba(0,0,0,.4)}' +
          '.kn-ledge:before{content:"";position:absolute;left:4%;right:4%;top:18%;bottom:18%;border-radius:4px;background:rgba(0,0,0,.28);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}' +
          '.kn-dice{position:absolute;left:0;top:0;width:100%;height:100%}' +
          '.kn-die{position:absolute;left:0;top:0;cursor:pointer;transition:transform .3s cubic-bezier(.3,1.3,.5,1);will-change:transform}.kn.fast .kn-die{transition:none}' +
          '.kn-die .gfx{display:block;transition:filter .2s}.kn-die.keep .gfx{filter:drop-shadow(0 0 4px var(--kc,#f5c542))}' +
          '.kn-die.tumble .gfx{animation:kntumble .5s ease-out}.kn-die.slot{opacity:.5}' +
          '.kn-die.slot .gfx{filter:none}' +
          '@keyframes kntumble{0%{transform:translateY(-40px) rotate(-250deg) scale(.6)}60%{transform:translateY(4px) rotate(22deg) scale(1.05)}80%{transform:translateY(-3px) rotate(-6deg)}100%{transform:none}}' +
          '.kn-roll{display:block;width:100%;margin-top:12px;min-height:46px;padding:10px 16px;border-radius:12px;border:0;font-size:16px;font-weight:700;cursor:pointer;color:#fff;background:linear-gradient(#3f9a52,#226b33);box-shadow:0 3px 8px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.3)}' +
          '.kn-roll:disabled{opacity:.4;cursor:default}.kn-roll:active{transform:scale(.98)}' +
          '.kn-hint{text-align:center;font-size:13px;opacity:.85;min-height:18px;margin-top:8px}' +
          '.kn-sheet{border-radius:3px;padding:10px 12px 14px;color:#2b3550;box-shadow:0 10px 28px rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.4) inset;background-size:300px 300px;font-family:Georgia,"Times New Roman",serif}' +
          '.kn-table{display:grid;border:1.5px solid #4a5676;border-radius:2px}' +
          '.kn-c{display:flex;align-items:center;justify-content:center;min-height:40px;padding:2px 6px;border-bottom:1px solid #8a93ab;border-right:1px solid #8a93ab;font-size:14px;white-space:nowrap;position:relative;overflow:hidden}' +
          '.kn-c.lbl{justify-content:flex-start;text-align:left;overflow:hidden;text-overflow:ellipsis;display:block;line-height:36px}.kn-c:nth-last-child(1){border-right:0}' +
          '.kn-c.title{grid-column:1/-1;font-weight:700;font-size:17px;letter-spacing:.14em;text-transform:uppercase;justify-content:space-between;padding:4px 10px;border-bottom:2px solid #4a5676;min-height:44px}.kn-c.title small{font-size:12px;letter-spacing:0;text-transform:none;font-weight:400;opacity:.8}' +
          '.kn-c.sec{grid-column:1/-1;justify-content:flex-start;font-weight:700;letter-spacing:.06em;background:rgba(70,86,118,.14);min-height:30px;font-size:13px;text-transform:uppercase}' +
          '.kn-c.head{font-weight:700;min-height:40px}.kn-c.head i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--pc);margin-right:6px;box-shadow:inset -1px -2px 0 rgba(0,0,0,.3)}' +
          '.kn-c.cur{background:rgba(255,226,110,.42)}.kn-c.head.cur{background:rgba(255,226,110,.6)}' +
          '.kn-c.sum{font-weight:700;min-height:30px;background:rgba(70,86,118,.07)}.kn-c.sumv{font-weight:700;min-height:30px;background:rgba(70,86,118,.07)}.kn-c.dbl{border-top:3px double #4a5676}' +
          '.kn-c.set,.kn-c.sumv.ink{font-family:"Bradley Hand","Segoe Script","Comic Sans MS",cursive;color:#1f3b8f;font-size:19px;font-weight:700;transform:rotate(-2deg)}' +
          '.kn-c.last:after,.kn-c.win:after{content:"";position:absolute;left:18%;right:18%;top:4px;bottom:4px;border:2px solid #1f3b8f;border-radius:50%;opacity:.75;transform:rotate(-4deg)}' +
          '.kn-c.free{cursor:pointer;font-style:italic;color:rgba(60,70,95,.42)}.kn-c.free.good{color:rgba(31,59,143,.62)}.kn-c.free:active{background:rgba(255,226,110,.8)}' +
          '.kn-c.taken{color:#9a7b4d;font-style:italic;font-size:12px;opacity:.8}' +
          '@media (max-width:420px){.kn-c{padding:2px 3px;font-size:12px}.kn-c.set,.kn-c.sumv.ink{font-size:16px}.kn-c.title{font-size:14px}.kn-sheet{padding:8px 6px 10px}}';
        el.appendChild(style);
        var view = null, info = null, keep = [false, false, false, false, false], lastTurn = -1, dieEls = [], geo = null, tumbleTimer = 0, tumbleEnd = 0, i;
        for (i = 0; i < 5; i++) { var de = div('kn-die', diceEl); de.dataset.i = i; dieEls.push(de); }
        function fast() { return !!(root.App && root.App.fast); }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        /* The pad geometry: five dice in a row in the rolling area, the same five columns on the ledge below. */
        function layout() {
          var avail = Math.max(300, wrap.clientWidth || el.clientWidth || 320), wide = avail >= 620;
          wrap.classList.toggle('wide', wide);
          var padW = wide ? 290 : avail, inner = padW - 20, m = 12, gap = 8, size = Math.min(66, Math.floor((inner - 2 * m - 4 * gap) / 5));
          var rowH = size * 1.1 + 2 * m, ledgeH = size * 1.1 + 2 * m, H = rowH + ledgeH;
          pad.style.height = H + 'px'; ledge.style.height = ledgeH + 'px';
          var x0 = (inner - (5 * size + 4 * gap)) / 2;
          geo = { size: size, x0: x0, gap: gap, yRoll: m + size * 0.05, yKeep: rowH + m + size * 0.05, wide: wide, avail: avail };
        }
        function placeDice(tumble) {
          var v = view, g = geo, k, d, has = v.dice.length > 0;
          for (k = 0; k < 5; k++) {
            d = dieEls[k];
            var kept = has && keep[k], x = g.x0 + k * (g.size + g.gap), y = kept ? g.yKeep : g.yRoll;
            d.className = 'kn-die' + (kept ? ' keep' : '') + (has ? '' : ' slot') + (tumble && !kept ? ' tumble' : '');
            var fresh = !d.style.transform;
            if (fresh) d.style.transition = 'none';
            d.style.width = g.size + 'px'; d.style.transform = 'translate(' + x + 'px,' + y + 'px)';
            if (fresh) (function (dd) { requestAnimationFrame(function () { dd.style.transition = ''; }); })(d);
            d.innerHTML = has ? Gfx.die(v.dice[k], g.size) : Gfx.die(0, g.size, '#4d7a5f');
            d.dataset.v = has ? v.dice[k] : 0;
          }
          if (tumble) {
            clearInterval(tumbleTimer); tumbleEnd = Date.now() + 420;
            tumbleTimer = setInterval(function () {
              var done = Date.now() >= tumbleEnd, j;
              for (j = 0; j < 5; j++) if (dieEls[j].classList.contains('tumble')) dieEls[j].innerHTML = Gfx.die(done ? +dieEls[j].dataset.v : 1 + Math.floor(Math.random() * 6), geo.size);
              if (done) clearInterval(tumbleTimer);
            }, 70);
          }
        }
        diceEl.onclick = function (ev) {
          var d = ev.target.closest ? ev.target.closest('.kn-die') : null;
          if (!d || !info || !info.canAct || !view || view.rolls === 0 || view.rolls >= 3) return;
          var k = +d.dataset.i; keep[k] = !keep[k]; placeDice(false);
        };
        rollBtn.onclick = function () {
          if (!info || !info.canAct || !view || view.rolls >= 3) return;
          if (view.rolls === 0) { api.act({ roll: [] }); return; }
          if (keep.every(function (k) { return k; })) { api.toast(api.t('keepAll')); return; }
          api.act({ roll: keep.slice() });
        };
        table.onclick = function (ev) {
          var c = ev.target.closest ? ev.target.closest('.kn-c.free') : null;
          if (!c || !info || !info.canAct || !view || view.rolls === 0) return;
          api.act({ score: c.dataset.f });
        };
        function renderSheet() {
          var v = view, inf = info, ov = G.over(v), me = inf.canAct ? v.turn : -1, cur = ov ? -1 : v.turn, q, f;
          var cnt = v.dice.length ? countsOf(v.dice) : null;
          table.style.gridTemplateColumns = 'minmax(' + (geo.avail < 420 ? 84 : 110) + 'px,1.6fr) repeat(' + v.n + ',minmax(44px,1fr))';
          var t = '<div class="kn-c title"><span>' + esc(root.I18N ? root.I18N.name(G.name) : G.name.en) + '</span><small>' + esc(api.t('round', v.round)) + '</small></div>';
          t += '<div class="kn-c lbl head"></div>';
          for (q = 0; q < v.n; q++) t += '<div class="kn-c head' + (cur === q ? ' cur' : '') + '" style="--pc:' + inf.colors[q] + '"><i></i>' + esc(inf.names[q]) + '</div>';
          function row(label, fn, cls) { t += '<div class="kn-c lbl ' + (cls || '') + '">' + esc(label) + '</div>'; for (var k = 0; k < v.n; k++) t += fn(k); }
          function fieldCell(q, field) {
            var val = v.sheet[q][field], last = v.last && v.last.p === q && v.last.field === field, c = cur === q ? ' cur' : '';
            if (val !== null) return '<div class="kn-c set' + c + (last ? ' last' : '') + '">' + val + '</div>';
            if (q === me && cnt) { var joker = isJoker(cnt, v.sheet[q]), sc = scoreOf(cnt, field, joker); return '<div class="kn-c free' + c + (sc > 0 ? ' good' : '') + '" data-f="' + field + '">' + sc + '</div>'; }
            return '<div class="kn-c' + c + '"></div>';
          }
          function sumCell(q, key, ink) { var tt = totals(v.sheet[q], v.bonus[q]), c = cur === q ? ' cur' : '', w = ov && key === 'total' && ov.winner === q && v.n > 1 ? ' win' : ''; return '<div class="kn-c sumv' + c + (ink ? ' ink' : '') + w + '">' + tt[key] + '</div>'; }
          t += '<div class="kn-c sec">' + esc(api.t('upperPart')) + '</div>';
          for (f = 0; f < UPPER.length; f++) (function (field) { row(api.t(field), function (q) { return fieldCell(q, field); }); })(UPPER[f]);
          row(api.t('upperSum'), function (q) { return sumCell(q, 'upper', true); }, 'sum dbl');
          row(api.t('bonus'), function (q) { return sumCell(q, 'upperBonus', totals(v.sheet[q], v.bonus[q]).upperBonus > 0); }, 'sum');
          t += '<div class="kn-c sec">' + esc(api.t('lowerPart')) + '</div>';
          for (f = 0; f < LOWER.length; f++) (function (field) { row(api.t(field), function (q) { return fieldCell(q, field); }); })(LOWER[f]);
          row(api.t('kBonus'), function (q) { return sumCell(q, 'kniffelBonus', totals(v.sheet[q], v.bonus[q]).kniffelBonus > 0); }, 'sum dbl');
          row(api.t('lowerSum'), function (q) { return sumCell(q, 'lower', true); }, 'sum');
          row(api.t('total'), function (q) { return sumCell(q, 'total', true); }, 'sum dbl');
          table.innerHTML = t;
        }
        function render(tumble) {
          if (!view) return;
          var v = view, inf = info, ov = G.over(v);
          layout();
          if (inf.colors && v.turn >= 0) diceEl.style.setProperty('--kc', inf.colors[v.turn]);
          placeDice(tumble);
          rollBtn.textContent = api.t('roll', 3 - v.rolls);
          rollBtn.disabled = !inf.canAct || v.rolls >= 3 || !!ov;
          hint.textContent = ov ? api.t('result', inf.names[ov.ranking[0]], ov.totals[ov.ranking[0]]) : !inf.canAct ? api.t('wait', inf.names[v.turn]) : v.rolls === 0 ? api.t('firstHint') : v.rolls >= 3 ? api.t('rolled') : api.t('keepHint');
          renderSheet();
        }
        var onResize = function () { if (view) render(false); };
        window.addEventListener('resize', onResize);
        /* The first update may run before the panel has its final width: measure again on the next frame and on every resize of the panel. */
        var ro = null, raf = requestAnimationFrame(function () { if (view && geo && Math.max(300, wrap.clientWidth || 0) !== geo.avail) render(false); });
        if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(function () { if (view && geo && Math.max(300, wrap.clientWidth || 0) !== geo.avail) render(false); }); ro.observe(el); }
        return {
          update: function (v, inf) {
            view = v; info = inf;
            wrap.classList.toggle('fast', fast());
            if (v.turn !== lastTurn || v.rolls === 0) { keep = [false, false, false, false, false]; lastTurn = v.turn; }
            var tumble = false;
            (inf.events || []).forEach(function (e) {
              if (e.e === 'dice') { keep = e.kept.slice(); api.sound('dice'); tumble = !fast(); }
              if (e.e === 'kniffel') api.toast(api.t('kniffelMade'));
              if (e.e === 'score') api.sound('move');
            });
            render(tumble);
          },
          destroy: function () { clearInterval(tumbleTimer); cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  /* The table of leaf values for every hand, filled once per decision. */
  function leafTable(ctx) {
    if (!ctx.table) { ctx.table = []; for (var i = 0; i < HANDS.length; i++) ctx.table[HANDS[i].key] = leaf(ctx, HANDS[i].key); }
    return ctx.table;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
