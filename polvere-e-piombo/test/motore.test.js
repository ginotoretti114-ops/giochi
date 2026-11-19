/* Test del motore di Polvere e Piombo: node polvere-e-piombo/test/motore.test.js */
'use strict';
var assert = require('assert');
var K = require('../motore.js');

var passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error('✗ ' + name); throw e; } }
// Un tavolo preparato: personaggi 'x' senza abilità se non indicati, mazzo con le carte `deck` in cima (la prima esce per prima).
function mk(o) {
  o = o || {};
  var np = o.n || 4, names = [];
  for (var i = 0; i < np; i++) names.push('G' + i);
  var s = K.startLocal(names);
  s.role = o.roles || ['S', 'R', 'F', 'F', 'V', 'F', 'V'].slice(0, np);
  s.sheriff = s.role.indexOf('S');
  s.char = o.chars || names.map(function () { return 'x'; });
  s.hp = o.hp || names.map(function () { return 4; });
  s.max = o.max || s.hp.slice();
  s.alive = names.map(function (x, p) { return !(o.dead || []).includes(p); });
  s.hand = {}; s.table = {};
  for (i = 0; i < np; i++) { s.hand[i] = ((o.hands || {})[i] || []).slice(); s.table[i] = ((o.tables || {})[i] || []).slice(); }
  var used = {};
  Object.keys(s.hand).forEach(function (p) { s.hand[p].concat(s.table[p]).forEach(function (c) { used[c] = 1; }); });
  (o.deck || []).forEach(function (c) { used[c] = 1; });
  var filler = K.ALL.filter(function (c) { return !used[c] && /^(corriere|bottino|mercato|giro)/.test(c) === false && K.kindOf(c) === 'sparo'; });
  s.deck = filler.concat((o.deck || []).slice().reverse());
  s.discard = []; s.store = []; s.peek = [];
  s.turn = o.turn || 0; s.phase = 'play'; s.stack = []; s.prompt = null; s.bangs = 0; s.log = []; s.turnNo = 1;
  s.rep = names.map(function () { return 0; });
  s.status = 'playing'; s.result = null;
  return s;
}
function mv(s, p, m) { var r = K.act(s, p, m); if (!r.ok) throw new Error('mossa rifiutata: ' + r.error + ' ' + JSON.stringify(m)); return r.state; }
function shoot(s, p, c, t) { return mv(s, p, { type: 'play', c: c, target: t }); }
function pass(s, p) { return mv(s, p, { type: 'answer', pass: true }); }
function last(s, t) { for (var i = s.log.length - 1; i >= 0; i--) if (s.log[i].t === t) return s.log[i]; return null; }
var HEART = 'borraccia.1', DIAMOND = 'sparo.2', CLUB = 'sparo.15', SPADE_A = 'sparo.1', SPADE_2 = 'schivata.6';

test('mazzo: 80 carte, 20 per seme, 16 personaggi, ruoli giusti', () => {
  assert.strictEqual(K.ALL.length, 80);
  var by = {}, suit = {};
  K.ALL.forEach(function (c) { var m = K.info(c); by[m.k] = (by[m.k] || 0) + 1; suit[m.s] = (suit[m.s] || 0) + 1; });
  assert.deepStrictEqual(suit, { P: 20, Q: 20, F: 20, C: 20 });
  assert.deepStrictEqual([by.sparo, by.schivata, by.borraccia, by.borseggio, by.lazo, by.sfida, by.galera, by.revolver, by.rapida], [25, 12, 6, 4, 4, 3, 3, 3, 2]);
  assert.strictEqual(K.CHARS.length, 16);
  assert.deepStrictEqual(K.CHARS.filter(function (c) { return c.hp === 3; }).map(function (c) { return c.id; }).sort(), ['rancore', 'sfuggente']);
  assert.deepStrictEqual(K.ROLES_BY_N[7].slice().sort(), ['F', 'F', 'F', 'R', 'S', 'V', 'V']);
  assert.ok(K.info(HEART).s === 'C' && K.info(SPADE_2).s === 'P' && K.info(SPADE_2).r === '2' && K.info(SPADE_A).r === 'A');
});

