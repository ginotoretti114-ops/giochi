/* Test del motore di Stalla Matta: node stalla-matta/test/motore.test.js */
'use strict';
var assert = require('assert');
var K = require('../motore.js');

var passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error('✗ ' + name); throw e; } }
function seeded(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

// Un tavolo preparato: tocca a `turn`, fase azione. Le carte indicate si tolgono dal mazzo (o dal Nido) e si mettono
// dove serve; `top` sono le prossime carte del mazzo (la prima esce per prima).
function mk(o) {
  o = o || {};
  var np = o.n || 3, names = [], i;
  for (i = 0; i < np; i++) names.push('G' + i);
  var s = K.startLocal(names);
  s.hand = {}; s.stable = {};
  for (i = 0; i < np; i++) { s.hand[i] = []; s.stable[i] = []; }
  s.discard = []; s.nursery = K.nidoPer(s.exp).slice(); s.deck = K.mazzoPer(s.exp, np).slice();
  function take(c) {
    var i = s.deck.indexOf(c);
    if (i >= 0) return s.deck.splice(i, 1)[0];
    i = s.nursery.indexOf(c);
    if (i >= 0) return s.nursery.splice(i, 1)[0];
    throw new Error('carta non disponibile: ' + c);
  }
  for (i = 0; i < np; i++) {
    ((o.hands || {})[i] || []).forEach(function (c) { s.hand[i].push(take(c)); });
    ((o.stables || {})[i] || []).forEach(function (c) { s.stable[i].push(take(c)); });
  }
  (o.discard || []).forEach(function (c) { s.discard.push(take(c)); });
  var topc = (o.top || []).map(take);
  if (o.deck) { var keep = o.deck.map(take); s.discard = s.discard.concat(s.deck); s.deck = keep; }
  for (i = topc.length - 1; i >= 0; i--) s.deck.push(topc[i]);
  s.turn = o.turn || 0; s.turnNo = 1; s.phase = 'azione'; s.giocate = 0; s.maxGiocate = o.max || 1;
  s.usati = []; s.salta = false; s.extra = 0; s.vuoto = false;
  s.stack = [{ k: 'prossimo', turno: 1 }, { k: 'fine_fase', turno: 1 }, { k: 'azione', turno: 1 }];
  s.queue = []; s.chain = []; s.ctx = {}; s.prompt = null; s.inGioco = null; s.log = []; s.status = 'playing'; s.result = null;
  s.goal = np >= 6 ? 6 : 7;
  return s;
}
function mv(s, p, m) { var r = K.act(s, p, m); if (!r.ok) throw new Error('mossa rifiutata: ' + r.error + ' ' + JSON.stringify(m)); integro(r.state); return r.state; }
function no(s, p, m) { var r = K.act(s, p, m); assert.ok(!r.ok, 'doveva essere rifiutata: ' + JSON.stringify(m)); return r.error; }
function play(s, p, c, to) { return mv(s, p, to == null ? { type: 'play', card: c } : { type: 'play', card: c, to: to }); }
function ans(s, p, x) { x.type = 'answer'; return mv(s, p, x); }
function pick(s, p, cards) { return ans(s, p, { cards: [].concat(cards) }); }
function skip(s, p) { return ans(s, p, { skip: true }); }
// Tutti lasciano passare le finestre del Nitrito finché ce ne sono.
function passa(s) {
  while (s.status === 'playing' && s.prompt && s.prompt.kind === 'nitrito') s = ans(s, s.prompt.wait[0], { pass: true });
  return s;
}
function playOk(s, p, c, to) { return passa(play(s, p, c, to)); }
function last(s, t) { for (var i = s.log.length - 1; i >= 0; i--) if (s.log[i].t === t) return s.log[i]; return null; }
function has(a, c) { return a.indexOf(c) >= 0; }
function P(s) { return s.prompt; }
// Ogni carta del gioco è in un posto solo.
function integro(s) {
  if (!s.seats || s.status === 'waiting') return;
  var seen = {}, np = s.seats.length, i;
  function add(c, where) {
    assert.ok(K.META[c], 'carta sconosciuta ' + c + ' in ' + where);
    assert.ok(!seen[c], 'carta doppia ' + c + ' (' + seen[c] + ' e ' + where + ')');
    seen[c] = where;
  }
  s.deck.forEach(function (c) { add(c, 'mazzo'); });
  s.discard.forEach(function (c) { add(c, 'scarti'); });
  s.nursery.forEach(function (c) { add(c, 'nido'); });
  for (i = 0; i < np; i++) {
    s.hand[i].forEach(function (c) { add(c, 'mano' + i); assert.notStrictEqual(K.kind(c), 'cucciolo', 'cucciolo in mano'); });
    s.stable[i].forEach(function (c) { add(c, 'stalla' + i); });
  }
  (s.chain || []).forEach(function (x) { add(x.c, 'catena'); });
  if (s.inGioco) add(s.inGioco, 'in gioco');
  (s.stack || []).forEach(function (f) { (f.tre || []).forEach(function (c) { add(c, 'indovino'); }); });
  s.deck.concat(s.discard).forEach(function (c) { assert.notStrictEqual(K.kind(c), 'cucciolo', 'cucciolo fuori posto'); });
  var all = K.mazzoPer(s.exp, np).concat(K.nidoPer(s.exp));
  assert.strictEqual(Object.keys(seen).length, all.length, 'carte perse');
}

/* ---------- mazzo e preparazione ---------- */
test('mazzo: 114 carte e 13 cuccioli, numeri giusti; in due 82 carte', () => {
  assert.strictEqual(K.ALL.length, 127);
  assert.strictEqual(K.mazzoPer(['base'], 4).length, 114);
  assert.strictEqual(K.nidoPer(['base']).length, 13);
  var by = {};
  K.ALL.forEach(function (c) { by[K.kind(c)] = (by[K.kind(c)] || 0) + 1; });
  assert.deepStrictEqual(by, { cucciolo: 13, semplice: 22, magico: 30, magia: 25, bonus: 14, malus: 8, istante: 15 });
  var due = K.mazzoPer(['base'], 2);
  assert.strictEqual(due.length, 82);
  assert.ok(!due.some(function (c) { return K.kind(c) === 'semplice' || K.VIA_IN_DUE.indexOf(K.keyOf(c)) >= 0; }));
  assert.strictEqual(K.CARTE.filter(function (d) { return d.id === 'nitrito'; })[0].n, 14);
  K.CARTE.forEach(function (d) { assert.ok(d.text && d.name && d.e, 'carta incompleta ' + d.id); assert.strictEqual(d.o, 2); });
  assert.deepStrictEqual(K.ESPANSIONI.filter(function (e) { return e.pronta; }).map(function (e) { return e.id; }), ['base']);
});

test('preparazione: un cucciolo a testa, 5 carte (in due anche un Nitrito), 7 unicorni per vincere (6 da 6 giocatori)', () => {
  for (var np = 2; np <= 8; np++) {
    K._setRng(seeded(np * 7));
    var names = []; for (var i = 0; i < np; i++) names.push('G' + i);
    var s = K.startLocal(names);
    integro(s);
    assert.strictEqual(s.goal, np >= 6 ? 6 : 7);
    for (i = 0; i < np; i++) {
      assert.strictEqual(s.stable[i].length, 1);
      assert.strictEqual(K.kind(s.stable[i][0]), 'cucciolo');
      var h = s.hand[i].length + (i === s.turn ? -1 : 0);
      if (s.turn !== i) assert.strictEqual(h, np === 2 ? 6 : 5);
      if (np === 2) assert.ok(s.hand[i].some(function (c) { return K.keyOf(c) === 'nitrito'; }));
    }
    assert.strictEqual(s.phase, 'azione');
    assert.deepStrictEqual(K.waitingFor(s), [s.turn]);
  }
  K._setRng(null);
});

test('espansioni: si tengono solo quelle pronte e il mazzo base c\'è sempre', () => {
  var s = K.newGame({ name: 'A', exp: ['diluvio', 'pippo'] });
  assert.deepStrictEqual(s.exp, ['base']);
  var r = K.setExp(s, []);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.state.exp, ['base']);
});

