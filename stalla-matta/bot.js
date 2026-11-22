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
    incubo_sepolto: -9, incubo_palestra: -5, incubo_vuoto: -4,
    // Miti e leggende
    colpo_critico: 3, bisaccia: 3, muro_di_corna: 3, pace_divina: -3, maleficio: -5,
    // Avventure
    rito_antico: 3, buca: 4, zoccoli_reali: 3, kit: 5, meridiana: -3, zainetto: -6, in_mare: -4,
    // Draghi
    fortuna_drago: 5, protezione_drago: 4, maledizione_drago: -4, sfortuna_drago: -4, cieli_dei_draghi: -7,
    // Diluvio arcobaleno
    zuccherini: 4, consegna_speciale: 4, zoccoletti: -4 };
  var EXTRA = { reginetta: 4, paladino: 3, miciocorno: 2, cenere: 3, vendicativo: 2, ariete: 5, unicornone: 0,
    spettrale: 5, sensitivo: 2, diavolicorno: 2, pipistrellicorno: 2, domatore: 4, bardo: 2,
    avventuriero: 2, vagabondo: 2, sopravvissuto: 1, bungee: 2, impavido: 1, primo_ufficiale: 2,
    ammazzadraghi: 2, unicorno_drago: 3, volante_squamoso: 2,
    volante_adorabile: 2, angelo: 3, fertile: 3, minuscolo: 2, morte: 4, carestia: 0, guerra: 3, zombi: 3 };
  // Quanto vale avere una carta in mano.
  var MANO = { nitrito: 9, supernitrito: 12, mela: 8, due_per_uno: 8, scambio_stalla: 5, zoccolata: 6, colpo_mirato: 5, cambio_di_rotta: 5,
    bocca_a_muso: 6, arraffa: 5, giro_di_ruota: 6, affare_doro: 5, baratto: 3, bufera: 4, mulinello: 3, rimescolone: 3, tabula_rasa: 3,
    unicornone: 10, pandastrofe: 9, monolocale: 6, rito_oscuro: 6, flash: 5, recinto: 4, raffreddore: 4, pericolante: 3, occhio: 2,
    nitrito_maledetto: 10, toc_toc: 8, possessione: 6, seduta_spiritica: 6, fuori_dalla_tomba: 5, piu_spettro: 4, nonnina: 11,
    incubo_occupato: 9, incubo_sepolto: 8, incubo_palestra: 6, incubo_vuoto: 4,
    raso_al_suolo: 5, voltagabbana: 6, raglio: 6, palla_di_fuoco: 5, fulmine: 7, negromanzia: 6,
    nitrito_messere: 8, nitrito_villano: 9, nitrito_canaglia: 9, pace_divina: 4, maleficio: 6, igiene_medievale: 5,
    canna_da_pesca: 7, rete: 8, razzo: 6, nitrito_marinaio: 9, corno_luminoso: 7, cercametalli: 6, bussola: 7, lingua_dargento: 5,
    furto_di_culle: 8, paletta: 6, macchia_nera: 6, meridiana: 4, zainetto: 6, in_mare: 4,
    alito_di_drago: 8, fuoco_di_drago: 5, bacio_del_drago: 6, stalle_bruciate: 3, nitrito_bestiaccia: 9,
    maledizione_drago: 5, sfortuna_drago: 4, cieli_dei_draghi: 7,
    attacco_tenero: 6, fuoco_e_zolfo: 4, castigo_celeste: 4, alpacalisse: 4, sovrappopolazione: 4, tempesta_tenerezza: 4,
    distruzione_totale: 4, apocalisse_zombi: 4, unicorni_apocalisse: 5, peste_nera: 6, spruzzino: 6, pisolino: 6, nitrito_grazie: 8, zoccoletti: 5 };
  // Quale Nitrito usare per primo: quello che fa più danno a chi viene fermato, il «messere» per ultimo.
  var NITRITI = ['nitrito_villano', 'nitrito_maledetto', 'nitrito', 'nitrito_canaglia', 'nitrito_marinaio', 'nitrito_bestiaccia', 'nitrito_grazie', 'nitrito_messere'];
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
    // in due, quello che perde l'altro è come guadagnarlo io
    if (s.seats.length === 2) return Math.max(w, 0.95);
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
    // con la Benedizione del drago i Malus della stalla non fanno niente (finché c'è)
    if (t === 'malus' && !K.attivo(s, q, c)) return -0.5;
    if (k === 'benedizione_drago') return 2 + 4 * stalla(s, q).filter(function (y) { return K.kind(y) === 'malus'; }).length;
    if (k === 'flash' || k === 'igiene_medievale') return -2 - 3 * magici(s, q);
    if (k === 'monolocale') return -4 - 3 * Math.max(0, grezzi(s, q) - 3);
    if (k === 'pandastrofe') return -8 - 4 * grezzi(s, q);
    // con «Incubo: occupato!» non si vince: peggio quanto più si è vicini
    if (k === 'incubo_occupato') return -10 - 5 * Math.max(0, K.conta(s, q) - 2);
    // La macchia nera: con unicorni semplici in stalla non si vince
    if (k === 'macchia_nera') return -3 - 4 * Math.min(3, stalla(s, q).filter(function (y) { return K.kind(y) === 'semplice'; }).length);
    // difficile: protezioni preziose quando si è vicini alla vittoria
    if (CUR === 'difficile' && (k === 'scudo_arcobaleno' || k === 'urra') && K.conta(s, q) >= s.goal - 3) return STALLA[k] * 2;
    return STALLA[k] || 0;
  }
  // Cosa perde q se c lascia la sua stalla: i Volanti tornano in mano, l'Unicorno Cenere si salva scartando.
  function lossValue(s, q, c, senzaCenere) {
    var v = stallaValue(s, q, c), d = K.def(c);
    if (d.vola && K.attivo(s, q, c)) v = Math.min(v, 3);
    if (!senzaCenere && mano(s, q).length && ((d.id === 'cenere' && K.attivo(s, q, c)) || (d.t !== 'malus' && K.has(s, q, 'elisir')))) v = Math.min(v, 5);
    // la Protezione del drago salva dalle distruzioni (non dai sacrifici): conta un po' meno
    if (!senzaCenere && mano(s, q).length && d.t !== 'malus' && K.has(s, q, 'protezione_drago')) v = Math.min(v, 6.5);
    // l'Unicorno Drago, andandosene, fa distruggere un unicorno a chi l'aveva
    if (d.id === 'unicorno_drago' && K.attivo(s, q, c)) v -= 4;
    // la Nonna Zuccherina, andandosene, si porta via un'altra carta
    if (d.id === 'nonnina' && K.attivo(s, q, c)) v += 6;
    // l'Unicorno Furioso distrutto fa sacrificare a chi l'aveva un altro unicorno
    if (d.id === 'furioso' && K.attivo(s, q, c)) v += 5;
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
  function bestDestroy(s, me, filtro, magia, src) {
    return maxOf(opz(s, me, 'distruggi', { filtro: filtro, magia: magia, src: src }), function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q); });
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
  // Il primo unicorno che q sacrificherebbe (il meno caro); null se non ne ha.
  function menoCaro(s, q) {
    var o = opz(s, q, 'sacrifica', { filtro: 'unicorno' });
    return o.length ? -maxOf(o, function (c) { return -lossValue(s, q, c); }) : null;
  }
  // Unicorno Stregone: si sacrificano le carte che costano meno di quanto rende distruggere le migliori degli altri.
  function stregonePiano(s, me) {
    var mie = opz(s, me, 'sacrifica', { filtro: 'carta' }).sort(function (a, b) { return lossValue(s, me, a) - lossValue(s, me, b); });
    var loro = opz(s, me, 'distruggi', { filtro: 'carta' }).map(function (c) { var q = K.padrone(s, c); return lossValue(s, q, c) * weight(s, me, q); }).sort(function (a, b) { return b - a; });
    // le proprie perdite pesano di più (si torna indietro verso i 7), e al massimo 3 scambi ben convenienti
    var scelte = [], v = 0;
    for (var i = 0; i < Math.min(mie.length, loro.length, 3); i++) {
      var lv = lossValue(s, me, mie[i]), guadagno = loro[i] - (lv > 0 ? lv * (1.3 + 0.1 * K.conta(s, me)) : lv);
      if (guadagno <= 3) break;
      scelte.push(mie[i]); v += guadagno;
    }
    return { cards: scelte, v: v };
  }
  // Raglio prismatico: quanto rende con 1 o con 2 carte scartate.
  function raglioPiano(s, me, senza) {
    var vals = others(s, me).map(function (q) { var m = menoCaro(s, q); return m == null ? 0 : m * weight(s, me, q); }).sort(function (a, b) { return b - a; });
    var uno = (vals[0] || 0) - costoScarti(s, me, 1, senza), due = (vals[0] || 0) + (vals[1] || 0) - costoScarti(s, me, 2, senza);
    return due > uno ? { n: 2, v: due } : { n: 1, v: uno };
  }
  // Quanto vale ciascuna strada delle carte «Scegli: … oppure …» (indice della voce).
  function valoreScelta(s, me, k, i, c) {
    var x, h = mano(s, me).filter(function (y) { return y !== c; }), NO = -Infinity;
    var vince1 = K.conta(s, me) + 1 >= s.goal && K.puoVincere(s, me) ? 200 : 0;
    var semplici = function (z) { return z.filter(function (y) { return K.kind(y) === 'semplice'; }).length; };
    var unicorni = s.discard.filter(function (y) { var t = K.kind(y); return t === 'semplice' || t === 'magico'; }).length;
    switch (k) {
      case 'capitano': return i === 0 ? bestSteal(s, me, 'cucciolo') : semplici(s.discard) ? 12 + vince1 : NO;
      case 'imbroglione':
        if (i === 0) return 10.5 - h.reduce(function (a, y) { return a + handValue(s, me, y); }, 0);
        return maxOf(others(s, me), function (q) { return (mano(s, q).length - h.length) * 3; });
      case 'saccheggiatore':
        if (i === 0) return bestSteal(s, me, 'bonus');
        return maxOf(stalla(s, me).filter(function (y) { return K.kind(y) === 'malus'; }), function (y) { return -stallaValue(s, me, y) * 0.9; });
      case 'lupo_di_mare': return i === 0 ? others(s, me).reduce(function (a, q) { return a + (mano(s, q).length ? 2 * Math.max(0.3, weight(s, me, q)) : 0); }, 0) : 3.5;
      case 'bungee': return i === 0 ? maxOf(stalla(s, me).filter(function (y) { return K.kind(y) === 'malus'; }), function (y) { return -stallaValue(s, me, y); }) : 8;
      case 'primo_ufficiale': return i === 0 ? 7 : semplici(h) ? 10 + vince1 : NO;
      case 'corno_luminoso':
        if (i === 0) return bestDestroy(s, me, 'carta', true) - sacrificeCost(s, me, 'carta');
        return maxOf(opz(s, me, 'rianima', { filtro: 'stalla' }), function (y) { var t = K.kind(y); return t === 'magico' ? 10 + enterValue(s, me, y) : t === 'semplice' ? 10 : stallaValue(s, me, y); });
      case 'cercametalli': return i === 0 ? 7.5 : maxOf(s.discard, function (y) { return handValue(s, me, y); });
      case 'bussola':
        if (i === 0) return h.length >= 3 ? 12 - costoScarti(s, me, 3, c) : NO;
        return x = bestSteal(s, me, 'unicorno') - 10, x;
      case 'lingua_dargento': return i === 0 ? 0.5 : 3 * others(s, me).filter(function (q) { return mano(s, q).length; }).length;
      case 'paletta': return !unicorni ? NO : i === 0 ? 12 + vince1 : 7 * Math.min(2, unicorni);
    }
    return 1;
  }
  // Le Magie dell'apocalisse: perdi tutti i tuoi unicorni, ne distruggi uno a testa agli altri e ne trovi uno nel mazzo.
  function apocalisseValue(s, me, k) {
    var mio = stalla(s, me).filter(function (c) { return K.isUni(c) && K.sacrificabile(s, me, c); }).reduce(function (a, c) { return a + lossValue(s, me, c); }, 0);
    var loro = others(s, me).reduce(function (a, q) {
      var o = opz(s, me, 'distruggi', { filtro: 'unicorno', magia: true, da: q });
      return a + (o.length ? maxOf(o, function (c) { return lossValue(s, q, c); }) * weight(s, me, q) : 0);
    }, 0);
    var trova = deckValue(s, me, null, k) ? 10 + (EXTRA[k] || 1) : 0;
    return loro + trova - mio;
  }
  // Unicorno della Pestilenza: quante carte scartare (le meno utili), se gli altri ne perdono di più.
  function pestilenzaPiano(s, me, senza) {
    var h = peggiori(s, me, mano(s, me).filter(function (c) { return c !== senza; }), 99), best = { v: 0, cards: [] }, cost = 0;
    for (var k = 1; k <= h.length; k++) {
      cost += handValue(s, me, h[k - 1]);
      var gain = others(s, me).reduce(function (a, q) { return a + Math.min(k, mano(s, q).length) * 2.5 * Math.max(0.3, weight(s, me, q)); }, 0);
      if (gain - cost > best.v) best = { v: gain - cost, cards: h.slice(0, k) };
    }
    return best;
  }
  // Attacco di tenerezza e Spruzzino: gli unicorni distrutti tornano come Cuccioli, conta l'effetto che si perde.
  function tenerezzaValue(s, me, q, quanti) {
    var o = opz(s, me, 'distruggi', { filtro: 'unicorno', magia: true, da: q }).map(function (c) { return lossValue(s, q, c) - 10; }).sort(function (a, b) { return b - a; });
    var k = Math.min(quanti, o.length), v = 0;
    for (var i = 0; i < k; i++) v += o[i] + (i < s.nursery.length ? 0 : 10);
    return v * weight(s, me, q);
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
  function deckValue(s, me, filtro, chiave) {
    var visti = {};
    s.discard.concat(mano(s, me)).forEach(function (c) { visti[c] = 1; });
    for (var q = 0; q < s.seats.length; q++) stalla(s, q).forEach(function (c) { visti[c] = 1; });
    var resto = K.mazzoPer(s.exp, s.seats.length).filter(function (c) {
      if (visti[c]) return false;
      var k = K.kind(c);
      if (chiave) return K.keyOf(c) === chiave;
      return filtro === 'narvalo' || filtro === 'drago' ? K.filtra(c, filtro) : k === filtro;
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
      case 'furioso': return v + Math.max(0, bestDestroy(s, me, 'unicorno'));
      case 'divino': return v + 4;
      case 'nanocorno': return v + Math.max(0, deckValue(s, me, 'bonus') + 2 - costoScarti(s, me, 1, c));
      case 'elficorno': return v + 1;
      case 'orchicorno': x = maxOf(stalla(s, me).filter(function (y) { return K.kind(y) === 'malus'; }), function (y) { return -stallaValue(s, me, y); }); return v + Math.max(0, x * 0.9) + (x > 0 ? 2 : 0);
      case 'cavaliere': return v + Math.max(0, bestDestroy(s, me, 'carta'));
      case 'furfante': return v + Math.max(0, bestSteal(s, me, 'carta') - costoScarti(s, me, 2, c));
      case 'stregone': return v + stregonePiano(s, me).v;
      case 'mago': return v + Math.max(0, 6 - costoScarti(s, me, 1, c));
      case 'capitano': return v + Math.max(0, valoreScelta(s, me, k, 0, c), valoreScelta(s, me, k, 1, c));
      case 'pescatore': return v + 4;
      case 'imbroglione': return v + Math.max(0, valoreScelta(s, me, k, 0, c), valoreScelta(s, me, k, 1, c));
      case 'saccheggiatore': return v + Math.max(0, valoreScelta(s, me, k, 0, c), valoreScelta(s, me, k, 1, c));
      case 'lupo_di_mare': return v + Math.max(3.5, valoreScelta(s, me, k, 0, c));
      case 'clandestino': return v + 5;
      // Draghi
      case 'dragocorno_arrabbiato': return v + others(s, me).reduce(function (a, q) { return a + (mano(s, q).length ? 2 * Math.max(0.3, weight(s, me, q)) : 0); }, 0) - Math.min(4, costoScarti(s, me, 1, c));
      case 'cavalcadraghi': return v + Math.max(0, bestMove(s, me, null, null, true).v);
      case 'evocadraghi': return v + Math.max(0, maxOf(s.discard.filter(function (y) { return K.filtra(y, 'drago'); }), function (y) { return handValue(s, me, y); }));
      case 'domadraghi': return v + deckValue(s, me, 'drago');
      case 'alchimista': return v + deckValue(s, me, 'magia') * 1.4;
      case 'dragotartaruga': return v + 3.5;
      case 'dragocorno_amico': return v + 3.5 - others(s, me).reduce(function (a, q) { return a + 1.5 * Math.max(0, weight(s, me, q)); }, 0);
      case 'alpacorno_zucchero': return v + others(s, me).reduce(function (a, q) { var m = menoCaro(s, q); return a + (m == null ? 0 : (m - 3) * Math.max(0.3, weight(s, me, q))); }, 0) - Math.max(0, (menoCaro(s, me) || 0) - 3);
      case 'bulldog': return v + 4 + others(s, me).reduce(function (a, q) { return a + (mano(s, q).length ? 2 * Math.max(0.3, weight(s, me, q)) : 0); }, 0);
      case 'brillantinato': return v + Math.max(0, maxOf(mano(s, me).filter(function (y) { return K.kind(y) === 'bonus'; }), function (y) { return stallaValue(s, me, y); }));
      case 'pestilenza': return v + pestilenzaPiano(s, me, c).v;
      case 'guerra': return v + Math.max(0, bestDestroy(s, me, 'unicorno')) - 3;
      case 'principessa': return v + 6;
      case 'volante_adorabile': case 'volante_squamoso': return v + others(s, me).reduce(function (a, q) {
        var o = opz(s, q, 'sacrifica', { filtro: 'carta' });
        return a + (o.length ? Math.max(0, -maxOf(o, function (y) { return -lossValue(s, q, y); })) * Math.max(0.3, weight(s, me, q)) : 0);
      }, 0) - Math.min(3, Math.max(0, sacrificeCost(s, me, 'carta')));
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
      case 'raso_al_suolo': return maxOf(opz(s, me, 'colpo'), function (y) { var q = K.padrone(s, y); return q === me ? -stallaValue(s, me, y) : stallaValue(s, q, y) * weight(s, me, q); });
      case 'voltagabbana': return bestSteal(s, me, 'unicorno') - costoScarti(s, me, 2, c);
      case 'raglio': return raglioPiano(s, me, c).v;
      case 'palla_di_fuoco': return others(s, me).reduce(function (a, q) { var m = menoCaro(s, q); return a + (m == null ? 0 : m * weight(s, me, q)); }, 0) - (menoCaro(s, me) || 0);
      case 'fulmine': return bestDestroy(s, me, 'carta', true) - 3;
      case 'negromanzia': x = opz(s, me, 'rianima'); return x.length ? maxOf(x, function (y) { return K.kind(y) === 'magico' ? enterValue(s, me, y) + 10 : 10; }) - sacrificeCost(s, me, 'unicorno') : 0;
      case 'corno_luminoso': case 'cercametalli': case 'bussola': case 'lingua_dargento': case 'paletta':
        return Math.max(0, valoreScelta(s, me, k, 0, c), valoreScelta(s, me, k, 1, c));
      case 'furto_di_culle': return Math.min(2, s.nursery.length) * 10 - costoScarti(s, me, 2, c) + (K.conta(s, me) + 2 >= s.goal && K.puoVincere(s, me) ? 200 : 0);
      // Draghi
      case 'alito_di_drago': return bestDestroy(s, me, 'unicorno', true, c);
      case 'fuoco_di_drago': return maxOf(opz(s, me, 'colpo'), function (y) { var q = K.padrone(s, y); return q === me ? -stallaValue(s, me, y) : stallaValue(s, q, y) * weight(s, me, q); });
      case 'bacio_del_drago': return deckValue(s, me, 'magia') * 1.4;
      case 'stalle_bruciate': return [me].concat(others(s, me)).reduce(function (a, q) {
        return a + stalla(s, q).reduce(function (b, y) { return b + (K.kind(y) === 'bonus' || K.kind(y) === 'malus' ? (q === me ? -stallaValue(s, me, y) : stallaValue(s, q, y) * weight(s, me, q)) : 0); }, 0);
      }, 0);
      // Diluvio arcobaleno
      case 'attacco_tenero': return maxOf(others(s, me), function (q) { return tenerezzaValue(s, me, q, 3); });
      case 'fuoco_e_zolfo': return apocalisseValue(s, me, 'cenere');
      case 'castigo_celeste': return apocalisseValue(s, me, 'angelo');
      case 'alpacalisse': return apocalisseValue(s, me, 'alpacorno');
      case 'sovrappopolazione': return apocalisseValue(s, me, 'fertile');
      case 'tempesta_tenerezza': return apocalisseValue(s, me, 'miciocorno');
      case 'distruzione_totale': return apocalisseValue(s, me, 'catastrofe');
      case 'apocalisse_zombi': return apocalisseValue(s, me, 'zombi');
      case 'unicorni_apocalisse': {
        var cheap = opz(s, me, 'sacrifica', { filtro: 'unicorno' }).map(function (y) { return lossValue(s, me, y); }).sort(function (a, b) { return a - b; });
        return cheap.length >= 4 ? 4 * 12 - cheap[0] - cheap[1] - cheap[2] - cheap[3] : -50;
      }
      case 'peste_nera': return stregonePiano(s, me).v;
      case 'spruzzino': return others(s, me).reduce(function (a, q) { return a + tenerezzaValue(s, me, q, 1); }, 0);
      case 'pisolino': return maxOf(others(s, me), function (q) { return 9 * weight(s, me, q); });
    }
    return 1;
  }
  // Cambio di rotta: la carta e la stalla di arrivo che rendono di più (B = quanto mi piace dove sta).
  function benefit(s, me, q, c) { return q === me ? stallaValue(s, me, c) : -stallaValue(s, q, c) * Math.max(0.2, weight(s, me, q)); }
  function bestMove(s, me, only, list, altrove) {
    var best = { v: -Infinity, c: null, to: -1 };
    (only ? [only] : list || opz(s, me, 'sposta', { altrove: altrove })).forEach(function (c) {
      var o = K.padrone(s, c);
      for (var d = 0; d < s.seats.length; d++) if (d !== o && K.entra(s, c, d) && !(list && d === me && o === me) && !(altrove && d === me)) {
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
      case 'alito_di_drago': return (K.has(s, me, 'ammazzadraghi') ? 0 : -pMe * myBest * 1.2) - 2 * wq;
      case 'fuoco_di_drago': return -pMe * maxOf(stalla(s, me), function (y) { return K.kind(y) === 'bonus' ? stallaValue(s, me, y) : 0; }) - 1;
      case 'bacio_del_drago': return -4 * wq;
      case 'stalle_bruciate': return -stalla(s, me).reduce(function (b, y) { return b + (K.kind(y) === 'bonus' || K.kind(y) === 'malus' ? stallaValue(s, me, y) : 0); }, 0) - 1;
      case 'attacco_tenero': {
        var tre = stalla(s, me).filter(function (y) { return K.isUni(y) && K.distruggibile(s, me, y, true, c); })
          .map(function (y) { return lossValue(s, me, y) - 10; }).sort(function (x, y) { return y - x; }).slice(0, 3);
        return -pMe * Math.max(0, tre.reduce(function (x, y) { return x + y; }, 0)) - 2 * wq;
      }
      case 'fuoco_e_zolfo': case 'castigo_celeste': case 'alpacalisse': case 'sovrappopolazione': case 'tempesta_tenerezza': case 'distruzione_totale': case 'apocalisse_zombi':
        return -myBest * 1.1 - 3 * wq;
      case 'unicorni_apocalisse': return -12 * wq;
      case 'peste_nera': return -pMe * myBest * 1.4 - 3 * wq;
      case 'spruzzino': return -Math.max(0, myBest - 10) - 2 * wq;
      case 'pisolino': return -pMe * 9 - 1;
      case 'possessione': return -pMe * 7 - 2 * wq;
      case 'fuori_dalla_tomba': return (K.conta(s, q) + 1 >= s.goal && K.puoVincere(s, q) ? -300 : -10 * wq);
      case 'piu_spettro': return -pMe * 10 * stalla(s, me).filter(function (y) { return K.kind(y) === 'semplice'; }).length - 2 * wq;
      case 'seduta_spiritica': return -pMe * 10 - 1;
      case 'raso_al_suolo': return -pMe * maxOf(stalla(s, me), function (y) { return K.kind(y) === 'bonus' ? stallaValue(s, me, y) : 0; }) - 1;
      case 'voltagabbana': return -pMe * 10 - 2 * wq;
      case 'raglio': return -pMe * 8 - 2 * wq;
      case 'palla_di_fuoco': return (menoCaro(s, me) != null ? -8 : 0) - 2 * wq;
      case 'fulmine': return -pMe * myBest * 1.2 - 2 * wq;
      case 'negromanzia': return -6 * wq;
      case 'furto_di_culle': return (K.conta(s, q) + 2 >= s.goal && K.puoVincere(s, q) ? -300 : -15 * wq);
      case 'bussola': return -10 * wq;
      case 'corno_luminoso': return -pMe * 8 - 2 * wq;
      case 'paletta': return -8 * wq;
      case 'cercametalli': case 'lingua_dargento': return -3 * wq;
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
    // prima i Nitriti che fanno più danno a chi è fermato; il Supernitrito per le carte decisive
    var plain = mine.filter(function (c) { return NITRITI.indexOf(K.keyOf(c)) >= 0; }).sort(function (a, b) { return NITRITI.indexOf(K.keyOf(a)) - NITRITI.indexOf(K.keyOf(b)); });
    var sup = mine.filter(function (c) { return K.keyOf(c) === 'supernitrito'; });
    var use = function (c) { return { type: 'answer', cards: [c], pid: P.id }; };
    if (lv === 'facile') return (e < -6 && rnd() < 0.3) ? use(mine[0]) : pass;
    if (lv === 'medio') {
      // medio: difende le proprie carte solo se sono decisive e ogni tanto si distrae
      if (i % 2 === 1 && ch[i - 1].p === me && e > -150) return pass;
      if (rnd() < 0.15 || e > -10) return pass;
      return use(mine[0]);
    }
    // (con le espansioni i Nitriti contano di più: molti fanno anche un effetto, e le carte da fermare sono di più)
    var soglia = mine.length > 1 ? 7 : 12;
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
          else if (src === 'furfante') gain = bestSteal(s, me, 'carta');
          else if (src === 'nanocorno') gain = deckValue(s, me, 'bonus') + 2;
          else if (src === 'mago') gain = 6;
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
        var bm = bestMove(s, me, null, o, P.src && K.keyOf(P.src) === 'cavalcadraghi');
        if (P.may && !(bm.v > 0)) return no;
        return one(bm.c || o[0]);
      }
      case 'esilia': {
        var ex = argmax(o, function (c) { return exileValue(s, me, c); });
        if (P.may && exileValue(s, me, ex) <= 0.5) return no;
        return one(ex);
      }
      case 'evoca': return one(argmax(o, function (c) { return INCUBO[K.keyOf(c)] || 0; }));
      case 'stregone': {
        var sp = stregonePiano(s, me);
        return sp.cards.length ? { type: 'answer', cards: sp.cards, pid: P.id } : no;
      }
      case 'raglio': return { type: 'answer', cards: peggiori(s, me, o, Math.min(n, raglioPiano(s, me).n)), pid: P.id };
      case 'divino': return one(argmax(o, function (c) { return handValue(s, me, c); }));
      case 'scruta': return one(argmin(o, function (c) { return handValue(s, me, c); }));
      case 'mago': return one(argmax(o, function (c) { return MANO[K.keyOf(c)] || 4; }));
      case 'scambio': return one(argmin(o, function (c) { return lossValue(s, me, c); }));
      case 'indovino':
        if (P.fase === 'cima') return one(argmin(o, function (c) { return handValue(s, me, c); }));
        return one(argmax(o, function (c) { return handValue(s, me, c); }));
      case 'cerca': case 'recupera': case 'pesca_mano': case 'arraffa':
        return one(argmax(o, function (c) { return handValue(s, me, c); }));
      case 'rianima':
        pk = argmax(o, function (c) { return K.kind(c) === 'magico' ? 10 + enterValue(s, me, c) : 10; });
        return one(pk);
      case 'dalla_mano':
        if (P.filtro === 'bonus') { var bb = argmax(o, function (c) { return stallaValue(s, me, c); }); return P.may && stallaValue(s, me, bb) <= 0 ? no : one(bb); }
        return one(o[0]);
      case 'nido': return one(o[0]);
      // Sfortuna del drago: la carta che serve meno; Cieli dei draghi: l'unicorno che costa meno (un Cucciolo non fa pescare)
      case 'in_fondo': return one(peggiori(s, me, o, 1)[0]);
      case 'raccogli': return one(argmax(o, function (c) { return handValue(s, me, c); }));
      case 'pestilenza': { var pp = pestilenzaPiano(s, me); return pp.cards.length ? { type: 'answer', cards: pp.cards, pid: P.id } : no; }
      case 'tenerezza': return { type: 'answer', cards: o.slice().sort(function (a, b) { return lossValue(s, K.padrone(s, b), b) - lossValue(s, K.padrone(s, a), a); }).slice(0, n), pid: P.id };
      case 'sotto': return one(argmin(o, function (c) { return stallaValue(s, me, c) - (K.kind(c) === 'cucciolo' ? 0 : 3.5); }));
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
        case 'domatore': v = 6.5; break;
        case 'avventuriero': v = 3; break;
        case 'vagabondo': v = 4 - worst(1); break;
        case 'sopravvissuto': v = maxOf(stalla(s, me).filter(function (y) { return K.kind(y) === 'malus'; }), function (y) { return -stallaValue(s, me, y); }) - worst(1); break;
        case 'rito_antico': v = 10.5 - sacrificeCost(s, me, 'unicorno'); break;
        case 'buca': v = bestSteal(s, me, 'unicorno') - stallaValue(s, me, c); break;
        case 'zoccoli_reali': v = 1.5; break;
        case 'fortuna_drago': v = 9 - stallaValue(s, me, c); break;
        case 'angelo': v = maxOf(s.discard.filter(function (y) { return K.isUni(y) && K.entra(s, y, me); }).concat([c]), function (y) { return 10 + (K.kind(y) === 'magico' ? enterValue(s, me, y) : 0); }) - stallaValue(s, me, c); break;
        case 'fertile': v = (s.nursery.length ? 10 : 0) - worst(1); break;
        case 'morte': v = bestDestroy(s, me, 'unicorno') - sacrificeCost(s, me, 'unicorno'); break;
        case 'zombi': v = maxOf(s.discard.filter(function (y) { return K.isUni(y) && K.entra(s, y, me); }), function (y) { return 10 + (K.kind(y) === 'magico' ? enterValue(s, me, y) : 0); })
          - maxOf(h.filter(K.isUni), function (y) { return -handValue(s, me, y); }) * -1 - 9; break;
        case 'zuccherini': v = 3 * 3.5 - 9 + (h.length < 2 ? 3 : 0); break;
        case 'consegna_speciale': v = (s.nursery.length ? 10 : 0) - 6; break;
        case 'bardo': v = 3.5 + (opz(s, me, 'ruba', { filtro: 'unicorno' }).length || !K.has(s, me, 'cavaliere') ? 0 : -12) + maxOf(others(s, me), function (q) {
          var via = stallaValue(s, me, c) + stallaValue(s, q, c) * weight(s, me, q);
          var meglio = maxOf(stalla(s, q).filter(function (y) { return K.isUni(y) && K.entra(s, y, me); }), function (y) { return stallaValue(s, me, y) + lossValue(s, q, y) * weight(s, me, q); });
          return Math.max(meglio, via) - via;
        }); break;
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
    if (P.op === 'raglio') return t(argmax(o, function (q) { var m = menoCaro(s, q); return m == null ? -1 : m * weight(s, me, q); }));
    if (P.op === 'passa_maleficio') return t(argmax(o, function (q) { return weight(s, me, q); }));
    if (src === 'bardo') return t(argmax(o, function (q) { return maxOf(stalla(s, q).filter(function (y) { return K.isUni(y) && K.entra(s, y, me); }), function (y) { return stallaValue(s, me, y) + lossValue(s, q, y) * weight(s, me, q); }); }));
    if (src === 'piu_spettro') return t(argmax(o, function (q) { return strageValue(s, me, q); }));
    if (src === 'attacco_tenero') return t(argmax(o, function (q) { return tenerezzaValue(s, me, q, 3); }));
    if (src === 'pisolino') return t(argmax(o, function (q) { return weight(s, me, q); }));
    if (src === 'baratto') return t(argmax(o, function (q) { return mano(s, q).length; }));
    if (src === 'imbroglione') return t(argmax(o, function (q) { return mano(s, q).length; }));
    if (src === 'arraffa' || src === 'mano_lesta' || src === 'pipistrellicorno' || src === 'poltergeist' || src === 'pescatore' || src === 'vagabondo' || src === 'zoccoli_reali') return t(argmax(o, function (q) { return mano(s, q).length + threat(s, q) * 3; }));
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
      case 'si': return { type: 'answer', yes: P.q === 'mietitore' ? true : P.q === 'critico' ? playValue(s, me, { card: P.c }) > 5 : bestDestroy(s, me, 'unicorno') > 10, pid: P.id };
      case 'scelta': {
        var c = P.c, keep = lossValue(s, me, c, true);
        if (P.opts.indexOf('scarta') >= 0 && !P.mono && keep > 4 && peggiori(s, me, mano(s, me), 1).some(function (x) { return handValue(s, me, x) < 9; })) return { type: 'answer', pick: 'scarta', pid: P.id };
        if (P.opts.indexOf('paladino') >= 0 && keep > 13) return { type: 'answer', pick: 'paladino', pid: P.id };
        if (P.opts.indexOf('scarta2') >= 0 && !P.mono && keep > 8 && peggiori(s, me, mano(s, me), 2).every(function (x) { return handValue(s, me, x) < 8; })) return { type: 'answer', pick: 'scarta2', pid: P.id };
        return { type: 'answer', pick: 'no', pid: P.id };
      }
      case 'ogni': {
        var o = P.opts[me] || [];
        var pick = P.cosa === 'scarta' || P.cosa === 'dai' ? peggiori(s, me, o, 1)[0] : argmin(o, function (x) { return lossValue(s, me, x); });
        return { type: 'answer', cards: [pick], pid: P.id };
      }
      case 'opzione': {
        var k = P.src ? K.keyOf(P.src) : '', best = argmax(P.opts, function (i) { return valoreScelta(s, me, k, i, P.src); });
        if (best == null) best = P.opts[0];
        if (P.may && !(valoreScelta(s, me, k, best, P.src) > 0)) return { type: 'answer', skip: true, pid: P.id };
        return { type: 'answer', pick: best, pid: P.id };
      }
      case 'vedi': return { type: 'answer', yes: true, pid: P.id };
      // Principessa Arcobaleno: io (2 carte) e chi è così indietro che una carta in più non gli serve a vincere
      case 'giocatori': return { type: 'answer', targets: P.opts.filter(function (q) { return q === me || (weight(s, me, q) < 0.3 && K.conta(s, q) < s.goal - 2); }), pid: P.id };
      case 'reazione': {
        var mia = mano(s, me).filter(function (x) { return K.def(x).rea === P.tipo; })[0], gioca = false;
        if (P.tipo === 'ruba') gioca = P.q === me ? lossValue(s, me, P.c) > 4 : stallaValue(s, me, P.c) > 5;
        else if (P.tipo === 'via') gioca = P.q === me ? (K.kind(P.c) !== 'malus' && lossValue(s, me, P.c) > 6) : (K.kind(P.c) !== 'malus' && handValue(s, me, P.c) > 6);
        else gioca = threat(s, P.by) >= 0.6 || weight(s, me, P.by) > 1;
        if (lv === 'facile' && rnd() < 0.5) gioca = !gioca;
        return mia && gioca ? { type: 'answer', cards: [mia], pid: P.id } : { type: 'answer', pass: true, pid: P.id };
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
