/* Valanga: le regole pure, senza interfaccia (si usa nella pagina e nei test con node).
   Copia fedele di un gioco di carte a colori «senza pietà», con nomi e grafica originali.

   Mazzo di 168 carte in quattro colori (rosso r, giallo g, verde v, blu b). Per ogni colore: due copie di ogni
   numero da 0 a 9, 3 Salta, 3 Inverti, 3 Pesca 2, 2 Pesca 4, 3 Scarta tutto e 2 Salta tutti. Poi 8 Jolly Inverti
   Pesca 4, 4 Jolly Pesca 6, 4 Jolly Pesca 10 e 8 Jolly Roulette.
   - Si gioca una carta dello stesso colore, numero o simbolo di quella in cima, oppure un jolly.
   - Chi non ha carte da giocare pesca finché non ne trova una giocabile, e la gioca.
   - A una carta pesca si risponde con una carta pesca di valore uguale o più alto (di qualsiasi colore): la
     penalità si somma e passa avanti. Chi non risponde pesca tutto e salta il turno.
   - Il 7 scambia la mano con un giocatore a scelta; lo 0 fa passare tutte le mani avanti, nel senso del giro.
   - Chi arriva a 25 carte in mano è fuori (le sue carte tornano nel mazzo al prossimo rimescolamento).
   - Vince chi resta senza carte, oppure l'ultimo rimasto in gioco.
   - Con una carta sola in mano si dice «Valanga!» (il nostro «uno»): chi viene beccato prima pesca 2 carte.

   Stato: JSON semplice (le mani in un oggetto per posto, così passa intero dai server MQTT).
   Le id delle carte: r7.2 (il secondo 7 rosso), gs.1 (Salta giallo), vi.3 (Inverti verde), bp2.1 (Pesca 2 blu),
   rp4.2 (Pesca 4 rosso), gt.1 (Scarta tutto giallo), vx.2 (Salta tutti verde), ji.5 (Jolly Inverti Pesca 4),
   j6.1, j10.3 (Jolly Pesca 6 e 10), jr.8 (Jolly Roulette). */
