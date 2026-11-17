/* Collaudo delle regole di Piccante: scenari mirati + partite simulate da 2 a 8 giocatori con tutte le missioni.
   node piccante/test/motore.test.js        (PARTITE=500 per più partite) */
'use strict';
const assert = require('assert');
const K = require('../motore.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
K._setRng(mulberry32(777));
let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error('FALLITO:', name); throw e; } }
function run(s, moves) {
  for (const [seat, m] of moves) {
    const r = K.act(s, seat, m);
    assert.ok(r.ok, `${seat} ${JSON.stringify(m)}: ${r.error}`);
    s = r.state;
  }
  return s;
}
// Round costruito a mano: mani, mazziere e missione scelti.
function mk(o) {
  const s = K.startLocal(o.names || ['A', 'B', 'C'], 'nessuna');
  s.mission = o.mission || null;
  s.dealer = o.dealer || 0;
  s.turn = s.dealer;
  s.hands = {};
  o.hands.forEach((h, i) => { s.hands[i] = K.sortHand(h); });
  s.N = o.hands[0].length;
  s.deck = o.deck || [];
  return s;
}

/* ---------- mazzo e missioni ---------- */
test('40 missioni, 26 base e 14 esperte', () => {
  assert.strictEqual(K.MISSIONS.length, 40);
  assert.strictEqual(K.missionIds('base').length, 26);
  assert.strictEqual(K.missionIds('tutte').length, 40);
  assert.strictEqual(new Set(K.MISSIONS.map((m) => m.id)).size, 40);
});
test('distribuzione', () => {
  for (let n = 2; n <= 8; n++) {
    for (let k = 0; k < 20; k++) {
      const st = K.startGame(Array.from({ length: n - 1 }).reduce((g, _, i) => K.join(g, 'k' + i, 'G' + i).state, K.newGame({ key: 'k', name: 'A' })));
      assert.ok(st.ok);
      const s = st.state;
      assert.strictEqual(K.cardCount(s), 56);
      const sizes = Object.values(s.hands).map((h) => h.length);
      assert.ok(sizes.every((x) => x === s.N));
      assert.ok(s.N * n + (K.mtype(s) === 'draw' ? n : 0) <= 56);
      assert.strictEqual(s.turn, s.dealer, 'scommette per primo il mazziere');
    }
  }
});

/* ---------- scommesse ---------- */
test('l\'ultimo non può pareggiare il totale', () => {
  let s = mk({ hands: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] });
  s = run(s, [[0, { type: 'bid', n: 1 }], [1, { type: 'bid', n: 1 }]]);
  assert.deepStrictEqual(K.bidOptions(s, 2), [0, 2, 3]);
  assert.ok(!K.act(s, 2, { type: 'bid', n: 1 }).ok);
});
test('scommessa vietata e niente copie', () => {
  let s = mk({ mission: 'nb3', hands: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] });
  assert.ok(!K.act(s, 0, { type: 'bid', n: 1 }).ok);
  s = mk({ mission: 'nc1', hands: [[1, 2, 3, 10], [4, 5, 6, 11], [7, 8, 9, 12]] });
  s = run(s, [[0, { type: 'bid', n: 2 }]]);
  assert.ok(!K.act(s, 1, { type: 'bid', n: 2 }).ok);
  assert.ok(K.act(s, 1, { type: 'bid', n: 1 }).ok);
});

