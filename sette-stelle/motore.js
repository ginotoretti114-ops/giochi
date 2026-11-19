/* Sette Stelle: le regole pure, senza interfaccia (si usa nella pagina e nei test con node).
   Copia fedele di un gioco di carte "pesca o fermati", con nomi e grafica originali.

   Mazzo di 94 carte: 79 stelle numerate (lo 0 una volta, l'1 una volta, il 2 due volte … il 12 dodici volte),
   6 bonus (+2 +4 +6 +8 +10 e la Superluna ×2) e 9 azioni (3 Gelo, 3 Pioggia di stelle, 3 Desiderio).
   A ogni round si pesca a turno o ci si ferma: chi pesca un numero che ha già sballa e prende 0;
   chi mette insieme 7 numeri diversi fa «Sette Stelle», chiude il round e prende 15 punti in più.
   Vince chi, alla fine di un round, ha almeno 200 punti ed è da solo in testa.

   Stato: JSON semplice (niente array annidati, così passa intero dai server MQTT).
   Le id delle carte: n7.3 (il terzo 7), b4 (+4), x2 (Superluna), gelo.1, pioggia.2, desiderio.3. */
(function (root) {
  'use strict';

  var TARGET = 200, BONUS = 15, SEVEN = 7, MIN_PLAYERS = 2, MAX_PLAYERS = 8, LOG_MAX = 180;
  var ACTIONS = {
    gelo: { name: 'Gelo', text: 'Scegli un giocatore ancora in gioco (anche te): si ferma subito e incassa i punti che ha davanti.' },
    pioggia: { name: 'Pioggia di stelle', text: 'Scegli un giocatore ancora in gioco (anche te): pesca 3 carte di fila. Si ferma prima se sballa o fa Sette Stelle.' },
    desiderio: { name: 'Desiderio', text: 'Tienilo davanti a te: se peschi un doppione, scarti il doppione e il Desiderio e resti in gioco. Se ne hai già uno, regalalo a un altro giocatore in gioco.' }
  };
  var BONUSES = [2, 4, 6, 8, 10];

  function buildDeck() {
    var d = ['n0.1'], v, k;
    for (v = 1; v <= 12; v++) for (k = 1; k <= v; k++) d.push('n' + v + '.' + k);
    BONUSES.forEach(function (b) { d.push('b' + b); });
    d.push('x2');
    for (k = 1; k <= 3; k++) d.push('gelo.' + k, 'pioggia.' + k, 'desiderio.' + k);
    return d;
  }
  var FULL = buildDeck();

  // Che carta è: { t: 'num', v } | { t: 'bonus', v } | { t: 'x2' } | { t: 'act', a }
  function info(id) {
    if (typeof id !== 'string') return null;
    var m = /^n(\d+)\.\d+$/.exec(id);
    if (m) return { t: 'num', v: +m[1] };
    m = /^b(\d+)$/.exec(id);
    if (m) return { t: 'bonus', v: +m[1] };
    if (id === 'x2') return { t: 'x2' };
    m = /^(gelo|pioggia|desiderio)\.\d$/.exec(id);
    if (m) return { t: 'act', a: m[1] };
    return null;
  }
  function cardName(id) {
    var I = info(id);
    if (!I) return '';
    if (I.t === 'num') return String(I.v);
    if (I.t === 'bonus') return '+' + I.v;
    if (I.t === 'x2') return 'Superluna ×2';
    return ACTIONS[I.a].name;
  }

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

  /* ---------- la fila di carte di un giocatore ---------- */
  function row(s, p) { return s.rows[p] || []; }
  function nums(s, p) { return row(s, p).map(info).filter(function (I) { return I.t === 'num'; }).map(function (I) { return I.v; }); }
  function hasNum(s, p, v) { return nums(s, p).indexOf(v) >= 0; }
  function wishOf(s, p) { var a = row(s, p).filter(function (c) { return info(c).a === 'desiderio'; }); return a[0] || null; }
  function hasCards(s, p) { return row(s, p).some(function (c) { var I = info(c); return I.t !== 'act' || I.a === 'desiderio'; }); }
  // Punti del round: somma dei numeri (raddoppiata dalla Superluna), più i bonus, più 15 per Sette Stelle.
  function roundPoints(s, p) {
    if (s.st[p] === 'bust') return 0;
    var sum = 0, plus = 0, dbl = false;
    row(s, p).forEach(function (c) {
      var I = info(c);
      if (I.t === 'num') sum += I.v;
      else if (I.t === 'bonus') plus += I.v;
      else if (I.t === 'x2') dbl = true;
    });
    return (dbl ? sum * 2 : sum) + plus + (s.sevenBy === p ? BONUS : 0);
  }
  function active(s) { var a = []; for (var p = 0; p < n(s); p++) if (s.st[p] === 'in') a.push(p); return a; }
  function nextActive(s, from) {
    for (var i = 1; i <= n(s); i++) { var p = (from + i) % n(s); if (s.st[p] === 'in') return p; }
    return -1;
  }

  /* ---------- mazzo ---------- */
  function drawCard(s) {
    if (!s.deck.length) {
      if (!s.discard.length) return null;
      s.deck = shuffle(s.discard); s.discard = []; // le carte sul tavolo restano dove sono
      pushLog(s, { t: 'reshuffle' });
    }
    return s.deck.pop();
  }
  function toss(s, c) { s.discard.push(c); }

  /* ---------- risoluzione ---------- */
  // Una carta arriva a p. f3 è la Pioggia di stelle in corso su p, se c'è: le azioni aspettano la fine delle 3 carte.
  function give(s, p, c, how, f3) {
    var I = info(c);
    pushLog(s, { t: 'card', s: p, c: c, how: how });
    if (I.t === 'num') {
      if (hasNum(s, p, I.v)) {
        var w = wishOf(s, p);
        if (w) {
          s.rows[p].splice(s.rows[p].indexOf(w), 1);
          toss(s, w); toss(s, c);
          pushLog(s, { t: 'save', s: p, c: c });
        } else {
          s.rows[p].push(c);
          s.st[p] = 'bust';
          pushLog(s, { t: 'bust', s: p, c: c });
        }
        return;
      }
      s.rows[p].push(c);
      if (nums(s, p).length >= SEVEN) { s.sevenBy = p; pushLog(s, { t: 'seven', s: p }); }
      return;
    }
    if (I.t === 'bonus' || I.t === 'x2') { s.rows[p].push(c); return; }
    if (I.a === 'desiderio' && !wishOf(s, p)) { s.rows[p].push(c); return; } // lo tiene: vale anche durante la Pioggia
    if (f3) { f3.q.push(c); return; }
    s.ops.unshift({ o: 'act', p: p, c: c });
  }
  function ask(s, p, c, opts) { s.prompt = { kind: 'target', s: p, c: c, a: info(c).a, opts: opts }; }
  // Chi riceve un'azione sceglie su chi giocarla.
  function resolveAction(s, p, c) {
    var a = info(c).a;
    if (s.st[p] !== 'in') { toss(s, c); pushLog(s, { t: 'toss', s: p, c: c }); return; }
    if (a === 'desiderio') {
      var free = active(s).filter(function (q) { return q !== p && !wishOf(s, q); });
      if (!free.length) { toss(s, c); pushLog(s, { t: 'toss', s: p, c: c }); return; }
      if (free.length === 1) { target(s, p, c, free[0]); return; }
      ask(s, p, c, free);
      return;
    }
    var opts = active(s);
    if (opts.length === 1) { target(s, p, c, opts[0]); return; }
    ask(s, p, c, opts);
  }
  function target(s, p, c, t) {
    var a = info(c).a;
    s.rows[t].push(c);
    if (a === 'gelo') {
      s.st[t] = 'frozen';
      pushLog(s, { t: 'freeze', s: p, to: t, pts: roundPoints(s, t) });
    } else if (a === 'pioggia') {
      pushLog(s, { t: 'three', s: p, to: t });
      s.ops.unshift({ o: 'f3', p: t, left: 3, q: [] });
    } else {
      pushLog(s, { t: 'gift', s: p, to: t });
    }
  }
  function step(s, op) {
    switch (op.o) {
      case 'draw': {
        if (s.st[op.p] !== 'in') return;
        var c = drawCard(s);
        if (c == null) { s.st[op.p] = 'stay'; pushLog(s, { t: 'stay', s: op.p, pts: roundPoints(s, op.p), empty: true }); return; }
        give(s, op.p, c, op.how, null);
        return;
      }
      case 'f3': {
        if (s.st[op.p] !== 'in' || s.sevenBy != null) { op.q.forEach(function (x) { toss(s, x); }); return; }
        if (op.left > 0) {
          var d = drawCard(s);
          if (d == null) { op.left = 0; s.ops.unshift(op); return; }
          op.left -= 1;
          s.ops.unshift(op);
          give(s, op.p, d, 'f3', op);
          return;
        }
        if (op.q.length) s.ops = op.q.map(function (x) { return { o: 'act', p: op.p, c: x }; }).concat(s.ops);
        return;
      }
      case 'act': resolveAction(s, op.p, op.c); return;
      case 'next': s.turn = nextActive(s, s.turn); return;
    }
  }
  function roundOver(s) { return s.sevenBy != null || !active(s).length; }
  function run(s) {
    var guard = 0;
    while (s.status === 'playing' && !s.prompt && (s.phase === 'deal' || s.phase === 'turn') && guard++ < 5000) {
      if (roundOver(s)) { endRound(s); return; }
      if (s.ops.length) { step(s, s.ops.shift()); continue; }
      if (s.phase === 'deal') {
        var p = -1;
        while (s.dealQ.length && p < 0) { var q = s.dealQ.shift(); if (s.st[q] === 'in') p = q; }
        if (p >= 0) { s.ops.push({ o: 'draw', p: p, how: 'deal' }); continue; }
        s.phase = 'turn';
        s.turn = nextActive(s, s.dealer);
        continue;
      }
      if (s.st[s.turn] !== 'in') { s.turn = nextActive(s, s.turn); continue; }
      return; // tocca a s.turn: pesca o si ferma
    }
  }
  function endRound(s) {
    s.ops.forEach(function (op) { if (op.c) toss(s, op.c); (op.q || []).forEach(function (x) { toss(s, x); }); });
    s.ops = []; s.prompt = null; s.dealQ = [];
    var pts = s.seats.map(function (x, p) { return roundPoints(s, p); });
    pts.forEach(function (v, p) { s.score[p] += v; });
    s.last = { round: s.round, pts: pts, st: s.st.slice(), seven: s.sevenBy == null ? -1 : s.sevenBy };
    pushLog(s, { t: 'end', round: s.round, pts: pts });
    var max = Math.max.apply(null, s.score);
    if (max >= TARGET) {
      var best = [];
      s.score.forEach(function (v, p) { if (v === max) best.push(p); });
      if (best.length === 1) {
        s.status = 'gameOver'; s.phase = 'over';
        s.result = { winner: best[0], score: s.score.slice(), rounds: s.round };
        pushLog(s, { t: 'win', s: best[0], score: max });
        return;
      }
    }
    s.phase = 'between'; // in caso di parità in testa sopra i 200 si gioca un altro round
  }
  function startRound(s) {
    var k = n(s), p;
    for (p = 0; p < k; p++) { (s.rows[p] || []).forEach(function (c) { toss(s, c); }); s.rows[p] = []; }
    s.st = []; for (p = 0; p < k; p++) s.st.push('in');
    s.sevenBy = null; s.ops = []; s.prompt = null;
    s.dealQ = []; for (p = 1; p <= k; p++) s.dealQ.push((s.dealer + p) % k); // dalla sinistra del mazziere, lui per ultimo
    s.phase = 'deal'; s.turn = (s.dealer + 1) % k;
    pushLog(s, { t: 'round', round: s.round, dealer: s.dealer });
    run(s);
  }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now(), names = opts.names || [opts.name || ''];
    return {
      app: 'settestelle', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online', status: 'waiting',
      seats: names.map(function (nm, i) { return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(nm || '').slice(0, 20) }; }),
      host: 0, bots: {}, score: [], round: 0, dealer: 0, deck: [], discard: [], rows: {}, st: [],
      sevenBy: null, ops: [], dealQ: [], turn: 0, phase: 'wait', prompt: null, last: null, log: [], logN: 0, result: null
    };
  }
  function setup(s) {
    var k = n(s);
    s.deck = shuffle(FULL.slice()); s.discard = []; s.rows = {};
    s.score = []; for (var p = 0; p < k; p++) { s.score.push(0); s.rows[p] = []; }
    s.round = 1; s.dealer = randInt(k); s.status = 'playing'; s.result = null; s.last = null; s.log = [];
    startRound(s);
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
  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'La partita non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    if (typeof seat !== 'number' || seat < 0 || seat >= n(s)) return 'Non sei seduto al tavolo.';
    if (m.type === 'next') return s.phase === 'between' ? null : 'Il round non è finito.';
    if (m.type === 'answer') {
      if (!s.prompt) return 'Non c\'è niente da decidere.';
      if (s.prompt.s !== seat) return 'Deve decidere un altro giocatore.';
      return s.prompt.opts.indexOf(m.target) >= 0 ? null : 'Scegli un giocatore ancora in gioco.';
    }
    if (s.prompt) return 'Prima va scelto su chi giocare l\'azione.';
    if (s.phase !== 'turn' || s.turn !== seat) return 'Non è il tuo turno.';
    if (s.st[seat] !== 'in') return 'Sei già fuori da questo round.';
    if (m.type === 'hit') return null;
    if (m.type === 'stay') return hasCards(s, seat) ? null : 'Per fermarti devi avere almeno una carta davanti.';
    return 'Mossa sconosciuta.';
  }
  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state);
    switch (m.type) {
      case 'hit':
        s.ops.push({ o: 'draw', p: seat, how: 'hit' }, { o: 'next' });
        run(s);
        break;
      case 'stay':
        s.st[seat] = 'stay';
        pushLog(s, { t: 'stay', s: seat, pts: roundPoints(s, seat) });
        s.ops.push({ o: 'next' });
        run(s);
        break;
      case 'answer': {
        var P = s.prompt;
        s.prompt = null;
        target(s, P.s, P.c, m.target);
        run(s);
        break;
      }
      case 'next':
        s.round += 1;
        s.dealer = (s.dealer + 1) % n(s);
        startRound(s);
        break;
    }
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function nextActor(s) {
    if (!s || s.status !== 'playing') return -1;
    if (s.prompt) return s.prompt.s;
    return s.phase === 'turn' ? s.turn : -1;
  }
  function waitingFor(s) { var a = nextActor(s); return a >= 0 ? [a] : []; }
  function legalMoves(s, seat) {
    var out = [];
    if (!s || s.status !== 'playing') return out;
    if (s.phase === 'between') return [{ type: 'next' }];
    if (s.prompt) {
      if (s.prompt.s === seat) s.prompt.opts.forEach(function (t) { out.push({ type: 'answer', target: t }); });
      return out;
    }
    if (s.phase === 'turn' && s.turn === seat && s.st[seat] === 'in') {
      out.push({ type: 'hit' });
      if (hasCards(s, seat)) out.push({ type: 'stay' });
    }
    return out;
  }
  // Quante carte di ogni numero restano da pescare (le carte del mazzo, in ordine sparso: lo sa chi conta le carte).
  function unseenCounts(s) {
    var c = {};
    s.deck.forEach(function (id) { var I = info(id); var k = I.t === 'num' ? 'n' + I.v : I.t === 'act' ? I.a : I.t === 'x2' ? 'x2' : 'b'; c[k] = (c[k] || 0) + 1; });
    return c;
  }

  var api = {
    info: info, cardName: cardName, ACTIONS: ACTIONS, FULL: FULL, roundPoints: roundPoints, nums: nums, hasNum: hasNum, wishOf: wishOf,
    hasCards: hasCards, active: active, unseenCounts: unseenCounts,
    newGame: newGame, startGame: startGame, startLocal: startLocal, startBots: startBots, rematch: rematch, join: join,
    addBot: addBot, removeBot: removeBot, seatOf: seatOf, addSeatKey: addSeatKey,
    validate: validate, act: act, nextActor: nextActor, waitingFor: waitingFor, legalMoves: legalMoves, clone: clone,
    randInt: randInt, shuffle: shuffle, _setRng: function (f) { rng = f; },
    TARGET: TARGET, BONUS: BONUS, SEVEN: SEVEN, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SetteStelle = api;
})(typeof window !== 'undefined' ? window : this);