/* ---------- giocare una carta e il Nitrito ---------- */
test('un unicorno giocato: gli altri possono rispondere, poi entra e il turno passa', () => {
  var s = mk({ hands: { 0: ['rosso.1'], 1: ['nitrito.1'] } });
  s = play(s, 0, 'rosso.1');
  assert.strictEqual(P(s).kind, 'nitrito');
  assert.deepStrictEqual(P(s).wait, [1, 2]);
  assert.deepStrictEqual(K.waitingFor(s), [1, 2]);
  s = ans(s, 2, { pass: true });
  assert.deepStrictEqual(P(s).wait, [1]);
  s = ans(s, 1, { pass: true });
  assert.ok(has(s.stable[0], 'rosso.1'));
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.phase, 'azione');
});

test('Nitrito: ferma la carta, tutte e due negli scarti; l\'azione è consumata', () => {
  var s = mk({ hands: { 0: ['rosso.1', 'blu.1'], 1: ['nitrito.1'] } });
  s = play(s, 0, 'rosso.1');
  s = pick(s, 1, 'nitrito.1');
  assert.strictEqual(P(s).kind, 'nitrito');
  assert.deepStrictEqual(P(s).wait.slice().sort(), [0, 2]);
  s = passa(s);
  assert.ok(has(s.discard, 'rosso.1') && has(s.discard, 'nitrito.1'));
  assert.ok(!has(s.stable[0], 'rosso.1'));
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(last(s, 'fermata').s, 1);
});

test('Nitrito sul Nitrito: la carta torna in gioco e si può fermare di nuovo', () => {
  var s = mk({ hands: { 0: ['rosso.1', 'nitrito.2'], 1: ['nitrito.1'], 2: ['nitrito.3'] } });
  s = play(s, 0, 'rosso.1');
  s = pick(s, 1, 'nitrito.1');
  s = pick(s, 0, 'nitrito.2');
  assert.deepStrictEqual(P(s).wait.slice().sort(), [1, 2]);
  s = ans(s, 1, { pass: true });
  s = ans(s, 2, { pass: true });
  // il secondo Nitrito ha fermato il primo: si riapre la finestra sulla carta
  assert.strictEqual(P(s).kind, 'nitrito');
  assert.strictEqual(P(s).on, 'rosso.1');
  assert.ok(has(s.discard, 'nitrito.1') && has(s.discard, 'nitrito.2'));
  s = pick(s, 2, 'nitrito.3');
  s = passa(s);
  assert.ok(has(s.discard, 'rosso.1'));
  var t = mk({ hands: { 0: ['rosso.1', 'nitrito.2'], 1: ['nitrito.1'] } });
  t = play(t, 0, 'rosso.1'); t = pick(t, 1, 'nitrito.1'); t = pick(t, 0, 'nitrito.2'); t = passa(t);
  assert.ok(has(t.stable[0], 'rosso.1'));
});

test('Supernitrito: non si risponde; Urrà!: alle tue carte non si risponde', () => {
  var s = mk({ hands: { 0: ['rosso.1', 'nitrito.2'], 1: ['supernitrito.1'] } });
  s = play(s, 0, 'rosso.1');
  s = pick(s, 1, 'supernitrito.1');
  assert.strictEqual(s.prompt && s.prompt.kind === 'nitrito' ? 'aperta' : 'chiusa', 'chiusa');
  assert.ok(has(s.discard, 'rosso.1') && has(s.discard, 'supernitrito.1'));
  s = mk({ hands: { 0: ['rosso.1'], 1: ['nitrito.1'] }, stables: { 0: ['urra.1'] } });
  s = play(s, 0, 'rosso.1');
  assert.ok(has(s.stable[0], 'rosso.1'));
  assert.strictEqual(s.turn, 1);
});

test('Raffreddore e Unicornone: niente Nitriti; il Nitrito non si gioca come azione', () => {
  var s = mk({ hands: { 0: ['rosso.1', 'nitrito.3'], 1: ['nitrito.1'], 2: ['nitrito.2'] }, stables: { 1: ['raffreddore.1'], 2: ['unicornone.1'] } });
  assert.match(no(s, 0, { type: 'play', card: 'nitrito.3' }), /Nitrito/);
  s = play(s, 0, 'rosso.1');
  assert.ok(has(s.stable[0], 'rosso.1'), 'nessuno poteva rispondere');
  var t = mk({ hands: { 0: ['rosso.1'], 1: ['nitrito.1'], 2: ['nitrito.2'] }, stables: { 1: ['raffreddore.1'] } });
  t = play(t, 0, 'rosso.1');
  assert.deepStrictEqual(P(t).wait, [2]);
  assert.ok(no(t, 2, { type: 'answer', cards: ['nitrito.9'] }));
});

test('risposte di più giocatori: una risposta vecchia (pid) viene rifiutata', () => {
  var s = mk({ hands: { 0: ['rosso.1', 'nitrito.2'], 1: ['nitrito.1'] } });
  s = play(s, 0, 'rosso.1');
  var old = P(s).id;
  s = ans(s, 1, { cards: ['nitrito.1'], pid: old });
  assert.match(no(s, 2, { type: 'answer', pass: true, pid: old }), /cambiata/);
});

