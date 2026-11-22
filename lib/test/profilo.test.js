// Collaudo di lib/profilo.js: node lib/test/profilo.test.js
'use strict';
const assert = require('assert');
const Profilo = require('../profilo.js');

function memoria() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m };
}
let adesso = new Date(2026, 10, 20, 15, 0, 0);
function nuovoDispositivo() { const st = memoria(); Profilo._prova({ store: st, ora: () => adesso }); return st; }
let n = 0;
function partita(gioco, opz) {
  opz = opz || {};
  n++;
  const s = {
    status: opz.status || 'gameOver', result: {}, mode: opz.mode || 'online', createdAt: 1000 + n, v: 50 + n,
    seats: new Array(opz.seats || 2).fill(0).map(() => ({})), bots: opz.bots || {}
  };
  const P = opz.P || { me: 0, seated: true, local: s.mode === 'local' };
  return { s, P, r: Profilo.osserva(gioco, s, P, { vinto: !!opz.vinto, eventi: opz.eventi }) };
}
const T = (nome, fn) => { fn(); console.log('ok  ' + nome); };

T('soglie e livelli', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5, 10].map(Profilo.soglia), [0, 100, 250, 450, 700, 2700]);
  assert.strictEqual(Profilo.livelloDi(0), 1);
  assert.strictEqual(Profilo.livelloDi(99), 1);
  assert.strictEqual(Profilo.livelloDi(100), 2);
  assert.strictEqual(Profilo.livelloDi(2699), 9);
  assert.strictEqual(Profilo.livelloDi(2700), 10);
});

T('vittoria contro bot difficili: esperienza piena e medaglie', () => {
  nuovoDispositivo();
  const { s, P, r } = partita('sette-stelle', { mode: 'bot', seats: 4, bots: { 1: 'difficile', 2: 'facile', 3: 'medio' }, vinto: true });
  assert.ok(r.xp >= 50, 'almeno 50 punti: ' + r.xp);
  const ids = r.medaglie.map((m) => m.id);
  ['prima-partita', 'prima-vittoria', 'vince-sette-stelle', 'computer'].forEach((id) => assert.ok(ids.includes(id), id));
  assert.strictEqual(Profilo.osserva('sette-stelle', s, P, { vinto: true }), null, 'la stessa partita non conta due volte');
  const rp = Profilo.riepilogo();
  assert.strictEqual(rp.partite, 1); assert.strictEqual(rp.vittorie, 1);
});

T('bot facili valgono meno, sconfitta 20 punti pieni solo online con persone', () => {
  nuovoDispositivo();
  const r1 = partita('diavolerie', { mode: 'bot', seats: 3, bots: { 1: 'facile', 2: 'facile' }, vinto: true }).r;
  const base = r1.xp - r1.sfide.length * 40 - (r1.tutte ? 60 : 0);
  assert.strictEqual(base, 25, 'vittoria contro bot facili: 25');
  nuovoDispositivo();
  const r2 = partita('piccante', { mode: 'online', seats: 4, vinto: false }).r;
  assert.strictEqual(r2.xp - r2.sfide.length * 40 - (r2.tutte ? 60 : 0), 20);
  assert.ok(r2.medaglie.some((m) => m.id === 'compagnia'), 'in compagnia');
  nuovoDispositivo();
  const r3 = partita('sette-stelle', { mode: 'online', seats: 3, bots: { 1: 'facile', 2: 'medio' }, vinto: true }).r;
  assert.strictEqual(r3.xp - r3.sfide.length * 40 - (r3.tutte ? 60 : 0), 38, 'stanza online con soli bot: conta il bot più forte (medio)');
  assert.ok(!r3.medaglie.some((m) => m.id === 'compagnia'));
});

T('sullo stesso telefono solo partecipazione', () => {
  nuovoDispositivo();
  const r = partita('gran-bazar', { mode: 'local', vinto: true, P: { me: 1, seated: true, local: true } }).r;
  assert.strictEqual(r.vinto, false);
  assert.strictEqual(r.xp - r.sfide.length * 40 - (r.tutte ? 60 : 0), 10);
  assert.strictEqual(Profilo.riepilogo().vittorie, 0);
});

T('chi guarda o partita non finita: niente', () => {
  nuovoDispositivo();
  assert.strictEqual(partita('sottozero', { P: { me: 0, seated: false } }).r, null);
  assert.strictEqual(partita('sottozero', { status: 'roundEnd' }).r, null);
  assert.strictEqual(partita('sette-stelle', { mode: 'online', P: { me: -1, seated: false } }).r, null);
  assert.strictEqual(Profilo.riepilogo().partite, 0);
});

T('ruoli di Polvere e Piombo e sette stelle', () => {
  nuovoDispositivo();
  const r = partita('polvere-e-piombo', { mode: 'bot', seats: 5, bots: { 1: 'medio', 2: 'medio', 3: 'medio', 4: 'medio' }, vinto: true, eventi: { 'vince-R': 1 } }).r;
  assert.ok(r.medaglie.some((m) => m.id === 'rinnegato'));
  const e = Profilo.evento('sette-stelle', 'sette', 'x:1');
  assert.ok(e.medaglie.some((m) => m.id === 'sette-stelle'));
  assert.strictEqual(Profilo.evento('sette-stelle', 'sette', 'x:1'), null, 'una volta per chiave');
});

