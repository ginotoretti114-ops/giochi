/* Mondi di Valanga (temi solo di questo gioco, vedi lib/temi.js): «Caramelle».
   Cambia solo l'aspetto: le carte diventano caramelle incartate e i quattro colori quattro gusti (fragola, limone, menta,
   mirtillo: parole() sul testo già pronto), sfondo e pannelli da negozio di dolci (CSS in fondo alla pagina).
   Le regole restano quelle di Valanga. Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  var GUSTI = { rosso: 'fragola', giallo: 'limone', verde: 'menta', blu: 'mirtillo' };
  var RE = /(^|[^0-9A-Za-zÀ-ÿ])(rosso|giallo|verde|blu|Rosso|Giallo|Verde|Blu)(?![0-9A-Za-zÀ-ÿ])/g;
  function parole(html) {
    var mo = window.Temi && window.Temi.mondo && window.Temi.mondo();
    if (mo !== 'caramelle' || typeof html !== 'string') return html;
    return html.replace(RE, function (t, prima, c) {
      var g = GUSTI[c.toLowerCase()];
      return prima + (c[0] === c[0].toUpperCase() ? g[0].toUpperCase() + g.slice(1) : g);
    });
  }
  window.ValangaMondi = { parole: parole };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'va-mondo', lista: [
      { id: 'caramelle', nome: 'Caramelle', desc: 'Carte incartate ai gusti di frutta, chiaro', base: 'notte', sfondo: '#ffd6e8', icona: '🍬',
        anteprima: 'repeating-linear-gradient(45deg, #ff4d6d 0 6px, #ffffff 6px 12px)', font: 'family=Chewy' }
    ] });
  }
})();