test('inizio: lo Sceriffo ha un punto vita in più, tutti pescano quanto la vita, comincia lo Sceriffo', () => {
  for (var k = 4; k <= 7; k++) {
    var s = K.startLocal(Array.from({ length: k }, function (x, i) { return 'P' + i; }));
    var sh = s.role.indexOf('S');
    assert.strictEqual(s.turn, sh);
    s.role.forEach(function (r, p) { assert.strictEqual(s.max[p], K.CHAR[s.char[p]].hp + (r === 'S' ? 1 : 0)); });
    var total = s.deck.length + s.discard.length;
    Object.keys(s.hand).forEach(function (p) { total += s.hand[p].length + s.table[p].length; });
    assert.strictEqual(total + s.peek.length, 80);
    assert.ok(s.prompt || s.phase === 'play');
  }
});

test('distanze: il cerchio dei vivi, Cavallo e Sfuggente +1, Cannocchiale e Falco -1', () => {
  var s = mk({ n: 5 });
  assert.deepStrictEqual([K.dist(s, 0, 1), K.dist(s, 0, 2), K.dist(s, 0, 3), K.dist(s, 0, 4)], [1, 2, 2, 1]);
  s.table[2] = ['cavallo.1'];
  assert.strictEqual(K.dist(s, 0, 2), 3);
  s.table[0] = ['cannocchiale.1'];
  assert.strictEqual(K.dist(s, 0, 2), 2);
  assert.strictEqual(K.dist(s, 0, 1), 1, 'mai meno di 1');
  s.char[3] = 'sfuggente'; s.char[0] = 'falco';
  assert.strictEqual(K.dist(s, 0, 3), 1, '2 + 1 (Sfuggente) - 1 (Cannocchiale) - 1 (Falco)');
  s.table[0] = [];
  assert.strictEqual(K.dist(s, 0, 3), 2);
  s = mk({ n: 5, dead: [1] });
  assert.strictEqual(K.dist(s, 0, 2), 1, 'i morti non contano');
});

test('Sparo!: portata, uno per turno, Schivata!, Pistola rapida e Grilletto', () => {
  var s = mk({ hands: { 0: ['sparo.3', 'sparo.4'], 2: ['schivata.1'] } });
  assert.ok(/distanza 2/.test(K.validate(s, 0, { type: 'play', c: 'sparo.3', target: 2 })));
  s.table[0] = ['revolver.1'];
  s = shoot(s, 0, 'sparo.3', 2);
  assert.ok(s.prompt && s.prompt.kind === 'dodge' && s.prompt.s === 2);
  s = mv(s, 2, { type: 'answer', cards: ['schivata.1'] });
  assert.strictEqual(s.hp[2], 4);
  assert.strictEqual(K.validate(s, 0, { type: 'play', c: 'sparo.4', target: 1 }), 'Hai già sparato in questo turno.');
  s.table[0] = ['rapida.1'];
  assert.strictEqual(K.validate(s, 0, { type: 'play', c: 'sparo.4', target: 1 }), null);
  assert.ok(K.validate(s, 0, { type: 'play', c: 'sparo.4', target: 2 }), 'la pistola rapida arriva solo a 1');
  s.table[0] = []; s.char[0] = 'grilletto';
  s = shoot(s, 0, 'sparo.4', 1);
  assert.strictEqual(s.hp[1], 3, 'senza Schivata! il colpo arriva');
  assert.strictEqual(K.validate(s, 2, { type: 'play', c: 'schivata.1', target: 0 }), 'Non è il tuo turno.');
});

test('Botte e Bottaio: cuori annulla; il Bottaio con una Botte estrae due volte; il Macigno vuole due Schivata!', () => {
  var s = mk({ tables: { 1: ['botte.1'] }, hands: { 0: ['sparo.3'] }, deck: [HEART] });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.strictEqual(s.hp[1], 4);
  assert.strictEqual(last(s, 'miss').how, 'botte');
  s = mk({ tables: { 1: ['botte.1'] }, chars: ['x', 'bottaio', 'x', 'x'], hands: { 0: ['sparo.3'] }, deck: [CLUB, HEART] });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.strictEqual(s.hp[1], 4, 'seconda estrazione buona');
  s = mk({ tables: { 1: ['botte.1'] }, chars: ['macigno', 'x', 'x', 'x'], hands: { 0: ['sparo.3'], 1: ['schivata.1'] }, deck: [HEART] });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.ok(s.prompt && s.prompt.need === 1, 'la Botte vale una Schivata!');
  s = mv(s, 1, { type: 'answer', cards: ['schivata.1'] });
  assert.strictEqual(s.hp[1], 4);
  s = mk({ chars: ['macigno', 'x', 'x', 'x'], hands: { 0: ['sparo.3'], 1: ['schivata.1'] } });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.strictEqual(s.prompt, null, 'una Schivata! sola non basta: niente domanda');
  assert.strictEqual(s.hp[1], 3);
});

