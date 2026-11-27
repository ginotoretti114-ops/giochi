/* Diavolerie: motore di gioco puro (nessun DOM). Si tirano i dadi, si comprano carte dal Quartiere e si
   spengono le proprie carte per evocare demoni. Vince chi ha 3 demoni e 10 anime nello stesso momento.
   Stato = JSON semplice senza array annidati. Una carta del Quartiere è "tipo.copia" (es. "fido.2"). */
(function (root) {
  'use strict';

  var START_SOULS = 5, COST = 3, BLOCK_SIZE = 5, HAND = 3, WIN_DEMONS = 3, WIN_SOULS = 10;
  var MIN_PLAYERS = 2, MAX_PLAYERS = 5, LOG_MAX = 140;

  /* k: B bambino, G bambina, A animale · t: S dolce, R peste · n: numero da tirare · x: copie nel mazzo.
     o: 2 = numero ed effetto come nell'originale, 1 = effetto noto ma numero o dettaglio ricostruiti,
     assente = carta ricostruita nello stesso spirito (l'elenco completo delle carte non è pubblico).
     Come nell'originale gli animali si attivano tutti col 7, bambine e bambini con gli altri numeri. */
  var BLOCK = [
    { id: 'rosina', name: 'Dolce Rosina', k: 'G', t: 'S', n: 2, x: 2, fx: 'collect', v: 5, art: '👧🏼', prop: '🍰', o: 2 },
    { id: 'fortuna', name: 'Dolce Fortuna', k: 'G', t: 'S', n: 5, x: 2, fx: 'destiny', art: '👧🏾', prop: '📣', o: 2 },
    { id: 'lalla', name: 'Dolce Lalla', k: 'G', t: 'S', n: 4, x: 2, fx: 'alice', art: '👧🏻', prop: '🎀', o: 2 },
    { id: 'pina', name: 'Dolce Pina', k: 'G', t: 'S', n: 4, x: 2, fx: 'perAnimal', v: 1, art: '👧', prop: '🐾', o: 2 },
    { id: 'lia', name: 'Dolce Lia', k: 'G', t: 'S', n: 9, x: 2, fx: 'perSweet', art: '👧🏽', prop: '🍭', o: 1 },
    { id: 'mimi', name: 'Dolce Mimì', k: 'G', t: 'S', n: 6, x: 2, fx: 'gainBoy', art: '👧🏿', prop: '💌', o: 1 },
    { id: 'nina', name: 'Nina la Peste', k: 'G', t: 'R', n: 9, x: 2, fx: 'annie', art: '👧🏻', prop: '🧨', o: 2 },
    { id: 'carla', name: 'Carla la Peste', k: 'G', t: 'R', n: 10, x: 2, fx: 'steal', v: 2, art: '👧🏿', prop: '🕷️' },
    { id: 'dora', name: 'Dora la Peste', k: 'G', t: 'R', n: 11, x: 2, fx: 'purgeSweet', art: '👧🏼', prop: '🧪', o: 1 },
    { id: 'tina', name: 'Tina la Peste', k: 'G', t: 'R', n: 3, x: 2, fx: 'discardKid', art: '👧🏽', prop: '✂️' },
    { id: 'gilda', name: 'Gilda la Peste', k: 'G', t: 'R', n: 6, x: 2, fx: 'perRotten', art: '👧', prop: '💀' },
    { id: 'lucia', name: 'Lucia la Peste', k: 'G', t: 'R', n: 5, x: 2, fx: 'steal', v: 1, art: '👧🏾', prop: '🐍' },
    { id: 'gianna', name: 'Gianna', k: 'G', t: null, n: 8, x: 4, fx: 'collect', v: 1, art: '👧🏼', prop: '🪁', o: 1 },
    { id: 'marta', name: 'Marta', k: 'G', t: null, n: 3, x: 2, fx: 'collect', v: 3, art: '👧🏻', prop: '📚' },
    { id: 'olga', name: 'Olga', k: 'G', t: null, n: 12, x: 2, fx: 'collect', v: 5, art: '👧🏿', prop: '🔮' },
    { id: 'viola', name: 'Viola', k: 'G', t: null, n: 10, x: 2, fx: 'collect', v: 2, art: '👧🏽', prop: '🎻' },
    { id: 'ciccio', name: 'Dolce Ciccio', k: 'B', t: 'S', n: 5, x: 2, fx: 'collect', v: 2, art: '👦🏻', prop: '🍩' },
    { id: 'nello', name: 'Dolce Nello', k: 'B', t: 'S', n: 6, x: 2, fx: 'share', art: '👦🏽', prop: '🎈' },
    { id: 'pietro', name: 'Dolce Pietro', k: 'B', t: 'S', n: 8, x: 2, fx: 'pietro', art: '👦🏼', prop: '🧸' },
    { id: 'dario', name: 'Dolce Dario', k: 'B', t: 'S', n: 3, x: 2, fx: 'gainBlock', art: '👦🏾', prop: '🎁' },
    { id: 'tito', name: 'Dolce Tito', k: 'B', t: 'S', n: 11, x: 2, fx: 'collect', v: 4, art: '👦', prop: '🍦' },
    { id: 'leo', name: 'Dolce Leo', k: 'B', t: 'S', n: 10, x: 2, fx: 'leo', art: '👦🏿', prop: '📯' },
    { id: 'sandro', name: 'Sandro la Peste', k: 'B', t: 'R', n: 10, x: 2, fx: 'sam', art: '👦🏼', prop: '🪤', o: 2 },
    { id: 'tonio', name: 'Tonio la Peste', k: 'B', t: 'R', n: 9, x: 2, fx: 'tommy', art: '👦🏻', prop: '🔦', o: 2 },
    { id: 'dino', name: 'Dino la Peste', k: 'B', t: 'R', n: 4, x: 2, fx: 'steal', v: 2, art: '👦🏽', prop: '💣' },
    { id: 'gigi', name: 'Gigi la Peste', k: 'B', t: 'R', n: 6, x: 2, fx: 'steal', v: 1, art: '👦🏿', prop: '🪀' },
    { id: 'carlo', name: 'Carlo la Peste', k: 'B', t: 'R', n: 11, x: 2, fx: 'steal', v: 3, req: 'rotten3', art: '👦🏾', prop: '🐯', o: 1 },
    { id: 'ettore', name: 'Ettore la Peste', k: 'B', t: 'R', n: 8, x: 2, fx: 'perRotten', art: '👦', prop: '🎃' },
    { id: 'ernesto', name: 'Ernesto', k: 'B', t: null, n: 8, x: 2, fx: 'irwin', art: '👦🏼', prop: '🧭', o: 2 },
    { id: 'damiano', name: 'Damiano', k: 'B', t: null, n: 12, x: 2, fx: 'damian', art: '👦🏻', prop: '🔥', o: 1 },
    { id: 'paolo', name: 'Paolo', k: 'B', t: null, n: 6, x: 4, fx: 'collect', v: 1, art: '👦🏽', prop: '⚽' },
    { id: 'franco', name: 'Franco', k: 'B', t: null, n: 2, x: 2, fx: 'collect', v: 5, art: '👦🏿', prop: '🛹' },
    { id: 'fido', name: 'Fido', k: 'A', n: 7, x: 6, fx: 'collect', v: 2, req: 'kid', art: '🐕', o: 1 },
    { id: 'coniglio', name: 'Coniglietto', k: 'A', n: 7, x: 4, fx: 'collect', v: 3, req: 'animals3', art: '🐇', o: 1 },
    { id: 'micio', name: 'Micio Nero', k: 'A', n: 7, x: 4, fx: 'cat', art: '🐈', o: 2 },
    { id: 'pescerosso', name: 'Pesce Rosso', k: 'A', n: 7, x: 4, fx: 'goldfish', art: '🐠', o: 2 },
    { id: 'pappagallo', name: 'Pappagallo Arcobaleno', k: 'A', n: 7, x: 2, fx: 'collect', v: 2, req: 'pair', art: '🦜', o: 2 },
    { id: 'randagio', name: 'Gatto Randagio', k: 'A', n: 7, x: 2, fx: 'steal', v: 1, art: '🐈', prop: '🎸' },
    { id: 'gufo', name: 'Gufo', k: 'A', n: 7, x: 2, fx: 'owl', art: '🦉', o: 2 },
    { id: 'coccodrillo', name: 'Coccodrillo', k: 'A', n: 7, x: 2, fx: 'alligator', art: '🐊', o: 2 },
    { id: 'caprone', name: 'Caprone', k: 'A', n: 7, x: 1, fx: 'goat', art: '🐐', o: 2 },
    { id: 'falco', name: 'Falco', k: 'A', n: 7, x: 1, fx: 'hawk', art: '🦅', o: 2 },
    { id: 'puzzola', name: 'Puzzola', k: 'A', n: 7, x: 1, fx: 'skunk', art: '🦨', o: 2 },
    { id: 'rabbioso', name: 'Cane Rabbioso', k: 'A', n: 7, x: 2, fx: 'collect', v: 2, req: 'noKid', art: '🐶', prop: '💢', o: 1 },
    { id: 'pipistrello', name: 'Pipistrello', k: 'A', n: 7, x: 1, fx: 'bat', art: '🦇' },
    // Espansione «Campo estivo» (exp: 'campo'): carte nostre, nello spirito del gioco, per l'estate in tenda.
    { id: 'greta', name: 'Dolce Greta', k: 'G', t: 'S', n: 3, x: 2, fx: 'perGirl', v: 1, art: '👧🏼', prop: '🏕️', exp: 'campo' },
    { id: 'margherita', name: 'Dolce Margherita', k: 'G', t: 'S', n: 11, x: 2, fx: 'poorest', v: 4, art: '👧🏾', prop: '🌼', exp: 'campo' },
    { id: 'bea', name: 'Bea la Peste', k: 'G', t: 'R', n: 8, x: 2, fx: 'discardAnimal', art: '👧🏻', prop: '🪃', exp: 'campo' },
    { id: 'agnese', name: 'Agnese', k: 'G', t: null, n: 9, x: 2, fx: 'collect', v: 3, req: 'demon', art: '👧🏽', prop: '🗺️', exp: 'campo' },
    { id: 'bruno', name: 'Dolce Bruno', k: 'B', t: 'S', n: 4, x: 2, fx: 'perBoy', v: 1, art: '👦🏻', prop: '🎒', exp: 'campo' },
    { id: 'michele', name: 'Dolce Michele', k: 'B', t: 'S', n: 9, x: 2, fx: 'campfire', art: '👦🏿', prop: '🪵', exp: 'campo' },
    { id: 'rocco', name: 'Rocco la Peste', k: 'B', t: 'R', n: 5, x: 2, fx: 'stealAnimal', art: '👦🏽', prop: '🪝', exp: 'campo' },
    { id: 'ugo', name: 'Ugo la Peste', k: 'B', t: 'R', n: 12, x: 2, fx: 'stealRich', v: 4, art: '👦🏼', prop: '🏹', exp: 'campo' },
    { id: 'nando', name: 'Nando', k: 'B', t: null, n: 2, x: 2, fx: 'perDemon', v: 2, art: '👦', prop: '🛶', exp: 'campo' },
    { id: 'procione', name: 'Procione', k: 'A', n: 7, x: 2, fx: 'richTax', art: '🦝', exp: 'campo' },
    { id: 'orsetto', name: 'Orsetto', k: 'A', n: 7, x: 2, fx: 'collect', v: 3, req: 'demon', art: '🐻', exp: 'campo' },
    { id: 'rana', name: 'Rana del Lago', k: 'A', n: 7, x: 2, fx: 'perAnimal', v: 1, art: '🐸', exp: 'campo' },
    { id: 'lucciole', name: 'Lucciole', k: 'A', n: 7, x: 2, fx: 'fireflies', art: '🪲', prop: '✨', exp: 'campo' },
    { id: 'zanzare', name: 'Zanzare', k: 'A', n: 7, x: 1, fx: 'bite', art: '🦟', exp: 'campo' },
    { id: 'cerbiatto', name: 'Cerbiatto', k: 'A', n: 7, x: 2, fx: 'perSweet', art: '🦌', exp: 'campo' }
  ];
  /* Demoni: con n si attivano solo quando tira chi li ha evocati; con p hanno un potere sempre attivo. */
  var DEMONS = [
    { id: 'cucu', name: 'Satana a Cucù', n: 9, fx: 'clock', art: '😈', prop: '🕰️', o: 2 },
    { id: 'gemelle', name: 'Diavolesse Gemelle', p: 'twins', art: '👿', prop: '👯', o: 2 },
    { id: 'orco', name: 'Orco Doppio', p: 'double', art: '👹', prop: '✌️', o: 2 },
    { id: 'belzedado', name: 'Belzedado', p: 'doubles', art: '😈', prop: '🎲', o: 2 },
    { id: 'ritiracifero', name: 'Ritiracifero', p: 'reroll', art: '🧛', prop: '🔁', o: 2 },
    { id: 'asinodeo', name: 'Asinodeo', p: 'animalGain', art: '🐴', prop: '🔥', o: 2 },
    { id: 'custode', name: 'Spettro Custode', p: 'shield', art: '👻', prop: '🔒', o: 2 },
    { id: 'metallaro', name: 'Capro Metallaro', p: 'tax4', art: '🐐', prop: '🎸', o: 2 },
    { id: 'gorgobambola', name: 'Gorgobambola', p: 'both', art: '🪆', prop: '👁️', o: 1 },
    { id: 'legione', name: 'Legione dei Piccoli', n: 8, fx: 'perCard', art: '👾', prop: '👾', o: 1 },
    { id: 'uovo', name: 'Uovo del Diavolo', n: 6, fx: 'egg', art: '🥚', prop: '😈', o: 1 },
    { id: 'mefisto', name: 'Mefistolesto', n: 10, fx: 'stealAny', art: '👺', prop: '✋', o: 1 },
    { id: 'serpente', name: 'Il Serpente', n: 2, fx: 'serpent', art: '🐍', prop: '👑', o: 2 },
    { id: 'bestie', name: 'Re delle Bestie', n: 5, fx: 'beasts', art: '🦁', prop: '🔥', o: 1 },
    { id: 'mammona', name: 'Mammona', n: 7, fx: 'collect', v: 3, art: '🤑', prop: '💰' },
    { id: 'cerbero', name: 'Cerbero', n: 11, fx: 'collect', v: 6, art: '🐺', prop: '🐺' },
    { id: 'tentazione', name: 'Lady Tentazione', n: 4, fx: 'stealKid', art: '💃', prop: '💋' },
    { id: 'candelora', name: 'Strega Candelora', p: 'candle2', art: '🧙‍♀️', prop: '🕯️' },
    { id: 'sabba', name: 'Barone Sabba', p: 'cheap', art: '🎩', prop: '💸' },
    { id: 'burlone', name: 'Diavolo Burlone', p: 'jester', art: '🤡', prop: '🃏' },
    // Campo estivo
    { id: 'lago', name: 'Mostro del Lago', n: 3, fx: 'perAnimal', v: 2, art: '🦕', prop: '🌊', exp: 'campo' },
    { id: 'fatuo', name: 'Fuoco Fatuo', p: 'wisp', art: '💫', prop: '🌫️', exp: 'campo' },
    { id: 'piedone', name: 'Piedone', n: 4, fx: 'collect', v: 4, art: '🦍', prop: '🦶', exp: 'campo' },
    { id: 'bosco', name: 'Spirito del Bosco', p: 'sweetGain', art: '🌳', prop: '👁️', exp: 'campo' },
    { id: 'caposcout', name: 'Capo Scout Senza Testa', n: 10, fx: 'tribute', art: '👔', prop: '⛺', exp: 'campo' }
  ];
  /* Candele: raccolgono 1 anima quando esce uno dei loro numeri, con chiunque tiri. Non si perdono mai.
     Come nell'originale: quella del principiante col 6 e l'8 (28%), le altre al 25%. */
  var CANDLES = [
    { id: 'principiante', name: 'Candela del Principiante', nums: [6, 8], fx: 'candle', o: 2 },
    { id: 'malvagia', name: 'Candela Malvagia', nums: [9, 10, 11], fx: 'candle', o: 2 },
    { id: 'buona', name: 'Candela Buona', nums: [3, 4, 5], fx: 'candle', o: 1 },
    { id: 'gentile', name: 'Candela Gentile', nums: [4, 7], fx: 'candle', o: 1 },
    { id: 'marcia', name: 'Candela Marcia', nums: [7, 10], fx: 'candle', o: 1 },
    { id: 'lanterna', name: 'Lanterna del Campo', nums: [2, 5, 9], fx: 'candle', art: '🏮', exp: 'campo' }
  ];
  /* Espansioni: le loro carte (campo exp) entrano nei mazzi solo se la partita le ha scelte (s.exp). */
  var ESPANSIONI = [
    { id: 'campo', name: 'Campo estivo', pronta: true,
      text: 'L\'estate in tenda: 9 bambini e bambine, 6 animali del bosco, 5 demoni e la Lanterna del Campo.' }
  ];
  function espansioni(list) {
    var ok = [];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (ok.indexOf(x) < 0 && ESPANSIONI.some(function (e) { return e.id === x && e.pronta; })) ok.push(x);
    });
    return ok;
  }
  function inGioco(s, x) { return !x.exp || (s.exp || []).indexOf(x.exp) >= 0; }
  var BY = {};
  BLOCK.forEach(function (x) { x.cat = 'block'; BY[x.id] = x; });
  DEMONS.forEach(function (x) { x.cat = 'demon'; BY[x.id] = x; });
  CANDLES.forEach(function (x) { x.cat = 'candle'; BY[x.id] = x; });
  function info(uid) { return BY[String(uid).split('.')[0]] || null; }
  function typeOf(uid) { return String(uid).split('.')[0]; }

  /* ---------- testi delle carte ---------- */
  function soulsTxt(v) { return v === 1 ? '1 anima' : v + ' anime'; }
  function orList(a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' o ' + a[a.length - 1] : String(a[0]); }
  var REQ_TXT = { kid: 'Se hai almeno un bambino o una bambina', noKid: 'Se non hai nessun bambino e nessuna bambina', animals3: 'Se hai almeno 3 animali', pair: 'Se hai almeno 2 bambini oppure almeno 2 bambine', rotten3: 'Se hai almeno 3 bambini o bambine pesti', demon: 'Se hai almeno un demone evocato' };
  function text(I) {
    switch (I.fx) {
      case 'candle': return 'Raccogli 1 anima quando esce il ' + orList(I.nums) + ', chiunque tiri. Non si perde mai e non si può spegnere.';
      case 'collect': return I.req ? REQ_TXT[I.req] + ': raccogli ' + soulsTxt(I.v) + '.' : 'Raccogli ' + soulsTxt(I.v) + '.';
      case 'perAnimal': return 'Raccogli ' + soulsTxt(I.v) + ' per ogni tuo animale.';
      case 'perSweet': return 'Raccogli 1 anima per ogni tuo bambino o bambina dolce.';
      case 'perRotten': return 'Raccogli 1 anima per ogni tuo bambino o bambina peste.';
      case 'bat': return 'Raccogli 1 anima, più 1 per ogni tuo demone evocato.';
      case 'perCard': return 'Raccogli 1 anima per ogni tua carta: candela, demoni (lui compreso) e carte del Quartiere.';
      case 'pietro': return 'Raccogli 1 anima, o 3 se hai almeno 3 bambini o bambine dolci.';
      case 'corvo': return 'Raccogli 1 anima, o 2 se hai almeno 2 animali.';
      case 'share': return 'Raccogli 2 anime; ogni altro giocatore ne raccoglie 1.';
      case 'steal': return (I.req ? REQ_TXT[I.req] + ': r' : 'R') + 'uba ' + soulsTxt(I.v) + ' a un giocatore (o prendile dalla riserva).';
      case 'cat': return 'Scarta la prima carta del mazzo del Quartiere: se è un animale, prendilo.';
      case 'alice': return 'Scarta le prime 2 carte del mazzo del Quartiere: prendi ogni bambino o bambina dolce scartato.';
      case 'tommy': return 'Guarda la prima carta del mazzo del Quartiere: se è una bambina prendila, altrimenti scartala.';
      case 'skunk': return 'Ogni giocatore scarta TUTTE le sue carte del Quartiere, questa compresa (demoni e candele restano).';
      case 'irwin': return 'Attiva tutti i tuoi animali.';
      case 'leo': return 'Attiva tutti i tuoi altri bambini e bambine dolci (non gli altri Leo).';
      case 'destiny': return 'Attiva un tuo altro bambino o bambina dolce (non una Fortuna né un Leo).';
      case 'gainBlock': return 'Prendi gratis una carta del Quartiere.';
      case 'gainBoy': return 'Prendi gratis un bambino del Quartiere.';
      case 'purgeSweet': return 'Ogni giocatore, tu compreso, scarta tutti i suoi bambini e bambine dolci.';
      case 'annie': return 'Puoi scartare questa carta: se lo fai, ruba un bambino o una bambina a un altro giocatore, oppure prendine uno dal Quartiere.';
      case 'stealKid': return 'Ruba un bambino o una bambina a un altro giocatore.';
      case 'stealAnimal': return 'Ruba un animale a un altro giocatore.';
      case 'discardKid': return 'Scarta un bambino o una bambina di un altro giocatore.';
      case 'sam': return 'Puoi scartare uno dei tuoi animali: se lo fai, raccogli 6 anime.';
      case 'goat': return 'Puoi scartare esattamente un tuo bambino e una tua bambina: se lo fai, evoca gratis il primo demone del mazzo dei demoni.';
      case 'alligator': return 'Puoi scartare questa carta: se lo fai, scarta fino a 2 bambini o bambine in tutto tra gli altri giocatori.';
      case 'hawk': return 'Puoi scartare questa carta: se lo fai, scopri le prime 7 carte del mazzo del Quartiere, prendi ogni animale e scarta il resto.';
      case 'owl': return 'Sostituisci quante carte vuoi del Quartiere con altre del mazzo.';
      case 'goldfish': return 'Puoi scartare questa carta: se lo fai, raccogli 5 anime.';
      case 'stealAny': return 'Ruba una carta a un altro giocatore, anche un demone (chi lo perde ne pesca uno nuovo in mano).';
      case 'serpent': return 'Vinci subito la partita.';
      case 'beasts': return 'Ruba 1 anima per ogni tuo animale.';
      case 'damian': return 'Puoi scartare questa carta: se lo fai, evoca gratis un demone della tua mano.';
      case 'egg': return 'Si schiude: scarta l\'Uovo, cerca nel mazzo dei demoni quello che vuoi ed evocalo subito al suo posto, gratis.';
      case 'clock': return 'Raccogli 1 anima e fai un altro turno dopo questo: in quel turno si attivano solo le tue carte.';
      case 'perGirl': return 'Raccogli 1 anima per ogni tua bambina (lei compresa).';
      case 'perBoy': return 'Raccogli 1 anima per ogni tuo bambino (lui compreso).';
      case 'poorest': return 'Se nessuno ha meno anime di te, raccogli ' + soulsTxt(I.v) + '; altrimenti 1.';
      case 'campfire': return 'Raccogli 1 anima per ogni giocatore al tavolo, te compreso.';
      case 'stealRich': return 'Ruba ' + soulsTxt(I.v) + ' a chi ne ha di più (se sono in tanti, scegli tu).';
      case 'richTax': return 'Ogni giocatore che ha più anime di te te ne dà 1.';
      case 'bite': return 'Ogni altro giocatore perde 1 anima.';
      case 'tribute': return 'Ogni altro giocatore ti dà 1 anima (se non ne ha, arriva dalla riserva).';
      case 'fireflies': return 'Raccogli 1 anima per ogni numero della tua candela.';
      case 'perDemon': return 'Raccogli ' + soulsTxt(I.v) + ' per ogni tuo demone evocato.';
      case 'discardAnimal': return 'Scarta un animale di un altro giocatore.';
    }
    switch (I.p) {
      case 'twins': return 'I tuoi bambini e bambine contano sia come dolci sia come pesti.';
      case 'double': return 'Nei TUOI turni i tuoi bambini e bambine raccolgono il doppio delle anime.';
      case 'doubles': return 'Ogni volta che TU fai un doppio, raccogli tante anime quanto il valore di un dado.';
      case 'reroll': return 'Ogni volta che tiri i dadi puoi ritirarli una volta: vale il nuovo risultato.';
      case 'animalGain': return 'Ogni volta che prendi un animale, raccogli 1 anima.';
      case 'shield': return 'Gli altri giocatori non possono rubarti niente né farti scartare carte.';
      case 'tax4': return 'Gli altri giocatori devono spegnere una 4ª carta per evocare un demone.';
      case 'both': return 'I tuoi bambini e bambine contano sia come bambini sia come bambine.';
      case 'candle2': return 'La tua candela raccoglie 2 anime invece di 1.';
      case 'cheap': return 'Per te comprare dal Quartiere costa 2 anime invece di 3.';
      case 'jester': return 'Ogni volta che un altro giocatore evoca un demone, raccogli 2 anime.';
      case 'wisp': return 'Ogni volta che esce un doppio, chiunque tiri, raccogli 1 anima.';
      case 'sweetGain': return 'Ogni volta che prendi un bambino o una bambina dolce, raccogli 1 anima.';
    }
    return '';
  }

  /* ---------- caso ---------- */
  var rng = null, forced = [];
  function randInt(n) {
    if (rng) return Math.floor(rng() * n);
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && c.getRandomValues) {
      var buf = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n, x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function die() { return forced.length ? forced.shift() : 1 + randInt(6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pushLog(s, e) {
    s.logN = (s.logN || 0) + 1; e.i = s.logN; // numero progressivo: il registro scorre, il numero no
    s.log = (s.log || []).concat([e]);
    if (s.log.length > LOG_MAX) s.log = s.log.slice(s.log.length - LOG_MAX);
  }
  function touch(s, prevV) { s.v = (prevV || 0) + 1; s.updatedAt = Date.now(); return s; }
  function order(s, from) { var out = [], n = s.seats.length; for (var i = 0; i < n; i++) out.push((from + i) % n); return out; }

  /* ---------- chi ha cosa ---------- */
  function hasP(s, p, code) { return (s.demons[p] || []).some(function (id) { return BY[id].p === code; }); }
  function isKid(u) { var k = info(u).k; return k === 'B' || k === 'G'; }
  function isAnimal(u) { return info(u).k === 'A'; }
  function asBoy(s, p, u) { var k = info(u).k; return k === 'B' || (k === 'G' && hasP(s, p, 'both')); }
  function asGirl(s, p, u) { var k = info(u).k; return k === 'G' || (k === 'B' && hasP(s, p, 'both')); }
  function asSweet(s, p, u) { return isKid(u) && (info(u).t === 'S' || hasP(s, p, 'twins')); }
  function asRotten(s, p, u) { return isKid(u) && (info(u).t === 'R' || hasP(s, p, 'twins')); }
  function count(s, p, fn) { return (s.cards[p] || []).filter(function (u) { return fn(s, p, u); }).length; }
  function kidsF(s, p, u) { return isKid(u); }
  function animalsF(s, p, u) { return isAnimal(u); }
  function shielded(s, victim, actor) { return victim !== actor && hasP(s, victim, 'shield'); }
  function others(s, p) { return order(s, p).slice(1); }
  function owns(s, p, uid) {
    var I = info(uid);
    if (I.cat === 'candle') return s.candle[p] === uid;
    if (I.cat === 'demon') return (s.demons[p] || []).indexOf(uid) >= 0;
    return (s.cards[p] || []).indexOf(uid) >= 0;
  }
  function ownerOf(s, uid) {
    for (var p = 0; p < s.seats.length; p++) if ((s.cards[p] || []).indexOf(uid) >= 0) return p;
    return -1;
  }
  function buyCost(s, p) { return hasP(s, p, 'cheap') ? 2 : COST; }
  function summonCost(s, p) { return others(s, p).some(function (q) { return hasP(s, q, 'tax4'); }) ? 4 : 3; }
  function reqOk(s, p, req) {
    if (req === 'kid') return count(s, p, kidsF) >= 1;
    if (req === 'noKid') return count(s, p, kidsF) === 0;
    if (req === 'animals3') return count(s, p, animalsF) >= 3;
    if (req === 'pair') return count(s, p, asBoy) >= 2 || count(s, p, asGirl) >= 2;
    if (req === 'rotten3') return count(s, p, asRotten) >= 3;
    if (req === 'demon') return (s.demons[p] || []).length >= 1;
    return true;
  }

  /* ---------- movimenti ---------- */
  function addSouls(s, p, n, src) { if (n > 0) { s.souls[p] += n; pushLog(s, { t: 'souls', s: p, n: n, c: src }); } }
  function draw(s) {
    if (!s.deck.length) {
      if (!s.discard.length) return null;
      s.deck = shuffle(s.discard); s.discard = [];
      pushLog(s, { t: 'reshuffle' });
    }
    return s.deck.pop();
  }
  function gain(s, p, uid, how, src, from) {
    s.cards[p].push(uid);
    var e = { t: 'gain', s: p, g: uid, how: how, c: src || null };
    if (from != null) e.from = from;
    pushLog(s, e);
    if (isAnimal(uid) && hasP(s, p, 'animalGain')) addSouls(s, p, 1, 'asinodeo');
    if (asSweet(s, p, uid) && hasP(s, p, 'sweetGain')) addSouls(s, p, 1, 'bosco');
  }
  function drop(s, p, uid, by, src, quiet) {
    var i = s.cards[p].indexOf(uid);
    if (i < 0) return false;
    s.cards[p].splice(i, 1);
    s.discard.push(uid);
    if (!quiet) pushLog(s, { t: 'discard', s: p, g: uid, by: by == null ? p : by, c: src || null });
    return true;
  }
  function takeCard(s, p, uid, src) { // dal Quartiere o rubata a un altro giocatore
    var slot = s.block.indexOf(uid);
    if (slot >= 0) { s.block[slot] = null; gain(s, p, uid, 'block', src); return; }
    if (info(uid).cat === 'demon') {
      var dq = demonOwner(s, uid);
      if (dq < 0) return;
      s.demons[dq].splice(s.demons[dq].indexOf(uid), 1);
      s.demons[p].push(uid);
      pushLog(s, { t: 'gain', s: p, g: uid, how: 'steal', c: src || null, from: dq });
      if (s.ddeck.length) { s.hand[dq].push(s.ddeck.pop()); pushLog(s, { t: 'redraw', s: dq }); } // chi perde un demone ne pesca un altro
      return;
    }
    var from = ownerOf(s, uid);
    if (from < 0) return;
    s.cards[from].splice(s.cards[from].indexOf(uid), 1);
    gain(s, p, uid, 'steal', src, from);
  }
  function demonOwner(s, id) {
    for (var p = 0; p < s.seats.length; p++) if ((s.demons[p] || []).indexOf(id) >= 0) return p;
    return -1;
  }
  function takeSouls(s, p, from, n, src) {
    var got = from >= 0 ? Math.min(n, s.souls[from]) : 0;
    if (from >= 0) s.souls[from] -= got;
    s.souls[p] += n; // quello che manca arriva dalla riserva
    pushLog(s, { t: 'steal', s: p, from: from, n: n, got: got, c: src });
  }
  function summon(s, p, id, how, src) {
    var h = s.hand[p].indexOf(id);
    if (h >= 0) s.hand[p].splice(h, 1);
    s.demons[p].push(id);
    pushLog(s, { t: 'summon', s: p, d: id, how: how, c: src || null });
    others(s, p).forEach(function (q) { if (hasP(s, q, 'jester')) addSouls(s, q, 2, 'burlone'); });
  }
  function refillBlock(s) { for (var i = 0; i < BLOCK_SIZE; i++) if (!s.block[i]) s.block[i] = draw(s); }

  /* ---------- attivazioni ---------- */
  // Ordine in cui un giocatore attiva le sue carte: prima quelle che fanno prendere carte o evocare,
  // poi quelle che ne attivano altre, poi quelle che contano, poi le altre e per ultime quelle che fanno scartare.
  function prio(I) {
    switch (I.fx) {
      case 'cat': case 'alice': case 'tommy': case 'hawk': case 'gainBlock': case 'gainBoy': case 'annie':
      case 'stealKid': case 'stealAnimal': case 'egg': case 'damian': case 'stealAny': case 'serpent': return 1;
      case 'irwin': case 'leo': case 'destiny': return 2;
      case 'perAnimal': case 'perSweet': case 'perRotten': case 'perCard': case 'pietro': case 'corvo': case 'bat': case 'beasts':
      case 'perGirl': case 'perBoy': case 'poorest': case 'campfire': case 'fireflies': case 'perDemon': return 3;
      case 'stealRich': case 'richTax': case 'bite': case 'tribute': return 4;
      case 'collect': case 'steal': return I.req ? 3 : 4;
      case 'sam': case 'goat': case 'alligator': case 'discardKid': case 'discardAnimal': case 'goldfish': return 5;
      case 'skunk': case 'purgeSweet': return 9;
    }
    return 4;
  }
  function eligible(s, sum, roller) {
    var tasks = [];
    order(s, roller).forEach(function (p) {
      if (s.onlyMine && p !== roller) return;
      var own = [];
      if (BY[s.candle[p]].nums.indexOf(sum) >= 0) own.push(s.candle[p]);
      s.cards[p].forEach(function (u) { if (info(u).n === sum) own.push(u); });
      if (p === roller) s.demons[p].forEach(function (id) { if (BY[id].n === sum) own.push(id); });
      own.sort(function (a, b) { return prio(info(a)) - prio(info(b)); });
      own.forEach(function (u) { tasks.push({ s: p, c: u, via: 'roll' }); });
    });
    return tasks;
  }
  function idle(s, p, c) { pushLog(s, { t: 'idle', s: p, c: c }); }
  function ask(s, p, kind, c, extra) {
    s.prompt = { s: p, kind: kind, c: c };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) s.prompt[k] = extra[k];
  }
  function kidTargets(s, p) {
    var out = [];
    others(s, p).forEach(function (q) { if (!shielded(s, q, p)) s.cards[q].forEach(function (u) { if (isKid(u)) out.push(u); }); });
    return out;
  }
  function animalTargets(s, p) {
    var out = [];
    others(s, p).forEach(function (q) { if (!shielded(s, q, p)) s.cards[q].forEach(function (u) { if (isAnimal(u)) out.push(u); }); });
    return out;
  }
  function activate(s, task) {
    var p = task.s, c = task.c, I = info(c);
    if (!owns(s, p, c)) return;
    if (I.req && !reqOk(s, p, I.req)) { idle(s, p, c); return; }
    var dbl = (I.cat === 'block' && isKid(c) && s.turn === p && hasP(s, p, 'double')) ? 2 : 1; // Orco Doppio
    var list, n;
    switch (I.fx) {
      case 'candle': addSouls(s, p, hasP(s, p, 'candle2') ? 2 : 1, c); break;
      case 'collect': addSouls(s, p, I.v * dbl, c); break;
      case 'perAnimal': n = I.v * count(s, p, animalsF) * dbl; if (n) addSouls(s, p, n, c); else idle(s, p, c); break;
      case 'perSweet': n = count(s, p, asSweet) * dbl; if (n) addSouls(s, p, n, c); else idle(s, p, c); break;
      case 'perRotten': n = count(s, p, asRotten) * dbl; if (n) addSouls(s, p, n, c); else idle(s, p, c); break;
      case 'bat': addSouls(s, p, 1 + s.demons[p].length, c); break;
      case 'perCard': addSouls(s, p, 1 + s.demons[p].length + s.cards[p].length, c); break;
      case 'pietro': addSouls(s, p, (count(s, p, asSweet) >= 3 ? 3 : 1) * dbl, c); break;
      case 'corvo': addSouls(s, p, count(s, p, animalsF) >= 2 ? 2 : 1, c); break;
      case 'share':
        addSouls(s, p, 2 * dbl, c);
        others(s, p).forEach(function (q) { addSouls(s, q, 1, c); });
        break;
      case 'steal': case 'beasts':
        n = I.fx === 'beasts' ? count(s, p, animalsF) : I.v;
        if (!n) { idle(s, p, c); break; }
        list = others(s, p).filter(function (q) { return !shielded(s, q, p) && s.souls[q] > 0; });
        if (list.length === 0) takeSouls(s, p, -1, n, c);
        else if (list.length === 1) takeSouls(s, p, list[0], n, c);
        else ask(s, p, 'steal', c, { fx: 'steal', v: n, opts: list });
        break;
      case 'goldfish': ask(s, p, 'yesno', c, { fx: 'goldfish' }); break;
      case 'serpent':
        s.status = 'gameOver'; s.prompt = null; s.queue = []; s.phase = 'over';
        s.result = { winner: p, turns: s.turnNo, why: 'serpent' };
        pushLog(s, { t: 'win', s: p, c: c });
        break;
      case 'stealAny':
        list = [];
        others(s, p).forEach(function (q) { if (!shielded(s, q, p)) list = list.concat(s.cards[q], s.demons[q]); });
        if (!list.length) idle(s, p, c);
        else if (list.length === 1) takeCard(s, p, list[0], c);
        else ask(s, p, 'pick', c, { fx: 'stealAny', opts: list, may: false });
        break;
      case 'cat': {
        var top = draw(s);
        if (!top) { idle(s, p, c); break; }
        if (isAnimal(top)) gain(s, p, top, 'deck', c);
        else { s.discard.push(top); pushLog(s, { t: 'reveal', s: p, g: top, c: c }); }
        break;
      }
      case 'alice': {
        var aside = []; // le carte scoperte vanno negli scarti solo alla fine
        for (var a = 0; a < 2; a++) {
          var u = draw(s);
          if (!u) break;
          if (isKid(u) && info(u).t === 'S') gain(s, p, u, 'deck', c);
          else { aside.push(u); pushLog(s, { t: 'reveal', s: p, g: u, c: c }); }
        }
        s.discard = s.discard.concat(aside);
        break;
      }
      case 'tommy': {
        var t1 = draw(s);
        if (!t1) { idle(s, p, c); break; }
        if (info(t1).k === 'G') gain(s, p, t1, 'deck', c);
        else { s.discard.push(t1); pushLog(s, { t: 'reveal', s: p, g: t1, c: c }); }
        break;
      }
      case 'skunk': {
        var tot = 0;
        order(s, p).forEach(function (q) {
          if (shielded(s, q, p)) return;
          s.cards[q].slice().forEach(function (x) { if (drop(s, q, x, p, c, true)) tot++; });
        });
        pushLog(s, { t: 'skunk', s: p, n: tot, c: c });
        break;
      }
      case 'irwin':
        list = s.cards[p].filter(isAnimal);
        if (!list.length) { idle(s, p, c); break; }
        s.queue = list.map(function (x) { return { s: p, c: x, via: c }; }).concat(s.queue);
        break;
      case 'leo':
        list = s.cards[p].filter(function (x) { return x !== c && asSweet(s, p, x) && typeOf(x) !== 'leo'; });
        if (!list.length) { idle(s, p, c); break; }
        s.queue = list.map(function (x) { return { s: p, c: x, via: c }; }).concat(s.queue);
        break;
      case 'destiny':
        list = s.cards[p].filter(function (x) { return asSweet(s, p, x) && typeOf(x) !== 'fortuna' && typeOf(x) !== 'leo'; });
        if (!list.length) idle(s, p, c);
        else if (list.length === 1) s.queue.unshift({ s: p, c: list[0], via: c });
        else ask(s, p, 'pick', c, { fx: 'destiny', opts: list, may: false });
        break;
      case 'gainBlock': case 'gainBoy':
        list = s.block.filter(function (x) { return x && (I.fx === 'gainBlock' || asBoy(s, p, x)); });
        if (!list.length) idle(s, p, c);
        else if (list.length === 1) takeCard(s, p, list[0], c);
        else ask(s, p, 'pick', c, { fx: I.fx, opts: list, may: false });
        break;
      case 'purgeSweet': {
        var gone = 0;
        order(s, p).forEach(function (q) {
          if (shielded(s, q, p)) return;
          s.cards[q].filter(function (x) { return asSweet(s, q, x); }).forEach(function (x) { if (drop(s, q, x, p, c, true)) gone++; });
        });
        pushLog(s, { t: 'purge', s: p, n: gone, c: c });
        break;
      }
      case 'annie':
        list = kidTargets(s, p).concat(s.block.filter(function (x) { return x && isKid(x); }));
        if (!list.length) idle(s, p, c);
        else ask(s, p, 'pick', c, { fx: 'annie', opts: list, may: true });
        break;
      case 'stealKid': case 'stealAnimal': case 'discardKid':
        list = I.fx === 'stealAnimal' ? animalTargets(s, p) : kidTargets(s, p);
        if (!list.length) idle(s, p, c);
        else if (list.length === 1) finish(s, p, I.fx, c, list);
        else ask(s, p, 'pick', c, { fx: I.fx, opts: list, may: false });
        break;
      case 'sam':
        list = s.cards[p].filter(isAnimal);
        if (!list.length) idle(s, p, c);
        else ask(s, p, 'pick', c, { fx: 'sam', opts: list, may: true });
        break;
      case 'goat':
        list = s.cards[p].filter(isKid);
        if (!s.ddeck.length || !list.some(function (x) { return asBoy(s, p, x); }) || !list.some(function (x) { return asGirl(s, p, x); }) || list.length < 2) idle(s, p, c);
        else ask(s, p, 'multi', c, { fx: 'goat', opts: list, min: 2, max: 2, may: true });
        break;
      case 'alligator':
        list = kidTargets(s, p);
        if (!list.length) idle(s, p, c);
        else ask(s, p, 'multi', c, { fx: 'alligator', opts: list, min: 1, max: 2, may: true });
        break;
      case 'hawk': ask(s, p, 'yesno', c, { fx: 'hawk' }); break;
      case 'owl':
        list = s.block.filter(Boolean);
        if (list.length) ask(s, p, 'multi', c, { fx: 'owl', opts: list, min: 0, max: list.length, may: true });
        break;
      case 'damian':
        if (!s.hand[p].length) idle(s, p, c);
        else ask(s, p, 'pick', c, { fx: 'damian', opts: s.hand[p].slice(), may: true });
        break;
      case 'egg': // dal mazzo dei demoni, quello che si vuole
        if (!s.ddeck.length) idle(s, p, c);
        else if (s.ddeck.length === 1) finish(s, p, 'egg', c, [s.ddeck[0]]);
        else ask(s, p, 'pick', c, { fx: 'egg', opts: s.ddeck.slice(), may: false });
        break;
      case 'clock':
        addSouls(s, p, 1, c);
        s.extra = true;
        pushLog(s, { t: 'extra', s: p, c: c });
        break;
      // Campo estivo
      case 'perGirl': case 'perBoy':
        n = I.v * count(s, p, I.fx === 'perGirl' ? asGirl : asBoy) * dbl;
        if (n) addSouls(s, p, n, c); else idle(s, p, c);
        break;
      case 'poorest':
        addSouls(s, p, (others(s, p).every(function (q) { return s.souls[q] >= s.souls[p]; }) ? I.v : 1) * dbl, c);
        break;
      case 'campfire': addSouls(s, p, s.seats.length * dbl, c); break;
      case 'fireflies': addSouls(s, p, BY[s.candle[p]].nums.length, c); break;
      case 'perDemon': n = I.v * s.demons[p].length * dbl; if (n) addSouls(s, p, n, c); else idle(s, p, c); break;
      case 'stealRich': {
        list = others(s, p).filter(function (q) { return !shielded(s, q, p) && s.souls[q] > 0; });
        var max = Math.max.apply(null, [0].concat(list.map(function (q) { return s.souls[q]; })));
        list = list.filter(function (q) { return s.souls[q] === max; });
        if (!list.length) takeSouls(s, p, -1, I.v, c);   // come per gli altri furti: se nessuno ne ha, arrivano dalla riserva
        else if (list.length === 1) takeSouls(s, p, list[0], I.v, c);
        else ask(s, p, 'steal', c, { fx: 'steal', v: I.v, opts: list });
        break;
      }
      case 'richTax':
        list = others(s, p).filter(function (q) { return !shielded(s, q, p) && s.souls[q] > s.souls[p]; });
        if (!list.length) idle(s, p, c);
        list.forEach(function (q) { takeSouls(s, p, q, 1, c); });
        break;
      case 'tribute':
        list = others(s, p).filter(function (q) { return !shielded(s, q, p); });
        if (!list.length) idle(s, p, c);
        list.forEach(function (q) { takeSouls(s, p, q, 1, c); });
        break;
      case 'bite':
        list = others(s, p).filter(function (q) { return !shielded(s, q, p) && s.souls[q] > 0; });
        if (!list.length) { idle(s, p, c); break; }
        list.forEach(function (q) { s.souls[q] -= 1; pushLog(s, { t: 'lose', s: q, n: 1, by: p, c: c }); });
        break;
      case 'discardAnimal':
        list = animalTargets(s, p);
        if (!list.length) idle(s, p, c);
        else if (list.length === 1) finish(s, p, I.fx, c, list);
        else ask(s, p, 'pick', c, { fx: I.fx, opts: list, may: false });
        break;
    }
  }
  // Completa un effetto dopo la scelta del giocatore (pick: carte scelte; vuoto = rinuncia).
  function finish(s, p, fx, c, pick, target, yes, v) {
    switch (fx) {
      case 'steal': takeSouls(s, p, target, v, c); break;
      case 'goldfish':
        if (!yes) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, c, p, c);
        addSouls(s, p, 5, c);
        break;
      case 'stealAny': takeCard(s, p, pick[0], c); break;
      case 'destiny': s.queue.unshift({ s: p, c: pick[0], via: c }); break;
      case 'gainBlock': case 'gainBoy': takeCard(s, p, pick[0], c); break;
      case 'annie':
        if (!pick.length) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, c, p, c);
        takeCard(s, p, pick[0], c);
        break;
      case 'stealKid': case 'stealAnimal': takeCard(s, p, pick[0], c); break;
      case 'discardKid': case 'discardAnimal': drop(s, ownerOf(s, pick[0]), pick[0], p, c); break;
      case 'sam':
        if (!pick.length) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, pick[0], p, c);
        addSouls(s, p, 6 * ((s.turn === p && hasP(s, p, 'double')) ? 2 : 1), c);
        break;
      case 'goat':
        if (!pick.length) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, pick[0], p, c); drop(s, p, pick[1], p, c);
        if (s.ddeck.length) summon(s, p, s.ddeck.pop(), 'goat', c);
        break;
      case 'alligator':
        if (!pick.length) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, c, p, c);
        pick.forEach(function (u) { var o = ownerOf(s, u); if (o >= 0) drop(s, o, u, p, c); });
        break;
      case 'hawk': {
        if (!yes) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, c, p, c);
        var got = 0, aside = [];
        for (var i = 0; i < 7; i++) {
          var u = draw(s);
          if (!u) break;
          if (isAnimal(u)) { gain(s, p, u, 'deck', c); got++; } else aside.push(u);
        }
        s.discard = s.discard.concat(aside);
        pushLog(s, { t: 'hawk', s: p, n: got, c: c });
        break;
      }
      case 'owl':
        pick.forEach(function (u) { var i = s.block.indexOf(u); if (i >= 0) { s.discard.push(u); s.block[i] = draw(s); } });
        if (pick.length) pushLog(s, { t: 'replace', s: p, n: pick.length, c: c });
        break;
      case 'damian':
        if (!pick.length) { pushLog(s, { t: 'pass', s: p, c: c }); break; }
        drop(s, p, c, p, c);
        summon(s, p, pick[0], 'damian', c);
        break;
      case 'egg': // l'Uovo si schiude: lascia il posto al demone scelto e finisce in fondo al mazzo
        s.ddeck.splice(s.ddeck.indexOf(pick[0]), 1);
        s.ddeck = shuffle(s.ddeck); // il mazzo dei demoni è stato sfogliato
        var eg = s.demons[p].indexOf(c);
        if (eg >= 0) { s.demons[p].splice(eg, 1); s.ddeck.unshift(c); }
        summon(s, p, pick[0], 'egg', c);
        break;
    }
  }
  function checkWin(s) {
    if (s.status !== 'playing') return;
    var list = order(s, s.turn);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (s.demons[p].length >= WIN_DEMONS && s.souls[p] >= WIN_SOULS) {
        s.status = 'gameOver'; s.prompt = null; s.queue = []; s.phase = 'over';
        s.result = { winner: p, turns: s.turnNo };
        pushLog(s, { t: 'win', s: p });
        return;
      }
    }
  }
  function run(s) {
    checkWin(s);
    while (s.status === 'playing' && !s.prompt && s.queue.length) {
      activate(s, s.queue.shift());
      checkWin(s);
    }
    if (s.status === 'playing' && !s.prompt && !s.queue.length) s.phase = 'turn';
  }
  function afterRoll(s) {
    var r = s.roll, p = s.turn;
    if (r.a === r.b && hasP(s, p, 'doubles')) addSouls(s, p, r.a, 'belzedado');
    // Fuoco Fatuo: con ogni doppio, anche degli altri (non nel turno in più di Satana a Cucù, dove conta solo chi tira)
    if (r.a === r.b) order(s, p).forEach(function (q) { if (hasP(s, q, 'wisp') && (!s.onlyMine || q === p)) addSouls(s, q, 1, 'fatuo'); });
    s.queue = eligible(s, r.sum, p);
    s.phase = 'resolve';
    run(s);
  }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now(), names = opts.names || [opts.name || ''];
    return {
      app: 'diavolerie', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online', status: 'waiting',
      seats: names.map(function (n, i) { return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(n || '').slice(0, 20) }; }),
      host: 0, souls: [], candle: [], cards: {}, demons: {}, hand: {},
      block: [], deck: [], discard: [], ddeck: [],
      turn: 0, first: 0, turnNo: 0, phase: 'turn', did: { roll: false, buy: false, summon: false },
      roll: null, lastRoll: null, onlyMine: false, extra: false, queue: [], prompt: null, log: [], logN: 0, result: null,
      exp: espansioni(opts.exp)
    };
  }
  function setup(s) {
    var n = s.seats.length, i, deck = [];
    s.exp = espansioni(s.exp);
    BLOCK.forEach(function (t) { if (inGioco(s, t)) for (var k = 1; k <= t.x; k++) deck.push(t.id + '.' + k); });
    s.deck = shuffle(deck); s.discard = []; s.block = [];
    for (i = 0; i < BLOCK_SIZE; i++) s.block.push(s.deck.pop());
    s.ddeck = shuffle(DEMONS.filter(function (d) { return inGioco(s, d); }).map(function (d) { return d.id; }));
    var candles = shuffle(CANDLES.filter(function (c) { return inGioco(s, c); }).map(function (c) { return c.id; }));
    s.souls = []; s.candle = []; s.cards = {}; s.demons = {}; s.hand = {};
    for (i = 0; i < n; i++) {
      s.souls.push(START_SOULS); s.candle.push(candles[i]);
      s.cards[i] = []; s.demons[i] = []; s.hand[i] = [];
      for (var h = 0; h < HAND; h++) s.hand[i].push(s.ddeck.pop());
    }
    s.turn = s.first = randInt(n); s.turnNo = 1; s.phase = 'turn';
    s.did = { roll: false, buy: false, summon: false };
    s.roll = null; s.lastRoll = null; s.onlyMine = false; s.extra = false; s.queue = []; s.prompt = null;
    s.status = 'playing'; s.result = null; s.log = [];
    pushLog(s, { t: 'turn', s: s.turn, no: 1 });
    return s;
  }
  function startGame(state) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length < MIN_PLAYERS) return { ok: false, error: 'Servono almeno 2 giocatori.' };
    var s = clone(state);
    setup(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startLocal(names, exp) { return setup(newGame({ local: true, names: names, exp: exp })); }
  // Contro il computer: il posto 0 è di chi gioca, gli altri sono bot del livello scelto.
  function startBots(names, level, exp) {
    var s = setup(newGame({ local: true, names: names, exp: exp }));
    s.mode = 'bot'; s.bots = {};
    for (var i = 1; i < names.length; i++) s.bots[i] = level;
    return s;
  }
  function rematch(state) {
    if (!state || state.status !== 'gameOver') return { ok: false, error: 'La partita non è finita.' };
    var s = clone(state), bots = s.bots;
    setup(s);
    if (bots) s.bots = bots;
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function join(state, key, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length >= MAX_PLAYERS) return { ok: false, error: 'Il tavolo è pieno (5 giocatori).' };
    if (seatOf(state, key) >= 0) return { ok: false, error: 'Sei già seduto.' };
    var s = clone(state);
    s.seats.push({ keys: key ? [key] : [], name: String(name || '').slice(0, 20) });
    touch(s, state.v);
    return { ok: true, state: s };
  }
  // Le espansioni di una partita online si scelgono finché si aspettano i giocatori.
  function setExp(state, list) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    var s = clone(state);
    s.exp = espansioni(list);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function seatOf(state, key) {
    if (!state || !key) return -1;
    for (var i = 0; i < state.seats.length; i++) if ((state.seats[i].keys || []).indexOf(key) >= 0) return i;
    return -1;
  }
  function addSeatKey(state, seat, key) {
    var s = clone(state);
    s.seats.forEach(function (x, i) { if (i !== seat) x.keys = (x.keys || []).filter(function (k) { return k !== key; }); });
    var keys = (s.seats[seat].keys || []).filter(function (k) { return k !== key; });
    keys.push(key);
    s.seats[seat].keys = keys.slice(-6);
    touch(s, state.v);
    return { ok: true, state: s };
  }

  /* ---------- mosse ---------- */
  function uniq(a) { return a.every(function (x, i) { return a.indexOf(x) === i; }); }
  function checkAnswer(s, m) {
    var P = s.prompt;
    if (P.kind === 'reroll' || P.kind === 'yesno') return typeof m.yes === 'boolean' ? null : 'Rispondi sì o no.';
    if (P.kind === 'steal') return (m.target === -1 || P.opts.indexOf(m.target) >= 0) ? null : 'Scegli da chi rubare.';
    var pick = m.pick;
    if (!Array.isArray(pick) || !uniq(pick)) return 'Scelta non valida.';
    if (!pick.length) return P.may ? null : 'Devi scegliere.';
    if (!pick.every(function (u) { return P.opts.indexOf(u) >= 0; })) return 'Scelta non valida.';
    if (P.kind === 'pick') return pick.length === 1 ? null : 'Scegli una sola carta.';
    if (pick.length < P.min || pick.length > P.max) return P.min === P.max ? 'Scegli ' + P.min + ' carte.' : 'Scegli da ' + Math.max(1, P.min) + ' a ' + P.max + ' carte.';
    if (P.fx === 'goat' && !((asBoy(s, P.s, pick[0]) && asGirl(s, P.s, pick[1])) || (asGirl(s, P.s, pick[0]) && asBoy(s, P.s, pick[1])))) return 'Servono un bambino e una bambina.';
    return null;
  }
  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'La partita non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    if (typeof seat !== 'number' || seat < 0 || seat >= s.seats.length) return 'Non sei seduto al tavolo.';
    if (m.type === 'answer') {
      if (!s.prompt) return 'Non c\'è niente da decidere.';
      if (s.prompt.s !== seat) return 'Deve decidere un altro giocatore.';
      return checkAnswer(s, m);
    }
    if (seat !== s.turn) return 'Non è il tuo turno.';
    if (s.prompt || s.phase !== 'turn') return 'Aspetta che finiscano le attivazioni.';
    switch (m.type) {
      case 'roll': return s.did.roll ? 'Hai già tirato i dadi.' : null;
      case 'buy':
        if (s.did.buy) return 'In questo turno hai già comprato.';
        if (typeof m.i !== 'number' || !s.block[m.i]) return 'Scegli una carta del Quartiere.';
        if (s.souls[seat] < buyCost(s, seat)) return 'Ti servono ' + buyCost(s, seat) + ' anime.';
        return null;
      case 'summon': {
        if (s.did.summon) return 'In questo turno hai già evocato.';
        if (s.hand[seat].indexOf(m.d) < 0) return 'Scegli un demone della tua mano.';
        var k = summonCost(s, seat);
        if (!Array.isArray(m.cards) || m.cards.length !== k || !uniq(m.cards)) return 'Devi spegnere ' + k + ' carte.';
        if (!m.cards.every(function (u) { return s.cards[seat].indexOf(u) >= 0; })) return 'Puoi spegnere solo carte tue del Quartiere.';
        return null;
      }
      case 'end': return s.did.roll ? null : 'Prima tira i dadi.';
    }
    return 'Mossa sconosciuta.';
  }
  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state), p = seat;
    switch (m.type) {
      case 'answer': {
        var P = s.prompt;
        s.prompt = null;
        if (P.kind === 'reroll') {
          if (m.yes) { var a = die(), b = die(); s.roll = { a: a, b: b, sum: a + b, by: p, rr: true }; pushLog(s, { t: 'reroll', s: p, a: a, b: b }); }
          afterRoll(s);
          break;
        }
        finish(s, P.s, P.fx, P.c, m.pick || [], m.target, m.yes, P.v);
        run(s);
        break;
      }
      case 'roll': {
        var d1 = die(), d2 = die();
        s.roll = { a: d1, b: d2, sum: d1 + d2, by: p, rr: false };
        s.did.roll = true;
        pushLog(s, { t: 'roll', s: p, a: d1, b: d2 });
        if (hasP(s, p, 'reroll')) { s.phase = 'resolve'; ask(s, p, 'reroll', 'ritiracifero', {}); }
        else afterRoll(s);
        break;
      }
      case 'buy': {
        var uid = s.block[m.i];
        s.souls[p] -= buyCost(s, p);
        s.block[m.i] = null;
        s.did.buy = true;
        gain(s, p, uid, 'buy', null);
        checkWin(s);
        break;
      }
      case 'summon':
        m.cards.forEach(function (u) { drop(s, p, u, p, 'snuff'); });
        s.did.summon = true;
        summon(s, p, m.d, 'snuff', null);
        checkWin(s);
        break;
      case 'end':
        refillBlock(s);
        s.lastRoll = s.roll; s.roll = null;
        if (s.extra) { s.extra = false; s.onlyMine = true; }
        else { s.onlyMine = false; s.turn = (s.turn + 1) % s.seats.length; }
        s.did = { roll: false, buy: false, summon: false };
        s.turnNo += 1;
        pushLog(s, { t: 'turn', s: s.turn, no: s.turnNo, extra: s.onlyMine });
        break;
    }
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function nextActor(s) {
    if (!s || s.status !== 'playing') return -1;
    return s.prompt ? s.prompt.s : s.turn;
  }
  function waitingFor(s) { var a = nextActor(s); return a >= 0 ? [a] : []; }

  // Mosse legali (per i test): per i prompt anche qualche risposta a caso.
  function legalMoves(s, seat) {
    var out = [];
    if (!s || s.status !== 'playing') return out;
    if (s.prompt) {
      if (s.prompt.s !== seat) return out;
      var P = s.prompt, i, j;
      if (P.kind === 'reroll' || P.kind === 'yesno') return [{ type: 'answer', yes: true }, { type: 'answer', yes: false }];
      if (P.kind === 'steal') { out.push({ type: 'answer', target: -1 }); P.opts.forEach(function (q) { out.push({ type: 'answer', target: q }); }); return out; }
      if (P.may) out.push({ type: 'answer', pick: [] });
      if (P.kind === 'pick') { P.opts.forEach(function (u) { out.push({ type: 'answer', pick: [u] }); }); return out; }
      for (i = 0; i < P.opts.length; i++) {
        if (P.min <= 1 && P.max >= 1) out.push({ type: 'answer', pick: [P.opts[i]] });
        for (j = i + 1; j < P.opts.length && P.max >= 2; j++) {
          var mv = { type: 'answer', pick: [P.opts[i], P.opts[j]] };
          if (checkAnswer(s, mv) === null) out.push(mv);
        }
      }
      if (P.fx === 'owl' && P.opts.length > 2) out.push({ type: 'answer', pick: P.opts.slice() });
      return out.filter(function (x) { return checkAnswer(s, x) === null; });
    }
    if (seat !== s.turn || s.phase !== 'turn') return out;
    if (!s.did.roll) out.push({ type: 'roll' });
    if (!s.did.buy && s.souls[seat] >= buyCost(s, seat)) s.block.forEach(function (u, k) { if (u) out.push({ type: 'buy', i: k }); });
    var k = summonCost(s, seat);
    if (!s.did.summon && s.hand[seat].length && s.cards[seat].length >= k) {
      s.hand[seat].forEach(function (d) { out.push({ type: 'summon', d: d, cards: shuffle(s.cards[seat].slice()).slice(0, k) }); });
    }
    if (s.did.roll) out.push({ type: 'end' });
    return out;
  }
  function blockCount(s) {
    var n = s.deck.length + s.discard.length + s.block.filter(Boolean).length;
    for (var p = 0; p < s.seats.length; p++) n += (s.cards[p] || []).length;
    return n;
  }
  function demonCount(s) {
    var n = s.ddeck.length;
    for (var p = 0; p < s.seats.length; p++) n += (s.demons[p] || []).length + (s.hand[p] || []).length;
    return n;
  }

  var api = {
    BLOCK: BLOCK, DEMONS: DEMONS, CANDLES: CANDLES, ESPANSIONI: ESPANSIONI, espansioni: espansioni, inGioco: inGioco, setExp: setExp, BY: BY, COST: COST, WIN_DEMONS: WIN_DEMONS, WIN_SOULS: WIN_SOULS,
    START_SOULS: START_SOULS, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, BLOCK_SIZE: BLOCK_SIZE,
    info: info, typeOf: typeOf, text: text, isKid: isKid, isAnimal: isAnimal, asBoy: asBoy, asGirl: asGirl, asSweet: asSweet, asRotten: asRotten,
    hasP: hasP, owns: owns, ownerOf: ownerOf, buyCost: buyCost, summonCost: summonCost, reqOk: reqOk, order: order,
    newGame: newGame, startGame: startGame, startLocal: startLocal, startBots: startBots, demonOwner: demonOwner, prio: prio, rematch: rematch, join: join, seatOf: seatOf, addSeatKey: addSeatKey,
    validate: validate, act: act, nextActor: nextActor, waitingFor: waitingFor, legalMoves: legalMoves,
    blockCount: blockCount, demonCount: demonCount, clone: clone, randInt: randInt, shuffle: shuffle,
    _setRng: function (f) { rng = f; }, _forceDice: function () { forced = forced.concat([].slice.call(arguments)); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Diavolerie = api;
})(typeof window !== 'undefined' ? window : this);
