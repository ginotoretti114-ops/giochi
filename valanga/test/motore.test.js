// Test del motore di Valanga: node valanga/test/motore.test.js
'use strict';
var assert = require('assert');
var K = require('../motore.js');

var tests = [];
function test(name, fn) { tests.push([name, fn]); }

// Una partita su misura: mani, carta in cima, colore, mazzo (l'ultima carta è la prossima pescata).
function mk(o) {
  o = o || {};
  var np = o.n || 3, s = K.startLocal(['A', 'B', 'C', 'D', 'E'].slice(0, np));
  var usate = {};
  var prendi = function (c) { usate[c] = 1; return c; };
  s.hand = {};
  for (var p = 0; p < np; p++) s.hand[p] = ((o.hands || {})[p] || []).map(prendi);
  var top = prendi(o.top || 'r5.1');
  var deck = (o.deck || []).map(prendi);
  s.discard = [top];
  s.parked = (o.parked || []).map(prendi);
  // il resto delle carte va in fondo al mazzo, sotto quelle scelte
  var resto = K.FULL.filter(function (c) { return !usate[c]; });
  if (o.deck && o.soloMazzo) resto.forEach(function (c) { s.discard.unshift(c); });
  else deck = resto.concat(deck);
  s.deck = deck;
  s.color = o.color || K.info(top).col || 'r';
  s.turn = o.turn || 0; s.dir = o.dir || 1; s.out = {}; s.fuori = [];
  s.pen = 0; s.penMin = 0; s.penDa = -1; s.forzata = null; s.prompt = null; s.unoP = null; s.unoDetto = false;
  return s;
}
function act(s, p, m) { var r = K.act(s, p, m); if (!r.ok) throw new Error(r.error + ' ' + JSON.stringify(m)); return r.state; }
function no(s, p, m) { var r = K.act(s, p, m); assert.ok(!r.ok, 'doveva essere rifiutata: ' + JSON.stringify(m)); return r.error; }
function play(s, p, c, extra) { var m = { type: 'play', card: c }; Object.keys(extra || {}).forEach(function (k) { m[k] = extra[k]; }); return act(s, p, m); }
function has(a, c) { return a.indexOf(c) >= 0; }
function totale(s) { var t = s.deck.length + s.discard.length + (s.parked || []).length; for (var p = 0; p < s.seats.length; p++) t += K.mano(s, p).length; return t; }
function last(s, t) { for (var i = s.log.length - 1; i >= 0; i--) if (s.log[i].t === t) return s.log[i]; return null; }

test('mazzo: 168 carte come l\'originale', () => {
  assert.strictEqual(K.FULL.length, 168);
  var by = {};
  K.FULL.forEach(function (c) { var I = K.info(c); by[I.k] = (by[I.k] || 0) + 1; });
  assert.deepStrictEqual(by, { n: 80, s: 12, i: 12, p2: 12, p4: 8, t: 12, x: 8, ji: 8, j6: 4, j10: 4, jr: 8 });
  assert.strictEqual(new Set(K.FULL).size, 168);
  assert.strictEqual(K.cardName('r7.2'), '7 rosso');
  assert.strictEqual(K.cardName('bp2.1'), 'Pesca 2 blu');
  assert.strictEqual(K.cardName('j10.3'), 'Jolly Pesca 10');
});

test('preparazione: 7 carte a testa, la prima carta è sempre un numero, gioca chi sta dopo il mazziere', () => {
  for (var i = 0; i < 40; i++) {
    var s = K.startLocal(['A', 'B', 'C', 'D']);
    for (var p = 0; p < 4; p++) assert.strictEqual(K.mano(s, p).length, 7);
    assert.strictEqual(K.info(K.top(s)).k, 'n');
    assert.strictEqual(s.color, K.info(K.top(s)).col);
    assert.strictEqual(s.turn, (s.dealer + 1) % 4);
    assert.strictEqual(totale(s), 168);
  }
});

