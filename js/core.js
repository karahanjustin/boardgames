/* Spielkiste: the shell. The hub with every game, the setup of a match (against the computer, on one device,
   hosting a table over a direct connection, joining one), the lobby with the invite codes, and the match itself:
   the host holds the state, runs the rules and the computer players, and sends every player his view. Games
   register themselves with Games.register (docs/CONTRACT.md). */
(function (root) {
  'use strict';
  var t = function () { return root.I18N.t.apply(null, arguments); };
  var COLORS = ['#e2443a', '#2f7de1', '#2eaf5e', '#f2b632', '#9b59d0', '#ff8a3d'];
  var registry = {}, order = [];
  root.Games = { register: function (G) { registry[G.id] = G; if (order.indexOf(G.id) < 0) order.push(G.id); }, get: function (id) { return registry[id]; }, all: function () { return order.map(function (id) { return registry[id]; }); } };

  /* ---------- small helpers ---------- */
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var h = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var deepEq = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    var r = {
      next: function () { s = (s + 0x6D2B79F5) >>> 0; var x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; },
      int: function (n) { return Math.floor(r.next() * n); },
      pick: function (a) { return a[r.int(a.length)]; },
      shuffle: function (a) { for (var i = a.length - 1; i > 0; i--) { var j = r.int(i + 1), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    };
    return r;
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('sk_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('sk_' + k, JSON.stringify(v)); } catch (e) { /* no storage */ } }
  };
  var settings = store.get('settings', { name: '', sound: true, level: 2 });
  var stats = store.get('stats', {});
  function toast(text, ms) { var box = $('#toasts'), d = h('div', 'toast', text); box.appendChild(d); setTimeout(function () { d.classList.add('out'); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 400); }, ms || 2600); }
  function confirmBox(text) {
    return new Promise(function (resolve) {
      var ov = h('div', 'modal-bg'), box = h('div', 'modal'); box.appendChild(h('p', '', text));
      var row = h('div', 'row'), yes = h('button', 'btn primary', t('ok')), no = h('button', 'btn', t('cancel'));
      row.appendChild(no); row.appendChild(yes); box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
      yes.onclick = function () { ov.remove(); resolve(true); }; no.onclick = function () { ov.remove(); resolve(false); };
    });
  }
  function modal(title, bodyEl) {
    var ov = h('div', 'modal-bg'), box = h('div', 'modal wide'); box.appendChild(h('h3', '', title)); box.appendChild(bodyEl);
    var x = h('button', 'btn', t('close')); x.onclick = function () { ov.remove(); }; box.appendChild(x); ov.appendChild(box); document.body.appendChild(ov);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    return ov;
  }
  /* sounds: a few short tones, nothing loaded */
  var AC = null;
  function sound(kind) {
    if (!settings.sound) return;
    try { AC = AC || new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return; }
    if (AC.state === 'suspended') AC.resume();
    var now = AC.currentTime, spec = { move: [[440, 0.06]], capture: [[330, 0.05], [220, 0.1]], dice: [[600, 0.03], [500, 0.03], [700, 0.05]], card: [[520, 0.05]], win: [[523, 0.1], [659, 0.1], [784, 0.2]], lose: [[392, 0.15], [311, 0.25]], turn: [[880, 0.07]], wrong: [[200, 0.12]], chat: [[700, 0.04]] }[kind] || [[440, 0.05]];
    var tt = now;
    spec.forEach(function (n) { var o = AC.createOscillator(), g = AC.createGain(); o.type = kind === 'dice' ? 'square' : 'triangle'; o.frequency.value = n[0]; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.18, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + n[1]); o.connect(g); g.connect(AC.destination); o.start(tt); o.stop(tt + n[1] + 0.02); tt += n[1]; });
  }

  /* ---------- screens ---------- */
  var app = $('#app'), current = null;
  function show(el) { app.innerHTML = ''; app.appendChild(el); window.scrollTo(0, 0); }
  function header(backFn, title) {
    var head = h('header', 'top');
    if (backFn) { var b = h('button', 'btn ghost back', '‹ ' + t('back')); b.onclick = backFn; head.appendChild(b); }
    var brand = h('div', 'brand'); brand.innerHTML = '<span class="logo">🎲</span><span>' + esc(title || t('title')) + '</span>'; head.appendChild(brand);
    var right = h('div', 'right');
    var lang = h('button', 'btn ghost', root.I18N.lang === 'de' ? 'EN' : 'DE'); lang.title = t('lang'); lang.onclick = function () { root.I18N.set(root.I18N.lang === 'de' ? 'en' : 'de'); if (current) current(); };
    var snd = h('button', 'btn ghost', settings.sound ? '🔊' : '🔇'); snd.title = t('sound'); snd.onclick = function () { settings.sound = !settings.sound; store.set('settings', settings); snd.textContent = settings.sound ? '🔊' : '🔇'; };
    right.appendChild(snd); right.appendChild(lang); head.appendChild(right);
    return head;
  }
  function countText(G) { var c = G.counts, mn = Math.min.apply(null, c), mx = Math.max.apply(null, c); return mn === mx ? t('exactly', mn) : mn === 1 ? t('oneTo', mx) : t('minmax', mn, mx); }

  /* the hub */
  var filter = 'all', query = '';
  function hub() {
    current = hub;
    var el = h('div', 'screen hub');
    el.appendChild(header(null));
    var intro = h('p', 'tagline', t('tagline')); el.appendChild(intro);
    var bar = h('div', 'bar');
    var chips = h('div', 'chips');
    [['all', 'all'], ['two', 'two'], ['many', 'many'], ['solo', 'solo']].forEach(function (f) { var c = h('button', 'chip' + (filter === f[0] ? ' on' : ''), t(f[1])); c.onclick = function () { filter = f[0]; hub(); }; chips.appendChild(c); });
    bar.appendChild(chips);
    var q = h('input', 'search'); q.placeholder = t('search'); q.value = query; q.oninput = function () { query = q.value; renderGrid(); }; bar.appendChild(q);
    el.appendChild(bar);
    var grid = h('div', 'grid'); el.appendChild(grid);
    function renderGrid() {
      grid.innerHTML = '';
      var list = root.Games.all().filter(function (G) {
        var c = G.counts, mx = Math.max.apply(null, c), mn = Math.min.apply(null, c);
        if (filter === 'two' && c.indexOf(2) < 0) return false;
        if (filter === 'many' && mx < 3) return false;
        if (filter === 'solo' && mn > 1) return false;
        if (query && (root.I18N.name(G.name) + ' ' + G.name.de + ' ' + G.name.en).toLowerCase().indexOf(query.toLowerCase()) < 0) return false;
        return true;
      });
      list.forEach(function (G) {
        var card = h('button', 'card');
        var st = stats[G.id] || { played: 0, won: 0 };
        card.innerHTML = '<span class="icon">' + G.icon + '</span><b>' + esc(root.I18N.name(G.name)) + '</b><span class="blurb">' + esc(root.I18N.name(G.blurb)) + '</span><span class="meta">' + esc(countText(G)) + (st.played ? ' · ' + st.won + '/' + st.played + ' ' + t('won') : '') + '</span>';
        card.onclick = function () { setup(G); };
        grid.appendChild(card);
      });
      if (!list.length) grid.appendChild(h('p', 'empty', t('nGames', 0)));
    }
    renderGrid();
    var foot = h('p', 'foot'); foot.textContent = t('noServer') + ' ' + t('installHint'); el.appendChild(foot);
    show(el);
  }

  /* the setup of a match */
  var setupMode = 'ai';
  function setup(G) {
    current = function () { setup(G); };
    var el = h('div', 'screen setup');
    el.appendChild(header(hub, root.I18N.name(G.name)));
    var box = h('div', 'panel');
    box.appendChild(h('p', 'blurb', root.I18N.name(G.blurb)));
    var rulesBtn = h('button', 'btn ghost small', t('rules')); rulesBtn.onclick = function () { var p = h('div'); p.innerHTML = '<p class="rules">' + esc(root.I18N.scoped(G.strings)('rules')) + '</p>'; modal(root.I18N.name(G.name), p); }; box.appendChild(rulesBtn);
    // the name
    var nameRow = h('label', 'field'); nameRow.appendChild(h('span', '', t('name')));
    var nameIn = h('input'); nameIn.placeholder = t('nameHint'); nameIn.value = settings.name || ''; nameIn.maxLength = 16; nameIn.oninput = function () { settings.name = nameIn.value; store.set('settings', settings); };
    nameRow.appendChild(nameIn); box.appendChild(nameRow);
    // the mode
    var modes = [['ai', 'vsAi'], ['hot', 'hotseat'], ['host', 'host'], ['join', 'join']];
    if (!G.ai) modes.shift();
    if (G.counts.length === 1 && G.counts[0] === 1) modes = [['ai', 'solo']];
    if (!root.Net.ok()) modes = modes.filter(function (m) { return m[0] !== 'host' && m[0] !== 'join'; });
    if (!modes.some(function (m) { return m[0] === setupMode; })) setupMode = modes[0][0];
    var modeRow = h('div', 'seg');
    modes.forEach(function (m) { var b = h('button', 'segbtn' + (setupMode === m[0] ? ' on' : ''), t(m[1])); b.onclick = function () { setupMode = m[0]; setup(G); }; modeRow.appendChild(b); });
    box.appendChild(h('div', 'label', t('mode'))); box.appendChild(modeRow);
    var hint = h('p', 'hint', setupMode === 'ai' ? t('aiHint') : setupMode === 'hot' ? t('hotseatHint') : t('noServer') + ' ' + t('lanHint')); box.appendChild(hint);
    var count = store.get('count_' + G.id, G.counts[Math.min(1, G.counts.length - 1)]);
    if (G.counts.indexOf(count) < 0) count = G.counts[0];
    var level = settings.level || 2;
    if (setupMode !== 'join') {
      if (G.counts.length > 1) {
        var cRow = h('div', 'seg');
        G.counts.forEach(function (n) { var b = h('button', 'segbtn' + (count === n ? ' on' : ''), String(n)); b.onclick = function () { count = n; store.set('count_' + G.id, n); setup(G); }; cRow.appendChild(b); });
        box.appendChild(h('div', 'label', t('count'))); box.appendChild(cRow);
      }
      if (G.ai && setupMode !== 'hot') {
        var lRow = h('div', 'seg');
        [[1, 'easy'], [2, 'normal'], [3, 'hard']].forEach(function (l) { var b = h('button', 'segbtn' + (level === l[0] ? ' on' : ''), t(l[1])); b.onclick = function () { level = l[0]; settings.level = l[0]; store.set('settings', settings); setup(G); }; lRow.appendChild(b); });
        box.appendChild(h('div', 'label', t('aiLevel'))); box.appendChild(lRow);
      }
    }
    var names = [];
    if (setupMode === 'hot') {
      var saved = store.get('hotnames', []);
      for (var i = 0; i < count; i++) { (function (i) { var row = h('label', 'field'); row.appendChild(h('span', '', t('seat', i + 1))); var inp = h('input'); inp.maxLength = 16; inp.value = saved[i] || (i === 0 && settings.name) || (t('player') + ' ' + (i + 1)); inp.style.borderColor = COLORS[i]; inp.oninput = function () { saved[i] = inp.value; store.set('hotnames', saved); }; names[i] = inp; row.appendChild(inp); box.appendChild(row); })(i); }
    }
    var go = h('button', 'btn primary big', setupMode === 'join' ? t('join') : setupMode === 'host' ? t('host') : t('start'));
    go.onclick = function () {
      var me = (settings.name || t('you')).trim() || t('you');
      if (setupMode === 'ai') {
        var ps = []; for (var i = 0; i < count; i++) ps.push(i === 0 ? { name: me, kind: 'local' } : { name: t('ai') + ' ' + i, kind: 'ai', level: level });
        startMatch(G, ps, { host: true });
      } else if (setupMode === 'hot') {
        startMatch(G, names.map(function (inp) { return { name: inp.value.trim() || t('player'), kind: 'local' }; }), { host: true, hot: true });
      } else if (setupMode === 'host') lobbyHost(G, count, level, me);
      else lobbyJoin(G, me);
    };
    box.appendChild(go);
    el.appendChild(box);
    show(el);
  }

  /* ---------- the lobby: hosting ---------- */
  var net = null; // the host's or guest's connection object while a table is open
  function codeBox(label, code, hintText) {
    var wrap = h('div', 'codebox'); wrap.appendChild(h('div', 'label', label));
    var ta = h('textarea'); ta.readOnly = true; ta.value = code; ta.rows = 3; wrap.appendChild(ta);
    var row = h('div', 'row');
    var cp = h('button', 'btn small', t('copy')); cp.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { toast(t('copied')); }, function () { ta.select(); toast(t('copyFail')); }); };
    row.appendChild(cp);
    if (navigator.share) { var sh = h('button', 'btn small', t('share')); sh.onclick = function () { navigator.share({ text: code }).catch(function () { /* cancelled */ }); }; row.appendChild(sh); }
    wrap.appendChild(row); wrap.appendChild(h('p', 'hint', hintText));
    return wrap;
  }
  function pasteBox(label, onCode) {
    var wrap = h('div', 'codebox'); wrap.appendChild(h('div', 'label', label));
    var ta = h('textarea'); ta.rows = 3; ta.placeholder = 'SK1.'; wrap.appendChild(ta);
    var row = h('div', 'row');
    if (navigator.clipboard && navigator.clipboard.readText) { var pb = h('button', 'btn small', t('paste')); pb.onclick = function () { navigator.clipboard.readText().then(function (v) { ta.value = v; }, function () { ta.focus(); }); }; row.appendChild(pb); }
    var go = h('button', 'btn small primary', t('connect')); go.onclick = function () { var v = ta.value.trim(); if (!v) { ta.focus(); return; } go.disabled = true; onCode(v).then(function () { go.disabled = false; }, function () { go.disabled = false; toast(t('codeBad')); }); };
    row.appendChild(go); wrap.appendChild(row);
    return wrap;
  }
  function lobbyHost(G, count, level, myName) {
    if (net) net.close();
    net = root.Net.host();
    var seats = [{ name: myName, kind: 'local' }];
    for (var i = 1; i < count; i++) seats.push({ name: '', kind: 'open' });
    var guestNames = {};
    net.on('message', function (peer, msg) { if (msg.t === 'hello') { guestNames[peer.id] = msg.name; render(); } });
    net.on('close', function (peer) { seats.forEach(function (s) { if (s.peer === peer.id) { s.kind = 'open'; s.name = ''; } }); render(); toast(t('disconnected', guestNames[peer.id] || '')); });
    net.on('open', function () { render(); });
    var pendingCode = null, pendingSeat = -1;
    function render() {
      current = render;
      var el = h('div', 'screen lobby');
      el.appendChild(header(function () { net.close(); net = null; setup(G); }, root.I18N.name(G.name)));
      var box = h('div', 'panel');
      box.appendChild(h('h3', '', t('lobby')));
      var list = h('div', 'seats');
      seats.forEach(function (s, i) {
        if (s.peer && guestNames[s.peer]) s.name = guestNames[s.peer];
        var row = h('div', 'seat'); row.style.borderColor = COLORS[i];
        row.appendChild(h('b', '', t('seat', i + 1)));
        row.appendChild(h('span', 'who', s.kind === 'local' ? s.name + ' (' + t('you') + ')' : s.kind === 'ai' ? t('seatAi') : s.kind === 'remote' ? (s.name || t('connected')) : t('seatFree')));
        if (i > 0) {
          var tog = h('button', 'btn small', s.kind === 'ai' ? t('seatFree') : t('seatAi'));
          tog.onclick = function () { if (s.kind === 'remote') return; s.kind = s.kind === 'ai' ? 'open' : 'ai'; s.level = level; render(); };
          if (s.kind !== 'remote') row.appendChild(tog);
        }
        list.appendChild(row);
      });
      box.appendChild(list);
      var openSeat = -1; seats.forEach(function (s, i) { if (openSeat < 0 && s.kind === 'open') openSeat = i; });
      if (openSeat >= 0) {
        if (pendingCode && pendingSeat === openSeat) {
          box.appendChild(codeBox(t('invite'), pendingCode, t('inviteHint')));
          box.appendChild(pasteBox(t('answerPaste'), function (code) {
            return net.accept(code).then(function (peer) { seats[openSeat].kind = 'remote'; seats[openSeat].peer = peer.id; pendingCode = null; pendingSeat = -1; toast(t('codeOk')); sound('turn'); render(); });
          }));
        } else {
          var mk = h('button', 'btn primary', pendingCode ? t('nextGuest') : t('makeCode'));
          mk.onclick = function () { mk.disabled = true; mk.textContent = t('connecting'); net.invite().then(function (code) { pendingCode = code; pendingSeat = openSeat; render(); }, function (e) { toast(t('rtcNo')); mk.disabled = false; }); };
          box.appendChild(mk);
        }
      }
      box.appendChild(h('p', 'hint', t('noServer') + ' ' + t('lanHint')));
      var canStart = seats.every(function (s) { return s.kind !== 'open'; });
      var fill = h('button', 'btn', t('fillAi')); fill.onclick = function () { seats.forEach(function (s) { if (s.kind === 'open') { s.kind = 'ai'; s.level = level; } }); render(); };
      if (!canStart && G.ai) box.appendChild(fill);
      var go = h('button', 'btn primary big', t('start')); go.disabled = !canStart;
      go.onclick = function () {
        var ps = seats.map(function (s, i) { return { name: s.kind === 'ai' ? t('ai') + ' ' + i : s.name || t('player') + ' ' + (i + 1), kind: s.kind, level: s.level || level, peer: s.peer }; });
        startMatch(G, ps, { host: true, net: net });
      };
      box.appendChild(go);
      el.appendChild(box);
      show(el);
    }
    render();
  }
  /* ---------- the lobby: joining ---------- */
  function lobbyJoin(G, myName) {
    if (net) { net.close(); net = null; }
    var el = h('div', 'screen lobby'), box = h('div', 'panel');
    el.appendChild(header(function () { if (net) net.close(); net = null; setup(G); }, t('join')));
    box.appendChild(h('h3', '', t('join')));
    var status = h('p', 'hint', t('noServer'));
    box.appendChild(pasteBox(t('joinPaste'), function (code) {
      return root.Net.join(code).then(function (conn) {
        net = conn;
        box.innerHTML = ''; box.appendChild(h('h3', '', t('join')));
        box.appendChild(codeBox(t('answer'), conn.answer, t('answerHint')));
        var st = h('p', 'status', t('waiting')); box.appendChild(st);
        conn.on('open', function () { st.textContent = t('connected') + '. ' + t('waiting'); conn.send({ t: 'hello', name: myName }); sound('turn'); });
        conn.on('close', function () { st.textContent = t('reconnect'); });
        conn.on('message', function (peer, msg) {
          if (msg.t === 'start') { var GG = root.Games.get(msg.game) || G; startMatch(GG, msg.players, { host: false, net: conn, seat: msg.seat, cfg: msg.cfg }); }
        });
      });
    }));
    box.appendChild(status);
    el.appendChild(box);
    show(el);
  }

  /* ---------- the match ---------- */
  var match = null;
  function startMatch(G, players, opts) {
    if (match) match.destroy();
    match = new Match(G, players, opts);
  }
  function Match(G, players, opts) {
    var self = this;
    this.G = G; this.players = players; this.host = !!opts.host; this.hot = !!opts.hot; this.netc = opts.net || null; this.seat = this.host ? -1 : opts.seat;
    this.tt = root.I18N.scoped(G.strings);
    this.log = []; this.over = null; this.ui = null; this.view = null; this.busy = false; this.think = 0; this.closed = false;
    var names = players.map(function (p) { return p.name; });
    this.names = names;
    this.el = h('div', 'screen match');
    var head = header(function () { self.leave(); }, root.I18N.name(G.name));
    this.el.appendChild(head);
    var body = h('div', 'matchbody'); this.el.appendChild(body);
    this.boardEl = h('div', 'board'); body.appendChild(this.boardEl);
    var side = h('aside', 'side'); body.appendChild(side);
    this.turnEl = h('div', 'turn'); side.appendChild(this.turnEl);
    this.listEl = h('div', 'players'); side.appendChild(this.listEl);
    this.logEl = h('div', 'log'); side.appendChild(this.logEl);
    if (this.netc) {
      var chat = h('form', 'chat'); var ci = h('input'); ci.placeholder = t('say'); ci.maxLength = 120; var cb = h('button', 'btn small', t('send')); chat.appendChild(ci); chat.appendChild(cb);
      chat.onsubmit = function (e) { e.preventDefault(); var text = ci.value.trim(); if (!text) return; ci.value = ''; self.chat(self.host ? 0 : self.seat, text); };
      side.appendChild(chat);
    }
    var acts = h('div', 'acts');
    var rb = h('button', 'btn small', t('rules')); rb.onclick = function () { var p = h('div'); p.innerHTML = '<p class="rules">' + esc(self.tt('rules')) + '</p>'; modal(root.I18N.name(G.name), p); }; acts.appendChild(rb);
    if (this.host) { var again = h('button', 'btn small', t('again')); again.onclick = function () { self.restart(); }; acts.appendChild(again); this.againBtn = again; }
    var lv = h('button', 'btn small danger', t('leave')); lv.onclick = function () { self.leave(); }; acts.appendChild(lv);
    side.appendChild(acts);
    show(this.el);
    current = null;
    // the game's own UI
    var api = {
      act: function (a) { self.localAct(a); },
      t: this.tt, get lang() { return root.I18N.lang; }, sound: sound, toast: toast, confirm: confirmBox,
      get me() { return self.me(); }, names: names, colors: COLORS.slice(0, players.length)
    };
    this.ui = G.ui.mount(this.boardEl, api);
    this.cfg = opts.cfg || { n: players.length, names: names, opts: {} };
    if (this.host) {
      this.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      this.rng = rng(this.seed);
      this.state = G.create(this.cfg, this.rng);
      if (this.netc) this.players.forEach(function (p, i) { if (p.kind === 'remote') self.netc.send(p.peer, { t: 'start', game: G.id, players: players.map(function (q) { return { name: q.name, kind: q.kind }; }), seat: i, cfg: self.cfg }); });
      this.wireHost();
      this.turn([]);
    } else {
      this.wireGuest();
    }
    this.renderList();
  }
  Match.prototype.me = function () {
    if (!this.host) return this.seat;
    if (this.hot) { var c = this.G.current(this.state); return c >= 0 && this.players[c].kind === 'local' ? c : this.firstLocal(); }
    return this.firstLocal();
  };
  Match.prototype.firstLocal = function () { for (var i = 0; i < this.players.length; i++) if (this.players[i].kind === 'local') return i; return -1; };
  Match.prototype.wireHost = function () {
    var self = this; if (!this.netc) return;
    this.netc.on('message', function (peer, msg) {
      var p = -1; self.players.forEach(function (q, i) { if (q.peer === peer.id) p = i; });
      if (p < 0) return;
      if (msg.t === 'act') self.actFrom(p, msg.a);
      else if (msg.t === 'chat') self.chat(p, msg.text);
      else if (msg.t === 'resign') self.resign(p);
    });
    this.netc.on('close', function (peer) {
      self.players.forEach(function (q, i) { if (q.peer === peer.id && q.kind === 'remote') { q.kind = 'ai'; q.level = 2; q.name = t('ai') + ' ' + i; self.names[i] = q.name; self.logLine(t('disconnected', q.name)); } });
      self.renderList(); self.turn([]);
    });
  };
  Match.prototype.wireGuest = function () {
    var self = this;
    this.netc.on('message', function (peer, msg) {
      if (msg.t === 'view') { self.view = msg.v; self.over = msg.over; self.info = msg.info; self.info.players = self.players; self.info.names = self.names; self.info.colors = COLORS.slice(0, self.players.length); self.info.lang = root.I18N.lang; self.info.me = self.seat; self.ui.update(msg.v, self.info); self.renderTurn(); if (msg.log) msg.log.forEach(function (l) { self.logLine(l); }); if (msg.over) self.finish(msg.over); else if (msg.info.canAct) sound('turn'); }
      else if (msg.t === 'chat') self.showChat(msg.p, msg.text);
      else if (msg.t === 'start') { startMatch(root.Games.get(msg.game) || self.G, msg.players, { host: false, net: self.netc, seat: msg.seat, cfg: msg.cfg }); }
      else if (msg.t === 'bye') { toast(t('hostLeft')); self.destroy(); hub(); }
    });
    this.netc.on('close', function () { toast(t('reconnect')); });
  };
  Match.prototype.canAct = function (p) { var G = this.G; if (this.over) return false; if (G.canAct) return G.canAct(this.state, p); return G.current(this.state) === p; };
  Match.prototype.legal = function (p, a) { var G = this.G; if (G.validate) return G.validate(this.state, p, a); return (G.actions(this.state, p) || []).some(function (x) { return deepEq(x, a); }); };
  /* the heart of a turn on the host: who is next, the computer thinks, the players get their views */
  Match.prototype.turn = function (events, log) {
    var self = this, G = this.G;
    this.over = G.over(this.state) || this.forced || null;
    this.broadcast(events, log);
    this.renderTurn();
    if (this.over) { this.finish(this.over); return; }
    var p = G.current(this.state);
    if (p < 0 && G.canAct) { for (var q = 0; q < this.players.length; q++) if (this.players[q].kind === 'ai' && G.canAct(this.state, q)) { p = q; break; } }
    if (p >= 0 && this.players[p].kind === 'ai') {
      this.busy = true;
      clearTimeout(this.think);
      this.think = setTimeout(function () {
        if (self.closed) return;
        var a = null;
        try { a = G.ai(self.state, p, self.players[p].level || 2, self.rng); } catch (e) { console.error(e); }
        if (a == null || !self.legal(p, a)) { console.warn('AI illegal action', G.id, a); var acts = G.actions(self.state, p) || []; a = acts.length ? self.rng.pick(acts) : null; }
        self.busy = false;
        if (a) self.actFrom(p, a);
      }, 350 + Math.random() * 250);
    }
  };
  Match.prototype.actFrom = function (p, a) {
    if (this.closed || this.over) return;
    if (!this.canAct(p) || !this.legal(p, a)) { if (this.players[p].kind === 'local') sound('wrong'); return; }
    var res = this.G.apply(this.state, p, a, this.rng);
    this.state = res.state;
    var ev = res.events || [];
    if (ev.some(function (e) { return e.e === 'dice'; })) sound('dice');
    else if (ev.some(function (e) { return e.e === 'capture' || e.e === 'hit'; })) sound('capture');
    else sound('move');
    this.turn(ev);
  };
  Match.prototype.localAct = function (a) {
    var me = this.me();
    if (me < 0) return;
    if (this.host) { if (this.busy) return; this.actFrom(me, a); }
    else { if (!this.info || !this.info.canAct) return; this.netc.send({ t: 'act', a: a }); }
  };
  Match.prototype.broadcast = function (events, log) {
    var self = this, G = this.G;
    this.players.forEach(function (p, i) {
      if (p.kind === 'remote' && self.netc) {
        var v = G.view ? G.view(self.state, i) : self.state;
        self.netc.send(p.peer, { t: 'view', v: v, over: self.over, info: { current: G.current(self.state), canAct: self.canAct(i), events: events, over: self.over }, log: log ? [log] : null });
      }
    });
    var me = this.me();
    var view = G.view ? G.view(this.state, me) : this.state;
    this.view = view;
    this.info = { me: me, current: G.current(this.state), canAct: me >= 0 && this.canAct(me) && !this.busy, over: this.over, events: events, players: this.players, names: this.names, colors: COLORS.slice(0, this.players.length), lang: root.I18N.lang };
    this.ui.update(view, this.info);
    if (log) this.logLine(log);
    if (this.hot && this.info.canAct && !this.over) sound('turn');
  };
  Match.prototype.renderTurn = function () {
    var G = this.G, c = this.host ? G.current(this.state) : (this.info ? this.info.current : -1);
    var me = this.me(), text;
    if (this.over) text = t('over');
    else if (c < 0) text = this.info && this.info.canAct ? t('yourTurn') : '';
    else if (c === me) text = t('yourTurn');
    else text = this.players[c] && this.players[c].kind === 'ai' ? t('thinking') : t('turnOf', this.names[c]);
    this.turnEl.textContent = text;
    this.turnEl.style.background = c >= 0 && !this.over ? COLORS[c] : '';
    this.renderList();
  };
  Match.prototype.renderList = function () {
    var self = this, G = this.G, c = this.host ? (this.state ? G.current(this.state) : -1) : (this.info ? this.info.current : -1);
    this.listEl.innerHTML = '';
    this.players.forEach(function (p, i) {
      var row = h('div', 'pl' + (i === c ? ' on' : '')); row.style.setProperty('--pc', COLORS[i]);
      row.innerHTML = '<i></i><span>' + esc(self.names[i]) + '</span><small>' + (p.kind === 'ai' ? t('ai') : p.kind === 'remote' ? '' : (i === self.me() || (self.hot && p.kind === 'local') ? t('you') : '')) + '</small>';
      self.listEl.appendChild(row);
    });
  };
  Match.prototype.logLine = function (text) { var d = h('div', '', text); this.logEl.appendChild(d); while (this.logEl.children.length > 40) this.logEl.removeChild(this.logEl.firstChild); this.logEl.scrollTop = 1e6; this.log.push(text); };
  Match.prototype.chat = function (p, text) {
    if (this.host) { this.showChat(p, text); if (this.netc) this.netc.broadcast({ t: 'chat', p: p, text: text }); }
    else { this.netc.send({ t: 'chat', text: text }); }
  };
  Match.prototype.showChat = function (p, text) { this.logLine((this.names[p] || '?') + ': ' + text); sound('chat'); };
  Match.prototype.resign = function (p) {
    if (this.over) return;
    var others = []; for (var i = 0; i < this.players.length; i++) if (i !== p) others.push(i);
    this.forced = { winner: others.length === 1 ? others[0] : null, ranking: others.concat([p]), resigned: p };
    this.turn([], t('resigned', this.names[p]));
  };
  Match.prototype.finish = function (ov) {
    var me = this.me(), text, G = this.G;
    if (this.hot) { text = ov.winner >= 0 ? t('wins', this.names[ov.winner]) : ov.ranking ? this.rankText(ov.ranking) : t('draw'); }
    else if (ov.winner === -1) text = t('draw');
    else if (ov.winner != null && ov.winner >= 0) text = ov.winner === me ? t('youWin') : t('wins', this.names[ov.winner]);
    else if (ov.ranking) text = this.rankText(ov.ranking);
    else text = t('over');
    var won = ov.winner === me || (ov.ranking && ov.ranking[0] === me);
    sound(won ? 'win' : ov.winner === -1 ? 'move' : 'lose');
    if (!this.hot && me >= 0 && !this.counted) { this.counted = true; var st = stats[G.id] || { played: 0, won: 0 }; st.played++; if (won) st.won++; stats[G.id] = st; store.set('stats', stats); }
    var b = h('div', 'banner'); b.appendChild(h('b', '', text)); if (ov.ranking && ov.winner !== -1) b.appendChild(h('span', '', this.rankText(ov.ranking)));
    this.boardEl.appendChild(b);
    this.logLine(text);
    if (this.againBtn) this.againBtn.classList.add('primary');
  };
  Match.prototype.rankText = function (r) { var self = this; return r.map(function (p, i) { return (i + 1) + '. ' + self.names[p]; }).join(', '); };
  Match.prototype.restart = function () {
    var ps = this.players.map(function (p) { return { name: p.name, kind: p.kind, level: p.level, peer: p.peer }; });
    startMatch(this.G, ps, { host: true, hot: this.hot, net: this.netc });
  };
  Match.prototype.leave = function () {
    var self = this;
    confirmBox(t('leaveSure')).then(function (yes) {
      if (!yes) return;
      if (self.host && self.netc) self.netc.broadcast({ t: 'bye' });
      if (!self.host && self.netc) self.netc.send({ t: 'resign' });
      if (self.netc) { self.netc.close(); net = null; }
      self.destroy(); hub();
    });
  };
  Match.prototype.destroy = function () { this.closed = true; clearTimeout(this.think); if (this.ui && this.ui.destroy) try { this.ui.destroy(); } catch (e) { /* gone */ } if (match === this) match = null; };

  root.App = { hub: hub, setup: setup, toast: toast, sound: sound, rng: rng, COLORS: COLORS, get match() { return match; }, startMatch: startMatch };
  document.addEventListener('DOMContentLoaded', function () {
    // a game named in the address opens straight away (links from the hub)
    var m = /[?&]game=([a-z0-9]+)/.exec(location.search);
    if (m && root.Games.get(m[1])) setup(root.Games.get(m[1])); else hub();
  });
})(typeof self !== 'undefined' ? self : this);