test('fase di azione: pescare invece di giocare, o passare', () => {
  var s = mk({ hands: { 0: ['rosso.1'] }, top: ['blu.1'] });
  s = mv(s, 0, { type: 'draw' });
  assert.ok(has(s.hand[0], 'blu.1'));
  assert.strictEqual(s.turn, 1);
  s = mk({ hands: { 0: ['rosso.1'] } });
  s = mv(s, 0, { type: 'end' });
  assert.strictEqual(s.turn, 1);
  assert.ok(no(s, 0, { type: 'end' }));
});

test('fine turno: si scarta fino a 7 carte', () => {
  var h = ['rosso.1', 'rosso.2', 'rosso.3', 'blu.1', 'blu.2', 'blu.3', 'verde.1', 'verde.2', 'verde.3'];
  var s = mk({ hands: { 0: h } });
  s = mv(s, 0, { type: 'end' });
  assert.strictEqual(P(s).op, 'limite');
  assert.strictEqual(P(s).n, 2);
  assert.ok(no(s, 0, { type: 'answer', cards: ['rosso.1'] }));
  s = pick(s, 0, ['rosso.1', 'blu.1']);
  assert.strictEqual(s.hand[0].length, 7);
  assert.strictEqual(s.turn, 1);
});

/* ---------- vincere ---------- */
test('vince chi arriva a 7 unicorni (l\'Unicornone conta 2); da 6 giocatori ne bastano 6', () => {
  var s = mk({ hands: { 0: ['rosso.1'] }, stables: { 0: ['cucciolo_rosso.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2', 'giallo.1'] } });
  s = playOk(s, 0, 'rosso.1');
  assert.strictEqual(s.status, 'gameOver');
  assert.deepStrictEqual(s.result.winners, [0]);
  s = mk({ hands: { 0: ['unicornone.1'] }, stables: { 0: ['cucciolo_rosso.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2'] } });
  s = playOk(s, 0, 'unicornone.1');
  assert.strictEqual(K.conta(s, 0), 7);
  assert.strictEqual(s.status, 'gameOver');
  s = mk({ n: 6, hands: { 0: ['rosso.1'] }, stables: { 0: ['cucciolo_rosso.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2'] } });
  s = playOk(s, 0, 'rosso.1');
  assert.deepStrictEqual(s.result.winners, [0]);
});

test('mazzo finito: vince chi ha più unicorni, poi più lettere, altrimenti perdono tutti', () => {
  var s = mk({ deck: [], stables: { 0: ['cucciolo_rosso.1', 'blu.1'], 1: ['cucciolo_blu.1'] } });
  s = mv(s, 0, { type: 'draw' });
  assert.strictEqual(s.status, 'gameOver');
  assert.deepStrictEqual(s.result.winners, [0]);
  assert.strictEqual(s.result.why, 'mazzo');
  s = mk({ deck: [], stables: { 0: ['cucciolo_rosso.1', 'blu.1'], 1: ['cucciolo_blu.1', 'arancio.1'], 2: ['cucciolo_verde.1'] } });
  s = mv(s, 0, { type: 'draw' });
  assert.deepStrictEqual(s.result.winners, [1], 'Arancio ha più lettere di Blu');
  assert.strictEqual(s.result.why, 'lettere');
  s = mk({ deck: [], stables: { 0: ['blu.1'], 1: ['blu.2'] } });
  s = mv(s, 0, { type: 'draw' });
  assert.deepStrictEqual(s.result.winners, []);
  assert.strictEqual(s.result.why, 'pari');
});