test('si gioca sullo stesso colore, numero o simbolo, oppure un jolly', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['r9.1', 'b5.1', 'g7.1', 'gs.1', 'j6.1', 'jr.1'] } });
  assert.ok(K.giocabile(s, 'r9.1') && K.giocabile(s, 'b5.1') && K.giocabile(s, 'j6.1') && K.giocabile(s, 'jr.1'));
  assert.ok(!K.giocabile(s, 'g7.1') && !K.giocabile(s, 'gs.1'));
  assert.ok(/sopra/.test(no(s, 0, { type: 'play', card: 'g7.1' })));
  var t = mk({ top: 'rs.1', hands: { 0: ['gs.1'] } });
  assert.ok(K.giocabile(t, 'gs.1'), 'stesso simbolo');
  assert.ok(/colore/.test(no(s, 0, { type: 'play', card: 'j6.1' })), 'il jolly vuole il colore');
  s = play(s, 0, 'b5.1');
  assert.strictEqual(s.color, 'b');
  assert.strictEqual(s.turn, 1);
  assert.ok(/turno/.test(no(s, 0, { type: 'play', card: 'r9.1' })));
});

test('chi non può giocare pesca finché non trova una carta giocabile e la deve giocare', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['g7.1', 'b2.1'], 1: ['v1.1'] }, deck: ['r8.1', 'g3.1', 'b9.1'] });
  s = act(s, 0, { type: 'pesca' });
  assert.deepStrictEqual(K.mano(s, 0).slice(2), ['b9.1', 'g3.1', 'r8.1']);
  assert.strictEqual(s.forzata, 'r8.1');
  assert.strictEqual(s.turn, 0);
  assert.ok(/pescato/.test(no(s, 0, { type: 'play', card: 'g7.1' })));
  assert.ok(/pescato/.test(no(s, 0, { type: 'pesca' })));
  s = play(s, 0, 'r8.1');
  assert.strictEqual(s.turn, 1);
  var t = mk({ top: 'r5.1', hands: { 0: ['r1.1'] } });
  assert.ok(/pesca solo/.test(no(t, 0, { type: 'pesca' })), 'con una carta giocabile non si pesca');
});

test('le carte pesca si sommano con una di valore uguale o più alto, di qualsiasi colore', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['rp2.1', 'b1.1'], 1: ['bp2.1', 'g1.1'], 2: ['gp4.1', 'gp2.1', 'v1.1'] } });
  s = play(s, 0, 'rp2.1');
  assert.strictEqual(s.pen, 2); assert.strictEqual(s.turn, 1);
  assert.ok(!K.giocabile(s, 'g1.1'), 'durante la penalità solo carte pesca');
  s = play(s, 1, 'bp2.1');
  assert.strictEqual(s.pen, 4); assert.strictEqual(s.color, 'b');
  s = play(s, 2, 'gp4.1');
  assert.strictEqual(s.pen, 8); assert.strictEqual(s.penMin, 4); assert.strictEqual(s.turn, 0);
  assert.ok(!K.giocabile(s, 'gp2.1'), 'un Pesca 2 non va sopra un Pesca 4');
  var prima = K.mano(s, 0).length;
  s = act(s, 0, { type: 'pesca' });
  assert.strictEqual(K.mano(s, 0).length, prima + 8);
  assert.strictEqual(s.pen, 0);
  assert.strictEqual(s.turn, 1, 'chi pesca la penalità salta il turno');
  var j = mk({ top: 'r5.1', hands: { 0: ['j6.1', 'b1.1'], 1: ['j10.1', 'r1.1'], 2: ['bp4.1'] } });
  j = play(j, 0, 'j6.1', { color: 'v' });
  assert.ok(!K.giocabile(j, 'bp4.1'));
  j = play(j, 1, 'j10.1', { color: 'g' });
  assert.strictEqual(j.pen, 16); assert.strictEqual(j.color, 'g'); assert.strictEqual(j.turn, 2);
});

