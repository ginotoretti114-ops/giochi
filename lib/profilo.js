/* Profilo: esperienza, livelli, medaglie e sfide del giorno, comuni a tutti i giochi.

   Per ora i progressi stanno nel browser (localStorage «sala-profilo», più «sala-dispositivo» con l'id
   di questo browser). I dati sono fatti per essere uniti tra più dispositivi quando arriverà l'account:
   ogni dispositivo ha i suoi contatori (disp[id], con seq che cresce a ogni scrittura), medaglie e sfide
   sono insiemi con la data; Profilo.unisci(a, b) fa l'unione senza contare due volte niente.

   Nei giochi, a ogni disegno del tavolo:
     Profilo.osserva(gioco, s, P, { vinto: bool, eventi: { nome: 1 } })
       registra una volta sola ogni partita finita (s.status 'gameOver'); gioco è il nome della cartella,
       P viene da persp(s). Sullo stesso telefono si prende solo l'esperienza di partecipazione.
     Profilo.evento(gioco, nome, chiave)   un'impresa durante la partita (una volta per chiave)
     Profilo.chip()                        pulsantino col livello per la barra della lobby
   Nella pagina iniziale: Profilo.disegna(elemento). */
(function (root) {
  'use strict';

  var KEY = 'sala-profilo', DEV_KEY = 'sala-dispositivo', MAX_VISTI = 400, GIORNI_TENUTI = 14;
  var GIOCHI = [
    { id: 'gran-bazar', nome: 'Gran Bazar', bot: false },
    { id: 'sottozero', nome: 'Sottozero', bot: false },
    { id: 'piccante', nome: 'Piccante', bot: false },
    { id: 'diavolerie', nome: 'Diavolerie', bot: true },
    { id: 'sette-stelle', nome: 'Sette Stelle', bot: true },
    { id: 'polvere-e-piombo', nome: 'Polvere e Piombo', bot: true }
  ];
  var ICONE = {
    'gran-bazar': ['🐪', '💎'], 'sottozero': ['❄️', '🧊'], 'piccante': ['🌶️', '🌋'],
    'diavolerie': ['😈', '🔮'], 'sette-stelle': ['🌠', '🌌'], 'polvere-e-piombo': ['🐎', '🏜️']
  };
  var XP_LOCALE = 10, XP_FINITA = 20, XP_VITTORIA = 30, XP_SFIDA = 40, XP_TUTTE = 60;
  var MOLT = { facile: 0.5, medio: 0.75, difficile: 1 }, RANGO = { facile: 1, medio: 2, difficile: 3 };
  var TITOLI = [[1, 'Novellino'], [3, 'Apprendista'], [5, 'Giocatore'], [8, 'Esperto'], [12, 'Campione'], [16, 'Maestro'], [20, 'Leggenda']];

  /* ---------- memoria e orologio (sostituibili nei test) ---------- */
  var store = null, ora = function () { return new Date(); };
  function mem() { if (store) return store; try { return root.localStorage || null; } catch (e) { return null; } }
  function leggi(k) { try { var m = mem(); return m ? m.getItem(k) : null; } catch (e) { return null; } }
  function scrivi(k, v) { try { var m = mem(); if (m) m.setItem(k, v); } catch (e) { /* niente memoria */ } }
  function rnd36(n) { var s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }
  function dispositivo() {
    var d = leggi(DEV_KEY);
    if (!d || !/^[a-z0-9]{6,24}$/.test(d)) { d = 'p' + rnd36(11); scrivi(DEV_KEY, d); }
    return d;
  }
  function due(n) { return (n < 10 ? '0' : '') + n; }
  function giorno(d) { d = d || ora(); return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate()); }
  function giornoPrima(g) { var p = g.split('-'); return giorno(new Date(+p[0], +p[1] - 1, +p[2] - 1, 12)); }

  /* ---------- dati ---------- */
  function vuoto() { return { v: 1, disp: {}, giorni: {}, medaglie: {}, sfide: {}, visti: [] }; }
  function contatori() { return { seq: 0, xp: 0, partite: 0, vittorie: 0, online: 0, umani: 0, giochi: {}, eventi: {} }; }
  function oggetto(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
  function normalizza(p) {
    var o = vuoto();
    if (!p || typeof p !== 'object') return o;
    o.disp = oggetto(p.disp); o.giorni = oggetto(p.giorni); o.medaglie = oggetto(p.medaglie); o.sfide = oggetto(p.sfide);
    if (Array.isArray(p.visti)) o.visti = p.visti.filter(function (x) { return typeof x === 'string'; }).slice(-MAX_VISTI);
    return o;
  }
  function carica() { var p; try { p = JSON.parse(leggi(KEY) || 'null'); } catch (e) { p = null; } return normalizza(p); }
  function salva(p) { scrivi(KEY, JSON.stringify(p)); }
  function valori(o) { return Object.keys(oggetto(o)).map(function (k) { return o[k]; }); }
  function num(x) { x = +x; return isFinite(x) && x > 0 ? x : 0; }
  function somma(recs) {
    var t = contatori();
    recs.forEach(function (r) {
      r = oggetto(r);
      ['xp', 'partite', 'vittorie', 'online', 'umani'].forEach(function (k) { t[k] += num(r[k]); });
      var gi = oggetto(r.giochi), ev = oggetto(r.eventi);
      Object.keys(gi).forEach(function (g) {
        var a = t.giochi[g] || (t.giochi[g] = { partite: 0, vittorie: 0 }), b = oggetto(gi[g]);
        a.partite += num(b.partite); a.vittorie += num(b.vittorie);
      });
      Object.keys(ev).forEach(function (e) { t.eventi[e] = (t.eventi[e] || 0) + num(ev[e]); });
    });
    return t;
  }
  function totali(p) { return somma(valori(p.disp)); }
  function delGiorno(p, g) { return somma(valori(p.giorni[g])); }
  function record(p, dev, g) {
    var d = p.disp[dev] = Object.assign(contatori(), oggetto(p.disp[dev]));
    var gg = oggetto(p.giorni[g]); p.giorni[g] = gg;
    var r = gg[dev] = Object.assign(contatori(), oggetto(gg[dev]));
    [d, r].forEach(function (x) { x.giochi = oggetto(x.giochi); x.eventi = oggetto(x.eventi); });
    return [d, r];
  }
  function pota(p) {
    var ks = Object.keys(p.giorni).sort();
    while (ks.length > GIORNI_TENUTI) delete p.giorni[ks.shift()];
    if (p.visti.length > MAX_VISTI) p.visti = p.visti.slice(-MAX_VISTI);
  }

  /* ---------- esperienza e livelli ---------- */
  function xpSfide(p) { var x = 0; Object.keys(p.sfide).forEach(function (k) { x += /:tutte$/.test(k) ? XP_TUTTE : XP_SFIDA; }); return x; }
  function xpTotale(p) { return totali(p).xp + xpSfide(p); }
  // livello 2 a 100 punti, 3 a 250, 4 a 450, 5 a 700, 10 a 2700: ogni livello chiede 50 punti più del precedente
  function soglia(n) { return n <= 1 ? 0 : 25 * n * (n + 1) - 50; }
  function livelloDi(xp) { var n = 1; while (soglia(n + 1) <= xp) n++; return n; }
  function titoloDi(n) { var t = TITOLI[0][1]; TITOLI.forEach(function (x) { if (n >= x[0]) t = x[1]; }); return t; }

  /* ---------- sfide del giorno: tre al giorno, uguali per tutti ---------- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    return function () {
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pesca(r, a) { return a[Math.floor(r() * a.length)]; }
  function giochiToccati(t) { return Object.keys(t.giochi).filter(function (k) { return t.giochi[k].partite > 0; }).length; }
  function sfideDel(g) {
    var r = rng(hash('sfide:' + g)), G = pesca(r, GIOCHI);
    function S(id, testo, serve, conta) { return { id: id, testo: testo, serve: serve, conta: conta }; }
    var quante = [
      S('fin2', 'Finisci 2 partite', 2, function (t) { return t.partite; }),
      S('fin3', 'Finisci 3 partite', 3, function (t) { return t.partite; }),
      S('due-giochi', 'Gioca a 2 giochi diversi', 2, giochiToccati)
    ];
    var vittorie = [
      S('vinci1', 'Vinci una partita', 1, function (t) { return t.vittorie; }),
      S('vinci2', 'Vinci 2 partite', 2, function (t) { return t.vittorie; }),
      S('difficile', 'Batti il computer al livello difficile', 1, function (t) { return t.eventi.difficile || 0; }),
      S('online', 'Finisci una partita online', 1, function (t) { return t.online; })
    ];
    var delGioco = [S('gioca-' + G.id, 'Gioca a ' + G.nome, 1, function (t) { return (t.giochi[G.id] || {}).partite || 0; })];
    if (G.bot) delGioco.push(S('vinci-' + G.id, 'Vinci a ' + G.nome, 1, function (t) { return (t.giochi[G.id] || {}).vittorie || 0; }));
    if (G.id === 'sette-stelle') delGioco.push(S('sette', 'Fai sette stelle in un round di Sette Stelle', 1, function (t) { return t.eventi.sette || 0; }));
    return [pesca(r, quante), pesca(r, vittorie), pesca(r, delGioco)];
  }
  function statoSfide(p, g) {
    g = g || giorno();
    var t = delGiorno(p, g);
    return sfideDel(g).map(function (c) {
      return { id: c.id, testo: c.testo, fatto: Math.min(c.serve, c.conta(t) || 0), serve: c.serve, presa: !!p.sfide[g + ':' + c.id], xp: XP_SFIDA };
    });
  }
  function serie(p) {
    var fatti = {};
    Object.keys(p.sfide).forEach(function (k) { fatti[k.slice(0, 10)] = true; });
    var g = giorno(), n = 0;
    if (!fatti[g]) g = giornoPrima(g);
    while (fatti[g]) { n++; g = giornoPrima(g); }
    return n;
  }

  /* ---------- medaglie ---------- */
  function M(id, nome, desc, icona, ok) { return { id: id, nome: nome, desc: desc, icona: icona, ok: ok }; }
  function vittorieA(c, g) { return (c.T.giochi[g] || {}).vittorie || 0; }
  var MEDAGLIE = [
    M('prima-partita', 'Prima partita', 'Finisci la tua prima partita', '🎲', function (c) { return c.T.partite >= 1; }),
    M('prima-vittoria', 'Prima vittoria', 'Vinci una partita', '🏆', function (c) { return c.T.vittorie >= 1; }),
    M('partite-10', 'Di casa', 'Finisci 10 partite', '🪑', function (c) { return c.T.partite >= 10; }),
    M('partite-50', 'Veterano', 'Finisci 50 partite', '🎖️', function (c) { return c.T.partite >= 50; }),
    M('vittorie-10', 'Dieci vittorie', 'Vinci 10 partite', '🥇', function (c) { return c.T.vittorie >= 10; }),
    M('vittorie-50', 'Cinquanta vittorie', 'Vinci 50 partite', '👑', function (c) { return c.T.vittorie >= 50; }),
    M('giramondo', 'Giramondo', 'Gioca a tutti e sei i giochi', '🧭', function (c) { return GIOCHI.every(function (g) { return ((c.T.giochi[g.id] || {}).partite || 0) > 0; }); }),
    M('computer', 'Più forte del computer', 'Batti il computer al livello difficile', '🤖', function (c) { return (c.T.eventi.difficile || 0) >= 1; }),
    M('compagnia', 'In compagnia', 'Finisci una partita online con altre persone', '🤝', function (c) { return c.T.umani >= 1; }),
    M('prima-sfida', 'Prima sfida', 'Completa una sfida del giorno', '🎯', function (c) { return c.sfide >= 1; }),
    M('tris', 'Tris', 'Completa tutte e tre le sfide di un giorno', '✨', function (c) { return c.tutte >= 1; }),
    M('costante', 'Costante', 'Completa almeno una sfida per 7 giorni di fila', '🔥', function (c) { return c.serie >= 7; }),
    M('livello-5', 'Livello 5', 'Arriva al livello 5', '⭐', function (c) { return c.livello >= 5; }),
    M('livello-10', 'Livello 10', 'Arriva al livello 10', '🌟', function (c) { return c.livello >= 10; })
  ];
  GIOCHI.forEach(function (g) {
    MEDAGLIE.push(M('vince-' + g.id, 'Vittoria a ' + g.nome, 'Vinci una partita a ' + g.nome, ICONE[g.id][0], function (c) { return vittorieA(c, g.id) >= 1; }));
    MEDAGLIE.push(M('maestro-' + g.id, 'Maestro di ' + g.nome, 'Vinci 10 partite a ' + g.nome, ICONE[g.id][1], function (c) { return vittorieA(c, g.id) >= 10; }));
  });
  MEDAGLIE.push(
    M('sette-stelle', 'Sette stelle', 'Prendi il bonus delle sette carte diverse a Sette Stelle', '💫', function (c) { return (c.T.eventi.sette || 0) >= 1; }),
    M('sceriffo', 'Stella di latta', 'Vinci da Sceriffo a Polvere e Piombo', '🤠', function (c) { return (c.T.eventi['vince-S'] || 0) >= 1; }),
    M('vice', 'Braccio destro', 'Vinci da Vice a Polvere e Piombo', '🛡️', function (c) { return (c.T.eventi['vince-V'] || 0) >= 1; }),
    M('fuorilegge', 'Banda del deserto', 'Vinci da Fuorilegge a Polvere e Piombo', '🌵', function (c) { return (c.T.eventi['vince-F'] || 0) >= 1; }),
    M('rinnegato', 'Lupo solitario', 'Vinci da Rinnegato a Polvere e Piombo', '🐺', function (c) { return (c.T.eventi['vince-R'] || 0) >= 1; })
  );
  function contesto(p) {
    var n = 0, tutte = 0;
    Object.keys(p.sfide).forEach(function (k) { if (/:tutte$/.test(k)) tutte++; else n++; });
    return { T: totali(p), sfide: n, tutte: tutte, serie: serie(p), livello: livelloDi(xpTotale(p)) };
  }

  /* ---------- registrazione ---------- */
  function aggiorna(p, novita) {
    var g = giorno(), ts = ora().toISOString(), tutte = true;
    statoSfide(p, g).forEach(function (c) {
      if (c.fatto < c.serve) { tutte = false; return; }
      if (!p.sfide[g + ':' + c.id]) { p.sfide[g + ':' + c.id] = ts; novita.sfide.push(c.testo); novita.xp += XP_SFIDA; }
    });
    if (tutte && !p.sfide[g + ':tutte']) { p.sfide[g + ':tutte'] = ts; novita.tutte = true; novita.xp += XP_TUTTE; }
    var c = contesto(p);
    MEDAGLIE.forEach(function (m) {
      if (p.medaglie[m.id] || !m.ok(c)) return;
      p.medaglie[m.id] = ts; novita.medaglie.push({ id: m.id, nome: m.nome, icona: m.icona });
    });
  }
  function nuovo() { return { xp: 0, sfide: [], tutte: false, medaglie: [], vinto: false, salito: false, livello: 1 }; }

  function osserva(gioco, s, P, opz) {
    if (!s || s.status !== 'gameOver' || !s.result || !P) return null;
    opz = opz || {};
    var modo = s.mode === 'local' ? 'locale' : s.mode === 'bot' ? 'bot' : 'online';
    if (modo !== 'locale' && (!P.seated || !(P.me >= 0))) return null;   // chi guarda soltanto non prende niente
    var chiave = gioco + ':' + modo + ':' + (s.createdAt || '') + ':' + (s.v || '');
    var p = carica();
    if (p.visti.indexOf(chiave) >= 0) return null;
    var vinto = modo !== 'locale' && !!opz.vinto;
    var bots = oggetto(s.bots), umani = 0, livBot = '';
    (s.seats || []).forEach(function (x, i) {
      if (i === P.me) return;
      if (bots[i]) { if ((RANGO[bots[i]] || 0) > (RANGO[livBot] || 0)) livBot = bots[i]; } else umani++;
    });
    if (modo !== 'online') umani = 0;
    // contro il computer conta il livello del bot più forte; con altre persone vale tutto
    var xp = modo === 'locale' ? XP_LOCALE : Math.round((XP_FINITA + (vinto ? XP_VITTORIA : 0)) * (umani > 0 ? 1 : (MOLT[livBot] || MOLT.medio)));
    var eventi = {};
    Object.keys(oggetto(opz.eventi)).forEach(function (e) { if (/^[A-Za-z0-9-]{1,24}$/.test(e) && opz.eventi[e]) eventi[e] = 1; });
    if (vinto && umani === 0 && livBot === 'difficile') eventi.difficile = 1;

    var livPrima = livelloDi(xpTotale(p));
    p.visti.push(chiave);
    record(p, dispositivo(), giorno()).forEach(function (r) {
      r.seq = num(r.seq) + 1; r.xp = num(r.xp) + xp; r.partite = num(r.partite) + 1;
      if (vinto) r.vittorie = num(r.vittorie) + 1;
      if (modo === 'online') r.online = num(r.online) + 1;
      if (umani > 0) r.umani = num(r.umani) + 1;
      var gg = r.giochi[gioco] = Object.assign({ partite: 0, vittorie: 0 }, oggetto(r.giochi[gioco]));
      gg.partite = num(gg.partite) + 1; if (vinto) gg.vittorie = num(gg.vittorie) + 1;
      Object.keys(eventi).forEach(function (e) { r.eventi[e] = num(r.eventi[e]) + 1; });
    });
    var novita = nuovo();
    novita.xp = xp; novita.vinto = vinto;
    aggiorna(p, novita);
    pota(p); salva(p);
    novita.livello = livelloDi(xpTotale(p)); novita.salito = novita.livello > livPrima;
    avvisa(novita);
    return novita;
  }

  function evento(gioco, nome, chiave) {
    if (!/^[A-Za-z0-9-]{1,24}$/.test(nome || '')) return null;
    var p = carica(), k = 'ev:' + gioco + ':' + chiave;
    if (p.visti.indexOf(k) >= 0) return null;
    var livPrima = livelloDi(xpTotale(p));
    p.visti.push(k);
    record(p, dispositivo(), giorno()).forEach(function (r) { r.seq = num(r.seq) + 1; r.eventi[nome] = num(r.eventi[nome]) + 1; });
    var novita = nuovo();
    aggiorna(p, novita);
    pota(p); salva(p);
    novita.livello = livelloDi(xpTotale(p)); novita.salito = novita.livello > livPrima;
    if (novita.xp || novita.medaglie.length || novita.salito) avvisa(novita);
    return novita;
  }

  /* ---------- unione di due profili (stesso giocatore, dispositivi diversi) ---------- */
  function unisci(a, b) {
    a = normalizza(a); b = normalizza(b);
    var o = vuoto();
    function recente(x, y) { if (!x) return y; if (!y) return x; return num(y.seq) > num(x.seq) ? y : x; }
    function chiavi(x, y) { var k = {}; Object.keys(x).concat(Object.keys(y)).forEach(function (i) { k[i] = 1; }); return Object.keys(k); }
    chiavi(a.disp, b.disp).forEach(function (d) { o.disp[d] = recente(a.disp[d], b.disp[d]); });
    chiavi(a.giorni, b.giorni).forEach(function (g) {
      var x = oggetto(a.giorni[g]), y = oggetto(b.giorni[g]), z = o.giorni[g] = {};
      chiavi(x, y).forEach(function (d) { z[d] = recente(x[d], y[d]); });
    });
    ['medaglie', 'sfide'].forEach(function (k) {
      [a[k], b[k]].forEach(function (m) { Object.keys(m).forEach(function (id) { if (!o[k][id] || String(m[id]) < String(o[k][id])) o[k][id] = m[id]; }); });
    });
    var visti = {};
    a.visti.concat(b.visti).forEach(function (v) { visti[v] = 1; });
    o.visti = Object.keys(visti);
    pota(o);
    return o;
  }

  /* ---------- riepilogo ---------- */
  function riepilogo(p) {
    p = p ? normalizza(p) : carica();
    var T = totali(p), xp = T.xp + xpSfide(p), L = livelloDi(xp), base = soglia(L), next = soglia(L + 1);
    return {
      xp: xp, livello: L, titolo: titoloDi(L), base: base, prossimo: next, progresso: (xp - base) / (next - base),
      partite: T.partite, vittorie: T.vittorie, sfide: statoSfide(p), tutte: !!p.sfide[giorno() + ':tutte'], serie: serie(p),
      medaglie: MEDAGLIE.map(function (m) { return { id: m.id, nome: m.nome, desc: m.desc, icona: m.icona, presa: p.medaglie[m.id] || null }; })
    };
  }

  /* ---------- aspetto: avviso a fine partita, pulsantino della lobby, scheda della sala ---------- */
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CSS =
    '#sala-avviso{position:fixed;left:50%;top:22px;transform:translate(-50%,-160%);z-index:2147483645;width:min(92vw,380px);' +
    'background:#1b2246;color:#f6eedd;border:1px solid #f5aa3e;border-radius:14px;padding:12px 14px;box-shadow:0 12px 32px rgba(0,0,0,.5);' +
    'font:15px/1.4 "Atkinson Hyperlegible",system-ui,sans-serif;transition:transform .35s ease;cursor:pointer}' +
    '#sala-avviso.on{transform:translate(-50%,0)}#sala-avviso div+div{margin-top:4px}#sala-avviso b{color:#f5aa3e}' +
    '#sala-avviso a{display:inline-block;margin-top:8px;color:#f5aa3e;font-weight:700;text-decoration:none}' +
    '.pf-nav{display:flex;align-items:center;gap:12px}' +
    '.pf-chip{display:inline-flex;align-items:center;gap:7px;padding:3px 11px 3px 3px;border-radius:999px;background:#283161;border:1px solid #3b4784;' +
    'color:#f6eedd;font:700 13px/1 "Atkinson Hyperlegible",system-ui,sans-serif;text-decoration:none;white-space:nowrap}' +
    '.pf-chip i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;font-style:normal;background:conic-gradient(#f5aa3e var(--p),#3b4784 0)}' +
    '.pf-chip i span{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#283161;font-size:11px}' +
    '.pf-card{margin-top:28px;background:#1b2246;border:1px solid #3b4784;border-radius:18px;padding:18px}' +
    '.pf-head{display:flex;align-items:center;gap:14px}' +
    '.pf-ring{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:conic-gradient(#f5aa3e var(--p),#3b4784 0)}' +
    '.pf-ring span{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#1b2246;font:26px/1 "Rozha One",Georgia,serif;color:#f5aa3e}' +
    '.pf-who{flex:1;min-width:0}.pf-lv{font:24px/1.1 "Rozha One",Georgia,serif}.pf-lv span{color:#b3b5d4}' +
    '.pf-bar{height:8px;border-radius:99px;background:#283161;margin:8px 0 6px;overflow:hidden}.pf-bar i{display:block;height:100%;border-radius:99px;background:#f5aa3e}' +
    '.pf-sub{color:#b3b5d4;font-size:14px}' +
    '.pf-cols{display:grid;gap:8px 28px;margin-top:6px}' +
    '.pf-cols h2{font:22px/1.2 "Rozha One",Georgia,serif;margin:14px 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}' +
    '.pf-cols h2 span{font:700 13px/1 "Atkinson Hyperlegible",system-ui,sans-serif;color:#b3b5d4}' +
    '.pf-sfide{list-style:none;margin:0;padding:0;display:grid;gap:6px}' +
    '.pf-sfide li{display:grid;grid-template-columns:24px 1fr auto auto;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:#283161;border:1px solid #3b4784}' +
    '.pf-sfide li.ok{border-color:#f5aa3e}.pf-sfide .pf-c{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;border:2px solid #3b4784;font-weight:700;font-size:13px}' +
    '.pf-sfide li.ok .pf-c{background:#f5aa3e;border-color:#f5aa3e;color:#2a1903}.pf-sfide .pf-n{color:#b3b5d4;font-size:14px}' +
    '.pf-sfide .pf-x{font-weight:700;color:#f5aa3e;font-size:14px}.pf-note{margin:8px 0 0;color:#b3b5d4;font-size:14px}' +
    '.pf-med{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}' +
    '.pf-med li{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;padding:10px 6px;border-radius:12px;background:#283161;border:1px solid #3b4784;font-size:12px;line-height:1.2}' +
    '.pf-med .pf-i{font-size:28px;line-height:1}.pf-med li.off{background:transparent;border-style:dashed;color:#b3b5d4}' +
    '.pf-med li.off .pf-i{filter:grayscale(1);opacity:.45}' +
    '.pf-more{margin-top:10px;background:none;border:0;padding:4px 0;color:#f5aa3e;font:700 14px "Atkinson Hyperlegible",system-ui,sans-serif;cursor:pointer}' +
    '.pf-foot{margin:14px 0 0;color:#b3b5d4;font-size:13px}' +
    '@media (min-width:860px){.pf-cols{grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)}}' +
    '@media (prefers-reduced-motion:reduce){#sala-avviso{transition:none}}';
  function stile() {
    if (!root.document || document.getElementById('sala-profilo-css')) return;
    var st = document.createElement('style');
    st.id = 'sala-profilo-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  var timer = null;
  function chiudi() { var el = root.document && document.getElementById('sala-avviso'); if (el) el.className = ''; }
  function avvisa(n) {
    if (!root.document || !document.body) return;
    stile();
    var righe = [];
    if (n.xp) righe.push('<b>+' + n.xp + ' esperienza</b>' + (n.vinto ? ' · hai vinto!' : ''));
    if (n.salito) righe.push('⬆️ Sei al <b>livello ' + n.livello + '</b> · ' + esc(titoloDi(n.livello)));
    n.sfide.forEach(function (t) { righe.push('🎯 Sfida completata: ' + esc(t)); });
    if (n.tutte) righe.push('✨ Tutte le sfide di oggi: +' + XP_TUTTE);
    n.medaglie.forEach(function (m) { righe.push(m.icona + ' Nuova medaglia: <b>' + esc(m.nome) + '</b>'); });
    if (!righe.length) return;
    var el = document.getElementById('sala-avviso');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sala-avviso'; el.setAttribute('role', 'status');
      el.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('a'))) chiudi(); });
      document.body.appendChild(el);
    }
    el.innerHTML = righe.map(function (r) { return '<div>' + r + '</div>'; }).join('') + '<a href="../#profilo">Il tuo profilo ›</a>';
    void el.offsetWidth;
    el.className = 'on';
    clearTimeout(timer); timer = setTimeout(chiudi, 7000);
  }
  function chip(href) {
    stile();
    var r = riepilogo();
    return '<a class="pf-chip" href="' + esc(href || '../#profilo') + '" title="Il tuo profilo: ' + r.xp + ' punti esperienza">' +
      '<i style="--p:' + Math.round(r.progresso * 100) + '%"><span></span></i>Livello ' + r.livello + '</a>';
  }
  function disegna(el) {
    if (!el) return;
    stile();
    var r = riepilogo(), tutte = el.getAttribute('data-tutte') === '1';
    var prese = r.medaglie.filter(function (m) { return m.presa; }), mancano = r.medaglie.filter(function (m) { return !m.presa; });
    var mostra = tutte ? prese.concat(mancano) : prese.concat(mancano.slice(0, Math.max(3, 6 - prese.length)));
    var pct = Math.round(r.progresso * 100);
    el.innerHTML = '<div class="pf-card">' +
      '<div class="pf-head"><div class="pf-ring" style="--p:' + pct + '%"><span>' + r.livello + '</span></div>' +
      '<div class="pf-who"><div class="pf-lv">Livello ' + r.livello + ' · <span>' + esc(r.titolo) + '</span></div>' +
      '<div class="pf-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="pf-sub">' + (r.xp - r.base) + ' / ' + (r.prossimo - r.base) + ' per il livello ' + (r.livello + 1) + ' · ' +
      r.partite + (r.partite === 1 ? ' partita' : ' partite') + ' · ' + r.vittorie + (r.vittorie === 1 ? ' vittoria' : ' vittorie') + '</div></div></div>' +
      '<div class="pf-cols"><section><h2>Sfide di oggi</h2><ul class="pf-sfide">' +
      r.sfide.map(function (c) {
        return '<li class="' + (c.presa ? 'ok' : '') + '"><span class="pf-c">' + (c.presa ? '✓' : '') + '</span><span>' + esc(c.testo) + '</span>' +
          '<span class="pf-n">' + c.fatto + '/' + c.serve + '</span><span class="pf-x">+' + c.xp + '</span></li>';
      }).join('') + '</ul><p class="pf-note">' + (r.tutte ? 'Fatte tutte e tre: +' + XP_TUTTE + ' preso' : 'Tutte e tre: +' + XP_TUTTE + ' in più') +
      (r.serie > 1 ? ' · ' + r.serie + ' giorni di fila' : '') + '. Domani ne arrivano altre.</p></section>' +
      '<section><h2>Medaglie <span>' + prese.length + ' di ' + r.medaglie.length + '</span></h2><ul class="pf-med">' +
      mostra.map(function (m) {
        return '<li class="' + (m.presa ? 'on' : 'off') + '" title="' + esc(m.desc) + '"><span class="pf-i" aria-hidden="true">' + m.icona + '</span>' +
          '<span>' + esc(m.presa ? m.nome : m.desc) + '</span></li>';
      }).join('') + '</ul>' +
      (mostra.length < r.medaglie.length || tutte ? '<button type="button" class="pf-more">' + (tutte ? 'Mostra meno' : 'Tutte le medaglie') + '</button>' : '') +
      '</section></div><p class="pf-foot">Per ora i progressi restano in questo browser.</p></div>';
    var more = el.querySelector('.pf-more');
    if (more) more.addEventListener('click', function () { el.setAttribute('data-tutte', tutte ? '0' : '1'); disegna(el); });
  }

  // un errore del profilo non deve mai fermare un gioco
  function sicuro(fn, altrimenti) {
    return function () { try { return fn.apply(null, arguments); } catch (e) { if (root.console) console.error('Profilo:', e); return altrimenti; } };
  }
  var Profilo = {
    GIOCHI: GIOCHI, MEDAGLIE: MEDAGLIE, KEY: KEY,
    osserva: sicuro(osserva, null), evento: sicuro(evento, null), unisci: unisci, riepilogo: riepilogo, carica: carica,
    chip: sicuro(chip, ''), disegna: sicuro(disegna, undefined), soglia: soglia, livelloDi: livelloDi, sfideDel: sfideDel, giorno: giorno,
    // solo per i test: memoria e orologio finti
    _prova: function (o) { if (o.store !== undefined) store = o.store; if (o.ora) ora = o.ora; }
  };
  root.Profilo = Profilo;
  if (typeof module !== 'undefined' && module.exports) module.exports = Profilo;
})(typeof window !== 'undefined' ? window : globalThis);
