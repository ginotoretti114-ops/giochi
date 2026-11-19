/* Test dei bot di Polvere e Piombo: i livelli più alti vincono più spesso (a parità di ruoli, che sono a caso).
   node polvere-e-piombo/test/bot.test.js   (PARTITE=… per cambiare il numero di partite) */
'use strict';
var assert = require('assert');
var K = require('../motore.js');
var B = require('../bot.js');

function seeded(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function play(levels, seed) {
  K._setRng(seeded(seed));
  var rnd = seeded(seed * 13 + 1);
  var s = K.startLocal(levels.map(function (l, i) { return l + i; }));
  var guard = 0;
  while (s.status === 'playing' && guard++ < 8000) {
    var a = K.nextActor(s);
    var m = B.mossa(s, a, levels[a], rnd);
    var r = K.act(s, a, m);
    if (!r.ok) throw new Error(levels[a] + ' (' + s.role[a] + '): ' + r.error + ' ' + JSON.stringify(m) + ' prompt ' + JSON.stringify(s.prompt));
    s = r.state;
  }
  return s;
}
var N = +process.env.PARTITE || 300;
function compare(a, b) {
  var st = {}; st[a] = { seats: 0, wins: 0 }; st[b] = { seats: 0, wins: 0 };
  var done = 0;
  for (var g = 0; g < N; g++) {
    var np = 4 + (g % 4), lv = [];
    for (var i = 0; i < np; i++) lv.push((i + g) % 2 ? a : b);
    var s = play(lv, 20000 + g);
    if (s.status !== 'gameOver') continue;
    done++;
    lv.forEach(function (l, p) { st[l].seats++; if (s.result.winners.indexOf(p) >= 0) st[l].wins++; });
  }
  return { a: st[a].wins / st[a].seats, b: st[b].wins / st[b].seats, done: done };
}
var out = [];
[['medio', 'facile'], ['difficile', 'facile'], ['difficile', 'medio']].forEach(function (pair) {
  var r = compare(pair[0], pair[1]);
  out.push(pair[0] + ' ' + Math.round(r.a * 100) + '% contro ' + pair[1] + ' ' + Math.round(r.b * 100) + '% (vittorie per posto, ' + r.done + '/' + N + ' partite finite)');
  assert.ok(r.done >= N * 0.97, 'quasi tutte le partite finiscono');
  assert.ok(r.a > r.b, pair[0] + ' deve vincere più spesso di ' + pair[1]);
});
// le squadre: con tutti bot difficili nessun ruolo deve essere imbattibile
var teams = { S: 0, F: 0, R: 0 }, turns = 0, ok = 0;
for (var g = 0; g < N; g++) {
  var np = 4 + (g % 4), lv = []; for (var i = 0; i < np; i++) lv.push('difficile');
  var s = play(lv, 50000 + g);
  if (s.status === 'gameOver') { teams[s.result.team]++; turns += s.turnNo; ok++; }
}
K._setRng(null);
console.log(out.join('\n'));
console.log('tutti difficili: vincono Sceriffo e Vice ' + teams.S + ', Fuorilegge ' + teams.F + ', Rinnegato ' + teams.R + ' su ' + ok + '; turni medi ' + Math.round(turns / ok));
