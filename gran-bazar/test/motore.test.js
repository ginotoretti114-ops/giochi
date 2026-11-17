/* Collaudo del motore: scenari mirati + migliaia di partite casuali con controllo invarianti. */
'use strict';
const assert = require('assert');
const E = require('../motore.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
E._setRng(mulberry32(12345));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('FALLITO:', name); throw e; }
}

const ms = (arr) => arr.slice().sort().join(',');

// Stato di prova costruito a mano (manche in corso, tocca a 0).
function mk(o) {
  const s = E.newGame({ local: true, name: 'A', name2: 'B' });
  E.startRound(s, 0);
  Object.assign(s, {
    market: o.market || ['cam', 'cam', 'cam', 'lea', 'clo'],
    deck: o.deck || ['spi', 'spi', 'gol', 'dia', 'lea', 'lea'],
    hands: { 0: E.sortHand(o.h0 || []), 1: E.sortHand(o.h1 || []) },
    herds: o.herds || [0, 0],
    turn: o.turn || 0,
  });
  if (o.tokens) Object.assign(s.tokens, o.tokens);
  if (o.bonus) Object.assign(s.bonus, o.bonus);
  return s;
}

function noUndefined(x, path) {
  if (x === undefined) throw new Error('undefined in ' + path);
  if (Array.isArray(x)) {
    x.forEach((v, i) => {
      if (Array.isArray(v)) throw new Error('array annidato in ' + path);
      noUndefined(v, path + '[' + i + ']');
    });
  } else if (x && typeof x === 'object') {
    for (const k of Object.keys(x)) noUndefined(x[k], path + '.' + k);
  }
}

/* ---------- preparazione ---------- */
test('preparazione corretta', () => {
  for (let r = 0; r < 200; r++) {
    const s = E.startLocal('A', 'B');
    assert.strictEqual(s.status, 'playing');
    assert.strictEqual(s.market.length, 5);
    assert.ok(s.market.filter((c) => c === 'cam').length >= 3);
    assert.strictEqual(s.hands[0].length + s.herds[0], 5);
    assert.strictEqual(s.hands[1].length + s.herds[1], 5);
    assert.ok(!s.hands[0].includes('cam') && !s.hands[1].includes('cam'));
    assert.strictEqual(s.deck.length, 40);
    assert.deepStrictEqual(E.cardCensus(s), E.CARD_COUNTS);
    assert.deepStrictEqual(s.bonus['3'].slice().sort(), [1, 1, 2, 2, 2, 3, 3].sort());
    assert.deepStrictEqual(s.bonus['4'].slice().sort(), [4, 4, 5, 5, 6, 6].sort());
    assert.deepStrictEqual(s.bonus['5'].slice().sort((a, b) => a - b), [8, 8, 9, 10, 10]);
    assert.deepStrictEqual(s.tokens.dia, [7, 7, 5, 5, 5]);
    assert.deepStrictEqual(s.tokens.lea, [4, 3, 2, 1, 1, 1, 1, 1, 1]);
    assert.strictEqual(s.turn, s.starter);
    noUndefined(JSON.parse(JSON.stringify(s)), 's');
  }
  const tot = Object.values(E.CARD_COUNTS).reduce((a, b) => a + b, 0);
  assert.strictEqual(tot, 55);
  const toks = Object.values(E.TOKEN_VALUES).reduce((a, b) => a + b.length, 0);
  assert.strictEqual(toks, 38);
  assert.strictEqual(7 + 6 + 5, 18);
});

/* ---------- prendere una merce ---------- */
test('prendi una merce', () => {
  const s = mk({ h0: ['dia'], deck: ['spi', 'gol'] });
  const r = E.applyMove(s, 0, { type: 'take', idx: 3 });
  assert.ok(r.ok, r.error);
  assert.deepStrictEqual(r.state.hands[0], ['dia', 'lea']);
  assert.strictEqual(r.state.market[3], 'gol'); // carta in cima al mazzo = ultima
  assert.strictEqual(r.state.deck.length, 1);
  assert.strictEqual(r.state.turn, 1);
  assert.strictEqual(r.state.v, s.v + 1);
});
test('non si prende un cammello da solo', () => {
  const s = mk({});
  assert.ok(!E.applyMove(s, 0, { type: 'take', idx: 0 }).ok);
});
test('limite di 7 carte per la presa singola', () => {
  const s = mk({ h0: ['dia', 'dia', 'gol', 'gol', 'sil', 'sil', 'spi'] });
  const r = E.applyMove(s, 0, { type: 'take', idx: 3 });
  assert.ok(!r.ok);
});
test('non è il tuo turno', () => {
  const s = mk({ turn: 1 });
  assert.ok(!E.applyMove(s, 0, { type: 'camels' }).ok);
});
test('presa singola a mazzo vuoto chiude la manche', () => {
  const s = mk({ deck: [] });
  const r = E.applyMove(s, 0, { type: 'take', idx: 4 });
  assert.ok(r.ok);
  assert.strictEqual(r.state.market[4], null);
  assert.ok(['roundEnd', 'gameOver'].includes(r.state.status));
  assert.strictEqual(r.state.result.reason, 'deck');
});

