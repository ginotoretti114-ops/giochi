/* Test dei bot di Stalla Matta: i livelli più alti vincono più spesso, col mazzo base e con le espansioni pronte;
   tutte le partite finiscono.
   node stalla-matta/test/bot.test.js   (PARTITE=… per cambiare il numero di partite) */
'use strict';
var assert = require('assert');
var K = require('../motore.js');
var B = require('../bot.js');

function seeded(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function play(levels, seed, exp) {
  K._setRng(seeded(seed));
  var rnd = seeded(seed * 13 + 1);
  var s = K.startLocal(levels.map(function (l, i) { return l + i; }), exp);
  var guard = 0;
  while (s.status === 'playing' && guard++ < 6000) {
    var w = K.waitingFor(s), a = w[Math.floor(rnd() * w.length)];
    var m = B.mossa(s, a, levels[a], rnd);
    var r = K.act(s, a, m);
    if (!r.ok) throw new Error(levels[a] + ': ' + r.error + ' ' + JSON.stringify(m) + ' prompt ' + JSON.stringify(s.prompt));
    s = r.state;
  }
  return s;
}
var N = +process.env.PARTITE || 240;
function compare(a, b, exp, quante) {
  var st = {}; st[a] = { seats: 0, wins: 0 }; st[b] = { seats: 0, wins: 0 };
  var done = 0, turns = 0;
  for (var g = 0; g < quante; g++) {
    var np = 2 + (g % 4), lv = [];
    for (var i = 0; i < np; i++) lv.push((i + g) % 2 ? a : b);
    var s = play(lv, 20000 + g, exp);
    if (s.status !== 'gameOver') continue;
    done++; turns += s.result.turns;
    lv.forEach(function (l, p) { st[l].seats++; if (s.result.winners.indexOf(p) >= 0) st[l].wins++; });
  }
  return { a: st[a].wins / st[a].seats, b: st[b].wins / st[b].seats, done: done, turns: Math.round(turns / Math.max(1, done)) };
}
var out = [];
var MAZZI = [[null, 'mazzo base'], [K.ESPANSIONI.filter(function (e) { return e.pronta && e.id !== 'base'; }).map(function (e) { return e.id; }), 'con le espansioni']];
MAZZI.forEach(function (mz) {
  out.push(mz[1] + (mz[0] ? ' (' + mz[0].join(', ') + ')' : '') + ':');
  [['medio', 'facile'], ['difficile', 'facile'], ['difficile', 'medio']].forEach(function (pair) {
    // difficile e medio sono vicini (qualche punto): servono più partite perché il caso non inverta l'ordine
    var quante = pair[1] === 'medio' ? 2 * N : N;
    var r = compare(pair[0], pair[1], mz[0], quante);
    out.push('  ' + pair[0] + ' ' + Math.round(r.a * 100) + '% contro ' + pair[1] + ' ' + Math.round(r.b * 100) + '% (vittorie per posto, ' + r.done + '/' + quante + ' partite finite, ' + r.turns + ' turni in media)');
    assert.strictEqual(r.done, quante, 'tutte le partite finiscono');
    assert.ok(r.a > r.b, pair[0] + ' deve vincere più spesso di ' + pair[1] + ' (' + mz[1] + ')');
  });
  // tavoli grandi e tutti difficili: si finisce
  var why = {}, ok = 0;
  for (var g = 0; g < Math.round(N / 4); g++) {
    var np = 5 + (g % 4), lv = []; for (var i = 0; i < np; i++) lv.push('difficile');
    var s = play(lv, 50000 + g, mz[0]);
    if (s.status === 'gameOver') { ok++; why[s.result.why] = (why[s.result.why] || 0) + 1; }
  }
  assert.strictEqual(ok, Math.round(N / 4));
  out.push('  tutti difficili (5-8 giocatori): ' + JSON.stringify(why));
});
K._setRng(null);
console.log(out.join('\n'));
