/* Temi di Diavolerie: l'elenco dei temi e i disegni delle carte per quelli che cambiano anche i personaggi.

   «Notte» è il tavolo di sempre, con le emoji. «Cemento» (graffiti sul muro, chiaro) e «Vecchia scuola»
   (tatuaggi da marinaio, scuro) disegnano ogni carta in SVG 64×64: stesse forme nei due temi, ma colori e tratto
   del tema (tavolozze in PAL). I bambini nascono da pezzi scelti dal nome della carta (capelli, carnagione presa
   dall'emoji, maglia, espressione: dolce, peste o niente); animali, demoni e candele sono disegnati uno per uno.
   Grafica nostra: niente illustrazioni dell'editore del gioco originale.
   Uso: DiavolerieTemi.arte(K.info(uid), 'cemento') → '<svg …>…</svg>' (stringa vuota per «Notte»). */
(function (root) {
  'use strict';

  // I temi coi disegni (nomi, colori e caratteri dei temi stanno in lib/temi.js, uguali per tutti i giochi).
  var TEMI = ['notte', 'cemento', 'vecchia', 'gesso', 'neon', 'fumetto', 'spettrale'].map(function (id) { return { id: id, disegni: id !== 'notte' }; });

  // pelle: [senza tono, 🏻, 🏼, 🏽, 🏾, 🏿]
  var PAL = {
    vecchia: {
      o: '#1b1b1b', sw: 2.6, occhio: '#1b1b1b', luce: '#ffffff', bianco: '#f8f1de', crema: '#f6efe2', fantasma: '#f3efe2',
      pelle: ['#f2c79c', '#f6d2b0', '#f0c9a0', '#d9a066', '#a86a3d', '#7a4527'],
      capelli: ['#f0c43c', '#2b2b2b', '#7a4a24', '#c8572d', '#4a2c17'],
      maglie: ['#c8372d', '#2a7f8f', '#3f8a4e', '#f0c43c', '#e46a8a', '#7a4ea3'],
      rosso: '#c8372d', giallo: '#f0c43c', verde: '#3f8a4e', verde2: '#7f9a3a', blu: '#2a7f8f', rosa: '#e46a8a', viola: '#7a4ea3',
      guance: '#ef8f8f', lingua: '#e0636b', arancio: '#e8742b', arancio2: '#f0913f', marrone: '#c0803f', marrone2: '#6b3f1f',
      marrone3: '#8b5a2b', beige: '#e9c890', grigio: '#9a9a9a', grigio2: '#4f4f4f', nero: '#2c2c2c', osso: '#f0e1b0',
      acqua: '#d9f0f5', gatto: '#8fd16a', pipi: '#4a3a5c', pallido: '#dfe6d2'
    },
    cemento: {
      o: '#151515', sw: 3, occhio: '#151515', luce: '#ffffff', bianco: '#ffffff', crema: '#ffffff', fantasma: '#ffffff',
      pelle: ['#ffd2a8', '#ffe0c2', '#ffd2a8', '#e0a46a', '#b06f3e', '#8c5530'],
      capelli: ['#ffd23f', '#151515', '#a0522d', '#ff6a1f', '#5a3418'],
      maglie: ['#ff3b3b', '#1fb5e8', '#7ad83b', '#ffd23f', '#ff4f9a', '#8e44ff'],
      rosso: '#ff3b3b', giallo: '#ffd23f', verde: '#7ad83b', verde2: '#a6c93a', blu: '#1fb5e8', rosa: '#ff4f9a', viola: '#8e44ff',
      guance: '#ff8fb1', lingua: '#ff4f9a', arancio: '#ff6a1f', arancio2: '#ff8a1f', marrone: '#d98b3a', marrone2: '#7a4520',
      marrone3: '#9a5e2a', beige: '#ffe0a3', grigio: '#8f8f8f', grigio2: '#3d3d3d', nero: '#232323', osso: '#fff2c2',
      acqua: '#bdf2ff', gatto: '#7ad83b', pipi: '#5a3d8a', pallido: '#e8f0dc'
    }
  };

  /* ---------- Gessetto, Neon e Fumetto: stesse forme, ma disegnate in un altro modo ----------
     fo: trasparenza dei colori (il gesso lascia vedere la lavagna); filtro: un filtro di defs() sopra tutto il disegno. */
  PAL.gesso = {
    o: '#f1eee4', sw: 2.4, fo: 0.9, filtro: 'dvf-gesso', occhio: '#26332c', luce: 'none', bianco: '#ecebe4', crema: '#efe6cf', fantasma: '#ecebe4',
    pelle: ['#f2c6a2', '#f6d6bd', '#f1c7a3', '#d8a479', '#b48662', '#94674b'],
    capelli: ['#f6df86', '#8d9893', '#c79a6b', '#f0a06a', '#a47a5a'],
    maglie: ['#f28b82', '#8ecae6', '#a8d8a0', '#f6df86', '#f4a8c6', '#c3a6e8'],
    rosso: '#f28b82', giallo: '#f6df86', verde: '#a8d8a0', verde2: '#c5d98a', blu: '#8ecae6', rosa: '#f4a8c6', viola: '#c3a6e8',
    guance: '#f4a8a8', lingua: '#f28b9a', arancio: '#f5b17a', arancio2: '#f7c48e', marrone: '#d9b38c', marrone2: '#a88468',
    marrone3: '#c09a76', beige: '#efd9b0', grigio: '#c4c9c6', grigio2: '#8d9893', nero: '#5f6a65', osso: '#f1e8c8',
    acqua: '#d6eef5', gatto: '#b9e3a0', pipi: '#9b8fb3', pallido: '#e2ead8'
  };
  // Neon: tutto pieno del colore del gettone, così restano solo i contorni, che sono «tubi» del colore del tipo (CSS: color).
  PAL.neon = (function () {
    var p = {}, buio = '#0f0a14';
    for (var k in PAL.cemento) p[k] = Array.isArray(PAL.cemento[k]) ? PAL.cemento[k].map(function () { return buio; }) : buio;
    p.o = 'currentColor'; p.sw = 2.2; p.occhio = 'currentColor'; p.luce = 'none';
    return p;
  })();
  // Fumetto: i colori grandi hanno il retino (puntini più scuri), come nella stampa dei fumetti.
  var RETINI = {};
  function scuro(c, k) {
    var v = parseInt(c.slice(1), 16);
    return '#' + [v >> 16, (v >> 8) & 255, v & 255].map(function (x) { return ('0' + Math.round(x * (1 - k)).toString(16)).slice(-2); }).join('');
  }
  function retino(c) { var id = 'dvr-' + c.slice(1); RETINI[id] = c; return 'url(#' + id + ')'; }
  PAL.fumetto = (function () {
    var base = {
      o: '#111111', sw: 3.2, occhio: '#111111', luce: '#ffffff', bianco: '#ffffff', crema: '#fffdf2', fantasma: '#ffffff',
      pelle: ['#ffd0b0', '#ffe0c8', '#ffd0b0', '#e8a878', '#b97a4c', '#8d5634'],
      capelli: ['#ffe03a', '#1a1a1a', '#b5651d', '#ff6b1a', '#6b3a1a'],
      maglie: ['#ff2a2a', '#1e90ff', '#2ecc40', '#ffe03a', '#ff4fa3', '#9b4dff'],
      rosso: '#ff2a2a', giallo: '#ffe03a', verde: '#2ecc40', verde2: '#a3d12e', blu: '#1e90ff', rosa: '#ff4fa3', viola: '#9b4dff',
      guance: '#ff8fb1', lingua: '#ff4f7a', arancio: '#ff7a1a', arancio2: '#ff9a2a', marrone: '#d9893a', marrone2: '#7a4520',
      marrone3: '#a0602a', beige: '#ffe0a8', grigio: '#a8a8a8', grigio2: '#4a4a4a', nero: '#1a1a1a', osso: '#fff3c4',
      acqua: '#c4f0ff', gatto: '#2ecc40', pipi: '#5a3d8a', pallido: '#eef5e0'
    };
    var piatti = ['o', 'sw', 'occhio', 'luce', 'bianco', 'crema', 'fantasma', 'guance', 'lingua', 'nero', 'marrone2', 'grigio2', 'pipi'], p = {};
    for (var k in base) p[k] = piatti.indexOf(k) >= 0 ? base[k] : Array.isArray(base[k]) ? base[k].map(retino) : retino(base[k]);
    return p;
  })();
  // Spettrale: ombre nere contro la luna piena (il gettone), solo gli occhi accesi; i fantasmi bianchi, le fiamme vive.
  PAL.spettrale = (function () {
    var p = {}, ombra = '#160c18';
    for (var k in PAL.cemento) p[k] = Array.isArray(PAL.cemento[k]) ? PAL.cemento[k].map(function () { return ombra; }) : ombra;
    p.sw = 2.2; p.occhio = '#ffe066'; p.luce = 'none'; p.fantasma = '#f1ecf7'; p.fiamma = '#fff1a8'; p.fiamma2 = '#9dff6a';
    return p;
  })();
  // Il filtro del gesso e i retini, da mettere una volta sola nella pagina (un <svg> nascosto): i disegni li usano con url(#...).
  function defs() {
    var s = '<filter id="dvf-gesso" x="-8%" y="-8%" width="116%" height="116%">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="2" seed="4" result="r"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="r" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
        '<feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="9" result="g"/>' +
        '<feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 0 0 0 1.72" result="m"/>' +
        '<feComposite in="d" in2="m" operator="in"/></filter>';
    for (var id in RETINI) s += '<pattern id="' + id + '" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="3.4" height="3.4" fill="' + RETINI[id] + '"/><circle cx="1.7" cy="1.7" r="1" fill="' + scuro(RETINI[id], 0.22) + '"/></pattern>';
    return s;
  }

  /* ---------- pezzi ---------- */
  var NS = ' stroke="none"';
  function n(v) { return Math.round(v * 100) / 100; }
  function pa(d, f, x) { return '<path d="' + d + '" fill="' + (f || 'none') + '"' + (x || '') + '/>'; }
  function ci(cx, cy, r, f, x) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (f || 'none') + '"' + (x || '') + '/>'; }
  function el(cx, cy, rx, ry, f, x) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + (f || 'none') + '"' + (x || '') + '/>'; }
  function sw(w) { return ' stroke-width="' + w + '"'; }
  function st(c, w) { return ' stroke="' + c + '"' + (w ? sw(w) : ''); }
  function oc(p, x, y, r) { r = r || 2.2; return ci(x, y, r, p.occhio, NS) + ci(n(x + r * 0.36), n(y - r * 0.36), n(r * 0.32), p.luce, NS); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function stella(cx, cy, R, r, k) {
    var d = '';
    for (var i = 0; i < k * 2; i++) {
      var a = Math.PI * i / k - Math.PI / 2, q = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + n(cx + q * Math.cos(a)) + ' ' + n(cy + q * Math.sin(a));
    }
    return d + 'z';
  }
  // Un disegno spostato e rimpicciolito (i demoni con più teste): il tratto si assottiglia insieme al disegno.
  function gruppo(x, y, s, dentro) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + dentro + '</g>'; }

  /* ---------- bambini ---------- */
  var TONI = ['🏻', '🏼', '🏽', '🏾', '🏿'];
  function tono(art) { for (var i = 0; i < TONI.length; i++) if (String(art || '').indexOf(TONI[i]) >= 0) return i + 1; return 0; }

  function faccia(t, p, h) {
    var s = '';
    if (t === 'R') {   // peste: occhiolino, ghigno e lingua fuori
      s += pa('M24.8 33.5c1.4-1.5 3.6-1.5 5 0') + oc(p, 37, 33);
      s += pa('M27 39c3 1.6 7 1.1 9.5-1.4') + pa('M31.5 39.8c0 3 4 3 4 .2', p.lingua);
      if (h & 2) s += pa('M38.5 36.5l5-1.8 .9 2.4-5 1.8z', p.crema, sw(1.3));   // cerotto
    } else if (t === 'S') {   // dolce: occhioni, guance rosa e sorriso
      s += oc(p, 27, 33) + oc(p, 37, 33);
      s += ci(23.8, 37.6, 2.3, p.guance, NS) + ci(40.2, 37.6, 2.3, p.guance, NS);
      s += pa('M28.5 38.5c2 2.2 5 2.2 7 0');
    } else {
      s += oc(p, 27, 33, 2) + oc(p, 37, 33, 2);
      if (h & 2) s += ci(27, 33, 3.8) + ci(37, 33, 3.8) + pa('M30.8 33h2.4');   // occhiali
      else s += ci(24.4, 37, .9, p.marrone2, NS) + ci(26.4, 38.2, .9, p.marrone2, NS) + ci(39.6, 37, .9, p.marrone2, NS) + ci(37.6, 38.2, .9, p.marrone2, NS);
      s += pa('M29 39c1.8 1.4 4.2 1.4 6 0');
    }
    return s;
  }
  function bimbo(I, p) {
    var h = hash(I.id), bimba = I.k === 'G';
    var pelle = p.pelle[tono(I.art)], capelli = p.capelli[h % p.capelli.length];
    var maglia = p.maglie[(h >>> 4) % p.maglie.length], stile = (h >>> 8) % 4;
    var acc = I.t === 'R' ? p.verde : I.t === 'S' ? p.rosa : p.blu;
    var dietro = '', davanti = '', orecchie = true;
    if (bimba) {
      if (stile === 0) {   // codini con i fiocchi
        dietro = ci(14, 31, 6.5, capelli) + ci(50, 31, 6.5, capelli);
        davanti = pa('M18 30c0-9 6-15 14-15s14 6 14 15c-4-5-9-6.5-14-5.5-5-1-10 .5-14 5.5z', capelli) +
          pa('M10 22.5l4 2.5-4 2.5zM18 22.5l-4 2.5 4 2.5zM46 22.5l4 2.5-4 2.5zM54 22.5l-4 2.5 4 2.5z', acc);
      } else if (stile === 1) {   // caschetto
        dietro = pa('M16 44V30c0-9 7-15 16-15s16 6 16 15v14h-7V36H23v8z', capelli);
        davanti = pa('M18 28c2-7 7-10 14-10s12 3 14 10c-5-2-9-2.5-14-2.5s-9 .5-14 2.5z', capelli);
        orecchie = false;
      } else if (stile === 2) {   // coda di cavallo
        dietro = pa('M43 21c8 2 11 10 8 21-2-4-5-7-9-8z', capelli);
        davanti = pa('M18 31c0-10 6-16 14-16s14 6 14 16c-5-6-10-8-15-7-4 1-9 3-13 7z', capelli) + ci(45, 22.5, 2.3, acc);
      } else {   // trecce
        dietro = ci(16, 38, 3.5, capelli) + ci(15.5, 44, 3.3, capelli) + ci(16, 50, 3, capelli) +
          ci(48, 38, 3.5, capelli) + ci(48.5, 44, 3.3, capelli) + ci(48, 50, 3, capelli);
        davanti = pa('M18 31c0-10 6-15 14-15s14 5 14 15c-3-4-7-7-14-7s-11 3-14 7z', capelli) + pa('M32 16.5v7');
      }
    } else if (stile === 0) {   // capelli corti col ciuffo
      davanti = pa('M18 30c0-9 6-15 14-15s14 6 14 15c-5-3-9-4-14-3.5-5-.5-9 .5-14 3.5z', capelli) + pa('M31 15.5c-1.5-4 2.5-6 4.5-4');
    } else if (stile === 1) {   // berretto da marinaio
      davanti = pa('M19 26c0-6 6-10 13-10s13 4 13 10z', p.bianco) + '<rect x="16.5" y="24.5" width="31" height="5" rx="2.5" fill="' + acc + '"/>';
    } else if (stile === 2) {   // spettinato
      davanti = pa('M18 30l-1-9 5 3 2-7 4 5 4-7 3 7 5-5 1 7 5-2-2 8c-5-3-9-4-14-3.5-5-.5-9 .5-14 3.5z', capelli);
    } else {   // cappellino con la visiera
      davanti = pa('M18 27c0-7 6-12 14-12s14 5 14 12z', maglia) + pa('M30 27h19c2 0 2 3 0 3H30z', maglia);
    }
    return pa('M12 66c1-10 9-14 20-14s19 4 20 14z', maglia) + '<rect x="28" y="40" width="8" height="13" fill="' + pelle + '"/>' + dietro +
      (orecchie ? ci(18, 33, 3.2, pelle) + ci(46, 33, 3.2, pelle) : '') + ci(32, 32, 14, pelle) + davanti + faccia(I.t, p, h);
  }

  /* ---------- animali ---------- */
  function cane(p, pelo, orecchie, arrabbiato) {
    var s = arrabbiato ? pa('M20 27l-5-13 11 6z', orecchie) + pa('M44 27l5-13-11 6z', orecchie)
      : pa('M18 22c-6 2-8 12-5 18 3-1 6-6 7-11z', orecchie) + pa('M46 22c6 2 8 12 5 18-3-1-6-6-7-11z', orecchie);
    s += pa('M20 27c0-8 5-11 12-11s12 3 12 11v8c0 9-5 13-12 13s-12-4-12-13z', pelo) + el(32, 39.5, 8, 6.5, p.crema);
    s += pa('M28.5 35.5h7c0 3-2 4.5-3.5 4.5s-3.5-1.5-3.5-4.5z', p.o);
    if (arrabbiato) {
      s += pa('M23 26.5l7 3M41 26.5l-7 3') + ci(27, 31, 2, p.occhio, NS) + ci(37, 31, 2, p.occhio, NS);
      s += pa('M26 43.5c4-2.5 8-2.5 12 0') + pa('M28.5 42.6l1.4 2.6 1.4-2.3M32.7 42.3l1.4 2.6 1.4-2.3', p.bianco, sw(1.4));
      s += pa('M21 47c7 4 15 4 22 0v4c-7 4-15 4-22 0z', p.o) + pa('M24.5 51.5l1.5 3 1.5-2.5M31 52.5l1 3.5 1-3.5M36.5 51.5l1.5 2.5 1.5-3', p.bianco, sw(1.4));
      s += pa('M48 12l4 4M52 12l-4 4', null, st(p.rosso, 2.4));
    } else {
      s += pa('M32 40v2.5M28.5 42.5c1.5 1.5 3.5 1.5 3.5 .5 0 1 2 1 3.5-.5') + oc(p, 26.5, 29.5) + oc(p, 37.5, 29.5);
      s += pa('M21 47c7 4 15 4 22 0v4c-7 4-15 4-22 0z', p.rosso) + ci(32, 55.5, 3, p.giallo);
    }
    return s;
  }
  function gatto(p, pelo, occhi, randagio) {
    var s = pa('M17 29l2-15 10 8z', pelo) + (randagio ? pa('M47 29l-2-15-3.5 3 1.5 2.5-6 2.5z', pelo) : pa('M47 29l-2-15-10 8z', pelo));
    if (!randagio) s += pa('M20.5 24l1-6 4 3zM43.5 24l-1-6-4 3z', p.rosa, NS);
    s += el(32, 36, 16, 14, pelo);
    if (randagio) s += pa('M27 24.5l1.2 4M32 23.5v4.5M37 24.5l-1.2 4', null, sw(2)) + pa('M17.5 35h4M17 38.5l4-1M46.5 35h-4M47 38.5l-4-1', null, sw(1.8));
    s += el(25.5, 34, 3.5, 3.9, occhi, NS) + el(38.5, 34, 3.5, 3.9, occhi, NS) + pa('M25.5 31.2v5.6M38.5 31.2v5.6', null, sw(1.8));
    s += pa('M30.5 40h3l-1.5 2z', p.rosa, NS);
    var baffi = randagio ? p.o : p.crema;
    s += pa('M32 42c-1 2-3 2-4 1M32 42c1 2 3 2 4 1', null, st(baffi, 1.5));
    if (!randagio) s += pa('M22 41l-9-1M22 43.5l-8 2M42 41l9-1M42 43.5l8 2', null, st(baffi, 1.4));
    else s += pa('M37.5 41.5l6-2.2 1.1 2.9-6 2.2z', p.crema, sw(1.4));   // cerotto
    return s;
  }
  function capra(p, pelo, corna, occhiali) {
    var s = pa('M22 22c-6-4-8-12-3-16 0 5 3 8 7 10zM42 22c6-4 8-12 3-16 0 5-3 8-7 10z', corna);
    s += pa('M18 30c-6-1-9 2-10 5 4 1 8 0 11-2zM46 30c6-1 9 2 10 5-4 1-8 0-11-2z', pelo);
    s += pa('M22 24c0-6 5-9 10-9s10 3 10 9v14c0 7-4 12-10 12s-10-5-10-12z', pelo) + pa('M29 49l3 9 3-9z', p.grigio);
    if (occhiali) s += pa('M22.5 29h8v3.2a4 4 0 0 1-8 0zM33.5 29h8v3.2a4 4 0 0 1-8 0z', p.o) + pa('M30.5 30h3');
    else s += el(27, 31, 2.8, 2.2, p.giallo) + el(37, 31, 2.8, 2.2, p.giallo) + pa('M25.6 31h2.8M35.6 31h2.8', null, sw(1.6));
    return s + pa('M29 44c1.5 1 4.5 1 6 0') + ci(29.5, 41, .9, p.o, NS) + ci(34.5, 41, .9, p.o, NS);
  }
  var ANIMALI = {
    fido: function (p) { return cane(p, p.marrone, p.marrone2, false); },
    rabbioso: function (p) { return cane(p, p.grigio, p.grigio2, true); },
    coniglio: function (p) {
      return pa('M24 31c-6-6-7-19-2-23 4 2 6 13 6 21z', p.fantasma) + pa('M40 31c6-6 7-19 2-23-4 2-6 13-6 21z', p.fantasma) +
        pa('M24.3 26c-3-4-3.5-12-1.5-15 2 2 3 8 3 13z', p.rosa, NS) + pa('M39.7 26c3-4 3.5-12 1.5-15-2 2-3 8-3 13z', p.rosa, NS) +
        el(32, 39, 14, 12.5, p.fantasma) + oc(p, 26.5, 37) + oc(p, 37.5, 37) +
        ci(24, 42, 2, p.guance, NS) + ci(40, 42, 2, p.guance, NS) + pa('M30.5 41.5h3l-1.5 1.8z', p.rosa) +
        pa('M32 43.3v1.4M29.5 45c1.2 1 2.5 1 2.5-.2 0 1.2 1.3 1.2 2.5.2') + pa('M30.4 45.2h3.2v3.2h-3.2z', p.bianco, sw(1.4));
    },
    micio: function (p) { return gatto(p, p.nero, p.gatto, false); },
    randagio: function (p) { return gatto(p, p.grigio, p.giallo, true); },
    pescerosso: function (p) {
      return pa('M44 32l12-9c-2 6-2 12 0 18z', p.arancio) + pa('M24 22c2-6 8-8 13-6-1 3-3 5-5 6', p.arancio) + pa('M26 43c1 4 4 6 8 6-1-2-1-4 0-6', p.arancio) +
        pa('M9 32c4-10 14-14 24-12 6 1 10 6 11 12-1 6-5 11-11 12-10 2-20-2-24-12z', p.arancio2) + pa('M27 26c2 4 2 8 0 12') +
        pa('M33 27c1.5 1.5 1.5 3.5 0 5M38 30c1.5 1.5 1.5 3.5 0 5', null, sw(1.8)) + ci(19, 30, 4, p.bianco) + ci(19.8, 30, 2, p.occhio, NS) +
        pa('M10.5 33.5c1.5 0 2.5.8 3 1.8') + ci(9, 19, 2.2, p.acqua) + ci(13, 13, 1.6, p.acqua);
    },
    pappagallo: function (p) {
      return pa('M36 50l9 12-11-2z', p.blu) + pa('M20 36c0-11 6-19 15-19 7 0 11 5 11 12 0 10-5 21-13 23-8 1-13-5-13-16z', p.rosso) +
        pa('M29 37c6-3 12 0 14 7-2 5-6 8-11 8-3-4-4-10-3-15z', p.verde) + pa('M31 46c3 .5 6 1.5 8 3.5', null, st(p.giallo, 2.4)) +
        pa('M28 19c-3-4-1-9 3-10-1 3 0 6 2 8z', p.giallo) + ci(36, 26, 4.6, p.bianco) + oc(p, 36.6, 26, 2) +
        pa('M44 27c4.5 0 7 3.5 5.5 8-1-2-3-3.5-5.5-3.5z', p.giallo) + pa('M44 31.5c2 0 3.2 1.2 3 2.8-1.2.6-2.6.4-3.2-.6z', p.grigio);
    },
    gufo: function (p) {
      return pa('M18 22l-3-9 8 5zM46 22l3-9-8 5z', p.marrone2) + pa('M18 23c0-6 6-10 14-10s14 4 14 10v14c0 9-6 15-14 15s-14-6-14-15z', p.marrone3) +
        ci(25.5, 28, 7, p.beige) + ci(38.5, 28, 7, p.beige) + ci(25.5, 28, 3.8, p.giallo) + ci(38.5, 28, 3.8, p.giallo) +
        ci(25.5, 28, 1.9, p.occhio, NS) + ci(38.5, 28, 1.9, p.occhio, NS) + pa('M30 33l2 4 2-4z', p.arancio) +
        pa('M26 42c2 2 4 2 6 0 2 2 4 2 6 0M28 47c1.5 1.5 3 1.5 4 0 1 1.5 2.5 1.5 4 0', null, sw(1.8)) + pa('M27 52v3.5M30 52v3.5M34 52v3.5M37 52v3.5', null, st(p.arancio));
    },
    coccodrillo: function (p) {   // a bocca aperta
      return pa('M12 39h40v6H12z', p.rosso) + pa('M12 45c3 4 8 6 14 6h16c5 0 9-2 9-6z', p.verde2) +
        pa('M8 35c0-6 7-10 18-10h16c8 0 14 3 14 9 0 3-2 5-5 5H14c-4 0-6-1-6-4z', p.verde) +
        pa('M16 39l2 3 2-3M24 39l2 3 2-3M32 39l2 3 2-3M40 39l2 3 2-3', p.bianco, sw(1.4)) + pa('M20 45l2-3 2 3M28 45l2-3 2 3M36 45l2-3 2 3', p.bianco, sw(1.4)) +
        ci(40, 23, 6, p.verde) + ci(40, 23, 3, p.giallo) + pa('M40 21v4', null, sw(1.8)) + ci(11.5, 30, 1, p.o, NS) + pa('M48 30l3-2M52 32l3-2', null, sw(1.8));
    },
    caprone: function (p) { return capra(p, p.fantasma, p.osso, false); },
    falco: function (p) {
      return pa('M14 52c0-14 6-30 22-30 8 0 14 5 14 12 0 4-2 7-5 8l-4 10z', p.marrone3) + pa('M27 44c4-4 10-5 14-3-2 6-8 10-14 10z', p.crema) +
        pa('M45 30c5 0 8 3 7 8-1-2-3-3-6-3z', p.giallo) + ci(39, 29, 3.4, p.giallo) + ci(39, 29, 1.6, p.occhio, NS) +
        pa('M34 25c3-2 7-2 9.5 0', null, sw(2.6)) + pa('M20 40c3-2 6-2 8 0M18 46c3-2 6-2 8 0', null, sw(1.6));
    },
    puzzola: function (p) {
      return pa('M42 54c10-4 14-16 8-26-2 6-6 10-10 12z', p.nero) + pa('M47 31c2 6 0 14-4 18', null, st(p.fantasma, 3)) +
        ci(19, 27, 4, p.nero) + ci(41, 27, 4, p.nero) + el(30, 38, 14, 12, p.nero) + pa('M30 26c-2.2 3-2.2 9 0 12 2.2-3 2.2-9 0-12z', p.fantasma, NS) +
        ci(25, 38, 2.4, p.fantasma, NS) + ci(25.5, 38.3, 1.1, p.occhio, NS) + ci(35, 38, 2.4, p.fantasma, NS) + ci(35.5, 38.3, 1.1, p.occhio, NS) +
        ci(30, 44, 1.8, p.rosa, NS);
    },
    pipistrello: function (p) {
      return pa('M32 34c-6-6-16-8-26-4 4 2 5 5 4 8 3-1 6 0 7 3 3-2 7-1 9 2z', p.pipi) + pa('M32 34c6-6 16-8 26-4-4 2-5 5-4 8-3-1-6 0-7 3-3-2-7-1-9 2z', p.pipi) +
        pa('M25.5 27l-1.5-8 5.5 4zM38.5 27l1.5-8-5.5 4z', p.pipi) + ci(32, 33, 8.5, p.pipi) +
        ci(29, 32, 1.7, p.giallo, NS) + ci(35, 32, 1.7, p.giallo, NS) + pa('M30 37l1 2.5 1-2.5M33 37l1 2.5 1-2.5', p.bianco, sw(1.3));
    }
  };

  /* ---------- demoni ---------- */
  function diavolo(p, pelle, opz) {
    opz = opz || {};
    var s = pa('M20 25c-4-4-5-10-3-14 2 4 6 7 9 9zM44 25c4-4 5-10 3-14-2 4-6 7-9 9z', p.osso);
    s += pa('M18 35l-7-4 2 8 6 1zM46 35l7-4-2 8-6 1z', pelle);
    s += pa('M18 33c0-9 6-14 14-14s14 5 14 14c0 8-4 15-9 18l-5 4-5-4c-5-3-9-10-9-18z', pelle);
    if (opz.maschera) {   // il ladro: mascherina nera
      s += pa('M17 30c5-3 10-3 15 0 5-3 10-3 15 0v5c-5 2.5-10 2.5-15-.5-5 3-10 3-15 .5z', p.o) + ci(25, 32.2, 2, p.giallo, NS) + ci(39, 32.2, 2, p.giallo, NS);
    } else {
      s += pa('M19 29c3-6 8-8 13-5 5-3 10-1 13 5-4-1-8 0-13 3-5-3-9-4-13-3z', p.o) + pa('M22.5 32.5l7 2.5M41.5 32.5l-7 2.5', null, sw(3));
      s += pa('M23.5 37c2-2 5-2 6.5 0-2 1.5-4.5 1.5-6.5 0zM34 37c1.5-2 4.5-2 6.5 0-2 1.5-4.5 1.5-6.5 0z', p.giallo) + pa('M26.8 35.9v2.2M37.2 35.9v2.2', null, sw(1.6));
    }
    s += pa('M24 42c4 4 12 4 16 0-2 4-5 6-8 6s-6-2-8-6z', p.bianco) + pa('M28 43.8v2.2M32 44.4v2.6M36 43.8v2.2', null, sw(1.4));
    return s + pa('M29 50l3 6 3-6', p.o);
  }
  var DEMONI = {
    cucu: function (p) { return diavolo(p, p.rosso); },
    mefisto: function (p) { return diavolo(p, p.rosso, { maschera: true }); },
    gemelle: function (p) { return gruppo(-3.4, 12, .7, diavolo(p, p.rosa)) + gruppo(22.6, 12, .7, diavolo(p, p.viola)); },
    orco: function (p) {
      return pa('M14 32l-6-6 1 10 6 2zM50 32l6-6-1 10-6 2z', p.verde) + pa('M16 30c0-10 7-16 16-16s16 6 16 16v8c0 9-7 16-16 16s-16-7-16-16z', p.verde) +
        pa('M22 17l-2-6 5 3zM42 17l2-6-5 3z', p.osso) + pa('M21 28c4-3 8-3 11-1 3-2 7-2 11 1', null, sw(3)) +
        ci(26, 31.5, 2.6, p.giallo) + ci(38, 31.5, 2.6, p.giallo) + ci(26, 31.5, 1.2, p.occhio, NS) + ci(38, 31.5, 1.2, p.occhio, NS) +
        pa('M30 36.5c1 1.5 3 1.5 4 0') + pa('M22 42c6 4 14 4 20 0') + pa('M24 42.5l1-6 3 5zM40 42.5l-1-6-3 5z', p.osso);
    },
    belzedado: function (p) {
      return pa('M20 21c-3-4-3-9 0-12 1 3 3 6 6 7zM44 21c3-4 3-9 0-12-1 3-3 6-6 7z', p.osso) +
        '<rect x="14" y="18" width="36" height="36" rx="7" fill="' + p.rosso + '"/>' +
        ci(20, 24, 1.8, p.bianco, NS) + ci(44, 48, 1.8, p.bianco, NS) + ci(44, 24, 1.8, p.bianco, NS) + ci(20, 48, 1.8, p.bianco, NS) +
        ci(26, 33, 3.6, p.bianco) + ci(38, 33, 3.6, p.bianco) + ci(26.6, 33.4, 1.6, p.occhio, NS) + ci(38.6, 33.4, 1.6, p.occhio, NS) +
        pa('M23 41c5 5 13 5 18 0-3 5-6 7-9 7s-6-2-9-7z', p.bianco);
    },
    ritiracifero: function (p) {
      return pa('M8 66l7-22 11 9 6-6 6 6 11-9 7 22z', p.nero) + pa('M16 66l3-14 9 6 4-4 4 4 9-6 3 14z', p.rosso) +
        pa('M20 30c0-9 5-14 12-14s12 5 12 14v6c0 8-5 13-12 13s-12-5-12-13z', p.pallido) +
        pa('M19 29c1-9 6-14 13-14s12 5 13 14c-3-2-6-3-9-2l-4 5-4-5c-3-1-6 0-9 2z', p.nero) +
        ci(27, 33, 2, p.rosso, NS) + ci(37, 33, 2, p.rosso, NS) + pa('M28 41.5c2.5 1.5 5.5 1.5 8 0') +
        pa('M29.5 41.7l1 3 1-2.6M32.5 41.9l1 2.6 1-3', p.bianco, sw(1.2));
    },
    asinodeo: function (p) {
      return pa('M24 22c-4-6-4-14 0-17 2 4 4 10 4 16zM40 22c4-6 4-14 0-17-2 4-4 10-4 16z', p.grigio) +
        pa('M22 26c0-6 4-10 10-10s10 4 10 10v12c0 8-4 14-10 14s-10-6-10-14z', p.grigio) + el(32, 45, 9, 7, p.crema) +
        ci(29, 46, 1.2, p.o, NS) + ci(35, 46, 1.2, p.o, NS) + ci(26.5, 31, 2.1, p.rosso, NS) + ci(37.5, 31, 2.1, p.rosso, NS) +
        pa('M28 16c-1-4 2-6 2-10 2 2 4 6 2 10zM34 16c0-4 3-6 3-9 2 3 2 7 0 9z', p.arancio);
    },
    custode: function (p) {
      return pa('M16 54V30c0-10 7-17 16-17s16 7 16 17v24l-4-3-4 3-4-3-4 3-4-3-4 3-4-3z', p.fantasma) +
        el(26, 30, 2.6, 3.4, p.o, NS) + el(38, 30, 2.6, 3.4, p.o, NS) + el(32, 39, 3, 3.6, p.o, NS) +
        pa('M40 41v-3.5a4 4 0 0 1 8 0V41', null, sw(2.2)) + '<rect x="37" y="41" width="14" height="11" rx="2" fill="' + p.giallo + '"/>' + ci(44, 46, 1.3, p.o, NS);
    },
    metallaro: function (p) { return capra(p, p.grigio, p.rosso, true); },
    gorgobambola: function (p) {
      return pa('M20 57c-4-8-4-18 2-24-2-4-2-10 2-14 3-3 6-4 8-4s5 1 8 4c4 4 4 10 2 14 6 6 6 16 2 24z', p.rosso) +
        el(32, 24, 7.5, 7, p.pelle[1]) + ci(32, 24, 3.6, p.bianco) + ci(32, 24, 2, p.verde, NS) + ci(32, 24, .9, p.occhio, NS) +
        ci(32, 45, 4, p.giallo) + pa('M32 39v-2M32 51v2M26 45h-2M38 45h2', null, sw(1.6));
    },
    legione: function (p) {
      return ci(15, 27, 6, p.viola) + ci(13, 26, 1.3, p.bianco, NS) + ci(17, 26, 1.3, p.bianco, NS) +
        ci(49, 27, 6, p.viola) + ci(47, 26, 1.3, p.bianco, NS) + ci(51, 26, 1.3, p.bianco, NS) +
        pa('M27 30l-3-7M37 30l3-7') + ci(23.5, 21.5, 2, p.giallo) + ci(40.5, 21.5, 2, p.giallo) +
        pa('M18 46c0-10 6-17 14-17s14 7 14 17v6l-4-3-3 3-4-3-3 3-4-3-3 3-4-3-3 3z', p.verde) +
        ci(27, 41, 3, p.bianco) + ci(37, 41, 3, p.bianco) + ci(27.5, 41.5, 1.4, p.occhio, NS) + ci(37.5, 41.5, 1.4, p.occhio, NS);
    },
    uovo: function (p) {
      return pa('M27 13l-2.5-6 5 2.5zM37 13l2.5-6-5 2.5z', p.rosso) + pa('M32 10c10 0 17 16 17 28s-7 18-17 18-17-6-17-18S22 10 32 10z', p.crema) +
        pa('M16 34l5-3 4 4 5-5 4 4 5-3 4 4 6-3') + ci(27, 40, 2.1, p.rosso, NS) + ci(37, 40, 2.1, p.rosso, NS) + pa('M28 46c2.5 1.5 5.5 1.5 8 0');
    },
    serpente: function (p) {
      return pa('M12 51c6 4 14 2 16-4s-6-8-6-14 6-10 12-9', null, st(p.o, 9)) + pa('M12 51c6 4 14 2 16-4s-6-8-6-14 6-10 12-9', null, st(p.verde, 5)) +
        pa('M44 24.5l5 1-2 1.4 3 1.2', null, st(p.rosso, 1.6)) + el(38, 23, 7.5, 5.5, p.verde) + ci(40, 21.5, 1.8, p.giallo, NS) +
        pa('M40 20.4v2.2', null, sw(1.2)) + pa('M32 17.5l1-6 3 3 2-4 2 4 3-3 1 6z', p.giallo);
    },
    bestie: function (p) {
      return pa(stella(32, 35, 24, 17, 12), p.arancio) + ci(23, 25, 3.2, p.giallo) + ci(41, 25, 3.2, p.giallo) + ci(32, 35, 12.5, p.giallo) +
        ci(27.8, 32.5, 1.9, p.occhio, NS) + ci(36.2, 32.5, 1.9, p.occhio, NS) + pa('M29.5 37h5L32 40z', p.marrone2) +
        pa('M32 40v2M29 43c1.5 1 3 1 3 0 0 1 1.5 1 3 0') + pa('M25 15l2-6 3 4 2-5 2 5 3-4 2 6z', p.giallo);
    },
    mammona: function (p) {
      return pa('M21 23l-4-9 9 5zM43 23l4-9-9 5z', p.osso) + ci(32, 35, 16, p.viola) + ci(25, 33, 5, p.giallo) + ci(39, 33, 5, p.giallo) +
        pa('M25 30v6M39 30v6', null, sw(1.4)) + pa('M23.5 31.5c1-1 3-1 3 .5s-3 1-3 2.5 2 1.5 3 .5M37.5 31.5c1-1 3-1 3 .5s-3 1-3 2.5 2 1.5 3 .5', null, sw(1.3)) +
        pa('M23 41c5 6 13 6 18 0z', p.bianco) + '<rect x="34" y="41" width="3" height="3" fill="' + p.giallo + '"' + sw(1.2) + '/>';
    },
    cerbero: function (p) {   // tre teste di lupo
      var lupo = cane(p, p.grigio, p.grigio2, true);
      return gruppo(-0.6, 16, .52, lupo) + gruppo(31.4, 16, .52, lupo) + gruppo(12.2, 1, .62, lupo);
    },
    tentazione: function (p) {
      return pa('M14 52c-2-16 2-35 18-35s20 19 18 35c-4-4-6-10-6-16H20c0 6-2 12-6 16z', p.viola) + pa('M22 21l-3-7 7 4zM42 21l3-7-7 4z', p.rosso) +
        el(32, 34, 12.5, 14, p.pelle[2]) + pa('M20 29c2-8 7-11 12-11s10 3 12 11c-4-3-8-4-12-4s-8 1-12 4z', p.viola) +
        pa('M24.5 34c1.5 1.5 3.5 1.5 5 0M34.5 34c1.5 1.5 3.5 1.5 5 0M24.5 34l-1.6-1.3M39.5 34l1.6-1.3') +
        pa('M27 41c2-2 4-1.5 5-.5 1-1 3-1.5 5 .5-2 3-8 3-10 0z', p.rosso) + ci(37.5, 39.5, .9, p.o, NS);
    },
    candelora: function (p) {   // la strega con la candela
      return pa('M18 29c-2 8-2 16 0 22l4-4 2 4V30zM46 29c2 8 2 16 0 22l-4-4-2 4V30z', p.arancio) + el(32, 38, 11, 12, p.verde) +
        pa('M31 37l-3.5 7 5.5-1z', p.verde) + oc(p, 27.5, 35, 2) + oc(p, 37, 35, 2) + pa('M28 46c2.5 1.5 5.5 1.5 8 0') + ci(35.5, 42, 1, p.o, NS) +
        el(32, 26, 20, 4.5, p.nero) + pa('M21 25c4-6 8-15 15-20 0 6 2 14 7 20z', p.nero) + pa('M22.5 22.5c6 1.5 13 1.5 19 0v3c-6 1.5-13 1.5-19 0z', p.viola) +
        '<rect x="48" y="45" width="6" height="12" fill="' + p.crema + '"/>' + pa('M51 37c1.5 2 2.5 3.5 2.5 5a2.5 2.5 0 0 1-5 0c0-1.5 1-3 2.5-5z', p.giallo);
    },
    sabba: function (p) {   // il barone col cilindro e il monocolo
      return pa('M19 31c-5-2-7-8-5-12 2 3 5 5 8 6zM45 31c5-2 7-8 5-12-2 3-5 5-8 6z', p.osso) +
        pa('M18 35c0-9 6-14 14-14s14 5 14 14c0 8-4 15-9 18l-5 4-5-4c-5-3-9-10-9-18z', p.rosso) +
        oc(p, 26.5, 33.5) + ci(38, 33.5, 4.2, p.acqua) + ci(38, 33.5, 1.8, p.occhio, NS) + pa('M42 35c2 4 1.5 8-1.5 10', null, sw(1.4)) +
        pa('M23.5 41c3-3 6-3 8.5 0 2.5-3 5.5-3 8.5 0-2.5 2-6 2-8.5 0-2.5 2-6 2-8.5 0z', p.o) + pa('M28 46c2.5 1.6 5.5 1.6 8 0') +
        '<rect x="20" y="5" width="24" height="16" rx="1.5" fill="' + p.nero + '"/>' + '<rect x="20" y="15" width="24" height="3.5" fill="' + p.rosso + '"/>' + el(32, 21, 16, 3.2, p.nero);
    },
    burlone: function (p) {   // il giullare
      return pa('M18 28c-6-2-10-8-12-14 5 0 10 3 14 7z', p.rosso) + pa('M46 28c6-2 10-8 12-14-5 0-10 3-14 7z', p.viola) + pa('M22 23c2-8 6-14 10-17 4 3 8 9 10 17z', p.giallo) +
        ci(6, 13, 2.4, p.giallo) + ci(58, 13, 2.4, p.giallo) + ci(32, 5, 2.4, p.rosso) + ci(32, 39, 13, p.bianco) +
        pa('M17 28c8-4 22-4 30 0v4c-8-3-22-3-30 0z', p.bianco) +
        pa('M24.5 35l2.5-3 2.5 3-2.5 3zM34.5 35l2.5-3 2.5 3-2.5 3z', p.blu) + ci(32, 40, 3, p.rosso) +
        pa('M23 43c4 6 14 6 18 0-3 6-6 8-9 8s-6-2-9-8z', p.rosso);
    }
  };

  /* ---------- candele ---------- */
  var CERA = { principiante: 'crema', malvagia: 'nero', buona: 'blu', gentile: 'rosa', marcia: 'verde2' };
  function candela(I, p) {
    var cera = p[CERA[I.id] || 'crema'], fiamma = I.id === 'malvagia' ? (p.fiamma2 || p.verde) : (p.fiamma || p.giallo);
    return pa('M32 7c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z', fiamma) + pa('M32 13c1.4 2 2 3.4 2 4.4a2 2 0 0 1-4 0c0-1 .6-2.4 2-4.4z', p.fiamma ? fiamma : p.arancio, NS) +
      pa('M32 22v4') + pa('M23 26h18v24H23z', cera) + pa('M23 26h18v4c-2 0-2 5-4 5s-2-3-4-3-2 6-4 6-2-5-4-5-2 3-2 3z', cera, ' fill-opacity=".7"') +
      pa('M19 50h26v5H19z', p.giallo);
  }

  /* ---------- carta ---------- */
  function disegni(tema) { for (var i = 0; i < TEMI.length; i++) if (TEMI[i].id === tema) return !!TEMI[i].disegni; return false; }
  function arte(I, tema) {
    var p = PAL[tema];
    if (!p || !I) return '';
    var dentro = I.cat === 'candle' ? candela(I, p)
      : I.cat === 'demon' ? (DEMONI[I.id] || DEMONI.cucu)(p)
      : I.k === 'A' ? (ANIMALI[I.id] || ANIMALI.fido)(p)
      : bimbo(I, p);
    if (p.filtro) dentro = '<g filter="url(#' + p.filtro + ')">' + dentro + '</g>';
    return '<svg viewBox="0 0 64 64" fill="none" stroke="' + p.o + '" stroke-width="' + p.sw + '"' + (p.fo ? ' fill-opacity="' + p.fo + '"' : '') +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + dentro + '</svg>';
  }

  var api = { TEMI: TEMI, PAL: PAL, arte: arte, disegni: disegni, defs: defs, ANIMALI: ANIMALI, DEMONI: DEMONI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DiavolerieTemi = api;
})(typeof window !== 'undefined' ? window : this);