(function (root) {
  'use strict';

  var MIN_PLAYERS = 2, MAX_PLAYERS = 8, MANO = 7, LIMITE = 25, LOG_MAX = 220;
  var COLORI = ['r', 'g', 'v', 'b'];
  var NOMI_COLORE = { r: 'rosso', g: 'giallo', v: 'verde', b: 'blu' };
  var TIPI = {
    n: { nome: 'Numero', punti: 0 },
    s: { nome: 'Salta', n: 3, punti: 20, text: 'Il prossimo giocatore salta il turno. In due, rigiochi tu.' },
    i: { nome: 'Inverti', n: 3, punti: 20, text: 'Il giro cambia senso. In due fa da Salta: rigiochi tu.' },
    p2: { nome: 'Pesca 2', n: 3, pen: 2, punti: 20, text: 'Il prossimo giocatore pesca 2 carte e salta il turno, se non risponde con una carta pesca da 2 o più.' },
    p4: { nome: 'Pesca 4', n: 2, pen: 4, punti: 20, text: 'Il prossimo giocatore pesca 4 carte e salta il turno, se non risponde con una carta pesca da 4 o più.' },
    t: { nome: 'Scarta tutto', n: 3, punti: 20, text: 'Scarti insieme a lei tutte le carte del suo colore che hai in mano.' },
    x: { nome: 'Salta tutti', n: 2, punti: 20, text: 'Tutti gli altri saltano il turno: rigiochi tu.' },
    ji: { nome: 'Jolly Inverti Pesca 4', n: 8, pen: 4, jolly: true, punti: 50, text: 'Scegli il colore. Il giro cambia senso e il prossimo giocatore nel nuovo senso pesca 4 carte e salta il turno. In due pesca chi l\'ha giocato, se non risponde.' },
    j6: { nome: 'Jolly Pesca 6', n: 4, pen: 6, jolly: true, punti: 50, text: 'Scegli il colore. Il prossimo giocatore pesca 6 carte e salta il turno, se non risponde con una carta pesca da 6 o più.' },
    j10: { nome: 'Jolly Pesca 10', n: 4, pen: 10, jolly: true, punti: 50, text: 'Scegli il colore. Il prossimo giocatore pesca 10 carte e salta il turno, se non risponde con un altro Pesca 10.' },
    jr: { nome: 'Jolly Roulette', n: 8, jolly: true, punti: 50, text: 'Il prossimo giocatore sceglie un colore e scopre carte dal mazzo finché non ne trova una di quel colore (i jolly non contano): le prende tutte e salta il turno.' }
  };
  var AZIONI = ['s', 'i', 'p2', 'p4', 't', 'x'], JOLLY = ['ji', 'j6', 'j10', 'jr'];

  function buildDeck() {
    var d = [];
    COLORI.forEach(function (c) {
      for (var v = 0; v <= 9; v++) for (var k = 1; k <= 2; k++) d.push(c + v + '.' + k);
      AZIONI.forEach(function (t) { for (var k = 1; k <= TIPI[t].n; k++) d.push(c + t + '.' + k); });
    });
    JOLLY.forEach(function (t) { for (var k = 1; k <= TIPI[t].n; k++) d.push(t + '.' + k); });
    return d;
  }
  var FULL = buildDeck();

  // Che carta è: { col, k, v (solo i numeri), pen (le carte pesca), jolly }
  var CACHE = {};
  function info(id) {
    if (typeof id !== 'string') return null;
    if (CACHE[id]) return CACHE[id];
    var I = null, m = /^([rgvb])(\d)\.\d$/.exec(id);
    if (m) I = { col: m[1], k: 'n', v: +m[2], pen: 0, jolly: false };
    else if ((m = /^([rgvb])(s|i|p2|p4|t|x)\.\d$/.exec(id))) I = { col: m[1], k: m[2], pen: TIPI[m[2]].pen || 0, jolly: false };
    else if ((m = /^(ji|j6|j10|jr)\.\d$/.exec(id))) I = { col: null, k: m[1], pen: TIPI[m[1]].pen || 0, jolly: true };
    if (I) CACHE[id] = I;
    return I;
  }
  function cardName(id) {
    var I = info(id);
    if (!I) return '';
    if (I.k === 'n') return I.v + ' ' + NOMI_COLORE[I.col];
    if (I.jolly) return TIPI[I.k].nome;
    return TIPI[I.k].nome + ' ' + NOMI_COLORE[I.col];
  }
  function punti(id) { var I = info(id); return I.k === 'n' ? I.v : TIPI[I.k].punti; }

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
  function n(s) { return s.seats.length; }
  function mano(s, p) { return (s.hand && s.hand[p]) || []; }
  function top(s) { return s.discard[s.discard.length - 1]; }
  function fuori(s, p) { return !!(s.out && s.out[p]); }
  function attivi(s) { var a = []; for (var p = 0; p < n(s); p++) if (!fuori(s, p)) a.push(p); return a; }
  // Il prossimo giocatore ancora in gioco, nel senso dir (1 = orario, -1 = antiorario).
  function dopo(s, p, dir) {
    var k = n(s);
    for (var i = 1; i <= k; i++) { var q = (((p + dir * i) % k) + k) % k; if (!fuori(s, q)) return q; }
    return p;
  }

  /* ---------- carte giocabili ---------- */
  // Durante una penalità si risponde solo con una carta pesca di valore uguale o più alto, di qualsiasi colore.
  function giocabile(s, c) {
    var I = info(c), T = info(top(s));
    if (!I) return false;
    if (s.pen > 0) return I.pen >= s.penMin;
    if (I.jolly) return true;
    if (I.col === s.color) return true;
    if (!T) return false;
    if (I.k === 'n') return T.k === 'n' && T.v === I.v;
    return I.k === T.k;
  }
  function giocabili(s, p) { return mano(s, p).filter(function (c) { return giocabile(s, c); }); }

  /* ---------- mazzo ---------- */
  // Quando il mazzo finisce si rimescolano gli scarti (tranne la carta in cima) e le carte di chi è uscito.
  function pescaUna(s) {
    if (!s.deck.length) {
      var t = s.discard.pop(), nuovo = s.discard.concat(s.parked || []);
      s.discard = t != null ? [t] : [];
      s.parked = [];
      if (!nuovo.length) return null;
      s.deck = shuffle(nuovo);
      pushLog(s, { t: 'rimescola' });
    }
    return s.deck.pop();
  }

  /* ---------- fine partita e regola delle 25 carte ---------- */
  function finisci(s, p, why) {
    s.status = 'gameOver'; s.prompt = null; s.forzata = null; s.unoP = null;
    var resto = {};
    for (var q = 0; q < n(s); q++) resto[q] = fuori(s, q) ? -1 : mano(s, q).length;
    s.result = { winner: p, why: why, fuori: (s.fuori || []).slice(), carte: resto };
    pushLog(s, { t: 'vince', s: p, why: why });
  }
  // Chi ha 25 carte o più esce; da: chi l'ha fatto arrivare lì (per le medaglie).
  function pieta(s, da) {
    for (var p = 0; p < n(s); p++) {
      if (s.status !== 'playing' || fuori(s, p) || mano(s, p).length < LIMITE) continue;
      if (attivi(s).length <= 1) break;
      s.out[p] = true;
      s.parked = (s.parked || []).concat(s.hand[p]);
      s.hand[p] = [];
      s.fuori.push(p);
      if (s.unoP === p) s.unoP = null;
      pushLog(s, { t: 'sommerso', s: p, da: da != null && da !== p ? da : -1 });
    }
    var a = attivi(s);
    if (s.status === 'playing' && a.length === 1) finisci(s, a[0], 'superstite');
  }
  function pescaN(s, p, k) {
    var got = [];
    for (var i = 0; i < k; i++) { var c = pescaUna(s); if (c == null) break; s.hand[p].push(c); got.push(c); }
    return got;
  }
  // Il turno passa: se tocca a qualcuno che è uscito, si va avanti.
  function avanti(s, q) { s.turn = fuori(s, q) ? dopo(s, q, s.dir) : q; }

  /* ---------- effetti ---------- */
  function gioca(s, p, c, m) {
    var I = info(c), h = s.hand[p];
    h.splice(h.indexOf(c), 1);
    var sotto = [];
    if (I.k === 't') {   // Scarta tutto: le altre carte del colore vanno sotto di lei
      sotto = h.filter(function (x) { return info(x).col === I.col; });
      s.hand[p] = h = h.filter(function (x) { return info(x).col !== I.col; });
    }
    s.discard = s.discard.concat(sotto, [c]);
    s.color = I.jolly ? (I.k === 'jr' ? s.color : m.color) : I.col;
    s.forzata = null;
    pushLog(s, { t: 'gioca', s: p, c: c, col: s.color, sotto: sotto.length ? sotto : undefined, pen: I.pen ? s.pen + I.pen : undefined });
    if (!h.length) return finisci(s, p, 'mano');
    if (h.length === 1) { s.unoP = p; s.unoDetto = !!m.uno; if (m.uno) pushLog(s, { t: 'uno', s: p }); }

    var due = attivi(s).length === 2, dir = s.dir;
    if (I.pen) {
      s.pen += I.pen; s.penMin = I.pen; s.penDa = p;
      if (I.k === 'ji') { s.dir = -s.dir; dir = s.dir; }
      // in due il Jolly Inverti Pesca 4 torna indietro su chi l'ha giocato
      s.turn = I.k === 'ji' && due ? p : dopo(s, p, dir);
      return;
    }
    switch (I.k) {
      case 's': s.turn = dopo(s, dopo(s, p, dir), dir); return;
      case 'i':
        s.dir = -s.dir;
        s.turn = due ? p : dopo(s, p, s.dir);
        return;
      case 'x': s.turn = p; return;
      case 'jr': {
        var q = dopo(s, p, dir);
        s.prompt = { kind: 'roulette', s: q, da: p };
        s.turn = q;
        return;
      }
      case 'n':
        if (I.v === 0) {   // tutte le mani passano avanti nel senso del giro
          var a = attivi(s), prima = {};
          a.forEach(function (q) { prima[q] = s.hand[q]; });
          a.forEach(function (q) { s.hand[dopo(s, q, dir)] = prima[q]; });
          if (s.unoP != null && s.hand[s.unoP].length !== 1) s.unoP = null;
          pushLog(s, { t: 'passano', s: p, dir: dir });
          pieta(s, p);
        } else if (I.v === 7 && m.target != null) {
          var t = m.target, mia = s.hand[p];
          s.hand[p] = s.hand[t]; s.hand[t] = mia;
          if (s.unoP === p && s.hand[p].length !== 1) s.unoP = null;
          pushLog(s, { t: 'scambia', s: p, q: t });
          pieta(s, p);
        }
        if (s.status === 'playing') avanti(s, dopo(s, p, dir));
        return;
    }
    avanti(s, dopo(s, p, dir));   // Scarta tutto
  }
  // Jolly Roulette: chi la subisce sceglie il colore e scopre carte finché non lo trova (i jolly non contano).
  function roulette(s, q, col, da) {
    var prese = [];
    while (mano(s, q).length < LIMITE) {
      var c = pescaUna(s);
      if (c == null) break;
      s.hand[q].push(c); prese.push(c);
      var I = info(c);
      if (!I.jolly && I.col === col) break;
    }
    s.color = col;
    pushLog(s, { t: 'roulette', s: q, col: col, cards: prese });
    pieta(s, da);
    if (s.status === 'playing') avanti(s, dopo(s, q, s.dir));
  }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now(), names = opts.names || [opts.name || ''];
    return {
      app: 'valanga', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online', status: 'waiting',
      seats: names.map(function (nm, i) { return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(nm || '').slice(0, 20) }; }),
      host: 0, bots: {}, deck: [], discard: [], parked: [], hand: {}, out: {}, fuori: [],
      dealer: 0, turn: 0, dir: 1, color: null, pen: 0, penMin: 0, penDa: -1, forzata: null, prompt: null,
      unoP: null, unoDetto: false, log: [], logN: 0, result: null
    };
  }
  function setup(s) {
    var k = n(s), p, r, i;
    s.deck = shuffle(FULL.slice()); s.discard = []; s.parked = []; s.hand = {}; s.out = {}; s.fuori = [];
    for (p = 0; p < k; p++) s.hand[p] = [];
    s.dealer = randInt(k);
    for (r = 0; r < MANO; r++) for (i = 1; i <= k; i++) s.hand[(s.dealer + i) % k].push(s.deck.pop());
    // la prima carta scoperta deve essere un numero: le carte azione e i jolly tornano in fondo al mazzo
    var c = s.deck.pop();
    while (info(c).k !== 'n') { s.deck.unshift(c); c = s.deck.pop(); }
    s.discard.push(c);
    s.color = info(c).col; s.dir = 1; s.turn = (s.dealer + 1) % k;
    s.pen = 0; s.penMin = 0; s.penDa = -1; s.forzata = null; s.prompt = null; s.unoP = null; s.unoDetto = false;
    // la numerazione della cronaca continua nella rivincita: suoni e imprese non si confondono con la partita prima
    s.status = 'playing'; s.result = null; s.log = []; s.logN = s.logN || 0;
    pushLog(s, { t: 'inizio', dealer: s.dealer, c: c });
    return s;
  }
  function startGame(state) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length < MIN_PLAYERS) return { ok: false, error: 'Servono almeno 2 giocatori.' };
    var s = clone(state);
    setup(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startLocal(names) { return setup(newGame({ local: true, names: names })); }
  // Contro il computer: il posto 0 è di chi gioca, gli altri sono bot del livello scelto.
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
  // Nella sala d'attesa chi ha creato la partita può aggiungere o togliere bot.
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
  // Chi deve muoversi adesso: chi sceglie il colore della roulette, altrimenti chi ha il turno.
  function nextActor(s) {
    if (!s || s.status !== 'playing') return -1;
    return s.prompt ? s.prompt.s : s.turn;
  }
  function waitingFor(s) { var a = nextActor(s); return a >= 0 ? [a] : []; }
  // «Valanga!» si può ancora dire (o beccare) finché il giocatore successivo non comincia il turno.
  function beccabile(s) { return s.status === 'playing' && s.unoP != null && !s.unoDetto && mano(s, s.unoP).length === 1 ? s.unoP : -1; }

  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'La partita non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    if (typeof seat !== 'number' || seat < 0 || seat >= n(s)) return 'Non sei seduto al tavolo.';
    if (fuori(s, seat)) return 'Sei fuori dalla partita.';
    if (m.type === 'uno') return s.unoP === seat && !s.unoDetto && mano(s, seat).length === 1 ? null : 'Adesso non c\'è niente da dire.';
    if (m.type === 'becca') {
      var b = beccabile(s);
      if (b < 0 || m.target !== b) return 'Non c\'è nessuno da beccare.';
      return b === seat ? 'Non puoi beccare te stesso: di\' «Valanga!».' : null;
    }
    if (m.type === 'answer') {
      if (!s.prompt || s.prompt.s !== seat) return 'Non c\'è niente da decidere.';
      return COLORI.indexOf(m.color) >= 0 ? null : 'Scegli un colore.';
    }
    if (s.prompt) return 'Prima va scelto il colore della roulette.';
    if (s.turn !== seat) return 'Non è il tuo turno.';
    var h = mano(s, seat);
    if (m.type === 'pesca') {
      if (s.forzata) return 'Devi giocare la carta che hai pescato.';
      if (s.pen > 0) return null;
      return giocabili(s, seat).length ? 'Hai una carta da giocare: si pesca solo quando non ce l\'hai.' : null;
    }
    if (m.type !== 'play') return 'Mossa sconosciuta.';
    if (h.indexOf(m.card) < 0) return 'Non hai questa carta.';
    if (s.forzata && m.card !== s.forzata) return 'Devi giocare la carta che hai pescato.';
    if (!giocabile(s, m.card)) return s.pen > 0 ? 'Puoi rispondere solo con una carta pesca da ' + s.penMin + ' o più, oppure pescare le ' + s.pen + ' carte.' : 'Questa carta non va sopra quella in cima.';
    var I = info(m.card);
    if (I.jolly && I.k !== 'jr' && COLORI.indexOf(m.color) < 0) return 'Scegli un colore.';
    if (I.k === 'n' && I.v === 7 && h.length > 1) {
      if (typeof m.target !== 'number' || m.target === seat || m.target < 0 || m.target >= n(s) || fuori(s, m.target)) return 'Scegli con chi scambiare la mano.';
    }
    return null;
  }
  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state);
    if (m.type === 'uno') {
      s.unoDetto = true;
      pushLog(s, { t: 'uno', s: seat });
      touch(s, state.v);
      return { ok: true, state: s };
    }
    if (m.type === 'becca') {
      var b = s.unoP;
      s.unoP = null;
      var got = pescaN(s, b, 2);
      pushLog(s, { t: 'beccato', s: seat, q: b, n: got.length });
      pieta(s, seat);
      if (s.status === 'playing' && fuori(s, s.turn)) avanti(s, s.turn);
      touch(s, state.v);
      return { ok: true, state: s };
    }
    // qualsiasi mossa del gioco chiude la finestra per dire «Valanga!»
    s.unoP = null; s.unoDetto = false;
    switch (m.type) {
      case 'answer': {
        var P = s.prompt;
        s.prompt = null;
        roulette(s, seat, m.color, P.da);
        break;
      }
      case 'pesca':
        if (s.pen > 0) {
          var k = s.pen, got2 = pescaN(s, seat, k), da = s.penDa;
          s.pen = 0; s.penMin = 0; s.penDa = -1;
          pushLog(s, { t: 'penalita', s: seat, n: got2.length });
          pieta(s, da);
          if (s.status === 'playing') avanti(s, dopo(s, seat, s.dir));
          break;
        }
        // si pesca finché non esce una carta giocabile, che va giocata subito
        var prese = 0, trovata = null;
        while (mano(s, seat).length < LIMITE) {
          var c = pescaUna(s);
          if (c == null) break;
          s.hand[seat].push(c); prese++;
          if (giocabile(s, c)) { trovata = c; break; }
        }
        pushLog(s, { t: 'pescate', s: seat, n: prese, c: trovata, priv: [seat] });
        pieta(s, null);
        if (s.status !== 'playing') break;
        if (fuori(s, seat)) { avanti(s, seat); break; }
        if (trovata) s.forzata = trovata;
        else avanti(s, dopo(s, seat, s.dir));   // il mazzo è finito: il turno passa
        break;
      case 'play':
        gioca(s, seat, m.card, m);
        break;
    }
    touch(s, state.v);
    return { ok: true, state: s };
  }

  // Tutte le mosse possibili per un giocatore (per i bot e per i test).
  function legalMoves(s, seat) {
    var out = [];
    if (!s || s.status !== 'playing' || fuori(s, seat)) return out;
    if (s.prompt) {
      if (s.prompt.s === seat) COLORI.forEach(function (c) { out.push({ type: 'answer', color: c }); });
      return out;
    }
    if (s.turn !== seat) return out;
    var h = mano(s, seat), uno = h.length === 2;
    var carte = s.forzata ? [s.forzata] : giocabili(s, seat);
    carte.forEach(function (c) {
      var I = info(c), base = { type: 'play', card: c };
      if (uno) base.uno = true;
      if (I.jolly && I.k !== 'jr') COLORI.forEach(function (col) { var x = clone(base); x.color = col; out.push(x); });
      else if (I.k === 'n' && I.v === 7 && h.length > 1) attivi(s).forEach(function (t) { if (t !== seat) { var x = clone(base); x.target = t; out.push(x); } });
      else out.push(base);
    });
    if (!s.forzata && (s.pen > 0 || !carte.length)) out.push({ type: 'pesca' });
    return out;
  }

  var api = {
    info: info, cardName: cardName, punti: punti, TIPI: TIPI, COLORI: COLORI, NOMI_COLORE: NOMI_COLORE, FULL: FULL,
    mano: mano, top: top, fuori: fuori, attivi: attivi, dopo: dopo, giocabile: giocabile, giocabili: giocabili, beccabile: beccabile,
    newGame: newGame, startGame: startGame, startLocal: startLocal, startBots: startBots, rematch: rematch, join: join,
    addBot: addBot, removeBot: removeBot, seatOf: seatOf, addSeatKey: addSeatKey,
    validate: validate, act: act, nextActor: nextActor, waitingFor: waitingFor, legalMoves: legalMoves, clone: clone,
    randInt: randInt, shuffle: shuffle, _setRng: function (f) { rng = f; },
    MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, MANO: MANO, LIMITE: LIMITE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Valanga = api;
})(typeof window !== 'undefined' ? window : this);
