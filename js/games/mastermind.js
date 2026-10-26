/* Mastermind: one player sets a secret code of four pegs in six colours (repeats allowed), the other has ten guesses.
   Feedback is black for a right colour in the right place and white for a right colour in the wrong place. Rules,
   three AI levels (sloppy, consistent, Knuth style minimax) and a DOM board with a palette. */
(function (root) {
  'use strict';
  var COLORS = 6, PEGS = 4, MAX = 10;
  var ALL = (function () {
    var out = [], total = Math.pow(COLORS, PEGS);
    for (var i = 0; i < total; i++) { var c = [], v = i; for (var k = 0; k < PEGS; k++) { c.push(v % COLORS); v = Math.floor(v / COLORS); } out.push(c); }
    return out;
  })();
  /* The feedback for a guess against a code: b exact matches, w colour matches in the wrong place. */
  function feedback(code, guess) {
    var b = 0, cc = [0, 0, 0, 0, 0, 0], gc = [0, 0, 0, 0, 0, 0], k, w = 0;
    for (k = 0; k < PEGS; k++) { if (code[k] === guess[k]) b++; else { cc[code[k]]++; gc[guess[k]]++; } }
    for (k = 0; k < COLORS; k++) w += Math.min(cc[k], gc[k]);
    return { b: b, w: w };
  }
  function validCode(c) {
    if (!Array.isArray(c) || c.length !== PEGS) return false;
    for (var k = 0; k < PEGS; k++) if (typeof c[k] !== 'number' || c[k] !== Math.floor(c[k]) || c[k] < 0 || c[k] >= COLORS) return false;
    return true;
  }
  function agrees(code, g) { var fb = feedback(code, g.g); return fb.b === g.b && fb.w === g.w; }
  /* The indices of all codes that agree with every feedback so far. */
  function consistent(guesses) {
    var out = [];
    for (var i = 0; i < ALL.length; i++) {
      var good = true;
      for (var j = 0; j < guesses.length && good; j++) if (!agrees(ALL[i], guesses[j])) good = false;
      if (good) out.push(i);
    }
    return out;
  }
  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  var PALETTE = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa'];
  var COLOR_KEYS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
  var G = {
    id: 'mastermind',
    name: { de: 'Mastermind', en: 'Mastermind' },
    blurb: { de: 'Den geheimen Farbcode in zehn Versuchen knacken.', en: 'Crack the secret colour code in ten guesses.' },
    icon: '🎯',
    counts: [2],
    ai: true,
    hidden: true,
    strings: {
      de: {
        maker: 'Codesetzer', breaker: 'Coderater', secret: 'Geheimer Code', pickCode: 'Wähle vier Farben für den geheimen Code', setCode: 'Code setzen', randomCode: 'Zufälliger Code',
        guessHint: 'Wähle vier Farben und rate', guess: 'Raten', clear: 'Leeren', waitMaker: 'Warte, bis {0} den Code setzt', waitBreaker: '{0} rät', incomplete: 'Erst alle vier Felder füllen',
        attemptsLeft: 'Noch {0} Versuche', lastAttempt: 'Letzter Versuch', cracked: 'Code geknackt!', notCracked: 'Der Code wurde nicht geknackt', codeWas: 'Der Code war',
        legend: 'Schwarz: richtige Farbe am richtigen Platz. Weiß: richtige Farbe am falschen Platz.',
        red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb', orange: 'Orange', purple: 'Lila',
        rules: 'Ein Spieler setzt einen geheimen Code aus vier Farben, sechs Farben stehen zur Wahl und dürfen sich wiederholen. Der andere rät in bis zu zehn Versuchen. Nach jedem Versuch gibt es Hinweise: ein schwarzer Stift für jede richtige Farbe am richtigen Platz, ein weißer für jede richtige Farbe am falschen Platz. Wird der Code geknackt, gewinnt der Rater, sonst der Codesetzer.'
      },
      en: {
        maker: 'Codemaker', breaker: 'Codebreaker', secret: 'Secret code', pickCode: 'Pick four colours for the secret code', setCode: 'Set the code', randomCode: 'Random code',
        guessHint: 'Pick four colours and guess', guess: 'Guess', clear: 'Clear', waitMaker: 'Waiting for {0} to set the code', waitBreaker: '{0} is guessing', incomplete: 'Fill all four slots first',
        attemptsLeft: '{0} guesses left', lastAttempt: 'Last guess', cracked: 'Code cracked!', notCracked: 'The code was not cracked', codeWas: 'The code was',
        legend: 'Black: right colour in the right place. White: right colour in the wrong place.',
        red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', orange: 'Orange', purple: 'Purple',
        rules: 'One player sets a secret code of four colours, chosen from six, repeats allowed. The other has up to ten guesses. After each guess comes feedback: a black peg for every right colour in the right place, a white peg for every right colour in the wrong place. If the code is cracked the breaker wins, otherwise the codemaker.'
      }
    },
    create: function () { return { code: null, guesses: [], maker: 0, breaker: 1 }; },
    current: function (s) { if (!s.code) return s.maker; return G.over(s) ? -1 : s.breaker; },
    actions: function (s, p) {
      if (!s.code) return p === s.maker ? null : [];
      if (p !== s.breaker || G.over(s)) return [];
      return ALL.map(function (c) { return { guess: c.slice() }; });
    },
    validate: function (s, p, a) {
      if (!a || G.over(s)) return false;
      if (!s.code) return p === s.maker && (a.auto === true || validCode(a.code));
      return p === s.breaker && validCode(a.guess);
    },
    apply: function (s, p, a, rng) {
      var next = copy(s), events = [];
      if (!s.code) {
        next.code = a.auto ? [rng.int(COLORS), rng.int(COLORS), rng.int(COLORS), rng.int(COLORS)] : a.code.slice();
        events.push({ e: 'code' });
        return { state: next, events: events };
      }
      var fb = feedback(s.code, a.guess);
      next.guesses.push({ g: a.guess.slice(), b: fb.b, w: fb.w });
      events.push({ e: 'guess', row: s.guesses.length, b: fb.b, w: fb.w });
      if (fb.b === PEGS) events.push({ e: 'cracked' });
      else if (next.guesses.length >= MAX) events.push({ e: 'failed' });
      return { state: next, events: events };
    },
    over: function (s) {
      if (!s.code) return null;
      var last = s.guesses[s.guesses.length - 1];
      if (last && last.b === PEGS) return { winner: s.breaker, ranking: [s.breaker, s.maker], cracked: true };
      if (s.guesses.length >= MAX) return { winner: s.maker, ranking: [s.maker, s.breaker], cracked: false };
      return null;
    },
    /* The breaker never sees the code before the end; the maker always does. For p = -1 (hot seat, log) the view is
       the view of the player to act. */
    view: function (s, p) {
      if (p < 0) p = G.current(s);
      var v = copy(s);
      v.you = p;
      v.codeSet = !!s.code;
      if (!G.over(s) && p !== s.maker) v.code = null;
      return v;
    },
    ai: function (s, p, level, rng) {
      if (!s.code) return p === s.maker ? { auto: true } : null;
      if (p !== s.breaker || G.over(s)) return null;
      var guesses = s.guesses, i;
      if (level === 1) {
        // Level 1 only remembers the last feedback, so it often repeats old mistakes.
        var last = guesses[guesses.length - 1], pool = [];
        for (i = 0; i < ALL.length; i++) if (!last || agrees(ALL[i], last)) pool.push(i);
        return { guess: ALL[rng.pick(pool)].slice() };
      }
      var S = consistent(guesses);
      if (!S.length) return { guess: rng.pick(ALL).slice() };
      if (level === 2 || S.length <= 2) return { guess: ALL[rng.pick(S)].slice() };
      if (!guesses.length) return { guess: [0, 0, 1, 1] };
      // Level 3: the guess whose worst case leaves the fewest possibilities, codes still possible preferred.
      var inS = {}, cands = S.length > 400 ? S : null, best = [], bestScore = Infinity, j, c, counts, mx, fb, score;
      for (i = 0; i < S.length; i++) inS[S[i]] = 1;
      var total = cands ? cands.length : ALL.length;
      for (i = 0; i < total; i++) {
        c = cands ? cands[i] : i;
        counts = []; mx = 0;
        for (j = 0; j < S.length; j++) {
          fb = feedback(ALL[S[j]], ALL[c]);
          var key = fb.b * 5 + fb.w;
          counts[key] = (counts[key] || 0) + 1;
          if (counts[key] > mx) mx = counts[key];
        }
        score = mx * 2 + (inS[c] ? 0 : 1);
        if (score < bestScore) { bestScore = score; best = [c]; } else if (score === bestScore) best.push(c);
      }
      return { guess: ALL[rng.pick(best)].slice() };
    },
    ui: {
      mount: function (el, api) {
        var wrap = document.createElement('div'); wrap.className = 'mm-wrap';
        var secretBox = document.createElement('div'); secretBox.className = 'mm-secret';
        var secretLabel = document.createElement('div'); secretLabel.className = 'mm-label'; secretLabel.textContent = api.t('secret');
        var secretRow = document.createElement('div'); secretRow.className = 'mm-row';
        secretBox.appendChild(secretLabel); secretBox.appendChild(secretRow);
        var board = document.createElement('div'); board.className = 'mm-board';
        var rows = [];
        for (var i = 0; i < MAX; i++) {
          var row = document.createElement('div'); row.className = 'mm-row';
          var pegs = [], fbs = [];
          for (var k = 0; k < PEGS; k++) { var pg = document.createElement('div'); pg.className = 'mm-peg empty'; pg.dataset.k = k; row.appendChild(pg); pegs.push(pg); }
          var fbBox = document.createElement('div'); fbBox.className = 'mm-fb';
          for (k = 0; k < PEGS; k++) { var f = document.createElement('i'); fbBox.appendChild(f); fbs.push(f); }
          row.appendChild(fbBox);
          var num = document.createElement('span'); num.className = 'mm-num'; num.textContent = String(i + 1);
          row.appendChild(num);
          board.appendChild(row);
          rows.push({ el: row, pegs: pegs, fbs: fbs });
        }
        var palette = document.createElement('div'); palette.className = 'mm-palette';
        var input = [], view = null, info = null, me = -1;
        function role() { return view ? (view.code === null && !view.codeSet ? 'make' : 'break') : 'break'; }
        function acting() { return !!(info && info.canAct); }
        PALETTE.forEach(function (col, ci) {
          var b = document.createElement('button'); b.className = 'mm-swatch'; b.style.background = col; b.title = api.t(COLOR_KEYS[ci]);
          b.onclick = function () { if (!acting() || input.length >= PEGS) return; input.push(ci); api.sound('move'); render(); };
          palette.appendChild(b);
        });
        var bar = document.createElement('div'); bar.className = 'mm-bar';
        function button(key, fn) { var b = document.createElement('button'); b.className = 'mm-btn'; b.textContent = api.t(key); b.onclick = fn; bar.appendChild(b); return b; }
        var clearBtn = button('clear', function () { input = []; render(); });
        var randomBtn = button('randomCode', function () { if (acting() && role() === 'make') api.act({ auto: true }); });
        var goBtn = button('guess', function () {
          if (!acting()) return;
          if (input.length < PEGS) { api.toast(api.t('incomplete')); api.sound('wrong'); return; }
          api.act(role() === 'make' ? { code: input.slice() } : { guess: input.slice() });
          input = [];
        });
        var hint = document.createElement('div'); hint.className = 'mm-hint';
        var legend = document.createElement('div'); legend.className = 'mm-legend'; legend.textContent = api.t('legend');
        wrap.appendChild(secretBox); wrap.appendChild(board); wrap.appendChild(palette); wrap.appendChild(bar); wrap.appendChild(hint); wrap.appendChild(legend);
        el.appendChild(wrap);
        function fillRow(row, code, fb, editable) {
          for (var k = 0; k < PEGS; k++) {
            var pg = row.pegs[k], c = code ? code[k] : null;
            pg.className = 'mm-peg' + (c == null ? ' empty' : '') + (editable ? ' edit' : '');
            pg.style.background = c == null ? '' : PALETTE[c];
            pg.title = c == null ? '' : api.t(COLOR_KEYS[c]);
          }
          for (k = 0; k < PEGS; k++) row.fbs[k].className = fb ? (k < fb.b ? 'b' : k < fb.b + fb.w ? 'w' : '') : '';
        }
        board.onclick = function (ev) {
          var t = ev.target;
          if (!t.classList || !t.classList.contains('edit')) return;
          var k = +t.dataset.k;
          if (k < input.length) { input.splice(k, 1); render(); }
        };
        function render() {
          if (!view || !info) return;
          var v = view, ov = G.over(v), n = v.guesses.length, r = role(), editing = acting();
          for (var i = 0; i < MAX; i++) {
            var g = v.guesses[i], row = rows[i];
            var isInput = editing && r === 'break' && i === n;
            fillRow(row, g ? g.g : isInput ? input : null, g || null, isInput);
            row.el.classList.toggle('current', !ov && i === n && v.codeSet);
          }
          // The secret row shows the code to the maker and to everyone at the end, otherwise question marks or the input.
          var secret = v.code, showInput = editing && r === 'make';
          secretRow.innerHTML = '';
          for (var k = 0; k < PEGS; k++) {
            var pg = document.createElement('div'), c = showInput ? input[k] : secret ? secret[k] : null;
            pg.className = 'mm-peg' + (c == null ? ' empty' : '') + (showInput ? ' edit' : '') + (!secret && !showInput && v.codeSet ? ' unknown' : '');
            pg.dataset.k = k;
            if (c != null) { pg.style.background = PALETTE[c]; pg.title = api.t(COLOR_KEYS[c]); }
            if (showInput) pg.onclick = function (ev) { var kk = +ev.currentTarget.dataset.k; if (kk < input.length) { input.splice(kk, 1); render(); } };
            secretRow.appendChild(pg);
          }
          secretLabel.textContent = ov ? api.t('codeWas') : api.t('secret');
          palette.style.display = editing ? '' : 'none'; bar.style.display = editing ? '' : 'none';
          randomBtn.style.display = r === 'make' ? '' : 'none';
          goBtn.textContent = api.t(r === 'make' ? 'setCode' : 'guess');
          var text;
          if (ov) text = (ov.cracked ? api.t('cracked') : api.t('notCracked')) + ' ' + (ov.winner === me ? api.t('youWin') : api.t('wins', info.names[ov.winner]));
          else if (!v.codeSet) text = editing ? api.t('pickCode') : api.t('waitMaker', info.names[v.maker]);
          else if (editing) text = api.t('guessHint') + '. ' + (MAX - n === 1 ? api.t('lastAttempt') : api.t('attemptsLeft', MAX - n));
          else text = api.t('waitBreaker', info.names[v.breaker]) + '. ' + api.t('attemptsLeft', MAX - n);
          hint.textContent = text;
        }
        var style = document.createElement('style');
        style.textContent = '.mm-wrap{max-width:420px;margin:0 auto}' +
          '.mm-secret{background:rgba(0,0,0,.25);border-radius:12px;padding:8px 10px;margin-bottom:10px}.mm-label{font-size:12px;opacity:.7;margin-bottom:4px}' +
          '.mm-board{background:#5d4037;border-radius:14px;padding:8px;box-shadow:inset 0 0 0 3px #3e2723,0 8px 24px rgba(0,0,0,.35)}' +
          '.mm-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:8px;position:relative}.mm-board .mm-row.current{background:rgba(255,255,255,.12)}' +
          '.mm-peg{width:34px;height:34px;border-radius:50%;flex:0 0 auto;box-shadow:inset -3px -4px 0 rgba(0,0,0,.25),inset 2px 3px 0 rgba(255,255,255,.3),0 1px 2px rgba(0,0,0,.4);animation:mmPop .2s ease-out}' +
          '.mm-peg.empty{background:rgba(0,0,0,.35);box-shadow:inset 0 2px 4px rgba(0,0,0,.6);animation:none}.mm-peg.edit{cursor:pointer;outline:2px dashed rgba(255,255,255,.35);outline-offset:2px}' +
          '.mm-peg.unknown::after{content:"?";display:block;text-align:center;line-height:34px;font-weight:700;opacity:.6}' +
          '.mm-fb{display:grid;grid-template-columns:repeat(2,12px);gap:3px;margin-left:auto;padding:4px;background:rgba(0,0,0,.25);border-radius:6px}' +
          '.mm-fb i{display:block;width:12px;height:12px;border-radius:50%;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}.mm-fb i.b{background:#111;box-shadow:0 0 0 1px rgba(255,255,255,.3)}.mm-fb i.w{background:#f5f5f5}' +
          '.mm-num{font-size:11px;opacity:.5;width:16px;text-align:right}' +
          '.mm-palette{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}' +
          '.mm-swatch{width:40px;height:40px;border-radius:50%;border:3px solid rgba(255,255,255,.5);cursor:pointer;box-shadow:inset -3px -4px 0 rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.4)}.mm-swatch:hover{transform:scale(1.1)}' +
          '.mm-bar{display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap}' +
          '.mm-btn{font:inherit;font-size:14px;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:inherit;cursor:pointer}.mm-btn:hover{background:rgba(255,255,255,.2)}' +
          '.mm-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.85;min-height:18px}.mm-legend{text-align:center;margin-top:6px;font-size:12px;opacity:.55}' +
          '@keyframes mmPop{from{transform:scale(.4)}to{transform:scale(1)}}' +
          '@media (max-width:360px){.mm-peg{width:28px;height:28px}.mm-peg.unknown::after{line-height:28px}}';
        el.appendChild(style);
        return {
          update: function (v, inf) {
            var roleBefore = view ? role() : null, youBefore = view ? view.you : null;
            view = v; info = inf;
            me = v.you >= 0 ? v.you : inf.me;
            if (roleBefore !== role() || youBefore !== v.you) input = [];
            render();
            (inf.events || []).forEach(function (e) {
              if (e.e === 'guess') api.sound(e.b === PEGS ? 'win' : 'card');
              if (e.e === 'code') api.sound('turn');
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
