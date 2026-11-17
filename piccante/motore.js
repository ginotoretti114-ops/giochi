/* Piccante: motore di gioco puro (nessun DOM). Gioco a prese con scommessa e una missione per round.
   Carte: numeri da 1 a 55 e il jolly "J". Stato = JSON semplice, senza array annidati. */
(function (root) {
  'use strict';

  var JOKER = 'J';
  var LIMIT = 7;
  var MIN_PLAYERS = 2, MAX_PLAYERS = 8;
  var LOG_MAX = 60;

  /* Le 40 missioni. Il regolamento descrive gli effetti; carte da distribuire, numero di carte da passare,
     scommessa vietata e numeri piccanti di ogni singola carta sono una ricostruzione. */
  var MISSIONS = [
    { id: 'pa1', type: 'pass', n: 1, dir: 'L', cards: 5 }, { id: 'pa2', type: 'pass', n: 1, dir: 'L', cards: 7 },
    { id: 'pa3', type: 'pass', n: 1, dir: 'R', cards: 4 }, { id: 'pa4', type: 'pass', n: 1, dir: 'R', cards: 6 },
    { id: 'pa5', type: 'pass', n: 2, dir: 'L', cards: 6 }, { id: 'pa6', type: 'pass', n: 2, dir: 'R', cards: 5 },
    { id: 'ma1', type: 'passAll', dir: 'L', cards: 4 }, { id: 'ma2', type: 'passAll', dir: 'R', cards: 6 },
    { id: 'nb1', type: 'noBid', v: 0, cards: 4 }, { id: 'nb2', type: 'noBid', v: 0, cards: 6 },
    { id: 'nb3', type: 'noBid', v: 1, cards: 3 }, { id: 'nb4', type: 'noBid', v: 1, cards: 5 },
    { id: 'dr1', type: 'draw', cards: 4 }, { id: 'dr2', type: 'draw', cards: 6 },
    { id: 'rv1', type: 'reveal', cards: 3 }, { id: 'rv2', type: 'reveal', cards: 5 },
    { id: 'bb1', type: 'blindBid', cards: 4 }, { id: 'bb2', type: 'blindBid', cards: 6 },
    { id: 'si1', type: 'simul', cards: 5 }, { id: 'si2', type: 'simul', cards: 7 },
    { id: 'pr1', type: 'reward', cards: 3 }, { id: 'pr2', type: 'reward', cards: 5 }, { id: 'pr3', type: 'reward', cards: 7 },
    { id: 'in1', type: 'invert', cards: 4 }, { id: 'in2', type: 'invert', cards: 5 }, { id: 'in3', type: 'invert', cards: 6 },
    { id: 'x31', type: 'peek3', cards: 5, expert: true }, { id: 'x32', type: 'peek3', cards: 7, expert: true },
    { id: 'fl1', type: 'firstLast', cards: 4, expert: true }, { id: 'fl2', type: 'firstLast', cards: 6, expert: true },
    { id: 'fr1', type: 'forehead', cards: 3, expert: true }, { id: 'fr2', type: 'forehead', cards: 4, expert: true },
    { id: 'nc1', type: 'noCopy', cards: 5, expert: true },
    { id: 'sw1', type: 'swap', cards: 4, expert: true }, { id: 'sw2', type: 'swap', cards: 6, expert: true },
    { id: 'ex1', type: 'extreme', cards: 5, expert: true },
    { id: 'bp1', type: 'blindPlay', cards: 3, expert: true },
    { id: 'ho1', type: 'hot', nums: [11, 22, 33, 44, 55], cards: 5, expert: true },
    { id: 'ho2', type: 'hot', nums: [5, 15, 25, 35, 45], cards: 6, expert: true },
    { id: 'sh1', type: 'shared', cards: 5, expert: true }
  ];
  var BY_ID = {};
  MISSIONS.forEach(function (m) { BY_ID[m.id] = m; });

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
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function sortHand(h) { return h.slice().sort(function (a, b) { return (a === JOKER ? 99 : a) - (b === JOKER ? 99 : b); }); }
  function perSeat(n, v) { var o = {}; for (var i = 0; i < n; i++) o[i] = v; return o; }
  function pushLog(s, e) { s.log = (s.log || []).concat([e]); if (s.log.length > LOG_MAX) s.log = s.log.slice(s.log.length - LOG_MAX); }
  function touch(s, prevV) { s.v = (prevV || 0) + 1; s.updatedAt = Date.now(); return s; }

  function mission(s) { return s.mission ? BY_ID[s.mission] : null; }
  function mtype(s) { var m = mission(s); return m ? m.type : null; }
  function missionIds(mode) {
    return MISSIONS.filter(function (m) { return mode === 'tutte' || (mode === 'base' && !m.expert); }).map(function (m) { return m.id; });
  }
  function neighbor(s, p, dir) { var n = s.seats.length; return dir === 'L' ? (p + 1) % n : (p - 1 + n) % n; }
  function order(s, from) { var out = [], n = s.seats.length; for (var i = 0; i < n; i++) out.push((from + i) % n); return out; }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now();
    var names = opts.names || [opts.name || ''];
    return {
      app: 'piccante', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online', status: 'waiting',
      seats: names.map(function (n, i) { return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(n || '').slice(0, 20) }; }),
      host: 0, missions: opts.missions || 'tutte', limit: LIMIT,
      round: 0, dealer: 0, mdeck: [], mission: null, deck: [], hands: {}, N: 0,
      phase: 'bid', turn: 0, bids: {}, passSel: {}, designated: {}, sim: {}, won: {}, hot: {},
      trick: null, lastTrick: null, trickNo: 0, firstWinner: -1, lastWinner: -1, swap: null, revealed: false,
      pilis: [], history: [], last: null, log: [], result: null
    };
  }

  function startRound(s) {
    var P = s.seats.length, m = null;
    if (s.missions !== 'nessuna') {
      if (!s.mdeck || !s.mdeck.length) s.mdeck = shuffle(missionIds(s.missions));
      m = BY_ID[s.mdeck.pop()];
    }
    s.mission = m ? m.id : null;
    var extra = m && m.type === 'draw' ? 1 : 0;
    var N = Math.max(1, Math.min(m ? m.cards : 5, Math.floor(56 / P) - extra));
    var deck = [];
    for (var c = 1; c <= 55; c++) deck.push(c);
    deck.push(JOKER);
    shuffle(deck);
    s.hands = {};
    for (var p = 0; p < P; p++) s.hands[p] = [];
    for (var k = 0; k < N; k++) order(s, (s.dealer + 1) % P).forEach(function (q) { s.hands[q].push(deck.pop()); });
    for (p = 0; p < P; p++) s.hands[p] = sortHand(s.hands[p]);
    s.deck = deck;
    s.N = N;
    s.bids = perSeat(P, null); s.passSel = perSeat(P, null); s.designated = perSeat(P, null);
    s.sim = perSeat(P, null); s.won = perSeat(P, 0); s.hot = perSeat(P, 0);
    s.trick = null; s.lastTrick = null; s.trickNo = 0; s.firstWinner = -1; s.lastWinner = -1; s.swap = null; s.revealed = false;
    s.round = (s.round || 0) + 1;
    s.phase = 'bid'; s.turn = s.dealer; s.status = 'playing'; s.result = null; s.last = null;
    pushLog(s, { t: 'round', r: s.round, d: s.dealer, m: s.mission });
    return s;
  }

  /* ---------- scommesse ---------- */
  function tricks(s) { return s.N + (mtype(s) === 'draw' ? 1 : 0); }
  function bidOptions(s, seat) {
    var P = s.seats.length, N = tricks(s), m = mission(s);
    var placed = 0, total = 0;
    for (var i = 0; i < P; i++) if (s.bids[i] != null) { placed++; total += s.bids[i]; }
    var isLast = placed === P - 1;
    var prevSeat = seat === s.dealer ? -1 : (seat - 1 + P) % P;
    var prevBid = prevSeat >= 0 ? s.bids[prevSeat] : null;
    function build(strict) {
      var out = [];
      for (var v = 0; v <= N; v++) {
        if (isLast && total + v === N) continue;
        if (strict && m && m.type === 'noBid' && v === m.v) continue;
        if (strict && m && m.type === 'noCopy' && prevBid != null && v === prevBid) continue;
        out.push(v);
      }
      return out;
    }
    var opts = build(true);
    return opts.length ? opts : build(false);
  }

  function startPlay(s) {
    s.phase = 'play';
    s.trick = { leader: s.dealer, plays: [] };
    s.turn = s.dealer;
    s.sim = perSeat(s.seats.length, null);
  }

  function afterBids(s) {
    var P = s.seats.length, m = mission(s), p;
    if (m && m.type === 'passAll') {
      var moved = {};
      for (p = 0; p < P; p++) moved[neighbor(s, p, m.dir)] = s.hands[p];
      s.hands = moved;
    }
    if (m && m.type === 'draw') order(s, s.dealer).forEach(function (q) { if (s.deck.length) s.hands[q].push(s.deck.pop()); });
    if (m && m.type === 'reveal') s.revealed = true;
    for (p = 0; p < P; p++) s.hands[p] = sortHand(s.hands[p]);
    if (m && m.type === 'pass') { s.phase = 'pass'; return; }
    if (m && m.type === 'shared') { s.phase = 'designate'; return; }
    startPlay(s);
  }

  function afterPass(s) {
    var P = s.seats.length, m = mission(s), p;
    var incoming = perSeat(P, null);
    for (p = 0; p < P; p++) incoming[neighbor(s, p, m.dir)] = s.passSel[p];
    for (p = 0; p < P; p++) {
      var mine = s.passSel[p];
      s.hands[p] = sortHand(s.hands[p].filter(function (c) { return mine.indexOf(c) < 0; }).concat(incoming[p]));
    }
    pushLog(s, { t: 'passed', n: m.n, dir: m.dir });
    startPlay(s);
  }

  /* ---------- prese ---------- */
  function extremes(hand) {
    var nums = hand.filter(function (c) { return c !== JOKER; });
    var out = hand.indexOf(JOKER) >= 0 ? [JOKER] : [];
    if (nums.length) { out.push(Math.min.apply(null, nums)); out.push(Math.max.apply(null, nums)); }
    return out;
  }
  function resolveTrick(s) {
    var plays = s.trick.plays, inv = mtype(s) === 'invert', best = plays[0];
    for (var i = 1; i < plays.length; i++) {
      if (inv ? plays[i].v < best.v : plays[i].v > best.v) best = plays[i]; // a pari valore vince chi ha giocato prima
    }
    var w = best.s, m = mission(s);
    s.won[w] += 1;
    s.trickNo += 1;
    if (s.trickNo === 1) s.firstWinner = w;
    if (m && m.type === 'hot' && plays.some(function (p) { return m.nums.indexOf(p.c) >= 0; })) s.hot[w] += 1;
    s.lastTrick = { plays: plays, winner: w, no: s.trickNo };
    var entry = { t: 'trick', w: w, no: s.trickNo, c: plays.map(function (p) { return p.c; }) };
    plays.forEach(function (p) { if (p.c === JOKER) entry.j = p.v; }); // valore scelto per il jolly
    pushLog(s, entry);
    s.sim = perSeat(s.seats.length, null);
    if (!s.hands[w].length) { s.lastWinner = w; s.trick = null; return endRound(s); }
    if (m && m.type === 'swap') { s.phase = 'swapPick'; s.swap = { winner: w, target: -1, give: null }; s.turn = w; s.trick = null; return s; }
    s.trick = { leader: w, plays: [] };
    s.turn = w;
    return s;
  }

  function endRound(s) {
    var P = s.seats.length, m = mission(s), p;
    var own = [], details = [];
    for (p = 0; p < P; p++) {
      var base = Math.abs(s.bids[p] - s.won[p]), extra = 0;
      if (m && m.type === 'firstLast') extra += (s.firstWinner === p ? 1 : 0) + (s.lastWinner === p ? 1 : 0);
      if (m && m.type === 'hot') extra += s.hot[p];
      own.push(base + extra);
      details.push({ base: base, extra: extra, shared: 0, reward: 0 });
    }
    var delta = own.slice();
    if (m && m.type === 'shared') for (p = 0; p < P; p++) { var d = s.designated[p]; if (d != null) { delta[p] += own[d]; details[p].shared = own[d]; } }
    if (m && m.type === 'reward') for (p = 0; p < P; p++) if (s.bids[p] === s.won[p]) { delta[p] -= s.bids[p]; details[p].reward = s.bids[p]; }
    if (!s.pilis || s.pilis.length !== P) s.pilis = perSeatArr(P);
    var before = s.pilis.slice();
    s.pilis = s.pilis.map(function (x, i) { return Math.max(0, x + delta[i]); });
    var change = s.pilis.map(function (x, i) { return x - before[i]; });
    s.history = (s.history || []).concat([{ round: s.round, mission: s.mission, change: change }]);
    var over = s.pilis.some(function (x) { return x >= (s.limit || LIMIT); });
    var winners = [];
    if (over) { var best = Math.min.apply(null, s.pilis); s.pilis.forEach(function (x, i) { if (x === best) winners.push(i); }); }
    s.result = {
      round: s.round, mission: s.mission, bids: arr(s.bids, P), won: arr(s.won, P), change: change, details: details,
      designated: arr(s.designated, P), over: over, winners: winners
    };
    s.status = over ? 'gameOver' : 'roundEnd';
    s.phase = 'over';
    pushLog(s, { t: 'end', r: s.round });
    return s;
  }
  function perSeatArr(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function arr(o, n) { var a = []; for (var i = 0; i < n; i++) a.push(o[i]); return a; }

  /* ---------- mosse ---------- */
  function inHand(s, seat, c) { return s.hands[seat].indexOf(c) >= 0; }
  function validJoker(s, seat, jv) {
    if (typeof jv !== 'number' || jv !== Math.floor(jv) || jv < 0 || jv > 56) return 'Scegli un valore del jolly tra 0 e 56.';
    if (mtype(s) !== 'simul' && s.trick && s.trick.plays.some(function (p) { return p.c !== JOKER && p.c === jv; })) return 'Il ' + jv + ' è già sul tavolo: scegli un altro valore.';
    if (mtype(s) === 'extreme') {
      var r = jokerRange(s, seat);
      if (r && jv > r.lo && jv < r.hi) return 'Con questa missione il jolly deve valere al massimo ' + r.lo + ' o almeno ' + r.hi + '.';
    }
    return null;
  }
  // Con «Tutto o niente» il jolly deve restare la carta più bassa o la più alta della mano.
  function jokerRange(s, seat) {
    var nums = (s.hands[seat] || []).filter(function (c) { return c !== JOKER; });
    return nums.length ? { lo: Math.min.apply(null, nums), hi: Math.max.apply(null, nums) } : null;
  }
  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'Il round non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    var P = s.seats.length;
    if (typeof seat !== 'number' || seat < 0 || seat >= P) return 'Non sei seduto al tavolo.';
    var mt = mtype(s), i;
    switch (m.type) {
      case 'bid':
        if (s.phase !== 'bid') return 'Le scommesse sono chiuse.';
        if (s.turn !== seat) return 'Non è il tuo turno di scommettere.';
        if (bidOptions(s, seat).indexOf(m.n) < 0) return 'Questa scommessa non è permessa.';
        return null;
      case 'pass': {
        if (s.phase !== 'pass') return 'Ora non si passano carte.';
        if (s.passSel[seat] != null) return 'Hai già scelto le carte da passare.';
        var need = mission(s).n;
        if (!Array.isArray(m.cards) || m.cards.length !== need) return 'Scegli ' + need + ' ' + (need === 1 ? 'carta' : 'carte') + '.';
        for (i = 0; i < m.cards.length; i++) {
          if (!inHand(s, seat, m.cards[i]) || m.cards.indexOf(m.cards[i]) !== i) return 'Carte non valide.';
        }
        return null;
      }
      case 'designate':
        if (s.phase !== 'designate') return 'Ora non si sceglie nessuno.';
        if (s.designated[seat] != null) return 'Hai già scelto.';
        if (typeof m.target !== 'number' || m.target < 0 || m.target >= P || m.target === seat) return 'Scegli un altro giocatore.';
        return null;
      case 'play': {
        if (s.phase !== 'play') return 'Ora non si giocano carte.';
        if (mt === 'simul') { if (s.sim[seat] != null) return 'Hai già scelto la carta.'; }
        else if (s.turn !== seat) return 'Non è il tuo turno.';
        if (!inHand(s, seat, m.card)) return 'Non hai quella carta.';
        if (mt === 'extreme' && extremes(s.hands[seat]).indexOf(m.card) < 0) return 'Devi giocare la carta più alta o la più bassa.';
        if (m.card === JOKER) return validJoker(s, seat, m.jv);
        return null;
      }
      case 'swapPick':
        if (s.phase !== 'swapPick') return 'Ora non si scambia.';
        if (seat !== s.swap.winner) return 'Sceglie chi ha vinto la presa.';
        if (typeof m.target !== 'number' || m.target < 0 || m.target >= P || m.target === seat) return 'Scegli un altro giocatore.';
        if (!inHand(s, seat, m.card)) return 'Non hai quella carta.';
        return null;
      case 'swapGive':
        if (s.phase !== 'swapGive') return 'Ora non si scambia.';
        if (seat !== s.swap.target) return 'Non tocca a te.';
        if (!inHand(s, seat, m.card)) return 'Non hai quella carta.';
        return null;
    }
    return 'Mossa sconosciuta.';
  }

  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state), P = s.seats.length, mt = mtype(s), i;
    switch (m.type) {
      case 'bid': {
        s.bids[seat] = m.n;
        pushLog(s, { t: 'bid', s: seat, n: m.n });
        var next = (seat + 1) % P;
        if (next === s.dealer) afterBids(s); else s.turn = next;
        break;
      }
      case 'pass':
        s.passSel[seat] = m.cards.slice();
        for (i = 0; i < P; i++) if (s.passSel[i] == null) break;
        if (i === P) afterPass(s);
        break;
      case 'designate':
        s.designated[seat] = m.target;
        for (i = 0; i < P; i++) if (s.designated[i] == null) break;
        if (i === P) { pushLog(s, { t: 'designated' }); startPlay(s); }
        break;
      case 'play': {
        var v = m.card === JOKER ? m.jv : m.card;
        s.hands[seat] = s.hands[seat].filter(function (c) { return c !== m.card; });
        if (mt === 'simul') {
          s.sim[seat] = { c: m.card, v: v };
          for (i = 0; i < P; i++) if (s.sim[i] == null) break;
          if (i === P) {
            s.trick.plays = order(s, s.trick.leader).map(function (q) { return { s: q, c: s.sim[q].c, v: s.sim[q].v }; });
            resolveTrick(s);
          }
        } else {
          s.trick.plays.push({ s: seat, c: m.card, v: v });
          if (s.trick.plays.length === P) resolveTrick(s);
          else s.turn = (seat + 1) % P;
        }
        break;
      }
      case 'swapPick':
        s.swap.target = m.target; s.swap.give = m.card;
        s.phase = 'swapGive'; s.turn = m.target;
        break;
      case 'swapGive': {
        var w = s.swap.winner, t = s.swap.target, a = s.swap.give, b = m.card;
        s.hands[w] = sortHand(s.hands[w].filter(function (c) { return c !== a; }).concat([b]));
        s.hands[t] = sortHand(s.hands[t].filter(function (c) { return c !== b; }).concat([a]));
        pushLog(s, { t: 'swap', w: w, to: t });
        s.swap = null;
        s.phase = 'play'; s.trick = { leader: w, plays: [] }; s.turn = w;
        break;
      }
    }
    touch(s, state.v);
    return { ok: true, state: s };
  }

  // Chi deve agire adesso (per la modalità sullo stesso telefono): -1 se nessuno.
  function nextActor(s) {
    if (!s || s.status !== 'playing') return -1;
    var mt = mtype(s), list, i;
    if (s.phase === 'pass') { list = order(s, s.dealer); for (i = 0; i < list.length; i++) if (s.passSel[list[i]] == null) return list[i]; return -1; }
    if (s.phase === 'designate') { list = order(s, s.dealer); for (i = 0; i < list.length; i++) if (s.designated[list[i]] == null) return list[i]; return -1; }
    if (s.phase === 'play' && mt === 'simul') { list = order(s, s.trick.leader); for (i = 0; i < list.length; i++) if (s.sim[list[i]] == null) return list[i]; return -1; }
    if (s.phase === 'swapPick') return s.swap.winner;
    if (s.phase === 'swapGive') return s.swap.target;
    return s.turn;
  }
  // Chi ha ancora una scelta da fare nelle fasi in cui si decide tutti insieme.
  function waitingFor(s) {
    var P = s.seats.length, out = [], i;
    if (s.status !== 'playing') return out;
    if (s.phase === 'pass') { for (i = 0; i < P; i++) if (s.passSel[i] == null) out.push(i); return out; }
    if (s.phase === 'designate') { for (i = 0; i < P; i++) if (s.designated[i] == null) out.push(i); return out; }
    if (s.phase === 'play' && mtype(s) === 'simul') { for (i = 0; i < P; i++) if (s.sim[i] == null) out.push(i); return out; }
    var a = nextActor(s);
    return a >= 0 ? [a] : out;
  }

  /* ---------- tavolo ---------- */
  function seatOf(state, key) {
    if (!state || !key) return -1;
    for (var i = 0; i < state.seats.length; i++) if ((state.seats[i].keys || []).indexOf(key) >= 0) return i;
    return -1;
  }
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
    s.pilis = perSeatArr(s.seats.length); s.history = []; s.round = 0; s.mdeck = [];
    s.dealer = randInt(s.seats.length);
    startRound(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startLocal(names, missions) {
    var s = newGame({ local: true, names: names, missions: missions });
    s.pilis = perSeatArr(s.seats.length);
    s.dealer = randInt(s.seats.length);
    return startRound(s);
  }
  function nextRound(state) {
    if (!state || state.status !== 'roundEnd') return { ok: false, error: 'Il round non è finito.' };
    var s = clone(state);
    s.dealer = (s.dealer + 1) % s.seats.length;
    startRound(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function rematch(state) {
    if (!state || state.status !== 'gameOver') return { ok: false, error: 'La partita non è finita.' };
    var s = clone(state);
    s.pilis = perSeatArr(s.seats.length); s.history = []; s.round = 0; s.log = []; s.mdeck = [];
    s.dealer = (s.dealer + 1) % s.seats.length;
    startRound(s);
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
  function cardCount(s) {
    var n = s.deck.length;
    for (var p = 0; p < s.seats.length; p++) n += (s.hands[p] || []).length;
    if (s.trick) n += s.trick.plays.length;
    for (var q = 0; q < s.seats.length; q++) if (s.sim && s.sim[q]) n += 1; // carte scelte insieme, non ancora scoperte
    return n;
  }

  // Mosse legali di un giocatore (per i test).
  function legalMoves(s, seat) {
    var out = [];
    if (!s || s.status !== 'playing') return out;
    if (s.phase === 'bid') {
      if (s.turn === seat) bidOptions(s, seat).forEach(function (n) { out.push({ type: 'bid', n: n }); });
      return out;
    }
    var hand = s.hands[seat] || [], P = s.seats.length, i;
    if (s.phase === 'pass' && s.passSel[seat] == null) {
      var need = mission(s).n;
      for (i = 0; i < 4; i++) out.push({ type: 'pass', cards: shuffle(hand.slice()).slice(0, need) });
    }
    if (s.phase === 'designate' && s.designated[seat] == null) for (i = 0; i < P; i++) if (i !== seat) out.push({ type: 'designate', target: i });
    if (s.phase === 'play') {
      hand.forEach(function (c) {
        var mv = c === JOKER ? [0, 56, randInt(57)].map(function (jv) { return { type: 'play', card: c, jv: jv }; }) : [{ type: 'play', card: c }];
        mv.forEach(function (x) { if (validate(s, seat, x) === null) out.push(x); });
      });
    }
    if (s.phase === 'swapPick' && seat === s.swap.winner) {
      for (i = 0; i < P; i++) if (i !== seat) hand.forEach(function (c) { out.push({ type: 'swapPick', target: i, card: c }); });
    }
    if (s.phase === 'swapGive' && seat === s.swap.target) hand.forEach(function (c) { out.push({ type: 'swapGive', card: c }); });
    return out;
  }

  var api = {
    JOKER: JOKER, LIMIT: LIMIT, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, MISSIONS: MISSIONS, BY_ID: BY_ID,
    mission: mission, mtype: mtype, missionIds: missionIds, tricks: tricks, jokerRange: jokerRange, neighbor: neighbor, order: order, extremes: extremes,
    newGame: newGame, startRound: startRound, startGame: startGame, startLocal: startLocal, nextRound: nextRound,
    rematch: rematch, join: join, addSeatKey: addSeatKey, seatOf: seatOf, bidOptions: bidOptions,
    validate: validate, act: act, nextActor: nextActor, waitingFor: waitingFor, cardCount: cardCount,
    legalMoves: legalMoves, clone: clone, sum: sum, randInt: randInt, sortHand: sortHand,
    _setRng: function (f) { rng = f; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Piccante = api;
})(typeof window !== 'undefined' ? window : this);
