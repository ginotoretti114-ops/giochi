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
  var s = K.startLocal(names, o.exp);
  s.hand = {}; s.stable = {}; s.box = [];
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
  (s.box || []).forEach(function (c) { add(c, 'fuori'); assert.notStrictEqual(K.kind(c), 'cucciolo', 'cucciolo fuori dal gioco'); });
  if (s.inGioco) add(s.inGioco, 'in gioco');
  (s.stack || []).forEach(function (f) { (f.tre || []).concat(f.su || []).forEach(function (c) { add(c, 'guardate dal mazzo'); }); });
  s.deck.concat(s.discard).forEach(function (c) { assert.notStrictEqual(K.kind(c), 'cucciolo', 'cucciolo fuori posto'); });
  var all = K.mazzoPer(s.exp, np).concat(K.nidoPer(s.exp));
  assert.strictEqual(Object.keys(seen).length, all.length, 'carte perse');
}

/* ---------- mazzo e preparazione ---------- */
function perTipo(exp) {
  var by = {};
  K.ALL.forEach(function (c) { if (K.expDi(c) === exp) by[K.kind(c)] = (by[K.kind(c)] || 0) + 1; });
  return by;
}
test('mazzo: 114 carte e 13 cuccioli, numeri giusti; in due 82 carte', () => {
  assert.strictEqual(K.mazzoPer(['base'], 4).length, 114);
  assert.strictEqual(K.nidoPer(['base']).length, 13);
  assert.deepStrictEqual(perTipo('base'), { cucciolo: 13, semplice: 22, magico: 30, magia: 25, bonus: 14, malus: 8, istante: 15 });
  var due = K.mazzoPer(['base'], 2);
  assert.strictEqual(due.length, 82);
  assert.ok(!due.some(function (c) { return K.kind(c) === 'semplice' || K.VIA_IN_DUE.indexOf(K.keyOf(c)) >= 0; }));
  assert.strictEqual(K.CARTE.filter(function (d) { return d.id === 'nitrito'; })[0].n, 14);
  // fedeli all'originale; dei Draghi tre carte hanno il numero di copie ricostruito (54 carte in tutto, come la scatola)
  var RICOSTRUITE = ['fortuna_drago', 'protezione_drago', 'sfortuna_drago', 'fertile', 'nitrito_grazie'];
  K.CARTE.forEach(function (d) { assert.ok(d.text && d.name && d.e, 'carta incompleta ' + d.id); assert.strictEqual(d.o, RICOSTRUITE.indexOf(d.id) >= 0 ? 1 : 2, 'fedeltà di ' + d.id); });
  assert.deepStrictEqual(K.ESPANSIONI.filter(function (e) { return e.pronta; }).map(function (e) { return e.id; }), ['base', 'incubi', 'leggende', 'avventure', 'draghi', 'diluvio']);
  var nomi = {};
  K.CARTE.forEach(function (d) { assert.ok(!nomi[d.name], 'nome doppio ' + d.name); nomi[d.name] = 1; });
});

test('Brutti sogni: 50 carte e 3 cuccioli come l\'originale (senza la carta riassunto); in due senza semplici', () => {
  assert.deepStrictEqual(perTipo('incubi'), { cucciolo: 3, semplice: 12, magico: 11, magia: 10, bonus: 9, malus: 4, istante: 4 });
  assert.strictEqual(K.mazzoPer(['base', 'incubi'], 4).length, 164);
  assert.strictEqual(K.nidoPer(['base', 'incubi']).length, 16);
  var due = K.mazzoPer(['base', 'incubi'], 2);
  assert.strictEqual(due.length, 114);
  ['rancoroso', 'mascherato', 'fuori_dalla_tomba', 'piu_spettro', 'impermeabile'].forEach(function (k) {
    assert.ok(!due.some(function (c) { return K.keyOf(c) === k; }), k + ' in due');
  });
  assert.strictEqual(K.ALL.filter(function (c) { return K.def(c).inc; }).length, 4);
  assert.ok(K.isNeigh('nitrito_maledetto.1') && K.isNeigh('supernitrito.1') && !K.isNeigh('toc_toc.1'));
});

test('Miti e leggende: 50 carte e 4 cuccioli come l\'originale; in due senza i suoi semplici', () => {
  assert.deepStrictEqual(perTipo('leggende'), { cucciolo: 4, semplice: 12, magico: 11, magia: 11, bonus: 4, malus: 6, istante: 6 });
  assert.strictEqual(K.mazzoPer(['base', 'leggende'], 4).length, 164);
  assert.strictEqual(K.mazzoPer(['base', 'leggende'], 2).length, 82 + 38);
  assert.ok(K.isNeigh('nitrito_messere.1') && K.isNeigh('nitrito_villano.2') && K.isNeigh('nitrito_canaglia.1'));
});

test('Avventure: 50 carte e 4 cuccioli come l\'originale; in due senza semplici e senza le 5 carte dell\'elenco', () => {
  assert.deepStrictEqual(perTipo('avventure'), { cucciolo: 4, semplice: 12, magico: 12, magia: 8, istante: 9, bonus: 5, malus: 4 });
  assert.strictEqual(K.mazzoPer(['base', 'avventure'], 2).length, 82 + 50 - 12 - 6);
  assert.ok(K.isNeigh('nitrito_marinaio.1') && !K.isNeigh('rete.1') && !K.isNeigh('canna_da_pesca.1'));
});

test('Draghi: 48 carte e 6 cuccioli come l\'originale; in due senza semplici e senza le 4 carte dell\'elenco', () => {
  assert.deepStrictEqual(perTipo('draghi'), { cucciolo: 6, semplice: 12, magico: 10, magia: 9, istante: 6, bonus: 6, malus: 5 });
  assert.strictEqual(K.mazzoPer(['base', 'draghi'], 4).length, 114 + 48);
  assert.strictEqual(K.nidoPer(['base', 'draghi']).length, 19);
  assert.strictEqual(K.mazzoPer(['base', 'draghi'], 2).length, 82 + 48 - 12 - 5, 'le 2 Protezioni del drago e altre 3 carte');
  assert.ok(K.isNeigh('nitrito_bestiaccia.1'));
  // «drago» nel nome: le stesse carte che nell'originale hanno «Dragon», e nessun'altra
  var draghi = K.CARTE.filter(function (d) { return K.filtra(d.id + '.1', 'drago'); });
  assert.strictEqual(draghi.length, 26);
  assert.ok(draghi.every(function (d) { return d.exp === 'draghi'; }));
  ['apprendista', 'tiradadi', 'alchimista', 'volante_squamoso', 'nitrito_bestiaccia'].forEach(function (k) { assert.ok(!K.filtra(k + '.1', 'drago'), k); });
});