test('Jolly Inverti Pesca 4: cambia il senso e colpisce il prossimo nel nuovo senso; in due torna su chi lo gioca', () => {
  var s = mk({ n: 4, top: 'r5.1', turn: 1, hands: { 1: ['ji.1', 'r1.1'], 0: ['rp4.1', 'g2.2'] } });
  s = play(s, 1, 'ji.1', { color: 'b' });
  assert.strictEqual(s.dir, -1); assert.strictEqual(s.turn, 0); assert.strictEqual(s.pen, 4);
  s = play(s, 0, 'rp4.1');
  assert.strictEqual(s.turn, 3, 'la penalità continua nel nuovo senso');
  assert.strictEqual(s.pen, 8);
  var d = mk({ n: 2, top: 'r5.1', hands: { 0: ['ji.1', 'r1.1', 'b2.1'], 1: ['g3.1'] } });
  d = play(d, 0, 'ji.1', { color: 'r' });
  assert.strictEqual(d.turn, 0); assert.strictEqual(d.pen, 4);
  d = act(d, 0, { type: 'pesca' });
  assert.strictEqual(K.mano(d, 0).length, 6);
  assert.strictEqual(d.turn, 1);
});

test('Salta, Inverti, Salta tutti (anche in due)', () => {
  var s = mk({ n: 4, top: 'r5.1', hands: { 0: ['rs.1', 'b1.1'], 2: ['ri.1', 'g1.1'], 1: ['rx.1', 'v1.1', 'v2.1'] } });
  s = play(s, 0, 'rs.1');
  assert.strictEqual(s.turn, 2);
  s = play(s, 2, 'ri.1');
  assert.strictEqual(s.dir, -1); assert.strictEqual(s.turn, 1);
  s = play(s, 1, 'rx.1');
  assert.strictEqual(s.turn, 1, 'con Salta tutti rigioca');
  var d = mk({ n: 2, top: 'r5.1', hands: { 0: ['ri.1', 'rs.1', 'r1.1'], 1: ['g1.1'] } });
  d = play(d, 0, 'ri.1');
  assert.strictEqual(d.turn, 0, 'in due l\'Inverti fa da Salta');
  d = play(d, 0, 'rs.1');
  assert.strictEqual(d.turn, 0);
});

test('Scarta tutto: via tutte le carte del suo colore, e resta lei in cima', () => {
  var s = mk({ top: 'g5.1', hands: { 0: ['gt.1', 'g1.1', 'gs.2', 'b4.1', 'gp4.1'] } });
  s = play(s, 0, 'gt.1');
  assert.deepStrictEqual(K.mano(s, 0), ['b4.1']);
  assert.strictEqual(K.top(s), 'gt.1');
  assert.ok(has(s.discard, 'gp4.1') && has(s.discard, 'g1.1'));
  assert.strictEqual(s.pen, 0, 'le carte scartate insieme non fanno effetto');
  var v = mk({ top: 'g5.1', hands: { 0: ['gt.1', 'g1.1'] } });
  v = play(v, 0, 'gt.1');
  assert.strictEqual(v.status, 'gameOver');
  assert.strictEqual(v.result.winner, 0);
});

test('lo 0 fa passare tutte le mani avanti; il 7 scambia la mano con chi vuoi', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['r0.1', 'b1.1', 'b2.1'], 1: ['g1.1'], 2: ['v1.1', 'v2.1', 'v3.1', 'v4.1'] } });
  s = play(s, 0, 'r0.1');
  assert.deepStrictEqual(K.mano(s, 1), ['b1.1', 'b2.1']);
  assert.deepStrictEqual(K.mano(s, 2), ['g1.1']);
  assert.deepStrictEqual(K.mano(s, 0), ['v1.1', 'v2.1', 'v3.1', 'v4.1']);
  assert.strictEqual(s.turn, 1);
  var t = mk({ top: 'r5.1', hands: { 0: ['r7.1', 'b1.1', 'b2.1'], 1: ['g1.1'], 2: ['v1.1', 'v2.1'] } });
  assert.ok(/scambiare/.test(no(t, 0, { type: 'play', card: 'r7.1' })));
  assert.ok(/scambiare/.test(no(t, 0, { type: 'play', card: 'r7.1', target: 0 })));
  t = play(t, 0, 'r7.1', { target: 1 });
  assert.deepStrictEqual(K.mano(t, 0), ['g1.1']);
  assert.deepStrictEqual(K.mano(t, 1), ['b1.1', 'b2.1']);
  assert.strictEqual(t.turn, 1);
  var u = mk({ top: 'r5.1', hands: { 0: ['r7.1'], 1: ['g1.1'] } });
  u = play(u, 0, 'r7.1');
  assert.strictEqual(u.status, 'gameOver', 'col 7 come ultima carta si vince');
});