/* ---------- prese ---------- */
test('vince la carta più alta, comincia il mazziere', () => {
  let s = mk({ dealer: 1, hands: [[10, 20], [30, 5], [40, 1]] });
  s = run(s, [[1, { type: 'bid', n: 1 }], [2, { type: 'bid', n: 1 }], [0, { type: 'bid', n: 1 }]]);
  assert.strictEqual(s.phase, 'play');
  assert.strictEqual(s.turn, 1);
  assert.ok(!K.act(s, 0, { type: 'play', card: 10 }).ok);
  s = run(s, [[1, { type: 'play', card: 30 }], [2, { type: 'play', card: 40 }], [0, { type: 'play', card: 10 }]]);
  assert.strictEqual(s.won[2], 1);
  assert.strictEqual(s.turn, 2, 'chi vince apre la presa dopo');
  s = run(s, [[2, { type: 'play', card: 1 }], [0, { type: 'play', card: 20 }], [1, { type: 'play', card: 5 }]]);
  assert.strictEqual(s.status, 'roundEnd');
  assert.deepStrictEqual(s.result.won, [1, 0, 1]);
  assert.deepStrictEqual(s.result.change, [0, 1, 0]);
});
test('jolly: valore da 0 a 56, mai uguale a una carta già sul tavolo', () => {
  let s = mk({ hands: [[30], [K.JOKER], [31]] });
  s = run(s, [[0, { type: 'bid', n: 0 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 0 }]]);
  s = run(s, [[0, { type: 'play', card: 30 }]]);
  assert.ok(!K.act(s, 1, { type: 'play', card: K.JOKER, jv: 30 }).ok);
  assert.ok(!K.act(s, 1, { type: 'play', card: K.JOKER, jv: 57 }).ok);
  s = run(s, [[1, { type: 'play', card: K.JOKER, jv: 31 }], [2, { type: 'play', card: 31 }]]);
  assert.strictEqual(s.result.won[1], 1, 'a pari valore vince chi ha giocato prima');
});
test('valori rovesciati', () => {
  let s = mk({ mission: 'in1', hands: [[50], [2], [30]] });
  s = run(s, [[0, { type: 'bid', n: 0 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 0 }]]);
  s = run(s, [[0, { type: 'play', card: 50 }], [1, { type: 'play', card: 2 }], [2, { type: 'play', card: 30 }]]);
  assert.deepStrictEqual(s.result.won, [0, 1, 0]);
});
test('solo carte estreme', () => {
  let s = mk({ mission: 'ex1', hands: [[1, 20, 40], [2, 21, 35], [3, 22, K.JOKER]] });
  s = run(s, [[0, { type: 'bid', n: 0 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 0 }]]);
  assert.ok(!K.act(s, 0, { type: 'play', card: 20 }).ok);
  s = run(s, [[0, { type: 'play', card: 40 }]]);
  assert.ok(!K.act(s, 1, { type: 'play', card: 21 }).ok);
  s = run(s, [[1, { type: 'play', card: 35 }]]);
  assert.ok(K.act(s, 2, { type: 'play', card: K.JOKER, jv: 0 }).ok, 'il jolly vale come estremo');
  assert.ok(!K.act(s, 2, { type: 'play', card: K.JOKER, jv: 10 }).ok, 'il jolly deve restare estremo');
  assert.ok(K.act(s, 2, { type: 'play', card: K.JOKER, jv: 22 }).ok);
});