test('Diluvio arcobaleno: 52 carte (8 copie in più di carte base) e 2 cuccioli; in due senza semplici e senza le 6 carte dell\'elenco', () => {
  assert.deepStrictEqual(perTipo('diluvio'), { cucciolo: 2, semplice: 6, magico: 24, magia: 14, istante: 3, bonus: 4, malus: 1 });
  assert.strictEqual(K.mazzoPer(['base'], 4).length, 114, 'le copie in più non entrano col solo mazzo base');
  var m = K.mazzoPer(['base', 'diluvio'], 4);
  assert.strictEqual(m.length, 114 + 52);
  ['catastrofe', 'alpacorno', 'miciocorno', 'cenere'].forEach(function (k) { assert.strictEqual(m.filter(function (c) { return K.keyOf(c) === k; }).length, 3, k); });
  assert.strictEqual(K.nidoPer(['base', 'diluvio']).length, 15);
  assert.strictEqual(K.mazzoPer(['base', 'diluvio'], 2).length, 82 + 52 - 6 - 9, 'via anche 2 Pisolini, 2 Consegne speciali e 2 Fertilissimi');
  assert.strictEqual(K.META['alpacorno.2'].o, 1);
  assert.strictEqual(K.META['catastrofe.3'].o, 2);
  assert.ok(K.isNeigh('nitrito_grazie.1'));
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
  assert.deepStrictEqual(s.exp, ['base', 'diluvio'], 'le espansioni che non esistono si tolgono');
  var r = K.setExp(s, []);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.state.exp, ['base']);
  r = K.setExp(s, ['incubi', 'incubi', 'base', 'draghi']);
  assert.deepStrictEqual(r.state.exp, ['base', 'incubi', 'draghi']);
  // un'espansione non ancora pronta non si accende
  var d = K.ESPANSIONI.filter(function (e) { return e.id === 'draghi'; })[0];
  d.pronta = false;
  try { assert.deepStrictEqual(K.setExp(s, ['incubi', 'draghi']).state.exp, ['base', 'incubi']); } finally { d.pronta = true; }
  var g = K.startLocal(['A', 'B', 'C'], ['incubi']);
  integro(g);
  assert.strictEqual(g.deck.length + g.discard.length + [0, 1, 2].reduce(function (a, p) { return a + g.hand[p].length; }, 0), 164);
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
/* ---------- Brutti sogni ---------- */
var IN = ['incubi'];
test('Toc toc, chi è?: toglie dal gioco una carta di qualsiasi stalla (anche un tuo Malus); i cuccioli tornano nel Nido', () => {
  var s = mk({ exp: IN, hands: { 0: ['toc_toc.1'] }, stables: { 0: ['raffreddore.1'], 1: ['blu.1', 'cucciolo_rosso.1'] } });
  s = playOk(s, 0, 'toc_toc.1');
  assert.strictEqual(P(s).op, 'esilia');
  assert.deepStrictEqual(P(s).opts.slice().sort(), ['blu.1', 'cucciolo_rosso.1', 'raffreddore.1']);
  s = pick(s, 0, 'raffreddore.1');
  assert.ok(has(s.box, 'raffreddore.1') && has(s.discard, 'toc_toc.1'));
  assert.strictEqual(last(s, 'esiliata').dove, 'fuori');
  var t = mk({ exp: IN, hands: { 0: ['toc_toc.1'] }, stables: { 1: ['cucciolo_rosso.1'] } });
  t = playOk(t, 0, 'toc_toc.1');
  assert.ok(has(t.nursery, 'cucciolo_rosso.1') && !t.box.length);
  assert.ok(no(mk({ exp: IN, hands: { 0: ['toc_toc.1'] } }), 0, { type: 'play', card: 'toc_toc.1' }));
});

test('Nitrito maledetto: la carta fermata esce dal gioco; a lui si risponde con un Nitrito', () => {
  var s = mk({ exp: IN, hands: { 0: ['blu.1'], 1: ['nitrito_maledetto.1'] } });
  s = play(s, 0, 'blu.1');
  s = passa(ans(s, 1, { cards: ['nitrito_maledetto.1'] }));
  assert.ok(has(s.box, 'blu.1') && has(s.discard, 'nitrito_maledetto.1'));
  assert.strictEqual(last(s, 'fermata').fuori, 1);
  var t = mk({ exp: IN, hands: { 0: ['blu.1', 'nitrito.1'], 1: ['nitrito_maledetto.1'] } });
  t = play(t, 0, 'blu.1');
  t = ans(t, 1, { cards: ['nitrito_maledetto.1'] });
  t = passa(ans(t, 0, { cards: ['nitrito.1'] }));
  assert.ok(has(t.stable[0], 'blu.1') && has(t.discard, 'nitrito_maledetto.1') && !t.box.length);
});

test('Unicorno Spettrale e Cerchio di sale: non si sacrificano né si distruggono; il Cerchio tiene fuori i Malus', () => {
  var s = mk({ exp: IN, hands: { 0: ['mela.1'] }, stables: { 1: ['spettrale.1', 'blu.1', 'cerchio_di_sale.1'] } });
  assert.ok(!K.distruggibile(s, 1, 'spettrale.1', true) && !K.sacrificabile(s, 1, 'spettrale.1'));
  assert.ok(!K.sacrificabile(s, 1, 'cerchio_di_sale.1') && !K.distruggibile(s, 1, 'cerchio_di_sale.1'));
  s = playOk(s, 0, 'mela.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.stable[1], 'spettrale.1'));
  var t = mk({ exp: IN, hands: { 0: ['tabula_rasa.1'] }, stables: { 0: ['urra.1'], 1: ['cerchio_di_sale.1', 'raffreddore.1'] } });
  t = playOk(t, 0, 'tabula_rasa.1');
  assert.ok(has(t.stable[1], 'cerchio_di_sale.1') && !has(t.stable[1], 'raffreddore.1') && !has(t.stable[0], 'urra.1'));
  var u = mk({ exp: IN, hands: { 0: ['raffreddore.1', 'cambio_di_rotta.1'] }, stables: { 1: ['cerchio_di_sale.1'], 2: ['flash.1'] } });
  assert.ok(no(u, 0, { type: 'play', card: 'raffreddore.1', to: 1 }));
  assert.deepStrictEqual(K.bersagli(u, 0, 'raffreddore.1'), [0, 2]);
  u = playOk(u, 0, 'cambio_di_rotta.1');
  u = pick(u, 0, 'flash.1');
  assert.deepStrictEqual(P(u).opts, [0]);
  u = ans(u, 0, { target: 0 });
  assert.ok(has(u.stable[0], 'flash.1'));
});

test('Cuore stregato: peschi 2 entrando e i tuoi Bonus non si distruggono', () => {
  var s = mk({ exp: IN, hands: { 0: ['cuore_stregato.1'], 1: ['colpo_mirato.1'] }, stables: { 0: ['urra.1'] }, top: ['blu.1', 'blu.2'] });
  s = playOk(s, 0, 'cuore_stregato.1', 0);
  assert.ok(has(s.hand[0], 'blu.1') && has(s.hand[0], 'blu.2'));
  assert.strictEqual(s.turn, 1);
  assert.ok(no(s, 1, { type: 'play', card: 'colpo_mirato.1' }));
});

test('Elisir di lunga vita: invece di perdere una carta della stalla ne scarti una dalla mano', () => {
  var s = mk({ exp: IN, hands: { 0: ['mela.1'], 1: ['rosso.2'] }, stables: { 1: ['elisir.1', 'rosso.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.strictEqual(P(s).kind, 'scelta');
  assert.strictEqual(P(s).s, 1);
  s = ans(s, 1, { pick: 'scarta' });
  assert.ok(has(s.stable[1], 'rosso.1') && has(s.discard, 'rosso.2'));
  assert.strictEqual(last(s, 'salvata').el, 1);
});

test('Nonna Zuccherina: conta 2; se se ne va, chi l\'aveva sacrifica una carta', () => {
  var s = mk({ exp: IN, hands: { 0: ['mela.1'] }, stables: { 1: ['nonnina.1', 'blu.1', 'raffreddore.1'] } });
  assert.strictEqual(K.conta(s, 1), 3);
  s = playOk(s, 0, 'mela.1');
  s = pick(s, 0, 'nonnina.1');
  assert.strictEqual(P(s).s, 1);
  assert.strictEqual(P(s).op, 'sacrifica');
  assert.ok(!P(s).may);
  s = pick(s, 1, 'raffreddore.1');
  assert.ok(has(s.discard, 'nonnina.1') && has(s.discard, 'raffreddore.1') && has(s.stable[1], 'blu.1'));
});

test('Diavolicorno distrutto: puoi togliere dal gioco una carta; Pipistrellicorno: prendi una carta da una mano', () => {
  var s = mk({ exp: IN, hands: { 0: ['mela.1'] }, stables: { 0: ['urra.1'], 1: ['diavolicorno.1', 'blu.1'] } });
  s = playOk(s, 0, 'mela.1');
  s = pick(s, 0, 'diavolicorno.1');
  assert.strictEqual(P(s).s, 1);
  assert.strictEqual(P(s).op, 'esilia');
  assert.ok(P(s).may);
  s = pick(s, 1, 'urra.1');
  assert.ok(has(s.box, 'urra.1'));
  var t = mk({ exp: IN, hands: { 0: ['catastrofe.1', 'rosso.1'] }, stables: { 1: ['pipistrellicorno.1'], 2: ['diavolicorno.1'] } });
  t = playOk(t, 0, 'catastrofe.1');
  assert.strictEqual(P(t).kind, 'giocatore');
  assert.strictEqual(P(t).s, 1);
  t = ans(t, 1, { target: 0 });
  t = pick(t, 1, 'rosso.1');
  assert.ok(has(t.hand[1], 'rosso.1') && has(t.discard, 'diavolicorno.1'), 'il Diavolicorno sacrificato non fa niente');
});

test('Unicorno Mascherato: una carta per ogni unicorno semplice; Unicorno Rancoroso: un semplice per 3 carte', () => {
  var s = mk({ exp: IN, hands: { 0: ['mascherato.1'] }, stables: { 0: ['blu.1', 'rosso.1', 'cucciolo_rosso.1'] }, top: ['verde.1', 'verde.2', 'verde.3'] });
  s = playOk(s, 0, 'mascherato.1');
  assert.ok(has(s.hand[0], 'verde.1') && has(s.hand[0], 'verde.2') && !has(s.hand[0], 'verde.3'));
  var t = mk({ exp: IN, hands: { 0: ['rancoroso.1'] }, stables: { 0: ['blu.1'] }, top: ['verde.1', 'verde.2', 'verde.3'] });
  t = playOk(t, 0, 'rancoroso.1');
  assert.ok(P(t).may);
  t = pick(t, 0, 'blu.1');
  assert.strictEqual(t.hand[0].length, 3);
});

test('Unicorno Sensitivo: la sua mano si vede (chi prende a caso sceglie) e all\'inizio del turno pesca', () => {
  var s = mk({ exp: IN, hands: { 0: ['mano_lesta.1'], 1: ['blu.1', 'rosso.1'] }, stables: { 1: ['sensitivo.1'] } });
  assert.ok(K.vedeMano(s, 1));
  s = playOk(s, 0, 'mano_lesta.1');
  s = ans(s, 0, { target: 1 });
  assert.strictEqual(P(s).kind, 'carte');
  assert.strictEqual(P(s).di, 1);
  s = pick(s, 0, 'rosso.1');
  assert.ok(has(s.hand[0], 'rosso.1'));
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(P(s).op, 'inizio');
  assert.deepStrictEqual(P(s).opts, ['sensitivo.1']);
  var h = s.hand[1].length;
  s = pick(s, 1, 'sensitivo.1');
  assert.strictEqual(s.hand[1].length, h + 2, 'una dal Sensitivo e una della pesca');
});

test('Pagliaccio Ballerino: scarti 2 carte e rimandi in mano una carta da ogni altra stalla', () => {
  var s = mk({ exp: IN, hands: { 0: ['pagliaccio.1', 'mela.1', 'mela.2'] }, stables: { 1: ['blu.1', 'urra.1'], 2: ['rosso.1'] } });
  s = playOk(s, 0, 'pagliaccio.1');
  assert.ok(P(s).may);
  s = pick(s, 0, ['mela.1', 'mela.2']);
  assert.strictEqual(P(s).op, 'rimanda');
  s = pick(s, 0, 'urra.1');
  assert.ok(has(s.hand[1], 'urra.1') && has(s.hand[2], 'rosso.1') && has(s.stable[1], 'blu.1'));
});

test('Unicorno Mietitore: peschi; se è un Nitrito puoi mostrarlo e pescarne un altro', () => {
  var s = mk({ exp: IN, hands: { 0: ['mietitore.1'] }, top: ['nitrito_maledetto.1', 'blu.1', 'blu.2'] });
  s = playOk(s, 0, 'mietitore.1');
  assert.strictEqual(P(s).kind, 'si');
  assert.strictEqual(P(s).q, 'mietitore');
  s = ans(s, 0, { yes: true });
  assert.ok(has(s.hand[0], 'nitrito_maledetto.1') && has(s.hand[0], 'blu.1'));
  assert.strictEqual(last(s, 'mostra').c, 'nitrito_maledetto.1');
});

test('Unicorno Burattino: sposta un tuo Malus da un altro, non dove c\'è il Cerchio di sale', () => {
  var s = mk({ exp: IN, hands: { 0: ['burattino.1'] }, stables: { 0: ['raffreddore.1'], 1: ['cerchio_di_sale.1'] } });
  s = playOk(s, 0, 'burattino.1');
  assert.ok(P(s).may);
  s = pick(s, 0, 'raffreddore.1');
  assert.deepStrictEqual(P(s).opts, [2]);
  s = ans(s, 0, { target: 2 });
  assert.ok(has(s.stable[2], 'raffreddore.1'));
});

test('Uncinocorno e Lavoretto inquietante: scarti e togli dal gioco una carta', () => {
  var s = mk({ exp: IN, hands: { 0: ['uncinocorno.1', 'mela.1'] }, stables: { 1: ['urra.1', 'blu.1'] } });
  s = playOk(s, 0, 'uncinocorno.1');
  s = pick(s, 0, 'mela.1');
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.box, 'blu.1') && has(s.discard, 'mela.1'));
  var t = mk({ exp: IN, hands: { 0: ['mela.1', 'mela.2', 'mela.3'] }, stables: { 0: ['lavoretto.1'], 1: ['blu.1'] } });
  t = alTurno(t, 0);
  t = pick(t, 0, 'lavoretto.1');
  t = pick(t, 0, ['mela.1', 'mela.2', 'mela.3']);
  t = pick(t, 0, 'blu.1');
  assert.ok(has(t.box, 'blu.1'));
});

test('Possessione: scarti e rubi una carta qualsiasi; Fuori dalla tomba: un semplice dagli scarti e peschi', () => {
  var s = mk({ exp: IN, hands: { 0: ['possessione.1', 'mela.1'] }, stables: { 1: ['urra.1'] } });
  s = playOk(s, 0, 'possessione.1');
  assert.ok(has(s.stable[0], 'urra.1') && has(s.discard, 'mela.1'));
  assert.ok(no(mk({ exp: IN, hands: { 0: ['possessione.1'] } }), 0, { type: 'play', card: 'possessione.1' }));
  var t = mk({ exp: IN, hands: { 0: ['fuori_dalla_tomba.1'] }, discard: ['blu.1', 'squalicorno.1'], top: ['verde.1'] });
  t = playOk(t, 0, 'fuori_dalla_tomba.1');
  assert.ok(has(t.stable[0], 'blu.1') && has(t.hand[0], 'verde.1'));
  assert.ok(no(mk({ exp: IN, hands: { 0: ['fuori_dalla_tomba.1'] }, discard: ['squalicorno.1'] }), 0, { type: 'play', card: 'fuori_dalla_tomba.1' }));
});

test('La legge del più spettro: distrugge tutti gli unicorni semplici del giocatore scelto (non quelli protetti)', () => {
  var s = mk({ exp: IN, hands: { 0: ['piu_spettro.1'] }, stables: { 1: ['blu.1', 'rosso.1', 'squalicorno.1'] } });
  s = playOk(s, 0, 'piu_spettro.1');
  assert.deepStrictEqual(P(s).opts, [0, 1, 2]);
  s = ans(s, 0, { target: 1 });
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'rosso.1') && has(s.stable[1], 'squalicorno.1'));
  var t = mk({ exp: IN, hands: { 0: ['piu_spettro.1'] }, stables: { 2: ['verde.1', 'scudo_arcobaleno.1'] } });
  t = ans(playOk(t, 0, 'piu_spettro.1'), 0, { target: 2 });
  assert.ok(has(t.stable[2], 'verde.1'));
});

test('Seduta spiritica: un Incubo dal mazzo nella stalla scelta, e subito fa effetto', () => {
  var s = mk({ exp: IN, hands: { 0: ['seduta_spiritica.1'] }, stables: { 1: ['blu.1', 'rosso.1'], 2: ['cerchio_di_sale.1'] } });
  s = playOk(s, 0, 'seduta_spiritica.1');
  assert.strictEqual(P(s).kind, 'carte');
  assert.strictEqual(P(s).opts.length, 4);
  s = pick(s, 0, 'incubo_occupato.1');
  assert.deepStrictEqual(P(s).opts, [0, 1]);
  s = ans(s, 0, { target: 1 });
  assert.strictEqual(P(s).s, 1);
  s = pick(s, 1, 'rosso.1');
  assert.ok(has(s.stable[1], 'incubo_occupato.1') && has(s.discard, 'rosso.1'));
  assert.ok(!K.puoVincere(s, 1));
});

test('Spirito guida e Dispetto del poltergeist all\'inizio del turno', () => {
  var s = mk({ exp: IN, stables: { 0: ['spirito_guida.1'] }, top: ['raffreddore.1', 'blu.1'] });
  s = alTurno(s, 0);
  s = pick(s, 0, 'spirito_guida.1');
  assert.ok(has(s.stable[0], 'raffreddore.1') && last(s, 'mostra').dentro);
  assert.ok(has(s.hand[0], 'blu.1'));
  assert.strictEqual(s.phase, 'azione');
  var t = mk({ exp: IN, hands: { 1: ['blu.1'] }, stables: { 0: ['poltergeist.1'] }, top: ['verde.1'] });
  t = alTurno(t, 0);
  t = pick(t, 0, 'poltergeist.1');
  t = ans(t, 0, { target: 1 });
  assert.ok(has(t.hand[0], 'blu.1') && !has(t.hand[0], 'verde.1'), 'niente pesca');
  assert.strictEqual(t.phase, 'azione');
});

test('Incubi d\'inizio turno: sepolto vivo (sacrifichi; senza unicorni torna in mano) e il vuoto cosmico (rubi un Malus)', () => {
  var s = mk({ exp: IN, stables: { 0: ['incubo_sepolto.1', 'blu.1'] } });
  s = alTurno(s, 0);
  assert.deepStrictEqual(P(s).must, ['incubo_sepolto.1']);
  s = pick(s, 0, 'incubo_sepolto.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.hand[0], 'incubo_sepolto.1'));
  var t = mk({ exp: IN, stables: { 0: ['incubo_vuoto.1'], 1: ['raffreddore.1'] } });
  t = alTurno(t, 0);
  assert.deepStrictEqual(P(t).must, ['incubo_vuoto.1']);
  t = pick(t, 0, 'incubo_vuoto.1');
  assert.ok(has(t.stable[0], 'raffreddore.1'));
});

test('Incubo: occupato!: entrando fa sacrificare un unicorno, e con lui non si vince', () => {
  var s = mk({ exp: IN, hands: { 0: ['incubo_occupato.1'] }, stables: { 1: ['blu.1'] } });
  s = playOk(s, 0, 'incubo_occupato.1', 1);
  assert.ok(has(s.discard, 'blu.1') && has(s.stable[1], 'incubo_occupato.1'));
  var t = mk({ exp: IN, turn: 1, hands: { 1: ['verde.1'] }, stables: { 1: ['incubo_occupato.1', 'blu.1', 'blu.2', 'blu.3', 'rosso.1', 'rosso.2', 'rosso.3'] } });
  t = playOk(t, 1, 'verde.1');
  assert.strictEqual(K.conta(t, 1), 7);
  assert.strictEqual(t.status, 'playing');
});

test('Incubo: palestra infernale: via la mano, peschi 1 e a fine turno tieni al massimo 4 carte', () => {
  var s = mk({ exp: IN, hands: { 0: ['incubo_palestra.1'], 1: ['blu.1', 'blu.2'] }, top: ['verde.1'] });
  s = playOk(s, 0, 'incubo_palestra.1', 1);
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'blu.2') && has(s.hand[1], 'verde.1'));
  assert.strictEqual(K.limite(s, 1), 4);
  var t = mk({ exp: IN, hands: { 0: ['blu.1', 'blu.2', 'blu.3', 'rosso.1', 'rosso.2', 'rosso.3'] }, stables: { 0: ['incubo_palestra.1'] } });
  t = mv(t, 0, { type: 'end' });
  assert.strictEqual(P(t).op, 'limite');
  assert.strictEqual(P(t).n, 2);
});

/* ---------- Miti e leggende ---------- */
var LG = ['leggende'];
test('Unicorno Domatore: all\'inizio del turno porti un Cucciolo dal Nido e salti la pesca', () => {
  var s = mk({ exp: LG, stables: { 0: ['domatore.1'] }, top: ['verde.1'] });
  s = alTurno(s, 0);
  s = pick(s, 0, 'domatore.1');
  assert.strictEqual(P(s).op, 'nido');
  s = pick(s, 0, 'cucciolo_elfetto.1');
  assert.ok(has(s.stable[0], 'cucciolo_elfetto.1') && !has(s.hand[0], 'verde.1'));
  assert.strictEqual(s.phase, 'azione');
});

test('Unicorno Furioso: entrando può distruggere un unicorno; se lo distruggono, chi l\'aveva sacrifica un unicorno', () => {
  var s = mk({ exp: LG, hands: { 0: ['furioso.1'] }, stables: { 1: ['blu.1'] } });
  s = playOk(s, 0, 'furioso.1');
  assert.ok(P(s).may);
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.discard, 'blu.1'));
  var t = mk({ exp: LG, hands: { 0: ['mela.1'] }, stables: { 1: ['furioso.1', 'rosso.1'] } });
  t = pick(playOk(t, 0, 'mela.1'), 0, 'furioso.1');
  assert.ok(has(t.discard, 'furioso.1') && has(t.discard, 'rosso.1'));
});

