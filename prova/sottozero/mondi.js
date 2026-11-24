/* Mondi di Sottozero (temi solo di questo gioco, vedi lib/temi.js): «Vulcano» e «Acquario».
   Cambiano solo l'aspetto: colori e nomi dei quattro colori delle carte (nome() li dà a cardName), sfondo, pannelli e
   carte (CSS in fondo alla pagina). Le regole restano quelle di Sottozero. Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  var NOMI = {
    vulcano: { M: 'Lava', S: 'Zolfo', R: 'Magma', B: 'Vapore' },
    acquario: { M: 'Corallo', S: 'Sabbia', R: 'Medusa', B: 'Alga' }
  };
  function nome(k, base) {
    var mo = window.Temi && window.Temi.mondo && window.Temi.mondo();
    return (NOMI[mo] && NOMI[mo][k]) || base;
  }
  window.SottozeroMondi = { NOMI: NOMI, nome: nome };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'sz-mondo', lista: [
      { id: 'vulcano', nome: 'Vulcano', desc: 'Carte di roccia e lava accesa, scuro', base: 'notte', sfondo: '#1a0f0d', icona: '🌋',
        anteprima: 'radial-gradient(circle at 50% 115%, #ff7a1a 0 30%, #1a0f0d 62%)', font: 'family=Rubik+Burned' },
      { id: 'acquario', nome: 'Acquario', desc: 'Carte come vasche, bolle e coralli, scuro', base: 'notte', sfondo: '#06324a', icona: '🐠',
        anteprima: 'linear-gradient(#2a9cc8, #06324a)', font: 'family=Fredoka:wght@500;700' }
    ] });
  }
})();
