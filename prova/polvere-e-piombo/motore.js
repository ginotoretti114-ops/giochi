/* Polvere e Piombo: le regole pure, senza interfaccia (si usa nella pagina e nei test con node).
   Copia fedele di un gioco western di ruoli nascosti, con nomi e grafica originali.

   Da 4 a 7 giocatori. Lo Sceriffo (scoperto) e i Vice devono eliminare Fuorilegge e Rinnegato; i Fuorilegge
   vogliono lo Sceriffo; il Rinnegato vuole restare l'ultimo. A turno: si pescano 2 carte, si giocano carte
   (un solo Sparo! per turno), si scarta fino ad averne quante i punti vita. Le distanze contano: si spara
   solo a chi è a portata dell'arma. «Estrai!» vuol dire scoprire la prima carta del mazzo e guardarne il seme.

   Le carte (80): id come sparo.7 o botte.2; ogni copia ha valore e seme (C cuori, Q quadri, F fiori, P picche).
   Le decisioni passano da una pila di passi (stack) e da un prompt per volta: chi deve rispondere è nextActor. */
(function (root) {
  'use strict';

  var MIN_PLAYERS = 4, MAX_PLAYERS = 7, LOG_MAX = 220;

  var TYPES = {
    sparo: { name: 'Sparo!', text: 'Spara a un giocatore a portata della tua arma: perde 1 punto vita se non schiva. Uno solo per turno.' },
    schivata: { name: 'Schivata!', text: 'Annulla uno Sparo! diretto a te. Si gioca quando ti sparano.' },
    borraccia: { name: 'Borraccia', text: 'Recuperi 1 punto vita (non oltre il massimo). Fuori turno solo per non morire. Non serve quando restate in 2.' },
    giro: { name: 'Giro di whisky', text: 'Tutti i giocatori in vita recuperano 1 punto vita.' },
    corriere: { name: 'Corriere', text: 'Peschi 2 carte.' },
    bottino: { name: 'Bottino', text: 'Peschi 3 carte.' },
    mercato: { name: 'Mercato', text: 'Si scoprono tante carte quanti sono i giocatori in vita: ognuno, a partire da te, ne prende una.' },
    borseggio: { name: 'Borseggio!', text: 'Prendi una carta a un giocatore a distanza 1: a caso dalla mano o una a scelta tra quelle in gioco.' },
    lazo: { name: 'Lazo', text: 'Fai scartare una carta a un giocatore a qualsiasi distanza: a caso dalla mano o una a scelta tra quelle in gioco.' },
    sfida: { name: 'Sfida', text: 'Sfidi un giocatore a qualsiasi distanza: a turno, cominciando da lui, scartate uno Sparo!. Chi non lo fa perde 1 punto vita.' },
    raffica: { name: 'Raffica', text: 'Spari a tutti gli altri giocatori, a qualsiasi distanza. Ognuno può schivare.' },
    bisonti: { name: 'Bisonti!', text: 'Una mandria travolge il paese: ogni altro giocatore scarta uno Sparo! o perde 1 punto vita. Niente Schivata!.' },
    botte: { name: 'Botte', blue: true, text: 'Quando ti sparano, estrai: se esce cuori, il colpo va a vuoto.' },
    galera: { name: 'Galera', blue: true, text: 'Si mette davanti a un altro giocatore (non allo Sceriffo). All\'inizio del suo turno estrae: con cuori evade, altrimenti salta il turno.' },
    candelotto: { name: 'Candelotto', blue: true, text: 'Si mette davanti a te. All\'inizio del turno estrai: dal 2 al 9 di picche esplode (3 punti vita), altrimenti passa al giocatore dopo.' },
    cannocchiale: { name: 'Cannocchiale', blue: true, text: 'Vedi tutti gli altri a distanza -1.' },
    cavallo: { name: 'Cavallo', blue: true, text: 'Gli altri ti vedono a distanza +1.' },
    rapida: { name: 'Pistola rapida', blue: true, weapon: 1, text: 'Arma con portata 1: puoi giocare quanti Sparo! vuoi nel tuo turno.' },
    revolver: { name: 'Revolver', blue: true, weapon: 2, text: 'Arma con portata 2.' },
    fucile: { name: 'Fucile', blue: true, weapon: 3, text: 'Arma con portata 3.' },
    carabina: { name: 'Carabina', blue: true, weapon: 4, text: 'Arma con portata 4.' },
    lungo: { name: 'Fucile lungo', blue: true, weapon: 5, text: 'Arma con portata 5.' }
  };
  // Il mazzo: [tipo, valore, seme]
  var LIST = [
    ['sparo', 'A', 'P'], ['sparo', '2', 'Q'], ['sparo', '3', 'Q'], ['sparo', '4', 'Q'], ['sparo', '5', 'Q'], ['sparo', '6', 'Q'], ['sparo', '7', 'Q'],
    ['sparo', '8', 'Q'], ['sparo', '9', 'Q'], ['sparo', '10', 'Q'], ['sparo', 'J', 'Q'], ['sparo', 'Q', 'Q'], ['sparo', 'K', 'Q'], ['sparo', 'A', 'Q'],
    ['sparo', '2', 'F'], ['sparo', '3', 'F'], ['sparo', '4', 'F'], ['sparo', '5', 'F'], ['sparo', '6', 'F'], ['sparo', '7', 'F'], ['sparo', '8', 'F'], ['sparo', '9', 'F'],
    ['sparo', 'Q', 'C'], ['sparo', 'K', 'C'], ['sparo', 'A', 'C'],
    ['schivata', '10', 'F'], ['schivata', 'J', 'F'], ['schivata', 'Q', 'F'], ['schivata', 'K', 'F'], ['schivata', 'A', 'F'],
    ['schivata', '2', 'P'], ['schivata', '3', 'P'], ['schivata', '4', 'P'], ['schivata', '5', 'P'], ['schivata', '6', 'P'], ['schivata', '7', 'P'], ['schivata', '8', 'P'],
    ['borraccia', '6', 'C'], ['borraccia', '7', 'C'], ['borraccia', '8', 'C'], ['borraccia', '9', 'C'], ['borraccia', '10', 'C'], ['borraccia', 'J', 'C'],
    ['giro', '5', 'C'], ['corriere', '9', 'P'], ['corriere', '9', 'P'], ['bottino', '3', 'C'], ['mercato', '9', 'F'], ['mercato', 'Q', 'P'],
    ['borseggio', 'J', 'C'], ['borseggio', 'Q', 'C'], ['borseggio', 'A', 'C'], ['borseggio', '8', 'Q'],
    ['lazo', 'K', 'C'], ['lazo', '9', 'Q'], ['lazo', '10', 'Q'], ['lazo', 'J', 'Q'],
    ['sfida', 'Q', 'Q'], ['sfida', 'J', 'P'], ['sfida', '8', 'F'], ['raffica', '10', 'C'], ['bisonti', 'K', 'Q'], ['bisonti', 'A', 'Q'],
    ['botte', 'Q', 'P'], ['botte', 'K', 'P'], ['candelotto', '2', 'C'], ['galera', 'J', 'P'], ['galera', '10', 'P'], ['galera', '4', 'C'],
    ['cannocchiale', 'A', 'P'], ['cavallo', '8', 'C'], ['cavallo', '9', 'C'],
    ['rapida', '10', 'P'], ['rapida', '10', 'F'], ['revolver', 'J', 'F'], ['revolver', 'Q', 'F'], ['revolver', 'K', 'P'],
    ['fucile', 'K', 'F'], ['carabina', 'A', 'F'], ['lungo', '8', 'P']
  ];
  var META = {}, ALL = [];
  (function () {
    var cnt = {};
    LIST.forEach(function (x) { cnt[x[0]] = (cnt[x[0]] || 0) + 1; var id = x[0] + '.' + cnt[x[0]]; META[id] = { k: x[0], r: x[1], s: x[2] }; ALL.push(id); });
  })();
  var RANK = { J: 11, Q: 12, K: 13, A: 14 };
  function rankNum(r) { return RANK[r] || +r; }

  var CHARS = [
    { id: 'cerotto', name: 'Nino Cerotto', hp: 4, art: '🩹', text: 'Ogni volta che perde un punto vita, pesca una carta dal mazzo.' },
    { id: 'fante', name: 'Fante Rosso', hp: 4, art: '🃏', text: 'Quando pesca, mostra la seconda carta: se è di cuori o di quadri, ne pesca un\'altra.' },
    { id: 'rovescio', name: 'Gina Rovescio', hp: 4, art: '🔁', text: 'Può usare gli Sparo! come Schivata! e le Schivata! come Sparo!.' },
    { id: 'rancore', name: 'Ciro Rancore', hp: 3, art: '😤', text: 'Ogni volta che un altro giocatore gli toglie un punto vita, gli prende a caso una carta dalla mano.' },
    { id: 'lesta', name: 'Mano Lesta', hp: 4, art: '🖐️', text: 'Quando pesca, può prendere la prima carta a caso dalla mano di un altro giocatore.' },
    { id: 'bottaio', name: 'Il Bottaio', hp: 4, art: '🔨', text: 'È come se avesse sempre una Botte in gioco; con una Botte vera estrae due volte.' },
    { id: 'veggente', name: 'Lina Veggente', hp: 4, art: '🔮', text: 'Quando pesca, guarda le prime 3 carte del mazzo, ne tiene 2 e rimette l\'altra in cima.' },
    { id: 'quadrifoglio', name: 'Quadrifoglio', hp: 4, art: '🍀', text: 'Quando deve estrarre, scopre 2 carte e tiene la migliore.' },
    { id: 'sfuggente', name: 'Lo Sfuggente', hp: 3, art: '🏃', text: 'È come se avesse sempre un Cavallo: gli altri lo vedono a distanza +1.' },
    { id: 'raccatta', name: 'Zio Raccatta', hp: 4, art: '🧺', text: 'Quando pesca, può prendere la prima carta dalla cima degli scarti.' },
    { id: 'falco', name: 'Occhio di Falco', hp: 4, art: '🦅', text: 'È come se avesse sempre un Cannocchiale: vede gli altri a distanza -1.' },
    { id: 'erbetta', name: 'Doc Erbetta', hp: 4, art: '🌿', text: 'Può scartare 2 carte per recuperare 1 punto vita, anche più volte, anche per non morire.' },
    { id: 'macigno', name: 'Il Macigno', hp: 4, art: '🪨', text: 'Per schivare i suoi Sparo! servono 2 Schivata!.' },
    { id: 'vuote', name: 'Mani Vuote', hp: 4, art: '👐', text: 'Quando resta senza carte in mano, ne pesca subito una.' },
    { id: 'becchino', name: 'Il Becchino', hp: 4, art: '⚰️', text: 'Quando un altro giocatore viene eliminato, prende tutte le sue carte.' },
    { id: 'grilletto', name: 'Grilletto', hp: 4, art: '🤠', text: 'Può giocare quanti Sparo! vuole nel suo turno.' }
  ];
  var CHAR = {}; CHARS.forEach(function (c) { CHAR[c.id] = c; });
  var ROLES = { S: 'Sceriffo', V: 'Vice', F: 'Fuorilegge', R: 'Rinnegato' };
  var ROLES_BY_N = { 4: ['S', 'R', 'F', 'F'], 5: ['S', 'R', 'F', 'F', 'V'], 6: ['S', 'R', 'F', 'F', 'F', 'V'], 7: ['S', 'R', 'F', 'F', 'F', 'V', 'V'] };

  function info(id) { return META[id] || null; }
  function kindOf(id) { var m = META[id]; return m ? m.k : null; }
  function typeOf(id) { var m = META[id]; return m ? TYPES[m.k] : null; }

  /* ---------- caso ---------- */
  var rng = null;
  function randInt(n) {
    if (rng) return Math.floor(rng() * n);
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && c.getRandomValues) {
      var buf = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n, x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pushLog(s, e) {
    s.logN = (s.logN || 0) + 1; e.i = s.logN;
    s.log = (s.log || []).concat([e]);
    if (s.log.length > LOG_MAX) s.log = s.log.slice(s.log.length - LOG_MAX);
  }
  function touch(s, prevV) { s.v = (prevV || 0) + 1; s.updatedAt = Date.now(); return s; }

  /* ---------- chi ha cosa ---------- */
  function n(s) { return s.seats.length; }
  function charOf(s, p) { return s.char[p]; }
  function tableCard(s, p, k) { var t = s.table[p] || []; for (var i = 0; i < t.length; i++) if (kindOf(t[i]) === k) return t[i]; return null; }
  function weaponOf(s, p) { var t = s.table[p] || []; for (var i = 0; i < t.length; i++) if (TYPES[kindOf(t[i])].weapon) return t[i]; return null; }
  function reach(s, p) { var w = weaponOf(s, p); return w ? TYPES[kindOf(w)].weapon : 1; }
  function unlimited(s, p) { var w = weaponOf(s, p); return charOf(s, p) === 'grilletto' || (!!w && kindOf(w) === 'rapida'); }
  function aliveList(s) { var a = []; for (var i = 0; i < n(s); i++) if (s.alive[i]) a.push(i); return a; }
  function aliveCount(s) { return aliveList(s).length; }
  function nextAlive(s, p) { for (var i = 1; i <= n(s); i++) { var q = (p + i) % n(s); if (s.alive[q]) return q; } return p; }
  // Distanza: i posti tra due giocatori in vita (nel verso più corto), più Cavallo e Sfuggente, meno Cannocchiale e Falco.
  function seatDist(s, a, b) {
    var list = aliveList(s);
    if (list.indexOf(a) < 0 || list.indexOf(b) < 0) return 99;
    var d = Math.abs(list.indexOf(a) - list.indexOf(b));
    return Math.min(d, list.length - d);
  }
  function dist(s, a, b) {
    if (a === b) return 0;
    var d = seatDist(s, a, b);
    if (tableCard(s, b, 'cavallo')) d++;
    if (charOf(s, b) === 'sfuggente') d++;
    if (tableCard(s, a, 'cannocchiale')) d--;
    if (charOf(s, a) === 'falco') d--;
    return Math.max(1, d);
  }
  function inHand(s, p, c) { return (s.hand[p] || []).indexOf(c) >= 0; }
  function asBang(s, p, c) { var k = kindOf(c); return k === 'sparo' || (k === 'schivata' && charOf(s, p) === 'rovescio'); }
  function asDodge(s, p, c) { var k = kindOf(c); return k === 'schivata' || (k === 'sparo' && charOf(s, p) === 'rovescio'); }
  function bangCards(s, p) { return (s.hand[p] || []).filter(function (c) { return asBang(s, p, c); }); }
  function dodgeCards(s, p) { return (s.hand[p] || []).filter(function (c) { return asDodge(s, p, c); }); }
  function isRed(c) { var m = META[c]; return m.s === 'C' || m.s === 'Q'; }

  /* ---------- mazzo ---------- */
  function draw(s) {
    if (!s.deck.length) {
      if (!s.discard.length) return null;
      s.deck = shuffle(s.discard); s.discard = [];
      pushLog(s, { t: 'reshuffle' });
    }
    return s.deck.pop();
  }
  function drawN(s, p, k) { var got = 0; for (var i = 0; i < k; i++) { var c = draw(s); if (c == null) break; s.hand[p].push(c); got++; } return got; }
  function takeFromHand(s, p, c) { var i = s.hand[p].indexOf(c); if (i >= 0) s.hand[p].splice(i, 1); }
  function takeFromTable(s, p, c) { var i = s.table[p].indexOf(c); if (i >= 0) s.table[p].splice(i, 1); }
  function toss(s, c) { s.discard.push(c); }
  // «Estrai!»: si scopre la prima carta del mazzo e va negli scarti. Quadrifoglio ne scopre 2 e tiene la migliore.
  function estrai(s, p, why, test, want) {
    var k = charOf(s, p) === 'quadrifoglio' ? 2 : 1, got = [];
    for (var i = 0; i < k; i++) { var c = draw(s); if (c != null) got.push(c); }
    if (!got.length) return !want; // mazzo vuoto: va male
    var pick = got[0];
    got.forEach(function (c) { if (!!test(META[c]) === want) pick = c; });
    if (got.length > 1 && !!test(META[got[0]]) === want) pick = got[0];
    got.forEach(function (c) { s.discard.push(c); });
    s.discard.splice(s.discard.indexOf(pick), 1); s.discard.push(pick); // quella tenuta resta in cima agli scarti
    var ok = !!test(META[pick]);
    pushLog(s, { t: 'estrai', s: p, why: why, c: got, pick: pick, ok: ok });
    return ok;
  }
  function isHeart(m) { return m.s === 'C'; }
  function isBoom(m) { var r = rankNum(m.r); return m.s === 'P' && r >= 2 && r <= 9; }

  /* ---------- reputazione pubblica ---------- */
  // Quello che tutti vedono: chi attacca lo Sceriffo sembra un fuorilegge, chi attacca chi lo attacca sembra un amico.
  function hostile(s, a, t) {
    if (!s.rep) return;
    if (t === s.sheriff) s.rep[a] = Math.max(-10, s.rep[a] - 3);
    else if (s.rep[t] < 0) s.rep[a] = Math.min(10, s.rep[a] + 1);
    else if (s.rep[t] > 0) s.rep[a] = Math.max(-10, s.rep[a] - 1);
  }

  /* ---------- pila dei passi ---------- */
  function top(s) { return s.stack[s.stack.length - 1]; }
  function ask(s, p, kind, x) { var P = { kind: kind, s: p }; Object.keys(x || {}).forEach(function (k) { P[k] = x[k]; }); s.prompt = P; }
  function pushHit(s, to, k, from, why) { s.stack.push({ k: 'hit', to: to, n: k, from: from, why: why }); }

  function beginTurn(s, p) {
    s.turn = p; s.bangs = 0; s.phase = 'begin'; s.turnNo += 1; s.peek = [];
    pushLog(s, { t: 'turn', s: p, no: s.turnNo });
    s.stack = [{ k: 'draw', p: p }, { k: 'jail', p: p }, { k: 'dyn', p: p }];
  }
  function nextTurn(s) { s.prompt = null; beginTurn(s, nextAlive(s, s.turn)); }

  function maxHeal(s, p) {
    var h = s.hand[p] || [], beers = aliveCount(s) > 2 ? h.filter(function (c) { return kindOf(c) === 'borraccia'; }).length : 0;
    if (charOf(s, p) !== 'erbetta') return beers;
    return beers + Math.floor((h.length - beers) / 2);
  }
  function checkEnd(s) {
    var alive = aliveList(s), roles = alive.map(function (p) { return s.role[p]; });
    var team = null;
    if (!s.alive[s.sheriff]) team = (alive.length === 1 && roles[0] === 'R') ? 'R' : 'F';
    else if (!roles.some(function (r) { return r === 'F' || r === 'R'; })) team = 'S';
    if (!team) return false;
    var winners = [];
    s.role.forEach(function (r, p) { if ((team === 'S' && (r === 'S' || r === 'V')) || r === team) winners.push(p); });
    s.status = 'gameOver'; s.phase = 'over'; s.stack = []; s.prompt = null;
    s.result = { team: team, winners: winners, turns: s.turnNo };
    pushLog(s, { t: 'end', team: team, winners: winners });
    return true;
  }
  function eliminate(s, p, from) {
    s.alive[p] = false; s.hp[p] = 0;
    pushLog(s, { t: 'dead', s: p, role: s.role[p], from: from });
    var cards = s.hand[p].concat(s.table[p]);
    s.hand[p] = []; s.table[p] = [];
    var vult = -1;
    aliveList(s).forEach(function (q) { if (charOf(s, q) === 'becchino') vult = q; });
    if (vult >= 0 && cards.length) { s.hand[vult] = s.hand[vult].concat(cards); pushLog(s, { t: 'vulture', s: vult, from: p, n: cards.length }); }
    else cards.forEach(function (c) { toss(s, c); });
    if (from >= 0 && from !== p && s.alive[from]) {
      if (s.role[p] === 'F') { var got = drawN(s, from, 3); pushLog(s, { t: 'reward', s: from, n: got }); }
      if (s.role[p] === 'V' && s.role[from] === 'S') {
        s.hand[from].concat(s.table[from]).forEach(function (c) { toss(s, c); });
        s.hand[from] = []; s.table[from] = [];
        pushLog(s, { t: 'penalty', s: from });
      }
    }
    if (checkEnd(s)) return;
    if (p === s.turn) { s.stack = []; nextTurn(s); }
  }

  function step(s) {
    var f = top(s), d, c;
    switch (f.k) {
      case 'dyn':
        s.stack.pop();
        d = tableCard(s, f.p, 'candelotto');
        if (!d || !s.alive[f.p]) return;
        takeFromTable(s, f.p, d);
        if (estrai(s, f.p, 'candelotto', isBoom, false)) {
          toss(s, d);
          pushLog(s, { t: 'boom', s: f.p });
          pushHit(s, f.p, 3, -1, 'candelotto');
        } else {
          var nx = nextAlive(s, f.p);
          s.table[nx].push(d);
          pushLog(s, { t: 'dynpass', s: f.p, to: nx });
        }
        return;
      case 'jail':
        s.stack.pop();
        d = tableCard(s, f.p, 'galera');
        if (!d || !s.alive[f.p]) return;
        takeFromTable(s, f.p, d); toss(s, d);
        if (estrai(s, f.p, 'galera', isHeart, true)) pushLog(s, { t: 'escape', s: f.p });
        else { pushLog(s, { t: 'jailed', s: f.p }); s.stack = []; nextTurn(s); }
        return;
      case 'draw': {
        s.stack.pop();
        var p = f.p, ch = charOf(s, p);
        if (!s.alive[p]) return;
        var victims = aliveList(s).filter(function (q) { return q !== p && s.hand[q].length; });
        if (ch === 'lesta' && victims.length) { s.stack.push({ k: 'drawn', p: p }); ask(s, p, 'lesta', { opts: victims }); return; }
        if (ch === 'raccatta' && s.discard.length) { s.stack.push({ k: 'drawn', p: p }); ask(s, p, 'raccatta', { c: s.discard[s.discard.length - 1] }); return; }
        if (ch === 'veggente') {
          s.peek = [];
          for (var i = 0; i < 3; i++) { c = draw(s); if (c != null) s.peek.push(c); }
          if (s.peek.length === 3) { s.stack.push({ k: 'drawn', p: p }); ask(s, p, 'veggente', { opts: s.peek.slice() }); return; }
          s.hand[p] = s.hand[p].concat(s.peek); s.peek = [];
          pushLog(s, { t: 'draw', s: p, n: 2 });
          s.phase = 'play';
          return;
        }
        if (ch === 'fante') {
          var a = draw(s), b = draw(s);
          if (a != null) s.hand[p].push(a);
          if (b != null) {
            s.hand[p].push(b);
            var extra = isRed(b) && drawN(s, p, 1) > 0;
            pushLog(s, { t: 'show', s: p, c: b, extra: extra });
          }
        } else pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 2) });
        s.phase = 'play';
        return;
      }
      case 'drawn': s.stack.pop(); s.phase = 'play'; return;
      case 'shot': {
        if (!s.alive[f.to] || !s.alive[f.from]) { s.stack.pop(); return; }
        if (!f.bar) {
          f.bar = true;
          var tries = (tableCard(s, f.to, 'botte') ? 1 : 0) + (charOf(s, f.to) === 'bottaio' ? 1 : 0);
          for (var t = 0; t < tries && f.missed < f.need; t++) if (estrai(s, f.to, 'botte', isHeart, true)) f.missed++;
          if (f.missed && f.missed < f.need) pushLog(s, { t: 'half', s: f.to });
        }
        if (f.missed >= f.need) { s.stack.pop(); pushLog(s, { t: 'miss', s: f.to, from: f.from, how: 'botte' }); return; }
        var need = f.need - f.missed;
        if (dodgeCards(s, f.to).length >= need) { ask(s, f.to, 'dodge', { need: need, from: f.from, why: f.why }); return; }
        s.stack.pop(); pushHit(s, f.to, 1, f.from, f.why);
        return;
      }
      case 'bis':
        if (!s.alive[f.to]) { s.stack.pop(); return; }
        if (bangCards(s, f.to).length) { ask(s, f.to, 'bisonti', { from: f.from }); return; }
        s.stack.pop(); pushHit(s, f.to, 1, f.from, 'bisonti');
        return;
      case 'duel': {
        if (!s.alive[f.a] || !s.alive[f.b]) { s.stack.pop(); return; }
        if (bangCards(s, f.cur).length) { ask(s, f.cur, 'duel', { a: f.a, b: f.b }); return; }
        s.stack.pop();
        var other = f.cur === f.a ? f.b : f.a;
        pushLog(s, { t: 'duelLost', s: f.cur, to: other });
        pushHit(s, f.cur, 1, other, 'sfida');
        return;
      }
      case 'hit':
        s.stack.pop();
        if (!s.alive[f.to]) return;
        s.hp[f.to] -= f.n;
        pushLog(s, { t: 'hurt', s: f.to, n: f.n, from: f.from, why: f.why, hp: Math.max(0, s.hp[f.to]) });
        s.stack.push({ k: 'after', to: f.to, n: f.n, from: f.from });
        if (s.hp[f.to] <= 0) s.stack.push({ k: 'dying', p: f.to, from: f.from });
        return;
      case 'dying':
        if (!s.alive[f.p] || s.hp[f.p] > 0) { s.stack.pop(); return; }
        if (maxHeal(s, f.p) >= 1 - s.hp[f.p]) { ask(s, f.p, 'dying', { need: 1 - s.hp[f.p], from: f.from }); return; }
        s.stack.pop();
        eliminate(s, f.p, f.from);
        return;
      case 'after': {
        s.stack.pop();
        if (!s.alive[f.to]) return;
        var who = charOf(s, f.to);
        if (who === 'cerotto') { var g = drawN(s, f.to, f.n); if (g) pushLog(s, { t: 'cerotto', s: f.to, n: g }); }
        if (who === 'rancore' && f.from >= 0 && f.from !== f.to && s.alive[f.from]) {
          for (var r = 0; r < f.n && s.hand[f.from].length; r++) {
            c = s.hand[f.from][randInt(s.hand[f.from].length)];
            takeFromHand(s, f.from, c); s.hand[f.to].push(c);
            pushLog(s, { t: 'rancore', s: f.to, from: f.from });
          }
        }
        return;
      }
      case 'store': {
        while (f.i < f.order.length && !s.alive[f.order[f.i]]) f.i++;
        if (!s.store.length || f.i >= f.order.length) { s.stack.pop(); s.store.forEach(function (x) { toss(s, x); }); s.store = []; return; }
        var q = f.order[f.i];
        if (s.store.length === 1) { c = s.store.pop(); s.hand[q].push(c); pushLog(s, { t: 'pick', s: q, c: c }); f.i++; return; }
        ask(s, q, 'store', { opts: s.store.slice() });
        return;
      }
      case 'discard': {
        var ex = s.hand[f.p].length - Math.max(0, s.hp[f.p]);
        if (ex <= 0 || !s.alive[f.p]) { s.stack.pop(); nextTurn(s); return; }
        ask(s, f.p, 'discard', { n: ex });
        return;
      }
    }
    s.stack.pop(); // passo sconosciuto
  }
  function emptyHands(s) {
    aliveList(s).forEach(function (p) {
      if (charOf(s, p) === 'vuote' && !s.hand[p].length && drawN(s, p, 1)) pushLog(s, { t: 'vuote', s: p });
    });
  }
  function run(s) {
    var guard = 0;
    while (s.status === 'playing' && !s.prompt && s.stack.length && guard++ < 3000) { emptyHands(s); step(s); }
    if (s.status === 'playing') emptyHands(s);
  }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now(), names = opts.names || [opts.name || ''];
    return {
      app: 'polvere', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online', status: 'waiting',
      seats: names.map(function (nm, i) { return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(nm || '').slice(0, 20) }; }),
      host: 0, bots: {}, role: [], char: [], hp: [], max: [], alive: [], hand: {}, table: {}, rep: [],
      deck: [], discard: [], store: [], peek: [], sheriff: 0, turn: 0, turnNo: 0, phase: 'wait', bangs: 0,
      stack: [], prompt: null, log: [], logN: 0, result: null
    };
  }
  function setup(s) {
    var k = n(s), p;
    var roles = shuffle(ROLES_BY_N[k].slice()), chars = shuffle(CHARS.map(function (c) { return c.id; })).slice(0, k);
    s.role = roles; s.char = chars; s.sheriff = roles.indexOf('S');
    s.hp = []; s.max = []; s.alive = []; s.hand = {}; s.table = {}; s.rep = [];
    s.deck = shuffle(ALL.slice()); s.discard = []; s.store = []; s.peek = [];
    for (p = 0; p < k; p++) {
      var hp = CHAR[chars[p]].hp + (roles[p] === 'S' ? 1 : 0);
      s.hp.push(hp); s.max.push(hp); s.alive.push(true); s.rep.push(roles[p] === 'S' ? 10 : 0);
      s.hand[p] = []; s.table[p] = [];
    }
    for (p = 0; p < k; p++) drawN(s, p, s.hp[p]);
    s.status = 'playing'; s.result = null; s.log = []; s.turnNo = 0; s.prompt = null;
    beginTurn(s, s.sheriff);
    run(s);
    return s;
  }
  function startGame(state) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length < MIN_PLAYERS) return { ok: false, error: 'Servono almeno ' + MIN_PLAYERS + ' giocatori (anche bot).' };
    var s = clone(state);
    setup(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startLocal(names) { return setup(newGame({ local: true, names: names })); }
  function startBots(names, level) {
    var s = newGame({ local: true, names: names });
    s.mode = 'bot';
    for (var i = 1; i < names.length; i++) s.bots[i] = level;
    return setup(s);
  }
  function rematch(state) {
    if (!state || state.status !== 'gameOver') return { ok: false, error: 'La partita non è finita.' };
    var s = clone(state);
    setup(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function join(state, key, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length >= MAX_PLAYERS) return { ok: false, error: 'Il tavolo è pieno (' + MAX_PLAYERS + ' giocatori).' };
    if (seatOf(state, key) >= 0) return { ok: false, error: 'Sei già seduto.' };
    var s = clone(state);
    s.seats.push({ keys: key ? [key] : [], name: String(name || '').slice(0, 20) });
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function addBot(state, level, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length >= MAX_PLAYERS) return { ok: false, error: 'Il tavolo è pieno.' };
    var s = clone(state);
    s.seats.push({ keys: [], name: String(name || 'Bot').slice(0, 20) });
    s.bots = s.bots || {};
    s.bots[s.seats.length - 1] = level;
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function removeBot(state, seat) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (!state.bots || !state.bots[seat]) return { ok: false, error: 'Non è un bot.' };
    var s = clone(state), bots = {};
    s.seats.splice(seat, 1);
    Object.keys(state.bots).forEach(function (k) { var i = +k; if (i !== seat) bots[i > seat ? i - 1 : i] = state.bots[k]; });
    s.bots = bots;
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function seatOf(state, key) {
    if (!state || !key) return -1;
    for (var i = 0; i < state.seats.length; i++) if ((state.seats[i].keys || []).indexOf(key) >= 0) return i;
    return -1;
  }
  function addSeatKey(state, seat, key) {
    var s = clone(state);
    s.seats.forEach(function (x, i) { if (i !== seat) x.keys = (x.keys || []).filter(function (k) { return k !== key; }); });
    var keys = (s.seats[seat].keys || []).filter(function (k) { return k !== key; });
    keys.push(key);
    s.seats[seat].keys = keys.slice(-6);
    touch(s, state.v);
    return { ok: true, state: s };
  }

  /* ---------- mosse ---------- */
  function uniq(a) { return a.every(function (x, i) { return a.indexOf(x) === i; }); }
  function allIn(s, p, cards) { return Array.isArray(cards) && uniq(cards) && cards.every(function (c) { return inHand(s, p, c); }); }
  // Perché questa carta non si può giocare adesso (null se si può).
  function playError(s, p, m) {
    var c = m.c, k = kindOf(c), t = m.target;
    if (!inHand(s, p, c)) return 'Questa carta non è nella tua mano.';
    var needT = function () {
      if (typeof t !== 'number' || t < 0 || t >= n(s) || !s.alive[t]) return 'Scegli un giocatore in vita.';
      if (t === p) return 'Non puoi sceglierti da solo.';
      return null;
    };
    var e;
    if (asBang(s, p, c)) {
      if ((e = needT())) return e;
      if (!unlimited(s, p) && s.bangs >= 1) return 'Hai già sparato in questo turno.';
      if (dist(s, p, t) > reach(s, p)) return hnum(s, t) + ' è a distanza ' + dist(s, p, t) + ': la tua arma arriva a ' + reach(s, p) + '.';
      return null;
    }
    switch (k) {
      case 'schivata': return 'La Schivata! si gioca quando ti sparano.';
      case 'borraccia':
        if (aliveCount(s) <= 2) return 'In due la Borraccia non serve.';
        return s.hp[p] >= s.max[p] ? 'Hai già tutti i punti vita.' : null;
      case 'giro': case 'corriere': case 'bottino': case 'mercato': case 'raffica': case 'bisonti': return null;
      case 'borseggio': case 'lazo': {
        if ((e = needT())) return e;
        if (k === 'borseggio' && dist(s, p, t) > 1) return hnum(s, t) + ' è a distanza ' + dist(s, p, t) + ': il Borseggio! arriva solo a 1.';
        if (m.pick === 'hand') return s.hand[t].length ? null : 'Non ha carte in mano.';
        return (s.table[t] || []).indexOf(m.pick) >= 0 ? null : 'Scegli una carta in mano o in gioco.';
      }
      case 'sfida': return needT();
      case 'galera':
        if ((e = needT())) return e;
        if (t === s.sheriff) return 'Lo Sceriffo non va in Galera.';
        return tableCard(s, t, 'galera') ? 'È già in Galera.' : null;
      case 'candelotto': return tableCard(s, p, 'candelotto') ? 'Hai già un Candelotto davanti.' : null;
      case 'botte': case 'cavallo': case 'cannocchiale': return tableCard(s, p, k) ? 'Ne hai già uno in gioco.' : null;
      default:
        if (TYPES[k] && TYPES[k].weapon) { var w = weaponOf(s, p); return w && kindOf(w) === k ? 'Hai già quest\'arma.' : null; }
    }
    return 'Carta sconosciuta.';
  }
  function hnum(s, p) { return (s.seats[p] && s.seats[p].name) || ('Giocatore ' + (p + 1)); }
  function answerError(s, p, m) {
    var P = s.prompt;
    switch (P.kind) {
      case 'dodge':
        if (m.pass) return null;
        if (!allIn(s, p, m.cards) || m.cards.length !== P.need || !m.cards.every(function (c) { return asDodge(s, p, c); })) return P.need > 1 ? 'Servono ' + P.need + ' Schivata!.' : 'Scegli una Schivata!.';
        return null;
      case 'bisonti': case 'duel':
        if (m.pass) return null;
        return allIn(s, p, m.cards) && m.cards.length === 1 && asBang(s, p, m.cards[0]) ? null : 'Scegli uno Sparo!.';
      case 'dying': {
        if (m.pass) return null;
        var beer = m.beer || [], sid = m.sid || [];
        if (!allIn(s, p, beer.concat(sid))) return 'Scelta non valida.';
        if (beer.length && (aliveCount(s) <= 2 || !beer.every(function (c) { return kindOf(c) === 'borraccia'; }))) return 'Solo le Borracce ti salvano.';
        if (sid.length && (charOf(s, p) !== 'erbetta' || sid.length % 2)) return 'Solo Doc Erbetta scarta carte a coppie.';
        return beer.length + sid.length / 2 >= P.need ? null : 'Non basta per restare in vita.';
      }
      case 'store': return P.opts.indexOf(m.pick) >= 0 ? null : 'Prendi una delle carte scoperte.';
      case 'discard': return allIn(s, p, m.cards) && m.cards.length === P.n ? null : 'Scegli ' + P.n + ' ' + (P.n === 1 ? 'carta' : 'carte') + ' da scartare.';
      case 'lesta': return m.target === -1 || P.opts.indexOf(m.target) >= 0 ? null : 'Scegli da chi pescare.';
      case 'raccatta': return typeof m.yes === 'boolean' ? null : 'Rispondi sì o no.';
      case 'veggente': return P.opts.indexOf(m.pick) >= 0 ? null : 'Scegli la carta da rimettere nel mazzo.';
    }
    return 'Scelta non valida.';
  }
  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'La partita non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    if (typeof seat !== 'number' || seat < 0 || seat >= n(s)) return 'Non sei seduto al tavolo.';
    if (!s.alive[seat]) return 'Sei fuori dalla partita.';
    if (m.type === 'answer') {
      if (!s.prompt) return 'Non c\'è niente da decidere.';
      if (s.prompt.s !== seat) return 'Deve decidere un altro giocatore.';
      return answerError(s, seat, m);
    }
    if (s.prompt) return 'Aspetta la risposta di ' + hnum(s, s.prompt.s) + '.';
    if (seat !== s.turn || s.phase !== 'play' || s.stack.length) return 'Non è il tuo turno.';
    switch (m.type) {
      case 'play': return playError(s, seat, m);
      case 'heal':
        if (charOf(s, seat) !== 'erbetta') return 'Solo Doc Erbetta può farlo.';
        if (s.hp[seat] >= s.max[seat]) return 'Hai già tutti i punti vita.';
        return allIn(s, seat, m.cards) && m.cards.length === 2 ? null : 'Scegli 2 carte da scartare.';
      case 'end': return null;
    }
    return 'Mossa sconosciuta.';
  }
  function heal(s, p, k, how) {
    var before = s.hp[p];
    s.hp[p] = Math.min(s.max[p], s.hp[p] + k);
    if (s.hp[p] > before || how === 'dying') pushLog(s, { t: 'heal', s: p, n: s.hp[p] - before, how: how });
  }
  function playCard(s, p, m) {
    var c = m.c, k = kindOf(c), t = m.target;
    takeFromHand(s, p, c);
    if (asBang(s, p, c)) {
      toss(s, c); s.bangs += 1; hostile(s, p, t);
      pushLog(s, { t: 'play', s: p, c: c, to: t, as: 'sparo' });
      s.stack.push({ k: 'shot', from: p, to: t, need: charOf(s, p) === 'macigno' ? 2 : 1, missed: 0, bar: false, why: 'sparo' });
      return;
    }
    var T = TYPES[k];
    if (T.blue) {
      var where = k === 'galera' ? t : p;
      if (T.weapon) { var old = weaponOf(s, p); if (old) { takeFromTable(s, p, old); toss(s, old); } }
      s.table[where].push(c);
      if (k === 'galera') hostile(s, p, t);
      pushLog(s, { t: 'equip', s: p, c: c, to: k === 'galera' ? t : undefined });
      return;
    }
    toss(s, c);
    pushLog(s, { t: 'play', s: p, c: c, to: t });
    var others = [], q;
    switch (k) {
      case 'borraccia': heal(s, p, 1, 'borraccia'); break;
      case 'giro': aliveList(s).forEach(function (x) { heal(s, x, 1, 'giro'); }); break;
      case 'corriere': pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 2) }); break;
      case 'bottino': pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 3) }); break;
      case 'mercato': {
        s.store = [];
        for (var i = 0; i < aliveCount(s); i++) { var x = draw(s); if (x != null) s.store.push(x); }
        pushLog(s, { t: 'store', s: p, cards: s.store.slice() });
        var order = []; q = p;
        do { order.push(q); q = nextAlive(s, q); } while (q !== p);
        s.stack.push({ k: 'store', order: order, i: 0 });
        break;
      }
      case 'borseggio': case 'lazo': {
        var got = m.pick === 'hand' ? s.hand[t][randInt(s.hand[t].length)] : m.pick;
        if (m.pick === 'hand') takeFromHand(s, t, got); else takeFromTable(s, t, got);
        hostile(s, p, t);
        if (k === 'borseggio') { s.hand[p].push(got); pushLog(s, { t: 'steal', s: p, from: t, c: m.pick === 'hand' ? null : got }); }
        else { toss(s, got); pushLog(s, { t: 'lazo', s: p, from: t, c: got, hand: m.pick === 'hand' }); }
        break;
      }
      case 'sfida': hostile(s, p, t); s.stack.push({ k: 'duel', a: p, b: t, cur: t }); break;
      case 'raffica': case 'bisonti':
        q = nextAlive(s, p);
        while (q !== p) { others.push(q); q = nextAlive(s, q); }
        others.reverse().forEach(function (o) {
          if (k === 'raffica') s.stack.push({ k: 'shot', from: p, to: o, need: 1, missed: 0, bar: false, why: 'raffica' });
          else s.stack.push({ k: 'bis', from: p, to: o });
        });
        break;
    }
  }
  function answer(s, p, m) {
    var P = s.prompt, f = top(s), i;
    s.prompt = null;
    switch (P.kind) {
      case 'dodge':
        if (m.pass) { s.stack.pop(); pushHit(s, p, 1, P.from, P.why); break; }
        m.cards.forEach(function (c) { takeFromHand(s, p, c); toss(s, c); });
        s.stack.pop();
        pushLog(s, { t: 'miss', s: p, from: P.from, how: 'schivata', cards: m.cards.slice() });
        break;
      case 'bisonti':
        s.stack.pop();
        if (m.pass) { pushHit(s, p, 1, P.from, 'bisonti'); break; }
        takeFromHand(s, p, m.cards[0]); toss(s, m.cards[0]);
        pushLog(s, { t: 'bisok', s: p, c: m.cards[0] });
        break;
      case 'duel':
        if (m.pass) {
          s.stack.pop();
          var other = p === P.a ? P.b : P.a;
          pushLog(s, { t: 'duelLost', s: p, to: other });
          pushHit(s, p, 1, other, 'sfida');
          break;
        }
        takeFromHand(s, p, m.cards[0]); toss(s, m.cards[0]);
        pushLog(s, { t: 'duelShot', s: p, c: m.cards[0] });
        f.cur = p === f.a ? f.b : f.a;
        break;
      case 'dying':
        if (m.pass) { s.stack.pop(); eliminate(s, p, P.from); break; }
        (m.beer || []).concat(m.sid || []).forEach(function (c) { takeFromHand(s, p, c); toss(s, c); });
        s.hp[p] += (m.beer || []).length + (m.sid || []).length / 2;
        s.hp[p] = Math.min(s.max[p], s.hp[p]);
        pushLog(s, { t: 'saved', s: p, beer: (m.beer || []).length, sid: (m.sid || []).length / 2, hp: s.hp[p] });
        s.stack.pop();
        break;
      case 'store':
        i = s.store.indexOf(m.pick);
        s.store.splice(i, 1); s.hand[p].push(m.pick);
        pushLog(s, { t: 'pick', s: p, c: m.pick });
        f.i++;
        break;
      case 'discard':
        m.cards.forEach(function (c) { takeFromHand(s, p, c); toss(s, c); });
        pushLog(s, { t: 'discard', s: p, cards: m.cards.slice() });
        s.stack.pop();
        nextTurn(s);
        break;
      case 'lesta':
        if (m.target >= 0) {
          var c = s.hand[m.target][randInt(s.hand[m.target].length)];
          takeFromHand(s, m.target, c); s.hand[p].push(c);
          pushLog(s, { t: 'lesta', s: p, from: m.target });
          pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 1) });
        } else pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 2) });
        break;
      case 'raccatta':
        if (m.yes && s.discard.length) {
          var d = s.discard.pop(); s.hand[p].push(d);
          pushLog(s, { t: 'raccatta', s: p, c: d });
          pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 1) });
        } else pushLog(s, { t: 'draw', s: p, n: drawN(s, p, 2) });
        break;
      case 'veggente':
        s.peek.forEach(function (c) { if (c !== m.pick) s.hand[p].push(c); });
        s.deck.push(m.pick); s.peek = [];
        pushLog(s, { t: 'draw', s: p, n: 2, peek: true });
        break;
    }
  }
  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state);
    switch (m.type) {
      case 'answer': answer(s, seat, m); break;
      case 'play': playCard(s, seat, m); break;
      case 'heal':
        m.cards.forEach(function (c) { takeFromHand(s, seat, c); toss(s, c); });
        heal(s, seat, 1, 'erbetta');
        break;
      case 'end':
        pushLog(s, { t: 'endturn', s: seat });
        s.stack.push({ k: 'discard', p: seat });
        break;
    }
    run(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function nextActor(s) {
    if (!s || s.status !== 'playing') return -1;
    if (s.prompt) return s.prompt.s;
    return s.phase === 'play' && !s.stack.length ? s.turn : -1;
  }
  function waitingFor(s) { var a = nextActor(s); return a >= 0 ? [a] : []; }

  // Le mosse possibili per un giocatore (per i test e per i bot): per le carte, tutti i bersagli validi.
  function playOptions(s, p, c) {
    var out = [], k = kindOf(c);
    var targets = aliveList(s).filter(function (t) { return t !== p; });
    var tryM = function (m) { if (!playError(s, p, m)) out.push(m); };
    if (asBang(s, p, c) || k === 'sfida' || k === 'galera') targets.forEach(function (t) { tryM({ type: 'play', c: c, target: t }); });
    else if (k === 'borseggio' || k === 'lazo') targets.forEach(function (t) {
      tryM({ type: 'play', c: c, target: t, pick: 'hand' });
      (s.table[t] || []).forEach(function (x) { tryM({ type: 'play', c: c, target: t, pick: x }); });
    });
    else tryM({ type: 'play', c: c });
    return out;
  }
  function legalMoves(s, p) {
    var out = [];
    if (!s || s.status !== 'playing' || !s.alive[p]) return out;
    var P = s.prompt;
    if (P) {
      if (P.s !== p) return out;
      var h = s.hand[p];
      switch (P.kind) {
        case 'dodge': { out.push({ type: 'answer', pass: true }); var dc = dodgeCards(s, p); if (dc.length >= P.need) out.push({ type: 'answer', cards: dc.slice(0, P.need) }); break; }
        case 'bisonti': case 'duel': out.push({ type: 'answer', pass: true }); bangCards(s, p).forEach(function (c) { out.push({ type: 'answer', cards: [c] }); }); break;
        case 'dying': {
          out.push({ type: 'answer', pass: true });
          var beers = aliveCount(s) > 2 ? h.filter(function (c) { return kindOf(c) === 'borraccia'; }) : [];
          if (beers.length >= P.need) out.push({ type: 'answer', beer: beers.slice(0, P.need) });
          if (charOf(s, p) === 'erbetta') {
            var rest = h.filter(function (c) { return beers.indexOf(c) < 0; }), b = Math.min(beers.length, P.need), need = (P.need - b) * 2;
            if (rest.length >= need) out.push({ type: 'answer', beer: beers.slice(0, b), sid: rest.slice(0, need) });
          }
          break;
        }
        case 'store': P.opts.forEach(function (c) { out.push({ type: 'answer', pick: c }); }); break;
        case 'discard': out.push({ type: 'answer', cards: h.slice(0, P.n) }); out.push({ type: 'answer', cards: h.slice(h.length - P.n) }); break;
        case 'lesta': out.push({ type: 'answer', target: -1 }); P.opts.forEach(function (t) { out.push({ type: 'answer', target: t }); }); break;
        case 'raccatta': out.push({ type: 'answer', yes: true }, { type: 'answer', yes: false }); break;
        case 'veggente': P.opts.forEach(function (c) { out.push({ type: 'answer', pick: c }); }); break;
      }
      return out;
    }
    if (nextActor(s) !== p) return out;
    s.hand[p].forEach(function (c) { out = out.concat(playOptions(s, p, c)); });
    if (charOf(s, p) === 'erbetta' && s.hp[p] < s.max[p] && s.hand[p].length >= 2) out.push({ type: 'heal', cards: s.hand[p].slice(0, 2) });
    out.push({ type: 'end' });
    return out;
  }

  var api = {
    TYPES: TYPES, META: META, ALL: ALL, CHARS: CHARS, CHAR: CHAR, ROLES: ROLES, ROLES_BY_N: ROLES_BY_N,
    info: info, kindOf: kindOf, typeOf: typeOf, rankNum: rankNum, isRed: isRed,
    charOf: charOf, tableCard: tableCard, weaponOf: weaponOf, reach: reach, unlimited: unlimited, dist: dist, seatDist: seatDist,
    aliveList: aliveList, aliveCount: aliveCount, nextAlive: nextAlive, asBang: asBang, asDodge: asDodge,
    bangCards: bangCards, dodgeCards: dodgeCards, maxHeal: maxHeal, playError: playError, playOptions: playOptions,
    newGame: newGame, startGame: startGame, startLocal: startLocal, startBots: startBots, rematch: rematch, join: join,
    addBot: addBot, removeBot: removeBot, seatOf: seatOf, addSeatKey: addSeatKey,
    validate: validate, act: act, nextActor: nextActor, waitingFor: waitingFor, legalMoves: legalMoves, clone: clone,
    randInt: randInt, shuffle: shuffle, _setRng: function (f) { rng = f; },
    MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Polvere = api;
})(typeof window !== 'undefined' ? window : this);