/* ---------- cammelli ---------- */
test('prendi tutti i cammelli', () => {
  const s = mk({ herds: [2, 0], deck: ['a', 'b', 'lea', 'spi', 'dia'].slice(2) });
  const r = E.applyMove(s, 0, { type: 'camels' });
  assert.ok(r.ok);
  assert.strictEqual(r.state.herds[0], 5);
  assert.deepStrictEqual(r.state.market, ['dia', 'spi', 'lea', 'lea', 'clo']);
  assert.strictEqual(r.state.deck.length, 0);
  assert.strictEqual(r.state.status, 'playing'); // il mazzo è bastato: la manche continua
  const r2 = E.applyMove(r.state, 1, { type: 'take', idx: 0 });
  assert.ok(r2.ok);
  assert.notStrictEqual(r2.state.status, 'playing'); // ora non si può riempire
});
test('cammelli con mazzo insufficiente chiudono la manche', () => {
  const s = mk({ deck: ['spi'] });
  const r = E.applyMove(s, 0, { type: 'camels' });
  assert.ok(r.ok);
  assert.strictEqual(r.state.result.reason, 'deck');
});
test('niente cammelli al mercato', () => {
  const s = mk({ market: ['lea', 'lea', 'spi', 'clo', 'dia'] });
  assert.ok(!E.applyMove(s, 0, { type: 'camels' }).ok);
});

/* ---------- scambio ---------- */
test('scambio 2 per 2 con un cammello', () => {
  const s = mk({ market: ['cam', 'dia', 'gol', 'lea', 'clo'], h0: ['spi', 'spi'], herds: [3, 0] });
  const r = E.applyMove(s, 0, { type: 'swap', take: [1, 2], give: [0], camels: 1 });
  assert.ok(r.ok, r.error);
  assert.deepStrictEqual(r.state.hands[0], ['dia', 'gol', 'spi']);
  assert.deepStrictEqual(r.state.market, ['cam', 'spi', 'cam', 'lea', 'clo']);
  assert.strictEqual(r.state.herds[0], 2);
  assert.strictEqual(r.state.deck.length, s.deck.length); // lo scambio non pesca
});
test('scambio 1 per 1 vietato', () => {
  const s = mk({ h0: ['spi'] });
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [3], give: [0], camels: 0 }).ok);
});
test('scambio: stesso tipo dato e preso vietato', () => {
  const s = mk({ market: ['cam', 'lea', 'spi', 'lea', 'clo'], h0: ['lea', 'dia'] });
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [1, 2], give: [0, 1], camels: 0 }).ok);
});
test('scambio: numero di carte diverso vietato', () => {
  const s = mk({ market: ['cam', 'lea', 'spi', 'gol', 'clo'], h0: ['dia', 'dia', 'dia'] });
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [1, 2], give: [0, 1, 2], camels: 0 }).ok);
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [1, 2, 3], give: [0, 1], camels: 0 }).ok);
});
test('scambio: niente cammelli presi', () => {
  const s = mk({ h0: ['dia', 'dia'] });
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [0, 3], give: [0, 1], camels: 0 }).ok);
});
test('scambio: limite di mano', () => {
  const s = mk({ market: ['cam', 'lea', 'spi', 'gol', 'clo'], h0: ['dia', 'dia', 'dia', 'sil', 'sil', 'sil'], herds: [4, 0] });
  const r = E.applyMove(s, 0, { type: 'swap', take: [1, 2], give: [], camels: 2 });
  assert.ok(!r.ok); // 6 + 2 = 8
  const r2 = E.applyMove(s, 0, { type: 'swap', take: [1, 2], give: [0], camels: 1 });
  assert.ok(r2.ok, r2.error); // 6 - 1 + 2 = 7
});
test('scambio: cammelli oltre la mandria e indici duplicati', () => {
  const s = mk({ market: ['cam', 'lea', 'spi', 'gol', 'clo'], h0: ['dia'], herds: [1, 0] });
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [1, 2], give: [], camels: 2 }).ok);
  assert.ok(!E.applyMove(s, 0, { type: 'swap', take: [1, 1], give: [0], camels: 1 }).ok);
});