test('Gina Rovescio: Schivata! come Sparo! e viceversa', () => {
  var s = mk({ chars: ['rovescio', 'rovescio', 'x', 'x'], hands: { 0: ['schivata.1'], 1: ['sparo.5'] } });
  s = shoot(s, 0, 'schivata.1', 1);
  assert.ok(s.prompt && s.prompt.kind === 'dodge');
  s = mv(s, 1, { type: 'answer', cards: ['sparo.5'] });
  assert.strictEqual(s.hp[1], 4);
  assert.strictEqual(s.bangs, 1);
});

test('morire: la Borraccia salva (non in due), poi si è eliminati; i Fuorilegge danno 3 carte', () => {
  var s = mk({ n: 5, hp: [4, 1, 4, 4, 4], max: [4, 4, 4, 4, 4], hands: { 0: ['sparo.3'], 1: ['borraccia.2', 'borraccia.3'] } });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.ok(s.prompt && s.prompt.kind === 'dying' && s.prompt.need === 1, 'senza Schivata! non si chiede niente: si va subito a morire');
  s = mv(s, 1, { type: 'answer', beer: ['borraccia.2'] });
  assert.strictEqual(s.hp[1], 1);
  var t = mk({ n: 5, hp: [4, 4, 1, 4, 4], hands: { 0: ['sparo.3', 'revolver.1'] }, roles: ['S', 'V', 'F', 'F', 'R'] });
  t.table[0] = ['revolver.2'];
  t = shoot(t, 0, 'sparo.3', 2);
  assert.strictEqual(t.alive[2], false);
  assert.strictEqual(t.hand[0].length, 1 + 3, 'chi elimina un Fuorilegge pesca 3 carte');
  assert.strictEqual(last(t, 'dead').role, 'F');
  var u = mk({ n: 4, hp: [4, 1, 4, 4], dead: [2, 3], hands: { 0: ['sparo.3'], 1: ['borraccia.2'] }, roles: ['S', 'R', 'F', 'F'] });
  u = shoot(u, 0, 'sparo.3', 1);
  assert.strictEqual(u.status, 'gameOver', 'in due la Borraccia non salva: vince lo Sceriffo');
  assert.deepStrictEqual([u.result.team, u.result.winners], ['S', [0]]);
});

test('lo Sceriffo che elimina un Vice perde tutte le carte; il Becchino prende le carte dei morti', () => {
  var s = mk({ n: 5, hp: [4, 1, 4, 4, 4], roles: ['S', 'V', 'F', 'F', 'R'], hands: { 0: ['sparo.3', 'borraccia.1', 'lazo.1'], 1: ['corriere.1'] }, tables: { 0: ['botte.1', 'revolver.1'], 1: ['cavallo.1'] }, chars: ['x', 'x', 'becchino', 'x', 'x'] });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.strictEqual(s.alive[1], false);
  assert.deepStrictEqual([s.hand[0], s.table[0]], [[], []]);
  assert.deepStrictEqual(s.hand[2].slice().sort(), ['cavallo.1', 'corriere.1']);
});

test('fine partita: Fuorilegge, Rinnegato da solo, Sceriffo e Vice', () => {
  var s = mk({ n: 4, hp: [1, 4, 4, 4], roles: ['S', 'R', 'F', 'F'], turn: 3, hands: { 3: ['sparo.3'] } });
  s = shoot(s, 3, 'sparo.3', 0);
  assert.deepStrictEqual([s.result.team, s.result.winners], ['F', [2, 3]]);
  s = mk({ n: 4, hp: [1, 4, 4, 4], roles: ['S', 'R', 'F', 'F'], dead: [2, 3], turn: 1, hands: { 1: ['sparo.3'] } });
  s = shoot(s, 1, 'sparo.3', 0);
  assert.deepStrictEqual([s.result.team, s.result.winners], ['R', [1]]);
  s = mk({ n: 5, hp: [1, 4, 4, 4, 4], roles: ['S', 'V', 'F', 'F', 'R'], dead: [2, 3], turn: 4, hands: { 4: ['sparo.3'] } });
  s = shoot(s, 4, 'sparo.3', 0);
  assert.deepStrictEqual(s.result.team, 'F', 'il Rinnegato uccide lo Sceriffo ma c\'è ancora un Vice: vincono i Fuorilegge');
  s = mk({ n: 4, hp: [4, 1, 4, 4], roles: ['S', 'R', 'F', 'F'], dead: [2, 3], hands: { 0: ['sparo.3'] } });
  s = shoot(s, 0, 'sparo.3', 1);
  assert.deepStrictEqual([s.result.team, s.result.winners], ['S', [0]]);
});

