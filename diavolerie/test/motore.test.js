/* Collaudo delle regole di Diavolerie: scenari mirati + partite simulate da 2 a 5 giocatori.
   node diavolerie/test/motore.test.js        (PARTITE=500 per più partite) */
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
K._setRng(mulberry32(4242));
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
const ans = (pick) => ({ type: 'answer', pick });
// Partita a tavolino: tutto quello che non si dice è vuoto; il mazzo è fatto di Gianna (bambine senza effetti utili).
function mk(o) {
  const n = o.n || 3;
  const s = K.startLocal(Array.from({ length: n }, (_, i) => 'G' + i));
  s.turn = o.turn || 0;
  s.candle = o.candle || Array.from({ length: n }, () => 'principiante'); // 6 e 8: i test evitano questi numeri
  for (let p = 0; p < n; p++) {
    s.cards[p] = (o.cards && o.cards[p]) || [];
    s.demons[p] = (o.demons && o.demons[p]) || [];
    s.hand[p] = (o.hand && o.hand[p]) || [];
  }
  s.souls = o.souls || Array.from({ length: n }, () => 5);
  s.block = o.block || ['paolo.1', 'paolo.2', 'paolo.3', 'paolo.4', 'gianna.1'];
  s.deck = o.deck || ['gianna.2', 'gianna.3', 'gianna.4'];
  s.discard = [];
  s.ddeck = o.ddeck || ['mammona', 'cerbero'];
  s.log = [];
  return s;
}
function roll(s, seat, a, b) { K._forceDice(a, b); return run(s, [[seat, { type: 'roll' }]]); }

/* ---------- preparazione ---------- */
test('mazzi e preparazione', () => {
  const BASE = K.BLOCK.filter((t) => !t.exp);
  assert.strictEqual(BASE.reduce((a, b) => a + b.x, 0), 100);
  const kinds = { A: 0, G: 0, B: 0 }, traits = {};
  BASE.forEach((t) => { kinds[t.k] += t.x; if (t.k !== 'A') traits[t.k + (t.t || '-')] = (traits[t.k + (t.t || '-')] || 0) + t.x; });
  assert.deepStrictEqual(kinds, { A: 32, G: 34, B: 34 });
  assert.ok(K.BLOCK.every((t) => (t.k === 'A') === (t.n === 7)), 'gli animali, e solo loro, col 7');
  assert.deepStrictEqual(traits, { GS: 12, GR: 12, 'G-': 10, BS: 12, BR: 12, 'B-': 10 });
  assert.strictEqual(K.DEMONS.filter((d) => !d.exp).length, 20);
  for (let n = 2; n <= 5; n++) {
    const s = K.startLocal(Array.from({ length: n }, (_, i) => 'G' + i));
    assert.strictEqual(K.blockCount(s), 100);
    assert.strictEqual(K.demonCount(s), 20);
    assert.strictEqual(s.block.length, 5);
    assert.ok(s.souls.every((x) => x === 5));
    assert.strictEqual(new Set(s.candle).size, n);
    for (let p = 0; p < n; p++) assert.strictEqual(s.hand[p].length, 3);
  }
});

test('Campo estivo: le sue carte entrano solo se la partita la sceglie', () => {
  const campo = (x) => x.exp === 'campo';
  assert.strictEqual(K.BLOCK.filter(campo).reduce((a, b) => a + b.x, 0), 29);
  assert.strictEqual(K.DEMONS.filter(campo).length, 5);
  assert.deepStrictEqual(K.espansioni(['campo', 'boh', 'campo']), ['campo']);
  for (let n = 2; n <= 5; n++) {
    const base = K.startLocal(Array.from({ length: n }, (_, i) => 'G' + i));
    const tutto = base.deck.concat(base.block, base.ddeck, base.candle).concat(...Object.values(base.hand));
    assert.ok(tutto.every((u) => !K.info(u).exp), 'nessuna carta di Campo estivo senza l\'espansione');
    const s = K.startLocal(Array.from({ length: n }, (_, i) => 'G' + i), ['campo']);
    assert.deepStrictEqual(s.exp, ['campo']);
    assert.strictEqual(K.blockCount(s), 129);
    assert.strictEqual(K.demonCount(s), 25);
  }
  const b = K.startBots(['Io', 'B1'], 'medio', ['campo']);
  assert.deepStrictEqual(b.exp, ['campo']);
  let w = K.newGame({ name: 'Ospite', key: 'k1' });
  assert.deepStrictEqual(w.exp, []);
  const r = K.setExp(w, ['campo']);
  assert.ok(r.ok && r.state.exp[0] === 'campo' && r.state.v === w.v + 1);
  assert.ok(!K.setExp(K.startLocal(['A', 'B']), ['campo']).ok, 'a partita iniziata non si cambia');
  const fine = K.startLocal(['A', 'B'], ['campo']);
  fine.status = 'gameOver'; fine.result = { winner: 0 };
  const rv = K.rematch(fine);
  assert.ok(rv.ok && rv.state.exp[0] === 'campo' && K.blockCount(rv.state) === 129, 'la rivincita tiene l\'espansione');
});

