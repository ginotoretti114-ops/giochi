/* Gran Bazar: motore di gioco puro (nessun DOM). Stato = JSON semplice. */
(function (root) {
  'use strict';

  var GOODS = ['dia', 'gol', 'sil', 'clo', 'spi', 'lea'];
  var CAMEL = 'cam';
  var TYPES = GOODS.concat([CAMEL]);
  var PRECIOUS = { dia: true, gol: true, sil: true };
  var CARD_COUNTS = { dia: 6, gol: 6, sil: 6, clo: 8, spi: 8, lea: 10, cam: 11 };
  var TOKEN_VALUES = {
    dia: [7, 7, 5, 5, 5],
    gol: [6, 6, 5, 5, 5],
    sil: [5, 5, 5, 5, 5],
    clo: [5, 3, 3, 2, 2, 1, 1],
    spi: [5, 3, 3, 2, 2, 1, 1],
    lea: [4, 3, 2, 1, 1, 1, 1, 1, 1]
  };
  var BONUS_VALUES = { 3: [1, 1, 2, 2, 2, 3, 3], 4: [4, 4, 5, 5, 6, 6], 5: [8, 8, 9, 10, 10] };
  var HAND_LIMIT = 7;
  var MARKET_SIZE = 5;
  var CAMEL_BONUS = 5;
  var SEALS_TO_WIN = 2;
  var TOTAL_CARDS = 55;
  var LOG_MAX = 80;
  var ORDER = { dia: 0, gol: 1, sil: 2, clo: 3, spi: 4, lea: 5, cam: 6 };
  var NAME = { dia: 'Diamanti', gol: 'Oro', sil: 'Argento', clo: 'Tessuti', spi: 'Spezie', lea: 'Cuoio', cam: 'Cammelli' };

  var rng = null; // iniettabile nei test: function () -> [0,1)

  function randInt(n) {
    if (rng) return Math.floor(rng() * n);
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && c.getRandomValues) {
      var buf = new Uint32Array(1);
      var limit = Math.floor(4294967296 / n) * n;
      var x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function sortHand(h) { return h.slice().sort(function (a, b) { return ORDER[a] - ORDER[b]; }); }
  function emptyWon() { return { goods: [], bonus: [] }; }
  function zeroDiscard() { var d = {}; GOODS.forEach(function (g) { d[g] = 0; }); return d; }
  function countOf(arr, t) { var n = 0; for (var i = 0; i < arr.length; i++) if (arr[i] === t) n++; return n; }

  function isIdx(i, len) { return typeof i === 'number' && i === Math.floor(i) && i >= 0 && i < len; }
  function uniqIdx(list, len) {
    if (!Array.isArray(list)) return false;
    var seen = {};
    for (var k = 0; k < list.length; k++) {
      if (!isIdx(list[k], len) || seen[list[k]]) return false;
      seen[list[k]] = true;
    }
    return true;
  }

  function emptyPiles(s) {
    var n = 0;
    GOODS.forEach(function (g) { if (!s.tokens[g] || s.tokens[g].length === 0) n++; });
    return n;
  }

  function pushLog(s, entry) {
    s.log = (s.log || []).concat([entry]);
    if (s.log.length > LOG_MAX) s.log = s.log.slice(s.log.length - LOG_MAX);
  }

  function touch(s, prevV) {
    s.v = (prevV || 0) + 1;
    s.updatedAt = Date.now();
    return s;
  }

  /* ---------- creazione e manche ---------- */

  function newGame(opts) {
    opts = opts || {};
    var now = Date.now();
    return {
      app: 'gran-bazar', schema: 1, v: 1, createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online',
      status: 'waiting',
      seats: [
        { keys: opts.key ? [opts.key] : [], name: (opts.name || '').slice(0, 24) },
        { keys: [], name: (opts.name2 || '').slice(0, 24) }
      ],
      seals: [0, 0], round: 0, starter: 0, turn: 0,
      deck: [], market: [], hands: { 0: [], 1: [] }, herds: [0, 0], discard: zeroDiscard(),
      tokens: {}, bonus: { '3': [], '4': [], '5': [] },
      won: [emptyWon(), emptyWon()],
      last: null, log: [], result: null, history: []
    };
  }

  // Prepara una nuova manche sullo stato s (lo modifica). starter = chi gioca per primo.
  function startRound(s, starter) {
    var deck = [];
    TYPES.forEach(function (t) {
      var n = t === CAMEL ? CARD_COUNTS.cam - 3 : CARD_COUNTS[t];
      for (var i = 0; i < n; i++) deck.push(t);
    });
    shuffle(deck);
    var hands = { 0: [], 1: [] }; // oggetto, non array di array: lo store non ama gli array annidati
    for (var i = 0; i < 5; i++) { hands[0].push(deck.pop()); hands[1].push(deck.pop()); }
    var herds = [0, 0];
    for (var p = 0; p < 2; p++) {
      herds[p] = countOf(hands[p], CAMEL);
      hands[p] = sortHand(hands[p].filter(function (c) { return c !== CAMEL; }));
    }
    s.market = [CAMEL, CAMEL, CAMEL, deck.pop(), deck.pop()];
    s.deck = deck;
    s.hands = hands;
    s.herds = herds;
    s.discard = zeroDiscard();
    s.tokens = {};
    GOODS.forEach(function (g) { s.tokens[g] = TOKEN_VALUES[g].slice(); });
    s.bonus = { '3': shuffle(BONUS_VALUES[3].slice()), '4': shuffle(BONUS_VALUES[4].slice()), '5': shuffle(BONUS_VALUES[5].slice()) };
    s.won = [emptyWon(), emptyWon()];
    s.round = (s.round || 0) + 1;
    s.starter = starter;
    s.turn = starter;
    s.status = 'playing';
    s.last = null;
    s.result = null;
    pushLog(s, { t: 'round', r: s.round, s: starter });
    return s;
  }

  function endRound(s, reason) {
    var camel = s.herds[0] > s.herds[1] ? 0 : (s.herds[1] > s.herds[0] ? 1 : -1);
    var scores = [0, 1].map(function (p) {
      var goods = sum(s.won[p].goods.map(function (t) { return t.v; }));
      var bonus = sum(s.won[p].bonus.map(function (t) { return t.v; }));
      var cam = camel === p ? CAMEL_BONUS : 0;
      return {
        goods: goods, bonus: bonus, camel: cam, total: goods + bonus + cam,
        nGoods: s.won[p].goods.length, nBonus: s.won[p].bonus.length, herd: s.herds[p]
      };
    });
    var winner = -1, decidedBy = 'draw';
    var keys = ['total', 'nBonus', 'nGoods'];
    for (var k = 0; k < keys.length; k++) {
      var a = scores[0][keys[k]], b = scores[1][keys[k]];
      if (a !== b) { winner = a > b ? 0 : 1; decidedBy = keys[k]; break; }
    }
    if (winner >= 0) s.seals[winner] += 1;
    var over = winner >= 0 && s.seals[winner] >= SEALS_TO_WIN;
    s.result = {
      round: s.round, reason: reason, camel: camel, scores: scores, winner: winner,
      decidedBy: decidedBy, next: winner >= 0 ? 1 - winner : 1 - s.starter, over: over
    };
    s.history = (s.history || []).concat([{ round: s.round, winner: winner, totals: [scores[0].total, scores[1].total] }]);
    s.status = over ? 'gameOver' : 'roundEnd';
    pushLog(s, { t: 'end', r: s.round, w: winner, why: reason });
    return s;
  }

  /* ---------- validazione ---------- */

  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'La manche non è in corso.';
    if (seat !== 0 && seat !== 1) return 'Non sei seduto al tavolo.';
    if (s.turn !== seat) return 'Non è il tuo turno.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    var hand = s.hands[seat];
    var i;
    switch (m.type) {
      case 'take': {
        if (!isIdx(m.idx, s.market.length) || !s.market[m.idx]) return 'Carta non valida.';
        if (s.market[m.idx] === CAMEL) return 'I cammelli si prendono tutti insieme.';
        if (hand.length >= HAND_LIMIT) return 'Hai già 7 carte in mano: vendi o scambia.';
        return null;
      }
      case 'camels': {
        if (s.market.indexOf(CAMEL) < 0) return 'Non ci sono cammelli al mercato.';
        return null;
      }
      case 'swap': {
        var take = m.take, give = m.give, camels = m.camels;
        if (typeof camels !== 'number' || camels !== Math.floor(camels)) return 'Mossa non valida.';
        if (!uniqIdx(take, s.market.length)) return 'Selezione del mercato non valida.';
        if (!uniqIdx(give, hand.length)) return 'Selezione della mano non valida.';
        if (camels < 0 || camels > s.herds[seat]) return 'Non hai abbastanza cammelli.';
        if (take.length < 2) return 'Per scambiare prendi almeno 2 merci.';
        for (i = 0; i < take.length; i++) {
          if (!s.market[take[i]] || s.market[take[i]] === CAMEL) return 'Nello scambio non si prendono cammelli.';
        }
        if (give.length + camels !== take.length) return 'Devi dare tante carte quante ne prendi.';
        var takenTypes = {};
        take.forEach(function (ix) { takenTypes[s.market[ix]] = true; });
        for (i = 0; i < give.length; i++) {
          if (takenTypes[hand[give[i]]]) return 'Non puoi dare lo stesso tipo di merce che prendi.';
        }
        if (hand.length - give.length + take.length > HAND_LIMIT) return 'Finiresti con più di 7 carte in mano.';
        return null;
      }
      case 'sell': {
        var g = m.good, n = m.n;
        if (GOODS.indexOf(g) < 0) return 'Merce non valida.';
        if (typeof n !== 'number' || n !== Math.floor(n) || n < 1) return 'Scegli quante carte vendere.';
        if (n > countOf(hand, g)) return 'Non hai abbastanza carte di quel tipo.';
        if (PRECIOUS[g] && n < 2) return 'Diamanti, oro e argento si vendono almeno 2 alla volta.';
        return null;
      }
    }
    return 'Mossa sconosciuta.';
  }

  /* ---------- applicazione mosse ---------- */

  function applyMove(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state);
    var roundOver = null;
    var last = { s: seat, t: m.type, slots: [] };

    if (m.type === 'take') {
      var card = s.market[m.idx];
      s.hands[seat] = sortHand(s.hands[seat].concat([card]));
      last.g = card;
      last.slots = [m.idx];
      if (s.deck.length) s.market[m.idx] = s.deck.pop();
      else { s.market[m.idx] = null; roundOver = 'deck'; }
    } else if (m.type === 'camels') {
      var n = 0;
      for (var i = 0; i < s.market.length; i++) {
        if (s.market[i] === CAMEL) {
          n++;
          last.slots.push(i);
          if (s.deck.length) s.market[i] = s.deck.pop();
          else { s.market[i] = null; roundOver = 'deck'; }
        }
      }
      s.herds[seat] += n;
      last.n = n;
    } else if (m.type === 'swap') {
      var hand = s.hands[seat];
      var taken = m.take.map(function (ix) { return s.market[ix]; });
      var given = m.give.map(function (ix) { return hand[ix]; });
      for (var c = 0; c < m.camels; c++) given.push(CAMEL);
      var kept = hand.filter(function (card, ix) { return m.give.indexOf(ix) < 0; });
      m.take.forEach(function (ix, k) { s.market[ix] = given[k]; });
      s.hands[seat] = sortHand(kept.concat(taken));
      s.herds[seat] -= m.camels;
      last.took = taken;
      last.gave = given;
      last.slots = m.take.slice();
    } else if (m.type === 'sell') {
      var g = m.good, cnt = m.n, removed = 0;
      s.hands[seat] = s.hands[seat].filter(function (card) {
        if (card === g && removed < cnt) { removed++; return false; }
        return true;
      });
      s.discard[g] += cnt;
      var got = [];
      for (var t = 0; t < cnt && s.tokens[g].length; t++) {
        var v = s.tokens[g].shift();
        got.push(v);
        s.won[seat].goods.push({ g: g, v: v });
      }
      var bonusK = 0;
      if (cnt >= 3) {
        var k = String(Math.min(cnt, 5));
        if (s.bonus[k].length) {
          bonusK = +k;
          s.won[seat].bonus.push({ k: +k, v: s.bonus[k].pop() });
        }
      }
      last.g = g;
      last.n = cnt;
      last.got = got;
      last.bonusK = bonusK;
      if (emptyPiles(s) >= 3) roundOver = 'tokens';
    }

    touch(s, state.v);
    s.last = last;
    pushLog(s, last);
    if (roundOver) endRound(s, roundOver);
    else s.turn = 1 - seat;
    return { ok: true, state: s };
  }

  /* ---------- transizioni di partita ---------- */

  function join(state, key, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'Il tavolo è già al completo.' };
    var s = clone(state);
    s.seats[1] = { keys: key ? [key] : [], name: (name || '').slice(0, 24) };
    startRound(s, randInt(2));
    touch(s, state.v);
    return { ok: true, state: s };
  }

  function startLocal(name1, name2) {
    var s = newGame({ local: true, name: name1, name2: name2 });
    startRound(s, randInt(2));
    return s;
  }

  function nextRound(state) {
    if (!state || state.status !== 'roundEnd') return { ok: false, error: 'La manche non è finita.' };
    var s = clone(state);
    startRound(s, state.result.next);
    touch(s, state.v);
    return { ok: true, state: s };
  }

  function rematch(state) {
    if (!state || state.status !== 'gameOver') return { ok: false, error: 'La partita non è finita.' };
    var s = clone(state);
    s.seals = [0, 0];
    s.round = 0;
    s.history = [];
    s.log = [];
    startRound(s, state.result ? state.result.next : randInt(2));
    touch(s, state.v);
    return { ok: true, state: s };
  }

  function addSeatKey(state, seat, key) {
    var s = clone(state);
    var keys = (s.seats[seat].keys || []).filter(function (k) { return k !== key; });
    keys.push(key);
    if (keys.length > 6) keys = keys.slice(keys.length - 6);
    s.seats[seat].keys = keys;
    // una chiave appartiene a un solo posto
    var other = s.seats[1 - seat];
    other.keys = (other.keys || []).filter(function (k) { return k !== key; });
    touch(s, state.v);
    return { ok: true, state: s };
  }

  function seatOf(state, key) {
    if (!state || !key) return -1;
    for (var p = 0; p < 2; p++) {
      if ((state.seats[p].keys || []).indexOf(key) >= 0) return p;
    }
    return -1;
  }

  /* ---------- informazioni per l'interfaccia ---------- */

  // Gettoni che si otterrebbero vendendo n carte di g (senza modificare lo stato).
  function salePreview(s, g, n) {
    var vals = (s.tokens[g] || []).slice(0, n);
    var k = n >= 3 ? String(Math.min(n, 5)) : null;
    return { values: vals, rupees: sum(vals), bonusK: k && s.bonus[k].length ? +k : 0 };
  }

  function purse(s, p) {
    var goods = sum(s.won[p].goods.map(function (t) { return t.v; }));
    var bonus = sum(s.won[p].bonus.map(function (t) { return t.v; }));
    return { goods: goods, bonus: bonus, nBonus: s.won[p].bonus.length, nGoods: s.won[p].goods.length };
  }

  function cardCensus(s) {
    var c = {};
    TYPES.forEach(function (t) { c[t] = 0; });
    s.deck.forEach(function (t) { c[t]++; });
    s.market.forEach(function (t) { if (t) c[t]++; });
    s.hands[0].concat(s.hands[1]).forEach(function (t) { c[t]++; });
    c.cam += s.herds[0] + s.herds[1];
    GOODS.forEach(function (g) { c[g] += s.discard[g]; });
    return c;
  }

  // Tutte le mosse legali (le permutazioni di scambio sono campionate se troppe).
  function legalMoves(s, seat, maxSwaps) {
    var out = [];
    if (!s || s.status !== 'playing' || s.turn !== seat) return out;
    var hand = s.hands[seat];
    var i;
    if (s.market.indexOf(CAMEL) >= 0) out.push({ type: 'camels' });
    if (hand.length < HAND_LIMIT) {
      for (i = 0; i < s.market.length; i++) if (s.market[i] && s.market[i] !== CAMEL) out.push({ type: 'take', idx: i });
    }
    GOODS.forEach(function (g) {
      var have = countOf(hand, g);
      for (var n = PRECIOUS[g] ? 2 : 1; n <= have; n++) out.push({ type: 'sell', good: g, n: n });
    });
    var goodsIdx = [];
    for (i = 0; i < s.market.length; i++) if (s.market[i] && s.market[i] !== CAMEL) goodsIdx.push(i);
    var limit = maxSwaps || 40;
    for (var tries = 0; tries < limit * 4 && goodsIdx.length >= 2; tries++) {
      var pool = shuffle(goodsIdx.slice());
      var k = 2 + randInt(pool.length - 1);
      var take = pool.slice(0, k);
      var types = {};
      take.forEach(function (ix) { types[s.market[ix]] = true; });
      var givable = [];
      hand.forEach(function (c, ix) { if (!types[c]) givable.push(ix); });
      shuffle(givable);
      var camels = Math.min(s.herds[seat], randInt(k + 1));
      var fromHand = k - camels;
      if (fromHand > givable.length) continue;
      var mv = { type: 'swap', take: take, give: givable.slice(0, fromHand), camels: camels };
      if (!validate(s, seat, mv)) out.push(mv);
      if (out.length > 200) break;
    }
    return out;
  }

  var api = {
    GOODS: GOODS, CAMEL: CAMEL, TYPES: TYPES, PRECIOUS: PRECIOUS, CARD_COUNTS: CARD_COUNTS,
    TOKEN_VALUES: TOKEN_VALUES, BONUS_VALUES: BONUS_VALUES, HAND_LIMIT: HAND_LIMIT,
    MARKET_SIZE: MARKET_SIZE, CAMEL_BONUS: CAMEL_BONUS, SEALS_TO_WIN: SEALS_TO_WIN,
    TOTAL_CARDS: TOTAL_CARDS, NAME: NAME,
    newGame: newGame, startRound: startRound, endRound: endRound, validate: validate,
    applyMove: applyMove, join: join, startLocal: startLocal, nextRound: nextRound,
    rematch: rematch, addSeatKey: addSeatKey, seatOf: seatOf, salePreview: salePreview,
    purse: purse, cardCensus: cardCensus, legalMoves: legalMoves, emptyPiles: emptyPiles,
    countOf: countOf, sortHand: sortHand, clone: clone, sum: sum, randInt: randInt,
    _setRng: function (f) { rng = f; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GranBazar = api;
})(typeof window !== 'undefined' ? window : this);
