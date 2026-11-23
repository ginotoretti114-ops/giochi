/* Valanga: i giocatori del computer (facile, medio, difficile).
   Guardano solo quello che vede chiunque al tavolo: la propria mano, quante carte hanno gli altri e gli scarti.
   - facile: gioca una carta qualsiasi, risponde alle carte pesca solo a volte e ogni tanto si scorda di dire «Valanga!»;
   - medio: sceglie la carta con qualche criterio (colori che gli restano, chi sta per vincere, chi è vicino alle 25 carte);
   - difficile: in più tiene le carte pesca per difendersi, conta le carte uscite per la roulette e punta chi è in testa. */
(function (root) {
  'use strict';
  var K = root.Valanga || (typeof require === 'function' ? require('./motore.js') : null);

  function argmax(a, f) { var b = null, bv = -Infinity; a.forEach(function (x) { var v = f(x); if (v > bv) { bv = v; b = x; } }); return b; }
  function quante(s, p) { return K.mano(s, p).length; }
  function perColore(cards) {
    var c = { r: 0, g: 0, v: 0, b: 0 };
    cards.forEach(function (x) { var I = K.info(x); if (I.col) c[I.col]++; });
    return c;
  }
  function coloreMigliore(cards) { var c = perColore(cards); return argmax(K.COLORI, function (k) { return c[k]; }); }
  function pescaInMano(cards) { return cards.filter(function (x) { return K.info(x).pen > 0; }).length; }

  // Quanto conviene colpire q: tanto se sta per vincere, tantissimo se la penalità lo porta a 25 carte.
  function bersaglio(s, me, q, pen, lv) {
    if (q === me) return -12 - pen * 2;
    var h = quante(s, q), v = 0;
    if (h + pen >= K.LIMITE) v += 30;
    if (h <= 2) v += 10; else if (h <= 4) v += 4;
    if (lv === 'difficile') {
      var meno = Math.min.apply(null, K.attivi(s).filter(function (x) { return x !== me; }).map(function (x) { return quante(s, x); }));
      if (h === meno) v += 3;   // chi è più vicino a vincere
    }
    return v;
  }

  function valore(s, me, m, lv) {
    var h = K.mano(s, me);
    if (m.type === 'pesca') {
      if (s.pen > 0) return (h.length + s.pen >= K.LIMITE ? -200 : 0) - s.pen * 3;
      return -5;
    }
    var c = m.card, I = K.info(c), resto = h.filter(function (x) { return x !== c; });
    var dir = s.dir, nx = K.dopo(s, me, dir), due = K.attivi(s).length === 2;
    var v = 10;
    // poter giocare anche dopo: quante carte mi restano del colore che lascio in cima
    var col = I.jolly ? (m.color || null) : I.col;
    if (col) v += 1.2 * perColore(resto)[col];
    if (I.jolly && lv !== 'facile') v -= lv === 'difficile' ? 8 : 4;   // i jolly sono preziosi: meglio tenerli se c'è altro
    if (s.pen > 0) {   // rispondo alla penalità: la mando avanti
      var dopoMe = I.k === 'ji' ? (due ? me : K.dopo(s, me, -dir)) : nx;
      return 40 + s.pen + bersaglio(s, me, dopoMe, s.pen + I.pen, lv) - (I.pen - s.penMin) * 0.5;
    }
    switch (I.k) {
      case 'p2': case 'p4': case 'j6': case 'j10':
        v += bersaglio(s, me, nx, I.pen, lv) + I.pen * 0.6;
        if (lv === 'difficile' && pescaInMano(h) <= 2 && quante(s, nx) > 4) v -= 7;   // le tengo per difendermi
        break;
      case 'ji': {
        var t = due ? me : K.dopo(s, me, -dir);
        v += bersaglio(s, me, t, 4, lv) + 2;
        if (lv === 'difficile' && pescaInMano(h) <= 2 && !due) v -= 5;
        break;
      }
      case 's': v += due ? 6 : bersaglio(s, me, nx, 0, lv) * 0.6 + 2; break;
      case 'x': v += 5 + (resto.some(function (x) { return K.info(x).jolly || perColore([x])[I.col]; }) ? 3 : 0); break;
      case 'i': {
        var prima = K.dopo(s, me, -dir);
        v += due ? 6 : (quante(s, prima) > quante(s, nx) ? 2 : -1);
        break;
      }
      case 't': v += 5 * perColore(resto)[I.col]; break;
      case 'jr': v += 4 + bersaglio(s, me, nx, 3, lv) * 0.5; break;
      case 'n':
        if (I.v === 0) {
          var da = K.dopo(s, me, -dir);   // ricevo la mano di chi mi sta prima
          v += 3 * ((resto.length) - quante(s, da));
        } else if (I.v === 7 && m.target != null) {
          v += 3 * (resto.length - quante(s, m.target)) + (quante(s, m.target) <= 2 ? 8 : 0);
        }
        v += I.v * 0.05;
        break;
    }
    return v;
  }

  // La roulette: il colore che ha più carte ancora da uscire (difficile), altrimenti uno a caso.
  function coloreRoulette(s, me, lv, rnd) {
    if (lv !== 'difficile') return K.COLORI[Math.floor(rnd() * 4)];
    var visti = perColore(s.discard.concat(K.mano(s, me)));
    return argmax(K.COLORI, function (k) { return 36 - visti[k] + rnd() * 0.5; });
  }

  function mossa(s, me, lv, rnd) {
    rnd = rnd || Math.random;
    var mv = K.legalMoves(s, me);
    if (!mv.length) return null;
    if (s.prompt) return { type: 'answer', color: coloreRoulette(s, me, lv, rnd) };
    var h = K.mano(s, me), m;
    // il colore dei jolly: quello che ho di più
    mv = mv.filter(function (x) {
      if (x.type !== 'play' || !x.color) return true;
      return x.color === coloreMigliore(h.filter(function (y) { return y !== x.card; })) || lv === 'facile';
    });
    if (lv === 'facile') {
      var giochi = mv.filter(function (x) { return x.type === 'play'; });
      if (s.pen > 0 && rnd() < 0.4) giochi = [];
      m = giochi.length ? giochi[Math.floor(rnd() * giochi.length)] : mv.filter(function (x) { return x.type === 'pesca'; })[0] || mv[0];
    } else {
      var rumore = lv === 'difficile' ? 0.01 : 4;   // il difficile non tira a caso
      m = argmax(mv, function (x) { return valore(s, me, x, lv) + rnd() * rumore; });
    }
    m = JSON.parse(JSON.stringify(m));
    if (m.uno && lv === 'facile' && rnd() < 0.25) delete m.uno;   // si scorda di dirlo
    return m;
  }

  // Becca chi è rimasto con una carta senza dire «Valanga!» (il bot se ne accorge più o meno spesso).
  function acchiappa(s, me, lv, rnd) {
    rnd = rnd || Math.random;
    var b = K.beccabile(s);
    if (b < 0 || b === me || K.fuori(s, me)) return null;
    var p = { facile: 0.25, medio: 0.6, difficile: 0.9 }[lv] || 0.5;
    return rnd() < p ? { type: 'becca', target: b } : null;
  }

  var api = { mossa: mossa, acchiappa: acchiappa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ValangaBot = api;
})(typeof window !== 'undefined' ? window : this);
