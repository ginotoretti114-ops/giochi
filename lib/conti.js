/* Conti: accesso con Google o con un link via email (Supabase) e progressi salvati nell'account.

   Il sito di prova usa il progetto Supabase «sala-giochi-prova», il sito vero «sala-giochi» (SALA.prova,
   da lib/ambiente.js). Le chiavi qui sotto sono quelle pubbliche: la sicurezza sta nelle regole della
   tabella «profili» (ognuno legge e scrive solo il suo profilo).

   La libreria di Supabase (lib/supabase.min.js, 220 kB) si carica solo se serve: c'è già un accesso in
   questo browser, si torna dalla pagina di accesso, o si preme un pulsante per entrare.

   Sincronizzazione: si legge il profilo dell'account, lo si unisce a quello del browser con
   Profilo.unisci (niente doppi conteggi) e lo si riscrive solo se nel frattempo nessun altro dispositivo
   l'ha cambiato (colonna «versione»); altrimenti si rilegge e si riprova.

   Va incluso dopo lib/profilo.js. Nella pagina iniziale: Conti.disegna(elemento) e Conti.ascolta(fn). */
(function (root) {
  'use strict';

  var PROGETTI = {
    prova: { url: 'https://xuylmtdsxyhopyykevlm.supabase.co', chiave: 'sb_publishable_Z_ydI6Fru7BZGU69mMk3oA_3aScIWdp' },
    vero: { url: 'https://vpjeypyfgrgjsfzwkgoe.supabase.co', chiave: 'sb_publishable_dGK4TERkfwHQGMOxMi1bXg_u6jXvmnW' }
  };
  var STORAGE_KEY = 'sala-conto';
  var doc = root.document;
  var cfg = PROGETTI[root.SALA && root.SALA.prova ? 'prova' : 'vero'];
  var qui = doc && doc.currentScript ? doc.currentScript.src : '';
  var BASE = qui ? qui.replace(/lib\/conti\.js(\?.*)?$/, '') : '';   // radice del sito (o della prova)
  var LIB = BASE + 'lib/supabase.min.js';

  var sb = null, caricamento = null, utente = null;
  var stato = 'fuori';                    // 'spento' | 'avvio' | 'fuori' | 'dentro'
  var sync = { stato: '', quando: null }; // '' | 'in corso' | 'ok' | 'errore'
  var msg = '', inviataA = '', conferma = false, imp = {}, impChiesta = false;
  var ascoltatori = [];

  function avvisa() { ascoltatori.forEach(function (f) { try { f(); } catch (e) { /* un ascoltatore rotto non ferma gli altri */ } }); }
  function leggi(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function canon(x) {
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
    return JSON.stringify(x);
  }
  function codiceInUrl() { return /[?&]code=/.test(root.location.search); }
  function ritornoDaAccesso() { return codiceInUrl() || /access_token=/.test(root.location.hash) || erroreDaUrl() !== ''; }
  function erroreDaUrl() {
    var m = /[?&#]error_description=([^&]*)/.exec(root.location.search + root.location.hash);
    if (!m) return '';
    var d = decodeURIComponent(m[1].replace(/\+/g, ' '));
    if (/expired|invalid/i.test(d)) return 'Il link per entrare è scaduto o già usato: chiedine uno nuovo.';
    return 'Accesso non riuscito: riprova.';
  }
  function pulisciUrl() { try { root.history.replaceState(null, '', root.location.pathname); } catch (e) { /* niente */ } }

  /* ---------- libreria e sessione ---------- */
  function carica() {
    if (sb) return Promise.resolve(sb);
    if (caricamento) return caricamento;
    caricamento = new Promise(function (ok, ko) {
      if (root.supabase && root.supabase.createClient) { ok(); return; }
      var s = doc.createElement('script');
      s.src = LIB; s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { caricamento = null; ko(new Error('libreria non caricata')); };
      doc.head.appendChild(s);
    }).then(function () {
      sb = root.supabase.createClient(cfg.url, cfg.chiave, {
        auth: { storageKey: STORAGE_KEY, flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      // la libreria chiede di non chiamarla da dentro questo ascoltatore: si rimanda di un giro
      sb.auth.onAuthStateChange(function (evento, sessione) { setTimeout(function () { cambiaSessione(sessione); }, 0); });
      return sb;
    });
    return caricamento;
  }
  function cambiaSessione(sessione) {
    var prima = utente && utente.id;
    utente = sessione && sessione.user ? { id: sessione.user.id, email: sessione.user.email || '' } : null;
    if (utente) { stato = 'dentro'; inviataA = ''; if (codiceInUrl()) pulisciUrl(); }
    else if (stato !== 'spento') stato = 'fuori';
    if (utente && utente.id !== prima) sincronizza();
    avvisa();
  }
  function avvia() {
    if (!cfg || !doc || !root.Profilo) { stato = 'spento'; return; }
    var err = erroreDaUrl();
    if (err) { msg = err; pulisciUrl(); }
    if (leggi(STORAGE_KEY) || ritornoDaAccesso()) {
      stato = 'avvio';
      var conCodice = codiceInUrl();
      carica().then(function () { return sb.auth.getSession(); }).then(function (r) {
        var s = r && r.data && r.data.session;
        if (s) { cambiaSessione(s); return; }
        if (conCodice) { msg = "Il link per entrare va aperto nello stesso browser in cui l'hai chiesto."; pulisciUrl(); }
        stato = 'fuori'; avvisa();
      }).catch(function () { stato = 'fuori'; msg = 'Non riesco a raggiungere il servizio degli account adesso.'; avvisa(); });
    }
    root.Profilo.quandoCambia(function () { if (utente) sincronizzaPresto(1500); });
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible' && utente) sincronizzaPresto(300); });
  }

  /* ---------- progressi nell'account ---------- */
  var inCorso = false, ancora = false, timer = null;
  function sincronizzaPresto(ms) { clearTimeout(timer); timer = setTimeout(sincronizza, ms || 0); }
  function sincronizza() {
    if (!sb || !utente) return Promise.resolve();
    if (inCorso) { ancora = true; return Promise.resolve(); }
    inCorso = true; sync.stato = 'in corso'; avvisa();
    var uid = utente.id, giri = 0, P = root.Profilo;
    function giro() {
      giri++;
      return sb.from('profili').select('dati,versione').eq('id', uid).maybeSingle().then(function (r) {
        if (r.error) throw r.error;
        var riga = r.data;
        var unito = P.unisci(P.carica(), riga ? riga.dati : null);
        P.sostituisci(unito);
        if (riga && canon(P.unisci(riga.dati, null)) === canon(unito)) return true;   // l'account ha già tutto
        if (!riga) {
          return sb.from('profili').insert({ id: uid, dati: unito }).then(function (w) {
            if (!w.error) return true;
            if (w.error.code === '23505' && giri < 4) return giro();   // un altro dispositivo l'ha appena creato
            throw w.error;
          });
        }
        return sb.from('profili').update({ dati: unito }).eq('id', uid).eq('versione', riga.versione).select('versione').then(function (w) {
          if (w.error) throw w.error;
          if (w.data && w.data.length) return true;
          if (giri < 4) return giro();   // un altro dispositivo ha scritto nel frattempo: si rilegge e si unisce
          throw new Error('troppi tentativi');
        });
      });
    }
    return giro().then(function () { sync.stato = 'ok'; sync.quando = new Date(); }, function (e) {
      sync.stato = 'errore';
      if (root.console) console.warn('Conti:', e && (e.message || e.code || e));
    }).then(function () {
      inCorso = false; avvisa();
      if (ancora) { ancora = false; sincronizzaPresto(500); }
    });
  }

  /* ---------- azioni ---------- */
  function nonRaggiungibile() { msg = 'Non riesco a raggiungere il servizio degli account adesso: riprova tra poco.'; avvisa(); }
  function entraConGoogle() {
    msg = ''; avvisa();
    return carica().then(function () {
      return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: BASE } });
    }).then(function (r) { if (r && r.error) { msg = 'Accesso con Google non riuscito: riprova.'; avvisa(); } }, nonRaggiungibile);
  }
  function erroreEmail(e) {
    var c = (e && (e.code || e.error_code)) || '', m = (e && e.message) || '';
    // (se nel progetto Google non è attivo, non lo proponiamo)
    if (c === 'email_address_not_authorized' || /not authorized/i.test(m)) return "L'accesso con l'email non è ancora aperto a tutti: " + (imp.google === false ? 'per ora i progressi restano in questo browser.' : 'per ora entra con Google.');
    if (c === 'over_email_send_rate_limit' || (e && e.status === 429)) return "Troppe email in poco tempo: riprova tra un po'.";
    if (c === 'email_address_invalid' || /invalid/i.test(m)) return "Controlla l'indirizzo email.";
    return 'Non sono riuscito a mandare il link: riprova.';
  }
  function mandaLink(email) {
    email = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg = "Controlla l'indirizzo email."; avvisa(); return Promise.resolve(false); }
    msg = 'Mando il link…'; avvisa();
    return carica().then(function () {
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: BASE, shouldCreateUser: true } });
    }).then(function (r) {
      if (r && r.error) { msg = erroreEmail(r.error); avvisa(); return false; }
      inviataA = email; msg = ''; avvisa(); return true;
    }, function () { nonRaggiungibile(); return false; });
  }
  function dimentica() {
    utente = null; stato = 'fuori'; sync = { stato: '', quando: null }; inviataA = ''; conferma = false;
    root.Profilo.cancella();   // i progressi restano nell'account; questo browser riparte da zero
    try { root.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* niente memoria */ }
  }
  function esci() {
    return carica().then(function () { return sb.auth.signOut(); }).catch(function () { /* si esce comunque */ })
      .then(function () { dimentica(); msg = 'Sei uscito: i progressi restano nel tuo account.'; avvisa(); });
  }
  function elimina() {
    msg = 'Elimino l\'account…'; avvisa();
    return carica().then(function () { return sb.rpc('elimina_account'); }).then(function (r) {
      if (r && r.error) throw r.error;
      return sb.auth.signOut({ scope: 'local' }).catch(function () { /* l'utente non esiste più */ });
    }).then(function () { dimentica(); msg = 'Account eliminato, insieme ai progressi salvati.'; avvisa(); },
      function () { conferma = false; msg = "Non sono riuscito a eliminare l'account: riprova."; avvisa(); });
  }
  function chiediImpostazioni() {
    if (impChiesta || !cfg || !root.fetch) return;
    impChiesta = true;
    root.fetch(cfg.url + '/auth/v1/settings', { headers: { apikey: cfg.chiave } }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.external) return;
        imp = { google: !!j.external.google, email: !!j.external.email };
        avvisa();
      }, function () { /* senza impostazioni si mostrano entrambi i modi */ });
  }

  /* ---------- aspetto ---------- */
  var CSS =
    '.cn{margin-top:16px;padding-top:14px;border-top:1px solid #3b4784;font:15px/1.45 "Atkinson Hyperlegible",system-ui,sans-serif;color:#f6eedd}' +
    '.cn p{margin:0 0 10px}.cn-nota{color:#b3b5d4;font-size:13px}.cn-nota a{color:#f5aa3e}' +
    '.cn-azioni{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:4px 0 10px}' +
    '.cn-btn{min-height:44px;padding:0 18px;border-radius:12px;border:1px solid #3b4784;background:#283161;color:#f6eedd;font:700 15px "Atkinson Hyperlegible",system-ui,sans-serif;cursor:pointer}' +
    '.cn-google{width:100%;margin:2px 0 10px;background:#f6eedd;color:#131833;border-color:#f6eedd}' +
    '.cn-email{display:flex;gap:8px;margin:0 0 10px}.cn-email input{flex:1;min-width:0;min-height:44px;padding:0 12px;border-radius:12px;border:1px solid #3b4784;' +
    'background:#131833;color:#f6eedd;font:16px "Atkinson Hyperlegible",system-ui,sans-serif}.cn-email .cn-btn{background:#f5aa3e;border-color:#f5aa3e;color:#2a1903}' +
    '.cn-link{background:none;border:0;padding:6px 0;color:#b3b5d4;text-decoration:underline;font:14px "Atkinson Hyperlegible",system-ui,sans-serif;cursor:pointer}' +
    '.cn-rosso{background:#c0392b;border-color:#c0392b}.cn-msg{color:#f5aa3e;font-weight:700}' +
    '.cn-conf{padding:12px;border-radius:12px;border:1px solid #c0392b;background:rgba(192,57,43,.12)}' +
    '.cn-google,.cn-email{max-width:520px}' +
    '@media (hover:hover) and (pointer:fine){.cn-btn:hover{filter:brightness(1.1)}}';
  function stile() {
    if (doc.getElementById('sala-conti-css')) return;
    var st = doc.createElement('style');
    st.id = 'sala-conti-css'; st.textContent = CSS;
    doc.head.appendChild(st);
  }
  function testoSync() {
    if (sync.stato === 'errore') return 'Non riesco a salvare i progressi adesso: riprovo da solo più tardi.';
    if (sync.stato === 'in corso' && !sync.quando) return 'Salvo i progressi nell\'account…';
    if (sync.quando) {
      var h = sync.quando.getHours(), m = sync.quando.getMinutes();
      return 'Progressi salvati nell\'account e uguali su tutti i tuoi dispositivi (alle ' + h + ':' + (m < 10 ? '0' : '') + m + ').';
    }
    return 'Progressi salvati nell\'account.';
  }
  function disegna(box) {
    if (!box || !doc || stato === 'spento') return;
    stile();
    var vecchio = box.querySelector('.cn-email input'), scritto = vecchio ? vecchio.value : '', aveFuoco = vecchio && doc.activeElement === vecchio;
    var h = '';
    if (stato === 'avvio') {
      h = '<p class="cn-nota">Controllo il tuo account…</p>';
    } else if (stato === 'dentro') {
      h = '<p>Account: <b>' + esc(utente.email || 'collegato') + '</b></p><p class="cn-nota">' + esc(testoSync()) + '</p>' +
        (conferma
          ? '<div class="cn-conf"><p>Eliminare l\'account e i progressi salvati? Non si potrà tornare indietro.</p><div class="cn-azioni">' +
            '<button type="button" class="cn-btn cn-rosso" data-cn="elimina-si">Elimina</button><button type="button" class="cn-btn" data-cn="elimina-no">Annulla</button></div></div>'
          : '<div class="cn-azioni"><button type="button" class="cn-btn" data-cn="esci">Esci</button>' +
            '<button type="button" class="cn-link" data-cn="elimina">Elimina il mio account</button></div>');
    } else if (inviataA) {
      h = '<p>Ti ho mandato un link a <b>' + esc(inviataA) + '</b>.</p><p class="cn-nota">Aprilo da questo stesso browser per entrare. Se non arriva, guarda nello spam.</p>' +
        '<div class="cn-azioni"><button type="button" class="cn-link" data-cn="altra">Usa un\'altra email</button></div>';
    } else {
      chiediImpostazioni();
      var g = imp.google !== false, e = imp.email !== false;
      h = '<p><b>Salva i progressi nel tuo account</b> e ritrovali su ogni telefono e computer.</p>' +
        (g ? '<button type="button" class="cn-btn cn-google" data-cn="google">Entra con Google</button>' : '') +
        (e ? '<form class="cn-email" data-cn="email" novalidate><input type="email" name="email" autocomplete="email" placeholder="La tua email" aria-label="La tua email">' +
          '<button type="submit" class="cn-btn">Mandami il link</button></form>' : '') +
        (g || e ? '<p class="cn-nota">' + (e ? 'Con l\'email ricevi un link per entrare, senza password. ' : '') + '<a href="' + esc(BASE) + 'privacy.html">Come usiamo i tuoi dati</a></p>'
          : '<p class="cn-nota">Gli account arriveranno presto: per ora i progressi restano in questo browser.</p>');
    }
    if (msg) h += '<p class="cn-msg" role="status">' + esc(msg) + '</p>';
    box.innerHTML = '<div class="cn">' + h + '</div>';

    var input = box.querySelector('.cn-email input');
    if (input && scritto) { input.value = scritto; if (aveFuoco) input.focus(); }
    function su(sel, fn) { var el = box.querySelector(sel); if (el) el.addEventListener(el.tagName === 'FORM' ? 'submit' : 'click', fn); }
    su('[data-cn=google]', function () { entraConGoogle(); });
    su('[data-cn=email]', function (ev) { ev.preventDefault(); mandaLink(input && input.value); });
    su('[data-cn=altra]', function () { inviataA = ''; msg = ''; avvisa(); });
    su('[data-cn=esci]', function () { esci(); });
    su('[data-cn=elimina]', function () { conferma = true; msg = ''; avvisa(); });
    su('[data-cn=elimina-no]', function () { conferma = false; avvisa(); });
    su('[data-cn=elimina-si]', function () { elimina(); });
  }

  root.Conti = {
    disegna: disegna,
    ascolta: function (f) { if (typeof f === 'function') ascoltatori.push(f); },
    stato: function () { return { stato: stato, email: utente ? utente.email : '', sync: sync.stato }; },
    sincronizza: function () { return sincronizza(); }
  };
  try { avvia(); } catch (e) { stato = 'spento'; if (root.console) console.error('Conti:', e); }
})(window);