test('Jolly Roulette: chi la subisce sceglie il colore e scopre carte fino a quello (i jolly non contano)', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['jr.1', 'r1.1'], 1: ['g1.1'] }, deck: ['b2.1', 'g9.1', 'j6.1', 'r3.1'] });
  s = play(s, 0, 'jr.1');
  assert.deepStrictEqual(s.prompt, { kind: 'roulette', s: 1, da: 0 });
  assert.ok(/roulette/.test(no(s, 0, { type: 'play', card: 'r1.1' })));
  s = act(s, 1, { type: 'answer', color: 'g' });
  assert.deepStrictEqual(K.mano(s, 1), ['g1.1', 'r3.1', 'j6.1', 'g9.1']);
  assert.strictEqual(s.color, 'g');
  assert.strictEqual(s.turn, 2, 'chi la subisce salta il turno');
  assert.deepStrictEqual(last(s, 'roulette').cards, ['r3.1', 'j6.1', 'g9.1']);
});

test('con 25 carte si esce: le carte restano da parte fino al rimescolamento; l\'ultimo rimasto vince', () => {
  var molte = K.FULL.filter(function (c) { return K.info(c).col === 'v' && K.info(c).k === 'n'; }).slice(0, 18);
  var s = mk({ top: 'r5.1', hands: { 0: ['j10.1', 'r1.1'], 1: molte, 2: ['b1.1', 'b2.1'] } });
  s = play(s, 0, 'j10.1', { color: 'b' });
  s = act(s, 1, { type: 'pesca' });
  assert.ok(K.fuori(s, 1));
  assert.strictEqual(K.mano(s, 1).length, 0);
  assert.strictEqual(s.parked.length, 28);
  assert.deepStrictEqual(s.fuori, [1]);
  assert.strictEqual(last(s, 'sommerso').da, 0, 'merito di chi ha giocato il Pesca 10');
  assert.strictEqual(s.turn, 2);
  assert.strictEqual(totale(s), 168);
  var d = mk({ n: 2, top: 'r5.1', hands: { 0: ['j10.1', 'r1.1'], 1: molte } });
  d = play(d, 0, 'j10.1', { color: 'b' });
  d = act(d, 1, { type: 'pesca' });
  assert.strictEqual(d.status, 'gameOver');
  assert.deepStrictEqual([d.result.winner, d.result.why], [0, 'superstite']);
});

test('quando il mazzo finisce tornano gli scarti (non quello in cima) e le carte di chi è uscito', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['g7.1'], 1: ['b1.1'] }, deck: ['g1.1'], soloMazzo: true, parked: ['v1.1', 'v2.1'] });
  var scarti = s.discard.length;
  s = act(s, 0, { type: 'pesca' });
  assert.ok(last(s, 'rimescola'));
  assert.deepStrictEqual(s.discard, ['r5.1']);
  assert.strictEqual(s.parked.length, 0);
  assert.strictEqual(totale(s), 168);
  assert.ok(scarti > 1);
});

