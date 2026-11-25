/* Mondi di Gran Bazar (temi solo di questo gioco, vedi lib/temi.js): «Porto dei pirati» e «Mercatino di Natale».
   Cambiano solo l'aspetto: nomi delle merci (le parole si cambiano nel testo già pronto, con parole()), disegni delle
   carte (simboli SVG nuovi, a tratto come quelli del bazar: id «m-<mondo>-<merce>») e colori (CSS in fondo alla pagina).
   Le regole restano quelle del bazar. Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  function g(dentro, pieno) {   // un simbolo a tratto: la parte piena è appena colorata, il tratto è del colore dell'inchiostro
    return (pieno ? '<path d="' + pieno + '" fill="currentColor" opacity=".22"/>' : '') +
      '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">' + dentro + '</g>';
  }
  function simbolo(id, corpo) { return '<symbol id="' + id + '" viewBox="0 0 48 48">' + corpo + '</symbol>'; }
  var OCCHIO = function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 1.1) + '" fill="currentColor" stroke="none"/>'; };

  var M = {
    pirati: {
      parole: [
        [/\bdelle rupie\b/g, 'dei dobloni'], [/\brupie\b/g, 'dobloni'],
        [/\bDiamanti\b/g, 'Perle'], [/\bdiamanti\b/g, 'perle'],
        [/\bTessuti\b/g, 'Vele'], [/\btessuti\b/g, 'vele'],
        [/\bSpezie\b/g, 'Rum'], [/\bspezie\b/g, 'rum'],
        [/\bCuoio\b/g, 'Mappe'], [/\bcuoio\b/g, 'mappe'],
        [/\bCammelli\b/g, 'Pappagalli'], [/\bcammelli\b/g, 'pappagalli'], [/\bCammello\b/g, 'Pappagallo'], [/\bcammello\b/g, 'pappagallo'],
        [/\bMandria\b/g, 'Voliera'], [/\bmandria\b/g, 'voliera']
      ],
      simboli:
        // perle: un'ostrica aperta con la perla
        simbolo('m-pirati-dia', g('<path d="M8 25c0-8.5 7.2-14 16-14s16 5.5 16 14"/><path d="M15 14.5l3.5 10.5M24 11v14M33 14.5l-3.5 10.5"/>' +
          '<path d="M6 25h36c-2 7-9 11-18 11S8 32 6 25z"/><circle cx="24" cy="29.5" r="3.6"/>', 'M8 25c0-8.5 7.2-14 16-14s16 5.5 16 14z')) +
        // oro: il forziere
        simbolo('m-pirati-gol', g('<path d="M8 22c0-7 4-11 16-11s16 4 16 11"/><path d="M8 22h32v16H8z"/><path d="M15 12.5V38M33 12.5V38"/>' +
          '<rect x="21" y="24" width="6" height="7" rx="1.5"/>', 'M8 22h32v16H8z')) +
        // argento: il calice
        simbolo('m-pirati-sil', g('<path d="M14 8h20c0 9-4 14-10 14S14 17 14 8z"/><path d="M24 22v10"/><path d="M16 39c0-3.5 3.6-7 8-7s8 3.5 8 7z"/><path d="M17 13h14"/>',
          'M14 8h20c0 9-4 14-10 14S14 17 14 8z')) +
        // vele: albero, vele e scafo
        simbolo('m-pirati-clo', g('<path d="M22 5v31"/><path d="M24 8c9 6 12 14 12 24H24z"/><path d="M20 12c-6 5-8 11-8 18h8"/><path d="M9 37h30l-4.5 5h-21z"/>',
          'M24 8c9 6 12 14 12 24H24z')) +
        // rum: la bottiglia col tappo e l'etichetta
        simbolo('m-pirati-spi', g('<path d="M20 4h8v4h-8z"/><path d="M20 8v4c0 3-3 5-3 8v21h14V20c0-3-3-5-3-8V8"/><path d="M17 25h14v9H17z"/>' +
          '<path d="M21.5 27.5l5 4M26.5 27.5l-5 4"/>', 'M20 8v4c0 3-3 5-3 8v21h14V20c0-3-3-5-3-8V8z')) +
        // mappe: la carta piegata, la rotta e la X
        simbolo('m-pirati-lea', g('<path d="M7 12l11-3 12 3 11-3v27l-11 3-12-3-11 3z"/><path d="M18 9v27M30 12v27"/>' +
          '<path d="M11 31c3-1 5-4 9-3s6-5 9-6" stroke-dasharray="2.4 3"/><path d="M31.5 17.5l4.5 4.5M36 17.5l-4.5 4.5"/>', 'M7 12l11-3 12 3 11-3v27l-11 3-12-3-11 3z')) +
        // pappagalli: di profilo, col becco a uncino
        simbolo('m-pirati-cam', g('<path d="M19 11c6-4 14-1 15 6 1 5-2 8-2 12 0 6 3 9 6 13H25c-5-4-7-9-6-15"/><path d="M19 27c-3-1-5-4-4-8 1-4 2-6 4-8"/>' +
          '<path d="M15 18c-3.5 0-6 2.5-5.5 6 1.8-1.4 3.6-1.6 5.3-.6"/><path d="M25 31c3 2 5 6 5 11"/>' + OCCHIO(23.5, 16.5, 1.7),
          'M19 11c6-4 14-1 15 6 1 5-2 8-2 12 0 6 3 9 6 13H25c-5-4-7-9-6-15-3-1-5-4-4-8 1-4 2-6 4-8z'))
    },
    natale: {
      parole: [
        [/\bdelle rupie\b/g, 'degli zecchini'], [/\brupie\b/g, 'zecchini'],
        [/\bDiamanti\b/g, 'Palline'], [/\bdiamanti\b/g, 'palline'],
        [/\bOro\b/g, 'Stelle'], [/\boro\b/g, 'stelle'],
        [/\bArgento\b/g, 'Campanelle'], [/\bargento\b/g, 'campanelle'],
        [/\bTessuti\b/g, 'Sciarpe'], [/\btessuti\b/g, 'sciarpe'],
        [/\bSpezie\b/g, 'Biscotti'], [/\bspezie\b/g, 'biscotti'],
        [/\bCuoio\b/g, 'Regali'], [/\bcuoio\b/g, 'regali'],
        [/\bCammelli\b/g, 'Folletti'], [/\bcammelli\b/g, 'folletti'], [/\bCammello\b/g, 'Folletto'], [/\bcammello\b/g, 'folletto'],
        [/\bMandria\b/g, 'Slitta'], [/\bmandria\b/g, 'slitta']
      ],
      simboli:
        // palline dell'albero
        simbolo('m-natale-dia', g('<circle cx="24" cy="28" r="13"/><path d="M20 11h8v4.5h-8z"/><path d="M22 11c0-3.2 4-3.2 4 0"/>' +
          '<path d="M12 25c4 3 8 3 12 0s8-3 12 0"/><path d="M12.5 31c4 3 7.5 3 11.5 0s7.5-3 11.5 0"/>', 'M24 15a13 13 0 1 1 0 26 13 13 0 0 1 0-26z')) +
        // stelle
        simbolo('m-natale-gol', g('<path d="M24 6l5.4 11.4 12.6 1.5-9.3 8.6 2.5 12.4L24 33.8 12.8 39.9l2.5-12.4L6 18.9l12.6-1.5z"/>',
          'M24 6l5.4 11.4 12.6 1.5-9.3 8.6 2.5 12.4L24 33.8 12.8 39.9l2.5-12.4L6 18.9l12.6-1.5z')) +
        // campanelle col fiocco
        simbolo('m-natale-sil', g('<path d="M11 34h26c-2.5-3-4.5-6.5-4.5-13a8.5 8.5 0 0 0-17 0c0 6.5-2 10-4.5 13z"/><path d="M24 8v4.5"/><path d="M20.5 34a3.5 3.5 0 0 0 7 0"/>' +
          '<path d="M24 9c-3-3-8-3-7 0 .7 1.8 4 1 7 0zM24 9c3-3 8-3 7 0-.7 1.8-4 1-7 0z"/>', 'M11 34h26c-2.5-3-4.5-6.5-4.5-13a8.5 8.5 0 0 0-17 0c0 6.5-2 10-4.5 13z')) +
        // sciarpe a righe con le frange
        simbolo('m-natale-clo', g('<path d="M9 13c6 4 24 4 30 0v8c-6 4-24 4-30 0z"/><path d="M28 23l2.5 15h-7.5l-1.5-14"/><path d="M23.5 38v4M26.8 38v4M30 38v4"/>' +
          '<path d="M16 15.5v7M22 16.5v7.5M34 15.5v7"/>', 'M9 13c6 4 24 4 30 0v8c-6 4-24 4-30 0z')) +
        // biscotti: l'omino di pan di zenzero
        simbolo('m-natale-spi', g('<circle cx="24" cy="11.5" r="6"/><path d="M18.5 19h11l7.5 5-3 4-5-3v6l4 11h-6.5L24 34.5 21.5 42H15l4-11v-6l-5 3-3-4z"/>' +
          '<path d="M21.5 24.5h5M21.5 29h5"/>' + OCCHIO(22, 10.8) + OCCHIO(26, 10.8),
          'M18.5 19h11l7.5 5-3 4-5-3v6l4 11h-6.5L24 34.5 21.5 42H15l4-11v-6l-5 3-3-4z')) +
        // regali col fiocco
        simbolo('m-natale-lea', g('<path d="M9 20h30v19H9z"/><path d="M7 14h34v6H7z"/><path d="M24 14v25"/>' +
          '<path d="M24 14c-3-6-11-6-9-1 1 2 5 1 9 1zM24 14c3-6 11-6 9-1-1 2-5 1-9 1z"/>', 'M9 20h30v19H9z')) +
        // folletti: cappello a punta con il pon pon, orecchie a punta
        simbolo('m-natale-cam', g('<path d="M14 21L29 6l6 15"/><path d="M12 21h24"/><circle cx="30" cy="5.5" r="2.4"/>' +
          '<path d="M15 21c0 9 4 15 9 15s9-6 9-15"/><path d="M15 25.5l-5.5-3 3 7.5M33 25.5l5.5-3-3 7.5"/><path d="M20 31c2.5 2 5.5 2 8 0"/>' +
          OCCHIO(20.5, 26.5, 1.3) + OCCHIO(27.5, 26.5, 1.3), 'M14 21L29 6l6 15z'))
    }
  };

  // Le parole del mondo acceso, sul testo già pronto (solo parole intere, solo i nomi delle merci e dei soldi).
  function parole(html) {
    var w = window.Temi && window.Temi.mondo && M[window.Temi.mondo()];
    if (!w || typeof html !== 'string') return html;
    for (var i = 0; i < w.parole.length; i++) html = html.replace(w.parole[i][0], w.parole[i][1]);
    return html;
  }
  // Il prefisso dei simboli delle merci: quelli del mondo acceso, o quelli del bazar.
  function prefisso() {
    var mo = window.Temi && window.Temi.mondo && window.Temi.mondo();
    return M[mo] ? 'm-' + mo + '-' : 'i-';
  }
  function simboli() { var s = ''; for (var k in M) s += M[k].simboli; return s; }

  window.GranBazarMondi = { M: M, parole: parole, prefisso: prefisso, simboli: simboli };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'gb-mondo', lista: [
      { id: 'pirati', nome: 'Porto dei pirati', desc: 'Perle, forzieri e pappagalli, scuro', base: 'vecchia', sfondo: '#171414', icona: '🦜',
        anteprima: 'radial-gradient(circle at 50% 120%, #2a6f8f 0 40%, #171414 41%)', font: 'family=Pirata+One' },
      { id: 'natale', nome: 'Mercatino di Natale', desc: 'Palline, regali e folletti sotto la neve, scuro', base: 'notte', sfondo: '#10213a', icona: '🎄',
        anteprima: 'radial-gradient(circle at 30% 30%, #ffffff 0 2px, rgba(255, 255, 255, 0) 3px), radial-gradient(circle at 70% 60%, #ffffff 0 2px, rgba(255, 255, 255, 0) 3px), #10213a',
        font: 'family=Mountains+of+Christmas:wght@700' }
    ] });
  }
})();
