/* Mondi di Stalla Matta (temi solo di questo gioco, vedi lib/temi.js): «Fondale» e «Peluche».
   Cambiano solo l'aspetto. Nel Fondale gli unicorni diventano ippocampi (stesso genere e stessa vocale iniziale, così
   articoli e frasi restano giusti), i nitriti gorgogli, la stalla una scogliera e 🦄 un 🐴 (parole(), sul testo già
   pronto e sui nomi prima che vadano a capo). Peluche cambia solo lo stile: unicorni di stoffa con le cuciture.
   Sfondo, pannelli e carte nel CSS in fondo alla pagina. Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  var M = {
    fondale: function (h) {
      return h
        .replace(/([Uu])nicorn(o|i|one|oni|ino|ini)(?![a-zàèéìòù])/g, function (m, u, s) { return (u === 'U' ? 'I' : 'i') + 'ppocamp' + s; })
        .replace(/([Nn])itrit([oi])(?![a-zàèéìòù])/g, function (m, n, s) { return (n === 'N' ? 'G' : 'g') + 'orgogli' + (s === 'o' ? 'o' : ''); })
        .replace(/\bstalla\b/g, 'scogliera').replace(/\bstalle\b/g, 'scogliere')
        .replace(/🦄/g, '🐴');
    },
    peluche: null
  };
  function parole(html) {
    var mo = window.Temi && window.Temi.mondo && window.Temi.mondo();
    return M[mo] && typeof html === 'string' ? M[mo](html) : html;
  }
  window.StallaMondi = { parole: parole };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'sm-mondo', lista: [
      { id: 'fondale', nome: 'Fondale', desc: 'Ippocampi, alghe e bolle in fondo al mare, scuro', base: 'notte', sfondo: '#052a3d', icona: '🫧',
        anteprima: 'linear-gradient(#1b8fb3, #052a3d)', font: 'family=Lilita+One' },
      { id: 'peluche', nome: 'Peluche', desc: 'Unicorni di stoffa con le cuciture, chiaro', base: 'notte', sfondo: '#efe3ff', icona: '🧸',
        anteprima: 'repeating-linear-gradient(45deg, #f7c6e0 0 6px, #e7d6ff 6px 12px)', font: 'family=Baloo+2:wght@600;800' }
    ] });
  }
})();