test('Bardo Ammaliatore: passa a un altro giocatore, gli rubi un unicorno e peschi', () => {
  var s = mk({ exp: LG, stables: { 0: ['bardo.1'], 1: ['blu.1'] }, top: ['verde.1', 'verde.2'] });
  s = alTurno(s, 0);
  s = pick(s, 0, 'bardo.1');
  assert.deepStrictEqual(P(s).opts, [1, 2]);
  s = ans(s, 0, { target: 1 });
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.stable[0], 'blu.1') && has(s.stable[1], 'bardo.1'));
  assert.ok(has(s.hand[0], 'verde.1') && has(s.hand[0], 'verde.2'), 'una carta del Bardo e una della pesca');
});

test('Unicorno Divino: delle prime 3 carte ne prendi una, le altre negli scarti; Elficorno: le rimetti in ordine', () => {
  var s = mk({ exp: LG, hands: { 0: ['divino.1'] }, top: ['blu.1', 'blu.2', 'blu.3'] });
  s = playOk(s, 0, 'divino.1');
  s = pick(s, 0, 'blu.2');
  assert.ok(has(s.hand[0], 'blu.2') && has(s.discard, 'blu.1') && has(s.discard, 'blu.3'));
  var t = mk({ exp: LG, hands: { 0: ['elficorno.1'] }, top: ['blu.1', 'blu.2', 'blu.3'] });
  t = playOk(t, 0, 'elficorno.1');
  assert.strictEqual(P(t).fase, 'cima');
  t = pick(t, 0, 'blu.3');
  assert.strictEqual(P(t).fase, 'poi');
  t = pick(t, 0, 'blu.1');
  assert.ok(has(t.hand[1], 'blu.3'), 'il prossimo giocatore pesca quella messa in cima');
  assert.deepStrictEqual(t.deck.slice(-2), ['blu.2', 'blu.1']);
});

