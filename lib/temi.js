/* Temi della sala, uguali per tutti i giochi: cambiano solo l'aspetto (colori, caratteri, carte), mai le regole.

   Ogni pagina include questo file nel <head>, subito dopo lib/ambiente.js (così la scelta del sito di prova ha la sua
   chiave), e lib/temi.css prima del suo <style>:
   - il tema scelto (localStorage «sala-tema», uno per tutti i giochi) va subito su <html> come data-tema, coi suoi
     caratteri da Google Fonts, prima che la pagina si disegni; «Notte» è il tavolo di sempre, senza attributo;
   - Temi.bottone() è il pulsantino con la tavolozza, da mettere accanto a Suoni.bottone() (lobby e tavolo): il foglio
     per scegliere lo apre questo file, con le classi comuni .overlay e .sheet;
   - scelto un tema, sul documento arriva l'evento «temi:cambio» e il gioco ridisegna;
   - Temi.attuale() dice il tema acceso; un gioco può dare Temi.anteprima = function (id) { return html } per la
     figurina del foglio (altrimenti c'è un diavoletto con il filtro del tema);
   - --t-emo su <html> è il filtro che il tema dà alle emoji delle carte (in lib/temi.css gli altri gettoni --t-*). */
(function () {
  'use strict';

  var STILI = [
    { id: 'notte', nome: 'Notte', desc: 'Il tavolo di sempre, scuro', sfondo: '#131833' },
    { id: 'cemento', nome: 'Cemento', desc: 'Graffiti sul muro, chiaro', sfondo: '#b4b1ab',
      font: 'family=Permanent+Marker&family=Rubik+Wet+Paint',
      emo: 'drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(1.5px 2px 0 #151515)' },
    { id: 'vecchia', nome: 'Vecchia scuola', desc: 'Tatuaggi da marinaio, scuro', sfondo: '#171414', font: 'family=Sancreek',
      emo: 'sepia(.35) saturate(1.35) drop-shadow(1.2px 0 0 #1b1b1b) drop-shadow(-1.2px 0 0 #1b1b1b) drop-shadow(0 1.2px 0 #1b1b1b) drop-shadow(0 -1.2px 0 #1b1b1b)' },
    { id: 'gesso', nome: 'Gessetto', desc: 'Gesso sulla lavagna, scuro', sfondo: '#26332c', font: 'family=Cabin+Sketch:wght@400;700',
      emo: 'grayscale(1) brightness(1.6) contrast(.78) opacity(.92)' },
    { id: 'neon', nome: 'Neon', desc: 'Insegne luminose, scuro', sfondo: '#120d18', tinta: '#ff4fd8', font: 'family=Tilt+Neon',
      emo: 'brightness(0) invert(1) drop-shadow(0 0 1.5px #ff4fd8) drop-shadow(0 0 5px #ff4fd8)' },
    { id: 'fumetto', nome: 'Fumetto', desc: 'Pop art coi puntini, chiaro', sfondo: '#ffe14d', font: 'family=Bangers',
      emo: 'saturate(1.5) contrast(1.1) drop-shadow(1.3px 0 0 #111) drop-shadow(-1.3px 0 0 #111) drop-shadow(0 1.3px 0 #111) drop-shadow(0 -1.3px 0 #111)' },
    { id: 'spettrale', nome: 'Spettrale', desc: 'Ombre sulla luna piena, scuro', sfondo: '#160c1f', font: 'family=Creepster',
      anteprima: 'radial-gradient(circle at 50% 50%, #ffd27a 0 54%, #160c1f 57%)',
      emo: 'brightness(0) drop-shadow(0 0 1px #ffb347) drop-shadow(0 0 3px #ff8a1f)' }
  ];
  var CHIAVE = 'sala-tema';

  function leggi(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* niente memoria: vale per questa visita */ } }
  function stile(id) { for (var i = 0; i < STILI.length; i++) if (STILI[i].id === id) return STILI[i]; return null; }

  var scelto = leggi(CHIAVE);
  if (!stile(scelto)) {   // prima i temi c'erano solo in Diavolerie, con la sua chiave
    var vecchio = leggi('dv-tema');
    scelto = stile(vecchio) ? vecchio : 'notte';
  }

  function caratteri(famiglie, id) {
    if (!famiglie || document.getElementById(id)) return;
    var l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + famiglie + '&display=swap';
    document.head.appendChild(l);
  }
  function applica(id) {
    var t = stile(id) || STILI[0], d = document.documentElement, m = document.querySelector('meta[name="theme-color"]');
    scelto = t.id;
    if (t.id === 'notte') d.removeAttribute('data-tema'); else d.setAttribute('data-tema', t.id);
    if (t.emo) d.style.setProperty('--t-emo', t.emo); else d.style.removeProperty('--t-emo');
    if (m) m.setAttribute('content', t.sfondo);
    caratteri(t.font, 'font-' + t.id);
  }

  var ICONA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.9 0-1.4-1.2-1.6-1.2-3 0-1 .8-1.6 1.8-1.6h2.2c2.4 0 4.7-1.8 4.7-4.6 0-3.6-4-5.9-9.5-5.9z"/>' +
    '<circle cx="7.6" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.4" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="7.6" r="1.1" fill="currentColor" stroke="none"/></svg>';
  var SPUNTA = '<svg class="tema-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function bottone() {
    return '<button type="button" class="tema-btn" data-temi="apri" aria-haspopup="dialog" aria-label="Tema: ' + stile(scelto).nome +
      '. Tocca per cambiare" title="Tema">' + ICONA + '</button>';
  }

  var aperto = null, primaDi = null;
  function figurina(t) {
    if (typeof api.anteprima === 'function') {
      var a = '';
      try { a = api.anteprima(t.id); } catch (e) { a = ''; }
      if (a) return a;
    }
    return '<span class="tema-emo"' + (t.emo ? ' style="filter:' + t.emo + '"' : '') + '>😈</span>';
  }
  function apri() {
    if (aperto) return;
    primaDi = document.activeElement;
    var righe = STILI.map(function (t) {
      var on = t.id === scelto;
      return '<button type="button" class="tema-opt" data-temi="' + t.id + '" aria-pressed="' + on + '">' +
        '<span class="tema-prev" style="background:' + (t.anteprima || t.sfondo) + (t.tinta ? ';color:' + t.tinta : '') + '">' + figurina(t) + '</span>' +
        '<span class="tema-txt"><b>' + t.nome + '</b><span>' + t.desc + '</span></span>' + (on ? SPUNTA : '<span></span>') + '</button>';
    }).join('');
    var w = document.createElement('div');
    w.innerHTML = '<div class="overlay tema-overlay" data-temi="fuori"><div class="sheet tema-sheet" role="dialog" aria-modal="true" aria-labelledby="tema-t">' +
      '<h2 id="tema-t">Tema</h2><p class="tema-nota">Vale per tutti i giochi e cambia solo l\'aspetto del tavolo e delle carte: regole e partite restano le stesse.</p>' +
      '<div class="tema-list">' + righe + '</div><button type="button" class="btn wide" data-temi="chiudi">Chiudi</button></div></div>';
    aperto = w.firstChild;
    document.body.appendChild(aperto);
    var sel = aperto.querySelector('[aria-pressed="true"]');
    if (sel) sel.focus();
  }
  function chiudi() {
    if (!aperto) return;
    aperto.parentNode.removeChild(aperto);
    aperto = null;
    if (primaDi && primaDi.focus && document.body.contains(primaDi)) primaDi.focus();
  }
  function scegli(id) {
    if (!stile(id)) return;
    scrivi(CHIAVE, id);
    applica(id);
    chiudi();
    if (window.Suoni && typeof window.Suoni.effetto === 'function') { try { window.Suoni.effetto('click'); } catch (e) { /* niente audio */ } }
    var ev;
    try { ev = new CustomEvent('temi:cambio', { detail: { tema: id } }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('temi:cambio', false, false, { tema: id }); }
    document.dispatchEvent(ev);
    // il gioco ridisegna: il pulsantino nuovo riprende il fuoco
    var b = document.querySelector('[data-temi="apri"]');
    if (b) b.focus();
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-temi]') : null;
    if (!el) return;
    var v = el.getAttribute('data-temi');
    if (v === 'apri') { e.preventDefault(); apri(); }
    else if (v === 'chiudi') chiudi();
    else if (v === 'fuori') { if (e.target === el) chiudi(); }
    else scegli(v);
  });
  document.addEventListener('keydown', function (e) {
    if (aperto && e.key === 'Escape') { e.stopPropagation(); chiudi(); }
  }, true);

  applica(scelto);
  document.addEventListener('DOMContentLoaded', function () { applica(scelto); });   // il colore della barra del browser

  var api = {
    STILI: STILI, stile: stile, attuale: function () { return scelto; },
    applica: applica, scegli: scegli, apri: apri, chiudi: chiudi, bottone: bottone, anteprima: null
  };
  window.Temi = api;
})();