/* ---------- turno ---------- */
test('si tira, si compra, si evoca una volta; poi si passa', () => {
  let s = mk({ cards: { 0: ['paolo.1', 'paolo.2', 'paolo.3'] }, block: ['fido.1', 'fido.2', 'gianna.1', 'gianna.2', 'pipistrello.1'], hand: { 0: ['mammona'] }, deck: ['micio.1', 'micio.2'] });
  assert.ok(!K.act(s, 0, { type: 'end' }).ok, 'prima bisogna tirare');
  s = run(s, [[0, { type: 'buy', i: 0 }]]);
  assert.strictEqual(s.souls[0], 2);
  assert.strictEqual(s.block[0], null);
  assert.ok(!K.act(s, 0, { type: 'buy', i: 1 }).ok);
  assert.ok(!K.act(s, 0, { type: 'summon', d: 'mammona', cards: ['paolo.1', 'paolo.2'] }).ok, 'servono 3 carte');
  s = run(s, [[0, { type: 'summon', d: 'mammona', cards: ['paolo.1', 'paolo.2', 'paolo.3'] }]]);
  assert.deepStrictEqual(s.demons[0], ['mammona']);
  assert.deepStrictEqual(s.cards[0], ['fido.1']);
  s = roll(s, 0, 1, 1);
  assert.ok(!K.act(s, 0, { type: 'roll' }).ok);
  s = run(s, [[0, { type: 'end' }]]);
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.block[0], 'micio.2', 'il Quartiere si riempie a fine turno');
});
test('candele con chiunque tiri, demoni solo con chi li ha evocati', () => {
  let s = mk({ candle: ['principiante', 'malvagia', 'buona'], demons: { 1: ['mammona'] } });
  s = roll(s, 0, 3, 4); // 7: nessuna candela, Mammona non è del tiratore
  assert.deepStrictEqual(s.souls, [5, 5, 5]);
  s = run(s, [[0, { type: 'end' }]]);
  s = roll(s, 1, 2, 4); // 6
  assert.deepStrictEqual(s.souls, [6, 5, 5]);
  s = run(s, [[1, { type: 'end' }]]);
  s = roll(s, 2, 5, 5); // 10
  assert.deepStrictEqual(s.souls, [6, 6, 5]);
  s = run(s, [[2, { type: 'end' }], [0, { type: 'end' }]].slice(0, 1));
  s = roll(s, 0, 4, 3);
  s = run(s, [[0, { type: 'end' }]]);
  s = roll(s, 1, 4, 3); // 7 tirato da chi ha Mammona
  assert.strictEqual(s.souls[1], 6 + 3);
});
test('vince subito chi ha 3 demoni e 10 anime', () => {
  let s = mk({ souls: [9, 5, 5], demons: { 0: ['mammona', 'cerbero', 'legione'] }, candle: ['malvagia', 'buona', 'gentile'] });
  s = roll(s, 0, 1, 2); // 3: Candela Buona di G1, niente per G0
  assert.strictEqual(s.status, 'playing');
  s = run(s, [[0, { type: 'end' }]]);
  s = roll(s, 1, 5, 5); // 10: Candela Malvagia di G0
  assert.strictEqual(s.status, 'gameOver');
  assert.strictEqual(s.result.winner, 0);
});