test('Nanocorno Artigiano: scarti una carta e metti nella stalla un Bonus dal mazzo', () => {
  var s = mk({ exp: LG, hands: { 0: ['nanocorno.1', 'mela.1'] } });
  s = playOk(s, 0, 'nanocorno.1');
  s = pick(s, 0, 'mela.1');
  assert.strictEqual(P(s).op, 'cerca');
  s = pick(s, 0, 'urra.1');
  assert.ok(has(s.stable[0], 'urra.1') && has(s.discard, 'mela.1'));
});

test('Orchicorno Predone: sposti un tuo Malus da un altro e gli rubi un Bonus', () => {
  var s = mk({ exp: LG, hands: { 0: ['orchicorno.1'] }, stables: { 0: ['raffreddore.1'], 1: ['urra.1'] } });
  s = playOk(s, 0, 'orchicorno.1');
  s = pick(s, 0, 'raffreddore.1');
  s = ans(s, 0, { target: 1 });
  assert.ok(has(s.stable[1], 'raffreddore.1') && has(s.stable[0], 'urra.1'));
});

test('Cavaliere senza macchia: distrugge una carta e chi ce l\'ha non può rubare; Furfante: 2 carte per rubarne una', () => {
  var s = mk({ exp: LG, hands: { 0: ['cavaliere.1', 'voltagabbana.1', 'mela.1', 'mela.2'] }, stables: { 1: ['urra.1', 'blu.1'] } });
  s = playOk(s, 0, 'cavaliere.1');
  s = pick(s, 0, 'urra.1');
  assert.ok(has(s.discard, 'urra.1'));
  assert.deepStrictEqual(K.opzioni(s, { k: 'ruba', p: 0, e: 0, filtro: 'carta' }), []);
  var t = mk({ exp: LG, hands: { 0: ['furfante.1', 'mela.1', 'mela.2'] }, stables: { 1: ['urra.1'] } });
  t = playOk(t, 0, 'furfante.1');
  t = pick(t, 0, ['mela.1', 'mela.2']);
  assert.ok(has(t.stable[0], 'urra.1'));
});

test('Unicorno Stregone: sacrifichi quante carte vuoi e ne distruggi altrettante', () => {
  var s = mk({ exp: LG, hands: { 0: ['stregone.1'] }, stables: { 0: ['raffreddore.1', 'pericolante.1'], 1: ['blu.1', 'rosso.1', 'verde.1'] } });
  s = playOk(s, 0, 'stregone.1');
  assert.strictEqual(P(s).n, 3);
  assert.strictEqual(P(s).min, 1);
  s = pick(s, 0, ['raffreddore.1', 'pericolante.1']);
  s = pick(s, 0, 'blu.1');
  s = pick(s, 0, 'rosso.1');
  assert.ok(has(s.discard, 'raffreddore.1') && has(s.discard, 'pericolante.1') && has(s.discard, 'blu.1') && has(s.discard, 'rosso.1'));
  assert.ok(has(s.stable[1], 'verde.1') && has(s.stable[0], 'stregone.1'));
});

test('Unicorno Mago: scarti, prendi una Magia dal mazzo e la giochi subito (se non si può, resta in mano)', () => {
  var s = mk({ exp: LG, hands: { 0: ['mago.1', 'blu.1'] }, stables: { 1: ['rosso.1'] } });
  s = playOk(s, 0, 'mago.1');
  s = pick(s, 0, 'blu.1');
  assert.strictEqual(P(s).op, 'mago');
  s = passa(pick(s, 0, 'mela.1'));
  assert.ok(has(s.discard, 'rosso.1') && has(s.discard, 'mela.1'));
  assert.strictEqual(s.turn, 1, 'la Magia giocata subito non è la carta del turno, ma il turno era già usato');
  var t = mk({ exp: LG, hands: { 0: ['mago.1', 'blu.1'] } });
  t = pick(pick(playOk(t, 0, 'mago.1'), 0, 'blu.1'), 0, 'mulinello.1');
  assert.ok(has(t.hand[0], 'mulinello.1'));
  assert.ok(last(t, 'resta'));
});

test('Colpo critico: lo sacrifichi e la Magia, dopo l\'effetto, si gioca di nuovo', () => {
  var s = mk({ exp: LG, hands: { 0: ['mela.1'] }, stables: { 0: ['colpo_critico.1'], 1: ['blu.1', 'rosso.1'] } });
  s = play(s, 0, 'mela.1');
  assert.strictEqual(P(s).kind, 'si');
  assert.strictEqual(P(s).q, 'critico');
  s = passa(ans(s, 0, { yes: true }));
  assert.ok(has(s.discard, 'colpo_critico.1'));
  s = passa(pick(s, 0, 'blu.1'));
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'rosso.1') && has(s.discard, 'mela.1'));
  var t = mk({ exp: LG, hands: { 0: ['mela.1'] }, stables: { 0: ['colpo_critico.1'], 1: ['blu.1', 'rosso.1'] } });
  t = passa(ans(play(t, 0, 'mela.1'), 0, { yes: false }));
  t = pick(t, 0, 'blu.1');
  assert.ok(has(t.stable[1], 'rosso.1') && has(t.stable[0], 'colpo_critico.1'));
});

test('Raglio prismatico, Palla di fuoco, Fulmine a catena, Negromanzia, Voltagabbana', () => {
  var s = mk({ exp: LG, hands: { 0: ['raglio.1', 'mela.1', 'mela.2'] }, stables: { 1: ['blu.1'], 2: ['rosso.1'] } });
  s = playOk(s, 0, 'raglio.1');
  s = pick(s, 0, ['mela.1', 'mela.2']);
  assert.deepStrictEqual(P(s).opts, [1, 2]);
  s = ans(s, 0, { target: 1 });
  s = ans(s, 0, { target: 2 });
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'rosso.1'));
  var f = mk({ exp: LG, hands: { 0: ['palla_di_fuoco.1'] }, stables: { 0: ['blu.1'], 1: ['rosso.1'] } });
  f = playOk(f, 0, 'palla_di_fuoco.1');
  assert.ok(has(f.discard, 'blu.1') && has(f.discard, 'rosso.1'));
  assert.ok(no(mk({ exp: LG, hands: { 0: ['palla_di_fuoco.1'] }, stables: { 1: ['rosso.1'] } }), 0, { type: 'play', card: 'palla_di_fuoco.1' }));
  var c = mk({ exp: LG, hands: { 0: ['fulmine.1'] }, stables: { 0: ['urra.1'], 1: ['blu.1'] } });
  c = playOk(c, 0, 'fulmine.1');
  assert.strictEqual(P(c).s, 1);
  assert.ok(P(c).may);
  c = pick(c, 1, 'urra.1');
  assert.ok(has(c.discard, 'blu.1') && has(c.discard, 'urra.1'));
  var n = mk({ exp: LG, hands: { 0: ['negromanzia.1'] }, stables: { 0: ['blu.1'] }, discard: ['rosso.1'] });
  n = pick(playOk(n, 0, 'negromanzia.1'), 0, 'rosso.1');
  assert.ok(has(n.stable[0], 'rosso.1') && has(n.discard, 'blu.1'));
  var v = mk({ exp: LG, hands: { 0: ['voltagabbana.1', 'mela.1', 'mela.2'] }, stables: { 1: ['blu.1'] } });
  v = playOk(v, 0, 'voltagabbana.1');
  assert.ok(has(v.stable[0], 'blu.1') && has(v.discard, 'mela.1') && has(v.discard, 'mela.2'));
  assert.ok(no(mk({ exp: LG, hands: { 0: ['voltagabbana.1', 'mela.1'] }, stables: { 1: ['blu.1'] } }), 0, { type: 'play', card: 'voltagabbana.1' }));
});