/* ---------- Magie ---------- */
test('Mela avvelenata: distrugge un unicorno; i cuccioli tornano nel Nido, i volanti in mano', () => {
  var s = mk({ hands: { 0: ['mela.1'] }, stables: { 1: ['blu.1', 'cucciolo_blu.1'], 2: ['volante_ingordo.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['blu.1', 'cucciolo_blu.1', 'volante_ingordo.1']);
  var t = pick(s, 0, 'cucciolo_blu.1');
  assert.ok(has(t.nursery, 'cucciolo_blu.1'));
  assert.ok(has(t.discard, 'mela.1'));
  t = pick(s, 0, 'volante_ingordo.1');
  assert.ok(has(t.hand[2], 'volante_ingordo.1'));
  t = pick(s, 0, 'blu.1');
  assert.ok(has(t.discard, 'blu.1'));
  assert.strictEqual(last(t, 'distrutta').q, 1);
});

test('Mela avvelenata: non tocca Miciocorno, Scudo arcobaleno e panda; senza bersagli non si gioca', () => {
  var s = mk({ hands: { 0: ['mela.1'] }, stables: { 1: ['miciocorno.1'], 2: ['blu.1', 'scudo_arcobaleno.1'] } });
  assert.match(no(s, 0, { type: 'play', card: 'mela.1' }), /unicorno/);
  s = mk({ hands: { 0: ['mela.1'] }, stables: { 1: ['blu.1', 'pandastrofe.1'] } });
  assert.ok(no(s, 0, { type: 'play', card: 'mela.1' }));
  s = mk({ hands: { 0: ['mela.1'] }, stables: { 1: ['miciocorno.1', 'flash.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.ok(has(s.discard, 'miciocorno.1'), 'col Flash il Miciocorno perde la protezione');
});

test('Paladino: si sacrifica al posto dell\'unicorno distrutto; Unicorno Cenere: si salva scartando', () => {
  var s = mk({ hands: { 0: ['mela.1'] }, stables: { 1: ['blu.1', 'paladino.1'] } });
  s = playOk(s, 0, 'mela.1');
  s = pick(s, 0, 'blu.1');
  assert.strictEqual(P(s).kind, 'scelta');
  assert.strictEqual(P(s).s, 1);
  assert.deepStrictEqual(P(s).opts, ['paladino', 'no']);
  var t = ans(s, 1, { pick: 'paladino' });
  assert.ok(has(t.stable[1], 'blu.1') && has(t.discard, 'paladino.1'));
  t = ans(s, 1, { pick: 'no' });
  assert.ok(has(t.discard, 'blu.1') && has(t.stable[1], 'paladino.1'));
  s = mk({ hands: { 0: ['mela.1'], 1: ['rosso.1', 'verde.1'] }, stables: { 1: ['cenere.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.deepStrictEqual(P(s).opts, ['scarta', 'no']);
  s = ans(s, 1, { pick: 'scarta' });
  assert.strictEqual(P(s).s, 1);
  s = pick(s, 1, 'verde.1');
  assert.ok(has(s.stable[1], 'cenere.1') && has(s.discard, 'verde.1'));
});

test('Unicorno Vendicativo: se lo distruggono, chi lo aveva può distruggere un unicorno', () => {
  var s = mk({ hands: { 0: ['mela.1'] }, stables: { 0: ['blu.1'], 1: ['vendicativo.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.strictEqual(P(s).s, 1);
  assert.ok(P(s).may);
  s = pick(s, 1, 'blu.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'vendicativo.1'));
});

test('Zoccolata: una carta torna in mano al padrone, che poi scarta una carta a sua scelta', () => {
  var s = mk({ hands: { 0: ['zoccolata.1'], 1: ['rosso.1'] }, stables: { 1: ['blu.1', 'doppietta.1'] } });
  s = playOk(s, 0, 'zoccolata.1');
  s = pick(s, 0, 'doppietta.1');
  assert.strictEqual(P(s).s, 1);
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['doppietta.1', 'rosso.1']);
  s = pick(s, 1, 'rosso.1');
  assert.ok(has(s.hand[1], 'doppietta.1') && has(s.discard, 'rosso.1'));
  var t = mk({ hands: { 0: ['zoccolata.1'] } });
  assert.ok(no(t, 0, { type: 'play', card: 'zoccolata.1' }), 'serve una carta nelle stalle degli altri');
});

test('Arraffa!: guardi la mano di un altro e prendi una carta', () => {
  var s = mk({ hands: { 0: ['arraffa.1'], 1: ['rosso.1', 'mela.2'] } });
  s = playOk(s, 0, 'arraffa.1');
  s = ans(s, 0, { target: 1 });
  assert.deepStrictEqual(P(s).opts, ['rosso.1', 'mela.2']);
  s = pick(s, 0, 'mela.2');
  assert.ok(has(s.hand[0], 'mela.2'));
  assert.deepStrictEqual(last(s, 'presa').priv, [0, 1]);
});

test('Giro di ruota: peschi 2, scarti 3 e fai un altro turno', () => {
  var s = mk({ hands: { 0: ['giro_di_ruota.1', 'rosso.1', 'rosso.2'] }, top: ['blu.1', 'blu.2'] });
  s = playOk(s, 0, 'giro_di_ruota.1');
  assert.strictEqual(P(s).n, 3);
  s = pick(s, 0, ['rosso.1', 'rosso.2', 'blu.1']);
  assert.strictEqual(s.turn, 0);
  assert.strictEqual(last(s, 'turno').ancora, true);
  s = mv(s, 0, { type: 'end' });
  assert.strictEqual(s.turn, 1);
});

test('Bufera di glitter: una carta di ogni stalla (anche la tua) torna in mano', () => {
  var s = mk({ hands: { 0: ['bufera.1'] }, stables: { 0: ['blu.1', 'verde.1'], 1: ['rosso.1'], 2: ['cucciolo_blu.1'] } });
  s = playOk(s, 0, 'bufera.1');
  s = pick(s, 0, 'verde.1');
  assert.ok(has(s.hand[0], 'verde.1') && has(s.hand[1], 'rosso.1') && has(s.nursery, 'cucciolo_blu.1'));
  var t = mk({ hands: { 0: ['bufera.1'] }, stables: { 1: ['rosso.1'] } });
  assert.match(no(t, 0, { type: 'play', card: 'bufera.1' }), /tua stalla/);
});

test('Affare d\'oro: peschi 3 e ne scarti una; Rimescolone: tutto nel mazzo e peschi 5', () => {
  var s = mk({ hands: { 0: ['affare_doro.1'] }, top: ['blu.1', 'blu.2', 'blu.3'] });
  s = playOk(s, 0, 'affare_doro.1');
  s = pick(s, 0, 'blu.2');
  assert.deepStrictEqual(s.hand[0].slice().sort(), ['blu.1', 'blu.3']);
  s = mk({ hands: { 0: ['rimescolone.1', 'rosso.1'] }, discard: ['verde.1'] });
  var deck = s.deck.length;
  s = playOk(s, 0, 'rimescolone.1');
  assert.strictEqual(s.discard.length, 0);
  assert.strictEqual(s.hand[1].length, 1, 'G1 ha pescato a inizio turno');
  assert.strictEqual(s.deck.length, deck + 3 - 5 - 1);
});

test('Bocca a muso: un unicorno dagli scarti entra nella stalla (e il suo effetto parte)', () => {
  var s = mk({ hands: { 0: ['bocca_a_muso.1'] }, discard: ['volante_ingordo.1', 'mela.1'], top: ['blu.1'] });
  s = playOk(s, 0, 'bocca_a_muso.1');
  assert.ok(has(s.stable[0], 'volante_ingordo.1'));
  assert.ok(has(s.hand[0], 'blu.1'), 'il Volante Ingordo fa pescare');
  var t = mk({ hands: { 0: ['bocca_a_muso.1'] }, discard: ['mela.1'] });
  assert.ok(no(t, 0, { type: 'play', card: 'bocca_a_muso.1' }));
});

test('Mulinello: tutti scelgono insieme cosa scartare, poi gli scarti tornano nel mazzo', () => {
  var s = mk({ hands: { 0: ['mulinello.1', 'rosso.1', 'rosso.2'], 1: ['blu.1', 'blu.2'], 2: ['verde.1'] } });
  s = playOk(s, 0, 'mulinello.1');
  assert.strictEqual(P(s).kind, 'ogni');
  assert.deepStrictEqual(P(s).wait, [0, 1]);
  s = pick(s, 1, 'blu.2');
  s = pick(s, 0, 'rosso.1');
  assert.deepStrictEqual(s.discard, ['mulinello.1'], 'la Magia finisce negli scarti dopo il rimescolo');
  assert.ok(has(s.deck, 'blu.2') || has(s.hand[1], 'blu.2'));
  assert.ok(!has(s.hand[2], 'verde.1'), 'chi ha una carta sola la scarta da sé');
  var t = mk({ hands: { 0: ['mulinello.1'] } });
  assert.ok(no(t, 0, { type: 'play', card: 'mulinello.1' }));
});

test('Cambio di rotta: un Malus passa da una stalla a un\'altra; Tabula rasa: via tutti i Bonus e Malus', () => {
  var s = mk({ hands: { 0: ['cambio_di_rotta.1'] }, stables: { 0: ['raffreddore.1'], 1: ['doppietta.1'] } });
  s = playOk(s, 0, 'cambio_di_rotta.1');
  s = pick(s, 0, 'raffreddore.1');
  assert.deepStrictEqual(P(s).opts, [1, 2]);
  s = ans(s, 0, { target: 2 });
  assert.ok(has(s.stable[2], 'raffreddore.1'));
  s = mk({ hands: { 0: ['tabula_rasa.1'] }, stables: { 0: ['raffreddore.1', 'blu.1'], 1: ['doppietta.1'] } });
  s = playOk(s, 0, 'tabula_rasa.1');
  assert.deepStrictEqual(s.stable[0], ['blu.1']);
  assert.deepStrictEqual(s.stable[1], []);
  assert.deepStrictEqual(s.discard, ['tabula_rasa.1']);
});

test('Colpo mirato: distruggi un Bonus di un altro o sacrifichi un tuo Malus', () => {
  var s = mk({ hands: { 0: ['colpo_mirato.1'] }, stables: { 0: ['raffreddore.1', 'doppietta.1'], 1: ['urra.1', 'occhio.1'] } });
  s = playOk(s, 0, 'colpo_mirato.1');
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['raffreddore.1', 'urra.1']);
  var t = pick(s, 0, 'raffreddore.1');
  assert.strictEqual(last(t, 'sacrificata').c, 'raffreddore.1');
  t = pick(s, 0, 'urra.1');
  assert.strictEqual(last(t, 'distrutta').c, 'urra.1');
});

test('Due al prezzo di uno: sacrifichi una carta, poi distruggi 2 carte', () => {
  var s = mk({ hands: { 0: ['due_per_uno.1'] }, stables: { 0: ['raffreddore.1', 'blu.1'], 1: ['rosso.1', 'urra.1'], 2: ['miciocorno.1'] } });
  s = playOk(s, 0, 'due_per_uno.1');
  s = pick(s, 0, 'raffreddore.1');
  assert.ok(!has(P(s).opts, 'miciocorno.1'), 'il Miciocorno non lo distrugge una Magia');
  s = pick(s, 0, 'rosso.1');
  assert.ok(has(s.discard, 'urra.1'), 'l\'ultimo bersaglio si sceglie da solo');
  assert.ok(has(s.discard, 'raffreddore.1') && has(s.discard, 'rosso.1'));
});

test('Baratto sleale: scambi la mano con un altro giocatore', () => {
  var s = mk({ hands: { 0: ['baratto.1', 'rosso.1'], 1: ['blu.1', 'blu.2'] } });
  s = playOk(s, 0, 'baratto.1');
  s = ans(s, 0, { target: 1 });
  assert.deepStrictEqual(s.hand[0].slice().sort(), ['blu.1', 'blu.2']);
  assert.deepStrictEqual(s.hand[1].slice(0, 1), ['rosso.1']);
});

test('Scambio di stalla: un tuo unicorno va da un altro, poi gliene rubi uno', () => {
  var s = mk({ hands: { 0: ['scambio_stalla.1'] }, stables: { 0: ['blu.1'], 1: ['volante_ingordo.1'] }, top: ['verde.1'] });
  s = playOk(s, 0, 'scambio_stalla.1');
  s = ans(s, 0, { target: 1 });
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['blu.1', 'volante_ingordo.1']);
  s = pick(s, 0, 'volante_ingordo.1');
  assert.ok(has(s.stable[1], 'blu.1') && has(s.stable[0], 'volante_ingordo.1'));
  assert.ok(has(s.hand[0], 'verde.1'), 'rubato, il Volante Ingordo entra nella tua stalla e fa pescare');
});

/* ---------- Unicorni magici ---------- */
test('Narvalo Incantatore ruba un Bonus; Unicorno Boscaiolo distrugge un Bonus o sacrifica un Malus', () => {
  var s = mk({ hands: { 0: ['narvalo_incantatore.1'] }, stables: { 1: ['doppietta.1'] } });
  s = playOk(s, 0, 'narvalo_incantatore.1');
  assert.ok(P(s).may);
  s = pick(s, 0, 'doppietta.1');
  assert.ok(has(s.stable[0], 'doppietta.1'));
  s = mk({ hands: { 0: ['boscaiolo.1'] }, stables: { 0: ['raffreddore.1'] } });
  s = playOk(s, 0, 'boscaiolo.1');
  s = pick(s, 0, 'raffreddore.1');
  assert.ok(has(s.discard, 'raffreddore.1'));
});

test('Unicorno Mano Lesta: una carta a caso dalla mano di un altro (con l\'Occhio indiscreto la scegli)', () => {
  K._setRng(seeded(3));
  var s = mk({ hands: { 0: ['mano_lesta.1'], 1: ['blu.1', 'blu.2'] } });
  s = playOk(s, 0, 'mano_lesta.1');
  assert.deepStrictEqual(P(s).opts, [1]);
  s = ans(s, 0, { target: 1 });
  assert.strictEqual(s.hand[0].length, 1);
  assert.strictEqual(last(s, 'presa').how, 'caso');
  s = mk({ hands: { 0: ['mano_lesta.1'], 1: ['blu.1', 'blu.2'] }, stables: { 1: ['occhio.1'] } });
  s = playOk(s, 0, 'mano_lesta.1');
  s = ans(s, 0, { target: 1 });
  s = pick(s, 0, 'blu.2');
  assert.deepStrictEqual(s.hand[0], ['blu.2']);
  K._setRng(null);
});

test('Volante Dispettoso: un altro giocatore scarta una carta a sua scelta', () => {
  var s = mk({ hands: { 0: ['volante_dispettoso.1'], 2: ['blu.1', 'mela.1'] } });
  s = playOk(s, 0, 'volante_dispettoso.1');
  assert.deepStrictEqual(P(s).opts, [2]);
  s = ans(s, 0, { target: 2 });
  assert.strictEqual(P(s).s, 2);
  s = pick(s, 2, 'blu.1');
  assert.deepStrictEqual(s.hand[2].slice(0, 1), ['mela.1']);
});

test('Narvalo in Frac, Narvalo Straccione e Narvalo Supremo cercano nel mazzo', () => {
  var s = mk({ hands: { 0: ['narvalo_frac.1'] } });
  s = playOk(s, 0, 'narvalo_frac.1');
  assert.ok(P(s).opts.every(function (c) { return K.kind(c) === 'bonus'; }));
  assert.strictEqual(P(s).opts.length, 14);
  s = pick(s, 0, 'urra.1');
  assert.ok(has(s.hand[0], 'urra.1'));
  s = mk({ hands: { 0: ['narvalo_straccione.1'] } });
  s = playOk(s, 0, 'narvalo_straccione.1');
  assert.strictEqual(P(s).opts.length, 8);
  s = skip(s, 0);
  assert.strictEqual(s.turn, 1);
  s = mk({ hands: { 0: ['narvalo_supremo.1'] } });
  s = playOk(s, 0, 'narvalo_supremo.1');
  assert.deepStrictEqual(P(s).opts.map(K.keyOf).sort(), ['narvalo', 'narvalo_frac', 'narvalo_incantatore', 'narvalo_spazzino', 'narvalo_straccione']);
});

test('Unicorno Ombra: sacrifichi un unicorno e ne riporti uno dagli scarti (non se stesso)', () => {
  var s = mk({ hands: { 0: ['ombra.1'] }, stables: { 0: ['blu.1'] }, discard: ['volante_regale.1'] });
  s = playOk(s, 0, 'ombra.1');
  s = pick(s, 0, 'blu.1');
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['blu.1', 'volante_regale.1']);
  s = pick(s, 0, 'volante_regale.1');
  assert.ok(has(s.stable[0], 'volante_regale.1'));
  // il Volante Regale entra e può prendere un unicorno dagli scarti
  assert.ok(P(s).may);
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.hand[0], 'blu.1'));
  var t = mk({ hands: { 0: ['ombra.1'] } });
  t = playOk(t, 0, 'ombra.1');
  assert.ok(P(t).may);
  t = pick(t, 0, 'ombra.1');
  assert.ok(has(t.discard, 'ombra.1') && t.prompt === null, 'non si riporta se stesso');
});

test('Unicorno Catastrofe: ogni giocatore sacrifica un unicorno', () => {
  var s = mk({ hands: { 0: ['catastrofe.1'] }, stables: { 0: ['blu.1'], 1: ['rosso.1', 'cucciolo_rosso.1'], 2: ['verde.1'] } });
  s = playOk(s, 0, 'catastrofe.1');
  assert.deepStrictEqual(P(s).wait, [0, 1]);
  s = pick(s, 0, 'catastrofe.1');
  s = pick(s, 1, 'cucciolo_rosso.1');
  assert.ok(has(s.discard, 'catastrofe.1') && has(s.nursery, 'cucciolo_rosso.1') && has(s.discard, 'verde.1'));
  assert.ok(has(s.stable[0], 'blu.1') && has(s.stable[1], 'rosso.1'));
});

test('Alpacorno: ogni giocatore scarta una carta; Popcorno: peschi 2 e ne scarti una', () => {
  var s = mk({ hands: { 0: ['alpacorno.1', 'blu.1'], 1: ['rosso.1', 'rosso.2'], 2: [] } });
  s = playOk(s, 0, 'alpacorno.1');
  assert.deepStrictEqual(P(s).wait, [1]);
  s = pick(s, 1, 'rosso.2');
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'rosso.2'), 'gli scarti avvengono tutti insieme');
  assert.deepStrictEqual(s.hand[1].slice(0, 1), ['rosso.1']);
  s = mk({ hands: { 0: ['popcorno.1'] }, top: ['blu.1', 'blu.2'] });
  s = playOk(s, 0, 'popcorno.1');
  s = pick(s, 0, 'blu.1');
  assert.deepStrictEqual(s.hand[0], ['blu.2']);
});

test('i Volanti: prendono dagli scarti una Magia, un unicorno o un Nitrito', () => {
  var s = mk({ hands: { 0: ['volante_stregato.1'] }, discard: ['mela.1', 'blu.1', 'nitrito.1'] });
  s = playOk(s, 0, 'volante_stregato.1');
  assert.deepStrictEqual(P(s).opts, ['mela.1']);
  s = pick(s, 0, 'mela.1');
  assert.ok(has(s.hand[0], 'mela.1'));
  s = mk({ hands: { 0: ['volante_svelto.1'] }, discard: ['mela.1', 'blu.1', 'nitrito.1'] });
  s = playOk(s, 0, 'volante_svelto.1');
  assert.deepStrictEqual(P(s).opts, ['nitrito.1']);
});

test('Unicorno Chioccia porta un Cucciolo dal Nido; Unicorno Pifferaio un unicorno semplice dalla mano', () => {
  var s = mk({ hands: { 0: ['chioccia.1'] } });
  s = playOk(s, 0, 'chioccia.1');
  assert.strictEqual(P(s).zona, 'nido');
  s = pick(s, 0, 'cucciolo_rosa.1');
  assert.ok(has(s.stable[0], 'cucciolo_rosa.1'));
  s = mk({ hands: { 0: ['pifferaio.1', 'blu.1', 'mela.1'] } });
  s = playOk(s, 0, 'pifferaio.1');
  assert.deepStrictEqual(P(s).opts, ['blu.1']);
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.stable[0], 'blu.1'));
});

test('Unicorno Risacca: rimanda in mano a un altro una carta della sua stalla (obbligatorio)', () => {
  var s = mk({ hands: { 0: ['risacca.1'] }, stables: { 2: ['urra.1'] } });
  s = playOk(s, 0, 'risacca.1');
  assert.ok(has(s.hand[2], 'urra.1'), 'unica scelta: va da sola');
});

test('Narvalo Spazzino: sacrifica tutti i tuoi Malus', () => {
  var s = mk({ hands: { 0: ['narvalo_spazzino.1'] }, stables: { 0: ['raffreddore.1', 'occhio.1', 'urra.1'] } });
  s = playOk(s, 0, 'narvalo_spazzino.1');
  assert.deepStrictEqual(s.stable[0].slice().sort(), ['narvalo_spazzino.1', 'urra.1']);
});

test('Unicorno Evocatore: scarti 2 unicorni e ne porti uno dagli scarti nella stalla', () => {
  var s = mk({ hands: { 0: ['evocatore.1', 'blu.1', 'volante_ingordo.1', 'mela.1'] }, top: ['rosso.1'] });
  s = playOk(s, 0, 'evocatore.1');
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['blu.1', 'volante_ingordo.1']);
  s = pick(s, 0, ['blu.1', 'volante_ingordo.1']);
  s = pick(s, 0, 'volante_ingordo.1');
  assert.ok(has(s.stable[0], 'volante_ingordo.1') && has(s.hand[0], 'rosso.1'));
});

test('Unicorno Rubacuori: scarti una carta e rubi un unicorno (senza bersagli non chiede)', () => {
  var s = mk({ hands: { 0: ['rubacuori.1', 'mela.1'] }, stables: { 1: ['blu.1'] } });
  s = playOk(s, 0, 'rubacuori.1');
  s = pick(s, 0, 'mela.1');
  assert.ok(has(s.stable[0], 'blu.1'));
  s = mk({ hands: { 0: ['rubacuori.1', 'mela.1'] } });
  s = playOk(s, 0, 'rubacuori.1');
  assert.strictEqual(s.turn, 1);
  assert.ok(has(s.hand[0], 'mela.1'));
});

test('Squalicorno: si sacrifica e distrugge un unicorno', () => {
  var s = mk({ hands: { 0: ['squalicorno.1'] }, stables: { 1: ['blu.1', 'verde.1'] } });
  s = playOk(s, 0, 'squalicorno.1');
  assert.strictEqual(P(s).kind, 'si');
  var t = ans(s, 0, { yes: false });
  assert.ok(has(t.stable[0], 'squalicorno.1'));
  s = ans(s, 0, { yes: true });
  s = pick(s, 0, 'verde.1');
  assert.ok(has(s.discard, 'squalicorno.1') && has(s.discard, 'verde.1'));
});

test('Unicorno Indovino: guardi 3 carte, ne prendi una e scegli quale resta in cima', () => {
  var s = mk({ hands: { 0: ['indovino.1'] }, top: ['blu.1', 'blu.2', 'blu.3'] });
  s = playOk(s, 0, 'indovino.1');
  assert.deepStrictEqual(P(s).opts, ['blu.1', 'blu.2', 'blu.3']);
  s = pick(s, 0, 'blu.2');
  assert.strictEqual(P(s).fase, 'cima');
  s = pick(s, 0, 'blu.3');
  assert.ok(has(s.hand[0], 'blu.2'));
  // G1 ha pescato all'inizio del turno la carta lasciata in cima
  assert.ok(has(s.hand[1], 'blu.3'));
  assert.strictEqual(s.deck[s.deck.length - 1], 'blu.1');
});

test('Unicorno Reginetta: gli unicorni semplici entrano solo nella stalla di chi ce l\'ha', () => {
  var s = mk({ hands: { 0: ['blu.1', 'bocca_a_muso.1'] }, stables: { 1: ['reginetta.1'] }, discard: ['rosso.1'] });
  assert.match(no(s, 0, { type: 'play', card: 'blu.1' }), /Reginetta/);
  assert.ok(no(s, 0, { type: 'play', card: 'bocca_a_muso.1' }), 'l\'unico unicorno negli scarti è semplice');
  var t = mk({ turn: 1, hands: { 1: ['blu.1'] }, stables: { 1: ['reginetta.1'] } });
  t = playOk(t, 1, 'blu.1');
  assert.ok(has(t.stable[1], 'blu.1'));
});

/* ---------- Bonus e inizio del turno ---------- */
function alTurno(s, p) { s.turn = (p + s.seats.length - 1) % s.seats.length; return mv(s, s.turn, { type: 'end' }); }

test('inizio turno: gli effetti si scelgono da un elenco prima di pescare; Acchiappapeluche e Triplo espresso', () => {
  var s = mk({ hands: { 0: ['blu.1'] }, stables: { 0: ['acchiappapeluche.1', 'espresso.1'] }, top: ['verde.1', 'verde.2', 'verde.3', 'giallo.1'] });
  s = alTurno(s, 0);
  assert.strictEqual(s.phase, 'inizio');
  assert.deepStrictEqual(P(s).opts, ['acchiappapeluche.1', 'espresso.1']);
  assert.ok(P(s).may);
  s = pick(s, 0, 'acchiappapeluche.1');
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.hand[0], 'verde.1'));
  assert.deepStrictEqual(P(s).opts, ['espresso.1']);
  s = pick(s, 0, 'espresso.1');
  s = pick(s, 0, 'acchiappapeluche.1');
  assert.ok(has(s.hand[0], 'verde.2') && has(s.hand[0], 'verde.3'));
  assert.strictEqual(s.phase, 'azione');
  assert.ok(has(s.hand[0], 'giallo.1'), 'poi la pesca del turno');
});

test('inizio turno: Rito oscuro è obbligatorio; si può rinunciare agli altri', () => {
  var s = mk({ stables: { 0: ['rito_oscuro.1', 'petardo.1', 'blu.1'], 1: ['rosso.1'] }, top: ['verde.1', 'verde.2'] });
  s = alTurno(s, 0);
  assert.ok(!P(s).may);
  assert.deepStrictEqual(P(s).must, ['rito_oscuro.1']);
  s = pick(s, 0, 'rito_oscuro.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.hand[0], 'verde.1'));
  assert.ok(P(s).may);
  s = skip(s, 0);
  assert.strictEqual(s.phase, 'azione');
});

test('Petardo glitterato: sacrifichi una carta e ne distruggi una; Cannoncino e Retino', () => {
  var s = mk({ hands: { 0: ['mela.1', 'mela.2', 'mela.3'] }, stables: { 0: ['petardo.1', 'raffreddore.1', 'cannoncino.1', 'retino.1'], 1: ['blu.1', 'verde.1', 'rosso.1'] } });
  s = alTurno(s, 0);
  s = pick(s, 0, 'petardo.1');
  s = pick(s, 0, 'raffreddore.1');
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.discard, 'raffreddore.1') && has(s.discard, 'blu.1'));
  s = pick(s, 0, 'cannoncino.1');
  s = pick(s, 0, ['mela.1', 'mela.2']);
  s = pick(s, 0, 'verde.1');
  assert.ok(has(s.discard, 'verde.1'));
  assert.strictEqual(s.phase, 'azione', 'per il Retino servono 3 carte in mano: non viene offerto');
  var t = mk({ hands: { 0: ['mela.1', 'mela.2', 'mela.3'] }, stables: { 0: ['retino.1'], 1: ['rosso.1'] } });
  t = alTurno(t, 0);
  t = pick(t, 0, 'retino.1');
  t = pick(t, 0, ['mela.1', 'mela.2', 'mela.3']);
  assert.ok(has(t.stable[0], 'rosso.1'));
});

test('Doppietta: due carte nello stesso turno', () => {
  var s = mk({ hands: { 0: ['blu.1', 'blu.2', 'blu.3'] }, stables: { 0: ['doppietta.1'] } });
  s = alTurno(s, 0);
  assert.strictEqual(s.maxGiocate, 2);
  s = playOk(s, 0, 'blu.1');
  assert.strictEqual(s.turn, 0);
  assert.ok(no(s, 0, { type: 'draw' }));
  s = playOk(s, 0, 'blu.2');
  assert.strictEqual(s.turn, 1);
});

test('Unicorno Ariete: distruggi un unicorno e il turno finisce subito', () => {
  var s = mk({ hands: { 0: ['blu.2'] }, stables: { 0: ['ariete.1'], 1: ['blu.1'] } });
  s = alTurno(s, 0);
  s = pick(s, 0, 'ariete.1');
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.discard, 'blu.1'));
  assert.strictEqual(s.turn, 1, 'niente pesca e niente azione');
  assert.deepStrictEqual(s.hand[0], ['blu.2']);
});

test('Stalla pericolante: niente Bonus; Bonus e Malus si giocano in qualsiasi stalla', () => {
  var s = mk({ hands: { 0: ['doppietta.1', 'raffreddore.1'] }, stables: { 0: ['pericolante.1'] } });
  assert.match(no(s, 0, { type: 'play', card: 'doppietta.1', to: 0 }), /pericolante/i);
  assert.ok(no(s, 0, { type: 'play', card: 'raffreddore.1' }), 'serve la stalla');
  s = playOk(s, 0, 'raffreddore.1', 2);
  assert.ok(has(s.stable[2], 'raffreddore.1'));
});

/* ---------- Malus ---------- */
test('Recinto spinoso: ogni unicorno che entra o esce fa scartare una carta', () => {
  var s = mk({ hands: { 0: ['blu.1', 'mela.1', 'mela.2'] }, stables: { 0: ['recinto.1'] } });
  s = playOk(s, 0, 'blu.1');
  assert.strictEqual(P(s).s, 0);
  s = pick(s, 0, 'mela.1');
  assert.ok(has(s.discard, 'mela.1'));
});

test('Flash abbagliante: niente effetti degli unicorni magici; il Volante va negli scarti; l\'Unicornone conta 1', () => {
  var s = mk({ hands: { 0: ['volante_ingordo.1', 'mela.2'] }, stables: { 0: ['flash.1', 'unicornone.1'] } });
  var h = s.hand[0].length;
  s = playOk(s, 0, 'volante_ingordo.1');
  assert.strictEqual(s.hand[0].length, h - 1, 'non pesca');
  assert.strictEqual(K.conta(s, 0), 2);
  var t = mk({ hands: { 1: ['mela.1'] }, turn: 1, stables: { 0: ['flash.1', 'volante_ingordo.1'] } });
  t = playOk(t, 1, 'mela.1');
  assert.ok(has(t.discard, 'volante_ingordo.1'));
});

test('Pandastrofe: i panda non contano, non si toccano e non fanno vincere', () => {
  var st = ['pandastrofe.1', 'cucciolo_rosso.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2', 'giallo.1', 'giallo.2'];
  var s = mk({ hands: { 0: ['rosso.1'], 1: ['mela.1', 'zoccolata.1'] }, stables: { 0: st } });
  assert.strictEqual(K.conta(s, 0), 0);
  s = playOk(s, 0, 'rosso.1');
  assert.strictEqual(s.status, 'playing');
  assert.ok(no(s, 1, { type: 'play', card: 'mela.1' }));
  s = playOk(s, 1, 'zoccolata.1');
  assert.ok(!has(s.stable[0], 'pandastrofe.1'), 'la Zoccolata può rimandare solo la Pandastrofe');
  assert.ok(has(s.discard, 'pandastrofe.1'), 'poi G0 la scarta (era la sua sola carta)');
  assert.deepStrictEqual(s.result.winners, [0], 'senza panda G0 ha 8 unicorni');
});

test('Monolocale: oltre 5 unicorni se ne sacrifica uno', () => {
  var s = mk({ hands: { 0: ['blu.3'] }, stables: { 0: ['monolocale.1', 'cucciolo_rosso.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2'] } });
  s = playOk(s, 0, 'blu.3');
  assert.strictEqual(P(s).s, 0);
  assert.strictEqual(P(s).op, 'sacrifica');
  s = pick(s, 0, 'cucciolo_rosso.1');
  assert.strictEqual(K.conta(s, 0), 5);
  assert.strictEqual(s.turn, 1);
});

test('Monolocale e Unicorno Cenere: salvarla costa una carta alla volta, finché la mano è vuota', () => {
  var s = mk({ hands: { 0: ['blu.3', 'mela.1', 'mela.2'] }, stables: { 0: ['monolocale.1', 'cenere.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2'] } });
  s = playOk(s, 0, 'blu.3');
  for (var giri = 0; giri < 8 && P(s) && s.turn === 0; giri++) {
    if (P(s).op === 'scarta') { s = pick(s, 0, P(s).opts[0]); continue; }
    assert.strictEqual(P(s).op, 'sacrifica');
    s = pick(s, 0, 'cenere.1');
    if (P(s) && P(s).kind === 'scelta') s = ans(s, 0, { pick: 'scarta' });
  }
  assert.ok(has(s.discard, 'mela.1') && has(s.discard, 'mela.2'));
  assert.ok(has(s.discard, 'cenere.1'), 'con la mano vuota non si salva più');
  assert.strictEqual(K.conta(s, 0), 5);
});

test('Occhio indiscreto: la mano si vede; il Monolocale conta l\'Unicornone come 2', () => {
  var s = mk({ stables: { 1: ['occhio.1'] } });
  assert.ok(K.vedeMano(s, 1) && !K.vedeMano(s, 0));
  s = mk({ hands: { 0: ['unicornone.1'] }, stables: { 0: ['monolocale.1', 'blu.1', 'blu.2', 'verde.1', 'verde.2'] } });
  s = playOk(s, 0, 'unicornone.1');
  assert.strictEqual(P(s).op, 'sacrifica');
});

/* ---------- partite intere a caso ---------- */
function partita(np, seed, lim) {
  K._setRng(seeded(seed));
  var names = []; for (var i = 0; i < np; i++) names.push('G' + i);
  var s = K.startLocal(names), rnd = seeded(seed * 31 + 7), moves = 0;
  integro(s);
  while (s.status === 'playing' && moves < lim) {
    var w = K.waitingFor(s);
    assert.ok(w.length, 'nessuno deve agire');
    var p = w[Math.floor(rnd() * w.length)], legal = K.legalMoves(s, p);
    assert.ok(legal.length, 'nessuna mossa per ' + p);
    // un po' di preferenza per giocare carte, così le partite finiscono
    var plays = legal.filter(function (m) { return m.type === 'play'; });
    var m = plays.length && rnd() < 0.7 ? plays[Math.floor(rnd() * plays.length)] : legal[Math.floor(rnd() * legal.length)];
    if (m.type === 'end' && legal.some(function (x) { return x.type === 'draw'; }) && rnd() < 0.9) m = { type: 'draw' };
    var r = K.act(s, p, m);
    assert.ok(r.ok, 'mossa rifiutata: ' + r.error + ' ' + JSON.stringify(m));
    s = r.state;
    integro(s);
    if (s.status === 'playing' && s.phase === 'azione' && !s.prompt) {
      for (i = 0; i < np; i++) if (i !== s.turn) assert.ok(s.hand[i].length <= 7 + 6, 'mano enorme');
    }
    moves++;
  }
  K._setRng(null);
  return { s: s, moves: moves };
}
test('partite a caso da 2 a 8 giocatori: nessuna carta persa, si finisce sempre', () => {
  var ended = 0, total = 0, why = {};
  for (var np = 2; np <= 8; np++) {
    for (var seed = 1; seed <= 25; seed++) {
      var r = partita(np, seed * 101 + np, 6000);
      total++;
      if (r.s.status === 'gameOver') { ended++; why[r.s.result.why] = (why[r.s.result.why] || 0) + 1; }
    }
  }
  assert.strictEqual(ended, total, 'partite non finite: ' + (total - ended));
  assert.ok(why.unicorni > 0);
});

console.log('✓ ' + passed + ' test del motore di Stalla Matta');
