/* Spielkiste: the direct connection between the players' devices, without a server. WebRTC data channels; the
   codes the players pass each other (by message, by hand) carry the connection offer and answer, compressed. The
   host makes one invite code per guest, the guest answers with one code back, and the two are connected. Only a
   public STUN address is used to find the way through routers; nothing of the game ever touches a server.
   Net.host() -> { invite(): Promise<code>, accept(answerCode): Promise, peers, on(event, fn), send(peerId, msg), broadcast(msg), close() }
   Net.join(inviteCode) -> Promise<{ answer: code, on, send, close }> */
(function (root) {
  'use strict';
  var ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
  var PREFIX = 'SK1.';
  function ok() { return typeof RTCPeerConnection !== 'undefined'; }
  /* ---------- the codes: the SDP squeezed, deflated when the browser can, base64url ---------- */
  var b64 = {
    enc: function (bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec: function (str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; var s = atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  };
  function squeeze(sdp) {
    // the lines that matter; the rest the other side can rebuild
    return sdp.split(/\r?\n/).filter(function (l) { return /^(v=|o=|s=|t=|m=|c=|a=(ice-ufrag|ice-pwd|fingerprint|setup|mid|sctp-port|max-message-size|candidate|end-of-candidates|ice-options|group|msid-semantic))/.test(l); }).join('\n');
  }
  function pack(obj) {
    var text = JSON.stringify(obj), bytes = new TextEncoder().encode(text);
    if (typeof CompressionStream === 'undefined') return Promise.resolve(PREFIX + 'p' + b64.enc(bytes));
    var cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (buf) { return PREFIX + 'z' + b64.enc(new Uint8Array(buf)); });
  }
  function unpack(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    if (code.indexOf(PREFIX) !== 0) return Promise.reject(new Error('code'));
    var kind = code.charAt(PREFIX.length), body = code.slice(PREFIX.length + 1), bytes;
    try { bytes = b64.dec(body); } catch (e) { return Promise.reject(new Error('code')); }
    if (kind === 'p') return Promise.resolve(JSON.parse(new TextDecoder().decode(bytes)));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('code'));
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new Response(ds.readable).text().then(function (text) { return JSON.parse(text); });
  }
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
      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gathered(pc); }).then(function () { return pack({ t: 'o', s: squeeze(pc.localDescription.sdp) }); });
    }
    function accept(code) {
      var peer = pending;
      if (!peer) return Promise.reject(new Error('no invite'));
      return unpack(code).then(function (o) {
        if (!o || o.t !== 'a' || !o.s) throw new Error('code');
        return peer.pc.setRemoteDescription({ type: 'answer', sdp: o.s + '\n' });
      }).then(function () { peers.push(peer); pending = null; return peer; });
    }
    return { invite: invite, accept: accept, peers: peers, on: em.on, send: function (id, msg) { peers.forEach(function (p) { if (p.id === id) p.send(msg); }); }, broadcast: function (msg) { peers.forEach(function (p) { p.send(msg); }); }, close: function () { peers.forEach(function (p) { p.close(); }); if (pending) pending.close(); } };
  }
  /* ---------- a guest ---------- */
  function join(code) {
    var em = emitter(), peer = { id: 0, open: false };
    return unpack(code).then(function (o) {
      if (!o || o.t !== 'o' || !o.s) throw new Error('code');
      var pc = new RTCPeerConnection(ICE);
      peer.pc = pc;
      pc.ondatachannel = function (e) { wire(pc, e.channel, peer, em); };
      return pc.setRemoteDescription({ type: 'offer', sdp: o.s + '\n' }).then(function () { return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); }).then(function () { return gathered(pc); }).then(function () { return pack({ t: 'a', s: squeeze(pc.localDescription.sdp) }); });
    }).then(function (answer) {
      return { answer: answer, on: em.on, send: function (msg) { if (peer.send) peer.send(msg); }, close: function () { if (peer.close) peer.close(); }, peer: peer };
    });
  }
  root.Net = { ok: ok, host: host, join: join, pack: pack, unpack: unpack };
})(typeof self !== 'undefined' ? self : this);
