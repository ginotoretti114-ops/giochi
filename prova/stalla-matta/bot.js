/* Stalla Matta: i giocatori del computer.
   StallaBot.mossa(stato, posto, livello, rnd) restituisce una mossa per il motore (anche per le scelte fatte
   insieme agli altri, come il Nitrito). Il bot usa solo quello che vedrebbe un giocatore al tavolo: le stalle,
   gli scarti, il Nido, quante carte ha in mano ciascuno, la propria mano (e quella di chi ha l'Occhio indiscreto);
   le carte del mazzo solo quando le guarda davvero (cercare, Unicorno Indovino).
   - facile: gioca spesso a caso e risponde col Nitrito solo ogni tanto;
   - medio: gioca la carta che rende di più adesso, attacca chi è avanti, ferma le carte che gli fanno male;
   - difficile: in più non spreca i Nitriti, ferma sempre chi sta per vincere, usa bene gli effetti d'inizio turno
     e decide quando conviene far finire il mazzo. */
(function (root) {
  'use strict';
  var K = (typeof module !== 'undefined' && module.exports) ? require('./motore.js') : root.StallaMatta;
  var LEVELS = ['facile', 'medio', 'difficile'];

  // Quanto vale una carta nella propria stalla (Bonus e Malus); gli unicorni valgono 10 più il loro effetto.
  var STALLA = { scudo_arcobaleno: 8, urra: 6, doppietta: 6, cannoncino: 5, petardo: 4, retino: 4, acchiappapeluche: 3, espresso: 3,
    recinto: -5, pericolante: -3, occhio: -2, rito_oscuro: -8, raffreddore: -4,
    // Brutti sogni
    cerchio_di_sale: 5, elisir: 4, cuore_stregato: 4, spirito_guida: 3, poltergeist: 3, lavoretto: 2,
    incubo_sepolto: -9, incubo_palestra: -5, incubo_vuoto: -4 };
  var EXTRA = { reginetta: 4, paladino: 3, miciocorno: 2, cenere: 3, vendicativo: 2, ariete: 5, unicornone: 0,
    spettrale: 5, sensitivo: 2, diavolicorno: 2, pipistrellicorno: 2 };
  // Quanto vale avere una carta in mano.
  var MANO = { nitrito: 9, supernitrito: 12, mela: 8, due_per_uno: 8, scambio_stalla: 5, zoccolata: 6, colpo_mirato: 5, cambio_di_rotta: 5,
    bocca_a_muso: 6, arraffa: 5, giro_di_ruota: 6, affare_doro: 5, baratto: 3, bufera: 4, mulinello: 3, rimescolone: 3, tabula_rasa: 3,
    unicornone: 10, pandastrofe: 9, monolocale: 6, rito_oscuro: 6, flash: 5, recinto: 4, raffreddore: 4, pericolante: 3, occhio: 2,
    nitrito_maledetto: 10, toc_toc: 8, possessione: 6, seduta_spiritica: 6, fuori_dalla_tomba: 5, piu_spettro: 4, nonnina: 11,
    incubo_occupato: 9, incubo_sepolto: 8, incubo_palestra: 6, incubo_vuoto: 4 };
  // Gli Incubi da mettere nella stalla di un altro (Seduta spiritica): dal peggiore.
  var INCUBO = { incubo_occupato: 4, incubo_sepolto: 3, incubo_palestra: 2, incubo_vuoto: 1 };

  function others(s, me) { var o = []; for (var q = 0; q < s.seats.length; q++) if (q !== me) o.push(q); return o; }
  function stalla(s, p) { return s.stable[p] || []; }
  function mano(s, me) { return s.hand[me] || []; }
  function grezzi(s, p) { return stalla(s, p).filter(K.isUni).length; }
  function magici(s, p) { return stalla(s, p).filter(function (c) { return K.kind(c) === 'magico'; }).length; }
  function maxOf(a, f) { var b = -Infinity; a.forEach(function (x) { var v = f(x); if (v > b) b = v; }); return b; }
  function argmax(a, f) { var b = null, bv = -Infinity; a.forEach(function (x) { var v = f(x); if (v > bv) { bv = v; b = x; } }); return b; }
  function argmin(a, f) { return argmax(a, function (x) { return -f(x); }); }
  function opz(s, me, k, x) { var f = { k: k, p: me, e: 0 }; Object.keys(x || {}).forEach(function (y) { f[y] = x[y]; }); return K.opzioni(s, f); }

  // Quanto è pericoloso q: vicino alla vittoria vale molto di più.
  function threat(s, q) {
    if (K.panda(s, q) || !K.puoVincere(s, q)) return 0.15;
    var c = K.conta(s, q), g = s.goal, t = c / g;
    if (c >= g - 1) t += 1.5; else if (c >= g - 2) t += 0.6;
    return t;
  }
  // Quanto mi conviene danneggiare q (negativo per me stesso): meno di quanto valga costruire la propria
  // stalla, finché q non è vicino alla vittoria; poco chi è dietro di me.
  var CUR = 'medio'; // il livello del bot che sta decidendo
  function weight(s, me, q) {
    if (q === me) return -1.2;
    if (K.panda(s, q) || !K.puoVincere(s, q)) return 0.1;
    var g = s.goal, c = K.conta(s, q), w;
    // medio attacca sempre chi è avanti; difficile prima costruisce e colpisce chi si avvicina alla vittoria
    if (CUR !== 'difficile') return 0.35 + 0.5 * c / g + (threat(s, q) >= maxOf(others(s, me), function (x) { return threat(s, x); }) ? 0.3 : 0) + (c >= g - 1 ? 1 : 0);
    w = 0.15 + 0.45 * c / g;
    if (threat(s, q) >= maxOf(others(s, me), function (x) { return threat(s, x); })) w += 0.15;
    if (c >= g - 1) w += 1; else if (c >= g - 2) w += 0.35;
    if (c < K.conta(s, me)) w *= 0.6;
    return w;
  }
  function stallaValue(s, q, c) {
    var k = K.keyOf(c), t = K.kind(c);
    if (K.isUni(c)) {
      if (K.panda(s, q)) return 1;
      if ((k === 'unicornone' || k === 'nonnina') && K.attivo(s, q, c)) return 20;
      return 10 + (t === 'magico' && K.attivo(s, q, c) ? (EXTRA[k] || 1) : 0);
    }
    if (k === 'flash') return -2 - 3 * magici(s, q);
    if (k === 'monolocale') return -4 - 3 * Math.max(0, grezzi(s, q) - 3);
    if (k === 'pandastrofe') return -8 - 4 * grezzi(s, q);
    // con «Incubo: occupato!» non si vince: peggio quanto più si è vicini
    if (k === 'incubo_occupato') return -10 - 5 * Math.max(0, K.conta(s, q) - 2);
    // difficile: protezioni preziose quando si è vicini alla vittoria
    if (CUR === 'difficile' && (k === 'scudo_arcobaleno' || k === 'urra') && K.conta(s, q) >= s.goal - 3) return STALLA[k] * 2;
    return STALLA[k] || 0;
  }
  // Cosa perde q se c lascia la sua stalla: i Volanti tornano in mano, l'Unicorno Cenere si salva scartando.
  function lossValue(s, q, c, senzaCenere) {
    var v = stallaValue(s, q, c), d = K.def(c);
    if (d.vola && K.attivo(s, q, c)) v = Math.min(v, 3);
    if (!senzaCenere && mano(s, q).length && ((d.id === 'cenere' && K.attivo(s, q, c)) || (d.t !== 'malus' && K.has(s, q, 'elisir')))) v = Math.min(v, 5);
    // la Nonna Zuccherina, andandosene, si porta via un'altra carta
    if (d.id === 'nonnina' && K.attivo(s, q, c)) v += 6;
    return v;
  }
  function handValue(s, me, c) {
    var k = K.keyOf(c), t = K.kind(c);
    if (t === 'semplice') return K.entra(s, c, me) ? 6 : 2;
    if (t === 'magico') return MANO[k] || 7 + (EXTRA[k] || 0) / 2;
    if (t === 'bonus') return (STALLA[k] || 3) * 0.9 + 1;
    if (k === 'bocca_a_muso') return opz(s, me, 'rianima').length ? 7 : 2;
    return MANO[k] != null ? MANO[k] : 4;
  }
  function peggiori(s, me, cards, n) {
    return cards.slice().sort(function (a, b) { return handValue(s, me, a) - handValue(s, me, b); }).slice(0, n);
  }

  /* ---------- quanto rende giocare una carta ---------- */
  function bestDestroy(s, me, filtro, magia) {
    return maxOf(opz(s, me, 'distruggi', { filtro: filtro, magia: magia }), function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q); });
  }
  function bestSteal(s, me, filtro) {
    return maxOf(opz(s, me, 'ruba', { filtro: filtro }), function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q) + stallaValue(s, me, c); });
  }
  // Rimandare in mano: un unicorno si rigioca (e il suo effetto riparte), un cucciolo invece torna nel Nido.
  function returnValue(s, me, c) {
    var q = K.padrone(s, c), t = K.kind(c);
    if (q === me) return t === 'malus' ? -stallaValue(s, me, c) + 2 : -stallaValue(s, me, c) * (t === 'cucciolo' ? 1 : 0.4);
    var f = t === 'cucciolo' ? 1 : K.isUni(c) ? 0.4 : t === 'bonus' ? 0.5 : 0.3;
    return stallaValue(s, q, c) * weight(s, me, q) * f;
  }
  function bestReturn(s, me, da) {
    return maxOf(opz(s, me, 'rimanda', { da: da }), function (c) { return returnValue(s, me, c); });
  }
  // Togliere dal gioco: niente Volanti in mano né Cenere; i propri Malus si tolgono volentieri.
  function exileValue(s, me, c) {
    var q = K.padrone(s, c);
    return q === me ? -stallaValue(s, me, c) : stallaValue(s, q, c) * weight(s, me, q);
  }
  function bestExile(s, me) { return maxOf(opz(s, me, 'esilia'), function (c) { return exileValue(s, me, c); }); }
  // La legge del più spettro: quanto rende distruggere tutti gli unicorni semplici di q.
  function strageValue(s, me, q) {
    return stalla(s, q).reduce(function (a, c) {
      return a + (K.kind(c) === 'semplice' && K.distruggibile(s, q, c, true) ? lossValue(s, q, c) * weight(s, me, q) : 0);
    }, 0);
  }
  function costoScarti(s, me, n, senza) {
    var h = mano(s, me).filter(function (c) { return c !== senza; });
    return h.length < n ? Infinity : peggiori(s, me, h, n).reduce(function (a, c) { return a + handValue(s, me, c); }, 0);
  }
  function sacrificeCost(s, me, filtro) {
    var o = opz(s, me, 'sacrifica', { filtro: filtro });
    return o.length ? -maxOf(o, function (c) { return -lossValue(s, me, c); }) : Infinity;
  }
  // Cercare nel mazzo: il bot non sa cosa c'è nel mazzo, ma sa quali carte non ha ancora visto.
  function deckValue(s, me, filtro) {
    var visti = {};
    s.discard.concat(mano(s, me)).forEach(function (c) { visti[c] = 1; });
    for (var q = 0; q < s.seats.length; q++) stalla(s, q).forEach(function (c) { visti[c] = 1; });
    var resto = K.mazzoPer(s.exp, s.seats.length).filter(function (c) {
      if (visti[c]) return false;
      var k = K.kind(c);
      return filtro === 'narvalo' ? /narvalo/i.test(K.def(c).name) : k === filtro;
    });
    return resto.length ? 4 : 0;
  }
  function enterValue(s, me, c) {
    var k = K.keyOf(c), v = EXTRA[k] || 0, x;
    switch (k) {
      case 'narvalo_incantatore': x = bestSteal(s, me, 'bonus'); return v + Math.max(0, x);
      case 'mano_lesta': return v + (others(s, me).some(function (q) { return mano(s, q).length; }) ? 4 : 0);
      case 'volante_dispettoso': return v + 3;
      case 'boscaiolo': x = maxOf(opz(s, me, 'colpo'), function (y) { var q = K.padrone(s, y); return q === me ? -stallaValue(s, me, y) : stallaValue(s, q, y) * weight(s, me, q); }); return v + Math.max(0, x);
      case 'narvalo_frac': return v + deckValue(s, me, 'bonus');
      case 'narvalo_straccione': return v + deckValue(s, me, 'malus');
      case 'narvalo_supremo': return v + deckValue(s, me, 'narvalo');
      case 'ombra': return v + (s.discard.some(function (y) { return K.kind(y) === 'magico'; }) ? 3 : 0);
      case 'catastrofe': return v + others(s, me).reduce(function (a, q) { return a + (grezzi(s, q) && !K.panda(s, q) ? 10 * weight(s, me, q) : 0); }, 0) - 10;
      case 'volante_ingordo': return v + 3;
      case 'alpacorno': return v + 2 * others(s, me).filter(function (q) { return mano(s, q).length; }).length - 3;
      case 'volante_stregato': return v + (s.discard.some(function (y) { return K.kind(y) === 'magia'; }) ? 4 : 0);
      case 'volante_regale': return v + (s.discard.some(K.isUni) ? 5 : 0);
      case 'volante_svelto': return v + (s.discard.some(K.isNeigh) ? 6 : 0);
      case 'chioccia': return v + (s.nursery.length ? 10 : 0);
      case 'risacca': return v + Math.max(0, bestReturn(s, me, 'altri'));
      case 'narvalo_spazzino': return v - stalla(s, me).reduce(function (a, y) { return a + (K.kind(y) === 'malus' ? stallaValue(s, me, y) : 0); }, 0);
      case 'evocatore': return v + (mano(s, me).filter(K.isUni).length >= 3 ? 4 : 0);
      case 'pifferaio': return v + (opz(s, me, 'dalla_mano').length ? 9 : 0);
      case 'rubacuori': return v + (mano(s, me).length > 1 ? Math.max(0, bestSteal(s, me, 'unicorno') - 4) : 0);
      case 'squalicorno': return v + Math.max(0, bestDestroy(s, me, 'unicorno') - 10);
      case 'popcorno': return v + 2;
      case 'indovino': return v + 3;
      case 'mascherato': return v + 2.5 * stalla(s, me).filter(function (y) { return K.kind(y) === 'semplice'; }).length;
      case 'pagliaccio': x = others(s, me).reduce(function (a, q) { return a + Math.max(0, bestReturn(s, me, q)); }, 0) - costoScarti(s, me, 2, c); return v + Math.max(0, x);
      case 'mietitore': return v + 3;
      case 'burattino': x = maxOf(stalla(s, me).filter(function (y) { return K.kind(y) === 'malus'; }), function (y) { return -stallaValue(s, me, y); }); return v + Math.max(0, x * 0.9);
      case 'uncinocorno': return v + Math.max(0, bestExile(s, me) - costoScarti(s, me, 1, c));
    }
    return v;
  }
  function playValue(s, me, m) {
    var c = m.card, k = K.keyOf(c), t = K.kind(c), x;
    if (t === 'semplice' || t === 'magico') {
      if (K.panda(s, me)) return 1;
      var gain = ((k === 'unicornone' || k === 'nonnina') && !K.has(s, me, 'flash')) ? 2 : 1, now = K.conta(s, me);
      if (K.has(s, me, 'monolocale') && now + gain > 5) return 0.5;
      var v = 10 * gain + (now + gain >= s.goal && K.puoVincere(s, me) ? 200 : 0);
      if (K.has(s, me, 'recinto')) v -= 3;
      if (t === 'magico' && !K.has(s, me, 'flash')) v += enterValue(s, me, c);
      return v;
    }
    if (t === 'bonus') return m.to === me ? stallaValue(s, me, c) + (k === 'cuore_stregato' ? 5 : 0) : -stallaValue(s, m.to, c) * weight(s, me, m.to);
    if (t === 'malus') {
      if (m.to === me) return stallaValue(s, me, c) - 5;
      // gli Incubi fanno effetto appena entrano
      var subito = k === 'incubo_occupato' && opz(s, m.to, 'sacrifica', { filtro: 'unicorno' }).length ? 10 : k === 'incubo_palestra' ? 1.2 * mano(s, m.to).length : 0;
      return (-stallaValue(s, m.to, c) * 0.8 + subito) * weight(s, me, m.to);
    }
    switch (k) {
      case 'mela': return bestDestroy(s, me, 'unicorno', true);
      case 'due_per_uno': {
        var o = opz(s, me, 'distruggi', { filtro: 'carta', magia: true }).map(function (y) { var q = K.padrone(s, y); return lossValue(s, q, y) * weight(s, me, q); }).sort(function (a, b) { return b - a; });
        return (o[0] || 0) + (o[1] || 0) - sacrificeCost(s, me, 'carta');
      }
      case 'zoccolata': return Math.max(0, bestReturn(s, me, 'altri')) + 2;
      case 'colpo_mirato': return maxOf(opz(s, me, 'colpo'), function (y) { var q = K.padrone(s, y); return q === me ? -stallaValue(s, me, y) : stallaValue(s, q, y) * weight(s, me, q); });
      case 'cambio_di_rotta': return bestMove(s, me).v;
      case 'tabula_rasa': return [me].concat(others(s, me)).reduce(function (a, q) {
        return a + stalla(s, q).reduce(function (b, y) { return b + (K.kind(y) === 'bonus' || K.kind(y) === 'malus' ? (q === me ? -stallaValue(s, me, y) : stallaValue(s, q, y) * weight(s, me, q)) : 0); }, 0);
      }, 0);
      case 'bocca_a_muso': x = opz(s, me, 'rianima'); return x.length ? 10 + (K.conta(s, me) + 1 >= s.goal ? 200 : 0) + maxOf(x, function (y) { return K.kind(y) === 'magico' ? enterValue(s, me, y) : 0; }) : 0;
      case 'scambio_stalla': return 3;
      case 'arraffa': return 5;
      case 'giro_di_ruota': return 6;
      case 'affare_doro': return 5;
      case 'rimescolone': return mano(s, me).length <= 2 ? 5 : 1;
      case 'baratto': x = maxOf(others(s, me), function (q) { return mano(s, q).length; }); return (x - (mano(s, me).length - 1)) * 2;
      case 'bufera': return others(s, me).reduce(function (a, q) { return a + Math.max(0, bestReturn(s, me, q)); }, 0) + Math.min(0, bestReturn(s, me, me));
      case 'mulinello': return others(s, me).filter(function (q) { return mano(s, q).length; }).length * 1.5 - 2;
      case 'toc_toc': return bestExile(s, me);
      case 'possessione': return bestSteal(s, me, 'carta') - costoScarti(s, me, 1, c);
      case 'fuori_dalla_tomba': return opz(s, me, 'rianima', { filtro: 'semplice' }).length ? 13 + (K.conta(s, me) + 1 >= s.goal && K.puoVincere(s, me) ? 200 : 0) : 0;
      case 'piu_spettro': return maxOf([me].concat(others(s, me)), function (q) { return strageValue(s, me, q); });
      case 'seduta_spiritica': return maxOf(others(s, me), function (q) { return weight(s, me, q); }) * 9;
    }
    return 1;
  }
  // Cambio di rotta: la carta e la stalla di arrivo che rendono di più (B = quanto mi piace dove sta).
  function benefit(s, me, q, c) { return q === me ? stallaValue(s, me, c) : -stallaValue(s, q, c) * Math.max(0.2, weight(s, me, q)); }
  function bestMove(s, me, only, list) {
    var best = { v: -Infinity, c: null, to: -1 };
    (only ? [only] : list || opz(s, me, 'sposta')).forEach(function (c) {
      var o = K.padrone(s, c);
      for (var d = 0; d < s.seats.length; d++) if (d !== o && K.entra(s, c, d) && !(list && d === me && o === me)) {
        var v = benefit(s, me, d, c) - benefit(s, me, o, c);
        if (v > best.v) best = { v: v, c: c, to: d };
      }
    });
    return best;
  }

  /* ---------- il Nitrito ---------- */
  // Quanto mi conviene che la carta `it` vada a buon fine (negativo: meglio fermarla).
  function impatto(s, me, it) {
    var c = it.c, q = it.p, k = K.keyOf(c), t = K.kind(c), wq = Math.max(0.3, weight(s, me, q));
    if (q === me) return Math.max(4, playValue(s, me, { card: c, to: it.to }));
    if (t === 'semplice' || t === 'magico') {
      var gain = ((k === 'unicornone' || k === 'nonnina') && !K.has(s, q, 'flash')) ? 2 : 1, after = K.conta(s, q) + gain;
      if (K.panda(s, q) || (K.has(s, q, 'monolocale') && after > 5)) return 0;
      if (after >= s.goal && K.puoVincere(s, q)) return -300;
      // un unicorno in più conta davvero solo quando avvicina chi lo gioca alla vittoria
      var v = 10 * gain * (after >= s.goal - 1 ? 1.4 : after >= s.goal - 2 ? 0.8 : 0.45);
      if (k === 'catastrofe' && grezzi(s, me) && !K.panda(s, me)) v += 8;
      if ((k === 'squalicorno' || k === 'rubacuori' || k === 'risacca') && grezzi(s, me)) v += 3;
      return -v * wq;
    }
    if (t === 'bonus') return it.to === me ? stallaValue(s, me, c) : -stallaValue(s, it.to, c) * Math.max(0.3, weight(s, me, it.to));
    if (t === 'malus') return it.to === me ? stallaValue(s, me, c) * 1.4 - 4 : -stallaValue(s, it.to, c) * Math.max(0.2, weight(s, me, it.to)) * 0.5;
    if (t !== 'magia') return 0;
    // Le Magie: chi le gioca sceglie poi i bersagli; probabilmente prende chi è più avanti.
    var tot = 0, opp = others(s, q);
    opp.forEach(function (x) { tot += threat(s, x) + 0.2; });
    var pMe = (threat(s, me) + 0.2) / (tot || 1);
    var myBest = maxOf(stalla(s, me).filter(function (y) { return K.isUni(y) && K.distruggibile(s, me, y, true); }), function (y) { return lossValue(s, me, y); });
    if (myBest < 0) myBest = 0;
    switch (k) {
      case 'mela': case 'toc_toc': return -pMe * myBest * 1.2 - 2 * wq;
      case 'possessione': return -pMe * 7 - 2 * wq;
      case 'fuori_dalla_tomba': return (K.conta(s, q) + 1 >= s.goal && K.puoVincere(s, q) ? -300 : -10 * wq);
      case 'piu_spettro': return -pMe * 10 * stalla(s, me).filter(function (y) { return K.kind(y) === 'semplice'; }).length - 2 * wq;
      case 'seduta_spiritica': return -pMe * 10 - 1;
      case 'due_per_uno': return -pMe * myBest * 1.6 - 3 * wq;
      case 'zoccolata': case 'scambio_stalla': return -pMe * 7 - 2 * wq;
      case 'arraffa': case 'baratto': return -pMe * 4 - 2 * wq;
      case 'colpo_mirato': case 'cambio_di_rotta': return -pMe * maxOf(stalla(s, me), function (y) { return K.kind(y) === 'bonus' ? stallaValue(s, me, y) : 0; }) - 1;
      case 'bocca_a_muso': return (K.conta(s, q) + 1 >= s.goal ? -300 : -10 * wq);
      case 'giro_di_ruota': return -6 * wq;
      case 'affare_doro': case 'rimescolone': return -3 * wq;
    }
    return -2 * wq;
  }
  function nitrito(s, me, P, lv, rnd) {
    var pass = { type: 'answer', pass: true, pid: P.id };
    var mine = mano(s, me).filter(K.isNeigh);
    if (!mine.length || !K.nitrisce(s, me)) return pass;
    var ch = s.chain, i = ch.length - 1, e0 = impatto(s, me, ch[0]);
    var e = (i % 2 === 0 ? 1 : -1) * e0; // quanto mi conviene che la carta in cima vada a buon fine
    if (ch[i].p === me) return pass;
    // prima i Nitriti normali, poi quelli maledetti; il Supernitrito per le carte decisive
    var plain = mine.filter(function (c) { return K.keyOf(c) === 'nitrito'; }).concat(mine.filter(function (c) { return K.keyOf(c) === 'nitrito_maledetto'; }));
    var sup = mine.filter(function (c) { return K.keyOf(c) === 'supernitrito'; });
    var use = function (c) { return { type: 'answer', cards: [c], pid: P.id }; };
    if (lv === 'facile') return (e < -6 && rnd() < 0.3) ? use(mine[0]) : pass;
    if (lv === 'medio') {
      // medio: difende le proprie carte solo se sono decisive e ogni tanto si distrae
      if (i % 2 === 1 && ch[i - 1].p === me && e > -150) return pass;
      if (rnd() < 0.15 || e > -10) return pass;
      return use(mine[0]);
    }
    var soglia = mine.length > 1 ? 9 : 15;
    // con tanti altri che possono ancora rispondere, per le minacce di tutti ci pensa spesso qualcun altro
    if (e > -150) soglia *= 1 + 0.15 * Math.max(0, P.wait.length - 1);
    // vicino alla vittoria tiene l'ultimo Nitrito per difendere la propria carta decisiva
    if (mine.length === 1 && K.conta(s, me) >= s.goal - 2 && e > -150 && !(i % 2 === 1 && ch[i - 1].p === me)) return pass;
    if (e > -soglia) return pass;
    // per le carte decisive (chi sta per vincere) il Supernitrito, che non si può fermare
    if (e <= -150 && sup.length) return use(sup[0]);
    return use(plain.length ? plain[0] : sup[0]);
  }

  /* ---------- le altre scelte ---------- */
  function scegliCarte(s, me, P, lv, rnd) {
    var o = P.opts, n = P.n || 1, src = P.src ? K.keyOf(P.src) : '', pk;
    var one = function (c) { return { type: 'answer', cards: [c], pid: P.id }; };
    var no = { type: 'answer', skip: true, pid: P.id };
    switch (P.op) {
      case 'limite': case 'scarta':
        if (P.may && P.op === 'scarta') {
          // un costo: vale la pena? (Rubacuori, Evocatore, Acchiappapeluche, Retino, Cannoncino)
          var cost = peggiori(s, me, o, n).reduce(function (a, c) { return a + handValue(s, me, c); }, 0), gain = 0;
          if (src === 'rubacuori' || src === 'retino') gain = bestSteal(s, me, 'unicorno');
          else if (src === 'cannoncino') gain = bestDestroy(s, me, 'unicorno');
          else if (src === 'evocatore') gain = 10;
          else if (src === 'acchiappapeluche') gain = 5;
          else if (src === 'pagliaccio') gain = others(s, me).reduce(function (a, q) { return a + Math.max(0, bestReturn(s, me, q)); }, 0);
          else if (src === 'uncinocorno' || src === 'lavoretto') gain = bestExile(s, me);
          if (gain <= cost * (lv === 'difficile' ? 0.6 : 0.8)) return no;
        }
        return { type: 'answer', cards: peggiori(s, me, o, n), pid: P.id };
      case 'inizio': return inizio(s, me, P, lv);
      case 'sacrifica':
        if (P.may) {
          var c0 = argmin(o, function (c) { return lossValue(s, me, c); }), costo = lossValue(s, me, c0), resa = 0;
          if (src === 'espresso') resa = 7;
          else if (src === 'petardo') resa = maxOf(opz(s, me, 'distruggi', { filtro: 'carta' }), function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q); });
          else if (src === 'ombra') resa = s.discard.some(K.isUni) ? 11 : 0;
          else if (src === 'rancoroso') resa = 7;
          if (resa - costo <= 0) return no;
          return one(c0);
        }
        // per il Monolocale salvare l'Unicorno Cenere non serve: si sacrifica comunque qualcosa
        return one(argmin(o, function (c) { return lossValue(s, me, c, src === 'monolocale'); }));
      case 'distruggi': {
        var b = argmax(o, function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q); });
        if (P.may) { var q0 = K.padrone(s, b); if (lossValue(s, q0, b) * weight(s, me, q0) <= 0.5) return no; }
        return one(b);
      }
      case 'ruba': {
        var r = argmax(o, function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q) + stallaValue(s, me, c); });
        if (P.may) { var q1 = K.padrone(s, r); if (lossValue(s, q1, r) * weight(s, me, q1) + stallaValue(s, me, r) <= 0) return no; }
        return one(r);
      }
      case 'rimanda':
        return one(argmax(o, function (c) { return returnValue(s, me, c); }));
      case 'colpo': {
        var cc = argmax(o, function (c) { var q = K.padrone(s, c); return q === me ? -stallaValue(s, me, c) : stallaValue(s, q, c) * weight(s, me, q); });
        return P.may && (function () { var q = K.padrone(s, cc); return (q === me ? -stallaValue(s, me, cc) : stallaValue(s, q, cc) * weight(s, me, q)) <= 0; })() ? no : one(cc);
      }
      case 'sposta': {
        var bm = bestMove(s, me, null, o);
        if (P.may && !(bm.v > 0)) return no;
        return one(bm.c || o[0]);
      }
      case 'esilia': {
        var ex = argmax(o, function (c) { return exileValue(s, me, c); });
        if (P.may && exileValue(s, me, ex) <= 0.5) return no;
        return one(ex);
      }
      case 'evoca': return one(argmax(o, function (c) { return INCUBO[K.keyOf(c)] || 0; }));
      case 'scambio': return one(argmin(o, function (c) { return lossValue(s, me, c); }));
      case 'indovino':
        if (P.fase === 'cima') return one(argmin(o, function (c) { return handValue(s, me, c); }));
        return one(argmax(o, function (c) { return handValue(s, me, c); }));
      case 'cerca': case 'recupera': case 'pesca_mano': case 'arraffa':
        return one(argmax(o, function (c) { return handValue(s, me, c); }));
      case 'rianima':
        pk = argmax(o, function (c) { return K.kind(c) === 'magico' ? 10 + enterValue(s, me, c) : 10; });
        return one(pk);
      case 'dalla_mano': case 'nido': return one(o[0]);
    }
    if (P.may && lv !== 'facile') return no;
    return n === 1 ? one(o[0]) : { type: 'answer', cards: o.slice(0, n), pid: P.id };
  }
  // Inizio del turno: si usano gli effetti che rendono più di quanto costano.
  function inizio(s, me, P, lv) {
    var use = function (c) { return { type: 'answer', cards: [c], pid: P.id }; };
    if (P.must && P.must.length) return use(P.must[0]);
    var h = mano(s, me), worst = function (n) { return peggiori(s, me, h, n).reduce(function (a, c) { return a + handValue(s, me, c); }, 0); };
    var best = null, bv = lv === 'difficile' ? 0.5 : 2;
    P.opts.forEach(function (c) {
      var k = K.keyOf(c), v = 0;
      switch (k) {
        case 'acchiappapeluche': v = 5 - worst(1); break;
        case 'espresso': v = 7 - sacrificeCost(s, me, 'carta'); break;
        case 'petardo': v = maxOf(opz(s, me, 'distruggi', { filtro: 'carta' }), function (y) { var q = K.padrone(s, y); return lossValue(s, q, y) * weight(s, me, q); }) - sacrificeCost(s, me, 'carta'); break;
        case 'retino': v = bestSteal(s, me, 'unicorno') - worst(3) * 0.6; break;
        case 'cannoncino': v = bestDestroy(s, me, 'unicorno') - worst(2) * 0.6; break;
        // l'Ariete fa saltare pesca e azione: per difficile conviene solo se ne vale la pena
        case 'ariete': v = bestDestroy(s, me, 'unicorno') - (lv === 'difficile' ? 4 + (h.some(function (c) { return K.isUni(c) && K.entra(s, c, me); }) ? 10 : 5) : 9); break;
        case 'sensitivo': v = 3; break;
        case 'spirito_guida': v = 2.5; break;
        case 'poltergeist': v = 2.5; break;
        case 'lavoretto': v = bestExile(s, me) - worst(3) * 0.6; break;
      }
      if (v > bv) { bv = v; best = c; }
    });
    return best ? use(best) : { type: 'answer', skip: true, pid: P.id };
  }
  function giocatore(s, me, P, lv) {
    var src = P.src ? K.keyOf(P.src) : '', o = P.opts;
    var t = function (q) { return { type: 'answer', target: q, pid: P.id }; };
    if (P.op === 'sposta') return t(argmax(o, function (q) { return benefit(s, me, q, P.c); }));
    if (P.op === 'scambio') return t(argmax(o, function (q) { return maxOf(stalla(s, q).filter(K.isUni), function (c) { return lossValue(s, q, c); }) * weight(s, me, q); }));
    if (P.op === 'evoca') return t(argmax(o, function (q) { return benefit(s, me, q, P.c); }));
    if (src === 'piu_spettro') return t(argmax(o, function (q) { return strageValue(s, me, q); }));
    if (src === 'baratto') return t(argmax(o, function (q) { return mano(s, q).length; }));
    if (src === 'arraffa' || src === 'mano_lesta' || src === 'pipistrellicorno' || src === 'poltergeist') return t(argmax(o, function (q) { return mano(s, q).length + threat(s, q) * 3; }));
    return t(argmax(o, function (q) { return threat(s, q) * 3 - mano(s, q).length * 0.2; }));
  }
  function answer(s, me, lv, rnd) {
    var P = K.promptFor(s, me);
    if (!P) return null;
    if (lv === 'facile' && P.kind !== 'nitrito' && rnd() < 0.45) {
      var ms = K.legalMoves(s, me);
      return ms[Math.floor(rnd() * ms.length)];
    }
    switch (P.kind) {
      case 'nitrito': return nitrito(s, me, P, lv, rnd);
      case 'carte': return scegliCarte(s, me, P, lv, rnd);
      case 'giocatore': return giocatore(s, me, P, lv);
      case 'si': return { type: 'answer', yes: P.q === 'mietitore' ? true : bestDestroy(s, me, 'unicorno') > 10, pid: P.id };
      case 'scelta': {
        var c = P.c, keep = lossValue(s, me, c, true);
        if (P.opts.indexOf('scarta') >= 0 && !P.mono && keep > 4 && peggiori(s, me, mano(s, me), 1).some(function (x) { return handValue(s, me, x) < 9; })) return { type: 'answer', pick: 'scarta', pid: P.id };
        if (P.opts.indexOf('paladino') >= 0 && keep > 13) return { type: 'answer', pick: 'paladino', pid: P.id };
        return { type: 'answer', pick: 'no', pid: P.id };
      }
      case 'ogni': {
        var o = P.opts[me] || [];
        var pick = P.cosa === 'scarta' ? peggiori(s, me, o, 1)[0] : argmin(o, function (x) { return lossValue(s, me, x); });
        return { type: 'answer', cards: [pick], pid: P.id };
      }
    }
    return null;
  }

  /* ---------- il turno ---------- */
  // Se il mazzo è vuoto, pescare fa finire la partita: conviene solo se si è primi.
  function primoAMazzoVuoto(s, me) {
    var mine = [K.conta(s, me), K.lettere(s, me)];
    return others(s, me).every(function (q) { var c = K.conta(s, q); return c < mine[0] || (c === mine[0] && K.lettere(s, q) < mine[1]); });
  }
  function turnMove(s, me, lv, rnd) {
    var legal = K.legalMoves(s, me), plays = legal.filter(function (m) { return m.type === 'play'; });
    var canDraw = legal.some(function (m) { return m.type === 'draw'; });
    if (lv === 'facile' && rnd() < 0.35) return legal[Math.floor(rnd() * legal.length)];
    var best = null, bv = -Infinity;
    plays.forEach(function (m) {
      var v = playValue(s, me, m);
      if (lv === 'facile') v += rnd() * 14; else if (lv === 'medio') v += rnd() * 3;
      if (v > bv) { bv = v; best = m; }
    });
    var drawV = !canDraw ? -Infinity : s.deck.length ? 3.5 : (lv !== 'difficile' ? 3.5 : primoAMazzoVuoto(s, me) ? 1000 : -1000);
    if (best && bv >= drawV && bv > 1) return best;
    if (canDraw && drawV > -1000) return { type: 'draw' };
    return { type: 'end' };
  }

  function mossa(s, me, level, rnd) {
    rnd = rnd || Math.random;
    if (LEVELS.indexOf(level) < 0) level = 'medio';
    if (!s || s.status !== 'playing' || K.waitingFor(s).indexOf(me) < 0) return null;
    CUR = level;
    var m = null;
    try { m = s.prompt ? answer(s, me, level, rnd) : turnMove(s, me, level, rnd); } catch (e) { m = null; }
    if (!m || K.validate(s, me, m)) {
      var ms = K.legalMoves(s, me);
      m = ms.filter(function (x) { return x.pass || x.skip || x.type === 'end'; })[0] || ms[0] || null;
    }
    return m;
  }

  var api = { mossa: mossa, LEVELS: LEVELS, threat: threat, stallaValue: stallaValue, handValue: handValue, impatto: impatto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StallaBot = api;
})(typeof window !== 'undefined' ? window : this);