test('Galera e Candelotto all\'inizio del turno', () => {
  var s = mk({ hands: { 0: ['galera.1'] } });
  assert.strictEqual(K.validate(s, 0, { type: 'play', c: 'galera.1', target: 0 }), 'Non puoi sceglierti da solo.');
  s.role = ['F', 'S', 'R', 'F']; s.sheriff = 1;
  assert.strictEqual(K.validate(s, 0, { type: 'play', c: 'galera.1', target: 1 }), 'Lo Sceriffo non va in Galera.');
  s = mv(s, 0, { type: 'play', c: 'galera.1', target: 2 });
  assert.deepStrictEqual(s.table[2], ['galera.1']);
  s.deck.push(CLUB, 'sparo.20', 'sparo.21', 'sparo.22', 'sparo.23'); // 1 pesca 2, poi 2 estrae fiori
  s = mv(s, 0, { type: 'end' });
  s = mv(s, 1, { type: 'end' });
  assert.ok(s.log.some(function (e) { return e.t === 'jailed' && e.s === 2; }));
  assert.strictEqual(s.turn, 3, 'salta il turno');
  assert.deepStrictEqual(s.table[2], []);
  var t = mk({ tables: { 0: ['candelotto.1'] }, deck: [SPADE_2] });
  t.turn = 3; t.stack = []; t.phase = 'play'; t.hand[3] = [];
  t = mv(t, 3, { type: 'end' });
  assert.strictEqual(t.hp[0], 1, 'esplode: 3 punti vita');
  assert.ok(last(t, 'boom'));
  var u = mk({ tables: { 0: ['candelotto.1'] }, deck: [SPADE_A] });
  u.turn = 3;
  u = mv(u, 3, { type: 'end' });
  assert.deepStrictEqual([u.hp[0], u.table[1]], [4, ['candelotto.1']], 'l\'asso di picche non esplode: passa al giocatore dopo');
  var w = mk({ chars: ['quadrifoglio', 'x', 'x', 'x'], tables: { 0: ['candelotto.1'] }, deck: [SPADE_2, HEART] });
  w.turn = 3;
  w = mv(w, 3, { type: 'end' });
  assert.strictEqual(w.hp[0], 4, 'Quadrifoglio scopre 2 carte e tiene la migliore');
});

test('Bisonti!, Raffica, Sfida, Mercato, Borseggio!, Lazo', () => {
  var s = mk({ hands: { 0: ['bisonti.1'], 1: ['sparo.3'], 2: ['schivata.1'], 3: [] } });
  s = mv(s, 0, { type: 'play', c: 'bisonti.1' });
  assert.ok(s.prompt && s.prompt.kind === 'bisonti' && s.prompt.s === 1);
  s = mv(s, 1, { type: 'answer', cards: ['sparo.3'] });
  assert.deepStrictEqual(s.hp, [4, 4, 3, 3], 'la Schivata! non serve contro i Bisonti!');
  s = mk({ hands: { 0: ['raffica.1'], 2: ['schivata.1'] } });
  s = mv(s, 0, { type: 'play', c: 'raffica.1' });
  assert.strictEqual(s.prompt.s, 2);
  s = mv(s, 2, { type: 'answer', cards: ['schivata.1'] });
  assert.deepStrictEqual(s.hp, [4, 3, 4, 3]);
  s = mk({ hands: { 0: ['sfida.1', 'sparo.3'], 2: ['sparo.4', 'sparo.5'] } });
  s = mv(s, 0, { type: 'play', c: 'sfida.1', target: 2 });
  assert.strictEqual(s.prompt.s, 2);
  s = mv(s, 2, { type: 'answer', cards: ['sparo.4'] });
  s = mv(s, 0, { type: 'answer', cards: ['sparo.3'] });
  s = mv(s, 2, { type: 'answer', cards: ['sparo.5'] });
  assert.strictEqual(s.hp[0], 3, 'chi finisce gli Sparo! perde');
  assert.strictEqual(s.bangs, 0, 'gli Sparo! della Sfida non contano');
  s = mk({ hands: { 0: ['mercato.1'] }, deck: ['borraccia.1', 'sparo.3', 'botte.1', 'lazo.1'] });
  s = mv(s, 0, { type: 'play', c: 'mercato.1' });
  assert.deepStrictEqual(s.prompt.opts.slice().sort(), ['borraccia.1', 'botte.1', 'lazo.1', 'sparo.3']);
  s = mv(s, 0, { type: 'answer', pick: 'botte.1' });
  assert.strictEqual(s.prompt.s, 1);
  s = mv(s, 1, { type: 'answer', pick: 'sparo.3' });
  s = mv(s, 2, { type: 'answer', pick: 'lazo.1' });
  assert.deepStrictEqual([s.hand[0], s.hand[3], s.store], [['botte.1'], ['borraccia.1'], []]);
  s = mk({ hands: { 0: ['borseggio.1', 'lazo.1'], 2: ['sparo.9'], 3: ['sparo.10'] }, tables: { 1: ['cavallo.1'] } });
  assert.ok(K.validate(s, 0, { type: 'play', c: 'borseggio.1', target: 2, pick: 'hand' }), 'il Borseggio! arriva solo a 1');
  assert.ok(K.validate(s, 0, { type: 'play', c: 'borseggio.1', target: 1, pick: 'cavallo.1' }), 'col Cavallo è a 2');
  s = mv(s, 0, { type: 'play', c: 'lazo.1', target: 1, pick: 'cavallo.1' });
  assert.deepStrictEqual(s.table[1], []);
  s = mv(s, 0, { type: 'play', c: 'borseggio.1', target: 3, pick: 'hand' });
  assert.deepStrictEqual([s.hand[0], s.hand[3]], [['sparo.10'], []]);
  assert.strictEqual(last(s, 'steal').c, null, 'la carta presa dalla mano resta segreta');
});

