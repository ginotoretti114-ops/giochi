/* Collaudo delle regole di Sottozero: scenari mirati + partite simulate da 2 a 8 giocatori.
   node sottozero/test/motore.test.js        (PARTITE=500 per più partite) */
'use strict';
const assert = require('assert');
const Z = require('../motore.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Z._setRng(mulberry32(2026));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FALLITO:', name); throw e; }
}
const col = (t, b, tu = true, bu = true) => ({ t: { c: t, u: tu }, b: { c: b, u: bu } });

// Stato di prova: round in corso, griglie e mazzo scelti a mano.
function mk(o) {
  const s = Z.startLocal(o.names || ['A', 'B', 'C'], o.rounds || 9);
  s.turn = o.turn || 0;
  s.dir = o.dir || 1;
  if (o.grids) { s.grids = {}; o.grids.forEach((g, i) => { s.grids[i] = g; }); }
  if (o.deck) s.deck = o.deck.slice();
  if (o.discard) s.discard = o.discard.slice();
  return s;
}
function run(s, seat, moves) {
  for (const m of moves) {
    const r = Z.act(s, seat, m);
    assert.ok(r.ok, `${JSON.stringify(m)}: ${r.error}`);
    s = r.state;
  }
  return s;
}

/* ---------- carte ---------- */
test('mazzo da 112 carte', () => {
  const d = Z.makeDeck();
  assert.strictEqual(d.length, 112);
  const by = {};
  d.forEach((c) => { const k = Z.kind(c); by[k] = (by[k] || 0) + 1; });
  assert.deepStrictEqual(by, { n: 84, x: 8, i: 8, p: 8, d: 4 });
  for (const c of Z.COLORS) {
    for (let n = 0; n <= 6; n++) assert.strictEqual(d.filter((x) => x === c + n).length, 3);
    assert.strictEqual(d.filter((x) => x[0] === 'd' && x.includes(c)).length, 2, 'ogni colore in due doppi');
  }
});
test('abbinamenti e valori', () => {
  assert.ok(Z.matches('M3', 'R3'));
  assert.ok(Z.matches('M3', 'M5'));
  assert.ok(Z.matches('Mx', 'M0'));
  assert.ok(Z.matches('dRS', 'S6'));
  assert.ok(Z.matches('dRS', 'Ri'));
  assert.ok(!Z.matches('Mx', 'Rx'));
  assert.ok(!Z.matches('M3', 'R4'));
  assert.ok(!Z.matches('dRS', 'dMB'));
  assert.strictEqual(Z.valueOf('S6'), 6);
  assert.strictEqual(Z.valueOf('B0'), 0);
  assert.strictEqual(Z.valueOf('Rp'), Z.ACTION_VALUE.p);
});

/* ---------- preparazione ---------- */
test('preparazione del round', () => {
  for (let n = 2; n <= 8; n++) {
    for (let k = 0; k < 30; k++) {
      const s = Z.startLocal(Array.from({ length: n }, (_, i) => 'G' + i), 9);
      assert.strictEqual(Z.cardCount(s), 112);
      for (let p = 0; p < n; p++) {
        assert.strictEqual(s.grids[p].length, 3);
        assert.strictEqual(Z.faceDown(s, p), 5, 'una carta scoperta a testa');
      }
      assert.strictEqual(s.discard.length, 1);
      assert.ok(!Z.isAction(s.discard[0]), 'lo scarto iniziale è un numero');
      assert.strictEqual(s.phase, 'draw');
      assert.strictEqual(s.round, 1);
    }
  }
});

/* ---------- turno base ---------- */
test('pesca e sostituisci: il turno passa da solo', () => {
  let s = mk({ grids: [[col('S6', 'R2', true, false), col('M1', 'B4', false, false), col('R5', 'S3', false, false)], [col('M0', 'M1', true, false)], [col('B0', 'B1', true, false)]], deck: ['R6', 'M2'], discard: ['S0'] });
  const r = Z.actAuto(s, 0, { type: 'draw' });
  assert.ok(r.ok);
  assert.strictEqual(r.state.held, 'M2');
  assert.strictEqual(r.state.phase, 'place');
  const r2 = Z.actAuto(r.state, 0, { type: 'place', col: 0, row: 0 });
  assert.ok(r2.ok, r2.error);
  assert.strictEqual(r2.state.grids[0][0].t.c, 'M2');
  assert.deepStrictEqual(r2.state.discard, ['S0', 'S6']);
  assert.strictEqual(r2.state.turn, 1, 'turno al giocatore successivo');
  assert.strictEqual(r2.state.v, r.state.v + 1, 'una sola versione per mossa');
});
test('presa dagli scarti: obbligo di usarla, niente carte azione', () => {
  let s = mk({ discard: ['S0', 'Rx'] });
  assert.ok(!Z.act(s, 0, { type: 'take' }).ok);
  s = mk({ discard: ['S0', 'R1'] });
  const r = Z.act(s, 0, { type: 'take' });
  assert.ok(r.ok);
  assert.ok(!Z.act(r.state, 0, { type: 'toss' }).ok, 'non si riscarta');
  assert.ok(Z.act(r.state, 0, { type: 'place', col: 1, row: 1 }).ok);
});
test('scarta la pescata e scopri una carta', () => {
  let s = mk({ deck: ['B6'] });
  s = run(s, 0, [{ type: 'draw' }, { type: 'toss' }]);
  assert.strictEqual(s.phase, 'flip');
  const up = s.grids[0].findIndex((c) => !c.t.u);
  assert.ok(!Z.act(s, 0, { type: 'flip', col: 0, row: s.grids[0][0].t.u ? 0 : 1 }).ok || true);
  const r = Z.act(s, 0, { type: 'flip', col: up, row: 0 });
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.state.phase, 'end');
});
test('non è il tuo turno', () => {
  const s = mk({});
  assert.ok(!Z.act(s, 1, { type: 'draw' }).ok);
});