/* ---------- vendita ---------- */
test('preziosi: almeno 2', () => {
  const s = mk({ h0: ['dia', 'gol', 'sil', 'lea'] });
  ['dia', 'gol', 'sil'].forEach((g) => assert.ok(!E.applyMove(s, 0, { type: 'sell', good: g, n: 1 }).ok));
  assert.ok(E.applyMove(s, 0, { type: 'sell', good: 'lea', n: 1 }).ok);
});
test('vendi 2 diamanti: 7+7', () => {
  const s = mk({ h0: ['dia', 'dia', 'dia'] });
  const r = E.applyMove(s, 0, { type: 'sell', good: 'dia', n: 2 });
  assert.ok(r.ok);
  assert.deepStrictEqual(r.state.won[0].goods.map((t) => t.v), [7, 7]);
  assert.deepStrictEqual(r.state.tokens.dia, [5, 5, 5]);
  assert.deepStrictEqual(r.state.hands[0], ['dia']);
  assert.strictEqual(r.state.won[0].bonus.length, 0);
  assert.strictEqual(r.state.discard.dia, 2);
});
test('vendi 3 cuoio: 4+3+2 e bonus da 3', () => {
  const s = mk({ h0: ['lea', 'lea', 'lea'], bonus: { '3': [2, 1, 3] } });
  const r = E.applyMove(s, 0, { type: 'sell', good: 'lea', n: 3 });
  assert.deepStrictEqual(r.state.won[0].goods.map((t) => t.v), [4, 3, 2]);
  assert.deepStrictEqual(r.state.won[0].bonus, [{ k: 3, v: 3 }]);
  assert.deepStrictEqual(r.state.bonus['3'], [2, 1]);
});
test('vendi 6 tessuti: bonus da 5', () => {
  const s = mk({ h0: ['clo', 'clo', 'clo', 'clo', 'clo', 'clo'], bonus: { '5': [8, 10] } });
  const r = E.applyMove(s, 0, { type: 'sell', good: 'clo', n: 6 });
  assert.deepStrictEqual(r.state.won[0].goods.map((t) => t.v), [5, 3, 3, 2, 2, 1]);
  assert.deepStrictEqual(r.state.won[0].bonus, [{ k: 5, v: 10 }]);
});
test('gettoni esauriti: il bonus si prende lo stesso', () => {
  const s = mk({ h0: ['spi', 'spi', 'spi', 'spi'], tokens: { spi: [1] }, bonus: { '4': [6] } });
  const r = E.applyMove(s, 0, { type: 'sell', good: 'spi', n: 4 });
  assert.deepStrictEqual(r.state.won[0].goods.map((t) => t.v), [1]);
  assert.deepStrictEqual(r.state.won[0].bonus, [{ k: 4, v: 6 }]);
});
test('pile bonus vuote: nessun bonus, nessun errore', () => {
  const s = mk({ h0: ['spi', 'spi', 'spi'], bonus: { '3': [] } });
  const r = E.applyMove(s, 0, { type: 'sell', good: 'spi', n: 3 });
  assert.ok(r.ok);
  assert.strictEqual(r.state.won[0].bonus.length, 0);
});
test('tre pile esaurite chiudono la manche', () => {
  const s = mk({ h0: ['lea', 'sil', 'sil'], tokens: { dia: [], gol: [], sil: [5, 5] } });
  const r1 = E.applyMove(s, 0, { type: 'sell', good: 'lea', n: 1 });
  assert.strictEqual(r1.state.status, 'playing');
  const s2 = E.clone(r1.state); s2.turn = 0;
  const r2 = E.applyMove(s2, 0, { type: 'sell', good: 'sil', n: 2 });
  assert.notStrictEqual(r2.state.status, 'playing');
  assert.strictEqual(r2.state.result.reason, 'tokens');
});

