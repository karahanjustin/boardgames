/* Boardgames: the direct connection between the players' devices, without a server. WebRTC data channels; the
   codes the players pass each other (by message, by hand) carry the connection offer and answer, compressed. The
   host makes one invite code per guest, the guest answers with one code back, and the two are connected. Only a
   public STUN address is used to find the way through routers; nothing of the game ever touches a server.
   Net.host() -> { invite(): Promise<code>, accept(answerCode): Promise, peers, on(event, fn), send(peerId, msg), broadcast(msg), close() }
   Net.join(inviteCode) -> Promise<{ answer: code, on, send, close }> */
(function (root) {
  'use strict';
  var ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
  function ok() { return typeof RTCPeerConnection !== 'undefined'; }
  /* ---------- the codes ----------
     A code carries only what the other side cannot make up itself: the DTLS fingerprint (32 bytes), the ICE
     candidates (an address and a port each) and, only when the browser refuses to take ours, the ICE user and
     password. The user and password are otherwise derived from the fingerprint on both sides, so they need no
     room in the code. Everything is packed into bytes and written in base32 (capitals and digits), in groups of
     four. A code is about 90 to 160 characters. */
  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32enc(bytes) { var out = '', bits = 0, val = 0; for (var i = 0; i < bytes.length; i++) { val = (val << 8) | bytes[i]; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
  function b32dec(str) { var out = [], bits = 0, val = 0; for (var i = 0; i < str.length; i++) { var v = B32.indexOf(str[i]); if (v < 0) throw new Error('code'); val = (val << 5) | v; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
  var MAGIC = 0xA7;
  function group(str) { return str.replace(/(.{4})/g, '$1 ').trim(); }
  function clean(str) { return (str || '').toUpperCase().replace(/[^A-Z2-7]/g, ''); }
  // the ICE user and password both sides derive from a fingerprint (ice-chars, long enough)
  function derivedIce(fp) { var s = b32enc(fp); return { ufrag: s.slice(0, 8), pwd: s.slice(8, 34) }; }
  function parseSdp(sdp) {
    var out = { cands: [], ufrag: '', pwd: '', fp: null, mid: '0' };
    sdp.split(/\r?\n/).forEach(function (l) {
      var m;
      if ((m = /^a=ice-ufrag:(\S+)/.exec(l))) out.ufrag = m[1];
      else if ((m = /^a=ice-pwd:(\S+)/.exec(l))) out.pwd = m[1];
      else if ((m = /^a=fingerprint:sha-256 ([0-9A-F:]+)/i.exec(l))) out.fp = new Uint8Array(m[1].split(':').map(function (h) { return parseInt(h, 16); }));
      else if ((m = /^a=mid:(\S+)/.exec(l))) out.mid = m[1];
      else if ((m = /^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ (host|srflx)/i.exec(l))) out.cands.push({ ip: m[1], port: +m[2], type: m[3].toLowerCase() });
    });
    return out;
  }
  function encodeCode(sdp, answer, iceOwn) {
    var p = parseSdp(sdp), bytes = [], seen = {};
    if (!p.fp || p.fp.length !== 32) throw new Error('fingerprint');
    // one address of each kind is enough: the first on the local network, the first seen from outside
    var cands = p.cands.filter(function (c) { if (seen[c.type]) return false; if (!(/^\d+\.\d+\.\d+\.\d+$/.test(c.ip) || /\.local$/i.test(c.ip))) return false; seen[c.type] = true; return true; });
    bytes.push(MAGIC, (answer ? 1 : 0) | (iceOwn ? 2 : 0));
    for (var i = 0; i < 32; i++) bytes.push(p.fp[i]);
    if (iceOwn) { bytes.push(p.ufrag.length); for (var u = 0; u < p.ufrag.length; u++) bytes.push(p.ufrag.charCodeAt(u)); bytes.push(p.pwd.length); for (var w = 0; w < p.pwd.length; w++) bytes.push(p.pwd.charCodeAt(w)); }
    bytes.push(cands.length);
    cands.forEach(function (c) {
      var mdns = /\.local$/i.test(c.ip);
      bytes.push((c.type === 'srflx' ? 2 : 0) | (mdns ? 1 : 0));
      if (mdns) { var hex = c.ip.replace(/\.local$/i, '').replace(/-/g, ''); for (var k = 0; k < 32; k += 2) bytes.push(parseInt(hex.substr(k, 2), 16) || 0); }
      else c.ip.split('.').forEach(function (n) { bytes.push(+n & 255); });
      bytes.push(c.port >> 8, c.port & 255);
    });
    return group(b32enc(new Uint8Array(bytes)));
  }
  function decodeCode(code) {
    var b = b32dec(clean(code)), i = 0;
    if (b.length < 35 || b[i++] !== MAGIC) throw new Error('code');
    var flags = b[i++], fp = b.slice(i, i + 32); i += 32;
    var ice;
    if (flags & 2) { var ul = b[i++], ufrag = ''; for (var u = 0; u < ul; u++) ufrag += String.fromCharCode(b[i++]); var pl = b[i++], pwd = ''; for (var w = 0; w < pl; w++) pwd += String.fromCharCode(b[i++]); ice = { ufrag: ufrag, pwd: pwd }; }
    else ice = derivedIce(fp);
    var n = b[i++], cands = [];
    for (var c = 0; c < n; c++) {
      var t = b[i++], ip;
      if (t & 1) { var hex = ''; for (var k = 0; k < 16; k++) hex += (b[i + k] < 16 ? '0' : '') + b[i + k].toString(16); i += 16; ip = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20) + '.local'; }
      else { ip = b[i] + '.' + b[i + 1] + '.' + b[i + 2] + '.' + b[i + 3]; i += 4; }
      var port = (b[i] << 8) | b[i + 1]; i += 2;
      cands.push({ ip: ip, port: port, type: (t & 2) ? 'srflx' : 'host' });
    }
    return { answer: !!(flags & 1), fp: fp, ice: ice, cands: cands };
  }
  // the whole SDP again from the few bytes of a code
  function buildSdp(d) {
    var fp = Array.prototype.map.call(d.fp, function (x) { return (x < 16 ? '0' : '') + x.toString(16).toUpperCase(); }).join(':');
    var lines = ['v=0', 'o=- 0 0 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', 'a=ice-ufrag:' + d.ice.ufrag, 'a=ice-pwd:' + d.ice.pwd, 'a=ice-options:trickle', 'a=fingerprint:sha-256 ' + fp, 'a=setup:' + (d.answer ? 'active' : 'actpass'), 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'];
    d.cands.forEach(function (c, i) {
      var prio = c.type === 'host' ? 2130706431 - i : 1694498815 - i;
      lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + prio + ' ' + c.ip + ' ' + c.port + ' typ ' + c.type + (c.type === 'srflx' ? ' raddr 0.0.0.0 rport 0' : '') + ' generation 0');
    });
    lines.push('a=end-of-candidates');
    return lines.join('\r\n') + '\r\n';
  }
  /* the local description with our own ICE user and password (derived from the fingerprint); when the browser
     will not take them, the real ones go into the code */
  function setLocal(pc, desc) {
    var p = parseSdp(desc.sdp);
    if (!p.fp || p.fp.length !== 32) return pc.setLocalDescription(desc).then(function () { return true; });
    var ice = derivedIce(p.fp), munged = desc.sdp.replace(/a=ice-ufrag:\S+/g, 'a=ice-ufrag:' + ice.ufrag).replace(/a=ice-pwd:\S+/g, 'a=ice-pwd:' + ice.pwd);
    return pc.setLocalDescription({ type: desc.type, sdp: munged }).then(function () { return false; }, function () { return pc.setLocalDescription(desc).then(function () { return true; }); });
  }
  function pack(sdp, answer, iceOwn) { try { return Promise.resolve(encodeCode(sdp, answer, iceOwn)); } catch (e) { return Promise.reject(e); } }
  function unpack(code) { try { return Promise.resolve(decodeCode(code)); } catch (e) { return Promise.reject(new Error('code')); } }
  // wait until the candidates are gathered (or a moment has passed), so the code holds the whole offer
  function gathered(pc) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === 'complete') { resolve(); return; }
      var t = setTimeout(resolve, 2500);
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); } });
    });
  }
  function emitter() {
    var fns = {};
    return { on: function (ev, fn) { (fns[ev] = fns[ev] || []).push(fn); }, emit: function (ev) { var args = Array.prototype.slice.call(arguments, 1); (fns[ev] || []).forEach(function (f) { try { f.apply(null, args); } catch (e) { console.error(e); } }); } };
  }
  function wire(pc, ch, peer, em) {
    ch.onopen = function () { peer.open = true; em.emit('open', peer); };
    ch.onclose = function () { if (peer.open) { peer.open = false; em.emit('close', peer); } };
    ch.onmessage = function (e) { var msg; try { msg = JSON.parse(e.data); } catch (err) { return; } em.emit('message', peer, msg); };
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') { if (peer.open) { peer.open = false; em.emit('close', peer); } } };
    peer.send = function (msg) { if (ch.readyState === 'open') ch.send(JSON.stringify(msg)); };
    peer.close = function () { try { ch.close(); } catch (e) { /* closed */ } try { pc.close(); } catch (e) { /* closed */ } };
  }
  /* ---------- the host ---------- */
  function host() {
    var em = emitter(), peers = [], pending = null, nextId = 1;
    function invite() {
      var pc = new RTCPeerConnection(ICE), ch = pc.createDataChannel('game', { ordered: true });
      var peer = { id: nextId++, open: false, pc: pc };
      wire(pc, ch, peer, em);
      pending = peer;
      var iceOwn = false;
      return pc.createOffer().then(function (o) { return setLocal(pc, o); }).then(function (own) { iceOwn = own; return gathered(pc); }).then(function () { return pack(pc.localDescription.sdp, false, iceOwn); });
    }
    function accept(code) {
      var peer = pending;
      if (!peer) return Promise.reject(new Error('no invite'));
      return unpack(code).then(function (d) {
        if (!d.answer) throw new Error('code');
        return peer.pc.setRemoteDescription({ type: 'answer', sdp: buildSdp(d) });
      }).then(function () { peers.push(peer); pending = null; return peer; });
    }
    return { invite: invite, accept: accept, peers: peers, on: em.on, send: function (id, msg) { peers.forEach(function (p) { if (p.id === id) p.send(msg); }); }, broadcast: function (msg) { peers.forEach(function (p) { p.send(msg); }); }, close: function () { peers.forEach(function (p) { p.close(); }); if (pending) pending.close(); } };
  }
  /* ---------- a guest ---------- */
  function join(code) {
    var em = emitter(), peer = { id: 0, open: false };
    var iceOwn = false;
    return unpack(code).then(function (d) {
      if (d.answer) throw new Error('code');
      var pc = new RTCPeerConnection(ICE);
      peer.pc = pc;
      pc.ondatachannel = function (e) { wire(pc, e.channel, peer, em); };
      return pc.setRemoteDescription({ type: 'offer', sdp: buildSdp(d) }).then(function () { return pc.createAnswer(); }).then(function (a) { return setLocal(pc, a); }).then(function (own) { iceOwn = own; return gathered(pc); }).then(function () { return pack(pc.localDescription.sdp, true, iceOwn); });
    }).then(function (answer) {
      return { answer: answer, on: em.on, send: function (msg) { if (peer.send) peer.send(msg); }, close: function () { if (peer.close) peer.close(); }, peer: peer };
    });
  }
  root.Net = { ok: ok, host: host, join: join, pack: pack, unpack: unpack, encode: encodeCode, decode: decodeCode, buildSdp: buildSdp };
})(typeof self !== 'undefined' ? self : this);
