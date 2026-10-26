/* Spielkiste: the texts of the shell, German and English. Games bring their own (see docs/CONTRACT.md). */
(function (root) {
  'use strict';
  var DICT = {
    de: {
      title: 'Spielkiste', tagline: 'Die Klassiker, am Tisch oder über das Netz',
      play: 'Spielen', back: 'Zurück', close: 'Schließen', ok: 'OK', cancel: 'Abbrechen', copy: 'Kopieren', copied: 'Kopiert', share: 'Teilen', paste: 'Einfügen',
      players: 'Spieler', player: 'Spieler', you: 'Du', ai: 'Computer', aiLevel: 'Stärke', easy: 'Leicht', normal: 'Normal', hard: 'Schwer',
      mode: 'Modus', vsAi: 'Gegen den Computer', hotseat: 'Am selben Gerät', host: 'Runde eröffnen', join: 'Runde beitreten',
      name: 'Dein Name', nameHint: 'Wie sollen dich die anderen sehen?', count: 'Spielerzahl', start: 'Los geht\'s', lobby: 'Wartezimmer',
      invite: 'Einladungscode', 
      
      connect: 'Verbinden', connecting: 'Verbinde', connected: 'Verbunden', waiting: 'Warten auf den Gastgeber',
      makeCode: 'Code erzeugen', nextGuest: 'Nächsten Mitspieler einladen', seatFree: 'frei', seatAi: 'Computer', fillAi: 'Freie Plätze mit Computern füllen',
      noServer: 'Kein Server: die Geräte verbinden sich direkt miteinander (WebRTC). Der Gastgeber führt das Spiel.',
      turnOf: '{0} ist dran', yourTurn: 'Du bist dran', wait: 'Warte auf {0}', over: 'Spiel vorbei', youWin: 'Du gewinnst', wins: '{0} gewinnt', draw: 'Unentschieden', place: '{0}. Platz: {1}',
      again: 'Noch einmal', leave: 'Verlassen', leaveSure: 'Das Spiel wirklich verlassen?', resign: 'Aufgeben', resignSure: 'Wirklich aufgeben?', resigned: '{0} hat aufgegeben',
      disconnected: '{0} hat die Verbindung verloren', hostLeft: 'Der Gastgeber hat die Runde beendet', chat: 'Chat', send: 'Senden', say: 'Sag was',
      rules: 'Regeln', stats: 'Bilanz', won: 'gewonnen', lost: 'verloren', played: 'gespielt', sound: 'Ton', lang: 'Sprache', all: 'Alle', two: 'Zu zweit', many: 'In der Runde', solo: 'Allein',
      search: 'Spiel suchen', nGames: '{0} Spiele', minmax: '{0} bis {1} Spieler', exactly: '{0} Spieler', oneTo: '1 bis {0} Spieler',
      codeBad: 'Das ist kein gültiger Code', codeOk: 'Code angenommen', rtcNo: 'Dieser Browser kann keine Direktverbindung (WebRTC)', copyFail: 'Kopieren ging nicht, markiere den Code von Hand',
      thinking: 'Der Computer überlegt', seat: 'Platz {0}', kick: 'Entfernen', ready: 'Alle da. Starten?', color: 'Farbe', spectator: 'Zuschauer', yourSeat: 'Dein Platz',
      lanHint: 'Alle im selben WLAN? Dann klappt es ohne Internet. Sonst geht es über das Netz, wenn kein Router dazwischenfunkt.',
      installHint: 'Auf dem Handy: Teilen, dann "Zum Home-Bildschirm". Dann startet die Spielkiste wie eine App.',
      reconnect: 'Verbindung weg. Der Gastgeber kann dir einen neuen Code schicken.', hotseatHint: 'Reicht das Gerät herum: jeder zieht, wenn er dran ist.',
      aiHint: 'Du spielst gegen den Computer. Freie Plätze werden von Computern besetzt.', winsLabel: 'Siege', ranking: 'Platzierung', log: 'Verlauf', newMatch: 'Neues Spiel', howto: 'So geht\'s',
      inviteLink: "Einladung", inviteHint: "Schick dem nächsten Mitspieler den Link (Teilen, WhatsApp, egal wie) oder lass ihn den QR-Code mit der Handykamera scannen. Die Spielkiste öffnet sich bei ihm und schickt dir eine Antwort zurück.", answerHint: "Schick dem Gastgeber den Antwort-Link zurück, oder zeig ihm den QR-Code, er scannt ihn in seiner Spielkiste. Sobald er ihn hat, seid ihr verbunden.", answerPaste: "Antwort des Mitspielers", answerPasteHint: "Scan den QR-Code des Mitspielers oder füg seinen Antwort-Link ein.", joinPaste: "Einladung des Gastgebers", joinPasteHint: "Scan den QR-Code des Gastgebers mit der Kamera oder füg seinen Einladungs-Link hier ein.", scanQr: "QR-Code scannen", stopScan: "Scanner schließen", noCamera: "Keine Kamera verfügbar", scanNo: "Dieser Browser kann keine QR-Codes lesen, nimm den Link", codeRaw: "Code zum Abschreiben", linkCopied: "Link kopiert", answerTaken: "Antwort übernommen. Dieses Fenster kannst du schließen.", answerOrphan: "Kein wartendes Spielkisten-Fenster gefunden. Kopiere den Code und füg ihn beim Gastgeber ein.", joiningTitle: "Einladung angenommen", shareTitle: "Spielkiste: komm in meine Runde", answerShare: "Spielkiste: meine Antwort", answer: "Antwort", classics: "die Klassiker", intro: "Mensch ärgere Dich nicht, Schiffe versenken, Dame, Mühle, Kniffel, Mau-Mau und zwölf weitere. Gegen den Computer, zusammen an einem Gerät oder mit bis zu sechs Leuten über das Netz.", fact1: "18 Spiele, Deutsch und Englisch", fact2: "Kein Konto, kein Server, nichts wird gespeichert", fact3: "Läuft im Browser, auch offline als App"
    },
    en: {
      title: 'Spielkiste', tagline: 'The classics, at the table or over the net',
      play: 'Play', back: 'Back', close: 'Close', ok: 'OK', cancel: 'Cancel', copy: 'Copy', copied: 'Copied', share: 'Share', paste: 'Paste',
      players: 'Players', player: 'Player', you: 'You', ai: 'Computer', aiLevel: 'Strength', easy: 'Easy', normal: 'Normal', hard: 'Hard',
      mode: 'Mode', vsAi: 'Against the computer', hotseat: 'On this device', host: 'Host a table', join: 'Join a table',
      name: 'Your name', nameHint: 'How should the others see you?', count: 'Players', start: 'Start', lobby: 'Lobby',
      invite: 'Invite code', 
      
      connect: 'Connect', connecting: 'Connecting', connected: 'Connected', waiting: 'Waiting for the host',
      makeCode: 'Make a code', nextGuest: 'Invite the next player', seatFree: 'open', seatAi: 'Computer', fillAi: 'Fill open seats with computers',
      noServer: 'No server: the devices connect to each other directly (WebRTC). The host runs the game.',
      turnOf: '{0} to move', yourTurn: 'Your turn', wait: 'Waiting for {0}', over: 'Game over', youWin: 'You win', wins: '{0} wins', draw: 'Draw', place: '{0}. place: {1}',
      again: 'Play again', leave: 'Leave', leaveSure: 'Really leave the game?', resign: 'Resign', resignSure: 'Really resign?', resigned: '{0} resigned',
      disconnected: '{0} lost the connection', hostLeft: 'The host closed the table', chat: 'Chat', send: 'Send', say: 'Say something',
      rules: 'Rules', stats: 'Record', won: 'won', lost: 'lost', played: 'played', sound: 'Sound', lang: 'Language', all: 'All', two: 'Two players', many: 'A round', solo: 'Solo',
      search: 'Find a game', nGames: '{0} games', minmax: '{0} to {1} players', exactly: '{0} players', oneTo: '1 to {0} players',
      codeBad: 'That is not a valid code', codeOk: 'Code accepted', rtcNo: 'This browser cannot make a direct connection (WebRTC)', copyFail: 'Copying failed, select the code by hand',
      thinking: 'The computer is thinking', seat: 'Seat {0}', kick: 'Remove', ready: 'Everyone is here. Start?', color: 'Colour', spectator: 'Spectator', yourSeat: 'Your seat',
      lanHint: 'All on the same Wi-Fi? Then it works without the internet. Otherwise it goes over the net, unless a router gets in the way.',
      installHint: 'On a phone: Share, then "Add to Home Screen". Spielkiste then starts like an app.',
      reconnect: 'Connection lost. The host can send you a new code.', hotseatHint: 'Pass the device round: everyone moves on their turn.',
      aiHint: 'You play against the computer. Open seats are taken by computers.', winsLabel: 'Wins', ranking: 'Ranking', log: 'Log', newMatch: 'New game', howto: 'How to play',
      inviteLink: "Invitation", inviteHint: "Send the next player the link (Share, WhatsApp, any way) or let them scan the QR code with the phone camera. Spielkiste opens on their side and sends you an answer back.", answerHint: "Send the answer link back to the host, or show them the QR code to scan in their Spielkiste. As soon as they have it, you are connected.", answerPaste: "The player's answer", answerPasteHint: "Scan the player's QR code or paste their answer link.", joinPaste: "The host's invitation", joinPasteHint: "Scan the host's QR code with the camera or paste their invite link here.", scanQr: "Scan a QR code", stopScan: "Close the scanner", noCamera: "No camera available", scanNo: "This browser cannot read QR codes, use the link", codeRaw: "Code to copy by hand", linkCopied: "Link copied", answerTaken: "Answer taken. You can close this window.", answerOrphan: "No waiting Spielkiste window found. Copy the code and paste it at the host.", joiningTitle: "Invitation accepted", shareTitle: "Spielkiste: join my table", answerShare: "Spielkiste: my answer", answer: "Answer", classics: "the classics", intro: "Ludo, Battleship, Draughts, Nine Men's Morris, Yahtzee, Mau-Mau and twelve more. Against the computer, together on one device, or with up to six people over the net.", fact1: "18 games, German and English", fact2: "No account, no server, nothing is stored", fact3: "Runs in the browser, offline as an app too"
    }
  };
  var lang = 'de';
  try { var saved = localStorage.getItem('sk_lang'); if (saved === 'en' || saved === 'de') lang = saved; else if (navigator.language && !/^de/i.test(navigator.language)) lang = 'en'; } catch (e) { /* no storage */ }
  var extra = { de: {}, en: {} };
  function fill(s, args) { return String(s).replace(/\{(\d+)\}/g, function (m, i) { return args[+i] != null ? args[+i] : ''; }); }
  function t(key) {
    var args = Array.prototype.slice.call(arguments, 1);
    var s = (extra[lang] && extra[lang][key]) || DICT[lang][key] || (extra.en && extra.en[key]) || DICT.en[key] || key;
    return fill(s, args);
  }
  var api = {
    t: t, get lang() { return lang; },
    set: function (l) { lang = l === 'en' ? 'en' : 'de'; try { localStorage.setItem('sk_lang', lang); } catch (e) { /* no storage */ } },
    add: function (strings) { if (!strings) return; ['de', 'en'].forEach(function (l) { Object.keys(strings[l] || {}).forEach(function (k) { extra[l][k] = strings[l][k]; }); }); },
    // a game's own texts, looked up first in its own strings
    scoped: function (strings) { return function (key) { var args = Array.prototype.slice.call(arguments, 1); var s = (strings && strings[lang] && strings[lang][key]) || (strings && strings.en && strings.en[key]); return s != null ? fill(s, args) : t.apply(null, [key].concat(args)); }; },
    name: function (obj) { return obj ? (obj[lang] || obj.en || obj.de || '') : ''; }
  };
  root.I18N = api;
})(typeof self !== 'undefined' ? self : this);
