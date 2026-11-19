/* Test del motore di Sette Stelle: node sette-stelle/test/motore.test.js */
'use strict';
var assert = require('assert');
var K = require('../motore.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name); throw e; }
}
// Un round con il mazzo preparato: le carte di `next` escono in quest'ordine.
// Il mazziere è l'ultimo posto, quindi la prima carta va al posto 0 e il posto 0 gioca per primo.
function mk(np, next, opts) {
  opts = opts || {};
  var names = []; for (var i = 0; i < np; i++) names.push('G' + i);
  var s = K.startLocal(names);
  var filler = K.FULL.filter(function (c) { return next.indexOf(c) < 0 && /^n/.test(c); });
  s.deck = filler.concat(next.slice().reverse());
  s.discard = []; s.rows = {}; s.score = [];
  for (i = 0; i < np; i++) { s.rows[i] = []; s.score.push(0); }
  var D = opts.dealer == null ? np - 1 : opts.dealer;
  s.dealer = (D - 1 + np) % np; s.round = 0; s.phase = 'between'; s.prompt = null; s.ops = []; s.status = 'playing'; s.log = [];
  return mv(s, 0, { type: 'next' });
}
function mv(s, p, m) { var r = K.act(s, p, m); if (!r.ok) throw new Error('mossa rifiutata: ' + r.error + ' ' + JSON.stringify(m)); return r.state; }
function hit(s, p) { return mv(s, p, { type: 'hit' }); }
function stay(s, p) { return mv(s, p, { type: 'stay' }); }
function tgt(s, p, t) { return mv(s, p, { type: 'answer', target: t }); }
function sorted(a) { return a.slice().sort(function (x, y) { return x - y; }); }

test('mazzo: 94 carte, 79 numeri, 6 bonus, 9 azioni', () => {
  assert.strictEqual(K.FULL.length, 94);
  var c = {}; K.FULL.forEach(function (id) { var I = K.info(id); var k = I.t === 'num' ? 'n' + I.v : I.t; c[k] = (c[k] || 0) + 1; });
  assert.strictEqual(c.n0, 1); assert.strictEqual(c.n1, 1); assert.strictEqual(c.n7, 7); assert.strictEqual(c.n12, 12);
  var numsN = 0; for (var v = 0; v <= 12; v++) numsN += c['n' + v];
  assert.strictEqual(numsN, 79);
  assert.strictEqual(c.bonus, 5); assert.strictEqual(c.x2, 1); assert.strictEqual(c.act, 9);
  assert.strictEqual(new Set(K.FULL).size, 94, 'id tutte diverse');
});

test('distribuzione dalla sinistra del mazziere, lui per ultimo; poi tocca alla sua sinistra', () => {
  var s = mk(3, ['n5.1', 'n6.1', 'n7.1'], { dealer: 1 });
  assert.deepStrictEqual([s.rows[2], s.rows[0], s.rows[1]], [['n5.1'], ['n6.1'], ['n7.1']]);
  assert.strictEqual(s.phase, 'turn');
  assert.strictEqual(K.nextActor(s), 2);
  s = hit(s, 2);
  assert.strictEqual(K.nextActor(s), 0);
});

test('punti: numeri, Superluna che raddoppia solo i numeri, bonus e Sette Stelle', () => {
  var s = mk(2, ['n5.1', 'n6.1']);
  s.rows[0] = ['n5.1', 'n6.1', 'x2', 'b4']; s.st[0] = 'stay';
  assert.strictEqual(K.roundPoints(s, 0), (5 + 6) * 2 + 4);
  s.rows[1] = ['x2']; s.st[1] = 'stay';
  assert.strictEqual(K.roundPoints(s, 1), 0, 'la Superluna da sola non vale niente');
  s.rows[1] = ['b6']; assert.strictEqual(K.roundPoints(s, 1), 6, 'un bonus da solo vale');
  s.st[0] = 'bust';
  assert.strictEqual(K.roundPoints(s, 0), 0, 'chi sballa prende 0');
});