test('personaggi: Cerotto, Rancore, Fante Rosso, Mano Lesta, Zio Raccatta, Lina Veggente, Doc Erbetta, Mani Vuote', () => {
  var s = mk({ chars: ['x', 'cerotto', 'rancore', 'x'], hands: { 0: ['raffica.1', 'lazo.1', 'corriere.1'] } });
  s = mv(s, 0, { type: 'play', c: 'raffica.1' });
  assert.strictEqual(s.hand[1].length, 1, 'Cerotto pesca quando perde un punto vita');
  assert.strictEqual(s.hand[2].length, 1, 'Rancore prende una carta a chi gli ha sparato');
  assert.strictEqual(s.hand[0].length, 1);
  // pesca dei personaggi: si arriva al loro turno
  var f = mk({ chars: ['x', 'fante', 'x', 'x'], deck: ['sparo.3', HEART, 'sparo.4'] });
  f = mv(f, 0, { type: 'end' });
  assert.strictEqual(f.hand[1].length, 3, 'la seconda carta è di cuori: ne pesca un\'altra');
  var l = mk({ chars: ['x', 'lesta', 'x', 'x'], hands: { 3: ['botte.2'] } });
  l = mv(l, 0, { type: 'end' });
  assert.deepStrictEqual([l.prompt.kind, l.prompt.opts], ['lesta', [3]]);
  l = mv(l, 1, { type: 'answer', target: 3 });
  assert.ok(l.hand[1].indexOf('botte.2') >= 0 && l.hand[1].length === 2 && l.phase === 'play');
  var r = mk({ chars: ['x', 'raccatta', 'x', 'x'], hands: { 0: ['corriere.1'] } });
  r = mv(r, 0, { type: 'play', c: 'corriere.1' });
  r = mv(r, 0, { type: 'end' });
  r = mv(r, 1, { type: 'answer', yes: true });
  assert.ok(r.hand[1].indexOf('corriere.1') >= 0);
  var v = mk({ chars: ['x', 'veggente', 'x', 'x'], deck: ['sparo.3', 'botte.1', 'lazo.1'] });
  v = mv(v, 0, { type: 'end' });
  assert.deepStrictEqual(v.prompt.opts.slice().sort(), ['botte.1', 'lazo.1', 'sparo.3']);
  v = mv(v, 1, { type: 'answer', pick: 'sparo.3' });
  assert.deepStrictEqual([v.hand[1].slice().sort(), v.deck[v.deck.length - 1]], [['botte.1', 'lazo.1'], 'sparo.3']);
  var d = mk({ chars: ['erbetta', 'x', 'x', 'x'], hp: [2, 4, 4, 4], max: [4, 4, 4, 4], hands: { 0: ['lazo.1', 'corriere.1', 'sparo.3'] } });
  d = mv(d, 0, { type: 'heal', cards: ['lazo.1', 'corriere.1'] });
  assert.strictEqual(d.hp[0], 3);
  var dd = mk({ chars: ['x', 'erbetta', 'x', 'x'], hp: [4, 1, 4, 4], max: [4, 4, 4, 4], hands: { 0: ['sparo.3'], 1: ['lazo.1', 'corriere.1'] } });
  dd = shoot(dd, 0, 'sparo.3', 1);
  assert.strictEqual(dd.prompt.kind, 'dying');
  dd = mv(dd, 1, { type: 'answer', sid: ['lazo.1', 'corriere.1'] });
  assert.deepStrictEqual([dd.alive[1], dd.hp[1]], [true, 1]);
  var e = mk({ chars: ['vuote', 'x', 'x', 'x'], hands: { 0: ['corriere.1'] }, deck: [] });
  e = mv(e, 0, { type: 'play', c: 'corriere.1' });
  assert.strictEqual(e.hand[0].length, 2);
  var e2 = mk({ chars: ['vuote', 'x', 'x', 'x'], hands: { 0: ['botte.1'] } });
  e2 = mv(e2, 0, { type: 'play', c: 'botte.1' });
  assert.strictEqual(e2.hand[0].length, 1, 'Mani Vuote pesca appena resta senza carte');
});

