/* Test dei bot di Sette Stelle: il livello più alto deve vincere più spesso.
   node sette-stelle/test/bot.test.js   (PARTITE=… per cambiare il numero di partite per sfida) */
'use strict';
var assert = require('assert');
var K = require('../motore.js');
var B = require('../bot.js');

function seeded(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function play(levels, seed) {
  K._setRng(seeded(seed));
  var rnd = seeded(seed * 7 + 3);
  var s = K.startLocal(levels.map(function (l, i) { return l + i; }));
  var guard = 0;
  while (s.status === 'playing' && guard++ < 30000) {
    var a = K.nextActor(s), who = a >= 0 ? a : 0;
    var m = B.mossa(s, who, levels[who], rnd);
    var r = K.act(s, who, m);
    if (!r.ok) throw new Error(levels[who] + ': ' + r.error + ' ' + JSON.stringify(m));
    s = r.state;
  }
  return s.status === 'gameOver' ? s.result.winner : -1;
}
var N = +process.env.PARTITE || 300;
function duel(a, b) {
  var wins = 0, done = 0;
  for (var g = 0; g < N; g++) {
    var lv = g % 2 ? [a, b, b] : [b, a, b];
    var me = g % 2 ? 0 : 1;
    var w = play(lv, 5000 + g);
    if (w >= 0) done++;
    if (w === me) wins++;
  }
  return { rate: wins / N, done: done };
}
var out = [];
[['medio', 'facile'], ['difficile', 'facile'], ['difficile', 'medio']].forEach(function (pair) {
  var r = duel(pair[0], pair[1]);
  out.push(pair[0] + ' contro due ' + pair[1] + ': ' + Math.round(r.rate * 100) + '%');
  assert.strictEqual(r.done, N, 'tutte le partite finiscono');
  assert.ok(r.rate > 0.36, pair[0] + ' deve vincere più di un terzo delle partite contro due ' + pair[1] + ' (' + r.rate + ')');
});
var tally = { facile: 0, medio: 0, difficile: 0 };
for (var g = 0; g < N; g++) {
  var lv = ['facile', 'medio', 'difficile', 'medio'];
  var rot = g % 4; lv = lv.slice(rot).concat(lv.slice(0, rot));
  var w = play(lv, 9000 + g);
  if (w >= 0) tally[lv[w]]++;
}
K._setRng(null);
console.log(out.join('\n'));
console.log('in quattro (facile, 2 medi, difficile):', JSON.stringify(tally));
