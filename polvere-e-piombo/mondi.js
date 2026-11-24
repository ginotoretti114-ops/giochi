/* Mondi di Polvere e Piombo (temi solo di questo gioco, vedi lib/temi.js): «Samurai», «Pirati» e «Gangster».
   Cambiano solo l'aspetto: i nomi dei ruoli e delle carte (sostituiti in un solo passaggio nel testo già pronto, con
   parole(): niente nomi cambiati due volte), le emoji delle carte (icona()), sfondo, pannelli e carte (CSS in fondo alla
   pagina). I nomi nuovi hanno lo stesso genere e la stessa iniziale dei vecchi, così articoli e frasi restano giusti.
   I personaggi e le regole restano quelli di sempre. Si include nel <head> subito dopo lib/temi.js. */
(function () {
  'use strict';
  var IL = { 'lo Sceriffo': 'il @', 'Lo Sceriffo': 'Il @', 'allo Sceriffo': 'al @', 'dallo Sceriffo': 'dal @', 'dello Sceriffo': 'del @', 'nello Sceriffo': 'nel @', 'sullo Sceriffo': 'sul @' };
  function sceriffo(nome) { var m = { Sceriffo: nome }; for (var k in IL) m[k] = IL[k].replace('@', nome); return m; }
  function unisci() { var o = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) o[k] = arguments[i][k]; return o; }
  var M = {
    samurai: {
      nomi: { 'vecchio West': 'Giappone dei samurai', Sceriffo: 'Shogun', Vice: 'Samurai', Fuorilegge: 'Ronin', Rinnegato: 'Ninja',
        'Sparo!': 'Stocco!', 'Schivata!': 'Parata!', Borraccia: 'Tazza di tè', 'Giro di whisky': 'Giro di sakè', Corriere: 'Messaggero',
        Bottino: 'Tributo', 'Borseggio!': 'Furto!', Lazo: 'Rampino', Raffica: 'Pioggia di frecce', 'Bisonti!': 'Cinghiali!', Botte: 'Corazza',
        Galera: 'Prigione', Candelotto: 'Petardo', 'Pistola rapida': 'Lama rapida', Revolver: 'Wakizashi', 'Fucile lungo': 'Arco lungo',
        Fucile: 'Arco', Carabina: 'Naginata' },
      icone: { sparo: '💥', schivata: '🌀', borraccia: '🍵', giro: '🍶', corriere: '📜', bottino: '💰', mercato: '🏮', borseggio: '🥷', lazo: '🪝',
        sfida: '⚔️', raffica: '🏹', bisonti: '🐗', botte: '🛡️', galera: '⛓️', candelotto: '🧨', cannocchiale: '🔭', cavallo: '🐎',
        rapida: '🔪', revolver: '🗡️', fucile: '🏹', carabina: '🔱', lungo: '🎯' }
    },
    pirati: {
      nomi: unisci(sceriffo('Capitano'), { 'vecchio West': 'mar dei Caraibi', Rinnegato: 'Traditore',
        Borraccia: 'Fiaschetta', 'Giro di whisky': 'Giro di rum', Corriere: 'Pappagallo', Mercato: 'Porto', 'Borseggio!': 'Saccheggio!',
        Lazo: 'Rampino', Raffica: 'Bordata', 'Bisonti!': 'Squali!', Candelotto: 'Barile di polvere', Cavallo: 'Veliero',
        Revolver: 'Trombone', 'Fucile lungo': 'Cannone', Fucile: 'Moschetto', Carabina: 'Spingarda' }),
      icone: { borraccia: '🍶', giro: '🥃', corriere: '🦜', mercato: '⚓', borseggio: '🏴‍☠️', lazo: '🪝', raffica: '💣', bisonti: '🦈',
        cavallo: '⛵', lungo: '💣' }
    },
    gangster: {
      nomi: unisci(sceriffo('Commissario'), { 'vecchio West': 'proibizionismo di Chicago', Fuorilegge: 'Gangster', Rinnegato: 'Doppiogiochista',
        Borraccia: 'Fiaschetta', 'Giro di whisky': 'Giro di gin', Corriere: 'Galoppino', Bottino: 'Malloppo', Mercato: 'Mercato nero',
        Lazo: 'Ricatto', 'Bisonti!': 'Sbirri!', Botte: 'Corazza', Cannocchiale: 'Binocolo', Cavallo: 'Macchinone',
        'Fucile lungo': 'Fucile di precisione', Fucile: 'Mitra', Carabina: 'Lupara' }),
      icone: { borraccia: '🍶', giro: '🍸', corriere: '🗞️', bottino: '💼', mercato: '🕴️', lazo: '✉️', bisonti: '🚓', botte: '🦺', cavallo: '🚗' }
    }
  };
  var LETTERA = '0-9A-Za-zÀ-ÿ';
  function regola(nomi) {
    var chiavi = Object.keys(nomi).sort(function (a, b) { return b.length - a.length; });
    return new RegExp('(^|[^' + LETTERA + '])(' + chiavi.map(function (k) { return k.replace(/[!?.()]/g, '\\$&'); }).join('|') + ')(?![' + LETTERA + '])', 'g');
  }
  for (var k in M) M[k].re = regola(M[k].nomi);
  function mondo() { var mo = window.Temi && window.Temi.mondo && window.Temi.mondo(); return M[mo] ? mo : null; }
  function parole(html) {
    var mo = mondo();
    if (!mo || typeof html !== 'string') return html;
    var w = M[mo];
    return html.replace(w.re, function (tutto, prima, nome) { return prima + w.nomi[nome]; });
  }
  function icona(k, base) { var mo = mondo(); return mo && M[mo].icone[k] ? M[mo].icone[k] : base; }
  window.PolvereMondi = { M: M, parole: parole, icona: icona };
  if (window.Temi && window.Temi.mondi) {
    window.Temi.mondi({ chiave: 'pp-mondo', lista: [
      { id: 'samurai', nome: 'Samurai', desc: 'Shogun, Ronin e Ninja sotto il sole rosso, scuro', base: 'notte', sfondo: '#1b1424', icona: '⛩️',
        anteprima: 'radial-gradient(circle at 50% 46%, #e63946 0 32%, #1b1424 34%)', font: 'family=Shojumaru' },
      { id: 'pirati', nome: 'Pirati', desc: 'Il Capitano contro i Fuorilegge del mare, scuro', base: 'vecchia', sfondo: '#171414', icona: '🏴‍☠️',
        anteprima: 'radial-gradient(circle at 50% 120%, #2a6f8f 0 40%, #171414 41%)', font: 'family=Pirata+One' },
      { id: 'gangster', nome: 'Gangster', desc: 'Il Commissario contro le bande degli anni Trenta, scuro', base: 'notte', sfondo: '#0e0d0b', icona: '🎩',
        anteprima: 'repeating-conic-gradient(from -90deg at 50% 100%, #d4af37 0 6deg, #0e0d0b 6deg 18deg)', font: 'family=Limelight' }
    ] });
  }
})();