/* ---------- missioni dopo le scommesse ---------- */
function bidAll(s) {
  for (let i = 0; i < s.seats.length; i++) { const p = s.turn; s = run(s, [[p, { type: 'bid', n: K.bidOptions(s, p)[0] }]]); }
  return s;
}
test('passa carte al vicino', () => {
  let s = mk({ mission: 'pa5', hands: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }); // 2 carte a sinistra
  s = bidAll(s);
  assert.strictEqual(s.phase, 'pass');
  s = run(s, [[1, { type: 'pass', cards: [4, 5] }], [0, { type: 'pass', cards: [1, 2] }]]);
  assert.strictEqual(s.phase, 'pass');
  s = run(s, [[2, { type: 'pass', cards: [8, 9] }]]);
  assert.strictEqual(s.phase, 'play');
  assert.deepStrictEqual(s.hands[1], [1, 2, 6]);
  assert.deepStrictEqual(s.hands[2], [4, 5, 7]);
  assert.deepStrictEqual(s.hands[0], [3, 8, 9]);
});
test('con la carta in più si scommette fino a una presa in più', () => {
  let s = mk({ mission: 'dr1', hands: [[1, 2], [3, 4], [5, 6]], deck: [10, 11, 12] });
  assert.deepStrictEqual(K.bidOptions(s, 0), [0, 1, 2, 3]);
  s = run(s, [[0, { type: 'bid', n: 1 }], [1, { type: 'bid', n: 1 }]]);
  assert.deepStrictEqual(K.bidOptions(s, 2), [0, 2, 3], 'il totale non può fare 3');
});
test('tutta la mano al vicino, carta in più, carte scoperte', () => {
  let s = bidAll(mk({ mission: 'ma1', hands: [[1, 2], [3, 4], [5, 6]] }));
  assert.deepStrictEqual(s.hands[1], [1, 2]);
  s = bidAll(mk({ mission: 'dr1', hands: [[1, 2], [3, 4], [5, 6]], deck: [10, 11, 12] }));
  assert.ok(Object.values(s.hands).every((h) => h.length === 3));
  s = bidAll(mk({ mission: 'rv1', hands: [[1, 2], [3, 4], [5, 6]] }));
  assert.strictEqual(s.revealed, true);
});
test('gioco simultaneo', () => {
  let s = bidAll(mk({ mission: 'si1', hands: [[10, 1], [20, 2], [30, 3]] }));
  s = run(s, [[2, { type: 'play', card: 3 }], [0, { type: 'play', card: 10 }]]);
  assert.ok(!K.act(s, 0, { type: 'play', card: 1 }).ok, 'una carta per presa');
  assert.strictEqual(K.cardCount(s), 6, 'le carte scelte restano contate');
  s = run(s, [[1, { type: 'play', card: 2 }]]);
  assert.strictEqual(s.lastTrick.winner, 0);
  assert.strictEqual(s.trick.leader, 0);
});
test('scambio dopo ogni presa', () => {
  let s = bidAll(mk({ mission: 'sw1', hands: [[50, 1], [2, 3], [4, 5]] }));
  s = run(s, [[0, { type: 'play', card: 50 }], [1, { type: 'play', card: 2 }], [2, { type: 'play', card: 4 }]]);
  assert.strictEqual(s.phase, 'swapPick');
  s = run(s, [[0, { type: 'swapPick', target: 2, card: 1 }]]);
  assert.strictEqual(s.phase, 'swapGive');
  s = run(s, [[2, { type: 'swapGive', card: 5 }]]);
  assert.deepStrictEqual(s.hands[0], [5]);
  assert.deepStrictEqual(s.hands[2], [1]);
  assert.strictEqual(s.phase, 'play');
  assert.strictEqual(s.turn, 0);
});

