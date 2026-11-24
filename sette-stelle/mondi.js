/* Mondi di Sette Stelle (temi solo di questo gioco, vedi lib/temi.js): «Spazio» e «Luna park».
   Cambiano solo l'aspetto: le carte diventano pianeti con l'anello o biglietti delle giostre, le emoji delle carte
   azione e del ×2 sono quelle del mondo (emo(), luna()), sfondo e caratteri (CSS in fondo alla pagina).
   Le regole e i nomi restano quelli di Sette Stelle. Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  var EMO = {
    spazio: { gelo: '🧊', pioggia: '☄️', desiderio: '🌟', luna: '🪐' },
    luna: { gelo: '🍦', pioggia: '🎆', desiderio: '🎡', luna: '🎪' }
  };
  function mondo() { var mo = window.Temi && window.Temi.mondo && window.Temi.mondo(); return EMO[mo] ? mo : null; }
  function emo(a, base) { var mo = mondo(); return mo && EMO[mo][a] ? EMO[mo][a] : base; }
  window.SetteStelleMondi = { EMO: EMO, emo: emo, luna: function (base) { return emo('luna', base); } };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'ss-mondo', lista: [
      { id: 'spazio', nome: 'Spazio', desc: 'Pianeti con l\'anello tra le nebulose, scuro', base: 'notte', sfondo: '#070a1a', icona: '🪐',
        anteprima: 'radial-gradient(circle at 70% 30%, rgba(160, 90, 255, .6), rgba(160, 90, 255, 0) 50%), #070a1a', font: 'family=Orbitron:wght@600;800' },
      { id: 'luna', nome: 'Luna park', desc: 'Biglietti delle giostre sotto il tendone, chiaro', base: 'notte', sfondo: '#7a1424', icona: '🎡',
        anteprima: 'repeating-linear-gradient(90deg, #d7263d 0 8px, #fff4e0 8px 16px)', font: 'family=Rye' }
    ] });
  }
})();
