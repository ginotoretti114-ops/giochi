/* Collaudo dei bot di Diavolerie: mosse sempre valide e livelli in ordine di forza.
   node diavolerie/test/bot.test.js        (PARTITE=400 per stime più precise) */
'use strict';
const assert = require('assert');
const K = require('../motore.js');
const B = require('../bot.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(99);
K._setRng(mulberry32(7));
const N = +(process.env.PARTITE || 160);
function play(levels) {
  let s = K.startLocal(levels.map((l, i) => l + i));
  let guard = 0;
  while (s.status === 'playing' && s.turnNo < 500) {
    const a = K.nextActor(s);
    const mv = B.mossa(s, a, levels[a], rnd);
    assert.ok(mv, 'il bot non sa cosa fare');
    const r = K.act(s, a, mv);
    assert.ok(r.ok, levels[a] + ' ' + JSON.stringify(mv) + ': ' + r.error);
    s = r.state;
    if (++guard > 30000) throw new Error('partita infinita');
  }
  return s;
}
function duel(a, b) {
  let wa = 0, done = 0, turns = 0;
  for (let g = 0; g < N; g++) {
    const levels = g % 2 ? [a, b] : [b, a]; // si alterna chi siede per primo
    const s = play(levels);
    if (s.status !== 'gameOver') continue;
    done++; turns += s.turnNo;
    if (levels[s.result.winner] === a) wa++;
  }
  return { rate: wa / done, done, turns: turns / done };
}
const out = {};
for (const [a, b] of [['medio', 'facile'], ['difficile', 'facile'], ['difficile', 'medio']]) {
  const r = duel(a, b);
  out[a + ' contro ' + b] = `${(r.rate * 100).toFixed(0)}% (${r.done}/${N} finite, ${r.turns.toFixed(0)} turni)`;
  assert.ok(r.done >= N * 0.97, 'troppe partite senza fine');
  assert.ok(r.rate > 0.55, `${a} dovrebbe battere ${b}: ${(r.rate * 100).toFixed(0)}%`);
}
// a quattro: un bot per livello più un medio
let wins = { facile: 0, medio: 0, difficile: 0 };
for (let g = 0; g < N / 2; g++) {
  const lv = K.shuffle(['facile', 'medio', 'difficile', 'medio']);
  const s = play(lv);
  if (s.status === 'gameOver') wins[lv[s.result.winner]]++;
}
console.log('OK bot:', out);
console.log('a quattro (vittorie):', wins);