test('doppione: si sballa; il Desiderio salva una volta e se ne va col doppione', () => {
  var s = mk(2, ['n5.1', 'n9.1', 'n5.2']);
  s = hit(s, 0);
  assert.strictEqual(s.st[0], 'bust');
  assert.strictEqual(K.nextActor(s), 1);
  assert.ok(s.log.some(function (e) { return e.t === 'bust' && e.s === 0 && e.c === 'n5.2'; }));
  var t = mk(2, ['n3.1', 'n4.1', 'desiderio.1', 'n10.1', 'n3.2', 'n10.2', 'n3.3']);
  t = hit(t, 0);
  assert.strictEqual(K.wishOf(t, 0), 'desiderio.1');
  t = hit(t, 1);
  t = hit(t, 0); // n3.2: salvato
  assert.strictEqual(t.st[0], 'in');
  assert.strictEqual(K.wishOf(t, 0), null, 'il Desiderio è stato usato');
  assert.deepStrictEqual(K.nums(t, 0), [3]);
  assert.ok(t.discard.indexOf('n3.2') >= 0 && t.discard.indexOf('desiderio.1') >= 0);
  t = hit(t, 1); // n10.2: 1 sballa
  assert.strictEqual(t.st[1], 'bust');
  t = hit(t, 0); // n3.3: ora sballa
  assert.strictEqual(t.st[0], 'bust');
  assert.strictEqual(t.phase, 'between');
});

