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
   - --t-emo su <html> è il filtro che il tema dà alle emoji delle carte (in lib/temi.css gli altri gettoni --t-*);
   - un gioco può avere anche dei «mondi», temi solo suoi (Pirati per Gran Bazar...): li dichiara nel suo mondi.js, nel
     <head> subito dopo questo file, con Temi.mondi({ chiave: 'gb-mondo', lista: [{ id, nome, desc, base, sfondo, font,
     anteprima, icona, emo }] }). Un mondo veste l'interfaccia comune col suo tema «base» (data-tema) e mette anche
     data-mondo su <html> per il CSS del gioco; Temi.mondo() dice quale è acceso (o null). Scegliere uno stile spegne
     il mondo del gioco;
   - un gioco che ha solo i suoi mondi mette data-stili="no" su <html>: lì gli stili della sala non si accendono e
     nel foglio ci sono solo «Notte» e i mondi (scegliere «Notte» spegne il mondo e lascia com'è lo stile della sala);
   - uno stile con «spento: true» è pronto ma non si offre (oggi Neon);
   - la prima settimana (fino al 2 dicembre 2026 compreso) un fumetto accanto alla tavolozza fa scoprire temi o mondi:
     sparisce per sempre in quel gioco (sala-coach-...) con «Ho capito», aprendo il foglio o se un tema è già scelto. */
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
    { id: 'neon', nome: 'Neon', desc: 'Insegne luminose, scuro', sfondo: '#120d18', tinta: '#ff4fd8', font: 'family=Tilt+Neon', spento: true,
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
  function togli(k) { try { window.localStorage.removeItem(k); } catch (e) { /* niente memoria */ } }
  function stile(id) { for (var i = 0; i < STILI.length; i++) if (STILI[i].id === id) return STILI[i]; return null; }
  // gli stili che si possono accendere qui: in un gioco coi soli mondi solo «Notte»
  var STILI_ON = document.documentElement.getAttribute('data-stili') !== 'no';
  function offerto(t) { return t && !t.spento && (STILI_ON || t.id === 'notte'); }

  var MONDI = null, mondo = null;
  function mondoDi(id) {
    if (!MONDI || !id) return null;
    for (var i = 0; i < MONDI.lista.length; i++) if (MONDI.lista[i].id === id) return MONDI.lista[i];
    return null;
  }
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
    var t = stile(id) || STILI[0], w = mondoDi(mondo), d = document.documentElement, m = document.querySelector('meta[name="theme-color"]');
    scelto = t.id;
    if (!offerto(t)) t = STILI[0];   // spento, o qui gli stili non ci sono: il tavolo di sempre (la scelta della sala resta)
    var base = w ? (stile(w.base) || STILI[0]) : t, emo = w && w.emo != null ? w.emo : base.emo;
    if (base.id === 'notte') d.removeAttribute('data-tema'); else d.setAttribute('data-tema', base.id);
    if (w) d.setAttribute('data-mondo', w.id); else d.removeAttribute('data-mondo');
    if (emo) d.style.setProperty('--t-emo', emo); else d.style.removeProperty('--t-emo');
    if (m) m.setAttribute('content', w ? w.sfondo : base.sfondo);
    caratteri(base.font, 'font-' + base.id);
    if (w) caratteri(w.font, 'font-m-' + w.id);
  }
  function mondi(def) {
    MONDI = def && def.chiave && def.lista ? def : null;
    mondo = mondoDi(leggi(MONDI && MONDI.chiave)) ? leggi(MONDI.chiave) : null;
    applica(scelto);
  }

  var ICONA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.9 0-1.4-1.2-1.6-1.2-3 0-1 .8-1.6 1.8-1.6h2.2c2.4 0 4.7-1.8 4.7-4.6 0-3.6-4-5.9-9.5-5.9z"/>' +
    '<circle cx="7.6" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.4" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="7.6" r="1.1" fill="currentColor" stroke="none"/></svg>';
  var SPUNTA = '<svg class="tema-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function bottone() {
    var acceso = mondoDi(mondo) || (offerto(stile(scelto)) ? stile(scelto) : STILI[0]);
    return '<button type="button" class="tema-btn" data-temi="apri" aria-haspopup="dialog" aria-label="Tema: ' + acceso.nome +
      '. Tocca per cambiare" title="Tema">' + ICONA + '</button>';
  }

  var aperto = null, primaDi = null;
  function figurina(t) {
    if (typeof api.anteprima === 'function') {
      var a = '';
      try { a = api.anteprima(t.id); } catch (e) { a = ''; }
      if (a) return a;
    }
    if (t.icona) return '<span class="tema-emo">' + t.icona + '</span>';
    return '<span class="tema-emo"' + (t.emo ? ' style="filter:' + t.emo + '"' : '') + '>😈</span>';
  }
  function riga(t, v, on) {
    return '<button type="button" class="tema-opt" data-temi="' + v + '" aria-pressed="' + on + '">' +
      '<span class="tema-prev" style="background:' + (t.anteprima || t.sfondo) + (t.tinta ? ';color:' + t.tinta : '') + '">' + figurina(t) + '</span>' +
      '<span class="tema-txt"><b>' + t.nome + '</b><span>' + t.desc + '</span></span>' + (on ? SPUNTA : '<span></span>') + '</button>';
  }
  function apri() {
    if (aperto) return;
    primaDi = document.activeElement;
    var acceso = offerto(stile(scelto)) ? scelto : 'notte';
    var righe = STILI.filter(offerto).map(function (t) { return riga(t, t.id, !mondo && t.id === acceso); }).join('');
    if (MONDI && MONDI.lista.length) righe += '<p class="tema-gruppo">Mondi, solo in questo gioco</p>' +
      MONDI.lista.map(function (w) { return riga(w, 'm:' + w.id, mondo === w.id); }).join('');
    var w = document.createElement('div');
    w.innerHTML = '<div class="overlay tema-overlay" data-temi="fuori"><div class="sheet tema-sheet" role="dialog" aria-modal="true" aria-labelledby="tema-t">' +
      '<h2 id="tema-t">Tema</h2><p class="tema-nota">' + (!STILI_ON ? 'I mondi sono solo di questo gioco. ' : MONDI && MONDI.lista.length ? 'Gli stili valgono per tutti i giochi, i mondi solo per questo. ' : '') +
      'Cambia solo l\'aspetto del tavolo e delle carte: regole e partite restano le stesse.</p>' +
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
    if (id.indexOf('m:') === 0) {   // un mondo di questo gioco: lo stile scelto per la sala resta com'è
      if (!mondoDi(id.slice(2))) return;
      mondo = id.slice(2);
      scrivi(MONDI.chiave, mondo);
      id = scelto;
    } else {
      if (!offerto(stile(id))) return;
      if (STILI_ON) scrivi(CHIAVE, id);
      else id = scelto;   // qui «Notte» spegne solo il mondo: lo stile scelto per la sala non si tocca
      if (MONDI) { mondo = null; togli(MONDI.chiave); }
    }
    segnaCoach();
    applica(id);
    chiudi();
    if (window.Suoni && typeof window.Suoni.effetto === 'function') { try { window.Suoni.effetto('click'); } catch (e) { /* niente audio */ } }
    var ev;
    try { ev = new CustomEvent('temi:cambio', { detail: { tema: id, mondo: mondo } }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('temi:cambio', false, false, { tema: id, mondo: mondo }); }
    document.dispatchEvent(ev);
    // il gioco ridisegna: il pulsantino nuovo riprende il fuoco
    var b = document.querySelector('[data-temi="apri"]');
    if (b) b.focus();
  }

  /* ---------- la prima settimana: un fumetto accanto alla tavolozza ---------- */
  var COACH_FINO = new Date(2026, 11, 3).getTime();   // dal 3 dicembre 2026 non compare più
  var coach = null, coachRaf = 0;
  function chiaveCoach() { return 'sala-coach-' + (MONDI ? MONDI.chiave : 'temi'); }
  function daScoprire() { return STILI_ON ? 'temi' : MONDI && MONDI.lista.length ? 'mondi' : null; }
  function testoCoach() {
    if (daScoprire() === 'temi') return '<b>Novità: i temi!</b> Tocca la tavolozza per cambiare l\'aspetto del tavolo e delle carte.';
    var n = MONDI.lista.map(function (w) { return w.nome; });
    return '<b>Novità: i mondi!</b> Tocca la tavolozza e gioca in un altro mondo: ' + (n.length > 1 ? n.slice(0, -1).join(', ') + ' o ' + n[n.length - 1] : n[0]) + '.';
  }
  function togliCoach() {
    if (!coach) return;
    coach.oss.disconnect();
    window.removeEventListener('resize', piazza);
    window.removeEventListener('scroll', piazza, true);
    coach.fumetto.parentNode.removeChild(coach.fumetto);
    coach.alone.parentNode.removeChild(coach.alone);
    coach = null;
  }
  function segnaCoach() { if (daScoprire()) scrivi(chiaveCoach(), '1'); togliCoach(); }
  // il fumetto segue la tavolozza (il gioco la ridisegna spesso) e si nasconde se non si vede o c'è un foglio aperto
  function piazza() {
    if (!coach || coachRaf) return;
    coachRaf = window.requestAnimationFrame(function () {
      coachRaf = 0;
      if (!coach) return;
      var b = document.querySelector('[data-temi="apri"]'), r = b && b.getBoundingClientRect();
      var vede = !!r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && !document.querySelector('.overlay');
      coach.fumetto.hidden = !vede; coach.alone.hidden = !vede;
      if (!vede) return;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(r.width, r.height) / 2 + 4;
      coach.alone.style.left = (cx - R) + 'px'; coach.alone.style.top = (cy - R) + 'px';
      coach.alone.style.width = coach.alone.style.height = (2 * R) + 'px';
      var f = coach.fumetto, W = f.offsetWidth, x = Math.min(Math.max(10, cx - W + 30), window.innerWidth - W - 10);
      f.style.left = x + 'px'; f.style.top = (r.bottom + 12) + 'px';
      f.style.setProperty('--freccia', (cx - x) + 'px');
    });
  }
  function mostraCoach() {
    if (coach || Date.now() >= COACH_FINO || !daScoprire() || leggi(chiaveCoach()) === '1') return;
    if (mondo || (STILI_ON && scelto !== 'notte')) { scrivi(chiaveCoach(), '1'); return; }   // l'ha già scoperto
    if (!document.querySelector('[data-temi="apri"]')) return;
    var f = document.createElement('div');
    f.className = 'tema-coach'; f.setAttribute('role', 'status');
    f.innerHTML = '<p>' + testoCoach() + '</p><button type="button" class="tema-coach-ok" data-temi="coach-ok">Ho capito</button>';
    var a = document.createElement('span');
    a.className = 'tema-coach-alone'; a.setAttribute('aria-hidden', 'true');
    document.body.appendChild(a); document.body.appendChild(f);
    var oss = new MutationObserver(piazza);
    oss.observe(document.body, { childList: true, subtree: true });
    coach = { fumetto: f, alone: a, oss: oss };
    window.addEventListener('resize', piazza);
    window.addEventListener('scroll', piazza, true);
    piazza();
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-temi]') : null;
    if (!el) return;
    var v = el.getAttribute('data-temi');
    if (v === 'apri') { e.preventDefault(); segnaCoach(); apri(); }
    else if (v === 'coach-ok') segnaCoach();
    else if (v === 'chiudi') chiudi();
    else if (v === 'fuori') { if (e.target === el) chiudi(); }
    else scegli(v);
  });
  document.addEventListener('keydown', function (e) {
    if (aperto && e.key === 'Escape') { e.stopPropagation(); chiudi(); }
  }, true);

  applica(scelto);
  document.addEventListener('DOMContentLoaded', function () {
    applica(scelto);   // il colore della barra del browser
    window.setTimeout(mostraCoach, 700);   // dopo il primo disegno del gioco
  });

  var api = {
    STILI: STILI, stile: stile, attuale: function () { var w = mondoDi(mondo); return w ? w.base : offerto(stile(scelto)) ? scelto : 'notte'; },
    mondo: function () { return mondo; }, mondi: mondi,
    applica: applica, scegli: scegli, apri: apri, chiudi: chiudi, bottone: bottone, anteprima: null
  };
  window.Temi = api;
})();