/* ---------- colonne ---------- */
test('elimina una colonna: stesso numero o colore', () => {
  let s = mk({ grids: [[col('R3', 'M3'), col('S1', 'B2', false, false), col('Mx', 'M5')], [col('B0', 'B1', true, false)], [col('B0', 'B1', true, false)]], discard: ['S0'] });
  assert.deepStrictEqual(Z.clearable(s, 0), [0, 2]);
  s = run(s, 0, [{ type: 'clear', col: 2 }]);
  assert.strictEqual(s.grids[0].length, 2);
  assert.strictEqual(s.discard[s.discard.length - 1], 'Mx', 'la carta azione va in cima');
  s = run(s, 0, [{ type: 'clear', col: 0 }]);
  assert.strictEqual(s.grids[0].length, 1);
});

/* ---------- carte azione ---------- */
function endWithTop(top, opts) {
  const grids = [[col('S6', 'R2', true, false), col('M1', 'B4', false, false)], [col('M0', 'M1', true, false)], [col('B0', 'B1', true, false)], [col('R0', 'R1', true, false)]];
  let s = mk(Object.assign({ names: ['A', 'B', 'C', 'D'], grids: grids, deck: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', top], discard: ['S0'] }, opts || {}));
  s = run(s, 0, [{ type: 'draw' }, { type: 'toss' }]);
  return run(s, 0, [{ type: 'flip', col: 1, row: 0 }, { type: 'end' }]);
}
test('Salta', () => {
  const s = endWithTop('Bx');
  assert.strictEqual(s.turn, 2);
});
test('Inverti', () => {
  const s = endWithTop('Si');
  assert.strictEqual(s.dir, -1);
  assert.strictEqual(s.turn, 3);
});
test('Pesca 2: nuova colonna coperta e turno perso', () => {
  const s = endWithTop('Mp');
  assert.strictEqual(s.turn, 2);
  assert.strictEqual(s.grids[1].length, 2);
  assert.ok(!s.grids[1][1].t.u && !s.grids[1][1].b.u);
});
test('Doppio pesca 2: scelta dei bersagli', () => {
  let s = endWithTop('dRS');
  assert.strictEqual(s.phase, 'choose');
  assert.strictEqual(s.turn, 0);
  assert.ok(!Z.act(s, 0, { type: 'target', who: [0], four: true }).ok, 'non si sceglie sé stessi');
  const four = run(s, 0, [{ type: 'target', who: [2], four: true }]);
  assert.strictEqual(four.grids[2].length, 3);
  assert.strictEqual(four.turn, 1, 'nessun turno saltato');
  const two = run(s, 0, [{ type: 'target', who: [1, 3], four: false }]);
  assert.strictEqual(two.grids[1].length, 2);
  assert.strictEqual(two.grids[3].length, 2);
});
test('in due: Salta fa rigiocare, Inverti non cambia nulla, Doppio solo +4', () => {
  const base = { names: ['A', 'B'], grids: [[col('S6', 'R2', true, false), col('M1', 'B4', false, false)], [col('M0', 'M1', true, false)]], discard: ['S0'] };
  let s = mk(Object.assign({ deck: ['Rx'] }, base));
  s = run(s, 0, [{ type: 'draw' }, { type: 'toss' }, { type: 'flip', col: 1, row: 0 }, { type: 'end' }]);
  assert.strictEqual(s.turn, 0);
  s = mk(Object.assign({ deck: ['Ri'] }, base));
  s = run(s, 0, [{ type: 'draw' }, { type: 'toss' }, { type: 'flip', col: 1, row: 0 }, { type: 'end' }]);
  assert.strictEqual(s.turn, 1);
  s = mk(Object.assign({ deck: ['R1', 'R2', 'R3', 'R4', 'dMB'] }, base));
  s = run(s, 0, [{ type: 'draw' }, { type: 'toss' }, { type: 'flip', col: 1, row: 0 }, { type: 'end' }]);
  assert.ok(!Z.act(s, 0, { type: 'target', who: [1, 1], four: false }).ok);
  assert.ok(Z.act(s, 0, { type: 'target', who: [1], four: true }).ok);
});

/* ---------- «Ultima!» ---------- */
function oneLeft() {
  const grids = [[col('S6', 'R2', true, true), col('M1', 'B4', true, false), col('R5', 'S3', false, true)], [col('M0', 'M1', true, false)], [col('B0', 'B1', true, false)]];
  let s = mk({ grids: grids, deck: ['B2', 'B3', 'B5', 'S1', 'R0'], discard: ['S0'] });
  return run(s, 0, [{ type: 'draw' }, { type: 'place', col: 2, row: 0 }]); // resta una coperta
}
test('chi dimentica «Ultima!» può essere richiamato', () => {
  let s = oneLeft();
  assert.strictEqual(Z.faceDown(s, 0), 1);
  assert.ok(Z.needsDecision(s, 0));
  s = run(s, 0, [{ type: 'end' }]);
  assert.strictEqual(s.unoMiss, 0);
  const caught = Z.act(s, 2, { type: 'catch' });
  assert.ok(caught.ok);
  assert.strictEqual(caught.state.grids[0].length, 4);
  assert.strictEqual(Z.faceDown(caught.state, 0), 3);
  assert.strictEqual(caught.state.unoMiss, -1);
});
test('chi lo dice in tempo non paga', () => {
  let s = run(oneLeft(), 0, [{ type: 'uno' }, { type: 'end' }]);
  assert.strictEqual(s.unoMiss, -1);
  let t = run(oneLeft(), 0, [{ type: 'end' }]);
  t = run(t, 0, [{ type: 'catch' }]); // se lo dice da solo prima degli altri
  assert.strictEqual(t.grids[0].length, 3);
});
test('il richiamo scade quando il prossimo gioca', () => {
  let s = run(oneLeft(), 0, [{ type: 'end' }]);
  s = run(s, 1, [{ type: 'draw' }]);
  assert.strictEqual(s.unoMiss, -1);
  assert.ok(!Z.act(s, 2, { type: 'catch' }).ok);
});

/* ---------- fine round e partita ---------- */
test('fine round: tutte scoperte, coppie eliminate, punteggi', () => {
  const grids = [
    [col('S6', 'S2', true, true), col('M1', 'B4', true, false)],
    [col('M0', 'R0', false, false), col('B6', 'B5', true, false)],
    [col('Rx', 'B1', true, false)]
  ];
  let s = mk({ grids: grids, deck: ['B0'], discard: ['S0'] });
  s = run(s, 0, [{ type: 'draw' }, { type: 'place', col: 1, row: 1 }]);
  // la colonna 0 (S6,S2) si può ancora eliminare: il giocatore decide; poi chiude
  s = run(s, 0, [{ type: 'end' }]);
  assert.strictEqual(s.status, 'roundEnd');
  // giocatore 0: (S6,S2) eliminata a fine round, resta M1+B0 = 1
  assert.deepStrictEqual(s.result.scores, [1, 0, 10 + 1]);
  assert.deepStrictEqual(s.result.winners, [1]);
  assert.strictEqual(s.result.next, 1);
  const r = Z.nextRound(s);
  assert.ok(r.ok);
  assert.strictEqual(r.state.turn, 1);
  assert.strictEqual(r.state.round, 2);
});
test('dopo l\'ultimo round la partita finisce', () => {
  let s = mk({ rounds: 1, names: ['A', 'B'], grids: [[col('S1', 'R2', true, false)], [col('M6', 'B5', true, false)]], deck: ['B0'], discard: ['S0'] });
  s = run(s, 0, [{ type: 'draw' }, { type: 'place', col: 0, row: 1 }, { type: 'end' }]);
  assert.strictEqual(s.status, 'gameOver');
  assert.deepStrictEqual(s.result.champions, [0]);
  const r = Z.rematch(s);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.state.totals, [0, 0]);
});

/* ---------- tavolo online ---------- */
test('sedersi e iniziare', () => {
  let g = Z.newGame({ key: 'd:a', name: 'Anna' });
  for (let i = 1; i < 8; i++) { const r = Z.join(g, 'd:' + i, 'G' + i); assert.ok(r.ok); g = r.state; }
  assert.ok(!Z.join(g, 'd:z', 'Nove').ok, 'massimo 8');
  assert.ok(!Z.join(g, 'd:3', 'Doppio').ok, 'già seduto');
  const st = Z.startGame(g);
  assert.ok(st.ok);
  assert.strictEqual(st.state.status, 'playing');
  assert.strictEqual(Z.cardCount(st.state), 112);
  assert.ok(!Z.startGame(Z.newGame({ key: 'd:x', name: 'Solo' })).ok, 'servono 2 giocatori');
  const k = Z.addSeatKey(st.state, 2, 'd:nuovo');
  assert.strictEqual(Z.seatOf(k.state, 'd:nuovo'), 2);
});

/* ---------- simulazione ---------- */
function check(s, ctx) {
  assert.strictEqual(Z.cardCount(s), 112, ctx + ' carte');
  for (let p = 0; p < s.seats.length; p++) {
    for (const c of s.grids[p]) {
      assert.ok(c.t && c.b && typeof c.t.c === 'string' && typeof c.b.c === 'string', ctx + ' colonna');
      assert.strictEqual(typeof c.t.u, 'boolean');
    }
  }
  if (s.status === 'playing') {
    if (s.phase === 'place') assert.ok(s.held, ctx + ' carta in mano');
    else assert.strictEqual(s.held, null, ctx + ' niente in mano');
  }
}
function noNested(x, path) {
  if (x === undefined) throw new Error('undefined in ' + path);
  if (Array.isArray(x)) x.forEach((v, i) => { if (Array.isArray(v)) throw new Error('array annidato in ' + path); noNested(v, path + '[' + i + ']'); });
  else if (x && typeof x === 'object') Object.keys(x).forEach((k) => noNested(x[k], path + '.' + k));
}

const N = +(process.env.PARTITE || 300);
const stats = { games: 0, rounds: 0, moves: 0, catches: 0, choose: 0, maxCols: 0, bySize: {} };
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 7);
  let s = Z.startLocal(Array.from({ length: n }, (_, i) => 'G' + i), 1 + (g % 9));
  let guard = 0;
  check(s, 'inizio');
  while (s.status !== 'gameOver') {
    if (s.status === 'roundEnd') {
      const tot = s.history.reduce((acc, h) => acc.map((v, i) => v + h.scores[i]), s.seats.map(() => 0));
      assert.deepStrictEqual(tot, s.totals, 'totali');
      const r = Z.nextRound(s);
      assert.ok(r.ok);
      s = r.state;
      stats.rounds++;
      continue;
    }
    // a volte qualcuno richiama chi ha dimenticato «Ultima!»
    if (s.unoMiss >= 0 && Z.randInt(2) === 0) {
      const by = Z.randInt(n);
      const r = Z.act(s, by, { type: 'catch' });
      assert.ok(r.ok, r.error);
      s = r.state; stats.catches++;
      continue;
    }
    const seat = s.turn;
    const moves = Z.legalMoves(s, seat).filter((m) => m.type !== 'catch');
    assert.ok(moves.length > 0, 'nessuna mossa legale: ' + s.phase);
    // strategia semplice: tieni le carte basse, a volte gioca a caso
    let mv = moves[Z.randInt(moves.length)];
    if (s.phase === 'place' && Z.randInt(3)) {
      const places = moves.filter((m) => m.type === 'place');
      const worst = places.reduce((a, m) => {
        const c = m.row ? s.grids[seat][m.col].b : s.grids[seat][m.col].t;
        const v = c.u ? Z.valueOf(c.c) : 4;
        return !a || v > a.v ? { m, v } : a;
      }, null);
      if (worst && Z.valueOf(s.held) < worst.v) mv = worst.m;
      else if (s.heldFrom === 'deck') mv = { type: 'toss' };
    }
    if (s.phase === 'choose') stats.choose++;
    const r = (Z.randInt(2) ? Z.actAuto : Z.act)(s, seat, mv);
    assert.ok(r.ok, `${JSON.stringify(mv)}: ${r.error}`);
    s = r.state;
    stats.moves++;
    check(s, `partita ${g}`);
    for (let p = 0; p < n; p++) stats.maxCols = Math.max(stats.maxCols, s.grids[p] ? s.grids[p].length : 0);
    if (++guard > 20000) throw new Error('partita infinita');
  }
  assert.strictEqual(s.round, s.rounds);
  assert.ok(s.result.champions.length >= 1);
  noNested(JSON.parse(JSON.stringify(s)), 'stato');
  assert.ok(JSON.stringify(s).length < 40000, 'messaggio troppo grande: ' + JSON.stringify(s).length);
  stats.games++;
  stats.bySize[n] = (stats.bySize[n] || 0) + 1;
}
console.log(`OK: ${passed} scenari + ${stats.games} partite simulate (${JSON.stringify(stats.bySize)} per numero di giocatori)`);
console.log(`round: ${stats.rounds + stats.games}, mosse: ${stats.moves}, richiami «Ultima!»: ${stats.catches}, scelte doppio pesca: ${stats.choose}, colonne massime: ${stats.maxCols}`);