T('sfide del giorno: tre, deterministiche, e si completano', () => {
  const a = Profilo.sfideDel('2026-11-20').map((c) => c.id), b = Profilo.sfideDel('2026-11-20').map((c) => c.id);
  assert.deepStrictEqual(a, b); assert.strictEqual(a.length, 3);
  const vari = new Set();
  for (let d = 1; d <= 28; d++) vari.add(Profilo.sfideDel('2026-02-' + String(d).padStart(2, '0')).map((c) => c.id).join());
  assert.ok(vari.size > 10, 'cambiano da un giorno all\'altro');
  nuovoDispositivo();
  // gioca finché le tre sfide di oggi sono fatte: vittorie online contro persone a ogni gioco, più una vittoria contro bot difficili
  const giochi = Profilo.GIOCHI.map((g) => g.id);
  let tot = 0, tutte = false;
  for (let i = 0; i < 12 && !tutte; i++) {
    const g = giochi[i % giochi.length];
    const r = i % 2 ? partita(g, { mode: 'online', seats: 3, vinto: true }).r : partita(g, { mode: 'bot', seats: 3, bots: { 1: 'difficile', 2: 'difficile' }, vinto: true }).r;
    tot += r.sfide.length; if (r.tutte) tutte = true;
    if (Profilo.riepilogo().sfide.some((c) => c.id === 'sette')) Profilo.evento('sette-stelle', 'sette', 'k' + i);
  }
  const rp = Profilo.riepilogo();
  assert.ok(rp.sfide.every((c) => c.presa), JSON.stringify(rp.sfide));
  assert.ok(rp.tutte);
  assert.ok(Profilo.riepilogo().medaglie.find((m) => m.id === 'tris').presa);
});

T('serie di sette giorni: medaglia Costante', () => {
  nuovoDispositivo();
  const inizio = new Date(2026, 10, 1, 18, 0, 0);
  for (let d = 0; d < 7; d++) {
    adesso = new Date(inizio.getTime() + d * 86400000);
    for (let k = 0; k < 4; k++) partita(Profilo.GIOCHI[k % 6].id, { mode: 'online', seats: 2, vinto: true });
  }
  const rp = Profilo.riepilogo();
  assert.ok(rp.serie >= 7, 'serie ' + rp.serie);
  assert.ok(rp.medaglie.find((m) => m.id === 'costante').presa);
  adesso = new Date(2026, 10, 20, 15, 0, 0);
});

T('unione di due dispositivi senza doppi conteggi', () => {
  const A = nuovoDispositivo();
  partita('gran-bazar', { vinto: true }); partita('sottozero', { vinto: false });
  const pa = JSON.parse(A._m[Profilo.KEY]);
  const B = nuovoDispositivo();
  partita('piccante', { vinto: true }); partita('piccante', { vinto: true }); partita('diavolerie', { mode: 'bot', seats: 2, bots: { 1: 'difficile' }, vinto: true });
  const pb = JSON.parse(B._m[Profilo.KEY]);
  const u = Profilo.unisci(pa, pb);
  const r = Profilo.riepilogo(u);
  assert.strictEqual(r.partite, 5); assert.strictEqual(r.vittorie, 4);
  const u2 = Profilo.unisci(u, pb), u3 = Profilo.unisci(pb, pa);
  assert.strictEqual(Profilo.riepilogo(u2).xp, r.xp, 'unire di nuovo non cambia niente');
  assert.strictEqual(Profilo.riepilogo(u3).xp, r.xp, 'l\'ordine non conta');
  ['prima-partita', 'prima-vittoria', 'computer'].forEach((id) => assert.ok(u.medaglie[id], id));
  // un dispositivo che continua a giocare dopo l'unione: vince la sua versione più recente
  B._m[Profilo.KEY] = JSON.stringify(u);
  partita('piccante', { vinto: false });
  const pb2 = JSON.parse(B._m[Profilo.KEY]);
  assert.strictEqual(Profilo.riepilogo(Profilo.unisci(u, pb2)).partite, 6);
});

T('memoria rovinata o assente', () => {
  const st = nuovoDispositivo();
  st.setItem(Profilo.KEY, '{"disp":[1,2],"giorni":"x","medaglie":null,"visti":7}');
  assert.strictEqual(Profilo.riepilogo().partite, 0);
  partita('sette-stelle', { mode: 'online', seats: 2, vinto: true });
  assert.strictEqual(Profilo.riepilogo().partite, 1);
  Profilo._prova({ store: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } } });
  assert.strictEqual(Profilo.riepilogo().partite, 0);
  assert.ok(partita('sette-stelle', { mode: 'online', seats: 2 }).r);
});

console.log('tutto bene');