/* ---------- fine manche, punteggi, sigilli ---------- */
function finished(o) {
  const s = mk({ herds: o.herds || [0, 0] });
  s.won = o.won;
  s.starter = o.starter || 0;
  s.seals = o.seals || [0, 0];
  return E.endRound(s, 'deck');
}
test('gettone cammello e vincitore', () => {
  const s = finished({ herds: [4, 2], won: [{ goods: [{ g: 'lea', v: 4 }], bonus: [] }, { goods: [{ g: 'dia', v: 7 }, { g: 'dia', v: 7 }], bonus: [] }] });
  assert.strictEqual(s.result.camel, 0);
  assert.strictEqual(s.result.scores[0].total, 9); // 4 + gettone cammello 5
  assert.strictEqual(s.result.scores[1].total, 14);
  assert.strictEqual(s.result.winner, 1);
  assert.strictEqual(s.result.next, 0); // inizia chi ha perso
  assert.deepStrictEqual(s.seals, [0, 1]);
  assert.strictEqual(s.status, 'roundEnd');
});
test('parità di cammelli: nessuno prende il gettone', () => {
  const s = finished({ herds: [3, 3], won: [{ goods: [], bonus: [] }, { goods: [], bonus: [] }] });
  assert.strictEqual(s.result.camel, -1);
});
test('spareggi: bonus, poi gettoni merce, poi pari', () => {
  let s = finished({ won: [{ goods: [{ g: 'lea', v: 4 }], bonus: [{ k: 3, v: 1 }] }, { goods: [{ g: 'lea', v: 5 }], bonus: [] }] });
  assert.strictEqual(s.result.winner, 0); assert.strictEqual(s.result.decidedBy, 'nBonus');
  s = finished({ won: [{ goods: [{ g: 'lea', v: 3 }, { g: 'lea', v: 2 }], bonus: [] }, { goods: [{ g: 'lea', v: 5 }], bonus: [] }] });
  assert.strictEqual(s.result.winner, 0); assert.strictEqual(s.result.decidedBy, 'nGoods');
  s = finished({ starter: 1, won: [{ goods: [{ g: 'lea', v: 5 }], bonus: [] }, { goods: [{ g: 'lea', v: 5 }], bonus: [] }] });
  assert.strictEqual(s.result.winner, -1);
  assert.deepStrictEqual(s.seals, [0, 0]);
  assert.strictEqual(s.result.next, 0);
});
test('due sigilli: partita finita, rivincita', () => {
  const s = finished({ seals: [1, 0], won: [{ goods: [{ g: 'dia', v: 7 }], bonus: [] }, { goods: [], bonus: [] }] });
  assert.strictEqual(s.status, 'gameOver');
  assert.ok(!E.nextRound(s).ok);
  const r = E.rematch(s);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.state.seals, [0, 0]);
  assert.strictEqual(r.state.round, 1);
  assert.strictEqual(r.state.turn, 1); // inizia chi ha perso l'ultima manche
});

/* ---------- posti online ---------- */
test('creazione, ingresso e riconoscimento giocatori', () => {
  const g = E.newGame({ key: 'u:aaa', name: 'Marco' });
  assert.strictEqual(g.status, 'waiting');
  assert.strictEqual(E.seatOf(g, 'u:aaa'), 0);
  const j = E.join(g, 'd:bbb', 'Luca');
  assert.ok(j.ok);
  assert.strictEqual(j.state.status, 'playing');
  assert.strictEqual(E.seatOf(j.state, 'd:bbb'), 1);
  assert.ok(!E.join(j.state, 'd:ccc', 'Intruso').ok);
  const k = E.addSeatKey(j.state, 1, 'd:nuovo');
  assert.deepStrictEqual(k.state.seats[1].keys, ['d:bbb', 'd:nuovo']);
  assert.strictEqual(E.seatOf(k.state, 'd:nuovo'), 1);
  const k2 = E.addSeatKey(k.state, 0, 'd:nuovo'); // la stessa chiave passa all'altro posto
  assert.strictEqual(E.seatOf(k2.state, 'd:nuovo'), 0);
  assert.ok(!k2.state.seats[1].keys.includes('d:nuovo'));
  noUndefined(JSON.parse(JSON.stringify(j.state)), 'j');
});

