/* Sottozero: motore di gioco puro (nessun DOM). Stato = JSON semplice, senza array annidati.
   Carte come stringhe: numero = colore + cifra ("M3"); azione = colore + lettera
   ("Mx" salta, "Mi" inverti, "Mp" pesca 2); doppio pesca 2 = "d" + due colori ("dRS"). */
(function (root) {
  'use strict';

  var COLORS = ['M', 'S', 'R', 'B'];
  var COLOR_NAME = { M: 'Mare', S: 'Sole', R: 'Rosa', B: 'Bosco' };
  var ACTION_NAME = { x: 'Salta', i: 'Inverti', p: 'Pesca 2', d: 'Doppio pesca 2' };
  // Punti delle carte azione nella griglia: sulle carte originali sono stampati negli angoli. Da verificare.
  var ACTION_VALUE = { x: 10, i: 10, p: 10, d: 10 };
  var DOUBLES = ['dRS', 'dMB', 'dRB', 'dMS'];
  var START_COLS = 3;
  var MIN_PLAYERS = 2, MAX_PLAYERS = 8;
  var TOTAL_CARDS = 112;
  var LOG_MAX = 60;

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
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  /* ---------- carte ---------- */
  function makeDeck() {
    var d = [];
    COLORS.forEach(function (c) {
      for (var n = 0; n <= 6; n++) for (var k = 0; k < 3; k++) d.push(c + n);
      for (var j = 0; j < 2; j++) { d.push(c + 'x'); d.push(c + 'i'); d.push(c + 'p'); }
    });
    DOUBLES.forEach(function (x) { d.push(x); });
    return d;
  }
  function kind(card) { return card[0] === 'd' ? 'd' : (card[1] >= '0' && card[1] <= '9' ? 'n' : card[1]); }
  function colorsOf(card) { return card[0] === 'd' ? [card[1], card[2]] : [card[0]]; }
  function numberOf(card) { return kind(card) === 'n' ? +card[1] : null; }
  function isAction(card) { return kind(card) !== 'n'; }
  function valueOf(card) { var k = kind(card); return k === 'n' ? +card[1] : ACTION_VALUE[k]; }
  // Due carte si possono eliminare insieme se hanno lo stesso colore o lo stesso numero.
  function matches(a, b) {
    var na = numberOf(a), nb = numberOf(b);
    if (na !== null && na === nb) return true;
    var cb = colorsOf(b);
    return colorsOf(a).some(function (c) { return cb.indexOf(c) >= 0; });
  }

  /* ---------- griglie ---------- */
  function gridOf(s, p) { return s.grids[p] || []; }
  function cells(s, p) {
    var out = [];
    gridOf(s, p).forEach(function (col) { out.push(col.t, col.b); });
    return out;
  }
  function faceDown(s, p) { return cells(s, p).filter(function (x) { return !x.u; }).length; }
  function clearable(s, p) {
    var out = [];
    gridOf(s, p).forEach(function (col, i) { if (col.t.u && col.b.u && matches(col.t.c, col.b.c)) out.push(i); });
    return out;
  }
  function gridScore(s, p) { return sum(cells(s, p).map(function (x) { return valueOf(x.c); })); }
  function visibleScore(s, p) { return sum(cells(s, p).filter(function (x) { return x.u; }).map(function (x) { return valueOf(x.c); })); }
  function cell(s, p, col, row) {
    var g = gridOf(s, p);
    if (typeof col !== 'number' || col !== Math.floor(col) || col < 0 || col >= g.length) return null;
    return row === 0 ? g[col].t : (row === 1 ? g[col].b : null);
  }

  /* ---------- registro ---------- */
  function pushLog(s, e) {
    s.log = (s.log || []).concat([e]);
    if (s.log.length > LOG_MAX) s.log = s.log.slice(s.log.length - LOG_MAX);
  }
  function touch(s, prevV) { s.v = (prevV || 0) + 1; s.updatedAt = Date.now(); return s; }

  /* ---------- mazzo ---------- */
  function drawCard(s) {
    if (!s.deck.length) {
      if (s.discard.length <= 1) return null;
      var top = s.discard.pop();
      s.deck = shuffle(s.discard);
      s.discard = [top];
      pushLog(s, { t: 'shuffle' });
    }
    return s.deck.pop();
  }
  // Aggiunge n carte coperte come nuove colonne (2 carte per colonna).
  function addColumns(s, p, n) {
    var got = [];
    for (var i = 0; i < n; i++) { var c = drawCard(s); if (c) got.push(c); }
    if (got.length % 2) s.deck.push(got.pop());
    for (var k = 0; k < got.length; k += 2) s.grids[p].push({ t: { c: got[k], u: false }, b: { c: got[k + 1], u: false } });
    return got.length;
  }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now();
    var names = opts.names || [opts.name || ''];
    return {
      app: 'sottozero', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online',
      status: 'waiting',
      seats: names.map(function (n, i) {
        return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(n || '').slice(0, 20) };
      }),
      host: 0, rounds: opts.rounds || 9, round: 0,
      dir: 1, turn: 0, starter: 0,
      deck: [], discard: [], grids: {}, held: null, heldFrom: null,
      phase: 'draw', acted: false, unoSaid: false, unoMiss: -1,
      totals: [], history: [], last: null, log: [], result: null
    };
  }

  function startRound(s, starter) {
    var deck = shuffle(makeDeck());
    s.grids = {};
    for (var p = 0; p < s.seats.length; p++) {
      var cols = [];
      for (var c = 0; c < START_COLS; c++) cols.push({ t: { c: deck.pop(), u: false }, b: { c: deck.pop(), u: false } });
      var pick = randInt(START_COLS * 2);
      (pick % 2 ? cols[pick >> 1].b : cols[pick >> 1].t).u = true; // ognuno scopre una carta a caso
      s.grids[p] = cols;
    }
    var skipped = [], top = deck.pop();
    while (isAction(top)) { skipped.push(top); top = deck.pop(); }
    skipped.forEach(function (x) { deck.splice(randInt(deck.length + 1), 0, x); });
    s.deck = deck;
    s.discard = [top];
    s.round = (s.round || 0) + 1;
    s.dir = 1;
    s.turn = starter;
    s.starter = starter;
    s.phase = 'draw'; s.held = null; s.heldFrom = null; s.acted = false; s.unoSaid = false; s.unoMiss = -1;
    s.status = 'playing';
    s.result = null;
    s.last = null;
    pushLog(s, { t: 'round', r: s.round, s: starter });
    return s;
  }

  function nextSeat(s, p) { var n = s.seats.length; return ((p + s.dir) % n + n) % n; }

  function advance(s, k) {
    var p = s.turn;
    if (k === 'i') s.dir = -s.dir;
    var nxt = nextSeat(s, p);
    if (k === 'x') { s.last.skipped = nxt; nxt = nextSeat(s, nxt); }
    if (k === 'p') { s.last.victim = nxt; s.last.got = addColumns(s, nxt, 2); nxt = nextSeat(s, nxt); }
    s.turn = nxt;
    s.phase = 'draw'; s.held = null; s.heldFrom = null; s.acted = false; s.unoSaid = false;
  }

  function finishTurn(s) {
    var p = s.turn;
    if (faceDown(s, p) === 0) return endRound(s, p);
    s.unoMiss = (faceDown(s, p) === 1 && !s.unoSaid) ? p : -1;
    var top = s.discard[s.discard.length - 1];
    var k = top ? kind(top) : 'n';
    if (s.last) s.last.top = top;
    if (k === 'd') { s.phase = 'choose'; return s; }
    advance(s, k);
    return s;
  }

  function endRound(s, closer) {
    for (var p = 0; p < s.seats.length; p++) {
      s.grids[p].forEach(function (col) { col.t.u = true; col.b.u = true; });
      var again = true;
      while (again) { // a fine round le coppie che si formano si eliminano
        again = false;
        var cl = clearable(s, p);
        if (cl.length) {
          var col = s.grids[p].splice(cl[0], 1)[0];
          s.discard.push(col.t.c, col.b.c);
          again = true;
        }
      }
    }
    var scores = s.seats.map(function (x, i) { return gridScore(s, i); });
    var min = Math.min.apply(null, scores);
    var winners = [];
    scores.forEach(function (v, i) { if (v === min) winners.push(i); });
    if (!s.totals || s.totals.length !== s.seats.length) s.totals = s.seats.map(function () { return 0; });
    s.totals = s.totals.map(function (t, i) { return t + scores[i]; });
    s.history = (s.history || []).concat([{ round: s.round, scores: scores, closer: closer }]);
    var next = winners.indexOf(closer) >= 0 ? closer : winners[0];
    var over = s.round >= s.rounds;
    var champions = [];
    if (over) {
      var best = Math.min.apply(null, s.totals);
      s.totals.forEach(function (t, i) { if (t === best) champions.push(i); });
    }
    s.result = { round: s.round, scores: scores, winners: winners, closer: closer, next: next, over: over, champions: champions };
    s.status = over ? 'gameOver' : 'roundEnd';
    s.phase = 'over'; s.held = null; s.heldFrom = null; s.unoMiss = -1;
    pushLog(s, { t: 'end', r: s.round, s: closer, w: winners });
    return s;
  }

  /* ---------- mosse ---------- */
  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'Il round non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    if (typeof seat !== 'number' || seat < 0 || seat >= s.seats.length) return 'Non sei seduto al tavolo.';
    if (m.type === 'catch') return s.unoMiss >= 0 ? null : 'Non c\'è nessuno da richiamare.';
    if (s.turn !== seat) return 'Non è il tuo turno.';
    var top = s.discard[s.discard.length - 1];
    var c;
    switch (m.type) {
      case 'draw':
        if (s.phase !== 'draw') return 'Hai già pescato.';
        if (!s.deck.length && s.discard.length <= 1) return 'Il mazzo è finito: prendi lo scarto.';
        return null;
      case 'take':
        if (s.phase !== 'draw') return 'Hai già pescato.';
        if (!top) return 'Gli scarti sono vuoti.';
        if (isAction(top)) return 'Le carte azione non si prendono dagli scarti.';
        return null;
      case 'place':
        if (s.phase !== 'place') return 'Prima pesca una carta.';
        if (!cell(s, seat, m.col, m.row)) return 'Posto non valido.';
        return null;
      case 'toss':
        if (s.phase !== 'place') return 'Non hai carte da scartare.';
        if (s.heldFrom !== 'deck') return 'La carta presa dagli scarti va messa nella griglia.';
        return null;
      case 'flip':
        if (s.phase !== 'flip') return 'Ora non devi scoprire carte.';
        c = cell(s, seat, m.col, m.row);
        if (!c) return 'Posto non valido.';
        if (c.u) return 'Quella carta è già scoperta.';
        return null;
      case 'clear':
        if (s.phase !== 'draw' && s.phase !== 'end') return 'Puoi eliminare le colonne prima di pescare o a fine turno.';
        if (clearable(s, seat).indexOf(m.col) < 0) return 'Quella colonna non si può eliminare.';
        return null;
      case 'uno':
        if (s.phase !== 'end') return 'Puoi dirlo a fine turno.';
        if (faceDown(s, seat) !== 1) return 'Si dice quando ti resta una sola carta coperta.';
        if (s.unoSaid) return 'L\'hai già detto.';
        return null;
      case 'end':
        if (s.phase !== 'end') return 'Il turno non è finito.';
        return null;
      case 'target': {
        if (s.phase !== 'choose') return 'Non devi scegliere nessuno.';
        var who = m.who, n = s.seats.length;
        if (!Array.isArray(who)) return 'Scelta non valida.';
        for (var i = 0; i < who.length; i++) {
          if (typeof who[i] !== 'number' || who[i] < 0 || who[i] >= n || who[i] === seat) return 'Scegli altri giocatori.';
        }
        if (m.four) return who.length === 1 ? null : 'Scegli un giocatore.';
        if (n < 3) return 'In due puoi solo far pescare 4 carte.';
        if (who.length !== 2 || who[0] === who[1]) return 'Scegli due giocatori diversi.';
        return null;
      }
    }
    return 'Mossa sconosciuta.';
  }

  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state);
    var top, g, cl, col;
    switch (m.type) {
      case 'draw':
        s.held = drawCard(s); s.heldFrom = 'deck'; s.phase = 'place'; s.acted = true; s.unoMiss = -1;
        s.last = { s: seat, t: 'draw' };
        break;
      case 'take':
        s.held = s.discard.pop(); s.heldFrom = 'discard'; s.phase = 'place'; s.acted = true; s.unoMiss = -1;
        s.last = { s: seat, t: 'take', c: s.held };
        break;
      case 'place': {
        var target = cell(s, seat, m.col, m.row);
        var old = target.c, wasUp = target.u;
        target.c = s.held; target.u = true;
        s.discard.push(old);
        s.last = { s: seat, t: 'place', c: s.held, out: old, wasUp: wasUp, from: s.heldFrom, col: m.col, row: m.row };
        s.held = null; s.heldFrom = null; s.phase = 'end';
        break;
      }
      case 'toss':
        s.discard.push(s.held);
        s.last = { s: seat, t: 'toss', c: s.held };
        s.held = null; s.heldFrom = null;
        s.phase = faceDown(s, seat) > 0 ? 'flip' : 'end';
        break;
      case 'flip': {
        var f = cell(s, seat, m.col, m.row);
        f.u = true;
        if (s.last) { s.last.flip = f.c; s.last.col = m.col; s.last.row = m.row; }
        s.phase = 'end';
        break;
      }
      case 'clear': {
        g = s.grids[seat];
        col = g.splice(m.col, 1)[0];
        // In cima va la carta azione (così ha effetto), altrimenti la carta che vale di più.
        var a = col.t.c, b = col.b.c, first = a, second = b;
        if (isAction(a) && !isAction(b)) { first = b; second = a; }
        else if (isAction(a) === isAction(b) && valueOf(a) > valueOf(b)) { first = b; second = a; }
        s.discard.push(first, second);
        if (s.phase === 'draw') { s.acted = true; s.unoMiss = -1; }
        pushLog(s, { t: 'clear', s: seat, c: [a, b] });
        break;
      }
      case 'uno':
        s.unoSaid = true;
        pushLog(s, { t: 'uno', s: seat });
        break;
      case 'end':
        if (s.last && s.last.s === seat) pushLog(s, s.last);
        finishTurn(s);
        break;
      case 'target':
        if (m.four) addColumns(s, m.who[0], 4);
        else m.who.forEach(function (w) { addColumns(s, w, 2); });
        pushLog(s, { t: 'dd', s: seat, who: m.who.slice(), four: !!m.four });
        advance(s, 'n');
        break;
      case 'catch':
        if (seat === s.unoMiss) pushLog(s, { t: 'uno', s: seat, late: true });
        else { cl = addColumns(s, s.unoMiss, 2); pushLog(s, { t: 'caught', s: s.unoMiss, by: seat, n: cl }); }
        s.unoMiss = -1;
        break;
    }
    touch(s, state.v);
    return { ok: true, state: s };
  }

  // Dopo la mossa principale, se non resta niente da decidere, il turno si chiude da solo.
  function needsDecision(s, seat) {
    if (s.status !== 'playing' || s.turn !== seat || s.phase !== 'end') return false;
    if (clearable(s, seat).length) return true;
    if (faceDown(s, seat) === 1 && !s.unoSaid) return true;
    return false;
  }
  function actAuto(state, seat, m) {
    var r = act(state, seat, m);
    if (!r.ok) return r;
    if (r.state.status === 'playing' && r.state.turn === seat && r.state.phase === 'end' && !needsDecision(r.state, seat)) {
      var r2 = act(r.state, seat, { type: 'end' });
      if (r2.ok) { r2.state.v = r.state.v; return r2; }
    }
    return r;
  }

  /* ---------- tavolo ---------- */
  function join(state, key, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length >= MAX_PLAYERS) return { ok: false, error: 'Il tavolo è pieno (8 giocatori).' };
    if (seatOf(state, key) >= 0) return { ok: false, error: 'Sei già seduto.' };
    var s = clone(state);
    s.seats.push({ keys: key ? [key] : [], name: String(name || '').slice(0, 20) });
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startGame(state) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length < MIN_PLAYERS) return { ok: false, error: 'Servono almeno 2 giocatori.' };
    var s = clone(state);
    s.totals = s.seats.map(function () { return 0; });
    s.history = []; s.round = 0;
    startRound(s, randInt(s.seats.length));
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startLocal(names, rounds) {
    var s = newGame({ local: true, names: names, rounds: rounds });
    s.totals = s.seats.map(function () { return 0; });
    return startRound(s, randInt(s.seats.length));
  }
  function nextRound(state) {
    if (!state || state.status !== 'roundEnd') return { ok: false, error: 'Il round non è finito.' };
    var s = clone(state);
    startRound(s, state.result.next);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function rematch(state) {
    if (!state || state.status !== 'gameOver') return { ok: false, error: 'La partita non è finita.' };
    var s = clone(state);
    s.totals = s.seats.map(function () { return 0; });
    s.history = []; s.round = 0; s.log = [];
    startRound(s, state.result ? state.result.next : randInt(s.seats.length));
    touch(s, state.v);
    return { ok: true, state: s };
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
  function seatOf(state, key) {
    if (!state || !key) return -1;
    for (var i = 0; i < state.seats.length; i++) if ((state.seats[i].keys || []).indexOf(key) >= 0) return i;
    return -1;
  }
  function cardCount(s) {
    var n = s.deck.length + s.discard.length + (s.held ? 1 : 0);
    for (var p = 0; p < s.seats.length; p++) n += cells(s, p).length;
    return n;
  }

  // Tutte le mosse legali di un giocatore (per i test e per i suggerimenti).
  function legalMoves(s, seat) {
    var out = [];
    if (!s || s.status !== 'playing') return out;
    if (s.unoMiss >= 0) out.push({ type: 'catch' });
    if (s.turn !== seat) return out;
    var g = gridOf(s, seat), i;
    var allCells = [];
    g.forEach(function (col, ci) { allCells.push({ col: ci, row: 0, x: col.t }, { col: ci, row: 1, x: col.b }); });
    switch (s.phase) {
      case 'draw':
        if (s.deck.length || s.discard.length > 1) out.push({ type: 'draw' });
        if (s.discard.length && !isAction(s.discard[s.discard.length - 1])) out.push({ type: 'take' });
        clearable(s, seat).forEach(function (c) { out.push({ type: 'clear', col: c }); });
        break;
      case 'place':
        allCells.forEach(function (x) { out.push({ type: 'place', col: x.col, row: x.row }); });
        if (s.heldFrom === 'deck') out.push({ type: 'toss' });
        break;
      case 'flip':
        allCells.forEach(function (x) { if (!x.x.u) out.push({ type: 'flip', col: x.col, row: x.row }); });
        break;
      case 'end':
        clearable(s, seat).forEach(function (c) { out.push({ type: 'clear', col: c }); });
        if (faceDown(s, seat) === 1 && !s.unoSaid) out.push({ type: 'uno' });
        out.push({ type: 'end' });
        break;
      case 'choose':
        for (i = 0; i < s.seats.length; i++) {
          if (i === seat) continue;
          out.push({ type: 'target', who: [i], four: true });
          for (var j = i + 1; j < s.seats.length; j++) if (j !== seat) out.push({ type: 'target', who: [i, j], four: false });
        }
        break;
    }
    return out;
  }

  var api = {
    COLORS: COLORS, COLOR_NAME: COLOR_NAME, ACTION_NAME: ACTION_NAME, ACTION_VALUE: ACTION_VALUE,
    START_COLS: START_COLS, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, TOTAL_CARDS: TOTAL_CARDS,
    makeDeck: makeDeck, kind: kind, colorsOf: colorsOf, numberOf: numberOf, isAction: isAction, valueOf: valueOf,
    matches: matches, gridOf: gridOf, cells: cells, faceDown: faceDown, clearable: clearable,
    gridScore: gridScore, visibleScore: visibleScore, nextSeat: nextSeat,
    newGame: newGame, startRound: startRound, startGame: startGame, startLocal: startLocal,
    validate: validate, act: act, actAuto: actAuto, needsDecision: needsDecision,
    join: join, nextRound: nextRound, rematch: rematch, addSeatKey: addSeatKey, seatOf: seatOf,
    cardCount: cardCount, legalMoves: legalMoves, clone: clone, sum: sum, randInt: randInt,
    _setRng: function (f) { rng = f; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sottozero = api;
})(typeof window !== 'undefined' ? window : this);