test('Muro di corna, Pace divina, Igiene medievale, Bisaccia senza fondo', () => {
  var s = mk({ exp: LG, hands: { 0: ['mela.1', 'rosso.1'] }, stables: { 1: ['muro_di_corna.1', 'blu.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.hand[1], 'rosso.1'), 'chi distrugge perde una carta a caso');
  assert.ok(no(mk({ exp: LG, hands: { 0: ['mela.1'] }, stables: { 0: ['pace_divina.1'], 1: ['blu.1'] } }), 0, { type: 'play', card: 'mela.1' }));
  var t = mk({ exp: LG, stables: { 1: ['igiene_medievale.1', 'squalicorno.1'], 2: ['bisaccia.1'] } });
  assert.ok(!K.attivo(t, 1, 'squalicorno.1'));
  assert.strictEqual(K.limite(t, 2), 10);
});

test('Maleficio: salti la pesca; chi resta senza carte lo passa a chi ne ha', () => {
  var s = mk({ exp: LG, hands: { 0: ['blu.1'] }, stables: { 0: ['maleficio.1'] }, top: ['verde.1'] });
  s = alTurno(s, 0);
  assert.deepStrictEqual(P(s).must, ['maleficio.1']);
  s = pick(s, 0, 'maleficio.1');
  assert.ok(!has(s.hand[0], 'verde.1'));
  assert.strictEqual(s.phase, 'azione');
  var t = mk({ exp: LG, hands: { 0: ['blu.1'], 1: ['rosso.1'] }, stables: { 0: ['maleficio.1'] } });
  t = play(t, 0, 'blu.1');
  assert.ok(has(t.stable[1], 'maleficio.1'), 'con la mano vuota si sposta da chi ha carte');
});

test('Nitrito, messere! e Nitrito, villano!: chi è stato fermato pesca o scarta', () => {
  var s = mk({ exp: LG, hands: { 0: ['blu.1', 'rosso.1'], 1: ['nitrito_villano.1'] } });
  s = passa(ans(play(s, 0, 'blu.1'), 1, { cards: ['nitrito_villano.1'] }));
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'rosso.1'));
  var t = mk({ exp: LG, hands: { 0: ['blu.1'], 1: ['nitrito_messere.1'] }, top: ['verde.1'] });
  t = passa(ans(play(t, 0, 'blu.1'), 1, { cards: ['nitrito_messere.1'] }));
  assert.ok(has(t.hand[0], 'verde.1'));
});

/* ---------- Avventure ---------- */
var AV = ['avventure'];
function opz(s, p, i) { return mv(s, p, { type: 'answer', pick: i, pid: s.prompt.id }); }
test('carte «Scegli: … oppure …»: Capitano Tagliagole, Unicorno Imbroglione, Lupo di Mare', () => {
  var s = mk({ exp: AV, hands: { 0: ['capitano.1'] }, stables: { 1: ['cucciolo_rosso.1', 'blu.1'] }, discard: ['rosso.1'] });
  s = playOk(s, 0, 'capitano.1');
  assert.strictEqual(P(s).kind, 'opzione');
  assert.deepStrictEqual(P(s).opts, [0, 1]);
  assert.ok(P(s).may);
  s = opz(s, 0, 0);
  assert.ok(has(s.stable[0], 'cucciolo_rosso.1'));
  var t = mk({ exp: AV, hands: { 0: ['imbroglione.1', 'mela.1'], 1: ['blu.1', 'blu.2'] } });
  t = opz(playOk(t, 0, 'imbroglione.1'), 0, 1);
  t = ans(t, 0, { target: 1 });
  assert.ok(has(t.hand[0], 'blu.1') && has(t.hand[1], 'mela.1'));
  var u = mk({ exp: AV, hands: { 0: ['lupo_di_mare.1'], 1: ['blu.1'], 2: ['rosso.1'] } });
  u = opz(playOk(u, 0, 'lupo_di_mare.1'), 0, 0);
  assert.ok(has(u.discard, 'blu.1') && has(u.discard, 'rosso.1'));
});

test('Unicorno Bungee, Primo Ufficiale, Unicorno Impavido: cosa succede quando se ne vanno', () => {
  var s = mk({ exp: AV, hands: { 0: ['mela.1'] }, stables: { 1: ['bungee.1', 'raffreddore.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.strictEqual(P(s).s, 1);
  s = opz(s, 1, 1);
  assert.ok(has(s.hand[1], 'bungee.1'));
  var t = mk({ exp: AV, hands: { 0: ['mela.1'] }, stables: { 1: ['primo_ufficiale.1'] }, top: ['blu.1', 'blu.2'] });
  t = opz(playOk(t, 0, 'mela.1'), 1, 0);
  assert.ok(has(t.hand[1], 'blu.1') && has(t.hand[1], 'blu.2'));
  var u = mk({ exp: AV, hands: { 0: ['mela.1'] }, stables: { 1: ['impavido.1'] }, discard: ['rete.1'] });
  u = pick(playOk(u, 0, 'mela.1'), 1, 'rete.1');
  assert.ok(has(u.hand[1], 'rete.1'));
});

test('Avventuriero Estremo: niente unicorni semplici nella sua stalla; Unicorno Clandestino e Pescatore', () => {
  var s = mk({ exp: AV, hands: { 0: ['blu.1'] }, stables: { 0: ['avventuriero.1'] } });
  assert.ok(no(s, 0, { type: 'play', card: 'blu.1' }));
  var t = mk({ exp: AV, hands: { 0: ['clandestino.1'] }, top: ['squalicorno.1'] });
  t = playOk(t, 0, 'clandestino.1');
  assert.ok(has(t.stable[0], 'squalicorno.1') && last(t, 'mostra').dentro);
  var u = mk({ exp: AV, hands: { 0: ['pescatore.1'], 1: ['blu.1', 'mela.1'] } });
  u = pick(ans(playOk(u, 0, 'pescatore.1'), 0, { target: 1 }), 0, 'mela.1');
  assert.ok(has(u.hand[0], 'mela.1'));
});

test('Pirata Saccheggiatore, Corno luminoso, Cercametalli, Paletta e secchiello', () => {
  var s = mk({ exp: AV, hands: { 0: ['saccheggiatore.1'] }, stables: { 1: ['urra.1'] } });
  s = opz(playOk(s, 0, 'saccheggiatore.1'), 0, 0);
  assert.ok(has(s.stable[0], 'urra.1'));
  var c = mk({ exp: AV, hands: { 0: ['corno_luminoso.1'] }, discard: ['urra.1'] });
  c = opz(playOk(c, 0, 'corno_luminoso.1'), 0, 1);
  assert.ok(has(c.stable[0], 'urra.1'));
  var m = mk({ exp: AV, hands: { 0: ['cercametalli.1'] }, top: ['blu.1', 'blu.2', 'blu.3'] });
  m = pick(opz(playOk(m, 0, 'cercametalli.1'), 0, 0), 0, 'blu.2');
  assert.ok(has(m.hand[0], 'blu.1') && has(m.hand[0], 'blu.3') && has(m.discard, 'blu.2'));
  var p = mk({ exp: AV, hands: { 0: ['paletta.1'] }, discard: ['blu.1', 'rosso.1'] });
  p = opz(playOk(p, 0, 'paletta.1'), 0, 1);
  p = pick(p, 0, 'blu.1');
  assert.ok(has(p.hand[0], 'blu.1') && has(p.hand[0], 'rosso.1'));
  assert.ok(no(mk({ exp: AV, hands: { 0: ['paletta.1'] } }), 0, { type: 'play', card: 'paletta.1' }));
});

test('Bussola misteriosa (un altro turno), Lingua d\'argento, Furto di culle', () => {
  var s = mk({ exp: AV, hands: { 0: ['bussola.1', 'mela.1', 'mela.2', 'mela.3'] } });
  s = opz(playOk(s, 0, 'bussola.1'), 0, 0);
  assert.strictEqual(s.turn, 0, 'il turno ricomincia');
  assert.ok(has(s.discard, 'mela.3'));
  var l = mk({ exp: AV, hands: { 0: ['lingua_dargento.1'], 1: ['blu.1'], 2: ['rosso.1', 'verde.1'] } });
  l = opz(playOk(l, 0, 'lingua_dargento.1'), 0, 0);
  assert.strictEqual(P(l).kind, 'vedi');
  assert.deepStrictEqual(P(l).mani[2], ['rosso.1', 'verde.1']);
  l = ans(l, 0, { yes: true });
  var d = mk({ exp: AV, hands: { 0: ['lingua_dargento.1'], 1: ['blu.1'], 2: ['rosso.1', 'verde.1'] } });
  d = opz(playOk(d, 0, 'lingua_dargento.1'), 0, 1);
  d = ans(d, 2, { cards: ['verde.1'] });
  assert.ok(has(d.hand[0], 'blu.1') && has(d.hand[0], 'verde.1'));
  var f = mk({ exp: AV, hands: { 0: ['furto_di_culle.1', 'mela.1', 'mela.2'] } });
  f = pick(pick(playOk(f, 0, 'furto_di_culle.1'), 0, 'cucciolo_rosso.1'), 0, 'cucciolo_blu.1');
  assert.ok(has(f.stable[0], 'cucciolo_rosso.1') && has(f.stable[0], 'cucciolo_blu.1'));
});

test('Canna da pesca: chi ruba resta a mani vuote e la carta va nella stalla di chi pesca', () => {
  var s = mk({ exp: ['avventure', 'incubi'], hands: { 0: ['possessione.1', 'mela.1'], 2: ['canna_da_pesca.1'] }, stables: { 1: ['blu.1'] } });
  s = playOk(s, 0, 'possessione.1');
  assert.strictEqual(P(s).kind, 'reazione');
  assert.deepStrictEqual(P(s).wait, [2]);
  s = passa(ans(s, 2, { cards: ['canna_da_pesca.1'] }));
  assert.ok(has(s.stable[2], 'blu.1') && !has(s.stable[0], 'blu.1') && has(s.discard, 'canna_da_pesca.1'));
  var t = mk({ exp: ['avventure', 'incubi'], hands: { 0: ['possessione.1', 'mela.1'], 2: ['canna_da_pesca.1'] }, stables: { 1: ['blu.1'] } });
  t = playOk(t, 0, 'possessione.1');
  t = ans(t, 2, { pass: true });
  assert.ok(has(t.stable[0], 'blu.1'), 'senza la Canna il furto riesce');
});

test('Rete per unicorni: la carta sacrificata o distrutta finisce nella mano di chi gioca la Rete', () => {
  var s = mk({ exp: AV, hands: { 0: ['mela.1'], 2: ['rete.1'] }, stables: { 1: ['blu.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.strictEqual(P(s).kind, 'reazione');
  s = passa(ans(s, 2, { cards: ['rete.1'] }));
  assert.ok(has(s.hand[2], 'blu.1') && !has(s.discard, 'blu.1'));
});

test('Razzo di segnalazione: chi lo subisce salta l\'inizio del turno e la pesca', () => {
  var s = mk({ exp: AV, hands: { 0: ['razzo.1'] }, stables: { 1: ['vagabondo.1'] }, top: ['blu.1'] });
  s = mv(s, 0, { type: 'end' });
  assert.strictEqual(P(s).kind, 'reazione');
  assert.deepStrictEqual(P(s).wait, [0]);
  s = passa(ans(s, 0, { cards: ['razzo.1'] }));
  assert.strictEqual(s.turn, 1);
  assert.ok(!has(s.hand[1], 'blu.1') && !s.prompt);
});

test('Rito antico, Buca coperta di foglie, Zoccoli reali, Vagabondo, Sopravvissuto (inizio del turno)', () => {
  var s = mk({ exp: AV, stables: { 0: ['rito_antico.1', 'blu.1'] }, top: ['verde.1', 'verde.2', 'verde.3', 'rosso.1'] });
  s = pick(alTurno(s, 0), 0, 'rito_antico.1');
  assert.strictEqual(s.hand[0].length, 4, '3 carte del rito e 1 della pesca');
  var b = mk({ exp: AV, stables: { 0: ['buca.1'], 1: ['blu.1'] } });
  b = pick(alTurno(b, 0), 0, 'buca.1');
  assert.ok(has(b.stable[0], 'blu.1') && has(b.discard, 'buca.1'));
  var z = mk({ exp: AV, hands: { 1: ['rosso.1'] }, stables: { 0: ['zoccoli_reali.1'] }, top: ['verde.1'] });
  z = ans(pick(alTurno(z, 0), 0, 'zoccoli_reali.1'), 0, { target: 1 });
  assert.ok(has(z.hand[0], 'rosso.1') && !has(z.hand[0], 'verde.1'));
  var v = mk({ exp: AV, hands: { 0: ['mela.1'], 1: ['rosso.1'] }, stables: { 0: ['vagabondo.1'] } });
  v = ans(pick(pick(alTurno(v, 0), 0, 'vagabondo.1'), 0, 'mela.1'), 0, { target: 1 });
  assert.ok(has(v.hand[0], 'rosso.1'));
  var w = mk({ exp: AV, hands: { 0: ['mela.1'] }, stables: { 0: ['sopravvissuto.1', 'raffreddore.1'] } });
  w = pick(pick(alTurno(w, 0), 0, 'sopravvissuto.1'), 0, 'mela.1');
  assert.ok(has(w.discard, 'raffreddore.1'));
});

test('Kit di sopravvivenza, Unicorno in mare!, Meridiana rotta, Zainetto minuscolo, La macchia nera', () => {
  var s = mk({ exp: AV, hands: { 0: ['mela.1'], 1: ['rosso.2', 'rosso.3'] }, stables: { 1: ['kit.1', 'blu.1'] } });
  s = playOk(s, 0, 'mela.1');
  assert.ok(P(s).opts.indexOf('scarta2') >= 0);
  s = ans(s, 1, { pick: 'scarta2' });
  assert.ok(has(s.stable[1], 'blu.1') && has(s.discard, 'rosso.2') && has(s.discard, 'rosso.3'));
  var m = mk({ exp: AV, hands: { 0: ['mela.1'], 1: ['rosso.2', 'rosso.3'] }, stables: { 1: ['in_mare.1', 'blu.1'] } });
  m = pick(playOk(m, 0, 'mela.1'), 1, 'rosso.2');
  assert.ok(has(m.discard, 'blu.1') && has(m.discard, 'rosso.2'));
  var r = mk({ exp: AV, stables: { 0: ['meridiana.1', 'rito_antico.1', 'blu.1'] } });
  r = alTurno(r, 0);
  assert.ok(!r.prompt && last(r, 'meridiana'));
  var z = mk({ exp: AV, hands: { 0: ['blu.1'], 1: ['rosso.1'] }, stables: { 0: ['zainetto.1'] }, top: ['verde.1'] });
  z = mv(z, 0, { type: 'draw' });
  assert.strictEqual(P(z).s, 0);
  z = pick(z, 0, 'blu.1');
  assert.ok(has(z.discard, 'blu.1'));
  var y = mk({ exp: AV, hands: { 0: ['blu.1'], 1: ['rosso.1'] }, stables: { 0: ['zainetto.1'] } });
  y = play(y, 0, 'blu.1');
  assert.ok(has(y.stable[1], 'zainetto.1'), 'senza carte in mano lo Zainetto passa a chi ne ha');
  var n = mk({ exp: AV, turn: 1, hands: { 1: ['verde.1'] }, stables: { 1: ['macchia_nera.1', 'blu.1', 'blu.2', 'blu.3', 'rosso.1', 'rosso.2', 'rosso.3'] } });
  n = playOk(n, 1, 'verde.1');
  assert.strictEqual(n.status, 'playing');
  assert.ok(!K.puoVincere(n, 1));
});

/* ---------- Draghi ---------- */
var DR = ['draghi'];
test('Dragocorno Arrabbiato e Volante Squamoso: tutti (tu compreso) scartano o sacrificano; il Volante torna in mano', () => {
  var s = mk({ exp: DR, hands: { 0: ['dragocorno_arrabbiato.1', 'mela.1', 'mela.2'], 1: ['blu.1', 'blu.2'], 2: ['rosso.1'] } });
  s = playOk(s, 0, 'dragocorno_arrabbiato.1');
  assert.strictEqual(P(s).kind, 'ogni');
  assert.deepStrictEqual(P(s).wait, [0, 1]);
  s = pick(pick(s, 0, 'mela.1'), 1, 'blu.2');
  assert.ok(has(s.discard, 'mela.1') && has(s.discard, 'blu.2') && has(s.discard, 'rosso.1'));
  var v = mk({ exp: DR, hands: { 0: ['volante_squamoso.1'] }, stables: { 0: ['blu.1'], 1: ['rosso.1', 'doppietta.1'], 2: ['verde.1'] } });
  v = playOk(v, 0, 'volante_squamoso.1');
  assert.strictEqual(P(v).kind, 'ogni');
  assert.strictEqual(P(v).filtro, 'carta');
  assert.deepStrictEqual(P(v).opts[0].sort(), ['blu.1', 'volante_squamoso.1']);
  assert.ok(has(P(v).opts[1], 'doppietta.1'), 'si sacrifica una carta qualsiasi, anche un Bonus');
  v = pick(pick(v, 0, 'volante_squamoso.1'), 1, 'doppietta.1');
  assert.ok(has(v.hand[0], 'volante_squamoso.1'), 'il Volante sacrificato torna in mano');
  assert.ok(has(v.discard, 'doppietta.1') && has(v.discard, 'verde.1') && has(v.stable[1], 'rosso.1'));
});

test('Unicorno Cavalcadraghi: sposta un Bonus o un Malus, ma non nella tua stalla', () => {
  var s = mk({ exp: DR, hands: { 0: ['cavalcadraghi.1'] }, stables: { 1: ['raffreddore.1'] } });
  s = playOk(s, 0, 'cavalcadraghi.1');
  assert.ok(P(s).may);
  s = pick(s, 0, 'raffreddore.1');
  assert.deepStrictEqual(P(s).opts, [2]);
  s = ans(s, 0, { target: 2 });
  assert.ok(has(s.stable[2], 'raffreddore.1'));
});

test('Unicorno Ammazzadraghi: i suoi unicorni non li distruggono le carte col drago (le altre sì)', () => {
  var s = mk({ exp: DR, hands: { 0: ['alito_di_drago.1', 'mela.1'] }, stables: { 1: ['ammazzadraghi.1', 'blu.1'] } });
  assert.ok(/distrugg/.test(no(s, 0, { type: 'play', card: 'alito_di_drago.1' })));
  s = playOk(s, 0, 'mela.1');
  assert.deepStrictEqual(P(s).opts.sort(), ['ammazzadraghi.1', 'blu.1']);
  var t = mk({ exp: DR, hands: { 0: ['alito_di_drago.1'] }, stables: { 1: ['ammazzadraghi.1', 'blu.1'], 2: ['rosso.1'] } });
  t = playOk(t, 0, 'alito_di_drago.1');
  assert.ok(has(t.discard, 'rosso.1'), 'resta solo l\'unicorno dell\'altro giocatore');
});

test('Unicorno Evocadraghi, Domadraghi, Alchimista, Dragotartaruga: cercano carte col drago o Magie', () => {
  var s = mk({ exp: DR, hands: { 0: ['evocadraghi.1'] }, discard: ['alito_di_drago.1', 'mela.1', 'draghetto_nero.1'.replace('draghetto_nero.1', 'fortuna_drago.1')] });
  s = playOk(s, 0, 'evocadraghi.1');
  assert.deepStrictEqual(P(s).opts.sort(), ['alito_di_drago.1', 'fortuna_drago.1']);
  s = pick(s, 0, 'fortuna_drago.1');
  assert.ok(has(s.hand[0], 'fortuna_drago.1'));
  var d = mk({ exp: DR, hands: { 0: ['domadraghi.1'] }, deck: ['bacio_del_drago.1', 'mela.1', 'travestito.1', 'blu.1'] });
  d = playOk(d, 0, 'domadraghi.1');
  assert.deepStrictEqual(P(d).opts.sort(), ['bacio_del_drago.1', 'travestito.1']);
  d = pick(d, 0, 'travestito.1');
  assert.ok(has(d.hand[0], 'travestito.1'));
  var a = mk({ exp: DR, hands: { 0: ['alchimista.1'] }, deck: ['bacio_del_drago.1', 'mela.1', 'blu.1'] });
  a = playOk(a, 0, 'alchimista.1');
  assert.deepStrictEqual(P(a).opts.sort(), ['bacio_del_drago.1', 'mela.1']);
  var t = mk({ exp: DR, hands: { 0: ['dragotartaruga.1'] }, top: ['verde.1'] });
  t = playOk(t, 0, 'dragotartaruga.1');
  assert.ok(has(t.hand[0], 'verde.1'));
});

test('Unicorno Drago: quando lascia la stalla (anche se rimandato in mano) chi l\'aveva può distruggere un unicorno', () => {
  var s = mk({ exp: DR, hands: { 0: ['zoccolata.1'], 1: ['rosso.2'] }, stables: { 0: ['blu.1'], 1: ['unicorno_drago.1'] } });
  s = playOk(s, 0, 'zoccolata.1');
  assert.ok(has(s.hand[1], 'unicorno_drago.1'), 'l\'unica carta da rimandare in mano si sceglie da sola');
  s = pick(s, 1, 'rosso.2');
  assert.strictEqual(P(s).s, 1);
  assert.strictEqual(P(s).op, 'distruggi');
  s = pick(s, 1, 'blu.1');
  assert.ok(has(s.discard, 'blu.1'));
  var t = mk({ exp: DR, hands: { 0: ['mela.1'] }, stables: { 0: ['rosso.1'], 1: ['unicorno_drago.1'] } });
  t = playOk(t, 0, 'mela.1');
  assert.strictEqual(P(t).s, 1);
  t = pick(t, 1, 'rosso.1');
  assert.ok(has(t.discard, 'rosso.1') && has(t.discard, 'unicorno_drago.1'));
  assert.strictEqual(t.log.filter(function (e) { return e.t === 'distrutta'; }).length, 2, 'scatta una volta sola');
});

test('Dragocorno Amichevole: ognuno pesca una carta, in ordine di turno (finché ce ne sono)', () => {
  var s = mk({ exp: DR, hands: { 0: ['dragocorno_amico.1'] }, deck: ['rosso.1', 'verde.1', 'verde.2', 'verde.3'] });
  s = playOk(s, 0, 'dragocorno_amico.1');
  assert.ok(has(s.hand[0], 'verde.3') && has(s.hand[1], 'verde.2') && has(s.hand[2], 'verde.1'));
  var t = mk({ exp: DR, hands: { 0: ['dragocorno_amico.1', 'blu.1'] }, deck: ['verde.1', 'verde.2'], max: 2 });
  t = playOk(t, 0, 'dragocorno_amico.1');
  assert.ok(has(t.hand[0], 'verde.2') && has(t.hand[1], 'verde.1') && !t.hand[2].length);
  assert.strictEqual(t.status, 'playing', 'il mazzo vuoto non fa finire la partita a metà effetto');
});

test('Alito di drago, Fuoco di drago, Bacio del drago, Stalle bruciate dal drago', () => {
  var s = mk({ exp: DR, hands: { 0: ['alito_di_drago.1'] }, stables: { 1: ['blu.1'] } });
  s = playOk(s, 0, 'alito_di_drago.1');
  assert.ok(has(s.discard, 'blu.1'));
  var f = mk({ exp: DR, hands: { 0: ['fuoco_di_drago.1'] }, stables: { 0: ['raffreddore.1'], 1: ['doppietta.1'] } });
  f = pick(playOk(f, 0, 'fuoco_di_drago.1'), 0, 'doppietta.1');
  assert.ok(has(f.discard, 'doppietta.1') && has(f.stable[0], 'raffreddore.1'));
  var b = mk({ exp: DR, hands: { 0: ['bacio_del_drago.1'] }, stables: { 1: ['blu.1'] }, deck: ['mela.1', 'rosso.1', 'verde.1'] });
  b = playOk(b, 0, 'bacio_del_drago.1');
  assert.ok(last(b, 'cercata') && last(b, 'gioca').c === 'mela.1', 'la Magia trovata si gioca subito');
  b = passa(b);
  assert.ok(has(b.discard, 'blu.1') && has(b.discard, 'mela.1'));
  var r = mk({ exp: DR, hands: { 0: ['stalle_bruciate.1'] }, stables: { 0: ['raffreddore.1', 'blu.1'], 1: ['doppietta.1'] }, discard: ['rosso.1'] });
  r = playOk(r, 0, 'stalle_bruciate.1');
  assert.ok(has(r.discard, 'raffreddore.1') && has(r.discard, 'doppietta.1') && has(r.stable[0], 'blu.1'));
  assert.ok(has(r.discard, 'rosso.1') && !last(r, 'mescola'), 'gli scarti non si rimescolano');
});

test('Benedizione del drago: i Malus della tua stalla non hanno effetto', () => {
  var s = mk({ exp: DR, stables: { 0: ['benedizione_drago.1', 'flash.1', 'paladino.1', 'raffreddore.1'] } });
  assert.ok(K.attivo(s, 0, 'paladino.1'), 'il Flash abbagliante non spegne gli unicorni');
  assert.ok(K.nitrisce(s, 0), 'col Raffreddore si nitrisce lo stesso');
  var m = mk({ exp: DR, stables: { 0: ['benedizione_drago.1', 'maledizione_drago.1'] }, hands: { 0: ['blu.1'] } });
  m = alTurno(m, 0);
  assert.strictEqual(m.phase, 'azione', 'la Maledizione non chiede niente');
  assert.ok(has(m.hand[0], 'blu.1'));
  var o = mk({ exp: ['draghi', 'incubi'], stables: { 0: ['benedizione_drago.1', 'incubo_occupato.1'] } });
  assert.ok(K.puoVincere(o, 0));
  var z = mk({ exp: ['draghi', 'leggende'], hands: { 0: ['blu.1'], 1: ['rosso.1'] }, stables: { 0: ['benedizione_drago.1', 'maleficio.1'] } });
  z = play(z, 0, 'blu.1');
  assert.ok(has(z.stable[0], 'maleficio.1'), 'il Maleficio senza effetto non passa di mano');
});

test('Fortuna del drago (un altro turno), Protezione del drago (scarti invece di perdere la carta distrutta)', () => {
  var s = mk({ exp: DR, stables: { 0: ['fortuna_drago.1'] }, top: ['verde.1'] });
  s = alTurno(s, 0);
  assert.ok(P(s).may);
  s = pick(s, 0, 'fortuna_drago.1');
  assert.ok(has(s.discard, 'fortuna_drago.1'));
  assert.strictEqual(s.extra, 1);
  var p = mk({ exp: DR, hands: { 0: ['mela.1'], 1: ['rosso.1'] }, stables: { 1: ['protezione_drago.1', 'blu.1'] } });
  p = playOk(p, 0, 'mela.1');
  assert.strictEqual(P(p).kind, 'scelta');
  assert.strictEqual(P(p).con, 'protezione_drago');
  p = ans(p, 1, { pick: 'scarta' });
  assert.ok(has(p.stable[1], 'blu.1') && has(p.discard, 'rosso.1'));
  assert.strictEqual(last(p, 'salvata').con, 'protezione_drago');
  // solo per le carte distrutte: per un sacrificio niente
  var q = mk({ exp: DR, hands: { 1: ['rosso.1'] }, stables: { 1: ['protezione_drago.1', 'blu.1', 'rito_oscuro.1'] } });
  q = alTurno(q, 1);
  assert.ok(P(q).must.length);
  q = pick(q, 1, 'rito_oscuro.1');
  assert.ok(has(q.discard, 'blu.1'), 'il sacrificio non si evita');
});

test('Maledizione, Sfortuna e Cieli dei draghi (inizio del turno, obbligatori)', () => {
  var s = mk({ exp: DR, hands: { 0: ['blu.1', 'rosso.1'] }, stables: { 0: ['maledizione_drago.1'] } });
  s = alTurno(s, 0);
  assert.deepStrictEqual(P(s).must, ['maledizione_drago.1']);
  assert.ok(!P(s).may);
  s = pick(pick(s, 0, 'maledizione_drago.1'), 0, 'rosso.1');
  assert.ok(has(s.discard, 'rosso.1'));
  var f = mk({ exp: DR, hands: { 0: ['blu.1', 'rosso.1'] }, stables: { 0: ['sfortuna_drago.1'] } });
  f = pick(pick(alTurno(f, 0), 0, 'sfortuna_drago.1'), 0, 'rosso.1');
  assert.strictEqual(f.deck[0], 'rosso.1', 'la carta va in fondo al mazzo');
  assert.ok(!has(f.hand[0], 'rosso.1'));
  var c = mk({ exp: DR, stables: { 0: ['cieli_dei_draghi.1', 'blu.1', 'cucciolo_rosso.1'] }, top: ['verde.1', 'verde.2'] });
  c = pick(pick(alTurno(c, 0), 0, 'cieli_dei_draghi.1'), 0, 'blu.1');
  assert.strictEqual(c.deck[0], 'blu.1');
  assert.ok(has(c.hand[0], 'verde.1') && has(c.hand[0], 'verde.2'), 'una carta per i Cieli e una per la pesca');
  var d = mk({ exp: DR, stables: { 0: ['cieli_dei_draghi.1', 'cucciolo_rosso.1'] }, top: ['verde.1', 'verde.2'] });
  d = pick(alTurno(d, 0), 0, 'cieli_dei_draghi.1');
  assert.ok(has(d.nursery, 'cucciolo_rosso.1'), 'un Cucciolo torna nel Nido');
  assert.deepStrictEqual(d.hand[0], ['verde.1'], 'e allora non si pesca la carta in più');
});

/* ---------- Diluvio arcobaleno ---------- */
var DI = ['diluvio'];
test('Unicorno Angelo, Fertilissimo, della Morte, Zombi (inizio del turno)', () => {
  var s = mk({ exp: DI, stables: { 0: ['angelo.1'] }, discard: ['rosso.1'], top: ['verde.1'] });
  s = pick(pick(alTurno(s, 0), 0, 'angelo.1'), 0, 'rosso.1');
  assert.ok(has(s.stable[0], 'rosso.1') && has(s.discard, 'angelo.1'));
  var a = mk({ exp: DI, stables: { 0: ['angelo.1'] }, top: ['verde.1'] });
  a = alTurno(a, 0);
  a = pick(a, 0, 'angelo.1');
  assert.ok(has(a.stable[0], 'angelo.1'), 'l\'Angelo sacrificato può tornare lui stesso');
  var f = mk({ exp: DI, hands: { 0: ['mela.1'] }, stables: { 0: ['fertile.1'] }, top: ['verde.1'] });
  f = pick(pick(alTurno(f, 0), 0, 'fertile.1'), 0, 'mela.1');
  assert.strictEqual(P(f).op, 'nido');
  f = pick(f, 0, P(f).opts[0]);
  assert.strictEqual(f.stable[0].filter(function (c) { return K.kind(c) === 'cucciolo'; }).length, 1);
  var m = mk({ exp: DI, stables: { 0: ['morte.1', 'blu.1'], 1: ['rosso.1'] }, top: ['verde.1'] });
  m = pick(pick(alTurno(m, 0), 0, 'morte.1'), 0, 'blu.1');
  assert.ok(has(m.discard, 'blu.1') && has(m.discard, 'rosso.1'));
  var z = mk({ exp: DI, hands: { 0: ['blu.1', 'mela.1'] }, stables: { 0: ['zombi.1'] }, discard: ['paladino.1'], top: ['verde.1'] });
  z = pick(pick(alTurno(z, 0), 0, 'zombi.1'), 0, 'blu.1');
  assert.strictEqual(P(z).op, 'rianima');
  z = pick(z, 0, 'paladino.1');
  assert.ok(has(z.stable[0], 'paladino.1'));
  assert.ok(!has(z.hand[0], 'verde.1'), 'niente pesca: il turno finisce subito');
  assert.strictEqual(z.turn, 1);
});

test('Alpacorno Zucchero Filato, Bulldocorno, Unicorno della Pestilenza: sacrifici e scarti per tutti', () => {
  var s = mk({ exp: DI, hands: { 0: ['alpacorno_zucchero.1'] }, stables: { 0: ['blu.1'], 1: ['rosso.1'], 2: [] }, top: ['verde.1', 'verde.2', 'verde.3'] });
  s = playOk(s, 0, 'alpacorno_zucchero.1');
  assert.strictEqual(P(s).kind, 'ogni');
  s = pick(s, 0, 'blu.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'rosso.1'));
  assert.ok(has(s.hand[0], 'verde.1') && has(s.hand[1], 'verde.2'), 'chi ha sacrificato pesca');
  assert.strictEqual(s.hand[2].length, 0, 'chi non aveva unicorni non pesca');
  var b = mk({ exp: DI, hands: { 0: ['bulldog.1'], 1: ['mela.1'], 2: ['blu.1'] } });
  b = playOk(b, 0, 'bulldog.1');
  assert.deepStrictEqual(P(b).opts.sort(), ['blu.1', 'mela.1']);
  b = pick(b, 0, 'mela.1');
  assert.ok(has(b.hand[0], 'mela.1') && has(b.discard, 'blu.1'));
  var p = mk({ exp: DI, hands: { 0: ['pestilenza.1', 'mela.1', 'mela.2', 'blu.1'], 1: ['rosso.1', 'rosso.2', 'rosso.3'], 2: ['verde.1'] } });
  p = playOk(p, 0, 'pestilenza.1');
  assert.ok(P(p).may && P(p).n === 3);
  p = pick(p, 0, ['mela.1', 'mela.2']);
  p = pick(p, 1, ['rosso.1', 'rosso.3']);
  assert.ok(has(p.hand[1], 'rosso.2') && has(p.discard, 'rosso.1') && has(p.discard, 'rosso.3'));
  assert.strictEqual(p.hand[2].length, 0, 'chi ne ha meno le scarta tutte');
});

test('Unicorno Brillantinato, Minuscolo, della Guerra, della Carestia; Zoccoletti', () => {
  var s = mk({ exp: DI, hands: { 0: ['brillantinato.1', 'doppietta.1'] } });
  s = pick(playOk(s, 0, 'brillantinato.1'), 0, 'doppietta.1');
  assert.ok(has(s.stable[0], 'doppietta.1'));
  var m = mk({ exp: DI, stables: { 0: ['morte.1', 'blu.1'], 1: ['minuscolo.1'] } });
  assert.ok(!K.distruggibile(m, 1, 'minuscolo.1', false, 'morte.1'), 'un unicorno non lo distrugge');
  assert.ok(K.distruggibile(m, 1, 'minuscolo.1', true, 'mela.1'), 'una Magia sì');
  var g = mk({ exp: DI, hands: { 0: ['guerra.1'] }, stables: { 0: ['blu.1'], 1: ['rosso.1'], 2: ['verde.1'] } });
  g = playOk(g, 0, 'guerra.1');
  assert.strictEqual(P(g).s, 0);
  g = pick(g, 0, 'rosso.1');
  assert.strictEqual(P(g).s, 1);
  assert.ok(!has(P(g).opts, 'guerra.1'), 'l\'Unicorno della Guerra non si distrugge');
  g = pick(g, 1, 'blu.1');
  assert.ok(!g.prompt || P(g).s !== 2, 'a G2 non resta niente da distruggere');
  assert.ok(has(g.discard, 'rosso.1') && has(g.discard, 'blu.1') && has(g.stable[0], 'guerra.1'));
  var c = mk({ exp: DI, stables: { 1: ['carestia.1'], 0: ['zoccoletti.1'] } });
  assert.strictEqual(K.limite(c, 2), 2);
  assert.strictEqual(K.limite(c, 0), 0);
});

test('Principessa Arcobaleno: peschi tante carte quanti giocatori scegli, e loro una a testa', () => {
  var s = mk({ exp: DI, hands: { 0: ['principessa.1'] }, deck: ['verde.1', 'verde.2', 'verde.3', 'giallo.1', 'rosso.1', 'rosso.2'] });
  s = playOk(s, 0, 'principessa.1');
  assert.strictEqual(P(s).kind, 'giocatori');
  assert.ok(/giocatori/.test(no(s, 0, { type: 'answer', targets: [0, 0], pid: P(s).id })));
  s = ans(s, 0, { targets: [0, 2] });
  assert.strictEqual(s.hand[0].length, 3, '2 carte per i giocatori scelti e 1 perché è scelta anche lei');
  assert.strictEqual(s.hand[2].length, 1);
  assert.strictEqual(s.hand[1].length, 1, 'G1 pesca solo all\'inizio del suo turno');
});

test('Attacco di tenerezza, Spruzzino della giovinezza, Peste nera', () => {
  var s = mk({ exp: DI, hands: { 0: ['attacco_tenero.1'] }, stables: { 1: ['blu.1', 'blu.2', 'blu.3', 'rosso.1'], 2: ['verde.1'] } });
  s = ans(playOk(s, 0, 'attacco_tenero.1'), 0, { target: 1 });
  assert.strictEqual(P(s).n, 3);
  s = pick(s, 0, ['blu.1', 'blu.2', 'blu.3']);
  assert.strictEqual(s.stable[1].filter(function (c) { return K.kind(c) === 'cucciolo'; }).length, 3);
  assert.ok(has(s.stable[1], 'rosso.1') && has(s.discard, 'blu.2'));
  var d = mk({ exp: DI, hands: { 0: ['attacco_tenero.1'] }, stables: { 1: ['blu.1', 'miciocorno.1'] } });
  d = ans(playOk(d, 0, 'attacco_tenero.1'), 0, { target: 1 });
  assert.strictEqual(d.stable[1].filter(function (c) { return K.kind(c) === 'cucciolo'; }).length, 1, 'il Miciocorno resta: un solo cucciolo');
  var y = mk({ exp: DI, hands: { 0: ['spruzzino.1'] }, stables: { 1: ['blu.1'], 2: ['rosso.1'] } });
  y = playOk(y, 0, 'spruzzino.1');
  assert.ok(has(y.discard, 'blu.1') && has(y.discard, 'rosso.1'));
  assert.strictEqual(P(y).s, 1);
  y = pick(y, 1, P(y).opts[0]);
  y = skip(y, 2);
  assert.strictEqual(y.stable[1].length, 1);
  assert.strictEqual(y.stable[2].length, 0);
  var n = mk({ exp: DI, hands: { 0: ['peste_nera.1'] }, stables: { 0: ['raffreddore.1'], 1: ['miciocorno.1', 'blu.1'] } });
  n = playOk(n, 0, 'peste_nera.1');
  n = pick(n, 0, ['raffreddore.1']);
  assert.ok(has(n.discard, 'blu.1') && has(n.stable[1], 'miciocorno.1'), 'la Peste nera è una Magia: il Miciocorno resta');
});

test('le Magie dell\'apocalisse e Gli unicorni dell\'apocalisse', () => {
  var s = mk({ exp: DI, hands: { 0: ['distruzione_totale.1'] }, stables: { 0: ['blu.1', 'blu.2'], 1: ['rosso.1'], 2: ['verde.1', 'verde.2'] }, deck: ['catastrofe.2', 'mela.1', 'giallo.1'] });
  s = playOk(s, 0, 'distruzione_totale.1');
  assert.ok(has(s.discard, 'blu.1') && has(s.discard, 'blu.2') && has(s.discard, 'rosso.1'));
  s = pick(s, 0, 'verde.2');
  assert.strictEqual(P(s).op, 'cerca');
  assert.deepStrictEqual(P(s).opts, ['catastrofe.2']);
  s = pick(s, 0, 'catastrofe.2');
  assert.ok(has(s.discard, 'verde.1'), 'l\'Unicorno Catastrofe entra e fa sacrificare un unicorno a tutti');
  assert.ok(has(s.discard, 'catastrofe.2'), 'anche lui, l\'unico di G0');
  assert.ok(/4 unicorni/.test(no(mk({ exp: DI, hands: { 0: ['unicorni_apocalisse.1'] }, stables: { 0: ['blu.1', 'blu.2', 'blu.3'] } }), 0, { type: 'play', card: 'unicorni_apocalisse.1' })));
  var u = mk({ exp: DI, hands: { 0: ['unicorni_apocalisse.1'] }, stables: { 0: ['blu.1', 'blu.2', 'blu.3', 'rosso.1'] }, deck: ['verde.1', 'verde.2', 'giallo.1', 'giallo.2', 'mela.1'] });
  u = playOk(u, 0, 'unicorni_apocalisse.1');
  for (var i = 0; i < 10 && P(u) && P(u).s === 0; i++) u = pick(u, 0, P(u).opts[0]);
  assert.strictEqual(u.stable[0].length, 4);
  assert.ok(['verde.1', 'verde.2', 'giallo.1', 'giallo.2'].every(function (c) { return has(u.stable[0], c); }));
});

test('Pisolino, Nitrito grazie!, Zuccherini arcobaleno, Consegna speciale', () => {
  var s = mk({ exp: DI, hands: { 0: ['pisolino.1'] }, top: ['verde.1', 'verde.2'] });
  s = ans(playOk(s, 0, 'pisolino.1'), 0, { target: 1 });
  assert.strictEqual(s.turn, 2, 'G1 dorme: tocca a G2');
  assert.ok(last(s, 'dorme'));
  var g = mk({ exp: DI, hands: { 0: ['mela.1'], 1: ['nitrito_grazie.1'] }, stables: { 2: ['blu.1'] }, top: ['verde.1', 'verde.2', 'verde.3'] });
  g = play(g, 0, 'mela.1');
  g = ans(g, 1, { cards: ['nitrito_grazie.1'] });
  g = passa(g);
  assert.ok(has(g.discard, 'mela.1') && has(g.stable[2], 'blu.1'));
  assert.ok(g.hand[0].length >= 1 && g.hand[1].length >= 1, 'pescano tutti e due');
  var z = mk({ exp: DI, stables: { 0: ['zuccherini.1'] }, top: ['verde.1', 'verde.2', 'verde.3', 'rosso.1'] });
  z = pick(alTurno(z, 0), 0, 'zuccherini.1');
  assert.strictEqual(z.hand[0].length, 3);
  assert.strictEqual(z.turn, 1, 'il turno finisce subito');
  var c = mk({ exp: DI, stables: { 0: ['consegna_speciale.1'] }, top: ['verde.1'] });
  c = alTurno(c, 0);
  c = pick(pick(c, 0, 'consegna_speciale.1'), 0, c.nursery[0]);
  assert.ok(has(c.hand[0], 'verde.1'), 'si pesca lo stesso');
  assert.strictEqual(c.turn, 1, 'ma niente fase delle azioni');
});

function partita(np, seed, lim, exp) {
  K._setRng(seeded(seed));
  var names = []; for (var i = 0; i < np; i++) names.push('G' + i);
  var s = K.startLocal(names, exp), rnd = seeded(seed * 31 + 7), moves = 0;
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
[[null, 'mazzo base'], [K.ESPANSIONI.filter(function (e) { return e.pronta && e.id !== 'base'; }).map(function (e) { return e.id; }), 'con tutte le espansioni']].forEach(function (x) {
  test('partite a caso da 2 a 8 giocatori (' + x[1] + '): nessuna carta persa, si finisce sempre', () => {
    var ended = 0, total = 0, why = {}, fuori = 0;
    for (var np = 2; np <= 8; np++) {
      for (var seed = 1; seed <= 25; seed++) {
        var r = partita(np, seed * 101 + np, 6000, x[0]);
        total++;
        fuori += (r.s.box || []).length;
        if (r.s.status === 'gameOver') { ended++; why[r.s.result.why] = (why[r.s.result.why] || 0) + 1; }
      }
    }
    assert.strictEqual(ended, total, 'partite non finite: ' + (total - ended));
    assert.ok(why.unicorni > 0);
    if (x[0] && x[0].indexOf('incubi') >= 0) assert.ok(fuori > 0, 'nessuna carta tolta dal gioco');
  });
});

console.log('✓ ' + passed + ' test del motore di Stalla Matta');