/* ---------- carte del Quartiere ---------- */
test('requisiti: Fido, Coniglietto, Pappagallo', () => {
  let s = mk({ cards: { 0: ['fido.1', 'coniglio.1', 'pappagallo.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.souls[0], 5 + 3, 'senza bambini niente Fido né Pappagallo; i 3 animali bastano al Coniglietto');
  s = mk({ cards: { 0: ['fido.1', 'coniglio.1', 'pappagallo.1', 'paolo.1', 'franco.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.souls[0], 5 + 2 + 3 + 2);
});
test('Micio prende l\'animale scoperto prima che conti il Coniglietto', () => {
  let s = mk({ cards: { 0: ['coniglio.1', 'micio.1'] }, deck: ['gianna.2', 'pipistrello.1'] });
  s = roll(s, 0, 3, 4);
  assert.deepStrictEqual(s.cards[0].slice().sort(), ['coniglio.1', 'micio.1', 'pipistrello.1']);
  assert.strictEqual(s.souls[0], 8);
  s = mk({ cards: { 1: ['micio.1'] }, deck: ['gianna.2'] });
  s = roll(s, 0, 3, 4);
  assert.deepStrictEqual(s.cards[1], ['micio.1']);
  assert.deepStrictEqual(s.discard, ['gianna.2']);
});
test('Lalla e Tonio pescano dal mazzo', () => {
  let s = mk({ cards: { 0: ['lalla.1'] }, deck: ['gianna.2', 'nello.1', 'rosina.1'] });
  s = roll(s, 0, 1, 3);
  assert.deepStrictEqual(s.cards[0], ['lalla.1', 'rosina.1', 'nello.1']);
  s = mk({ cards: { 0: ['tonio.1'] }, deck: ['paolo.1', 'gianna.2'] });
  s = roll(s, 0, 4, 5);
  assert.deepStrictEqual(s.cards[0], ['tonio.1', 'gianna.2']);
  s = roll(mk({ cards: { 0: ['tonio.1'] }, deck: ['paolo.1'] }), 0, 4, 5);
  assert.deepStrictEqual(s.cards[0], ['tonio.1']);
});
test('Puzzola: tutti scartano tutto, tranne chi ha lo Spettro Custode', () => {
  let s = mk({ cards: { 0: ['puzzola.1', 'paolo.1'], 1: ['fido.1'], 2: ['pipistrello.1'] }, demons: { 2: ['custode'] } });
  s = roll(s, 0, 3, 4);
  assert.deepStrictEqual([s.cards[0], s.cards[1], s.cards[2]], [[], [], ['pipistrello.1']]);
  assert.strictEqual(K.blockCount(s), K.blockCount(mk({ cards: { 0: ['puzzola.1', 'paolo.1'], 1: ['fido.1'], 2: ['pipistrello.1'] } })));
});
test('Ernesto attiva gli animali; Fortuna e Leo attivano i dolci', () => {
  let s = mk({ cards: { 0: ['ernesto.1', 'fido.1', 'pipistrello.1'] }, candle: ['malvagia', 'malvagia', 'malvagia'] });
  s = roll(s, 0, 4, 4);
  assert.strictEqual(s.souls[0], 5 + 2 + 1);
  s = mk({ cards: { 0: ['fortuna.1', 'rosina.1', 'pietro.1', 'fortuna.2'] } });
  s = roll(s, 0, 1, 4);
  assert.strictEqual(s.prompt.s, 0);
  assert.deepStrictEqual(s.prompt.opts.slice().sort(), ['pietro.1', 'rosina.1'], 'mai un\'altra Fortuna');
  // tutte e due le Fortune scattano: si sceglie due volte
  s = run(s, [[0, ans(['rosina.1'])], [0, ans(['rosina.1'])]]);
  assert.strictEqual(s.souls[0], 5 + 5 + 5);
  s = mk({ cards: { 0: ['leo.1', 'leo.2', 'rosina.1', 'ciccio.1', 'paolo.1'] } });
  s = roll(s, 0, 5, 5);
  assert.strictEqual(s.souls[0], 5 + 2 * (5 + 2), 'due Leo, ognuno attiva Rosina e Ciccio');
});
test('Dario prende dal Quartiere; Nina scarta se stessa per rubare un bambino', () => {
  let s = mk({ cards: { 0: ['dario.1'] }, block: ['fido.1', null, 'pipistrello.1', null, null] });
  s = roll(s, 0, 1, 2);
  assert.deepStrictEqual(s.prompt.opts, ['fido.1', 'pipistrello.1']);
  s = run(s, [[0, ans(['pipistrello.1'])]]);
  assert.deepStrictEqual(s.cards[0], ['dario.1', 'pipistrello.1']);
  assert.strictEqual(s.block[2], null);
  // Mimì prende solo bambini (con la Gorgobambola anche le bambine contano come bambini)
  s = mk({ cards: { 0: ['mimi.1'] }, block: ['gianna.1', 'fido.1', 'paolo.1', null, 'olga.1'] });
  s = roll(s, 0, 2, 4);
  assert.deepStrictEqual([s.cards[0], s.block], [['mimi.1', 'paolo.1'], ['gianna.1', 'fido.1', null, null, 'olga.1']]);
  s = mk({ cards: { 0: ['mimi.1'] }, demons: { 0: ['gorgobambola'] }, block: ['gianna.1', 'fido.1', 'paolo.1', null, null] });
  s = roll(s, 0, 2, 4);
  assert.deepStrictEqual(s.prompt.opts, ['gianna.1', 'paolo.1']);
  s = mk({ cards: { 0: ['nina.1'], 1: ['olga.1'], 2: ['franco.1'] }, demons: { 2: ['custode'] } });
  s = roll(s, 0, 4, 5);
  assert.ok(s.prompt.opts.includes('olga.1') && !s.prompt.opts.includes('franco.1'));
  assert.ok(K.act(s, 0, ans([])).ok, 'può rinunciare');
  s = run(s, [[0, ans(['olga.1'])]]);
  assert.deepStrictEqual(s.cards[0], ['olga.1']);
  assert.deepStrictEqual(s.cards[1], []);
});
test('rubare anime: un solo bersaglio in automatico, altrimenti si sceglie; il resto dalla riserva', () => {
  let s = mk({ cards: { 0: ['dino.1'] }, souls: [0, 1, 0] });
  s = roll(s, 0, 2, 2);
  assert.deepStrictEqual(s.souls, [2, 0, 0]);
  s = mk({ cards: { 0: ['dino.1'] }, souls: [0, 4, 6] });
  s = roll(s, 0, 2, 2);
  assert.strictEqual(s.prompt.kind, 'steal');
  s = run(s, [[0, { type: 'answer', target: 2 }]]);
  assert.deepStrictEqual(s.souls, [2, 4, 4]);
});
test('Dora: tutti scartano i dolci, anche lei; lo Spettro Custode protegge', () => {
  let s = mk({ cards: { 0: ['dora.1', 'rosina.1', 'paolo.1', 'tito.1'], 1: ['ciccio.1', 'tito.2', 'nina.1'], 2: ['lalla.1'] }, demons: { 2: ['custode'] } });
  s = roll(s, 0, 5, 6);
  assert.deepStrictEqual([s.cards[0], s.cards[1], s.cards[2]], [['dora.1', 'paolo.1'], ['nina.1'], ['lalla.1']]);
  assert.deepStrictEqual([s.souls[0], s.souls[1]], [5 + 4, 5], 'il Tito di chi tira scatta prima di Dora, quello dopo non fa in tempo');
  s = mk({ cards: { 0: ['dora.1', 'nina.1'] }, demons: { 0: ['gemelle'] } });
  s = roll(s, 0, 5, 6);
  assert.deepStrictEqual(s.cards[0], [], 'con le Gemelle anche le pesti sono dolci: se ne va anche Dora');
});
test('Cane Rabbioso: 2 anime solo senza bambini', () => {
  let s = mk({ cards: { 0: ['rabbioso.1', 'fido.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.souls[0], 5 + 2);
  s = mk({ cards: { 0: ['rabbioso.1', 'fido.1', 'olga.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.souls[0], 5 + 2, 'con una bambina paga Fido e non il Cane Rabbioso');
});
test('Sandro, Caprone, Coccodrillo, Falco, Gufo', () => {
  let s = mk({ cards: { 0: ['sandro.1', 'pipistrello.1'] } });
  s = roll(s, 0, 5, 5);
  s = run(s, [[0, ans(['pipistrello.1'])]]);
  assert.deepStrictEqual([s.cards[0], s.souls[0]], [['sandro.1'], 11]);
  s = mk({ cards: { 0: ['caprone.1', 'paolo.1', 'gianna.1', 'franco.1'] }, ddeck: ['legione', 'cerbero'] });
  s = roll(s, 0, 3, 4);
  assert.ok(!K.act(s, 0, ans(['paolo.1', 'franco.1'])).ok, 'servono un bambino e una bambina');
  s = run(s, [[0, ans(['paolo.1', 'gianna.1'])]]);
  assert.deepStrictEqual(s.demons[0], ['cerbero']);
  s = mk({ cards: { 0: ['coccodrillo.1'], 1: ['paolo.1', 'pipistrello.1'], 2: ['gianna.1'] } });
  s = roll(s, 0, 3, 4);
  s = run(s, [[0, ans(['paolo.1', 'gianna.1'])]]);
  assert.deepStrictEqual([s.cards[0], s.cards[1], s.cards[2]], [[], ['pipistrello.1'], []]);
  s = mk({ cards: { 0: ['falco.1'] }, deck: ['coniglio.1', 'paolo.2', 'paolo.3', 'gianna.3', 'paolo.4', 'pipistrello.1', 'gianna.2', 'fido.1'] });
  s = roll(s, 0, 3, 4);
  s = run(s, [[0, { type: 'answer', yes: true }]]);
  assert.deepStrictEqual(s.cards[0].slice().sort(), ['fido.1', 'pipistrello.1']);
  s = mk({ cards: { 0: ['gufo.1'] }, block: ['paolo.1', 'paolo.2', 'paolo.3', 'paolo.4', 'gianna.1'], deck: ['fido.1', 'pipistrello.1'] });
  s = roll(s, 0, 3, 4);
  s = run(s, [[0, ans(['paolo.1', 'paolo.3'])]]);
  assert.deepStrictEqual(s.block, ['pipistrello.1', 'paolo.2', 'fido.1', 'paolo.4', 'gianna.1']);
  assert.strictEqual(s.souls[0], 5);
});
test('Damiano evoca dalla mano, l\'Uovo si schiude', () => {
  let s = mk({ cards: { 0: ['damiano.1'] }, hand: { 0: ['cerbero', 'legione'] } });
  s = roll(s, 0, 6, 6);
  s = run(s, [[0, ans(['legione'])]]);
  assert.deepStrictEqual([s.demons[0], s.hand[0], s.cards[0]], [['legione'], ['cerbero'], []]);
  s = mk({ demons: { 0: ['uovo'] }, hand: { 0: ['cerbero'] }, ddeck: ['mammona', 'legione', 'gemelle'] });
  s = roll(s, 0, 3, 3);
  assert.deepStrictEqual(s.prompt.opts.slice().sort(), ['gemelle', 'legione', 'mammona'], 'si sceglie dal mazzo dei demoni');
  s = run(s, [[0, ans(['legione'])]]);
  assert.deepStrictEqual([s.demons[0], s.hand[0], s.ddeck.length, s.ddeck[0]], [['legione'], ['cerbero'], 3, 'uovo'], 'l\'Uovo lascia il posto al demone scelto');
});

/* ---------- demoni ---------- */
test('Satana a Cucù: turno in più dove si attivano solo le tue carte', () => {
  let s = mk({ demons: { 0: ['cucu'] }, candle: ['marcia', 'principiante', 'gentile'] });
  s = roll(s, 0, 4, 5);
  s = run(s, [[0, { type: 'end' }]]);
  assert.strictEqual(s.turn, 0);
  assert.ok(s.onlyMine);
  s = roll(s, 0, 3, 4); // 7: Candela Gentile di G2 non si accende
  assert.deepStrictEqual(s.souls, [5 + 1 + 1, 5, 5]);
  s = run(s, [[0, { type: 'end' }]]);
  assert.strictEqual(s.turn, 1);
});
test('Belzedado, Ritiracifero, Orco Doppio, Gemelle, Gorgobambola', () => {
  let s = mk({ demons: { 0: ['belzedado'] } });
  s = roll(s, 0, 2, 2);
  assert.strictEqual(s.souls[0], 7);
  s = mk({ demons: { 0: ['ritiracifero'] }, cards: { 0: ['rosina.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.prompt.kind, 'reroll');
  K._forceDice(1, 1);
  s = run(s, [[0, { type: 'answer', yes: true }]]);
  assert.strictEqual(s.roll.sum, 2);
  assert.strictEqual(s.souls[0], 10);
  s = mk({ demons: { 0: ['orco'] }, cards: { 0: ['paolo.1', 'fido.1', 'gianna.1'] }, candle: ['malvagia', 'malvagia', 'malvagia'] });
  s = roll(s, 0, 3, 3);
  assert.strictEqual(s.souls[0], 7, 'nel tuo turno Paolo raccoglie 2');
  s = run(s, [[0, { type: 'end' }]]);
  s = roll(s, 1, 2, 4);
  assert.strictEqual(s.souls[0], 8, 'negli altri turni no');
  s = mk({ demons: { 0: ['gemelle'] }, cards: { 0: ['lia.1', 'nina.1', 'paolo.1'] } });
  s = roll(s, 0, 4, 5);
  s = run(s, [[0, ans([])]]); // Nina chiede se scartarsi: no
  assert.strictEqual(s.souls[0], 5 + 3);
  s = mk({ demons: { 0: ['gorgobambola'] }, cards: { 0: ['pappagallo.1', 'paolo.1', 'gianna.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.souls[0], 7);
});
test('Candelora, Sabba, Burlone, Asinodeo, Metallaro', () => {
  let s = mk({ demons: { 0: ['candelora'] }, candle: ['principiante', 'malvagia', 'buona'] });
  s = roll(s, 0, 4, 4);
  assert.strictEqual(s.souls[0], 7);
  s = mk({ demons: { 0: ['sabba', 'asinodeo'] }, block: ['pipistrello.1', 'paolo.1', 'paolo.2', 'paolo.3', 'paolo.4'] });
  s = run(s, [[0, { type: 'buy', i: 0 }]]);
  assert.strictEqual(s.souls[0], 5 - 2 + 1);
  s = mk({ demons: { 1: ['burlone', 'metallaro'] }, hand: { 0: ['cerbero'] }, cards: { 0: ['paolo.1', 'paolo.2', 'paolo.3', 'paolo.4'] } });
  assert.strictEqual(K.summonCost(s, 0), 4);
  assert.ok(!K.act(s, 0, { type: 'summon', d: 'cerbero', cards: ['paolo.1', 'paolo.2', 'paolo.3'] }).ok);
  s = run(s, [[0, { type: 'summon', d: 'cerbero', cards: ['paolo.1', 'paolo.2', 'paolo.3', 'paolo.4'] }]]);
  assert.strictEqual(s.souls[1], 7);
});
test('Pesce Rosso, Serpente, Re delle Bestie, Carlo', () => {
  let s = mk({ cards: { 0: ['pescerosso.1', 'rabbioso.1'] } });
  s = roll(s, 0, 3, 4);
  assert.strictEqual(s.souls[0], 5 + 2, 'prima il Cane Rabbioso raccoglie le sue 2 anime');
  s = run(s, [[0, { type: 'answer', yes: true }]]);
  assert.deepStrictEqual([s.cards[0], s.souls[0]], [['rabbioso.1'], 12]);
  s = mk({ demons: { 1: ['serpente'] } });
  s = roll(s, 0, 1, 1);
  assert.strictEqual(s.status, 'playing', 'il Serpente vince solo quando tira chi lo ha');
  s = run(s, [[0, { type: 'end' }]]);
  s = roll(s, 1, 1, 1);
  assert.deepStrictEqual([s.status, s.result.winner, s.result.why], ['gameOver', 1, 'serpent']);
  s = mk({ demons: { 0: ['bestie'] }, cards: { 0: ['fido.1', 'micio.1', 'gianna.1'] }, souls: [0, 1, 0] });
  s = roll(s, 0, 2, 3);
  assert.deepStrictEqual(s.souls, [2, 0, 0], '2 animali = 2 anime rubate (una dalla riserva)');
  s = mk({ cards: { 0: ['carlo.1', 'gigi.1'] }, souls: [0, 5, 0] });
  s = roll(s, 0, 5, 6);
  assert.deepStrictEqual(s.souls, [0, 5, 0], 'servono 3 pesti');
  s = mk({ cards: { 0: ['carlo.1', 'gigi.1', 'nina.1'] }, souls: [0, 5, 0] });
  s = roll(s, 0, 5, 6);
  assert.deepStrictEqual(s.souls, [3, 2, 0]);
});
test('Tentazione e Mefistolesto rubano carte, Tina le scarta', () => {
  let s = mk({ demons: { 0: ['tentazione'] }, cards: { 1: ['olga.1', 'pipistrello.1'] } });
  s = roll(s, 0, 2, 2);
  assert.deepStrictEqual([s.cards[0], s.cards[1]], [['olga.1'], ['pipistrello.1']]);
  s = mk({ demons: { 0: ['mefisto'], 1: ['cerbero'] }, cards: { 1: ['pipistrello.1'] }, ddeck: ['legione'] });
  s = roll(s, 0, 5, 5);
  assert.deepStrictEqual(s.prompt.opts, ['pipistrello.1', 'cerbero'], 'si ruba anche un demone');
  s = run(s, [[0, ans(['cerbero'])]]);
  assert.deepStrictEqual([s.demons[0], s.demons[1], s.hand[1]], [['mefisto', 'cerbero'], [], ['legione']], 'chi perde un demone ne pesca un altro');
  assert.strictEqual(K.demonCount(s), K.demonCount(mk({ demons: { 0: ['mefisto'], 1: ['cerbero'] }, ddeck: ['legione'] })));
  s = mk({ cards: { 1: ['tina.1'], 0: ['olga.1'] } });
  s = roll(s, 0, 1, 2);
  assert.deepStrictEqual(s.cards[0], []);
});

/* ---------- Campo estivo ---------- */
test('Campo estivo: Greta, Bruno, Margherita, Agnese, Michele, Nando', () => {
  let s = mk({ cards: { 0: ['greta.1', 'gianna.5', 'paolo.1'] } });
  s = roll(s, 0, 1, 2); // 3: una bambina in più oltre a Greta
  assert.strictEqual(s.souls[0], 5 + 2);
  s = mk({ cards: { 0: ['bruno.1', 'paolo.1', 'gianna.5'] } });
  s = roll(s, 0, 1, 3); // 4
  assert.strictEqual(s.souls[0], 5 + 2);
  s = mk({ cards: { 0: ['margherita.1'] }, souls: [3, 5, 3] });
  s = roll(s, 0, 5, 6); // 11: nessuno ha meno anime (pari conta)
  assert.strictEqual(s.souls[0], 3 + 4);
  s = mk({ cards: { 0: ['margherita.1'] }, souls: [6, 5, 7] });
  s = roll(s, 0, 5, 6);
  assert.strictEqual(s.souls[0], 6 + 1);
  s = mk({ cards: { 0: ['agnese.1'] } });
  s = roll(s, 0, 4, 5); // 9 senza demoni: niente
  assert.strictEqual(s.souls[0], 5);
  s = mk({ cards: { 0: ['agnese.1', 'michele.1'] }, demons: { 0: ['mammona'] }, n: 4 });
  s = roll(s, 0, 4, 5); // 9: Agnese 3 col demone, Michele 1 per giocatore (4)
  assert.strictEqual(s.souls[0], 5 + 3 + 4);
  s = mk({ cards: { 0: ['nando.1'] }, demons: { 0: ['mammona', 'cerbero'] } });
  s = roll(s, 0, 1, 1); // 2: 2 anime per demone
  assert.strictEqual(s.souls[0], 5 + 4);
});
test('Campo estivo: Rocco ruba un animale, Bea lo scarta, Ugo ruba al più ricco', () => {
  let s = mk({ cards: { 0: ['rocco.1'], 1: ['fido.1'] } });
  s = roll(s, 0, 2, 3); // 5
  assert.deepStrictEqual(s.cards[0], ['rocco.1', 'fido.1']);
  assert.deepStrictEqual(s.cards[1], []);
  s = mk({ cards: { 0: ['bea.1'], 1: ['fido.1'], 2: ['micio.1'] } });
  s = roll(s, 0, 3, 5); // 8: si sceglie quale animale
  assert.strictEqual(s.prompt.fx, 'discardAnimal');
  s = run(s, [[0, ans(['micio.1'])]]);
  assert.deepStrictEqual(s.cards[2], []);
  assert.ok(s.discard.indexOf('micio.1') >= 0);
  s = mk({ cards: { 0: ['bea.1'], 1: ['fido.1'] }, demons: { 1: ['custode'] } });
  s = roll(s, 0, 3, 5); // lo Spettro Custode protegge
  assert.deepStrictEqual(s.cards[1], ['fido.1']);
  s = mk({ cards: { 0: ['ugo.1'] }, souls: [5, 9, 7] });
  s = roll(s, 0, 6, 6); // 12
  assert.deepStrictEqual(s.souls, [9, 5, 7]);
  s = mk({ cards: { 0: ['ugo.1'] }, souls: [5, 8, 8] });
  s = roll(s, 0, 6, 6);
  assert.strictEqual(s.prompt.kind, 'steal');
  assert.deepStrictEqual(s.prompt.opts, [1, 2]);
  s = run(s, [[0, { type: 'answer', target: 2 }]]);
  assert.deepStrictEqual(s.souls, [9, 8, 4]);
  s = mk({ cards: { 0: ['ugo.1'] }, souls: [5, 0, 0] });
  s = roll(s, 0, 6, 6); // nessuno ha anime: arrivano dalla riserva, come per gli altri furti
  assert.deepStrictEqual(s.souls, [9, 0, 0]);
});
test('Campo estivo: gli animali col 7', () => {
  let s = mk({ cards: { 0: ['procione.1'] }, souls: [3, 6, 2] });
  s = roll(s, 0, 3, 4); // Procione: solo chi ha più anime gliene dà 1
  assert.deepStrictEqual(s.souls, [4, 5, 2]);
  s = mk({ cards: { 0: ['orsetto.1'], 1: ['orsetto.2'] }, demons: { 1: ['mammona'] } });
  s = roll(s, 0, 3, 4); // l'Orsetto vuole un demone: solo il secondo giocatore; Mammona non è del tiratore
  assert.deepStrictEqual(s.souls, [5, 8, 5]);
  s = mk({ cards: { 0: ['rana.1', 'fido.1', 'micio.1'] }, deck: ['gianna.2'] });
  s = roll(s, 0, 3, 4); // Rana: 1 per animale (3); Fido e Micio Nero qui non danno anime
  assert.strictEqual(s.souls[0], 5 + 3);
  s = mk({ cards: { 0: ['lucciole.1'], 1: ['lucciole.2'] }, candle: ['principiante', 'lanterna', 'malvagia'] });
  s = roll(s, 0, 3, 4); // 2 numeri la candela del principiante, 3 la lanterna
  assert.deepStrictEqual(s.souls, [7, 8, 5]);
  s = mk({ cards: { 0: ['zanzare.1'] }, souls: [5, 3, 0] });
  s = roll(s, 0, 3, 4); // ogni altro perde 1 anima, se ne ha
  assert.deepStrictEqual(s.souls, [5, 2, 0]);
  assert.ok(s.log.some((e) => e.t === 'lose' && e.s === 1 && e.n === 1));
  s = mk({ cards: { 0: ['cerbiatto.1', 'rosina.1', 'ciccio.1', 'nina.1'] } });
  s = roll(s, 0, 3, 4); // Cerbiatto: 1 per ogni dolce (2)
  assert.strictEqual(s.souls[0], 5 + 2);
});
test('Campo estivo: i demoni e la Lanterna del Campo', () => {
  let s = mk({ demons: { 0: ['lago'], 1: ['lago'] }, cards: { 0: ['fido.1', 'micio.1'], 1: ['fido.2'] } });
  s = roll(s, 0, 1, 2); // 3: Mostro del Lago solo per chi tira, 2 per animale
  assert.deepStrictEqual(s.souls, [9, 5, 5]);
  s = mk({ demons: { 0: ['piedone'] } });
  s = roll(s, 0, 1, 3); // 4
  assert.strictEqual(s.souls[0], 9);
  s = mk({ demons: { 0: ['caposcout'] }, souls: [5, 3, 0] });
  s = roll(s, 0, 4, 6); // 10: 1 da ciascuno, dalla riserva per chi non ne ha
  assert.deepStrictEqual(s.souls, [7, 2, 0]);
  s = mk({ demons: { 1: ['fatuo'], 2: ['fatuo'] } });
  s = roll(s, 0, 2, 2); // doppio di chiunque: 1 anima a chi ha il Fuoco Fatuo
  assert.deepStrictEqual(s.souls, [5, 6, 6]);
  s = mk({ demons: { 1: ['fatuo'] } });
  s.onlyMine = true;
  s = roll(s, 0, 2, 2); // nel turno in più di Satana a Cucù contano solo le carte di chi tira
  assert.deepStrictEqual(s.souls, [5, 5, 5]);
  s = mk({ demons: { 0: ['bosco'] }, block: ['rosina.1', 'paolo.1', 'paolo.2', 'paolo.3', 'paolo.4'] });
  s = run(s, [[0, { type: 'buy', i: 0 }]]); // prende una dolce: 1 anima indietro
  assert.strictEqual(s.souls[0], 5 - 3 + 1);
  s = mk({ candle: ['lanterna', 'principiante', 'principiante'], turn: 1 });
  s = roll(s, 1, 2, 3); // 5 tirato da un altro: la lanterna raccoglie lo stesso
  assert.deepStrictEqual(s.souls, [6, 5, 5]);
  s = mk({ candle: ['lanterna', 'principiante', 'principiante'], turn: 2 });
  s = roll(s, 2, 4, 5); // 9
  assert.deepStrictEqual(s.souls, [6, 5, 5]);
});

/* ---------- simulazione ---------- */
function noNested(x, path) {
  if (x === undefined) throw new Error('undefined in ' + path);
  if (Array.isArray(x)) x.forEach((v, i) => { if (Array.isArray(v)) throw new Error('array annidato in ' + path); noNested(v, path + '[' + i + ']'); });
  else if (x && typeof x === 'object') Object.keys(x).forEach((k) => noNested(x[k], path + '.' + k));
}
const N = +(process.env.PARTITE || 300);
let wins = 0, turnsTot = 0, moves = 0, longest = 0, prompts = 0;
const seenFx = new Set();
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 4);
  let s = K.startLocal(Array.from({ length: n }, (_, i) => 'G' + i), g % 2 ? ['campo'] : []);
  const B0 = K.blockCount(s), D0 = K.demonCount(s);
  assert.strictEqual(B0, g % 2 ? 129 : 100);
  let guard = 0;
  while (s.status === 'playing' && s.turnNo < 400) {
    const actor = K.nextActor(s);
    const ms = K.legalMoves(s, actor);
    assert.ok(ms.length, 'nessuna mossa');
    let mv;
    if (s.prompt) { mv = ms[K.randInt(ms.length)]; prompts++; seenFx.add(s.prompt.fx || s.prompt.kind); }
    else {
      const pref = ['summon', 'buy', 'roll', 'end'];
      const kind = pref.find((k) => ms.some((x) => x.type === k) && (k !== 'buy' || K.randInt(4) > 0));
      const opts = ms.filter((x) => x.type === kind);
      mv = opts[K.randInt(opts.length)];
    }
    const r = K.act(s, actor, mv);
    assert.ok(r.ok, JSON.stringify(mv) + ': ' + r.error);
    s = r.state; moves++;
    assert.strictEqual(K.blockCount(s), B0, 'carte del Quartiere');
    assert.strictEqual(K.demonCount(s), D0, 'demoni');
    assert.ok(s.souls.every((x) => x >= 0 && Number.isInteger(x)), 'anime');
    if (++guard > 20000) throw new Error('partita infinita');
  }
  if (s.status === 'gameOver') { wins++; turnsTot += s.turnNo; longest = Math.max(longest, s.turnNo); }
  noNested(JSON.parse(JSON.stringify(s)), 'stato');
  assert.ok(JSON.stringify(s).length < 40000, 'stato troppo grande');
}
console.log(`OK: ${passed} scenari + ${N} partite simulate (${moves} mosse, ${prompts} scelte)`);
console.log(`partite concluse: ${wins}/${N}, turni medi ${(turnsTot / Math.max(1, wins)).toFixed(1)}, massimo ${longest}`);
console.log('scelte incontrate:', [...seenFx].sort().join(', '));