/* ---------- punteggi delle missioni ---------- */
function playOut(s) {
  let guard = 0;
  while (s.status === 'playing') {
    const p = K.nextActor(s);
    const mv = K.legalMoves(s, p)[0];
    s = run(s, [[p, mv]]);
    if (++guard > 500) throw new Error('loop');
  }
  return s;
}
test('prima e ultima presa', () => {
  let s = mk({ mission: 'fl1', hands: [[50, 49], [1, 2], [3, 4]] });
  s = run(s, [[0, { type: 'bid', n: 2 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 1 }]]);
  s = playOut(s);
  assert.deepStrictEqual(s.result.change, [2, 0, 1]);
});
test('numeri piccanti', () => {
  let s = mk({ mission: 'ho1', hands: [[50, 1], [11, 2], [3, 4]] });
  s = run(s, [[0, { type: 'bid', n: 2 }], [1, { type: 'bid', n: 1 }], [2, { type: 'bid', n: 0 }]]);
  s = run(s, [[0, { type: 'play', card: 50 }], [1, { type: 'play', card: 11 }], [2, { type: 'play', card: 3 }]]);
  s = playOut(s);
  assert.strictEqual(s.result.change[0], 1 + 1, 'una presa sbagliata + numero piccante');
});
test('premio a chi indovina e peperoncini condivisi', () => {
  let s = mk({ mission: 'pr1', hands: [[50, 49, 48], [1, 2, 3], [4, 5, 6]] });
  s.pilis = [5, 0, 1];
  s = run(s, [[0, { type: 'bid', n: 3 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 1 }]]);
  s = playOut(s);
  assert.deepStrictEqual(s.pilis, [2, 0, 2]);
  s = mk({ mission: 'sh1', hands: [[50], [1], [3]] });
  s = run(s, [[0, { type: 'bid', n: 0 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 0 }]]);
  assert.strictEqual(s.phase, 'designate');
  s = run(s, [[0, { type: 'designate', target: 1 }], [1, { type: 'designate', target: 0 }], [2, { type: 'designate', target: 0 }]]);
  s = playOut(s);
  assert.deepStrictEqual(s.result.change, [1, 1, 1]);
});
test('fine a 7 peperoncini, vince chi ne ha meno', () => {
  let s = mk({ hands: [[50, 49], [1, 2], [3, 4]] });
  s.pilis = [6, 3, 6];
  s = run(s, [[0, { type: 'bid', n: 0 }], [1, { type: 'bid', n: 0 }], [2, { type: 'bid', n: 0 }]]);
  s = playOut(s);
  assert.strictEqual(s.status, 'gameOver');
  assert.deepStrictEqual(s.result.winners, [1]);
  const r = K.rematch(s);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.state.pilis, [0, 0, 0]);
});

/* ---------- simulazione ---------- */
function noNested(x, path) {
  if (x === undefined) throw new Error('undefined in ' + path);
  if (Array.isArray(x)) x.forEach((v, i) => { if (Array.isArray(v)) throw new Error('array annidato in ' + path); noNested(v, path + '[' + i + ']'); });
  else if (x && typeof x === 'object') Object.keys(x).forEach((k) => noNested(x[k], path + '.' + k));
}
const N = +(process.env.PARTITE || 300);
const seen = {};
let rounds = 0, moves = 0;
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 7);
  const mode = ['tutte', 'base', 'nessuna'][g % 3];
  let s = K.startLocal(Array.from({ length: n }, (_, i) => 'G' + i), mode);
  let played = 0, guard = 0;
  while (s.status !== 'gameOver') {
    if (s.status === 'roundEnd') {
      const r = K.nextRound(s); assert.ok(r.ok); s = r.state; played = 0; rounds++;
      continue;
    }
    seen[K.mtype(s) || 'nessuna'] = (seen[K.mtype(s) || 'nessuna'] || 0) + 1;
    const actor = K.nextActor(s);
    assert.ok(actor >= 0, 'nessuno deve agire');
    const ms = K.legalMoves(s, actor);
    assert.ok(ms.length > 0, 'nessuna mossa per ' + actor + ' in ' + s.phase);
    const mv = ms[K.randInt(ms.length)];
    const before = s.trickNo;
    const r = K.act(s, actor, mv);
    assert.ok(r.ok, JSON.stringify(mv) + ': ' + r.error);
    s = r.state; moves++;
    if (s.status === 'playing') {
      played += (s.trickNo - before) * n;
      assert.strictEqual(K.cardCount(s) + played, 56, 'carte');
      const sizes = Object.values(s.hands).map((h) => h.length);
      if (s.phase !== 'play' || K.mtype(s) !== 'simul') assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, 'mani pari');
    }
    if (++guard > 50000) throw new Error('partita infinita');
  }
  assert.ok(s.pilis.some((x) => x >= 7));
  assert.ok(s.result.winners.length >= 1);
  noNested(JSON.parse(JSON.stringify(s)), 'stato');
  assert.ok(JSON.stringify(s).length < 40000);
}
console.log(`OK: ${passed} scenari + ${N} partite simulate (${rounds + N} round, ${moves} mosse)`);
console.log('missioni incontrate (mosse):', Object.keys(seen).sort().join(', '));
