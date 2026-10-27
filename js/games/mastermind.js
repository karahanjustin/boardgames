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
        /* A wooden decoding board in a frame: the secret code under a wooden lid at the far end, ten rows of four
           dimples for glass marbles (row 1 nearest the player), a 2 x 2 cluster of small pins beside each row, and the
           marbles to pick from in a tray below the board. */
        var wrap = document.createElement('div'); wrap.className = 'mm-wrap';
        var board = document.createElement('div'); board.className = 'mm-board gfx-wood gfx-frame';
        function hole(k) { var h = document.createElement('div'); h.className = 'mm-hole'; h.dataset.k = k; return h; }
        var secretRow = document.createElement('div'); secretRow.className = 'mm-row mm-srow';
        var sNum = document.createElement('span'); sNum.className = 'mm-num'; secretRow.appendChild(sNum);
        var lidWrap = document.createElement('div'); lidWrap.className = 'mm-lidwrap';
        var sHoles = document.createElement('div'); sHoles.className = 'mm-holes';
        var secretHoles = [], k, i;
        for (k = 0; k < PEGS; k++) { var sh = hole(k); sHoles.appendChild(sh); secretHoles.push(sh); }
        var lid = document.createElement('div'); lid.className = 'mm-lid gfx-wood-dark'; lid.innerHTML = '<i></i>';
        lidWrap.appendChild(sHoles); lidWrap.appendChild(lid);
        var secretLabel = document.createElement('div'); secretLabel.className = 'mm-label';
        secretRow.appendChild(lidWrap); secretRow.appendChild(secretLabel);
        board.appendChild(secretRow);
        var rows = [];
        for (i = 0; i < MAX; i++) {
          var row = document.createElement('div'); row.className = 'mm-row';
          var num = document.createElement('span'); num.className = 'mm-num'; num.textContent = String(i + 1); row.appendChild(num);
          var holes = document.createElement('div'); holes.className = 'mm-holes';
          var pegs = [], fbs = [];
          for (k = 0; k < PEGS; k++) { var hh = hole(k); holes.appendChild(hh); pegs.push(hh); }
          row.appendChild(holes);
          var fbBox = document.createElement('div'); fbBox.className = 'mm-fb';
          for (k = 0; k < PEGS; k++) { var f = document.createElement('i'); fbBox.appendChild(f); fbs.push(f); }
          row.appendChild(fbBox);
          rows.push({ el: row, pegs: pegs, fbs: fbs });
        }
        for (i = MAX - 1; i >= 0; i--) board.appendChild(rows[i].el);
        var tray = document.createElement('div'); tray.className = 'mm-tray gfx-wood-dark';
        var input = [], view = null, info = null, me = -1;
        function role() { return view ? (view.code === null && !view.codeSet ? 'make' : 'break') : 'break'; }
        function acting() { return !!(info && info.canAct); }
        PALETTE.forEach(function (col, ci) {
          var b = document.createElement('button'); b.className = 'mm-swatch'; b.title = api.t(COLOR_KEYS[ci]);
          b.innerHTML = Gfx.marble(col, 44);
          b.onclick = function () { if (!acting() || input.length >= PEGS) return; input.push(ci); api.sound('move'); render(); };
          tray.appendChild(b);
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
        wrap.appendChild(board); wrap.appendChild(tray); wrap.appendChild(bar); wrap.appendChild(hint); wrap.appendChild(legend);
        el.appendChild(wrap);
        function layout() {
          var bw = Math.min(wrap.clientWidth || el.clientWidth || 340, 440);
          var peg = Math.max(26, Math.min(36, Math.floor((bw - 20 - 16 - 24 - 46 - 7 * 8) / 4)));
          wrap.style.setProperty('--peg', peg + 'px'); wrap.style.setProperty('--pin', Math.round(peg * 0.34) + 'px');
        }
        function setHole(h, c, editable) {
          h.className = 'mm-hole' + (c == null ? '' : ' filled') + (editable ? ' edit' : '');
          h.innerHTML = c == null ? '' : Gfx.marble(PALETTE[c], 40);
          h.title = c == null ? '' : api.t(COLOR_KEYS[c]);
        }
        function fillRow(row, code, fb, editable) {
          for (var k = 0; k < PEGS; k++) setHole(row.pegs[k], code ? code[k] : null, editable);
          for (k = 0; k < PEGS; k++) row.fbs[k].className = fb ? (k < fb.b ? 'b' : k < fb.b + fb.w ? 'w' : '') : '';
        }
        /* A tap on a marble in the row being filled takes it out again. */
        board.onclick = function (ev) {
          var t = ev.target;
          while (t && t !== board && !(t.classList && t.classList.contains('mm-hole'))) t = t.parentNode;
          if (!t || t === board || !t.classList.contains('edit')) return;
          var k = +t.dataset.k;
          if (k < input.length) { input.splice(k, 1); api.sound('move'); render(); }
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
          // The secret holes show the code to the maker and to everyone at the end; the lid stays shut for the breaker.
          var secret = v.code, showInput = editing && r === 'make';
          for (var k = 0; k < PEGS; k++) setHole(secretHoles[k], showInput ? input[k] : secret ? secret[k] : null, showInput);
          lid.classList.toggle('open', showInput || !!secret);
          secretRow.classList.toggle('current', showInput);
          secretLabel.textContent = ov ? api.t('codeWas') : api.t('secret');
          tray.style.display = editing ? '' : 'none'; bar.style.display = editing ? '' : 'none';
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
        style.textContent = '.mm-wrap{max-width:440px;margin:0 auto}' +
          '.mm-board{padding:8px 8px 6px;border-radius:4px}' +
          '.mm-row{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:8px;margin:1px 0;transition:background .3s}' +
          '.mm-row.current{background:rgba(255,235,190,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}' +
          '.mm-num{width:18px;flex:0 0 auto;text-align:right;font-size:11px;font-weight:700;color:rgba(0,0,0,.6);text-shadow:0 1px 0 rgba(255,255,255,.28)}' +
          '.mm-holes{display:flex;gap:8px}' +
          '.mm-hole{position:relative;width:var(--peg);height:var(--peg);border-radius:50%;flex:0 0 auto}' +
          '.mm-hole::before{content:"";position:absolute;left:21%;top:21%;width:58%;height:58%;border-radius:50%;background:radial-gradient(circle at 50% 35%,#1a0d05 0,#3a2212 60%,#4d2f19 100%);box-shadow:inset 0 2px 3px rgba(0,0,0,.95),0 1px 0 rgba(255,255,255,.22)}' +
          '.mm-hole.edit{cursor:pointer}.mm-hole.edit::after{content:"";position:absolute;left:-3px;top:-3px;right:-3px;bottom:-3px;border-radius:50%;box-shadow:0 0 0 2px rgba(255,255,255,.5)}' +
          '.mm-hole svg{position:absolute;left:-12%;top:-15%;width:124%;height:124%;overflow:visible}' +
          '.mm-hole.filled svg{animation:mmPop .22s ease-out}' +
          '.mm-fb{display:grid;grid-template-columns:repeat(2,var(--pin));gap:3px;margin-left:auto;padding:4px;border-radius:6px;background:rgba(0,0,0,.22);box-shadow:inset 0 1px 2px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.14)}' +
          '.mm-fb i{display:block;width:var(--pin);height:var(--pin);border-radius:50%;background:radial-gradient(circle at 50% 40%,#160b04 0,#30190c 65%,#3f2410 100%);box-shadow:inset 0 1px 2px rgba(0,0,0,.95)}' +
          '.mm-fb i.b{background:radial-gradient(circle at 35% 30%,#9a9a9a 0,#2c2c2c 40%,#000 100%);box-shadow:0 1px 2px rgba(0,0,0,.8);animation:mmPop .25s ease-out}' +
          '.mm-fb i.w{background:radial-gradient(circle at 35% 30%,#fff 0,#ececec 40%,#9a9a9a 100%);box-shadow:0 1px 2px rgba(0,0,0,.8);animation:mmPop .25s ease-out}' +
          '.mm-srow{margin-bottom:8px;padding-bottom:9px;border-bottom:2px solid rgba(0,0,0,.3);box-shadow:0 1px 0 rgba(255,255,255,.14);border-radius:8px 8px 0 0}' +
          '.mm-lidwrap{position:relative;perspective:420px}' +
          '.mm-lid{position:absolute;left:-7px;top:-6px;right:-7px;bottom:-6px;border-radius:7px;transform-origin:50% 0;transition:transform .9s cubic-bezier(.3,.7,.2,1);box-shadow:0 3px 6px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.25),inset 0 -2px 0 rgba(0,0,0,.4)}' +
          '.mm-lid i{position:absolute;left:50%;bottom:4px;width:12px;height:6px;margin-left:-6px;border-radius:3px;background:linear-gradient(#f3d36b,#9c7a1e);box-shadow:0 1px 1px rgba(0,0,0,.6)}' +
          '.mm-lid.open{transform:rotateX(-112deg)}' +
          '.mm-label{margin-left:auto;font-size:11px;font-weight:700;color:rgba(0,0,0,.62);text-shadow:0 1px 0 rgba(255,255,255,.28);text-align:right;line-height:1.2}' +
          '.mm-tray{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px auto 0;padding:8px 10px;border-radius:14px;box-shadow:inset 0 3px 8px rgba(0,0,0,.65),0 1px 0 rgba(255,255,255,.12),0 6px 16px rgba(0,0,0,.35)}' +
          '.mm-swatch{width:44px;height:44px;padding:0;border:0;background:none;cursor:pointer;line-height:0;border-radius:50%}.mm-swatch svg{overflow:visible}.mm-swatch:active{transform:translateY(2px)}' +
          '.mm-bar{display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap}' +
          '.mm-btn{font:inherit;font-size:14px;font-weight:600;min-height:42px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:inherit;cursor:pointer}.mm-btn:active{background:rgba(255,255,255,.25)}' +
          '.mm-hint{text-align:center;margin-top:10px;font-size:14px;opacity:.85;min-height:18px}.mm-legend{text-align:center;margin-top:6px;font-size:12px;opacity:.55}' +
          '@keyframes mmPop{from{transform:scale(.4)}to{transform:scale(1)}}';
        el.appendChild(style);
        var onResize = function () { layout(); };
        window.addEventListener('resize', onResize);
        layout();
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
          destroy: function () { window.removeEventListener('resize', onResize); el.innerHTML = ''; }
        };
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Games.register(G);
})(typeof self !== 'undefined' ? self : this);