test('«Valanga!»: chi resta con una carta senza dirlo può essere beccato e pesca 2', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['r1.1', 'r2.1'], 1: ['g1.1', 'r3.1'], 2: ['b1.1'] } });
  s = play(s, 0, 'r1.1');
  assert.strictEqual(K.beccabile(s), 0);
  assert.ok(/te stesso/.test(no(s, 0, { type: 'becca', target: 0 })));
  var b = act(s, 2, { type: 'becca', target: 0 });
  assert.strictEqual(K.mano(b, 0).length, 3);
  assert.strictEqual(K.beccabile(b), -1);
  assert.strictEqual(b.turn, 1, 'il turno non cambia');
  var u = act(s, 0, { type: 'uno' });
  assert.strictEqual(K.beccabile(u), -1);
  assert.ok(/nessuno/.test(no(u, 2, { type: 'becca', target: 0 })));
  var c = act(s, 1, { type: 'play', card: 'r3.1' });
  assert.strictEqual(K.beccabile(c), 1, 'ora tocca a B: per A la finestra è chiusa');
  var d = mk({ top: 'r5.1', hands: { 0: ['r1.1', 'r2.1'], 1: ['g1.1'] } });
  d = play(d, 0, 'r1.1', { uno: true });
  assert.strictEqual(K.beccabile(d), -1, 'detto insieme alla carta');
  assert.ok(last(d, 'uno'));
});

test('vince chi gioca l\'ultima carta, anche se è una carta pesca', () => {
  var s = mk({ top: 'r5.1', hands: { 0: ['rp4.1'], 1: ['g1.1'] } });
  s = play(s, 0, 'rp4.1');
  assert.strictEqual(s.status, 'gameOver');
  assert.deepStrictEqual([s.result.winner, s.result.why], [0, 'mano']);
  assert.ok(/non è in corso/.test(no(s, 1, { type: 'pesca' })));
});

test('sala d\'attesa, bot e rivincita', () => {
  var s = K.newGame({ key: 'k1', name: 'Ada' });
  var r = K.join(s, 'k2', 'Bea'); assert.ok(r.ok); s = r.state;
  assert.ok(!K.join(s, 'k2', 'Bea').ok);
  r = K.addBot(s, 'medio', 'Grandine'); assert.ok(r.ok); s = r.state;
  assert.strictEqual(s.bots[2], 'medio');
  r = K.removeBot(s, 2); assert.ok(r.ok); s = r.state;
  assert.strictEqual(s.seats.length, 2);
  r = K.startGame(s); assert.ok(r.ok); s = r.state;
  assert.strictEqual(s.status, 'playing');
  assert.ok(!K.rematch(s).ok);
});

function partita(np, seed) {
  var x = seed >>> 0;
  K._setRng(function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; });
  var s = K.startLocal(['A', 'B', 'C', 'D', 'E', 'F'].slice(0, np)), guard = 0;
  while (s.status === 'playing' && guard++ < 4000) {
    var a = K.nextActor(s), mv = K.legalMoves(s, a);
    assert.ok(mv.length, 'nessuna mossa per ' + a);
    var m = mv[Math.floor((((seed * 7 + guard) * 2654435761) >>> 0) / 4294967296 * mv.length)];
    // ogni tanto qualcuno becca o dice «Valanga!»
    var b = K.beccabile(s);
    if (b >= 0 && guard % 3 === 0) { var q = (b + 1) % np; if (!K.fuori(s, q)) { s = act(s, q, { type: 'becca', target: b }); continue; } }
    s = act(s, a, m);
    assert.strictEqual(totale(s), 168);
    for (var p = 0; p < np; p++) assert.ok(K.fuori(s, p) || K.mano(s, p).length < K.LIMITE || s.status !== 'playing');
  }
  K._setRng(null);
  return s;
}
test('partite a caso da 2 a 8 giocatori: finiscono tutte e le carte sono sempre 168', () => {
  var why = {};
  for (var g = 0; g < 210; g++) {
    var s = partita(2 + g % 7, 1000 + g);
    assert.strictEqual(s.status, 'gameOver');
    why[s.result.why] = (why[s.result.why] || 0) + 1;
  }
  assert.ok(why.mano && why.superstite);
});

var fail = 0;
tests.forEach(function (t) {
  try { t[1](); }
  catch (e) { fail++; console.log('✗ ' + t[0] + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n   ') : e)); }
});
if (fail) { console.log(fail + ' test falliti su ' + tests.length); process.exit(1); }
console.log('✓ ' + tests.length + ' test del motore di Valanga');
