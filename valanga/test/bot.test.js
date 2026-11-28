// I bot di Valanga: finiscono tutte le partite e i livelli sono in ordine (difficile > medio > facile).
// node valanga/test/bot.test.js   (PARTITE=… per cambiare quante partite per confronto)
'use strict';
var assert = require('assert');
var K = require('../motore.js');
var B = require('../bot.js');
var N = +process.env.PARTITE || 300;

function seeded(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function partita(levels, seed) {
  K._setRng(seeded(seed));
  var rnd = seeded(seed * 31 + 7);
  var s = K.startLocal(levels.map(function (l, i) { return l + i; })), guard = 0;
  while (s.status === 'playing' && guard++ < 5000) {
    // chi è rimasto con una carta senza dirlo può essere beccato prima della mossa successiva
    var b = K.beccabile(s);
    if (b >= 0) {
      for (var q = 0; q < levels.length; q++) {
        var x = B.acchiappa(s, q, levels[q], rnd);
        if (x) { var rb = K.act(s, q, x); assert.ok(rb.ok, rb.error); s = rb.state; break; }
      }
    }
    var a = K.nextActor(s), m = B.mossa(s, a, levels[a], rnd);
    assert.ok(m, 'il bot non trova una mossa');
    var r = K.act(s, a, m);
    assert.ok(r.ok, levels[a] + ': ' + r.error + ' ' + JSON.stringify(m));
    s = r.state;
  }
  K._setRng(null);
  return { s: s, mosse: guard };
}
function confronta(a, b, quante) {
  var st = {}; st[a] = [0, 0]; st[b] = [0, 0];
  var finite = 0, mosse = 0;
  for (var g = 0; g < quante; g++) {
    var np = 2 + (g % 4), lv = [];
    for (var i = 0; i < np; i++) lv.push((i + g) % 2 ? a : b);
    var r = partita(lv, 50000 + g);
    if (r.s.status !== 'gameOver') continue;
    finite++; mosse += r.mosse;
    lv.forEach(function (l, p) { st[l][0]++; if (r.s.result.winner === p) st[l][1]++; });
  }
  return { a: st[a][1] / st[a][0], b: st[b][1] / st[b][0], finite: finite, mosse: Math.round(mosse / Math.max(1, finite)) };
}

var out = [];
[['medio', 'facile'], ['difficile', 'facile'], ['difficile', 'medio']].forEach(function (pair) {
  var quante = pair[1] === 'medio' ? 2 * N : N;
  var r = confronta(pair[0], pair[1], quante);
  out.push('  ' + pair[0] + ' ' + Math.round(r.a * 100) + '% contro ' + pair[1] + ' ' + Math.round(r.b * 100) + '% (vittorie per posto, ' + r.finite + '/' + quante + ' partite finite, ' + r.mosse + ' mosse in media)');
  assert.strictEqual(r.finite, quante, 'tutte le partite finiscono');
  assert.ok(r.a > r.b, pair[0] + ' deve battere ' + pair[1]);
});
// tavoli grandi tutti difficili: finiscono e si vince in tutti e due i modi
var why = {};
for (var g = 0; g < 60; g++) {
  var np = 5 + g % 4, r = partita(Array.apply(null, Array(np)).map(function () { return 'difficile'; }), 90000 + g);
  assert.strictEqual(r.s.status, 'gameOver');
  why[r.s.result.why] = (why[r.s.result.why] || 0) + 1;
}
out.push('  tutti difficili (5-8 giocatori): ' + JSON.stringify(why));
console.log(out.join('\n'));
console.log('✓ bot di Valanga');
