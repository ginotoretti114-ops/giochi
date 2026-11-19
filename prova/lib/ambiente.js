/* Ambiente: distingue il sito vero dal sito di prova (stesso sito, cartella /prova/).
   Va incluso per primo in ogni pagina, prima di qualunque altro script.

   Il sito di prova sta sullo stesso dominio del sito vero, quindi condividerebbe la memoria del browser
   e, online, gli stessi argomenti MQTT. Sotto /prova/ questo file:
   - aggiunge il prefisso «prova:» a ogni chiave di localStorage (giochi, stanze, audio);
   - fa usare agli argomenti MQTT il prefisso «prova/» (lo leggono lib/stanze.js e Gran Bazar con SALA.argomento);
   - mostra in alto la scritta PROVA e la mette nel titolo della scheda.
   Sul sito vero non cambia niente: window.SALA.prova vale false. */
(function () {
  'use strict';
  var prova = /\/prova\//.test(window.location.pathname);
  window.SALA = {
    prova: prova,
    // prefisso degli argomenti MQTT: 'sottozero/v1' diventa 'prova/sottozero/v1' nel sito di prova
    argomento: function (t) { return (prova ? 'prova/' : '') + t; }
  };
  if (!prova) return;

  // Memoria del browser separata: ogni chiave del sito di prova comincia con «prova:».
  try {
    var real = window.localStorage, S = window.Storage && window.Storage.prototype;
    if (real && S && !S.__salaProva) {
      ['getItem', 'setItem', 'removeItem'].forEach(function (name) {
        var orig = S[name];
        S[name] = function (k) {
          if (this !== real) return orig.apply(this, arguments);
          var args = Array.prototype.slice.call(arguments);
          args[0] = 'prova:' + k;
          return orig.apply(this, args);
        };
      });
      S.__salaProva = true;
    }
  } catch (e) { /* senza memoria del browser non c'è niente da separare */ }

  // Scritta PROVA, sempre visibile e senza coprire i tocchi.
  function segna() {
    if (document.getElementById('sala-prova')) return;
    var css = document.createElement('style');
    css.textContent =
      '#sala-prova{position:fixed;top:0;left:0;right:0;height:3px;background:#ff5fa2;z-index:2147483646;pointer-events:none}' +
      '#sala-prova span{position:absolute;top:0;left:50%;transform:translateX(-50%);padding:1px 10px 3px;border-radius:0 0 8px 8px;' +
      'background:#ff5fa2;color:#131833;font:700 10px/1.3 "Atkinson Hyperlegible",system-ui,sans-serif;letter-spacing:.14em}';
    var bar = document.createElement('div');
    bar.id = 'sala-prova';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span>PROVA</span>';
    document.head.appendChild(css);
    document.body.appendChild(bar);
    // i giochi riscrivono il titolo a ogni turno: lo si rimette davanti ogni volta
    var t = document.querySelector('title');
    if (t && window.MutationObserver) new MutationObserver(titolo).observe(t, { childList: true, characterData: true, subtree: true });
    titolo();
  }
  function titolo() { if (document.title.indexOf('PROVA') !== 0) document.title = 'PROVA · ' + document.title; }
  if (document.body) segna(); else document.addEventListener('DOMContentLoaded', segna);
})();
