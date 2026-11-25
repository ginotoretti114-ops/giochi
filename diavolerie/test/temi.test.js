/* Collaudo dei disegni dei temi: ogni carta ha il suo disegno in ogni tema con i disegni, e l'SVG è ben formato.
   node diavolerie/test/temi.test.js */
'use strict';
const assert = require('assert');
const K = require('../motore.js');
const T = require('../temi.js');

// Controllo dei tag: ogni elemento aperto viene chiuso, nell'ordine giusto.
function benFormato(svg) {
  const pila = [];
  const re = /<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(svg))) {
    if (m[3]) continue;
    if (m[1]) { assert.strictEqual(pila.pop(), m[2], 'tag chiuso male: ' + m[2]); } else pila.push(m[2]);
  }
  assert.deepStrictEqual(pila, [], 'tag rimasti aperti: ' + pila.join(', '));
}

const carte = [].concat(K.BLOCK, K.DEMONS, K.CANDLES);
const temi = T.TEMI.filter((t) => t.disegni).map((t) => t.id);
assert.ok(temi.length >= 2, 'servono almeno due temi con i disegni');
assert.strictEqual(T.arte(K.info('fido'), 'notte'), '', 'il tema Notte usa le emoji');

let n = 0;
temi.forEach((tema) => {
  carte.forEach((c) => {
    const svg = T.arte(K.info(c.id), tema);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), c.id + ' in ' + tema + ': niente disegno');
    assert.ok(!/undefined|NaN|\{|\}/.test(svg), c.id + ' in ' + tema + ': valore mancante');
    benFormato(svg);
    n++;
  });
});
// animali e demoni hanno ognuno il suo disegno (niente disegno di ripiego)
K.BLOCK.filter((c) => c.k === 'A').forEach((c) => assert.ok(T.ANIMALI[c.id], 'manca il disegno di ' + c.id));
K.DEMONS.forEach((c) => assert.ok(T.DEMONI[c.id], 'manca il disegno di ' + c.id));
// i bambini non sono tutti uguali: almeno 3 pettinature diverse tra le bambine e tra i bambini
['G', 'B'].forEach((k) => {
  const visti = new Set(K.BLOCK.filter((c) => c.k === k).map((c) => T.arte(c, 'vecchia').replace(/<circle[^>]*>/g, '').slice(0, 400)));
  assert.ok(visti.size >= 3, 'bambini troppo simili (' + k + ')');
});
console.log('✓ ' + n + ' disegni in ' + temi.length + ' temi');