/* ---------- simulazione ---------- */
function checkInvariants(s, ctx) {
  assert.deepStrictEqual(E.cardCensus(s), E.CARD_COUNTS, ctx + ' carte');
  for (const p of [0, 1]) {
    assert.ok(s.hands[p].length <= 7, ctx + ' limite mano');
    assert.ok(!s.hands[p].includes('cam'), ctx + ' cammelli in mano');
    assert.ok(s.herds[p] >= 0, ctx + ' mandria');
    assert.deepStrictEqual(s.hands[p], E.sortHand(s.hands[p]), ctx + ' mano ordinata');
  }
  for (const g of E.GOODS) {
    const won = s.won[0].goods.concat(s.won[1].goods).filter((t) => t.g === g).map((t) => t.v);
    assert.strictEqual(ms(won.concat(s.tokens[g])), ms(E.TOKEN_VALUES[g]), ctx + ' gettoni ' + g);
    // i gettoni si prendono dal più alto: la pila rimasta è un suffisso della pila iniziale
    const full = E.TOKEN_VALUES[g];
    assert.deepStrictEqual(s.tokens[g], full.slice(full.length - s.tokens[g].length), ctx + ' ordine gettoni');
  }
  for (const k of ['3', '4', '5']) {
    const won = s.won[0].bonus.concat(s.won[1].bonus).filter((t) => String(t.k) === k).map((t) => t.v);
    assert.strictEqual(ms(won.concat(s.bonus[k])), ms(E.BONUS_VALUES[k]), ctx + ' bonus ' + k);
  }
  if (s.status === 'playing') {
    assert.strictEqual(s.market.length, 5);
    assert.ok(s.market.every((c) => c), ctx + ' mercato pieno');
    assert.ok(E.emptyPiles(s) < 3, ctx + ' pile');
  }
}

const stats = { games: 0, rounds: 0, deck: 0, tokens: 0, moves: 0, draws: 0, maxRoundMoves: 0, byType: {} };
const N = +(process.env.PARTITE || 500);
for (let gi = 0; gi < N; gi++) {
  let s = E.startLocal('A', 'B');
  let guard = 0, roundMoves = 0;
  checkInvariants(s, 'inizio');
  while (s.status !== 'gameOver') {
    if (s.status === 'roundEnd') {
      const prevLoser = s.result.next;
      const r = E.nextRound(s);
      assert.ok(r.ok);
      s = r.state;
      assert.strictEqual(s.turn, prevLoser);
      roundMoves = 0;
      continue;
    }
    const moves = E.legalMoves(s, s.turn, 10);
    assert.ok(moves.length > 0, 'nessuna mossa legale');
    // un po' di strategia: preferisci vendere in blocco, altrimenti casuale
    const mv = moves[E.randInt(moves.length)];
    const before = s;
    const r = E.applyMove(s, s.turn, mv);
    assert.ok(r.ok, r.error + ' ' + JSON.stringify(mv));
    s = r.state;
    assert.strictEqual(s.v, before.v + 1);
    stats.moves++; roundMoves++;
    stats.byType[mv.type] = (stats.byType[mv.type] || 0) + 1;
    checkInvariants(s, `partita ${gi} mossa ${roundMoves}`);
    if (s.status !== 'playing') {
      stats.rounds++;
      stats[s.result.reason]++;
      if (s.result.winner < 0) stats.draws++;
      stats.maxRoundMoves = Math.max(stats.maxRoundMoves, roundMoves);
      const sc = s.result.scores;
      for (const p of [0, 1]) {
        assert.strictEqual(sc[p].total, sc[p].goods + sc[p].bonus + sc[p].camel);
      }
      if (s.result.camel >= 0) assert.ok(s.herds[s.result.camel] > s.herds[1 - s.result.camel]);
      if (s.result.reason === 'tokens') assert.ok(E.emptyPiles(s) >= 3);
      if (s.result.reason === 'deck') assert.strictEqual(s.deck.length, 0);
    }
    if (++guard > 5000) throw new Error('partita infinita');
  }
  assert.ok(s.seals[0] === 2 || s.seals[1] === 2);
  assert.ok(s.seals[0] + s.seals[1] <= 3 + stats.draws);
  noUndefined(JSON.parse(JSON.stringify(s)), 'fine');
  assert.ok(JSON.stringify(s).length < 60000, 'documento troppo grande');
  stats.games++;
}

console.log(`OK: ${passed} scenari + ${stats.games} partite simulate`);
console.log(`manche: ${stats.rounds} (fine per mazzo ${stats.deck}, per gettoni ${stats.tokens}, pari ${stats.draws}), mosse: ${stats.moves}, max mosse/manche: ${stats.maxRoundMoves}`);
console.log('mosse per tipo:', stats.byType);