test('Sette Stelle: 7 numeri diversi chiudono il round con 15 punti; gli altri incassano', () => {
  var s = mk(2, ['n1.1', 'n12.1', 'n2.1', 'n11.1', 'n3.1', 'n10.1', 'n4.1', 'n9.1', 'n5.1', 'n8.1', 'n6.1', 'n7.1', 'n0.1']);
  for (var k = 0; k < 11; k++) s = hit(s, K.nextActor(s));
  assert.strictEqual(s.phase, 'between');
  assert.strictEqual(s.last.seven, 0);
  assert.deepStrictEqual(sorted(K.nums(s, 0)), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(s.last.pts, [21 + 15, 12 + 11 + 10 + 9 + 8 + 7]);
  assert.strictEqual(s.score[1], 57, 'chi è ancora in gioco incassa');
});

test('Gelo: chi lo riceve sceglie su chi giocarlo; il bersaglio incassa e si ferma', () => {
  var s = mk(3, ['n5.1', 'n6.1', 'n7.1', 'gelo.1', 'n8.1']);
  s = hit(s, 0);
  assert.ok(s.prompt && s.prompt.kind === 'target' && s.prompt.s === 0);
  assert.deepStrictEqual(s.prompt.opts, [0, 1, 2]);
  s = tgt(s, 0, 1);
  assert.strictEqual(s.st[1], 'frozen');
  assert.strictEqual(K.nextActor(s), 2, 'il turno salta chi è congelato');
  var e = s.log.filter(function (x) { return x.t === 'freeze'; })[0];
  assert.deepStrictEqual([e.s, e.to, e.pts], [0, 1, 6]);
  assert.strictEqual(K.validate(s, 1, { type: 'hit' }), 'Non è il tuo turno.');
});

test('Pioggia di stelle: 3 carte di fila, le azioni aspettano la fine, ci si ferma se si sballa', () => {
  var s = mk(3, ['n5.1', 'n6.1', 'n7.1', 'pioggia.1', 'n9.1', 'gelo.1', 'n10.1', 'n11.1']);
  s = hit(s, 0);
  s = tgt(s, 0, 1);
  assert.deepStrictEqual(sorted(K.nums(s, 1)), [6, 9, 10]);
  assert.ok(s.prompt && s.prompt.s === 1 && s.prompt.a === 'gelo', 'ora il Gelo messo da parte');
  s = tgt(s, 1, 0);
  assert.strictEqual(s.st[0], 'frozen');
  assert.strictEqual(K.nextActor(s), 1, 'dopo la mossa di 0 tocca a 1');
  var u = mk(3, ['n5.1', 'n6.1', 'n7.1', 'pioggia.1', 'gelo.1', 'n5.2', 'n11.1']);
  u = hit(u, 0);
  u = tgt(u, 0, 0);
  assert.strictEqual(u.st[0], 'bust');
  assert.strictEqual(u.prompt, null, 'il Gelo messo da parte si scarta');
  assert.ok(u.discard.indexOf('gelo.1') >= 0);
  assert.ok(u.deck.indexOf('n11.1') >= 0, 'la terza carta non si pesca');
  assert.strictEqual(K.nextActor(u), 1);
});

test('Desiderio pescato durante la Pioggia si usa subito; il secondo si regala', () => {
  var s = mk(3, ['n9.1', 'n6.1', 'n7.1', 'pioggia.1', 'desiderio.1', 'n9.2', 'n4.1']);
  s = hit(s, 0);
  s = tgt(s, 0, 0);
  assert.strictEqual(s.st[0], 'in', 'il Desiderio pescato prima lo salva dal 9');
  assert.ok(s.discard.indexOf('desiderio.1') >= 0 && s.discard.indexOf('n9.2') >= 0);
  assert.deepStrictEqual(sorted(K.nums(s, 0)), [4, 9]);
  var u = mk(3, ['n5.1', 'n6.1', 'n7.1', 'desiderio.1', 'n8.1', 'n10.1', 'desiderio.2']);
  u = hit(u, 0); u = hit(u, 1); u = hit(u, 2);
  u = hit(u, 0);
  assert.ok(u.prompt && u.prompt.a === 'desiderio' && u.prompt.s === 0);
  assert.deepStrictEqual(u.prompt.opts, [1, 2]);
  u = tgt(u, 0, 2);
  assert.strictEqual(K.wishOf(u, 2), 'desiderio.2');
  var w = mk(2, ['n5.1', 'n6.1', 'desiderio.1', 'desiderio.2', 'desiderio.3']);
  w = hit(w, 0); w = hit(w, 1); w = hit(w, 0);
  assert.strictEqual(w.prompt, null, 'nessuno può riceverlo: si scarta');
  assert.ok(w.discard.indexOf('desiderio.3') >= 0);
});

test('azione nella prima distribuzione: si risolve e poi si continua a dare carte', () => {
  var s = mk(3, ['gelo.1', 'n5.1', 'n6.1', 'n7.1']);
  assert.ok(s.prompt && s.prompt.s === 0 && s.prompt.a === 'gelo');
  s = tgt(s, 0, 2);
  assert.strictEqual(s.st[2], 'frozen');
  assert.deepStrictEqual([s.rows[0], s.rows[1], s.rows[2]], [[], ['n5.1'], ['gelo.1']], 'chi è congelato non riceve la sua carta');
  assert.strictEqual(K.nextActor(s), 0);
  assert.strictEqual(K.validate(s, 0, { type: 'stay' }), 'Per fermarti devi avere almeno una carta davanti.');
  s = hit(s, 0);
  assert.deepStrictEqual(s.rows[0], ['n6.1']);
  // Pioggia nella distribuzione: chi la subisce riceve comunque la sua carta dopo
  var t = mk(3, ['pioggia.1', 'n1.1', 'n2.1', 'n3.1', 'n4.1', 'n5.1']);
  t = tgt(t, 0, 2);
  assert.deepStrictEqual(sorted(K.nums(t, 2)), [1, 2, 3, 5]);
  assert.deepStrictEqual(t.rows[1], ['n4.1']);
});

test('fine round, round dopo e vittoria a 200 (in parità si continua)', () => {
  var s = mk(2, ['n12.1', 'n11.1']);
  s.score = [190, 150];
  s = stay(s, 0); s = stay(s, 1);
  assert.strictEqual(s.status, 'gameOver');
  assert.strictEqual(s.result.winner, 0);
  assert.deepStrictEqual(s.result.score, [202, 161]);
  var t = mk(2, ['n12.1', 'n11.1']);
  t.score = [188, 189];
  t = stay(t, 0); t = stay(t, 1);
  assert.strictEqual(t.status, 'playing', 'parità in testa: si gioca ancora');
  assert.strictEqual(t.phase, 'between');
  assert.strictEqual(K.nextActor(t), -1);
  var dealer = t.dealer;
  t = mv(t, 1, { type: 'next' });
  assert.strictEqual(t.dealer, (dealer + 1) % 2, 'il mazzo passa a sinistra');
  assert.strictEqual(t.round, 2);
  assert.ok(t.discard.indexOf('n12.1') >= 0 && t.discard.indexOf('n11.1') >= 0, 'le carte del round finiscono negli scarti');
});

test('mazzo finito: si rimescolano solo gli scarti, le carte sul tavolo restano', () => {
  var s = mk(2, ['n12.1', 'n11.1']);
  s.discard = s.deck.filter(function (c) { return c !== 'n4.1'; }).slice(0, 20); s.deck = [];
  s = hit(s, 0);
  assert.ok(s.log.some(function (e) { return e.t === 'reshuffle'; }));
  assert.strictEqual(s.rows[0][0], 'n12.1');
  assert.strictEqual(s.rows[1][0], 'n11.1');
});

// ---------- partite a caso ----------
function seeded(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function census(s) {
  var all = s.deck.concat(s.discard);
  Object.keys(s.rows).forEach(function (p) { all = all.concat(s.rows[p]); });
  (s.ops || []).forEach(function (op) { if (op.c) all.push(op.c); all = all.concat(op.q || []); });
  if (s.prompt) all.push(s.prompt.c);
  return all;
}
var games = 0, moves = 0, rounds = 0, sevens = 0, busts = 0;
for (var g = 0; g < 400; g++) {
  K._setRng(seeded(1000 + g));
  var np = 2 + (g % 7);
  var s = K.startLocal(Array.from({ length: np }, function (x, i) { return 'P' + i; }));
  var rnd = seeded(77 + g), guard = 0;
  while (s.status === 'playing' && guard++ < 20000) {
    var a = K.nextActor(s);
    var who = a >= 0 ? a : Math.floor(rnd() * np);
    var ms = K.legalMoves(s, who);
    assert.ok(ms.length, 'nessuna mossa per ' + who + ' in ' + s.phase);
    var m = ms[Math.floor(rnd() * ms.length)];
    if (ms.length === 2 && ms[1].type === 'stay') m = K.roundPoints(s, who) > 25 + rnd() * 20 ? ms[1] : ms[0];
    var r = K.act(s, who, m);
    assert.ok(r.ok, r.error);
    var before = s;
    s = r.state;
    moves++;
    var c = census(s);
    assert.strictEqual(c.length, 94, 'le carte restano 94 (round ' + s.round + ')');
    assert.strictEqual(new Set(c).size, 94, 'nessuna carta doppia');
    if (before.phase !== 'between' && (s.phase === 'between' || s.status === 'gameOver')) rounds++;
  }
  assert.strictEqual(s.status, 'gameOver', 'partita ' + g + ' non finita');
  assert.ok(s.result.score[s.result.winner] >= 200);
  sevens += s.log.filter(function (e) { return e.t === 'seven'; }).length;
  busts += s.log.filter(function (e) { return e.t === 'bust'; }).length;
  games++;
}
K._setRng(null);
console.log('OK: ' + passed + ' scenari + ' + games + ' partite simulate (' + moves + ' mosse, ' + rounds + ' round)');