test('fine turno: si scarta fino ad avere tante carte quanti punti vita', () => {
  var s = mk({ hp: [2, 4, 4, 4], hands: { 0: ['sparo.3', 'sparo.4', 'lazo.1', 'corriere.1'] } });
  s = mv(s, 0, { type: 'end' });
  assert.deepStrictEqual([s.prompt.kind, s.prompt.n], ['discard', 2]);
  s = mv(s, 0, { type: 'answer', cards: ['sparo.3', 'lazo.1'] });
  assert.deepStrictEqual(s.hand[0], ['sparo.4', 'corriere.1']);
  assert.strictEqual(s.turn, 1);
});

// ---------- partite a caso ----------
function seeded(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function census(s) {
  var all = s.deck.concat(s.discard, s.store || [], s.peek || []);
  Object.keys(s.hand).forEach(function (p) { all = all.concat(s.hand[p], s.table[p]); });
  return all;
}
var games = 0, moves = 0, ended = 0, teams = {}, turns = 0;
for (var g = 0; g < 300; g++) {
  K._setRng(seeded(4000 + g));
  var np = 4 + (g % 4);
  var s = K.startLocal(Array.from({ length: np }, function (x, i) { return 'P' + i; }));
  var rnd = seeded(91 + g), guard = 0;
  while (s.status === 'playing' && guard++ < 6000) {
    var a = K.nextActor(s);
    assert.ok(a >= 0, 'nessuno deve muovere');
    var ms = K.legalMoves(s, a);
    assert.ok(ms.length, 'nessuna mossa per ' + a);
    // gioca carte più spesso che passare il turno
    var m = ms[Math.floor(rnd() * ms.length)];
    if (m.type === 'end' && ms.length > 1 && rnd() < 0.7) m = ms[Math.floor(rnd() * (ms.length - 1))];
    var r = K.act(s, a, m);
    assert.ok(r.ok, r.error + ' ' + JSON.stringify(m));
    s = r.state;
    moves++;
    var c = census(s);
    assert.strictEqual(c.length, 80, 'le carte restano 80');
    assert.strictEqual(new Set(c).size, 80, 'nessuna carta doppia');
    s.hp.forEach(function (h, p) {
      var dying = s.prompt && s.prompt.kind === 'dying' && s.prompt.s === p;
      assert.ok(!s.alive[p] || dying || (h >= 1 && h <= s.max[p]), 'vita fuori misura: ' + p + ' ' + h + ' ' + JSON.stringify(s.prompt) + ' ' + JSON.stringify(s.log.slice(-4)));
    });
  }
  if (s.status === 'gameOver') { ended++; teams[s.result.team] = (teams[s.result.team] || 0) + 1; turns += s.turnNo; }
  games++;
}
K._setRng(null);
assert.ok(ended >= games * 0.97, 'quasi tutte le partite finiscono: ' + ended);
console.log('OK: ' + passed + ' scenari + ' + games + ' partite simulate (' + moves + ' mosse), finite ' + ended + ', vincitori ' + JSON.stringify(teams) + ', turni medi ' + Math.round(turns / Math.max(1, ended)));
