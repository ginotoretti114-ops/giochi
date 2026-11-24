/* Mondi di Piccante (temi solo di questo gioco, vedi lib/temi.js): «Laboratorio pazzo» e «Draghi».
   Cambiano solo l'aspetto: i peperoncini diventano botti (provette) o tizzoni (fiammelle di drago), il jolly un atomo
   o un uovo di drago (simboli SVG «m-<mondo>-<nome>», sym() dà quello giusto), i colori del piccante e lo sfondo
   (CSS in fondo alla pagina). Le parole si cambiano nel testo già pronto con parole(). Le regole restano le stesse.
   Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  function simbolo(id, box, corpo) { return '<symbol id="' + id + '" viewBox="0 0 ' + box + ' ' + box + '">' + corpo + '</symbol>'; }
  var FIASCA = 'M8.4 2.5v5.2L4.3 15.1A2 2 0 0 0 6.1 18h7.8a2 2 0 0 0 1.8-2.9L11.6 7.7V2.5';
  var M = {
    lab: {
      parole: [[/\bPeperoncini\b/g, 'Botti'], [/\bpeperoncini\b/g, 'botti'], [/\bPeperoncino\b/g, 'Botto'], [/\bpeperoncino\b/g, 'botto']],
      simboli:
        simbolo('m-lab-chili', 20, '<path d="M5.4 13h9.2l1.2 2.3a1.7 1.7 0 0 1-1.5 2.7H5.7a1.7 1.7 0 0 1-1.5-2.7z" fill="#39d98a"/>' +
          '<path d="' + FIASCA + '" fill="none" stroke="#d8f3ff" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.3 2.5h5.4" stroke="#d8f3ff" stroke-width="1.6" stroke-linecap="round"/>' +
          '<circle cx="9.2" cy="10.6" r="1" fill="#39d98a"/><circle cx="11" cy="8.6" r=".75" fill="#39d98a"/>') +
        simbolo('m-lab-chili1', 20, '<path d="M5.4 12.6h9.2l1.3 2.6a1.7 1.7 0 0 1-1.5 2.8H5.6a1.7 1.7 0 0 1-1.5-2.8z" fill="currentColor"/>' +
          '<path d="' + FIASCA + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.2 2.5h5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>') +
        simbolo('m-lab-flame', 40, '<g fill="none" stroke="currentColor" stroke-width="2.6"><ellipse cx="20" cy="20" rx="16" ry="6.5"/>' +
          '<ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(60 20 20)"/><ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(-60 20 20)"/></g>' +
          '<circle cx="20" cy="20" r="3.6" fill="currentColor"/>')
    },
    draghi: {
      parole: [[/\bPeperoncini\b/g, 'Tizzoni'], [/\bpeperoncini\b/g, 'tizzoni'], [/\bPeperoncino\b/g, 'Tizzone'], [/\bpeperoncino\b/g, 'tizzone']],
      simboli:
        simbolo('m-draghi-chili', 20, '<path d="M4 13.2c0-3 1.9-4.4 3.1-6.3.9 1.9 1.9 2.1 2.8 1.1.9-1.7.2-3.7.1-5.6 3.1 1.9 6 5.1 6 9.9 0 3.3-2.7 5.5-6 5.5s-6-1.4-6-4.6z" fill="#ff6b1a"/>' +
          '<path d="M7.6 14.4c0-1.6 1-2.2 1.6-3.2.5 1 1 1.4 1.6.8.4-.7.3-1.6.3-2.5 1.4 1 2.6 2.6 2.6 4.6 0 1.7-1.4 2.8-3.1 2.8s-3-.9-3-2.5z" fill="#ffd23f"/>') +
        simbolo('m-draghi-chili1', 20, '<path d="M4.3 13c0-3 1.9-4.3 3.1-6.2.9 1.9 1.9 2.1 2.8 1.1.9-1.7.2-3.7.1-5.6 3.1 1.9 5.9 5.1 5.9 9.8 0 3.3-2.7 5.4-5.9 5.4s-6-1.4-6-4.5z" fill="currentColor"/>') +
        simbolo('m-draghi-flame', 40, '<ellipse cx="20" cy="22" rx="11.5" ry="14.5" fill="currentColor" opacity=".25"/>' +
          '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="20" cy="22" rx="11.5" ry="14.5"/>' +
          '<path d="M10.5 17l4.8 3 4.7-4 4.7 4 4.8-3"/><path d="M10.4 27.5l4.9-2.5 4.7 3.5 4.7-3.5 4.9 2.5"/></g>')
    }
  };
  function mondo() { var mo = window.Temi && window.Temi.mondo && window.Temi.mondo(); return M[mo] ? mo : null; }
  function parole(html) {
    var mo = mondo();
    if (!mo || typeof html !== 'string') return html;
    for (var i = 0; i < M[mo].parole.length; i++) html = html.replace(M[mo].parole[i][0], M[mo].parole[i][1]);
    return html;
  }
  function sym(id) { var mo = mondo(); return mo ? 'm-' + mo + '-' + id : id; }
  function simboli() { var s = ''; for (var k in M) s += M[k].simboli; return s; }
  window.PiccanteMondi = { M: M, parole: parole, sym: sym, simboli: simboli };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'pc-mondo', lista: [
      { id: 'lab', nome: 'Laboratorio pazzo', desc: 'Provette che fanno il botto, scuro', base: 'notte', sfondo: '#0d1f1a', icona: '🧪',
        anteprima: 'linear-gradient(rgba(255, 255, 255, .08) 1px, rgba(255, 255, 255, 0) 1px) 0 0 / 10px 10px, linear-gradient(90deg, rgba(255, 255, 255, .08) 1px, rgba(255, 255, 255, 0) 1px) 0 0 / 10px 10px, #0d1f1a',
        font: 'family=Bungee' },
      { id: 'draghi', nome: 'Draghi', desc: 'Squame, uova di drago e tizzoni, scuro', base: 'notte', sfondo: '#1a1210', icona: '🐉',
        anteprima: 'radial-gradient(circle at 50% 120%, #e76f51 0 30%, #1a1210 64%)', font: 'family=MedievalSharp' }
    ] });
  }
})();
