/* Stalla Matta: le regole pure, senza interfaccia (si usa nella pagina e nei test con node).
   Copia fedele di un gioco di carte con unicorni (mazzo base della seconda edizione), con nomi e grafica originali.

   Da 2 a 8 giocatori. Ognuno parte con un Cucciolo nella stalla e 5 carte in mano. Vince chi ha 7 unicorni nella
   stalla (6 se si gioca in 6, 7 o 8). Il turno: effetti d'inizio turno, si pesca 1 carta, si gioca 1 carta oppure se
   ne pesca un'altra, a fine turno si scarta fino ad averne 7. Quando qualcuno gioca una carta dalla mano, gli altri
   possono fermarla con un Nitrito (e al Nitrito si può rispondere con un altro Nitrito). Se il mazzo finisce vince
   chi ha più unicorni; a pari merito chi ha più lettere nei nomi dei suoi unicorni; se sono ancora pari perdono tutti.

   Le carte: id come mela.2 (tipo.copia). t: cucciolo, semplice, magico (gli unicorni), magia, bonus, malus, istante.
   o: 2 = testo e numero di copie come nell'originale. exp: l'espansione (il mazzo base c'è sempre; le espansioni
   si aggiungono qui con exp e si accendono in ESPANSIONI con pronta: true, una alla volta).
   Gli effetti passano da una pila di passi (stack). Un passo può chiedere una scelta (prompt) a un giocatore, oppure
   a più giocatori insieme (prompt.wait): così il Nitrito e gli effetti «ogni giocatore». Le carte nella stalla che si
   attivano (entrando, uscendo, Recinto) si accodano in s.queue e partono quando l'effetto in corso è finito.
   La cima del mazzo è l'ultima carta dell'array. s.box: le carte tolte dal gioco (Brutti sogni). */
(function (root) {
  'use strict';

  var MIN_PLAYERS = 2, MAX_PLAYERS = 8, MANO_INIZIO = 5, MANO_MAX = 7, LOG_MAX = 260;

  // Le espansioni: il mazzo base c'è sempre; le altre arrivano una alla volta.
  var ESPANSIONI = [
    { id: 'base', name: 'Mazzo base', pronta: true, text: '114 carte e 13 cuccioli: il gioco completo.' },
    { id: 'incubi', name: 'Brutti sogni', pronta: true, text: '50 carte e 3 cuccioli da brivido: Incubi, fantasmi e carte che escono dal gioco.' },
    { id: 'leggende', name: 'Miti e leggende', pronta: true, text: '50 carte e 4 cuccioli fantasy: cavalieri, maghi, incantesimi e Nitriti con effetto.' },
    { id: 'avventure', name: 'Avventure', pronta: true, text: '50 carte e 4 cuccioli da esploratori: pirati, carte a scelta e istantanee che non sono Nitriti.' },
    { id: 'draghi', name: 'Draghi', pronta: true, text: '48 carte e 6 draghetti: carte col drago nel nome, Malus che bruciano e un Unicorno Ammazzadraghi.' },
    { id: 'diluvio', name: 'Diluvio arcobaleno', pronta: true, text: '52 carte e 2 cuccioli (8 sono altre copie di carte del mazzo base): i cavalieri dell\'apocalisse, Magie che svuotano la stalla e cuccioli a volontà.' }
  ];

  var CUCCIOLO = 'Se sta per essere sacrificato, distrutto o rimandato in mano, torna invece nel Nido.';
  var VOLA = ' Se viene sacrificato o distrutto, torna nella tua mano.';
  var INIZIO_TXT = 'Se è nella tua stalla all\'inizio del tuo turno, ';

  // n: copie (1 se manca) · e: disegno · col: colore dell'unicorno · vola: torna in mano se sacrificato o distrutto
  var CARTE = [
    { id: 'cucciolo_rosso', name: 'Cucciolo Rosso', t: 'cucciolo', e: '🍼', col: '#e8555a' },
    { id: 'cucciolo_arancio', name: 'Cucciolo Arancio', t: 'cucciolo', e: '🍼', col: '#f39a3d' },
    { id: 'cucciolo_giallo', name: 'Cucciolo Giallo', t: 'cucciolo', e: '🍼', col: '#f2cf4a' },
    { id: 'cucciolo_verde', name: 'Cucciolo Verde', t: 'cucciolo', e: '🍼', col: '#5cc06a' },
    { id: 'cucciolo_blu', name: 'Cucciolo Blu', t: 'cucciolo', e: '🍼', col: '#4a8fe0' },
    { id: 'cucciolo_viola', name: 'Cucciolo Viola', t: 'cucciolo', e: '🍼', col: '#a05ad6' },
    { id: 'cucciolo_rosa', name: 'Cucciolo Rosa', t: 'cucciolo', e: '🍼', col: '#f58fc1' },
    { id: 'cucciolo_bianco', name: 'Cucciolo Bianco', t: 'cucciolo', e: '🍼', col: '#efeadf' },
    { id: 'cucciolo_nero', name: 'Cucciolo Nero', t: 'cucciolo', e: '🍼', col: '#3a3a4a' },
    { id: 'cucciolo_marrone', name: 'Cucciolo Marrone', t: 'cucciolo', e: '🍼', col: '#9a6b44' },
    { id: 'cucciolo_arcobaleno', name: 'Cucciolo Arcobaleno', t: 'cucciolo', e: '🍼', col: 'arcobaleno' },
    { id: 'cucciolo_fantasma', name: 'Cucciolo Fantasma', t: 'cucciolo', e: '👻', col: '#b9c3d6' },
    { id: 'cucciolo_narvalo', name: 'Cucciolo Narvalo', t: 'cucciolo', e: '🐋', col: '#7fc8d8' },

    { id: 'rosso', name: 'Unicorno Rosso', t: 'semplice', n: 3, e: '🦄', col: '#e8555a' },
    { id: 'arancio', name: 'Unicorno Arancio', t: 'semplice', n: 3, e: '🦄', col: '#f39a3d' },
    { id: 'giallo', name: 'Unicorno Giallo', t: 'semplice', n: 3, e: '🦄', col: '#f2cf4a' },
    { id: 'verde', name: 'Unicorno Verde', t: 'semplice', n: 3, e: '🦄', col: '#5cc06a' },
    { id: 'blu', name: 'Unicorno Blu', t: 'semplice', n: 3, e: '🦄', col: '#4a8fe0' },
    { id: 'indaco', name: 'Unicorno Indaco', t: 'semplice', n: 3, e: '🦄', col: '#5b5bd6' },
    { id: 'viola', name: 'Unicorno Viola', t: 'semplice', n: 3, e: '🦄', col: '#a05ad6' },
    { id: 'narvalo', name: 'Narvalo', t: 'semplice', e: '🐋', col: '#7fc8d8', text: 'Non fa niente di speciale. Ma guardalo.' },

    { id: 'narvalo_incantatore', name: 'Narvalo Incantatore', t: 'magico', e: '💫', text: 'Quando entra nella tua stalla, puoi RUBARE un Bonus.' },
    { id: 'mano_lesta', name: 'Unicorno Mano Lesta', t: 'magico', e: '🤏', text: 'Quando entra nella tua stalla, puoi prendere a caso una carta dalla mano di un altro giocatore.' },
    { id: 'volante_dispettoso', name: 'Volante Dispettoso', t: 'magico', e: '😜', vola: true, text: 'Quando entra nella tua stalla, puoi obbligare un altro giocatore a SCARTARE una carta.' + VOLA },
    { id: 'paladino', name: 'Unicorno Paladino', t: 'magico', e: '🛡️', text: 'Se un unicorno della tua stalla sta per essere distrutto, puoi SACRIFICARE questa carta al suo posto.' },
    { id: 'boscaiolo', name: 'Unicorno Boscaiolo', t: 'magico', e: '🪓', text: 'Quando entra nella tua stalla, puoi DISTRUGGERE un Bonus o SACRIFICARE un Malus.' },
    { id: 'narvalo_frac', name: 'Narvalo in Frac', t: 'magico', e: '🎩', text: 'Quando entra nella tua stalla, puoi cercare nel mazzo un Bonus e prenderlo in mano. Poi mescoli il mazzo.' },
    { id: 'ombra', name: 'Unicorno Ombra', t: 'magico', e: '🌑', text: 'Quando entra nella tua stalla, puoi SACRIFICARE un unicorno, poi portare nella tua stalla un unicorno dagli scarti.' },
    { id: 'catastrofe', name: 'Unicorno Catastrofe', t: 'magico', e: '💥', copie: [{ exp: 'diluvio', n: 2 }], text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) deve SACRIFICARE un unicorno.' },
    { id: 'unicornone', name: 'Unicornone', t: 'magico', e: '⛰️', text: 'Conta come 2 unicorni. Non puoi giocare carte Nitrito.' },
    { id: 'volante_ingordo', name: 'Volante Ingordo', t: 'magico', e: '🤤', vola: true, text: 'Quando entra nella tua stalla, PESCA una carta.' + VOLA },
    { id: 'alpacorno', name: 'Alpacorno', t: 'magico', e: '🦙', copie: [{ exp: 'diluvio', n: 2, o: 1 }], text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) deve SCARTARE una carta.' },
    { id: 'volante_stregato', name: 'Volante Stregato', t: 'magico', e: '✨', vola: true, text: 'Quando entra nella tua stalla, puoi prendere in mano una Magia dagli scarti.' + VOLA },
    { id: 'miciocorno', name: 'Miciocorno', t: 'magico', e: '🐱', copie: [{ exp: 'diluvio', n: 2, o: 1 }], text: 'Le carte Magia non possono distruggerlo.' },
    { id: 'volante_regale', name: 'Volante Regale', t: 'magico', e: '👑', vola: true, text: 'Quando entra nella tua stalla, puoi prendere in mano un unicorno dagli scarti.' + VOLA },
    { id: 'chioccia', name: 'Unicorno Chioccia', t: 'magico', e: '🐔', text: 'Quando entra nella tua stalla, puoi portarci un Cucciolo dal Nido.' },
    { id: 'risacca', name: 'Unicorno Risacca', t: 'magico', e: '🌊', text: 'Quando entra nella tua stalla, rimanda in mano a un altro giocatore una carta della sua stalla.' },
    { id: 'narvalo_spazzino', name: 'Narvalo Spazzino', t: 'magico', e: '🧹', text: 'Quando entra nella tua stalla, SACRIFICA tutti i Malus della tua stalla.' },
    { id: 'evocatore', name: 'Unicorno Evocatore', t: 'magico', e: '💀', text: 'Quando entra nella tua stalla, puoi SCARTARE 2 unicorni, poi portare nella tua stalla un unicorno dagli scarti.' },
    { id: 'reginetta', name: 'Unicorno Reginetta', t: 'magico', e: '🐝', text: 'Gli unicorni semplici non possono entrare in nessuna stalla tranne la tua.' },
    { id: 'pifferaio', name: 'Unicorno Pifferaio', t: 'magico', e: '🎶', text: 'Quando entra nella tua stalla, puoi portarci un unicorno semplice dalla tua mano.' },
    { id: 'ariete', name: 'Unicorno Ariete', t: 'magico', e: '🐏', text: INIZIO_TXT + 'puoi DISTRUGGERE un unicorno. Se lo fai, il tuo turno finisce subito.' },
    { id: 'rubacuori', name: 'Unicorno Rubacuori', t: 'magico', e: '💘', text: 'Quando entra nella tua stalla, puoi SCARTARE una carta, poi RUBARE un unicorno.' },
    { id: 'narvalo_straccione', name: 'Narvalo Straccione', t: 'magico', e: '🧦', text: 'Quando entra nella tua stalla, puoi cercare nel mazzo un Malus e prenderlo in mano. Poi mescoli il mazzo.' },
    { id: 'squalicorno', name: 'Squalicorno', t: 'magico', e: '🦈', text: 'Quando entra nella tua stalla, puoi SACRIFICARE questa carta, poi DISTRUGGERE un unicorno.' },
    { id: 'vendicativo', name: 'Unicorno Vendicativo', t: 'magico', e: '🗡️', text: 'Se viene sacrificato o distrutto, puoi DISTRUGGERE un unicorno.' },
    { id: 'volante_svelto', name: 'Volante Svelto', t: 'magico', e: '💨', vola: true, text: 'Quando entra nella tua stalla, puoi prendere in mano un Nitrito dagli scarti.' + VOLA },
    { id: 'narvalo_supremo', name: 'Narvalo Supremo', t: 'magico', e: '🐳', text: 'Quando entra nella tua stalla, puoi cercare nel mazzo una carta con «Narvalo» nel nome e prenderla in mano. Poi mescoli il mazzo.' },
    { id: 'popcorno', name: 'Popcorno', t: 'magico', e: '🍿', text: 'Quando entra nella tua stalla, PESCA 2 carte e SCARTANE una.' },
    { id: 'indovino', name: 'Unicorno Indovino', t: 'magico', e: '👁️', text: 'Quando entra nella tua stalla, guarda le prime 3 carte del mazzo: prendine una e rimetti le altre in cima, nell\'ordine che vuoi.' },
    { id: 'cenere', name: 'Unicorno Cenere', t: 'magico', e: '🔥', copie: [{ exp: 'diluvio', n: 2 }], text: 'Se sta per essere sacrificato o distrutto, puoi invece SCARTARE una carta.' },

    { id: 'zoccolata', name: 'Zoccolata', t: 'magia', n: 3, e: '🦶', text: 'Rimanda in mano a un altro giocatore una carta della sua stalla. Poi quel giocatore deve SCARTARE una carta.' },
    { id: 'arraffa', name: 'Arraffa!', t: 'magia', e: '🧲', text: 'Guarda la mano di un altro giocatore: scegli una carta e prendila.' },
    { id: 'giro_di_ruota', name: 'Giro di ruota', t: 'magia', n: 2, e: '🎡', text: 'PESCA 2 carte e SCARTANE 3, poi fai un altro turno.' },
    { id: 'bufera', name: 'Bufera di glitter', t: 'magia', n: 2, e: '🌪️', text: 'Rimanda in mano una carta della stalla di ogni giocatore (tu compreso).' },
    { id: 'affare_doro', name: 'Affare d\'oro', t: 'magia', e: '💰', text: 'PESCA 3 carte e SCARTANE una.' },
    { id: 'bocca_a_muso', name: 'Bocca a muso', t: 'magia', e: '💋', text: 'Porta nella tua stalla un unicorno dagli scarti.' },
    { id: 'mulinello', name: 'Mulinello', t: 'magia', e: '🌀', text: 'Ogni giocatore (tu compreso) deve SCARTARE una carta. Poi rimescola gli scarti nel mazzo.' },
    { id: 'cambio_di_rotta', name: 'Cambio di rotta', t: 'magia', n: 2, e: '🧭', text: 'Sposta un Bonus o un Malus dalla stalla di un giocatore a quella di un altro.' },
    { id: 'tabula_rasa', name: 'Tabula rasa', t: 'magia', e: '🔄', text: 'Ogni giocatore (tu compreso) deve SACRIFICARE tutti i Bonus e i Malus della sua stalla. Poi rimescola gli scarti nel mazzo.' },
    { id: 'rimescolone', name: 'Rimescolone', t: 'magia', e: '🃏', text: 'Rimescola nel mazzo questa carta, la tua mano e gli scarti. Poi PESCA 5 carte.' },
    { id: 'colpo_mirato', name: 'Colpo mirato', t: 'magia', e: '🎯', text: 'DISTRUGGI un Bonus o SACRIFICA un Malus.' },
    { id: 'due_per_uno', name: 'Due al prezzo di uno', t: 'magia', n: 2, e: '✌️', text: 'SACRIFICA una carta, poi DISTRUGGI 2 carte.' },
    { id: 'baratto', name: 'Baratto sleale', t: 'magia', n: 2, e: '🤝', text: 'Scambia la tua mano con quella di un altro giocatore.' },
    { id: 'mela', name: 'Mela avvelenata', t: 'magia', n: 3, e: '🍎', text: 'DISTRUGGI un unicorno.' },
    { id: 'scambio_stalla', name: 'Scambio di stalla', t: 'magia', n: 2, e: '🔁', text: 'Sposta un unicorno della tua stalla in quella di un altro giocatore, poi RUBA un unicorno da quella stalla.' },

    { id: 'espresso', name: 'Triplo espresso', t: 'bonus', e: '☕', text: INIZIO_TXT + 'puoi SACRIFICARE una carta, poi PESCARE 2 carte.' },
    { id: 'acchiappapeluche', name: 'Acchiappapeluche', t: 'bonus', n: 3, e: '🧸', text: INIZIO_TXT + 'puoi SCARTARE una carta, poi PESCARNE una.' },
    { id: 'doppietta', name: 'Doppietta', t: 'bonus', e: '⏩', text: INIZIO_TXT + 'in questo turno puoi giocare 2 carte.' },
    { id: 'petardo', name: 'Petardo glitterato', t: 'bonus', n: 2, e: '🧨', text: INIZIO_TXT + 'puoi SACRIFICARE una carta, poi DISTRUGGERNE una.' },
    { id: 'scudo_arcobaleno', name: 'Scudo arcobaleno', t: 'bonus', e: '🌈', text: 'I tuoi unicorni non possono essere distrutti.' },
    { id: 'retino', name: 'Retino arcobaleno', t: 'bonus', e: '🥅', text: INIZIO_TXT + 'puoi SCARTARE 3 carte, poi RUBARE un unicorno.' },
    { id: 'cannoncino', name: 'Cannoncino', t: 'bonus', n: 3, e: '💣', text: INIZIO_TXT + 'puoi SCARTARE 2 carte, poi DISTRUGGERE un unicorno.' },
    { id: 'urra', name: 'Urrà!', t: 'bonus', n: 2, e: '🎉', text: 'Alle carte che giochi non si può rispondere con un Nitrito.' },

    { id: 'recinto', name: 'Recinto spinoso', t: 'malus', e: '🌵', text: 'Ogni volta che un unicorno entra nella tua stalla o ne esce, SCARTA una carta.' },
    { id: 'flash', name: 'Flash abbagliante', t: 'malus', e: '📸', text: 'I tuoi unicorni contano come unicorni semplici, senza effetti.' },
    { id: 'pericolante', name: 'Stalla pericolante', t: 'malus', e: '🏚️', text: 'Non puoi giocare Bonus.' },
    { id: 'occhio', name: 'Occhio indiscreto', t: 'malus', e: '📹', text: 'Tutti vedono le carte che hai in mano.' },
    { id: 'pandastrofe', name: 'Pandastrofe', t: 'malus', e: '🐼', text: 'I tuoi unicorni sono panda: le carte che riguardano gli unicorni non li toccano. Con dei panda non si vince.' },
    { id: 'rito_oscuro', name: 'Rito oscuro', t: 'malus', e: '🕯️', text: INIZIO_TXT + 'SACRIFICA un unicorno, poi PESCA una carta.' },
    { id: 'raffreddore', name: 'Raffreddore', t: 'malus', e: '🤧', text: 'Non puoi giocare carte Nitrito.' },
    { id: 'monolocale', name: 'Monolocale', t: 'malus', e: '📦', text: 'Se nella tua stalla ci sono più di 5 unicorni, SACRIFICANE uno.' },

    { id: 'nitrito', name: 'Nitrito', t: 'istante', n: 14, e: '🐴', neigh: true, text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti.' },
    { id: 'supernitrito', name: 'Supernitrito', t: 'istante', e: '📣', neigh: true, text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti. A questa carta non si risponde con un Nitrito.' },

    /* ---- Brutti sogni (53 carte: 3 cuccioli, 12 semplici, 11 magici, 10 Magie, 4 istantanee, 9 Bonus, 4 Incubi) ---- */
    { id: 'cucciolo_lenzuolo', name: 'Cucciolo Lenzuolo', t: 'cucciolo', e: '👻', col: '#e9e6f2', exp: 'incubi' },
    { id: 'cucciolo_brivido', name: 'Cucciolo Brivido', t: 'cucciolo', e: '😱', col: '#7a5bb0', exp: 'incubi' },
    { id: 'cucciolo_sbirciatina', name: 'Cucciolo Sbirciatina', t: 'cucciolo', e: '👀', col: '#4f8a84', exp: 'incubi' },

    { id: 'impermeabile', name: 'Unicorno Impermeabile', t: 'semplice', n: 3, e: '🌧️', col: '#f2cf4a', exp: 'incubi' },
    { id: 'fifone', name: 'Unicorno Fifone', t: 'semplice', n: 3, e: '😨', col: '#9fb7d8', exp: 'incubi' },
    { id: 'gitante', name: 'Unicorno Gitante', t: 'semplice', n: 3, e: '🎒', col: '#e58fb0', exp: 'incubi' },
    { id: 'guardiano', name: 'Unicorno Guardiano', t: 'semplice', n: 3, e: '🔦', col: '#5a6f9e', exp: 'incubi' },

    { id: 'mascherato', name: 'Unicorno Mascherato', t: 'magico', e: '🪚', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi PESCARE una carta per ogni unicorno semplice nella tua stalla.' },
    { id: 'sensitivo', name: 'Unicorno Sensitivo', t: 'magico', e: '🔮', exp: 'incubi', text: 'Tutti vedono le carte che hai in mano. ' + INIZIO_TXT + 'puoi PESCARE una carta.' },
    { id: 'pagliaccio', name: 'Pagliaccio Ballerino', t: 'magico', e: '🤡', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi SCARTARE 2 carte, poi rimandare in mano a ogni altro giocatore una carta della sua stalla.' },
    { id: 'diavolicorno', name: 'Diavolicorno', t: 'magico', e: '😈', exp: 'incubi', text: 'Se viene distrutto, puoi TOGLIERE DAL GIOCO una carta della stalla di un giocatore qualsiasi.' },
    { id: 'mietitore', name: 'Unicorno Mietitore', t: 'magico', e: '🪦', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi PESCARE una carta. Se è un Nitrito, puoi mostrarlo a tutti e PESCARNE un\'altra.' },
    { id: 'spettrale', name: 'Unicorno Spettrale', t: 'magico', e: '🌫️', exp: 'incubi', text: 'Non può essere sacrificato né distrutto.' },
    { id: 'burattino', name: 'Unicorno Burattino', t: 'magico', e: '🎭', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi spostare un Malus della tua stalla in quella di un altro giocatore.' },
    { id: 'nonnina', name: 'Nonna Zuccherina', t: 'magico', e: '👵', exp: 'incubi', text: 'Conta come 2 unicorni. Se viene sacrificata o distrutta, SACRIFICA una carta.' },
    { id: 'uncinocorno', name: 'Uncinocorno', t: 'magico', e: '🪝', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi SCARTARE una carta, poi TOGLIERE DAL GIOCO una carta della stalla di un giocatore qualsiasi.' },
    { id: 'rancoroso', name: 'Unicorno Rancoroso', t: 'magico', e: '😤', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi SACRIFICARE un unicorno semplice, poi PESCARE 3 carte.' },
    { id: 'pipistrellicorno', name: 'Pipistrellicorno', t: 'magico', e: '🦇', exp: 'incubi', text: 'Se viene sacrificato o distrutto, puoi guardare la mano di un altro giocatore: scegli una carta e prendila.' },

    { id: 'toc_toc', name: 'Toc toc, chi è?', t: 'magia', n: 3, e: '🚪', exp: 'incubi', text: 'TOGLI DAL GIOCO una carta della stalla di un giocatore qualsiasi.' },
    { id: 'possessione', name: 'Possessione', t: 'magia', e: '👹', exp: 'incubi', text: 'SCARTA una carta, poi RUBA una carta.' },
    { id: 'fuori_dalla_tomba', name: 'Fuori dalla tomba', t: 'magia', n: 2, e: '🧟', exp: 'incubi', text: 'Porta nella tua stalla un unicorno semplice dagli scarti, poi PESCA una carta.' },
    { id: 'piu_spettro', name: 'La legge del più spettro', t: 'magia', n: 2, e: '⚖️', exp: 'incubi', text: 'Scegli un giocatore qualsiasi: DISTRUGGI tutti gli unicorni semplici della sua stalla.' },
    { id: 'seduta_spiritica', name: 'Seduta spiritica', t: 'magia', n: 2, e: '🌒', exp: 'incubi', text: 'Cerca nel mazzo un Incubo e mettilo nella stalla di un giocatore qualsiasi. Poi mescoli il mazzo.' },

    { id: 'spirito_guida', name: 'Spirito guida', t: 'bonus', e: '🏮', exp: 'incubi', text: INIZIO_TXT + 'puoi PESCARE una carta e mostrarla a tutti: se è un Bonus o un Malus, mettila nella tua stalla.' },
    { id: 'elisir', name: 'Elisir di lunga vita', t: 'bonus', n: 2, e: '🧪', exp: 'incubi', text: 'Se una carta della tua stalla sta per essere sacrificata o distrutta, puoi invece SCARTARE una carta.' },
    { id: 'cuore_stregato', name: 'Cuore stregato', t: 'bonus', n: 2, e: '🖤', exp: 'incubi', text: 'Quando entra nella tua stalla, puoi PESCARE 2 carte. I Bonus della tua stalla non possono essere distrutti.' },
    { id: 'poltergeist', name: 'Dispetto del poltergeist', t: 'bonus', e: '🪑', exp: 'incubi', text: INIZIO_TXT + 'puoi saltare la pesca: se lo fai, prendi a caso una carta dalla mano di un altro giocatore.' },
    { id: 'cerchio_di_sale', name: 'Cerchio di sale', t: 'bonus', n: 2, e: '🧂', exp: 'incubi', text: 'Nella tua stalla non possono entrare Malus. Questa carta non può essere sacrificata né distrutta.' },
    { id: 'lavoretto', name: 'Lavoretto inquietante', t: 'bonus', e: '🧵', exp: 'incubi', text: INIZIO_TXT + 'puoi SCARTARE 3 carte, poi TOGLIERE DAL GIOCO una carta della stalla di un giocatore qualsiasi.' },

    { id: 'incubo_sepolto', name: 'Incubo: sepolto vivo', t: 'malus', e: '⚰️', inc: true, exp: 'incubi', text: INIZIO_TXT + 'SACRIFICA un unicorno. Se nella tua stalla non ci sono unicorni, riprendi in mano questa carta.' },
    { id: 'incubo_occupato', name: 'Incubo: occupato!', t: 'malus', e: '🚽', inc: true, exp: 'incubi', text: 'Quando entra nella tua stalla, SACRIFICA un unicorno. Finché è nella tua stalla non puoi vincere.' },
    { id: 'incubo_vuoto', name: 'Incubo: il vuoto cosmico', t: 'malus', e: '🕳️', inc: true, exp: 'incubi', text: INIZIO_TXT + 'RUBA un Malus.' },
    { id: 'incubo_palestra', name: 'Incubo: palestra infernale', t: 'malus', e: '🏋️', inc: true, exp: 'incubi', text: 'Quando entra nella tua stalla, SCARTA tutta la mano, poi PESCA una carta. Puoi tenere in mano 3 carte in meno.' },

    { id: 'nitrito_maledetto', name: 'Nitrito maledetto', t: 'istante', n: 4, e: '🧿', neigh: true, exp: 'incubi', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e la TOGLI DAL GIOCO.' },

    /* ---- Miti e leggende (54 carte: 4 cuccioli, 12 semplici, 11 magici, 11 Magie, 4 Bonus, 6 Malus, 6 istantanee) ---- */
    { id: 'cucciolo_elfetto', name: 'Cucciolo Elfetto', t: 'cucciolo', e: '🧝', col: '#7cc07a', exp: 'leggende' },
    { id: 'cucciolo_nanetto', name: 'Cucciolo Nanetto', t: 'cucciolo', e: '⛏️', col: '#b0784a', exp: 'leggende' },
    { id: 'cucciolo_gnometto', name: 'Cucciolo Gnometto', t: 'cucciolo', e: '🍄', col: '#d9534f', exp: 'leggende' },
    { id: 'cucciolo_orchetto', name: 'Cucciolo Orchetto', t: 'cucciolo', e: '💪', col: '#6f8f3a', exp: 'leggende' },

    { id: 'sentinella', name: 'Unicorno Sentinella', t: 'semplice', n: 3, e: '💂', col: '#c94c4c', exp: 'leggende' },
    { id: 'fabbro', name: 'Unicorno Fabbro', t: 'semplice', n: 3, e: '🔨', col: '#8a8f99', exp: 'leggende' },
    { id: 'oste', name: 'Unicorno Oste', t: 'semplice', n: 3, e: '🍺', col: '#d9a441', exp: 'leggende' },
    { id: 'nobile', name: 'Unicorno Nobile', t: 'semplice', n: 3, e: '💎', col: '#8e6fd1', exp: 'leggende' },

    { id: 'domatore', name: 'Unicorno Domatore', t: 'magico', e: '🐾', exp: 'leggende', text: INIZIO_TXT + 'puoi portare nella tua stalla un Cucciolo dal Nido. Se lo fai, salti la pesca.' },
    { id: 'furioso', name: 'Unicorno Furioso', t: 'magico', e: '😡', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi DISTRUGGERE un unicorno. Se viene distrutto, SACRIFICA un unicorno.' },
    { id: 'bardo', name: 'Bardo Ammaliatore', t: 'magico', e: '🎻', exp: 'leggende', text: INIZIO_TXT + 'puoi spostarlo nella stalla di un altro giocatore, poi RUBARE un unicorno da quella stalla e PESCARE una carta.' },
    { id: 'divino', name: 'Unicorno Divino', t: 'magico', e: '😇', exp: 'leggende', text: 'Quando entra nella tua stalla, guardi le prime 3 carte del mazzo: ne prendi una e SCARTI le altre due.' },
    { id: 'nanocorno', name: 'Nanocorno Artigiano', t: 'magico', e: '⚒️', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi SCARTARE una carta. Se lo fai, cerca nel mazzo un Bonus e mettilo nella tua stalla. Poi mescoli il mazzo.' },
    { id: 'elficorno', name: 'Elficorno Esploratore', t: 'magico', e: '🏹', exp: 'leggende', text: 'Quando entra nella tua stalla, guarda le prime 3 carte del mazzo e rimettile in cima nell\'ordine che vuoi.' },
    { id: 'orchicorno', name: 'Orchicorno Predone', t: 'magico', e: '⚔️', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi spostare un Malus della tua stalla in quella di un altro giocatore, poi RUBARE un Bonus da quella stalla.' },
    { id: 'cavaliere', name: 'Cavaliere senza macchia', t: 'magico', e: '⚜️', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi DISTRUGGERE una carta. Non puoi RUBARE carte.' },
    { id: 'furfante', name: 'Unicorno Furfante', t: 'magico', e: '🗝️', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi SCARTARE 2 carte, poi RUBARE una carta.' },
    { id: 'stregone', name: 'Unicorno Stregone', t: 'magico', e: '☠️', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi SACRIFICARE quante carte vuoi, poi DISTRUGGERNE altrettante.' },
    { id: 'mago', name: 'Unicorno Mago', t: 'magico', e: '🧙', exp: 'leggende', text: 'Quando entra nella tua stalla, puoi SCARTARE una carta. Se lo fai, cerca nel mazzo una Magia e prendila in mano: la giochi subito (se si può), poi mescoli il mazzo.' },

    { id: 'raso_al_suolo', name: 'Raso al suolo', t: 'magia', n: 3, e: '🏗️', exp: 'leggende', text: 'DISTRUGGI un Bonus o SACRIFICA un Malus.' },
    { id: 'voltagabbana', name: 'Voltagabbana', t: 'magia', n: 2, e: '🏳️', exp: 'leggende', text: 'SCARTA 2 carte, poi RUBA un unicorno.' },
    { id: 'raglio', name: 'Raglio prismatico', t: 'magia', n: 2, e: '🔊', exp: 'leggende', text: 'SCARTA fino a 2 carte, poi scegli altrettanti giocatori: ognuno deve SACRIFICARE un unicorno.' },
    { id: 'palla_di_fuoco', name: 'Palla di fuoco', t: 'magia', e: '☄️', exp: 'leggende', text: 'Ogni giocatore (tu compreso) deve SACRIFICARE un unicorno.' },
    { id: 'fulmine', name: 'Fulmine a catena', t: 'magia', n: 2, e: '⚡', exp: 'leggende', text: 'DISTRUGGI una carta nella stalla di un altro giocatore. Poi quel giocatore può DISTRUGGERE una carta.' },
    { id: 'negromanzia', name: 'Negromanzia', t: 'magia', e: '🦴', exp: 'leggende', text: 'SACRIFICA un unicorno, poi porta nella tua stalla un unicorno dagli scarti.' },

    { id: 'colpo_critico', name: 'Colpo critico', t: 'bonus', n: 2, e: '🎲', exp: 'leggende', text: 'Quando giochi una Magia, puoi SACRIFICARE questa carta: se lo fai, quando la Magia ha fatto effetto torna nella tua mano e la giochi subito di nuovo.' },
    { id: 'bisaccia', name: 'Bisaccia senza fondo', t: 'bonus', e: '👝', exp: 'leggende', text: 'Puoi tenere in mano 3 carte in più.' },
    { id: 'muro_di_corna', name: 'Muro di corna', t: 'bonus', e: '🧱', exp: 'leggende', text: 'Ogni volta che un altro giocatore ti distrugge un unicorno, puoi prendere a caso una carta dalla sua mano.' },

    { id: 'pace_divina', name: 'Pace divina', t: 'malus', n: 2, e: '🕊️', exp: 'leggende', text: 'Non puoi DISTRUGGERE carte.' },
    { id: 'maleficio', name: 'Maleficio', t: 'malus', n: 2, e: '🐸', exp: 'leggende', text: INIZIO_TXT + 'salti la pesca. Se resti senza carte in mano, sposta questa carta nella stalla di un altro giocatore che ne ha.' },
    { id: 'igiene_medievale', name: 'Igiene medievale', t: 'malus', n: 2, e: '🦠', exp: 'leggende', text: 'I tuoi unicorni contano come unicorni semplici, senza effetti.' },

    { id: 'nitrito_messere', name: 'Nitrito, messere!', t: 'istante', n: 2, e: '🍷', neigh: true, exp: 'leggende', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti. Chi l\'ha giocata può PESCARE una carta.' },
    { id: 'nitrito_villano', name: 'Nitrito, villano!', t: 'istante', n: 2, e: '🌾', neigh: true, exp: 'leggende', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti. Chi l\'ha giocata deve SCARTARE una carta.' },
    { id: 'nitrito_canaglia', name: 'Nitrito, canaglia!', t: 'istante', n: 2, e: '🦹', neigh: true, exp: 'leggende', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti.' },

    /* ---- Avventure (54 carte: 4 cuccioli, 12 semplici, 12 magici, 8 Magie, 9 istantanee, 5 Bonus, 4 Malus) ---- */
    { id: 'cucciolo_pescatore', name: 'Cucciolo Pescatore', t: 'cucciolo', e: '🐟', col: '#5aa9d6', exp: 'avventure' },
    { id: 'cucciolo_boschivo', name: 'Cucciolo Boschivo', t: 'cucciolo', e: '🌲', col: '#4f9a5b', exp: 'avventure' },
    { id: 'cucciolo_pirata', name: 'Cucciolo Pirata', t: 'cucciolo', e: '🏴‍☠️', col: '#3d3d4f', exp: 'avventure' },
    { id: 'cucciolo_safari', name: 'Cucciolo Safari', t: 'cucciolo', e: '🦒', col: '#d8b45a', exp: 'avventure' },

    { id: 'curioso', name: 'Unicorno Curioso', t: 'semplice', n: 3, e: '🔭', col: '#e8954a', exp: 'avventure' },
    { id: 'campeggiatore', name: 'Unicorno Campeggiatore', t: 'semplice', n: 3, e: '⛺', col: '#7bbf6a', exp: 'avventure' },
    { id: 'scalatore', name: 'Unicorno Scalatore', t: 'semplice', n: 3, e: '🧗', col: '#c77dd1', exp: 'avventure' },
    { id: 'mozzo', name: 'Unicorno Mozzo', t: 'semplice', n: 3, e: '⚓', col: '#4a78c2', exp: 'avventure' },

    { id: 'bungee', name: 'Unicorno Bungee', t: 'magico', e: '🪂', exp: 'avventure', text: 'Se viene sacrificato o distrutto, puoi scegliere: SACRIFICHI un Malus, oppure lo riprendi in mano.' },
    { id: 'capitano', name: 'Capitano Tagliagole', t: 'magico', e: '🦜', exp: 'avventure', text: 'Quando entra nella tua stalla, puoi scegliere: RUBI un Cucciolo, oppure porti nella tua stalla un unicorno semplice dagli scarti.' },
    { id: 'avventuriero', name: 'Avventuriero Estremo', t: 'magico', e: '🏔️', exp: 'avventure', text: 'Gli unicorni semplici non possono entrare nella tua stalla. ' + INIZIO_TXT + 'puoi PESCARE una carta.' },
    { id: 'impavido', name: 'Unicorno Impavido', t: 'magico', e: '🦸', exp: 'avventure', text: 'Se viene sacrificato o distrutto, puoi prendere in mano un\'istantanea dagli scarti.' },
    { id: 'primo_ufficiale', name: 'Primo Ufficiale', t: 'magico', e: '🧜', exp: 'avventure', text: 'Se viene sacrificato o distrutto, puoi scegliere: PESCHI 2 carte, oppure porti nella tua stalla un unicorno semplice dalla tua mano.' },
    { id: 'pescatore', name: 'Unicorno Pescatore', t: 'magico', e: '🐠', exp: 'avventure', text: 'Quando entra nella tua stalla, puoi guardare la mano di un altro giocatore: scegli una carta e prendila.' },
    { id: 'imbroglione', name: 'Unicorno Imbroglione', t: 'magico', e: '🤥', exp: 'avventure', text: 'Quando entra nella tua stalla, puoi scegliere: SCARTI tutta la mano e PESCHI 3 carte, oppure scambi la mano con un altro giocatore.' },
    { id: 'saccheggiatore', name: 'Pirata Saccheggiatore', t: 'magico', e: '💰', exp: 'avventure', text: 'Quando entra nella tua stalla, puoi scegliere: RUBI un Bonus, oppure sposti un Malus della tua stalla in quella di un altro giocatore.' },
    { id: 'lupo_di_mare', name: 'Lupo di Mare', t: 'magico', e: '🌊', exp: 'avventure', text: 'Quando entra nella tua stalla, puoi scegliere: ogni altro giocatore SCARTA una carta, oppure PESCHI una carta.' },
    { id: 'clandestino', name: 'Unicorno Clandestino', t: 'magico', e: '📦', exp: 'avventure', text: 'Quando entra nella tua stalla, puoi PESCARE una carta e mostrarla a tutti: se è un unicorno, un Bonus o un Malus, mettila nella tua stalla.' },
    { id: 'vagabondo', name: 'Unicorno Vagabondo', t: 'magico', e: '🥾', exp: 'avventure', text: INIZIO_TXT + 'puoi SCARTARE una carta, poi prendere a caso una carta dalla mano di un altro giocatore.' },
    { id: 'sopravvissuto', name: 'Unicorno Sopravvissuto', t: 'magico', e: '🪵', exp: 'avventure', text: INIZIO_TXT + 'puoi SCARTARE una carta, poi SACRIFICARE un Malus.' },

    { id: 'corno_luminoso', name: 'Corno luminoso', t: 'magia', e: '💡', exp: 'avventure', text: 'Scegli: SACRIFICHI una carta e poi ne DISTRUGGI una, oppure porti nella tua stalla una carta dagli scarti.' },
    { id: 'cercametalli', name: 'Cercametalli', t: 'magia', n: 2, e: '🧲', exp: 'avventure', text: 'Scegli: PESCHI 3 carte e ne SCARTI una, oppure prendi in mano una carta dagli scarti.' },
    { id: 'bussola', name: 'Bussola misteriosa', t: 'magia', e: '🧭', exp: 'avventure', text: 'Scegli: SCARTI 3 carte e poi giochi un altro turno, oppure sposti un tuo unicorno nella stalla di un altro giocatore e poi gli RUBI un unicorno.' },
    { id: 'lingua_dargento', name: 'Lingua d\'argento', t: 'magia', e: '👅', exp: 'avventure', text: 'Scegli: ogni altro giocatore ti mostra la sua mano, oppure ogni altro giocatore ti dà una carta della sua mano (la sceglie lui).' },
    { id: 'furto_di_culle', name: 'Furto di culle', t: 'magia', n: 2, e: '🍼', exp: 'avventure', text: 'SCARTA 2 carte, poi porta nella tua stalla 2 Cuccioli dal Nido.' },
    { id: 'paletta', name: 'Paletta e secchiello', t: 'magia', e: '🪣', exp: 'avventure', text: 'Scegli: porti nella tua stalla un unicorno dagli scarti, oppure prendi in mano 2 unicorni dagli scarti.' },

    { id: 'canna_da_pesca', name: 'Canna da pesca', t: 'istante', n: 2, e: '🎣', exp: 'avventure', rea: 'ruba', text: 'Giocala quando un altro giocatore prova a RUBARE una carta: invece la carta finisce nella tua stalla.' },
    { id: 'razzo', name: 'Razzo di segnalazione', t: 'istante', n: 2, e: '🎆', exp: 'avventure', rea: 'turno', text: 'Giocalo all\'inizio del turno di un altro giocatore: salta l\'inizio del turno e la pesca.' },
    { id: 'nitrito_marinaio', name: 'Nitrito, marinaio!', t: 'istante', n: 3, e: '🐚', neigh: true, exp: 'avventure', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti.' },
    { id: 'rete', name: 'Rete per unicorni', t: 'istante', n: 2, e: '🕸️', exp: 'avventure', rea: 'via', text: 'Giocala quando un giocatore prova a SACRIFICARE o DISTRUGGERE una carta: invece la prendi in mano tu (un Cucciolo torna nel Nido).' },

    { id: 'rito_antico', name: 'Rito antico', t: 'bonus', e: '🗿', exp: 'avventure', text: INIZIO_TXT + 'puoi SACRIFICARE un unicorno, poi PESCARE 3 carte.' },
    { id: 'buca', name: 'Buca coperta di foglie', t: 'bonus', n: 2, e: '🍂', exp: 'avventure', text: INIZIO_TXT + 'puoi SACRIFICARE questa carta, poi RUBARE un unicorno.' },
    { id: 'zoccoli_reali', name: 'Zoccoli reali', t: 'bonus', e: '🤴', exp: 'avventure', text: INIZIO_TXT + 'puoi prendere a caso una carta dalla mano di un altro giocatore invece di pescare.' },
    { id: 'kit', name: 'Kit di sopravvivenza', t: 'bonus', e: '🧰', exp: 'avventure', text: 'Ogni volta che un tuo unicorno sta per essere sacrificato o distrutto, puoi invece SCARTARE 2 carte.' },

    { id: 'meridiana', name: 'Meridiana rotta', t: 'malus', e: '🕰️', exp: 'avventure', text: 'Salti l\'inizio del tuo turno.' },
    { id: 'zainetto', name: 'Zainetto minuscolo', t: 'malus', e: '👛', exp: 'avventure', text: 'Ogni volta che PESCHI una carta, SCARTA una carta. Se resti senza carte in mano, sposta questa carta nella stalla di un altro giocatore che ne ha.' },
    { id: 'macchia_nera', name: 'La macchia nera', t: 'malus', e: '⚫', exp: 'avventure', text: 'Non puoi vincere se nella tua stalla c\'è un unicorno semplice.' },
    { id: 'in_mare', name: 'Unicorno in mare!', t: 'malus', e: '🚣', exp: 'avventure', text: 'Ogni volta che un tuo unicorno viene sacrificato o distrutto, SCARTA una carta.' },

    /* ---- Draghi (54 carte: 6 cuccioli, 12 semplici, 10 magici, 9 Magie, 6 istantanee, 6 Bonus, 5 Malus) ----
       «drago» nel nome: come nell'originale le carte con «Dragon» (vedi filtra 'drago'). */
    { id: 'draghetto_nero', name: 'Draghetto Nero', t: 'cucciolo', e: '🐲', col: '#3a3a4a', exp: 'draghi' },
    { id: 'draghetto_blu', name: 'Draghetto Blu', t: 'cucciolo', e: '🐲', col: '#4a8fe0', exp: 'draghi' },
    { id: 'draghetto_verde', name: 'Draghetto Verde', t: 'cucciolo', e: '🐲', col: '#5cc06a', exp: 'draghi' },
    { id: 'draghetto_arancio', name: 'Draghetto Arancio', t: 'cucciolo', e: '🐲', col: '#f39a3d', exp: 'draghi' },
    { id: 'draghetto_rosa', name: 'Draghetto Rosa', t: 'cucciolo', e: '🐲', col: '#f58fc1', exp: 'draghi' },
    { id: 'draghetto_rosso', name: 'Draghetto Rosso', t: 'cucciolo', e: '🐲', col: '#e8555a', exp: 'draghi' },

    { id: 'apprendista', name: 'Unicorno Apprendista', t: 'semplice', n: 3, e: '📜', col: '#b48ad8', exp: 'draghi' },
    { id: 'travestito', name: 'Unicorno Travestito da Drago', t: 'semplice', n: 3, e: '🥸', col: '#6cbf8e', exp: 'draghi' },
    { id: 'tiradadi', name: 'Unicorno Tiradadi', t: 'semplice', n: 3, e: '🎰', col: '#e07a5f', exp: 'draghi' },
    { id: 'tatuato', name: 'Unicorno col Drago Tatuato', t: 'semplice', n: 3, e: '🖋️', col: '#5c7cd6', exp: 'draghi' },

    { id: 'dragocorno_arrabbiato', name: 'Dragocorno Arrabbiato', t: 'magico', e: '👺', exp: 'draghi', text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) deve SCARTARE una carta.' },
    { id: 'cavalcadraghi', name: 'Unicorno Cavalcadraghi', t: 'magico', e: '🏇', exp: 'draghi', text: 'Quando entra nella tua stalla, puoi spostare un Bonus o un Malus dalla stalla di un giocatore a quella di un altro giocatore (non nella tua).' },
    { id: 'ammazzadraghi', name: 'Unicorno Ammazzadraghi', t: 'magico', e: '🤺', exp: 'draghi', text: 'I tuoi unicorni non possono essere DISTRUTTI dall\'effetto di una carta con «drago» nel nome.' },
    { id: 'evocadraghi', name: 'Unicorno Evocadraghi', t: 'magico', e: '🪄', exp: 'draghi', text: 'Quando entra nella tua stalla, puoi prendere in mano dagli scarti una carta con «drago» nel nome.' },
    { id: 'domadraghi', name: 'Unicorno Domadraghi', t: 'magico', e: '🪢', exp: 'draghi', text: 'Quando entra nella tua stalla, puoi cercare nel mazzo una carta con «drago» nel nome e prenderla in mano, poi mescoli il mazzo.' },
    { id: 'dragotartaruga', name: 'Dragotartaruga', t: 'magico', e: '🐢', exp: 'draghi', text: 'Quando entra nella tua stalla, puoi PESCARE una carta.' },
    { id: 'unicorno_drago', name: 'Unicorno Drago', t: 'magico', e: '🐉', exp: 'draghi', text: 'Quando lascia la tua stalla, puoi DISTRUGGERE un unicorno.' },
    { id: 'dragocorno_amico', name: 'Dragocorno Amichevole', t: 'magico', e: '🤗', exp: 'draghi', text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) può PESCARE una carta.' },
    { id: 'alchimista', name: 'Unicorno Alchimista', t: 'magico', e: '⚗️', exp: 'draghi', text: 'Quando entra nella tua stalla, puoi cercare nel mazzo una Magia e prenderla in mano, poi mescoli il mazzo.' },
    { id: 'volante_squamoso', name: 'Volante Squamoso', t: 'magico', e: '🦎', vola: true, exp: 'draghi', text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) deve SACRIFICARE una carta.' + VOLA },

    { id: 'alito_di_drago', name: 'Alito di drago', t: 'magia', n: 3, e: '🌬️', exp: 'draghi', text: 'DISTRUGGI un unicorno.' },
    { id: 'fuoco_di_drago', name: 'Fuoco di drago', t: 'magia', n: 3, e: '♨️', exp: 'draghi', text: 'DISTRUGGI un Bonus o SACRIFICA un Malus.' },
    { id: 'bacio_del_drago', name: 'Bacio del drago', t: 'magia', n: 2, e: '😘', exp: 'draghi', text: 'Cerca nel mazzo una Magia e prendila in mano: la giochi subito (se si può), poi mescoli il mazzo.' },
    { id: 'stalle_bruciate', name: 'Stalle bruciate dal drago', t: 'magia', e: '🌋', exp: 'draghi', text: 'Ogni giocatore (tu compreso) deve SACRIFICARE tutti i Bonus e i Malus della sua stalla.' },

    { id: 'nitrito_bestiaccia', name: 'Nitrito, bestiaccia!', t: 'istante', n: 6, e: '🦖', neigh: true, exp: 'draghi', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti.' },

    { id: 'benedizione_drago', name: 'Benedizione del drago', t: 'bonus', n: 2, e: '🙏', exp: 'draghi', text: 'I Malus nella tua stalla non hanno effetto.' },
    { id: 'fortuna_drago', name: 'Fortuna del drago', t: 'bonus', n: 2, e: '🍀', o: 1, exp: 'draghi', text: INIZIO_TXT + 'puoi SACRIFICARE questa carta, poi giochi un altro turno.' },
    { id: 'protezione_drago', name: 'Protezione del drago', t: 'bonus', n: 2, e: '🔰', o: 1, exp: 'draghi', text: 'Se una carta della tua stalla sta per essere DISTRUTTA, puoi invece SCARTARE una carta.' },

    { id: 'maledizione_drago', name: 'Maledizione del drago', t: 'malus', n: 2, e: '🥀', exp: 'draghi', text: INIZIO_TXT + 'SCARTA una carta.' },
    { id: 'sfortuna_drago', name: 'Sfortuna del drago', t: 'malus', n: 2, e: '🐈‍⬛', o: 1, exp: 'draghi', text: INIZIO_TXT + 'metti una carta della tua mano in fondo al mazzo.' },
    { id: 'cieli_dei_draghi', name: 'Cieli dei draghi', t: 'malus', e: '🌩️', exp: 'draghi', text: INIZIO_TXT + 'metti un unicorno della tua stalla in fondo al mazzo, poi PESCA una carta.' },

    /* ---- Diluvio arcobaleno (54 carte: 2 cuccioli, 6 semplici, 24 magici di cui 8 copie di carte del mazzo base
       (copie), 14 Magie, 3 istantanee, 4 Bonus, 1 Malus) ---- */
    { id: 'cucciolo_fiorito', name: 'Cucciolo Fiorito', t: 'cucciolo', e: '🌸', col: '#f2a0c8', exp: 'diluvio' },
    { id: 'cucciolo_scintillante', name: 'Cucciolo Scintillante', t: 'cucciolo', e: '🌟', col: '#f7e07a', exp: 'diluvio' },

    { id: 'cavallo_gelato', name: 'Cavallo col Gelato', t: 'semplice', n: 3, e: '🍦', col: '#f5c9a6', exp: 'diluvio', text: 'Nessun effetto, ma conta come tutti gli altri unicorni (anche se è un cavallo).' },
    { id: 'coniglicorno', name: 'Coniglicorno Innocente', t: 'semplice', n: 3, e: '🐰', col: '#d9c3f2', exp: 'diluvio' },

    { id: 'volante_adorabile', name: 'Volante Adorabile', t: 'magico', e: '🥰', vola: true, exp: 'diluvio', text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) deve SACRIFICARE una carta.' + VOLA },
    { id: 'angelo', name: 'Unicorno Angelo', t: 'magico', n: 2, e: '👼', exp: 'diluvio', text: INIZIO_TXT + 'puoi SACRIFICARE questa carta, poi portare nella tua stalla un unicorno dagli scarti.' },
    { id: 'alpacorno_zucchero', name: 'Alpacorno Zucchero Filato', t: 'magico', e: '🍭', exp: 'diluvio', text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) deve SACRIFICARE un unicorno, poi PESCARE una carta.' },
    { id: 'fertile', name: 'Unicorno Fertilissimo', t: 'magico', n: 2, o: 1, e: '🥚', exp: 'diluvio', text: INIZIO_TXT + 'puoi SCARTARE una carta, poi portare nella tua stalla un Cucciolo dal Nido.' },
    { id: 'bulldog', name: 'Bulldocorno', t: 'magico', e: '🐶', exp: 'diluvio', text: 'Quando entra nella tua stalla, ogni altro giocatore deve SCARTARE una carta: tu ne prendi in mano una di quelle scartate.' },
    { id: 'brillantinato', name: 'Unicorno Brillantinato', t: 'magico', e: '💅', exp: 'diluvio', text: 'Quando entra nella tua stalla, puoi mettere nella tua stalla un Bonus che hai in mano.' },
    { id: 'minuscolo', name: 'Unicorno Minuscolo', t: 'magico', e: '🐜', exp: 'diluvio', text: 'Gli effetti degli unicorni e dei Bonus non possono DISTRUGGERLO.' },
    { id: 'morte', name: 'Unicorno della Morte', t: 'magico', e: '⚱️', exp: 'diluvio', text: INIZIO_TXT + 'puoi SACRIFICARE un unicorno, poi DISTRUGGERE un unicorno.' },
    { id: 'carestia', name: 'Unicorno della Carestia', t: 'magico', e: '🍽️', exp: 'diluvio', text: 'Ogni giocatore (tu compreso) a fine turno tiene in mano 5 carte in meno.' },
    { id: 'pestilenza', name: 'Unicorno della Pestilenza', t: 'magico', e: '🤢', exp: 'diluvio', text: 'Quando entra nella tua stalla, SCARTA quante carte vuoi: ogni altro giocatore deve SCARTARNE altrettante.' },
    { id: 'guerra', name: 'Unicorno della Guerra', t: 'magico', e: '🪖', exp: 'diluvio', text: 'Quando entra nella tua stalla, ogni giocatore (tu compreso) può DISTRUGGERE un unicorno. Questa carta non si può distruggere.' },
    { id: 'principessa', name: 'Principessa Arcobaleno', t: 'magico', e: '👸', exp: 'diluvio', text: 'Quando entra nella tua stalla, scegli quanti giocatori vuoi: PESCHI tante carte quanti sono, e ognuno di loro può PESCARE una carta.' },
    { id: 'zombi', name: 'Unicorno Zombi', t: 'magico', n: 2, e: '🧠', exp: 'diluvio', text: INIZIO_TXT + 'puoi SCARTARE un unicorno, poi portare nella tua stalla un unicorno dagli scarti. Se lo fai, il tuo turno finisce subito.' },

    { id: 'attacco_tenero', name: 'Attacco di tenerezza', t: 'magia', n: 2, e: '🥺', exp: 'diluvio', text: 'Scegli un altro giocatore: DISTRUGGI 3 unicorni della sua stalla (o quelli che ha) e porta nella sua stalla altrettanti Cuccioli dal Nido.' },
    { id: 'fuoco_e_zolfo', name: 'Fuoco e zolfo', t: 'magia', e: '🌶️', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo un Unicorno Cenere e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'castigo_celeste', name: 'Castigo celeste', t: 'magia', e: '☁️', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo un Unicorno Angelo e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'alpacalisse', name: 'Alpacalisse', t: 'magia', e: '🏜️', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo l\'Alpacorno e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'sovrappopolazione', name: 'Sovrappopolazione', t: 'magia', e: '👶', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo un Unicorno Fertilissimo e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'tempesta_tenerezza', name: 'Tempesta di tenerezza', t: 'magia', e: '🫧', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo un Miciocorno e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'distruzione_totale', name: 'Distruzione totale', t: 'magia', e: '🎇', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo un Unicorno Catastrofe e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'apocalisse_zombi', name: 'Apocalisse zombi', t: 'magia', e: '🫥', exp: 'diluvio', text: 'SACRIFICA tutti i tuoi unicorni, poi DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi cerca nel mazzo un Unicorno Zombi e mettilo nella tua stalla; poi mescoli il mazzo.' },
    { id: 'unicorni_apocalisse', name: 'Gli unicorni dell\'apocalisse', t: 'magia', e: '🐎', exp: 'diluvio', text: 'SACRIFICA 4 unicorni, poi cerca nel mazzo 4 unicorni e mettili nella tua stalla; poi mescoli il mazzo.' },
    { id: 'peste_nera', name: 'Peste nera', t: 'magia', e: '🕷️', exp: 'diluvio', text: 'SACRIFICA quante carte vuoi, poi DISTRUGGINE altrettante.' },
    { id: 'spruzzino', name: 'Spruzzino della giovinezza', t: 'magia', e: '🧴', exp: 'diluvio', text: 'DISTRUGGI un unicorno nella stalla di ogni altro giocatore. Poi ognuno di loro può portare nella sua stalla un Cucciolo dal Nido.' },
    { id: 'pisolino', name: 'Pisolino', t: 'magia', n: 2, e: '😴', exp: 'diluvio', text: 'Un altro giocatore, a tua scelta, salta il suo prossimo turno.' },

    { id: 'nitrito_grazie', name: 'Nitrito, grazie!', t: 'istante', n: 3, o: 1, e: '🙇', neigh: true, exp: 'diluvio', text: 'Giocalo quando un altro giocatore prova a giocare una carta: la fermi e finisce negli scarti. Poi tu e lui potete PESCARE una carta.' },

    { id: 'zuccherini', name: 'Zuccherini arcobaleno', t: 'bonus', n: 2, e: '🍬', exp: 'diluvio', text: INIZIO_TXT + 'puoi PESCARE 3 carte: se lo fai, il tuo turno finisce subito.' },
    { id: 'consegna_speciale', name: 'Consegna speciale', t: 'bonus', n: 2, e: '🚚', exp: 'diluvio', text: INIZIO_TXT + 'puoi portare nella tua stalla un Cucciolo dal Nido: se lo fai, salti la fase delle azioni.' },

    { id: 'zoccoletti', name: 'Zoccoletti', t: 'malus', e: '🩰', exp: 'diluvio', text: 'A fine turno tieni in mano 4 carte in meno.' }
  ];
  // Nella partita in due si tolgono tutti gli unicorni semplici e queste carte (e ognuno parte con un Nitrito in mano).
  // Brutti sogni: il Rancoroso è nell'elenco ufficiale; le altre tre seguono la sua regola (via le carte che parlano
  // di unicorni semplici, che in due non ci sono).
  var VIA_IN_DUE = ['reginetta', 'rubacuori', 'pifferaio', 'chioccia', 'evocatore', 'occhio', 'rito_oscuro', 'raffreddore', 'urra',
    'rancoroso', 'mascherato', 'fuori_dalla_tomba', 'piu_spettro',
    'clandestino', 'capitano', 'avventuriero', 'macchia_nera', 'furto_di_culle',
    'ammazzadraghi', 'cieli_dei_draghi', 'protezione_drago', 'volante_squamoso',
    'pisolino', 'zoccoletti', 'consegna_speciale', 'fertile', 'carestia', 'sovrappopolazione'];
  var TIPI = { cucciolo: 'Cucciolo', semplice: 'Unicorno semplice', magico: 'Unicorno magico', magia: 'Magia', bonus: 'Bonus', malus: 'Malus', istante: 'Istantanea' };

  var TYPES = {}, META = {}, ALL = [];
  CARTE.forEach(function (d) {
    d.n = d.n || 1; d.exp = d.exp || 'base'; if (d.o == null) d.o = 2;
    if (d.t === 'cucciolo' && !d.text) d.text = CUCCIOLO;
    if (d.t === 'semplice' && !d.text) d.text = 'Nessun effetto, ma conta come tutti gli altri unicorni.';
    TYPES[d.id] = d;
    for (var i = 1; i <= d.n; i++) { var id = d.id + '.' + i; META[id] = { k: d.id }; ALL.push(id); }
    // altre copie che arrivano con un'espansione (Diluvio arcobaleno ristampa 4 carte del mazzo base)
    var num = d.n;
    (d.copie || []).forEach(function (x) {
      for (var j = 0; j < x.n; j++) { num++; var cid = d.id + '.' + num; META[cid] = { k: d.id, exp: x.exp, o: x.o == null ? 2 : x.o }; ALL.push(cid); }
    });
  });
  // Da quale espansione arriva questa copia della carta.
  function expDi(c) { var m = META[c]; return (m && m.exp) || def(c).exp; }
  function keyOf(c) { var m = META[c]; return m ? m.k : null; }
  function def(c) { return TYPES[keyOf(c)] || null; }
  function kind(c) { var d = def(c); return d ? d.t : null; }
  function isUni(c) { var t = kind(c); return t === 'cucciolo' || t === 'semplice' || t === 'magico'; }
  function isNeigh(c) { var d = def(c); return !!(d && d.neigh); }
  function filtra(c, fl) {
    switch (fl) {
      case 'unicorno': return isUni(c);
      case 'bonus': case 'malus': case 'magia': case 'semplice': return kind(c) === fl;
      case 'nitrito': return isNeigh(c);
      case 'narvalo': return /narvalo/i.test(def(c).name);
      case 'drago': return /drag/i.test(def(c).name);
      case 'bm': return kind(c) === 'bonus' || kind(c) === 'malus';
      case 'incubo': return !!def(c).inc;
      case 'cucciolo': case 'istante': return kind(c) === fl;
      case 'stalla': return kind(c) !== 'magia' && kind(c) !== 'istante';
    }
    return true;
  }
  function espansioni(list) {
    var ok = ['base'];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (ok.indexOf(x) < 0 && ESPANSIONI.some(function (e) { return e.id === x && e.pronta; })) ok.push(x);
    });
    return ok;
  }
  function mazzoPer(exp, k) {
    return ALL.filter(function (c) {
      var d = def(c);
      if (exp.indexOf(expDi(c)) < 0 || d.t === 'cucciolo') return false;
      return !(k === 2 && (d.t === 'semplice' || VIA_IN_DUE.indexOf(d.id) >= 0));
    });
  }
  function nidoPer(exp) { return ALL.filter(function (c) { return kind(c) === 'cucciolo' && exp.indexOf(expDi(c)) >= 0; }); }

  /* ---------- caso ---------- */
  var rng = null;
  function randInt(k) {
    if (rng) return Math.floor(rng() * k);
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && c.getRandomValues) {
      var buf = new Uint32Array(1), limit = Math.floor(4294967296 / k) * k, x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % k;
    }
    return Math.floor(Math.random() * k);
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pushLog(s, e) {
    s.logN = (s.logN || 0) + 1; e.i = s.logN;
    s.log = (s.log || []).concat([e]);
    if (s.log.length > LOG_MAX) s.log = s.log.slice(s.log.length - LOG_MAX);
  }
  function touch(s, prevV) { s.v = (prevV || 0) + 1; s.updatedAt = Date.now(); return s; }

  /* ---------- chi ha cosa ---------- */
  function n(s) { return s.seats.length; }
  function stalla(s, p) { return (s.stable && s.stable[p]) || []; }
  function mano(s, p) { return (s.hand && s.hand[p]) || []; }
  function altri(s, p) { var o = []; for (var i = 1; i < n(s); i++) o.push((p + i) % n(s)); return o; }
  function giro(s, p) { return [p].concat(altri(s, p)); }
  function padrone(s, c) { for (var p = 0; p < n(s); p++) if (stalla(s, p).indexOf(c) >= 0) return p; return -1; }
  // Flash abbagliante, Igiene medievale: gli unicorni contano come semplici, senza effetti.
  // (con la Benedizione del drago i Malus della stalla non hanno effetto, e quindi nemmeno questi due)
  function benedetta(s, p) { return stalla(s, p).some(function (c) { return keyOf(c) === 'benedizione_drago'; }); }
  function accecata(s, p) { return !benedetta(s, p) && stalla(s, p).some(function (c) { var k = keyOf(c); return k === 'flash' || k === 'igiene_medievale'; }); }
  // Il testo della carta vale? Col Flash abbagliante gli unicorni magici non hanno effetti; con la Benedizione del drago i Malus.
  function attivo(s, p, c) { var t = kind(c); return t === 'malus' ? !benedetta(s, p) : t !== 'magico' || !accecata(s, p); }
  function cartaAttiva(s, p, key) { var t = stalla(s, p); for (var i = 0; i < t.length; i++) if (keyOf(t[i]) === key && attivo(s, p, t[i])) return t[i]; return null; }
  function has(s, p, key) { return !!cartaAttiva(s, p, key); }
  function panda(s, p) { return has(s, p, 'pandastrofe'); }
  // I panda non li tocca niente: né effetti, né sacrifici, né furti.
  function tocca(s, p, c) { return !(isUni(c) && panda(s, p)); }
  // Unicornone e Nonna Zuccherina contano 2 (se non sono accecati dal Flash).
  var DOPPI = { unicornone: 1, nonnina: 1 };
  function conta(s, p) {
    if (panda(s, p)) return 0;
    var k = 0;
    stalla(s, p).forEach(function (c) { if (isUni(c)) k += (DOPPI[keyOf(c)] && attivo(s, p, c)) ? 2 : 1; });
    return k;
  }
  // Con «Incubo: occupato!» nella stalla non si vince (né con gli unicorni né a mazzo finito).
  // …e nemmeno con «La macchia nera» e un unicorno semplice nella stalla.
  function puoVincere(s, p) {
    if (has(s, p, 'incubo_occupato')) return false;
    return !(has(s, p, 'macchia_nera') && stalla(s, p).some(function (c) { return kind(c) === 'semplice'; }));
  }
  // Quante carte si possono tenere a fine turno.
  function limite(s, p) {
    var l = MANO_MAX - (has(s, p, 'incubo_palestra') ? 3 : 0) + (has(s, p, 'bisaccia') ? 3 : 0) - (has(s, p, 'zoccoletti') ? 4 : 0);
    // Unicorno della Carestia: vale per tutti, chiunque l'abbia nella stalla
    for (var q = 0; q < n(s); q++) if (has(s, q, 'carestia')) { l -= 5; break; }
    return Math.max(0, l);
  }
  function lettere(s, p) {
    if (panda(s, p)) return 0;
    var k = 0;
    stalla(s, p).forEach(function (c) { if (isUni(c)) k += (def(c).name.match(/[a-zà-ÿ]/gi) || []).length; });
    return k;
  }
  // Può entrare nella stalla di q? La Reginetta tiene fuori gli unicorni semplici degli altri, il Cerchio di sale i Malus.
  function entra(s, c, q) {
    var t = kind(c);
    if (t === 'malus') return !has(s, q, 'cerchio_di_sale');
    if (t !== 'semplice') return true;
    if (has(s, q, 'avventuriero')) return false;
    for (var r = 0; r < n(s); r++) if (r !== q && has(s, r, 'reginetta')) return false;
    return true;
  }
  // Le carte che non si possono sacrificare o distruggere (modo: 'sacrifica' o 'distruggi'): l'Unicorno Spettrale,
  // il Cerchio di sale; col Cuore stregato i Bonus non si distruggono.
  function salda(s, q, c, modo) {
    var k = keyOf(c);
    if (k === 'cerchio_di_sale' || (k === 'spettrale' && attivo(s, q, c))) return true;
    if (modo === 'distruggi' && k === 'guerra' && attivo(s, q, c)) return true;
    return modo === 'distruggi' && kind(c) === 'bonus' && has(s, q, 'cuore_stregato');
  }
  function sacrificabile(s, q, c) { return tocca(s, q, c) && !salda(s, q, c, 'sacrifica'); }
  // src: la carta che distrugge (l'Unicorno Ammazzadraghi protegge dalle carte con «drago» nel nome)
  function distruggibile(s, q, c, magia, src) {
    if (salda(s, q, c, 'distruggi')) return false;
    if (!isUni(c)) return true;
    if (panda(s, q) || has(s, q, 'scudo_arcobaleno')) return false;
    if (src && META[src] && filtra(src, 'drago') && has(s, q, 'ammazzadraghi')) return false;
    // l'Unicorno Minuscolo: non lo distruggono gli effetti di unicorni e Bonus (le Magie sì)
    if (keyOf(c) === 'minuscolo' && attivo(s, q, c) && src && META[src] && (isUni(src) || kind(src) === 'bonus')) return false;
    return !(magia && keyOf(c) === 'miciocorno' && attivo(s, q, c));
  }
  function nitrisce(s, p) { return !has(s, p, 'raffreddore') && !has(s, p, 'unicornone'); }
  function fermabile(s, it) { return keyOf(it.c) !== 'supernitrito' && !has(s, it.p, 'urra'); }
  // Chi può rispondere con un Nitrito alla carta in cima alla catena (conta solo ciò che vedono tutti).
  function reattivi(s, it) {
    if (!it || !fermabile(s, it)) return [];
    return altri(s, it.p).filter(function (q) { return nitrisce(s, q); });
  }
  // La mano scoperta: Occhio indiscreto, Unicorno Sensitivo.
  function vedeMano(s, q) { return has(s, q, 'occhio') || has(s, q, 'sensitivo'); }

  /* ---------- spostare carte ---------- */
  function accoda(s, t) { s.queue.push(t); }
  function togli(s, q, c) {
    var t = stalla(s, q), i = t.indexOf(c);
    if (i < 0) return false;
    t.splice(i, 1);
    if (isUni(c)) { var r = cartaAttiva(s, q, 'recinto'); if (r) accoda(s, { k: 'recinto', p: q, c: r }); }
    // «Quando lascia la tua stalla» (Unicorno Drago): rubato, rimandato, spostato, sacrificato o distrutto
    if (LASCIA[keyOf(c)] && attivo(s, q, c)) accoda(s, { k: 'esce', p: q, c: c });
    return true;
  }
  function metti(s, q, c) {
    s.stable[q].push(c);
    var t = kind(c);
    if (isUni(c)) { var r = cartaAttiva(s, q, 'recinto'); if (r) accoda(s, { k: 'recinto', p: q, c: r }); }
    // «Quando entra nella tua stalla»: unicorni magici (se non accecati), Bonus e Malus; lo risolve chi ha la stalla
    if (ENTRA[keyOf(c)] && (t === 'magico' || t === 'malus' ? attivo(s, q, c) : t === 'bonus')) accoda(s, { k: 'entra', p: q, c: c });
  }
  // Fuori dal gioco: la carta non torna più (i cuccioli però tornano sempre nel Nido).
  function fuori(s, c) {
    if (kind(c) === 'cucciolo') { s.nursery.push(c); return 'nido'; }
    (s.box = s.box || []).push(c);
    return 'fuori';
  }
  function aMano(s, q, c) { if (kind(c) === 'cucciolo') s.nursery.push(c); else s.hand[q].push(c); }
  function dallaMano(s, p, c) { var h = mano(s, p), i = h.indexOf(c); if (i >= 0) h.splice(i, 1); return i >= 0; }
  function pesca1(s, p) {
    if (!s.deck.length) { s.vuoto = true; return null; }
    var c = s.deck.pop();
    s.hand[p].push(c);
    // Zainetto minuscolo: per ogni carta pescata se ne scarta una
    var z = cartaAttiva(s, p, 'zainetto');
    if (z) accoda(s, { k: 'zaino', p: p, c: z });
    return c;
  }
  // Chi può rispondere con un'istantanea di reazione (Canna da pesca, Rete, Razzo): chi la tiene in mano e può
  // giocare istantanee; non chi sta facendo la mossa (salvo la Rete, che può giocare chiunque).
  function reazioni(s, tipo, chi) {
    var w = [];
    // non mentre si sta già decidendo su una carta giocata (il Colpo critico si sacrifica prima dei Nitriti)
    if (s.chain && s.chain.length) return w;
    for (var q = 0; q < n(s); q++) {
      if ((q === chi && tipo !== 'via') || !nitrisce(s, q)) continue;
      if (mano(s, q).some(function (c) { return def(c).rea === tipo; })) w.push(q);
    }
    return w;
  }
  function pescaN(s, p, k) { var got = 0; for (var i = 0; i < k; i++) { if (pesca1(s, p) == null) break; got++; } return got; }
  function mescolaScarti(s) { s.deck = shuffle(s.deck.concat(s.discard)); s.discard = []; pushLog(s, { t: 'mescola' }); }
  // Una carta lascia la stalla perché sacrificata o distrutta: i cuccioli tornano nel Nido, i volanti in mano.
  function lascia(s, modo, q, c, da) {
    var vivo = attivo(s, q, c), d = def(c), dove;
    togli(s, q, c);
    if (d.t === 'cucciolo') { s.nursery.push(c); dove = 'nido'; }
    else if (d.vola && vivo) { s.hand[q].push(c); dove = 'mano'; }
    else { s.discard.push(c); dove = 'scarti'; }
    pushLog(s, { t: modo === 'distruggi' ? 'distrutta' : 'sacrificata', s: da, q: q, c: c, dove: dove });
    // «Se viene sacrificato o distrutto…» (il Diavolicorno solo se distrutto)
    if (vivo && USCITA[d.id] && !LASCIA[d.id] && (!SOLO_DISTRUTTO[d.id] || modo === 'distruggi')) accoda(s, { k: 'esce', p: q, c: c });
    // Unicorno in mare!: per ogni tuo unicorno che se ne va così, scarti una carta
    if (isUni(c)) { var im = cartaAttiva(s, q, 'in_mare'); if (im) accoda(s, { k: 'mare', p: q, c: im }); }
    // Muro di corna: chi ti distrugge un unicorno ti lascia pescare dalla sua mano
    if (modo === 'distruggi' && isUni(c) && da >= 0 && da !== q) { var mu = cartaAttiva(s, q, 'muro_di_corna'); if (mu) accoda(s, { k: 'muro', p: q, c: mu, da: da }); }
  }

  /* ---------- effetti ---------- */
  var ENTRA = {
    narvalo_incantatore: function () { return [{ k: 'ruba', filtro: 'bonus', may: true }]; },
    mano_lesta: function () { return [{ k: 'giocatore', filtro: 'mano', may: true, lab: 'g' }, { k: 'pesca_mano', dep: 'g' }]; },
    volante_dispettoso: function () { return [{ k: 'giocatore', filtro: 'mano', may: true, lab: 'g' }, { k: 'scarta', chi: 'g', n: 1, dep: 'g' }]; },
    boscaiolo: function () { return [{ k: 'colpo', may: true }]; },
    narvalo_frac: function () { return [{ k: 'cerca', filtro: 'bonus', may: true }]; },
    ombra: function (s, p, c) { return [{ k: 'sacrifica', filtro: 'unicorno', may: true, lab: 'a' }, { k: 'rianima', escludi: c, dep: 'a' }]; },
    catastrofe: function () { return [{ k: 'ogni', op: 'sacrifica' }]; },
    volante_ingordo: function () { return [{ k: 'pesca', n: 1 }]; },
    alpacorno: function () { return [{ k: 'ogni', op: 'scarta' }]; },
    volante_stregato: function () { return [{ k: 'recupera', filtro: 'magia', may: true }]; },
    volante_regale: function () { return [{ k: 'recupera', filtro: 'unicorno', may: true }]; },
    chioccia: function () { return [{ k: 'nido', may: true }]; },
    risacca: function () { return [{ k: 'rimanda', da: 'altri' }]; },
    narvalo_spazzino: function () { return [{ k: 'tutti_malus' }]; },
    evocatore: function () { return [{ k: 'scarta', n: 2, filtro: 'unicorno', may: true, cost: true, lab: 'a' }, { k: 'rianima', dep: 'a' }]; },
    pifferaio: function () { return [{ k: 'dalla_mano', may: true }]; },
    rubacuori: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a', need: { k: 'ruba', filtro: 'unicorno' } }, { k: 'ruba', filtro: 'unicorno', dep: 'a' }]; },
    narvalo_straccione: function () { return [{ k: 'cerca', filtro: 'malus', may: true }]; },
    squalicorno: function (s, p, c) {
      return [{ k: 'conferma', q: 'squalo', need: { k: 'distruggi', filtro: 'unicorno' }, lab: 'a' },
        { k: 'sacrifica', c: c, dep: 'a', lab: 'b' }, { k: 'distruggi', filtro: 'unicorno', dep: 'b' }];
    },
    volante_svelto: function () { return [{ k: 'recupera', filtro: 'nitrito', may: true }]; },
    narvalo_supremo: function () { return [{ k: 'cerca', filtro: 'narvalo', may: true }]; },
    popcorno: function () { return [{ k: 'pesca', n: 2 }, { k: 'scarta', n: 1 }]; },
    indovino: function () { return [{ k: 'indovino' }]; },
    // Brutti sogni
    mascherato: function () { return [{ k: 'pesca', per: 'semplice', may: true }]; },
    pagliaccio: function (s, p) {
      return [{ k: 'scarta', n: 2, may: true, cost: true, lab: 'a', need: { k: 'rimanda', da: 'altri' } }]
        .concat(altri(s, p).map(function (q) { return { k: 'rimanda', da: q, dep: 'a', zitto: true }; }));
    },
    mietitore: function () { return [{ k: 'mietitore' }]; },
    burattino: function () { return [{ k: 'sposta', filtro: 'malus', mio: true, may: true }]; },
    uncinocorno: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a', need: { k: 'esilia' } }, { k: 'esilia', dep: 'a' }]; },
    rancoroso: function () { return [{ k: 'sacrifica', filtro: 'semplice', may: true, lab: 'a' }, { k: 'pesca', n: 3, dep: 'a' }]; },
    cuore_stregato: function () { return [{ k: 'pesca', n: 2, may: true }]; },
    incubo_occupato: function () { return [{ k: 'sacrifica', filtro: 'unicorno' }]; },
    incubo_palestra: function () { return [{ k: 'scarta_mano' }, { k: 'pesca', n: 1 }]; },
    // Miti e leggende
    furioso: function () { return [{ k: 'distruggi', filtro: 'unicorno', may: true }]; },
    divino: function () { return [{ k: 'divino' }]; },
    nanocorno: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a' }, { k: 'cerca', filtro: 'bonus', stalla: true, dep: 'a' }]; },
    elficorno: function () { return [{ k: 'scruta' }]; },
    orchicorno: function () { return [{ k: 'sposta', filtro: 'malus', mio: true, may: true, lab: 'a' }, { k: 'ruba', filtro: 'bonus', da: 'g', dep: 'a' }]; },
    cavaliere: function () { return [{ k: 'distruggi', filtro: 'carta', may: true }]; },
    furfante: function () { return [{ k: 'scarta', n: 2, may: true, cost: true, lab: 'a', need: { k: 'ruba', filtro: 'carta' } }, { k: 'ruba', filtro: 'carta', dep: 'a' }]; },
    stregone: function () { return [{ k: 'stregone' }]; },
    mago: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a' }, { k: 'mago', dep: 'a' }]; },
    // Avventure
    capitano: function () {
      return [{ k: 'oppure', may: true, scelte: [
        { voce: 'Rubi un Cucciolo', need: { k: 'ruba', filtro: 'cucciolo' }, passi: [{ k: 'ruba', filtro: 'cucciolo' }] },
        { voce: 'Porti nella stalla un unicorno semplice dagli scarti', need: { k: 'rianima', filtro: 'semplice' }, passi: [{ k: 'rianima', filtro: 'semplice' }] }] }];
    },
    pescatore: function () { return [{ k: 'giocatore', filtro: 'mano', may: true, lab: 'g' }, { k: 'arraffa', dep: 'g' }]; },
    imbroglione: function () {
      return [{ k: 'oppure', may: true, scelte: [
        { voce: 'Scarti la mano e peschi 3 carte', passi: [{ k: 'scarta_mano' }, { k: 'pesca', n: 3 }] },
        { voce: 'Scambi la mano con un altro giocatore', need: { k: 'giocatore' }, passi: [{ k: 'giocatore', lab: 'g' }, { k: 'scambia_mani', dep: 'g' }] }] }];
    },
    saccheggiatore: function () {
      return [{ k: 'oppure', may: true, scelte: [
        { voce: 'Rubi un Bonus', need: { k: 'ruba', filtro: 'bonus' }, passi: [{ k: 'ruba', filtro: 'bonus' }] },
        { voce: 'Sposti un tuo Malus nella stalla di un altro', need: { k: 'sposta', filtro: 'malus', mio: true }, passi: [{ k: 'sposta', filtro: 'malus', mio: true }] }] }];
    },
    lupo_di_mare: function (s, p) {
      return [{ k: 'oppure', may: true, scelte: [
        { voce: 'Ogni altro giocatore scarta una carta', passi: [{ k: 'ogni', op: 'scarta', solo: altri(s, p) }] },
        { voce: 'Peschi una carta', passi: [{ k: 'pesca', n: 1, may: true }] }] }];
    },
    clandestino: function () { return [{ k: 'clandestino' }]; },
    // Draghi
    dragocorno_arrabbiato: function () { return [{ k: 'ogni', op: 'scarta' }]; },
    cavalcadraghi: function () { return [{ k: 'sposta', may: true, altrove: true }]; },
    evocadraghi: function () { return [{ k: 'recupera', filtro: 'drago', may: true }]; },
    domadraghi: function () { return [{ k: 'cerca', filtro: 'drago', may: true }]; },
    dragotartaruga: function () { return [{ k: 'pesca', n: 1, may: true }]; },
    // «ognuno può pescare»: come per gli altri «puoi PESCARE», si pesca (finché il mazzo non è vuoto)
    dragocorno_amico: function (s, p) { return giro(s, p).map(function (q) { return { k: 'pesca', n: 1, may: true, chi: q }; }); },
    alchimista: function () { return [{ k: 'cerca', filtro: 'magia', may: true }]; },
    volante_squamoso: function () { return [{ k: 'ogni', op: 'sacrifica', filtro: 'carta' }]; },
    // Diluvio arcobaleno
    volante_adorabile: function () { return [{ k: 'ogni', op: 'sacrifica', filtro: 'carta' }]; },
    alpacorno_zucchero: function () { return [{ k: 'ogni', op: 'sacrifica', poi: 'pesca' }]; },
    bulldog: function (s, p) { return [{ k: 'ogni', op: 'scarta', solo: altri(s, p) }, { k: 'raccogli' }]; },
    brillantinato: function () { return [{ k: 'dalla_mano', filtro: 'bonus', may: true }]; },
    pestilenza: function () { return [{ k: 'pestilenza' }]; },
    guerra: function (s, p) { return giro(s, p).map(function (q) { return { k: 'distruggi', filtro: 'unicorno', may: true, p: q }; }); },
    principessa: function () { return [{ k: 'principessa' }]; }
  };
  // «Se viene sacrificato o distrutto…»: lo risolve chi lo aveva nella stalla.
  var USCITA = {
    vendicativo: function () { return [{ k: 'distruggi', filtro: 'unicorno', may: true }]; },
    pipistrellicorno: function () { return [{ k: 'giocatore', filtro: 'mano', may: true, lab: 'g' }, { k: 'arraffa', dep: 'g' }]; },
    nonnina: function () { return [{ k: 'sacrifica', filtro: 'carta' }]; },
    diavolicorno: function () { return [{ k: 'esilia', may: true }]; },
    furioso: function () { return [{ k: 'sacrifica', filtro: 'unicorno' }]; },
    bungee: function (s, p, c) {
      return [{ k: 'oppure', may: true, scelte: [
        { voce: 'Sacrifichi un Malus', need: { k: 'sacrifica', filtro: 'malus' }, passi: [{ k: 'sacrifica', filtro: 'malus' }] },
        { voce: 'Riprendi in mano l\'Unicorno Bungee', passi: [{ k: 'riprendi', c: c }] }] }];
    },
    impavido: function () { return [{ k: 'recupera', filtro: 'istante', may: true }]; },
    primo_ufficiale: function () {
      return [{ k: 'oppure', may: true, scelte: [
        { voce: 'Peschi 2 carte', passi: [{ k: 'pesca', n: 2, may: true }] },
        { voce: 'Porti nella stalla un unicorno semplice dalla mano', need: { k: 'dalla_mano' }, passi: [{ k: 'dalla_mano' }] }] }];
    },
    unicorno_drago: function () { return [{ k: 'distruggi', filtro: 'unicorno', may: true }]; }
  };
  var SOLO_DISTRUTTO = { diavolicorno: 1, furioso: 1 };
  // …e quelli che scattano ogni volta che lasciano la stalla, non solo se sacrificati o distrutti.
  var LASCIA = { unicorno_drago: 1 };
  // Inizio del turno: si scelgono da un elenco, in qualsiasi ordine, prima di pescare (quelli in OBBLIGO non si saltano).
  var OBBLIGO = { rito_oscuro: 1, incubo_sepolto: 1, incubo_vuoto: 1, maleficio: 1, maledizione_drago: 1, sfortuna_drago: 1, cieli_dei_draghi: 1 };
  // Le istantanee di reazione: cosa fanno quando non vengono fermate.
  var REAZIONE = { ruba: 'canna_da_pesca', via: 'rete', turno: 'razzo' };
  var INIZIO = {
    espresso: function () { return [{ k: 'sacrifica', filtro: 'carta', may: true, lab: 'a' }, { k: 'pesca', n: 2, dep: 'a' }]; },
    acchiappapeluche: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a' }, { k: 'pesca', n: 1, dep: 'a' }]; },
    petardo: function () { return [{ k: 'sacrifica', filtro: 'carta', may: true, lab: 'a' }, { k: 'distruggi', filtro: 'carta', dep: 'a' }]; },
    retino: function () { return [{ k: 'scarta', n: 3, may: true, cost: true, lab: 'a' }, { k: 'ruba', filtro: 'unicorno', dep: 'a' }]; },
    cannoncino: function () { return [{ k: 'scarta', n: 2, may: true, cost: true, lab: 'a' }, { k: 'distruggi', filtro: 'unicorno', dep: 'a' }]; },
    rito_oscuro: function () { return [{ k: 'sacrifica', filtro: 'unicorno', lab: 'a' }, { k: 'pesca', n: 1, dep: 'a' }]; },
    ariete: function () { return [{ k: 'distruggi', filtro: 'unicorno', may: true, lab: 'a' }, { k: 'salta_turno', dep: 'a' }]; },
    // Brutti sogni
    sensitivo: function () { return [{ k: 'pesca', n: 1, may: true }]; },
    spirito_guida: function () { return [{ k: 'guida' }]; },
    poltergeist: function () { return [{ k: 'giocatore', filtro: 'mano', lab: 'g' }, { k: 'salta_pesca', dep: 'g' }, { k: 'pesca_mano', dep: 'g' }]; },
    lavoretto: function () { return [{ k: 'scarta', n: 3, may: true, cost: true, lab: 'a' }, { k: 'esilia', dep: 'a' }]; },
    incubo_sepolto: function () { return [{ k: 'sacrifica', filtro: 'unicorno' }, { k: 'sepolto' }]; },
    incubo_vuoto: function () { return [{ k: 'ruba', filtro: 'malus' }]; },
    // Miti e leggende
    domatore: function () { return [{ k: 'nido', lab: 'a' }, { k: 'salta_pesca', dep: 'a' }]; },
    bardo: function () { return [{ k: 'giocatore', lab: 'g' }, { k: 'trasloca', dep: 'g', lab: 'm' }, { k: 'ruba', filtro: 'unicorno', da: 'g', dep: 'm', zitto: true }, { k: 'pesca', n: 1, dep: 'm' }]; },
    maleficio: function () { return [{ k: 'salta_pesca' }]; },
    // Avventure
    avventuriero: function () { return [{ k: 'pesca', n: 1, may: true }]; },
    vagabondo: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a' }, { k: 'giocatore', filtro: 'mano', dep: 'a', lab: 'g' }, { k: 'pesca_mano', dep: 'g' }]; },
    sopravvissuto: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a' }, { k: 'sacrifica', filtro: 'malus', dep: 'a' }]; },
    rito_antico: function () { return [{ k: 'sacrifica', filtro: 'unicorno', lab: 'a' }, { k: 'pesca', n: 3, dep: 'a' }]; },
    buca: function (s, p, c) { return [{ k: 'sacrifica', c: c, lab: 'a' }, { k: 'ruba', filtro: 'unicorno', dep: 'a' }]; },
    zoccoli_reali: function () { return [{ k: 'giocatore', filtro: 'mano', lab: 'g' }, { k: 'zoccoli', dep: 'g' }]; },
    // Draghi
    fortuna_drago: function (s, p, c) { return [{ k: 'sacrifica', c: c, lab: 'a' }, { k: 'turno_extra', dep: 'a' }]; },
    maledizione_drago: function () { return [{ k: 'scarta', n: 1 }]; },
    sfortuna_drago: function () { return [{ k: 'in_fondo' }]; },
    cieli_dei_draghi: function () { return [{ k: 'sotto', lab: 'a' }, { k: 'pesca', n: 1, dep: 'a' }]; },
    // Diluvio arcobaleno
    angelo: function (s, p, c) { return [{ k: 'sacrifica', c: c, lab: 'a' }, { k: 'rianima', dep: 'a' }]; },
    fertile: function () { return [{ k: 'scarta', n: 1, may: true, cost: true, lab: 'a' }, { k: 'nido', dep: 'a' }]; },
    morte: function () { return [{ k: 'sacrifica', filtro: 'unicorno', may: true, lab: 'a' }, { k: 'distruggi', filtro: 'unicorno', dep: 'a' }]; },
    zombi: function () { return [{ k: 'scarta', filtro: 'unicorno', n: 1, may: true, cost: true, lab: 'a' }, { k: 'rianima', dep: 'a', lab: 'b' }, { k: 'salta_turno', dep: 'b' }]; },
    zuccherini: function () { return [{ k: 'pesca', n: 3, lab: 'a' }, { k: 'salta_turno', dep: 'a' }]; },
    consegna_speciale: function () { return [{ k: 'nido', lab: 'a' }, { k: 'salta_azione', dep: 'a' }]; }
  };
  function puoi(s, op, p, x) { var f = { k: op, p: p, e: 0 }; Object.keys(x || {}).forEach(function (k) { f[k] = x[k]; }); return opzioni(s, f).length > 0; }
  var USABILE = {
    espresso: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'carta' }); },
    acchiappapeluche: function (s, p) { return mano(s, p).length >= 1; },
    petardo: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'carta' }); },
    retino: function (s, p) { return mano(s, p).length >= 3 && puoi(s, 'ruba', p, { filtro: 'unicorno' }); },
    cannoncino: function (s, p) { return mano(s, p).length >= 2 && puoi(s, 'distruggi', p, { filtro: 'unicorno' }); },
    rito_oscuro: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'unicorno' }); },
    ariete: function (s, p) { return puoi(s, 'distruggi', p, { filtro: 'unicorno' }); },
    sensitivo: function (s) { return s.deck.length > 0; },
    spirito_guida: function (s) { return s.deck.length > 0; },
    poltergeist: function (s, p) { return puoi(s, 'giocatore', p, { filtro: 'mano' }); },
    lavoretto: function (s, p) { return mano(s, p).length >= 3 && puoi(s, 'esilia', p); },
    incubo_sepolto: function () { return true; },
    incubo_vuoto: function (s, p) { return puoi(s, 'ruba', p, { filtro: 'malus' }); },
    domatore: function (s) { return s.nursery.length > 0; },
    bardo: function (s, p) { return altri(s, p).length > 0; },
    maleficio: function () { return true; },
    avventuriero: function (s) { return s.deck.length > 0; },
    vagabondo: function (s, p) { return mano(s, p).length > 0 && puoi(s, 'giocatore', p, { filtro: 'mano' }); },
    sopravvissuto: function (s, p) { return mano(s, p).length > 0 && puoi(s, 'sacrifica', p, { filtro: 'malus' }); },
    rito_antico: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'unicorno' }); },
    buca: function (s, p, c) { return sacrificabile(s, p, c) && puoi(s, 'ruba', p, { filtro: 'unicorno' }); },
    zoccoli_reali: function (s, p) { return puoi(s, 'giocatore', p, { filtro: 'mano' }) && s.stack.some(function (g) { return g.k === 'pesca_fase' && g.turno; }); },
    fortuna_drago: function (s, p, c) { return sacrificabile(s, p, c); },
    maledizione_drago: function (s, p) { return mano(s, p).length > 0; },
    sfortuna_drago: function (s, p) { return mano(s, p).length > 0; },
    cieli_dei_draghi: function (s, p) { return puoi(s, 'sotto', p); },
    angelo: function (s, p, c) { return sacrificabile(s, p, c) && (entra(s, c, p) || puoi(s, 'rianima', p)); },
    fertile: function (s, p) { return mano(s, p).length > 0 && s.nursery.length > 0; },
    morte: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'unicorno' }) && puoi(s, 'distruggi', p, { filtro: 'unicorno' }); },
    zombi: function (s, p) { return mano(s, p).some(isUni); },
    zuccherini: function (s) { return s.deck.length >= 3; },
    consegna_speciale: function (s) { return s.nursery.length > 0; }
  };
  // Le sette Magie dell'apocalisse: sacrifichi tutti i tuoi unicorni, ne distruggi uno a testa agli altri, poi cerchi
  // nel mazzo una carta precisa e la metti nella tua stalla.
  function APOCALISSE(k) { return function (s, p) {
    return [{ k: 'sacrifica_tutti' }].concat(altri(s, p).map(function (q) { return { k: 'distruggi', filtro: 'unicorno', magia: true, da: q }; }), [{ k: 'cerca', chiave: k, stalla: true }]);
  }; }
  var MAGIA = {
    zoccolata: function () { return [{ k: 'rimanda', da: 'altri', lab: 'a' }, { k: 'scarta', n: 1, chi: 'vittima', dep: 'a' }]; },
    arraffa: function () { return [{ k: 'giocatore', lab: 'g' }, { k: 'arraffa', dep: 'g' }]; },
    giro_di_ruota: function () { return [{ k: 'pesca', n: 2 }, { k: 'scarta', n: 3 }, { k: 'turno_extra' }]; },
    bufera: function (s, p) { return giro(s, p).map(function (q) { return { k: 'rimanda', da: q }; }); },
    affare_doro: function () { return [{ k: 'pesca', n: 3 }, { k: 'scarta', n: 1 }]; },
    bocca_a_muso: function () { return [{ k: 'rianima' }]; },
    mulinello: function () { return [{ k: 'ogni', op: 'scarta' }, { k: 'mescola' }]; },
    cambio_di_rotta: function () { return [{ k: 'sposta' }]; },
    tabula_rasa: function () { return [{ k: 'tabula' }]; },
    rimescolone: function () { return [{ k: 'rimescolone' }]; },
    colpo_mirato: function () { return [{ k: 'colpo' }]; },
    due_per_uno: function () {
      return [{ k: 'sacrifica', filtro: 'carta', lab: 'a' }, { k: 'distruggi', filtro: 'carta', magia: true, dep: 'a' },
        { k: 'distruggi', filtro: 'carta', magia: true, dep: 'a' }];
    },
    baratto: function () { return [{ k: 'giocatore', lab: 'g' }, { k: 'scambia_mani', dep: 'g' }]; },
    mela: function () { return [{ k: 'distruggi', filtro: 'unicorno', magia: true }]; },
    scambio_stalla: function () { return [{ k: 'scambio', lab: 'a' }, { k: 'ruba', filtro: 'unicorno', da: 'g', dep: 'a' }]; },
    // Brutti sogni
    toc_toc: function () { return [{ k: 'esilia' }]; },
    possessione: function () { return [{ k: 'scarta', n: 1, lab: 'a' }, { k: 'ruba', filtro: 'carta', dep: 'a' }]; },
    fuori_dalla_tomba: function () { return [{ k: 'rianima', filtro: 'semplice', lab: 'a' }, { k: 'pesca', n: 1, dep: 'a' }]; },
    piu_spettro: function () { return [{ k: 'giocatore', tutti: true, lab: 'g' }, { k: 'strage', filtro: 'semplice', dep: 'g' }]; },
    seduta_spiritica: function () { return [{ k: 'evoca' }]; },
    // Miti e leggende
    raso_al_suolo: function () { return [{ k: 'colpo' }]; },
    voltagabbana: function () { return [{ k: 'scarta', n: 2, lab: 'a' }, { k: 'ruba', filtro: 'unicorno', dep: 'a' }]; },
    raglio: function () { return [{ k: 'raglio' }]; },
    palla_di_fuoco: function () { return [{ k: 'ogni', op: 'sacrifica' }]; },
    fulmine: function () { return [{ k: 'distruggi', filtro: 'carta', magia: true, lab: 'a' }, { k: 'fulmine', dep: 'a' }]; },
    negromanzia: function () { return [{ k: 'sacrifica', filtro: 'unicorno', lab: 'a' }, { k: 'rianima', dep: 'a' }]; },
    // Avventure
    corno_luminoso: function () {
      return [{ k: 'oppure', scelte: [
        { voce: 'Sacrifichi una carta e ne distruggi una', need: { k: 'sacrifica', filtro: 'carta' }, passi: [{ k: 'sacrifica', filtro: 'carta', lab: 'a' }, { k: 'distruggi', filtro: 'carta', magia: true, dep: 'a' }] },
        { voce: 'Porti nella stalla una carta dagli scarti', need: { k: 'rianima', filtro: 'stalla' }, passi: [{ k: 'rianima', filtro: 'stalla' }] }] }];
    },
    cercametalli: function () {
      return [{ k: 'oppure', scelte: [
        { voce: 'Peschi 3 carte e ne scarti una', passi: [{ k: 'pesca', n: 3 }, { k: 'scarta', n: 1 }] },
        { voce: 'Prendi in mano una carta dagli scarti', need: { k: 'recupera' }, passi: [{ k: 'recupera' }] }] }];
    },
    bussola: function () {
      return [{ k: 'oppure', scelte: [
        { voce: 'Scarti 3 carte e giochi un altro turno', need: { k: 'scarta', n: 3, cost: true }, passi: [{ k: 'scarta', n: 3, cost: true, lab: 'a' }, { k: 'turno_extra', dep: 'a' }] },
        { voce: 'Dai un tuo unicorno a un altro e gli rubi un unicorno', need: { k: 'scambio' }, passi: [{ k: 'scambio', lab: 'a' }, { k: 'ruba', filtro: 'unicorno', da: 'g', dep: 'a' }] }] }];
    },
    lingua_dargento: function (s, p) {
      return [{ k: 'oppure', scelte: [
        { voce: 'Ti mostrano la mano', passi: [{ k: 'mostra_mani' }] },
        { voce: 'Ognuno ti dà una carta', passi: [{ k: 'ogni', op: 'dai', solo: altri(s, p) }] }] }];
    },
    furto_di_culle: function () { return [{ k: 'scarta', n: 2, lab: 'a' }, { k: 'nido', dep: 'a', lab: 'b' }, { k: 'nido', dep: 'b' }]; },
    paletta: function () {
      return [{ k: 'oppure', scelte: [
        { voce: 'Porti nella stalla un unicorno dagli scarti', need: { k: 'rianima' }, passi: [{ k: 'rianima' }] },
        { voce: 'Prendi in mano 2 unicorni dagli scarti', need: { k: 'recupera', filtro: 'unicorno', almeno: 2 }, passi: [{ k: 'recupera', filtro: 'unicorno', lab: 'a' }, { k: 'recupera', filtro: 'unicorno', dep: 'a' }] }] }];
    },
    // Draghi
    alito_di_drago: function () { return [{ k: 'distruggi', filtro: 'unicorno', magia: true }]; },
    fuoco_di_drago: function () { return [{ k: 'colpo' }]; },
    bacio_del_drago: function () { return [{ k: 'mago' }]; },
    stalle_bruciate: function () { return [{ k: 'tabula', senza: true }]; },
    // Diluvio arcobaleno
    attacco_tenero: function () { return [{ k: 'giocatore', filtro: 'unicorni', lab: 'g' }, { k: 'tenerezza', dep: 'g' }]; },
    fuoco_e_zolfo: APOCALISSE('cenere'),
    castigo_celeste: APOCALISSE('angelo'),
    alpacalisse: APOCALISSE('alpacorno'),
    sovrappopolazione: APOCALISSE('fertile'),
    tempesta_tenerezza: APOCALISSE('miciocorno'),
    distruzione_totale: APOCALISSE('catastrofe'),
    apocalisse_zombi: APOCALISSE('zombi'),
    unicorni_apocalisse: function () {
      var f = [], i;
      for (i = 0; i < 4; i++) f.push({ k: 'sacrifica', filtro: 'unicorno' });
      for (i = 0; i < 4; i++) f.push({ k: 'cerca', filtro: 'unicorno', stalla: true });
      return f;
    },
    peste_nera: function () { return [{ k: 'stregone', magia: true }]; },
    spruzzino: function (s, p) {
      return altri(s, p).map(function (q) { return { k: 'distruggi', filtro: 'unicorno', magia: true, da: q }; })
        .concat(altri(s, p).map(function (q) { return { k: 'nido', p: q, may: true }; }));
    },
    pisolino: function () { return [{ k: 'giocatore', lab: 'g' }, { k: 'pisolino', dep: 'g' }]; }
  };
  // Le Magie che non si possono giocare se manca un bersaglio per la prima cosa che fanno.
  var REQ = {
    zoccolata: function (s, p) { return puoi(s, 'rimanda', p, { da: 'altri' }) ? null : 'Nelle stalle degli altri non c\'è niente da rimandare in mano.'; },
    bufera: function (s, p) { return puoi(s, 'rimanda', p, { da: p }) ? null : 'Nella tua stalla dev\'esserci una carta da rimandare in mano.'; },
    bocca_a_muso: function (s, p) { return puoi(s, 'rianima', p) ? null : 'Negli scarti non c\'è un unicorno che possa entrare nella tua stalla.'; },
    mulinello: function (s, p) { return mano(s, p).length >= 2 ? null : 'Ti serve un\'altra carta in mano da scartare.'; },
    cambio_di_rotta: function (s, p) { return puoi(s, 'sposta', p) ? null : 'Non ci sono Bonus o Malus da spostare.'; },
    tabula_rasa: function (s, p) { return giro(s, p).some(function (q) { return stalla(s, q).some(function (c) { return filtra(c, 'bm'); }); }) ? null : 'Non ci sono Bonus o Malus nelle stalle.'; },
    colpo_mirato: function (s, p) { return puoi(s, 'colpo', p) ? null : 'Non ci sono Bonus da distruggere né Malus tuoi da sacrificare.'; },
    due_per_uno: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'carta' }) ? null : 'Nella tua stalla dev\'esserci una carta da sacrificare.'; },
    mela: function (s, p) { return puoi(s, 'distruggi', p, { filtro: 'unicorno', magia: true }) ? null : 'Non c\'è un unicorno che si possa distruggere.'; },
    scambio_stalla: function (s, p) { return puoi(s, 'scambio', p) ? null : 'Nella tua stalla non c\'è un unicorno che si possa spostare.'; },
    toc_toc: function (s, p) { return puoi(s, 'esilia', p) ? null : 'Nelle stalle non c\'è niente da togliere dal gioco.'; },
    possessione: function (s, p) { return mano(s, p).length >= 2 ? null : 'Ti serve un\'altra carta in mano da scartare.'; },
    fuori_dalla_tomba: function (s, p) { return puoi(s, 'rianima', p, { filtro: 'semplice' }) ? null : 'Negli scarti non c\'è un unicorno semplice che possa entrare nella tua stalla.'; },
    raso_al_suolo: function (s, p) { return puoi(s, 'colpo', p) ? null : 'Non ci sono Bonus da distruggere né Malus tuoi da sacrificare.'; },
    voltagabbana: function (s, p) { return mano(s, p).length >= 3 ? null : 'Ti servono altre 2 carte in mano da scartare.'; },
    raglio: function (s, p) { return mano(s, p).length >= 2 ? null : 'Ti serve un\'altra carta in mano da scartare.'; },
    palla_di_fuoco: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'unicorno' }) ? null : 'Nella tua stalla dev\'esserci un unicorno da sacrificare.'; },
    fulmine: function (s, p) { return puoi(s, 'distruggi', p, { filtro: 'carta', magia: true }) ? null : 'Non c\'è niente che tu possa distruggere.'; },
    negromanzia: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'unicorno' }) ? null : 'Nella tua stalla dev\'esserci un unicorno da sacrificare.'; },
    corno_luminoso: function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'carta' }) || puoi(s, 'rianima', p, { filtro: 'stalla' }) ? null : 'Non hai niente da sacrificare e negli scarti non c\'è niente da portare nella stalla.'; },
    bussola: function (s, p) { return mano(s, p).length >= 4 || puoi(s, 'scambio', p) ? null : 'Ti servono altre 3 carte da scartare, o un unicorno da spostare.'; },
    furto_di_culle: function (s, p) { return mano(s, p).length >= 3 ? null : 'Ti servono altre 2 carte in mano da scartare.'; },
    paletta: function (s, p) { return puoi(s, 'rianima', p) || s.discard.filter(isUni).length >= 2 ? null : 'Negli scarti non ci sono unicorni.'; },
    alito_di_drago: function (s, p) { return puoi(s, 'distruggi', p, { filtro: 'unicorno', magia: true, src: 'alito_di_drago.1' }) ? null : 'Non c\'è un unicorno che si possa distruggere.'; },
    fuoco_di_drago: function (s, p) { return puoi(s, 'colpo', p) ? null : 'Non ci sono Bonus da distruggere né Malus tuoi da sacrificare.'; },
    stalle_bruciate: function (s, p) { return giro(s, p).some(function (q) { return stalla(s, q).some(function (c) { return filtra(c, 'bm'); }); }) ? null : 'Non ci sono Bonus o Malus nelle stalle.'; },
    attacco_tenero: function (s, p) { return puoi(s, 'giocatore', p, { filtro: 'unicorni', src: 'attacco_tenero.1' }) ? null : 'Non c\'è un unicorno che si possa distruggere.'; },
    unicorni_apocalisse: function (s, p) { return opzioni(s, { k: 'sacrifica', p: p, e: 0, filtro: 'unicorno' }).length >= 4 ? null : 'Nella tua stalla devono esserci 4 unicorni da sacrificare.'; },
    pisolino: function (s, p) { return altri(s, p).length ? null : 'Non c\'è nessun altro giocatore.'; }
  };
  ['fuoco_e_zolfo', 'castigo_celeste', 'alpacalisse', 'sovrappopolazione', 'tempesta_tenerezza', 'distruzione_totale', 'apocalisse_zombi'].forEach(function (k) {
    REQ[k] = function (s, p) { return puoi(s, 'sacrifica', p, { filtro: 'unicorno' }) ? null : 'Nella tua stalla dev\'esserci un unicorno da sacrificare.'; };
  });
  function innesco(s, t) {
    if (t.k === 'entra') return ENTRA[keyOf(t.c)](s, t.p, t.c);
    if (t.k === 'recinto') return [{ k: 'scarta', n: 1 }];
    if (t.k === 'esce' || t.k === 'vendicativo') return USCITA[keyOf(t.c)](s, t.p, t.c);
    if (t.k === 'muro') return [{ k: 'pesca_mano', da: t.da }];
    if (t.k === 'zaino' || t.k === 'mare') return [{ k: 'scarta', n: 1 }];
    return [];
  }

  /* ---------- la pila dei passi ---------- */
  function top(s) { return s.stack[s.stack.length - 1]; }
  function avvia(s, p, src, frames) {
    var e = ++s.eid;
    s.ctx[e] = {};
    s.stack.push({ k: 'fine', e: e, p: p, src: src });
    for (var i = frames.length - 1; i >= 0; i--) {
      var f = frames[i];
      f.e = e; if (f.p == null) f.p = p; if (f.src == null) f.src = src;
      s.stack.push(f);
    }
  }
  function flush(s) {
    var q = s.queue;
    s.queue = [];
    for (var i = q.length - 1; i >= 0; i--) avvia(s, q[i].p, q[i].c, innesco(s, q[i]));
  }
  function ok(s) { s.stack.pop(); }
  // Il passo non è riuscito: saltano anche i passi che ne dipendevano («poi…», «se lo fai…»).
  function ko(s, f) {
    s.stack.pop();
    if (!f.lab) return;
    var labs = [f.lab], more = true;
    while (more) {
      more = false;
      s.stack = s.stack.filter(function (g) {
        if (g.e !== f.e || !g.dep || labs.indexOf(g.dep) < 0) return true;
        if (g.lab && labs.indexOf(g.lab) < 0) { labs.push(g.lab); more = true; }
        return false;
      });
    }
  }
  function diventa(s, f, g) { s.stack.pop(); g.e = f.e; g.lab = f.lab; g.src = f.src; if (g.p == null) g.p = f.p; s.stack.push(g); }
  function cx(s, f) { return s.ctx[f.e] || (s.ctx[f.e] = {}); }
  function chi(s, f, v) {
    if (v == null) return f.p;
    if (typeof v === 'number') return v;
    var x = (s.ctx[f.e] || {})[v];
    return x == null ? -1 : x;
  }
  function chiedi(s, f, P) {
    P.id = ++s.pid;
    if (!P.op) P.op = f.k;
    P.src = f.src || null;
    if (P.s == null) P.s = P.wait ? P.wait[0] : f.p;
    s.prompt = P;
  }
  function nulla(s, f) { pushLog(s, { t: 'nulla', s: f.p, src: f.src || null, op: f.k }); }

  // Le possibili scelte di un passo (servono anche per sapere se una carta si può giocare).
  function opzioni(s, f) {
    var p = f.p, fl = f.filtro, out = [];
    function da(qs, ok) { qs.forEach(function (q) { if (q >= 0) stalla(s, q).forEach(function (c) { if (ok(q, c)) out.push(c); }); }); return out; }
    switch (f.k) {
      case 'sacrifica':
        if (f.c) return (stalla(s, p).indexOf(f.c) >= 0 && sacrificabile(s, p, f.c)) ? [f.c] : [];
        return da([p], function (q, c) { return filtra(c, fl) && sacrificabile(s, q, c); });
      case 'distruggi':
        if (has(s, p, 'pace_divina')) return [];
        return da(f.da != null ? [chi(s, f, f.da)].filter(function (q) { return q !== p; }) : altri(s, p), function (q, c) { return filtra(c, fl) && distruggibile(s, q, c, f.magia, f.src); });
      case 'ruba':
        if (has(s, p, 'cavaliere')) return [];
        return da(f.da != null ? [chi(s, f, f.da)].filter(function (q) { return q !== p; }) : altri(s, p),
          function (q, c) { return filtra(c, fl) && tocca(s, q, c) && entra(s, c, p); });
      case 'rimanda':
        return da(f.da === 'altri' ? altri(s, p) : [chi(s, f, f.da)], function (q, c) { return tocca(s, q, c); });
      case 'esilia':
        return da(giro(s, p), function (q, c) { return tocca(s, q, c); });
      case 'colpo':
        if (!has(s, p, 'pace_divina')) da(altri(s, p), function (q, c) { return kind(c) === 'bonus' && !salda(s, q, c, 'distruggi'); });
        return da([p], function (q, c) { return kind(c) === 'malus'; });
      case 'sposta':
        if (n(s) < 2) return [];
        return da(f.mio ? [p] : giro(s, p), function (q, c) { return filtra(c, fl || 'bm') && arrivi(s, f, q, c).length > 0; });
      case 'scambio':
        return da([p], function (q, c) {
          return isUni(c) && tocca(s, p, c) && altri(s, p).some(function (r) { return entra(s, c, r); });
        });
      case 'scarta': out = mano(s, chi(s, f, f.chi)).filter(function (c) { return filtra(c, fl); }); return f.cost && out.length < (f.n || 1) ? [] : out;
      case 'cerca': return s.deck.filter(function (c) { return filtra(c, fl) && (!f.chiave || keyOf(c) === f.chiave); });
      case 'recupera': out = s.discard.filter(function (c) { return filtra(c, fl); }); return out.length >= (f.almeno || 1) ? out : [];
      case 'rianima': return s.discard.filter(function (c) { return (fl === 'stalla' ? filtra(c, fl) : isUni(c) && (!fl || filtra(c, fl))) && c !== f.escludi && entra(s, c, p); });
      case 'dalla_mano': return mano(s, p).filter(function (c) { return kind(c) === (fl || 'semplice') && entra(s, c, p); });
      case 'sotto': return stalla(s, p).filter(function (c) { return isUni(c) && tocca(s, p, c); });
      case 'in_fondo': return mano(s, p).slice();
      case 'nido': return s.nursery.slice();
      case 'giocatore': return (f.tutti ? giro(s, p) : altri(s, p)).filter(function (q) {
        if (fl === 'mano') return mano(s, q).length > 0;
        // Attacco di tenerezza: chi ha unicorni che si possono distruggere
        if (fl === 'unicorni') return opzioni(s, { k: 'distruggi', p: p, e: f.e, filtro: 'unicorno', magia: true, src: f.src, da: q }).length > 0;
        return true;
      });
    }
    return out;
  }
  // Dove può andare la carta c che sta nella stalla di q, quando la si sposta (Cambio di rotta, Unicorno Burattino).
  function arrivi(s, f, q, c) { return giro(s, f.p).filter(function (r) { return r !== q && (!f.altrove || r !== f.p) && entra(s, c, r); }); }
  function bisogno(s, f) {
    if (!f.need) return true;
    var g = clone(f.need); g.p = f.p; g.e = f.e; g.src = f.src;
    return opzioni(s, g).length > 0;
  }
  // Scelta di una carta: senza alternative (e se è obbligatoria) si sceglie da sola.
  function scegli1(s, f, opts, zona, fatto) {
    if (f.ans) { var a = f.ans; delete f.ans; return fatto(a.skip ? null : a.cards[0]); }
    if (!opts.length) { if (!f.may && !f.zitto) nulla(s, f); return ko(s, f); }
    if (f.may && !bisogno(s, f)) return ko(s, f);
    if (!f.may && opts.length === 1) return fatto(opts[0]);
    chiedi(s, f, { kind: 'carte', opts: opts, n: 1, min: 1, may: !!f.may, zona: zona, filtro: f.filtro || null });
  }

  var OPS = {
    fine: function (s, f) { s.stack.pop(); delete s.ctx[f.e]; if (s.queue.length) flush(s); },
    conferma: function (s, f) {
      if (f.ans) { var y = f.ans.yes; delete f.ans; return y ? ok(s) : ko(s, f); }
      if (!bisogno(s, f)) return ko(s, f);
      chiedi(s, f, { kind: 'si', q: f.q });
    },
    sacrifica: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'stalla', function (c) {
        if (!c) return ko(s, f);
        diventa(s, f, { k: 'via', modo: 'sacrifica', q: f.p, c: c, mono: f.mono });
      });
    },
    distruggi: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'stalle', function (c) {
        if (!c) return ko(s, f);
        cx(s, f).vittima = padrone(s, c);
        diventa(s, f, { k: 'via', modo: 'distruggi', q: padrone(s, c), c: c });
      });
    },
    colpo: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'stalle', function (c) {
        if (!c) return ko(s, f);
        var q = padrone(s, c);
        diventa(s, f, { k: 'via', modo: q === f.p ? 'sacrifica' : 'distruggi', q: q, c: c });
      });
    },
    // La carta c lascia la stalla di q; prima chi la possiede può salvarla (Paladino, Unicorno Cenere).
    via: function (s, f) {
      var q = f.q, c = f.c;
      if (f.annullata || q < 0 || stalla(s, q).indexOf(c) < 0 || !tocca(s, q, c) || salda(s, q, c, f.modo)) return ko(s, f);
      if (!f.reaz) {
        f.reaz = 1;
        if (reazioni(s, 'via', -1).length) {
          f.fid = s.rid = (s.rid || 0) + 1;
          s.stack.push({ k: 'reagisci', tipo: 'via', c: c, by: f.p, q: q, modo: f.modo, fid: f.fid, e: f.e, p: f.p, src: f.src });
          return;
        }
      }
      if (f.ans) {
        var pk = f.ans.pick; delete f.ans; f.deciso = true;
        if (pk === 'paladino') {
          var b = paladino(s, q, c);
          if (b) { pushLog(s, { t: 'salvata', s: q, c: c, da: b }); lascia(s, 'sacrifica', q, b, q); return ko(s, f); }
        } else if (pk === 'scarta2' && mano(s, q).length >= 2) {
          pushLog(s, { t: 'salvata', s: q, c: c, da: c, kit: 1 });
          ko(s, f);
          s.stack.push({ k: 'scarta', p: q, chi: q, n: 2, e: f.e, src: cartaAttiva(s, q, 'kit') || c, mono: f.mono });
          return;
        } else if (pk === 'scarta' && mano(s, q).length) {
          var sv = salvaCon(s, f), el = sv && sv !== c ? sv : null;
          pushLog(s, { t: 'salvata', s: q, c: c, da: c, el: el ? 1 : 0, con: el ? keyOf(el) : null });
          ko(s, f);
          // col Monolocale si aspetta lo scarto prima di controllare di nuovo
          s.stack.push({ k: 'scarta', p: q, chi: q, n: 1, e: f.e, src: el || c, mono: f.mono });
          return;
        }
      }
      if (!f.deciso) {
        var o = salvezze(s, f);
        if (o.length) { var sv2 = salvaCon(s, f); return chiedi(s, f, { kind: 'scelta', s: q, opts: o.concat(['no']), c: c, modo: f.modo, mono: f.mono != null, con: sv2 ? keyOf(sv2) : null }); }
      }
      lascia(s, f.modo, q, c, f.p);
      if (f.conta) cx(s, f).n = (cx(s, f).n || 0) + 1;
      ok(s);
    },
    ruba: function (s, f) {
      var fatto = function (c) {
        var q = padrone(s, c);
        togli(s, q, c); metti(s, f.p, c);
        pushLog(s, { t: 'rubata', s: f.p, q: q, c: c });
        ok(s);
      };
      // dopo la finestra della Canna da pesca: si ruba solo se nessuno l'ha impedito
      if (f.c) return f.annullata || padrone(s, f.c) !== f.da0 ? ko(s, f) : fatto(f.c);
      scegli1(s, f, opzioni(s, f), 'stalle', function (c) {
        if (!c) return ko(s, f);
        if (!reazioni(s, 'ruba', f.p).length) return fatto(c);
        f.c = c; f.da0 = padrone(s, c); f.fid = s.rid = (s.rid || 0) + 1;
        s.stack.push({ k: 'reagisci', tipo: 'ruba', c: c, by: f.p, q: f.da0, fid: f.fid, e: f.e, p: f.p, src: f.src });
      });
    },
    rimanda: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'stalle', function (c) {
        if (!c) return ko(s, f);
        var q = padrone(s, c);
        togli(s, q, c); aMano(s, q, c);
        cx(s, f).vittima = q;
        pushLog(s, { t: 'rimandata', s: f.p, q: q, c: c, dove: kind(c) === 'cucciolo' ? 'nido' : 'mano' });
        ok(s);
      });
    },
    scarta: function (s, f) {
      var w = chi(s, f, f.chi), k = f.n || 1;
      if (f.ans) {
        var a = f.ans; delete f.ans;
        if (a.skip) return ko(s, f);
        return scarta(s, w, a.cards);
      }
      var o = w >= 0 ? opzioni(s, f) : [];
      if (f.cost && o.length < k) return ko(s, f);
      if (!o.length) return ko(s, f);
      if (f.may && !bisogno(s, f)) return ko(s, f);
      k = Math.min(k, o.length);
      if (!f.may && o.length <= k) return scarta(s, w, o.slice());
      chiedi(s, f, { kind: 'carte', s: w, opts: o, n: k, min: k, may: !!f.may, zona: 'mano', filtro: f.filtro || null });
    },
    // per: una carta per ogni carta così nella stalla; may: «puoi pescare» non fa finire il mazzo.
    pesca: function (s, f) {
      var w = chi(s, f, f.chi), k = f.per ? stalla(s, w).filter(function (c) { return filtra(c, f.per); }).length : (f.n || 1);
      if (f.may) k = Math.min(k, s.deck.length);
      if (!k) { if (f.per) nulla(s, f); return ok(s); }
      pushLog(s, { t: 'pesca', s: w, n: pescaN(s, w, k) });
      ok(s);
    },
    giocatore: function (s, f) {
      if (f.ans) { var a = f.ans; delete f.ans; if (a.skip) return ko(s, f); cx(s, f).g = a.target; return ok(s); }
      var o = opzioni(s, f);
      if (!o.length) return ko(s, f);
      chiedi(s, f, { kind: 'giocatore', opts: o, may: !!f.may });
    },
    pesca_mano: function (s, f) {
      var t = f.da != null ? f.da : chi(s, f, 'g'), h = mano(s, t);
      if (t < 0 || !h.length) return ko(s, f);
      if (f.ans) { var c = f.ans.cards[0]; delete f.ans; return prendi(s, f, t, c, 'scelta'); }
      if (vedeMano(s, t) && h.length > 1) return chiedi(s, f, { kind: 'carte', opts: h.slice(), n: 1, min: 1, zona: 'mano', di: t });
      prendi(s, f, t, h[randInt(h.length)], 'caso');
    },
    arraffa: function (s, f) {
      var t = chi(s, f, 'g'), h = mano(s, t);
      if (t < 0) return ko(s, f);
      if (!h.length) { pushLog(s, { t: 'manovuota', s: f.p, q: t }); return ok(s); }
      if (f.ans) { var c = f.ans.cards[0]; delete f.ans; return prendi(s, f, t, c, 'guarda'); }
      chiedi(s, f, { kind: 'carte', opts: h.slice(), n: 1, min: 1, zona: 'mano', di: t });
    },
    scambia_mani: function (s, f) {
      var t = chi(s, f, 'g');
      if (t < 0) return ko(s, f);
      var a = s.hand[f.p]; s.hand[f.p] = s.hand[t]; s.hand[t] = a;
      pushLog(s, { t: 'mani', s: f.p, q: t });
      ok(s);
    },
    cerca: function (s, f) {
      if (f.ans) {
        var a = f.ans; delete f.ans;
        if (a.skip) return ko(s, f);
        var c = a.cards[0];
        s.deck.splice(s.deck.indexOf(c), 1);
        if (f.stalla) metti(s, f.p, c); else s.hand[f.p].push(c);
        shuffle(s.deck);
        pushLog(s, { t: 'cercata', s: f.p, c: c, stalla: f.stalla ? 1 : 0 });
        return ok(s);
      }
      var o = opzioni(s, f);
      if (!o.length) { pushLog(s, { t: 'nulla', s: f.p, src: f.src, op: 'cerca' }); return ko(s, f); }
      chiedi(s, f, { kind: 'carte', opts: o, n: 1, min: 1, may: !!f.may, zona: 'mazzo', filtro: f.filtro || null, chiave: f.chiave || null, stalla: !!f.stalla });
    },
    recupera: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'scarti', function (c) {
        if (!c) return ko(s, f);
        s.discard.splice(s.discard.indexOf(c), 1); s.hand[f.p].push(c);
        pushLog(s, { t: 'recuperata', s: f.p, c: c });
        ok(s);
      });
    },
    rianima: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'scarti', function (c) {
        if (!c) return ko(s, f);
        s.discard.splice(s.discard.indexOf(c), 1); metti(s, f.p, c);
        pushLog(s, { t: 'rianimata', s: f.p, c: c });
        ok(s);
      });
    },
    dalla_mano: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'mano', function (c) {
        if (!c) return ko(s, f);
        dallaMano(s, f.p, c); metti(s, f.p, c);
        pushLog(s, { t: 'portata', s: f.p, c: c });
        ok(s);
      });
    },
    nido: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'nido', function (c) {
        if (!c) return ko(s, f);
        s.nursery.splice(s.nursery.indexOf(c), 1); metti(s, f.p, c);
        pushLog(s, { t: 'portata', s: f.p, c: c, dal: 'nido' });
        ok(s);
      });
    },
    // Unicorno Indovino: si prende una delle prime 3 carte e si decide quale delle altre torna in cima.
    indovino: function (s, f) {
      var a = f.ans; delete f.ans;
      if (!f.tre) {
        if (!s.deck.length) return ko(s, f);
        f.tre = s.deck.splice(Math.max(0, s.deck.length - 3)).reverse();
        f.st = 1;
      }
      if (f.st === 1) {
        if (!a && f.tre.length > 1) return chiedi(s, f, { kind: 'carte', opts: f.tre.slice(), n: 1, min: 1, zona: 'mazzo', fase: 'prendi' });
        var c = a ? a.cards[0] : f.tre[0];
        f.tre.splice(f.tre.indexOf(c), 1); s.hand[f.p].push(c);
        pushLog(s, { t: 'indovino', s: f.p });
        f.st = 2; a = null;
      }
      if (f.tre.length === 2) {
        if (!a) return chiedi(s, f, { kind: 'carte', opts: f.tre.slice(), n: 1, min: 1, zona: 'mazzo', fase: 'cima' });
        var t = a.cards[0];
        s.deck.push(f.tre[0] === t ? f.tre[1] : f.tre[0], t);
      } else if (f.tre.length === 1) s.deck.push(f.tre[0]);
      ok(s);
    },
    // Sacrifici in blocco: ogni carta passa da 'via' (chi non si sacrifica resta, l'Elisir può salvare un Bonus).
    tutti_malus: function (s, f) {
      s.stack.pop();
      var m = stalla(s, f.p).filter(function (c) { return kind(c) === 'malus'; });
      for (var i = m.length - 1; i >= 0; i--) s.stack.push({ k: 'via', modo: 'sacrifica', q: f.p, c: m[i], p: f.p, e: f.e, src: f.src });
    },
    tabula: function (s, f) {
      s.stack.pop();
      if (!f.senza) s.stack.push({ k: 'mescola', p: f.p, e: f.e, src: f.src });
      var vs = [];
      giro(s, f.p).forEach(function (q) {
        stalla(s, q).forEach(function (c) { if (filtra(c, 'bm')) vs.push({ k: 'via', modo: 'sacrifica', q: q, c: c, p: q, e: f.e, src: f.src }); });
      });
      for (var i = vs.length - 1; i >= 0; i--) s.stack.push(vs[i]);
    },
    // Toglie dal gioco una carta di una stalla qualsiasi (i cuccioli tornano nel Nido).
    esilia: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'stalle', function (c) {
        if (!c) return ko(s, f);
        var q = padrone(s, c);
        togli(s, q, c);
        pushLog(s, { t: 'esiliata', s: f.p, q: q, c: c, dove: fuori(s, c) });
        ok(s);
      });
    },
    // Unicorno Mietitore: pesca; se è un Nitrito puoi mostrarlo e pescarne un altro.
    mietitore: function (s, f) {
      if (f.ans) {
        var y = f.ans.yes; delete f.ans;
        if (y && s.deck.length) { pushLog(s, { t: 'mostra', s: f.p, c: f.c }); pushLog(s, { t: 'pesca', s: f.p, n: pescaN(s, f.p, 1) }); }
        return ok(s);
      }
      if (!s.deck.length) return ok(s);
      var c = pesca1(s, f.p);
      pushLog(s, { t: 'pesca', s: f.p, n: 1 });
      if (!isNeigh(c) || !s.deck.length) return ok(s);
      f.c = c;
      chiedi(s, f, { kind: 'si', q: 'mietitore', c: c });
    },
    // Spirito guida: la carta pescata si mostra; un Bonus o un Malus va nella tua stalla.
    guida: function (s, f) {
      if (!s.deck.length) return ok(s);
      var c = pesca1(s, f.p), t = kind(c), dentro = (t === 'bonus' || t === 'malus') && entra(s, c, f.p);
      pushLog(s, { t: 'mostra', s: f.p, c: c, pesca: 1, dentro: dentro ? 1 : 0 });
      if (dentro) { dallaMano(s, f.p, c); metti(s, f.p, c); }
      ok(s);
    },
    salta_pesca: function (s, f) {
      s.stack = s.stack.filter(function (g) { return !(g.k === 'pesca_fase' && g.turno); });
      pushLog(s, { t: 'saltapesca', s: f.p });
      ok(s);
    },
    // Incubo: sepolto vivo — senza unicorni nella stalla torna in mano a chi ce l'ha.
    sepolto: function (s, f) {
      var c = f.src, t = stalla(s, f.p);
      if (t.indexOf(c) >= 0 && !t.some(function (x) { return isUni(x) && tocca(s, f.p, x); })) {
        togli(s, f.p, c); s.hand[f.p].push(c);
        pushLog(s, { t: 'tornata', s: f.p, c: c });
      }
      ok(s);
    },
    scarta_mano: function (s, f) {
      var h = mano(s, f.p).slice();
      if (h.length) { s.discard = s.discard.concat(h); s.hand[f.p] = []; pushLog(s, { t: 'scartate', s: f.p, cards: h }); }
      ok(s);
    },
    // La legge del più spettro: distrugge tutte le carte così nella stalla del giocatore scelto.
    strage: function (s, f) {
      var t = chi(s, f, 'g');
      s.stack.pop();
      if (t < 0) return;
      var vs = has(s, f.p, 'pace_divina') ? [] : stalla(s, t).filter(function (c) { return filtra(c, f.filtro) && distruggibile(s, t, c, true, f.src); });
      if (!vs.length) return pushLog(s, { t: 'nulla', s: f.p, src: f.src, op: 'strage', q: t });
      for (var i = vs.length - 1; i >= 0; i--) s.stack.push({ k: 'via', modo: 'distruggi', q: t, c: vs[i], p: f.p, e: f.e, src: f.src });
    },
    // Seduta spiritica: un Incubo dal mazzo nella stalla di un giocatore qualsiasi, poi si mescola.
    evoca: function (s, f) {
      var a = f.ans; delete f.ans;
      if (!f.c) {
        var o = s.deck.filter(function (c) { return filtra(c, 'incubo') && giro(s, f.p).some(function (q) { return entra(s, c, q); }); });
        if (!o.length) { shuffle(s.deck); pushLog(s, { t: 'nulla', s: f.p, src: f.src, op: 'cerca' }); return ko(s, f); }
        if (!a && o.length > 1) return chiedi(s, f, { kind: 'carte', opts: o, n: 1, min: 1, zona: 'mazzo', filtro: 'incubo' });
        f.c = a ? a.cards[0] : o[0]; a = null;
      }
      var dest = giro(s, f.p).filter(function (q) { return entra(s, f.c, q); }), t = -1;
      if (a) t = a.target; else if (dest.length === 1) t = dest[0];
      if (t < 0) return chiedi(s, f, { kind: 'giocatore', opts: dest, c: f.c });
      s.deck.splice(s.deck.indexOf(f.c), 1); metti(s, t, f.c); shuffle(s.deck);
      pushLog(s, { t: 'evocata', s: f.p, c: f.c, to: t });
      ok(s);
    },
    // «Scegli: … oppure …»: si sceglie una delle strade possibili (con «puoi», anche nessuna).
    oppure: function (s, f) {
      var a = f.ans; delete f.ans;
      var ok2 = [];
      f.scelte.forEach(function (x, i) { if (!x.need || bisogno(s, { need: x.need, p: f.p, e: f.e, src: f.src })) ok2.push(i); });
      if (!a) {
        if (!ok2.length) { if (!f.may) nulla(s, f); return ko(s, f); }
        return chiedi(s, f, { kind: 'opzione', opts: ok2, voci: f.scelte.map(function (x) { return x.voce; }), may: !!f.may });
      }
      if (a.skip || ok2.indexOf(a.pick) < 0) return ko(s, f);
      var x = f.scelte[a.pick];
      s.stack.pop();
      pushLog(s, { t: 'sceglie', s: f.p, src: f.src, voce: x.voce });
      for (var i = x.passi.length - 1; i >= 0; i--) {
        var g = clone(x.passi[i]);
        g.e = f.e; if (g.p == null) g.p = f.p; if (g.src == null) g.src = f.src;
        s.stack.push(g);
      }
    },
    // La finestra delle istantanee di reazione: chi ce l'ha in mano può giocarla (e gli altri possono fermarla col Nitrito).
    reagisci: function (s, f) {
      if (f.giocata != null) {
        s.stack.pop();
        var it = s.chain[0];
        if (!it) return;
        pushLog(s, { t: 'reagisce', s: it.p, c: it.c, su: f.c || null, q: f.q, by: f.by, tipo: f.tipo });
        s.stack.push({ k: 'risolvi' }, { k: 'finestra' });
        return;
      }
      if (f.chiesto) return ok(s);
      var w = reazioni(s, f.tipo, f.tipo === 'via' ? -1 : f.by);
      if (!w.length) return ok(s);
      f.chiesto = 1;
      chiedi(s, f, { kind: 'reazione', wait: w, tipo: f.tipo, c: f.c || null, q: f.q, by: f.by, modo: f.modo || null });
    },
    // L'istantanea di reazione non è stata fermata: fa il suo effetto.
    contrattacco: function (s, f) {
      var r = f.rea;
      if (r.tipo === 'turno') {
        s.stack = s.stack.filter(function (g) { return !((g.k === 'inizio' || g.k === 'pesca_fase') && g.turno); });
        pushLog(s, { t: 'razzo', s: f.p, q: r.by });
        return ok(s);
      }
      s.stack.forEach(function (g) { if (g.fid === r.fid) g.annullata = 1; });
      var q = padrone(s, r.c);
      if (q < 0) return ok(s);
      if (r.tipo === 'ruba') {
        var mossa = q !== f.p && entra(s, r.c, f.p);
        if (mossa) { togli(s, q, r.c); metti(s, f.p, r.c); }
        pushLog(s, { t: 'pescata', s: f.p, c: r.c, q: q, by: r.by, mossa: mossa ? 1 : 0 });
      } else {
        togli(s, q, r.c);
        var dove = kind(r.c) === 'cucciolo' ? 'nido' : 'mano';
        if (dove === 'nido') s.nursery.push(r.c); else s.hand[f.p].push(r.c);
        pushLog(s, { t: 'retata', s: f.p, c: r.c, q: q, dove: dove });
      }
      ok(s);
    },
    razzo_check: function (s) {
      s.stack.pop();
      if (reazioni(s, 'turno', s.turn).length) s.stack.push({ k: 'reagisci', tipo: 'turno', by: s.turn, q: s.turn, fid: s.rid = (s.rid || 0) + 1, e: 0, p: s.turn });
    },
    // Unicorno Bungee: dagli scarti torna in mano.
    riprendi: function (s, f) {
      var i = s.discard.indexOf(f.c);
      if (i < 0) return ko(s, f);
      s.discard.splice(i, 1); s.hand[f.p].push(f.c);
      pushLog(s, { t: 'recuperata', s: f.p, c: f.c });
      ok(s);
    },
    // Unicorno Clandestino: la carta pescata si mostra; un unicorno, un Bonus o un Malus va nella tua stalla.
    clandestino: function (s, f) {
      if (!s.deck.length) return ok(s);
      var c = pesca1(s, f.p), t = kind(c), dentro = t !== 'magia' && t !== 'istante' && entra(s, c, f.p);
      pushLog(s, { t: 'mostra', s: f.p, c: c, pesca: 1, dentro: dentro ? 1 : 0 });
      if (dentro) { dallaMano(s, f.p, c); metti(s, f.p, c); }
      ok(s);
    },
    // Lingua d'argento: gli altri ti mostrano la mano (si guarda e si va avanti).
    mostra_mani: function (s, f) {
      if (f.ans) { delete f.ans; return ok(s); }
      var m = {};
      altri(s, f.p).forEach(function (q) { m[q] = mano(s, q).slice(); });
      pushLog(s, { t: 'mostrate', s: f.p });
      chiedi(s, f, { kind: 'vedi', mani: m });
    },
    // Zoccoli reali: la pesca del turno diventa una carta presa a caso dal giocatore scelto.
    zoccoli: function (s, f) {
      var g = chi(s, f, 'g');
      s.stack.forEach(function (x) { if (x.k === 'pesca_fase' && x.turno) x.ruba = g; });
      pushLog(s, { t: 'zoccoli', s: f.p, q: g });
      ok(s);
    },
    // Bardo Ammaliatore: la carta passa nella stalla del giocatore scelto.
    trasloca: function (s, f) {
      var t = chi(s, f, 'g'), c = f.src;
      if (t < 0 || stalla(s, f.p).indexOf(c) < 0 || !entra(s, c, t)) return ko(s, f);
      togli(s, f.p, c); metti(s, t, c);
      pushLog(s, { t: 'spostata', s: f.p, c: c, q: f.p, to: t });
      ok(s);
    },
    // Unicorno Divino: delle prime 3 carte del mazzo una va in mano, le altre negli scarti.
    divino: function (s, f) {
      var a = f.ans; delete f.ans;
      if (!f.tre) {
        if (!s.deck.length) return ko(s, f);
        f.tre = s.deck.splice(Math.max(0, s.deck.length - 3)).reverse();
      }
      if (!a && f.tre.length > 1) return chiedi(s, f, { kind: 'carte', opts: f.tre.slice(), n: 1, min: 1, zona: 'mazzo' });
      var c = a ? a.cards[0] : f.tre[0];
      f.tre.splice(f.tre.indexOf(c), 1); s.hand[f.p].push(c);
      pushLog(s, { t: 'divino', s: f.p });
      if (f.tre.length) { s.discard = s.discard.concat(f.tre); pushLog(s, { t: 'scartate', s: f.p, cards: f.tre.slice(), mazzo: 1 }); }
      f.tre = [];
      ok(s);
    },
    // Elficorno Esploratore: le prime 3 carte tornano in cima nell'ordine scelto (si sceglie dalla prima).
    scruta: function (s, f) {
      var a = f.ans; delete f.ans;
      if (!f.tre) {
        if (!s.deck.length) return ko(s, f);
        f.tre = s.deck.splice(Math.max(0, s.deck.length - 3)).reverse(); f.su = [];
      }
      if (a) { var c = a.cards[0]; f.tre.splice(f.tre.indexOf(c), 1); f.su.push(c); }
      if (f.tre.length > 1) return chiedi(s, f, { kind: 'carte', opts: f.tre.slice(), n: 1, min: 1, zona: 'mazzo', fase: f.su.length ? 'poi' : 'cima' });
      var ord = f.su.concat(f.tre);
      for (var i = ord.length - 1; i >= 0; i--) s.deck.push(ord[i]);
      f.tre = []; f.su = [];
      pushLog(s, { t: 'scruta', s: f.p, n: ord.length });
      ok(s);
    },
    // Unicorno Stregone: sacrifichi quante carte vuoi, poi ne distruggi altrettante.
    stregone: function (s, f) {
      var a = f.ans; delete f.ans;
      if (!a) {
        var o = opzioni(s, { k: 'sacrifica', p: f.p, e: f.e, filtro: 'carta' });
        if (!o.length || !opzioni(s, { k: 'distruggi', p: f.p, e: f.e, filtro: 'carta', magia: f.magia, src: f.src }).length) return ko(s, f);
        return chiedi(s, f, { kind: 'carte', opts: o, n: o.length, min: 1, may: true, zona: 'stalla' });
      }
      s.stack.pop();
      if (a.skip) return;
      s.stack.push({ k: 'stregone_d', p: f.p, e: f.e, src: f.src, magia: f.magia });
      for (var i = a.cards.length - 1; i >= 0; i--) s.stack.push({ k: 'via', modo: 'sacrifica', q: f.p, c: a.cards[i], p: f.p, e: f.e, src: f.src, conta: 1 });
    },
    stregone_d: function (s, f) {
      var k = cx(s, f).n || 0;
      s.stack.pop();
      for (var i = 0; i < k; i++) s.stack.push({ k: 'distruggi', filtro: 'carta', p: f.p, e: f.e, src: f.src, magia: f.magia });
    },
    // Unicorno Mago: una Magia dal mazzo in mano, la giochi subito (se si può), poi si mescola il mazzo.
    mago: function (s, f) {
      var a = f.ans; delete f.ans;
      var o = s.deck.filter(function (c) { return kind(c) === 'magia'; });
      if (!a) {
        if (!o.length) { shuffle(s.deck); pushLog(s, { t: 'nulla', s: f.p, src: f.src, op: 'cerca' }); return ko(s, f); }
        if (o.length > 1) return chiedi(s, f, { kind: 'carte', opts: o, n: 1, min: 1, zona: 'mazzo', filtro: 'magia' });
        a = { cards: [o[0]] };
      }
      var c = a.cards[0];
      s.deck.splice(s.deck.indexOf(c), 1); s.hand[f.p].push(c);
      pushLog(s, { t: 'cercata', s: f.p, c: c });
      s.stack.pop();
      s.stack.push({ k: 'mescola_mazzo', p: f.p, e: f.e, src: f.src });
      subito(s, f.p, c);
    },
    mescola_mazzo: function (s) { shuffle(s.deck); ok(s); },
    // Colpo critico: chi gioca una Magia può sacrificarlo per giocarla due volte (si decide prima dei Nitriti).
    critico: function (s, f) {
      var cc = cartaAttiva(s, f.p, 'colpo_critico'), it = s.chain[0];
      if (!cc || !it || s.chain.length !== 1 || it.bis || !sacrificabile(s, f.p, cc)) return ok(s);
      if (!f.ans) return chiedi(s, f, { kind: 'si', q: 'critico', c: it.c });
      var y = f.ans.yes; delete f.ans;
      s.stack.pop();
      if (!y) return;
      s.stack.push({ k: 'critico_ok', p: f.p, cc: cc, e: f.e }, { k: 'via', modo: 'sacrifica', q: f.p, c: cc, p: f.p, e: f.e, src: cc });
    },
    critico_ok: function (s, f) {
      if (stalla(s, f.p).indexOf(f.cc) < 0 && s.chain[0]) { s.chain[0].bis = 1; pushLog(s, { t: 'critico', s: f.p, c: s.chain[0].c }); }
      ok(s);
    },
    rigioca: function (s, f) {
      var c = s.inGioco;
      s.stack.pop();
      if (!c) return;
      s.inGioco = null; s.hand[f.p].push(c);
      subito(s, f.p, c);
    },
    // Raglio prismatico: scarti 1 o 2 carte, poi altrettanti giocatori sacrificano un unicorno.
    raglio: function (s, f) {
      var a = f.ans; delete f.ans;
      if (!f.quanti) {
        var h = mano(s, f.p);
        if (!h.length) return ko(s, f);
        if (!a) return chiedi(s, f, { kind: 'carte', opts: h.slice(), n: Math.min(2, h.length), min: 1, zona: 'mano' });
        a.cards.forEach(function (c) { if (dallaMano(s, f.p, c)) s.discard.push(c); });
        pushLog(s, { t: 'scartate', s: f.p, cards: a.cards.slice() });
        f.quanti = a.cards.length; f.scelti = []; a = null;
      }
      if (a) f.scelti.push(a.target);
      var resto = altri(s, f.p).filter(function (q) { return f.scelti.indexOf(q) < 0; });
      if (f.scelti.length < f.quanti && resto.length) return chiedi(s, f, { kind: 'giocatore', opts: resto });
      diventa(s, f, { k: 'ogni', op: 'sacrifica', solo: f.scelti.slice() });
    },
    // Fulmine a catena: chi ha subito il colpo può distruggere a sua volta una carta.
    fulmine: function (s, f) {
      var v = chi(s, f, 'vittima');
      s.stack.pop();
      if (v >= 0 && v !== f.p) s.stack.push({ k: 'distruggi', filtro: 'carta', magia: true, may: true, p: v, e: f.e, src: f.src });
    },
    // Maleficio: chi resta senza carte in mano lo sposta da un altro giocatore che ne ha.
    passa_maleficio: function (s, f) {
      var a = f.ans; delete f.ans;
      if (padrone(s, f.c) !== f.p || mano(s, f.p).length) return ok(s);
      var o = altri(s, f.p).filter(function (q) { return mano(s, q).length && entra(s, f.c, q); }), t = -1;
      if (!o.length) return ok(s);
      if (a && o.indexOf(a.target) >= 0) t = a.target; else if (o.length === 1) t = o[0];
      if (t < 0) return chiedi(s, f, { kind: 'giocatore', opts: o, c: f.c });
      togli(s, f.p, f.c); metti(s, t, f.c);
      pushLog(s, { t: 'spostata', s: f.p, c: f.c, q: f.p, to: t });
      ok(s);
    },
    mescola: function (s) { mescolaScarti(s); ok(s); },
    rimescolone: function (s, f) {
      var add = s.hand[f.p].concat(s.discard);
      if (s.inGioco) { add.push(s.inGioco); s.inGioco = null; }
      s.hand[f.p] = []; s.discard = [];
      s.deck = shuffle(s.deck.concat(add));
      var got = pescaN(s, f.p, 5);
      pushLog(s, { t: 'rimescolone', s: f.p, n: got });
      ok(s);
    },
    turno_extra: function (s, f) { s.extra = (s.extra || 0) + 1; pushLog(s, { t: 'extra', s: f.p }); ok(s); },
    salta_turno: function (s, f) { s.salta = true; pushLog(s, { t: 'salta', s: f.p }); ok(s); },
    agli_scarti: function (s) { if (s.inGioco) { s.discard.push(s.inGioco); s.inGioco = null; } ok(s); },
    // Cambio di rotta: un Bonus o Malus da una stalla a un'altra.
    sposta: function (s, f) {
      if (!f.c) return scegli1(s, f, opzioni(s, f), 'stalle', function (c) { if (!c) return ko(s, f); f.c = c; f.da = padrone(s, c); });
      if (padrone(s, f.c) !== f.da) return ko(s, f);
      var dest = arrivi(s, f, f.da, f.c);
      if (f.ans) {
        var t = f.ans.target; delete f.ans;
        if (dest.indexOf(t) < 0) return ko(s, f);
        togli(s, f.da, f.c); metti(s, t, f.c);
        cx(s, f).g = t;
        pushLog(s, { t: 'spostata', s: f.p, c: f.c, q: f.da, to: t });
        return ok(s);
      }
      if (!dest.length) return ko(s, f);
      chiedi(s, f, { kind: 'giocatore', opts: dest, c: f.c });
    },
    // Scambio di stalla: un tuo unicorno va da un altro giocatore, poi gli rubi un unicorno.
    scambio: function (s, f) {
      if (!f.c) return scegli1(s, f, opzioni(s, f), 'stalla', function (c) { if (!c) return ko(s, f); f.c = c; });
      if (stalla(s, f.p).indexOf(f.c) < 0) return ko(s, f);
      var dest = altri(s, f.p).filter(function (q) { return entra(s, f.c, q); });
      if (!dest.length) return ko(s, f);
      var t = -1;
      if (f.ans) { t = f.ans.target; delete f.ans; } else if (dest.length === 1) t = dest[0];
      if (t < 0) return chiedi(s, f, { kind: 'giocatore', opts: dest, c: f.c });
      togli(s, f.p, f.c); metti(s, t, f.c);
      cx(s, f).g = t;
      pushLog(s, { t: 'spostata', s: f.p, c: f.c, q: f.p, to: t });
      ok(s);
    },
    // Ogni giocatore sceglie insieme agli altri cosa scartare o sacrificare; poi tutto succede in ordine di turno.
    ogni: function (s, f) {
      if (!f.got) {
        f.got = {};
        var wait = [], opts = {};
        giro(s, f.p).forEach(function (q) {
          if (f.solo && f.solo.indexOf(q) < 0) return;
          var o = f.op === 'scarta' || f.op === 'dai' ? mano(s, q).slice() : stalla(s, q).filter(function (c) { return filtra(c, f.filtro || 'unicorno') && sacrificabile(s, q, c); });
          if (!o.length) return;
          if (o.length === 1) f.got[q] = o[0]; else { wait.push(q); opts[q] = o; }
        });
        if (wait.length) return chiedi(s, f, { kind: 'ogni', wait: wait, opts: opts, cosa: f.op, a: f.p, filtro: f.filtro || null });
      }
      var ord = giro(s, f.p).filter(function (q) { return f.got[q] != null; });
      if (f.op === 'scarta') {
        ord.forEach(function (q) { var c = f.got[q]; if (dallaMano(s, q, c)) { s.discard.push(c); (cx(s, f).scartate = cx(s, f).scartate || []).push(c); pushLog(s, { t: 'scartate', s: q, cards: [c] }); } });
        return ok(s);
      }
      if (f.op === 'dai') {
        ord.forEach(function (q) { var c = f.got[q]; if (dallaMano(s, q, c)) { s.hand[f.p].push(c); pushLog(s, { t: 'presa', s: f.p, q: q, c: c, how: 'dato', priv: [f.p, q] }); } });
        return ok(s);
      }
      s.stack.pop();
      for (var i = ord.length - 1; i >= 0; i--) {
        if (f.poi === 'pesca') s.stack.push({ k: 'pesca', n: 1, chi: ord[i], p: ord[i], e: f.e, src: f.src });
        s.stack.push({ k: 'via', modo: 'sacrifica', q: ord[i], c: f.got[ord[i]], p: ord[i], e: f.e, src: f.src });
      }
    },
    // Sfortuna del drago: una carta della mano in fondo al mazzo (gli altri non vedono quale).
    in_fondo: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'mano', function (c) {
        if (!c || !dallaMano(s, f.p, c)) return ko(s, f);
        s.deck.unshift(c);
        pushLog(s, { t: 'in_fondo', s: f.p, c: c, priv: [f.p] });
        ok(s);
      });
    },
    // Cieli dei draghi: un tuo unicorno in fondo al mazzo (un Cucciolo torna nel Nido, e allora niente pesca).
    sotto: function (s, f) {
      scegli1(s, f, opzioni(s, f), 'stalla', function (c) {
        if (!c || !togli(s, f.p, c)) return ko(s, f);
        var cucciolo = kind(c) === 'cucciolo';
        if (cucciolo) s.nursery.push(c); else s.deck.unshift(c);
        pushLog(s, { t: 'sotto', s: f.p, c: c, dove: cucciolo ? 'nido' : 'mazzo' });
        return cucciolo ? ko(s, f) : ok(s);
      });
    },
    // Bulldocorno: una delle carte appena scartate dagli altri in mano a chi l'ha giocato.
    raccogli: function (s, f) {
      var o = (cx(s, f).scartate || []).filter(function (c) { return s.discard.indexOf(c) >= 0; });
      scegli1(s, f, o, 'scarti', function (c) {
        if (!c) return ko(s, f);
        s.discard.splice(s.discard.indexOf(c), 1); s.hand[f.p].push(c);
        pushLog(s, { t: 'recuperata', s: f.p, c: c });
        ok(s);
      });
    },
    // Unicorno della Pestilenza: scarti quante carte vuoi (anche nessuna), poi ogni altro giocatore ne scarta altrettante.
    pestilenza: function (s, f) {
      var h = mano(s, f.p);
      if (!f.ans) {
        if (!h.length) { nulla(s, f); return ok(s); }
        return chiedi(s, f, { kind: 'carte', opts: h.slice(), n: h.length, min: 1, may: true, zona: 'mano' });
      }
      var a = f.ans; delete f.ans;
      var cs = a.skip ? [] : a.cards.filter(function (c) { return h.indexOf(c) >= 0; });
      if (!cs.length) { pushLog(s, { t: 'nessuno_scarto', s: f.p, src: f.src }); return ok(s); }
      scarta(s, f.p, cs);
      var o = altri(s, f.p);
      for (var i = o.length - 1; i >= 0; i--) s.stack.push({ k: 'scarta', chi: o[i], n: cs.length, p: f.p, e: f.e, src: f.src });
    },
    // Principessa Arcobaleno: scegli quanti giocatori vuoi; peschi tante carte quanti sono, poi ognuno di loro ne pesca una.
    principessa: function (s, f) {
      if (!f.ans) return chiedi(s, f, { kind: 'giocatori', opts: giro(s, f.p), min: 0 });
      var t = f.ans.targets || []; delete f.ans;
      s.stack.pop();
      pushLog(s, { t: 'scelti', s: f.p, qs: t, src: f.src });
      for (var i = t.length - 1; i >= 0; i--) s.stack.push({ k: 'pesca', n: 1, may: true, chi: t[i], p: f.p, e: f.e, src: f.src });
      if (t.length) s.stack.push({ k: 'pesca', n: t.length, may: true, p: f.p, e: f.e, src: f.src });
    },
    // Attacco di tenerezza: fino a 3 unicorni distrutti al giocatore scelto, e altrettanti Cuccioli dal Nido nella sua stalla.
    tenerezza: function (s, f) {
      var g = chi(s, f, 'g'), o = opzioni(s, { k: 'distruggi', p: f.p, e: f.e, filtro: 'unicorno', magia: true, src: f.src, da: g });
      var fatto = function (cs) {
        s.stack.pop();
        s.stack.push({ k: 'culle', q: g, p: f.p, e: f.e, src: f.src });
        for (var i = cs.length - 1; i >= 0; i--) s.stack.push({ k: 'via', modo: 'distruggi', q: g, c: cs[i], p: f.p, e: f.e, src: f.src, conta: 1 });
      };
      if (f.ans) { var a = f.ans; delete f.ans; return fatto(a.cards); }
      if (!o.length) { nulla(s, f); return ko(s, f); }
      if (o.length <= 3) return fatto(o);
      chiedi(s, f, { kind: 'carte', opts: o, n: 3, min: 3, zona: 'stalle', filtro: 'unicorno' });
    },
    culle: function (s, f) {
      var k = Math.min(cx(s, f).n || 0, s.nursery.length);
      for (var i = 0; i < k; i++) { var c = s.nursery.shift(); metti(s, f.q, c); pushLog(s, { t: 'portata', s: f.q, c: c, dal: 'nido' }); }
      ok(s);
    },
    // Le Magie dell'apocalisse: via tutti i tuoi unicorni.
    sacrifica_tutti: function (s, f) {
      s.stack.pop();
      var t = stalla(s, f.p).filter(function (c) { return isUni(c) && sacrificabile(s, f.p, c); });
      for (var i = t.length - 1; i >= 0; i--) s.stack.push({ k: 'via', modo: 'sacrifica', q: f.p, c: t[i], p: f.p, e: f.e, src: f.src });
    },
    // Pisolino: chi è scelto salta il suo prossimo turno.
    pisolino: function (s, f) {
      var g = chi(s, f, 'g');
      (s.dorme = s.dorme || []).push(g);
      pushLog(s, { t: 'pisolino', s: f.p, q: g });
      ok(s);
    },
    salta_azione: function (s, f) {
      s.stack = s.stack.filter(function (g) { return !(g.k === 'azione' && g.turno); });
      pushLog(s, { t: 'salta_azione', s: f.p });
      ok(s);
    },
    // La finestra del Nitrito sulla carta in cima alla catena.
    finestra: function (s, f) {
      var ch = s.chain;
      if (!f.aperta) {
        var it = ch[ch.length - 1], el = reattivi(s, it);
        if (el.length) { f.aperta = true; return chiedi(s, f, { kind: 'nitrito', wait: el, on: it.c, by: it.p, livello: ch.length - 1 }); }
      }
      f.aperta = false;
      if (ch.length === 1) return ok(s);
      // il Nitrito maledetto toglie dal gioco la carta che ferma
      var nn = ch.pop(), x = ch.pop(), via = keyOf(nn.c) === 'nitrito_maledetto';
      if (via) fuori(s, x.c); else s.discard.push(x.c);
      s.discard.push(nn.c);
      pushLog(s, { t: 'fermata', s: nn.p, c: x.c, by: x.p, con: nn.c, fuori: via ? 1 : 0 });
      if (!ch.length) ok(s);
      // i Nitriti con un effetto per chi è stato fermato
      var kn = keyOf(nn.c);
      if (kn === 'nitrito_messere') avvia(s, x.p, nn.c, [{ k: 'pesca', n: 1, may: true }]);
      else if (kn === 'nitrito_villano') avvia(s, x.p, nn.c, [{ k: 'scarta', n: 1 }]);
      else if (kn === 'nitrito_grazie') avvia(s, nn.p, nn.c, [{ k: 'pesca', n: 1, may: true }, { k: 'pesca', n: 1, may: true, chi: x.p }]);
    },
    risolvi: function (s) {
      s.stack.pop();
      if (s.chain.length !== 1) { s.chain = []; return; }
      var it = s.chain[0], c = it.c;
      s.chain = [];
      if (it.rea) { s.discard.push(c); return avvia(s, it.p, c, [{ k: 'contrattacco', rea: it.rea }]); }
      if (kind(c) === 'magia') {
        if (s.inGioco) s.discard.push(s.inGioco);
        s.inGioco = c;
        pushLog(s, { t: 'magia', s: it.p, c: c });
        // col Colpo critico, finito l'effetto la Magia torna in mano e si gioca di nuovo
        return avvia(s, it.p, c, MAGIA[keyOf(c)](s, it.p, c).concat([{ k: it.bis ? 'rigioca' : 'agli_scarti' }]));
      }
      if (!entra(s, c, it.to)) { s.discard.push(c); return; }
      metti(s, it.to, c);
      pushLog(s, { t: 'entrata', s: it.p, c: c, q: it.to });
    },

    /* ---- il turno ---- */
    inizio: function (s, f) {
      var p = s.turn;
      s.phase = 'inizio';
      // Meridiana rotta: niente inizio del turno
      if (!f.ans && !f.visto && has(s, p, 'meridiana')) { pushLog(s, { t: 'meridiana', s: p }); return chiudiInizio(s); }
      f.visto = 1;
      if (f.ans) {
        var a = f.ans; delete f.ans;
        if (a.skip) return chiudiInizio(s);
        var c = a.cards[0];
        s.usati.push(c);
        pushLog(s, { t: 'usa', s: p, c: c });
        return avvia(s, p, c, INIZIO[keyOf(c)](s, p, c));
      }
      var av = disponibili(s, p);
      if (!av.opts.length) return chiudiInizio(s);
      chiedi(s, f, { kind: 'carte', s: p, opts: av.opts, n: 1, min: 1, may: !av.must.length, must: av.must, zona: 'stalla' });
    },
    pesca_fase: function (s, f) {
      s.stack.pop();
      s.phase = 'pesca';
      if (f.ruba != null && f.ruba >= 0 && mano(s, f.ruba).length) {
        s.stack.push({ k: 'pesca_mano', da: f.ruba, p: s.turn, e: 0, turno: 0 });
        return;
      }
      var c = pesca1(s, s.turn);
      pushLog(s, { t: 'pesca', s: s.turn, n: c ? 1 : 0 });
    },
    dopo: function (s) {
      s.stack.pop();
      var t = top(s);
      if (s.giocate >= s.maxGiocate && t && t.k === 'azione') s.stack.pop();
    },
    fine_fase: function (s, f) {
      s.phase = 'fine';
      var p = s.turn, h = mano(s, p), k = h.length - limite(s, p);
      if (f.ans) {
        var cs = f.ans.cards; delete f.ans;
        cs.forEach(function (c) { if (dallaMano(s, p, c)) s.discard.push(c); });
        pushLog(s, { t: 'scartate', s: p, cards: cs.slice(), limite: 1 });
        return ok(s);
      }
      if (k > 0) return chiedi(s, f, { kind: 'carte', s: p, opts: h.slice(), n: k, min: k, zona: 'mano', op: 'limite' });
      ok(s);
    },
    prossimo: function (s) {
      s.stack.pop();
      if (s.extra > 0) { s.extra--; return iniziaTurno(s, s.turn, true); }
      var p = (s.turn + 1) % n(s);
      // Pisolino: chi dorme salta il turno (al massimo un giro, così qualcuno gioca sempre)
      for (var g = 0; g < n(s) && s.dorme && s.dorme.indexOf(p) >= 0; g++) {
        s.dorme.splice(s.dorme.indexOf(p), 1);
        pushLog(s, { t: 'dorme', s: p });
        p = (p + 1) % n(s);
      }
      iniziaTurno(s, p);
    }
  };
  function paladino(s, q, c) {
    if (!isUni(c)) return null;
    var t = stalla(s, q);
    for (var i = 0; i < t.length; i++) if (keyOf(t[i]) === 'paladino' && t[i] !== c && attivo(s, q, t[i])) return t[i];
    return null;
  }
  // Come si può salvare la carta: il Paladino si sacrifica al posto di un unicorno distrutto; l'Unicorno Cenere e
  // l'Elisir di lunga vita fanno scartare una carta al suo posto (per un Malus non lo chiediamo: non conviene mai).
  // Chi permette di scartare una carta al posto di perderne un'altra: l'Unicorno Cenere (lui stesso), l'Elisir di
  // lunga vita (sacrificata o distrutta) o la Protezione del drago (solo distrutta). Mai per un Malus.
  function salvaCon(s, f) {
    if (keyOf(f.c) === 'cenere' && attivo(s, f.q, f.c)) return f.c;
    if (kind(f.c) === 'malus') return null;
    return cartaAttiva(s, f.q, 'elisir') || (f.modo === 'distruggi' ? cartaAttiva(s, f.q, 'protezione_drago') : null);
  }
  function salvezze(s, f) {
    var o = [];
    if (f.modo === 'distruggi' && paladino(s, f.q, f.c)) o.push('paladino');
    if (salvaCon(s, f) && mano(s, f.q).length) o.push('scarta');
    // Kit di sopravvivenza: per un unicorno si scartano 2 carte
    if (isUni(f.c) && has(s, f.q, 'kit') && mano(s, f.q).length >= 2) o.push('scarta2');
    return o;
  }
  function scarta(s, w, cards) {
    cards.forEach(function (c) { if (dallaMano(s, w, c)) s.discard.push(c); });
    pushLog(s, { t: 'scartate', s: w, cards: cards.slice() });
    ok(s);
  }
  function prendi(s, f, t, c, how) {
    dallaMano(s, t, c); s.hand[f.p].push(c);
    pushLog(s, { t: 'presa', s: f.p, q: t, c: c, how: how, priv: [f.p, t] });
    ok(s);
  }
  function disponibili(s, p) {
    var opts = [], must = [];
    stalla(s, p).forEach(function (c) {
      var k = keyOf(c);
      if (!INIZIO[k] || s.usati.indexOf(c) >= 0 || !attivo(s, p, c)) return;
      var u = USABILE[k](s, p, c);
      if (OBBLIGO[k]) {
        if (u) { opts.push(c); must.push(c); } else { s.usati.push(c); pushLog(s, { t: 'nulla', s: p, src: c }); }
        return;
      }
      if (u) opts.push(c);
    });
    return { opts: opts, must: must };
  }
  function chiudiInizio(s) {
    s.stack.pop();
    if (s.salta) s.stack = s.stack.filter(function (g) { return g.k !== 'pesca_fase' && g.k !== 'azione'; });
  }
  function iniziaTurno(s, p, ancora) {
    s.turn = p; s.turnNo += 1; s.phase = 'inizio'; s.usati = []; s.salta = false; s.giocate = 0;
    s.maxGiocate = has(s, p, 'doppietta') ? 2 : 1;
    pushLog(s, { t: 'turno', s: p, no: s.turnNo, ancora: !!ancora });
    s.stack.push({ k: 'prossimo', turno: 1 }, { k: 'fine_fase', turno: 1 }, { k: 'azione', turno: 1 }, { k: 'pesca_fase', turno: 1 }, { k: 'inizio', turno: 1 }, { k: 'razzo_check', turno: 1 });
  }
  // Il Monolocale si controlla sempre: chi supera 5 unicorni ne sacrifica uno.
  function monolocale(s) {
    for (var i = 0; i < n(s); i++) {
      var p = (s.turn + i) % n(s), m = cartaAttiva(s, p, 'monolocale');
      if (!m || conta(s, p) <= 5) continue;
      if (s.stack.some(function (g) { return g.mono === p; })) continue;
      if (!opzioni(s, { k: 'sacrifica', p: p, e: 0, filtro: 'unicorno' }).length) continue;
      pushLog(s, { t: 'monolocale', s: p });
      avvia(s, p, m, [{ k: 'sacrifica', filtro: 'unicorno', mono: p }]);
      return true;
    }
    return false;
  }
  // Maleficio: chi ce l'ha e resta senza carte in mano lo passa a un altro giocatore che ne ha.
  function maleficio(s) {
    for (var i = 0; i < n(s); i++) {
      var p = (s.turn + i) % n(s);
      if (mano(s, p).length) continue;
      var m = stalla(s, p).filter(function (c) { var k = keyOf(c); return (k === 'maleficio' || k === 'zainetto') && attivo(s, p, c); })[0];
      if (!m || s.stack.some(function (g) { return g.k === 'passa_maleficio' && g.c === m; })) continue;
      if (!altri(s, p).some(function (q) { return mano(s, q).length && entra(s, m, q); })) continue;
      avvia(s, p, m, [{ k: 'passa_maleficio', c: m }]);
      return true;
    }
    return false;
  }
  function fineCheck(s) {
    if (s.chain.length) return false;
    for (var i = 0; i < n(s); i++) {
      var p = (s.turn + i) % n(s);
      if (conta(s, p) >= s.goal && puoVincere(s, p)) { fine(s, [p], 'unicorni'); return true; }
    }
    if (s.vuoto) { fineMazzo(s); return true; }
    return false;
  }
  function fine(s, winners, why) {
    var conti = [], lett = [];
    for (var p = 0; p < n(s); p++) { conti.push(conta(s, p)); lett.push(lettere(s, p)); }
    s.status = 'gameOver'; s.phase = 'over'; s.prompt = null; s.stack = []; s.queue = []; s.chain = [];
    s.result = { winners: winners, why: why, conti: conti, lettere: lett, turns: s.turnNo };
    pushLog(s, { t: 'vince', winners: winners, why: why });
  }
  function fineMazzo(s) {
    var c = [], p;
    for (p = 0; p < n(s); p++) c.push(puoVincere(s, p) ? conta(s, p) : -1);
    var max = Math.max.apply(null, c), best = [];
    if (max < 0) return fine(s, [], 'pari');
    for (p = 0; p < n(s); p++) if (c[p] === max) best.push(p);
    if (best.length === 1) return fine(s, best, 'mazzo');
    var l = best.map(function (q) { return lettere(s, q); }), ml = Math.max.apply(null, l);
    var b2 = best.filter(function (q, i) { return l[i] === ml; });
    fine(s, b2.length === 1 ? b2 : [], b2.length === 1 ? 'lettere' : 'pari');
  }

  function step(s) {
    var f = top(s), h = OPS[f.k];
    if (!h) { s.stack.pop(); return; }
    h(s, f);
  }
  function run(s) {
    var guard = 0;
    while (s.status === 'playing' && !s.prompt && guard++ < 5000) {
      if (monolocale(s) || maleficio(s)) continue;
      var f = top(s);
      if (!f) {
        if (s.queue.length) { flush(s); continue; }
        if (!fineCheck(s)) iniziaTurno(s, (s.turn + 1) % n(s));
        continue;
      }
      if (f.turno) {
        if (s.queue.length) { flush(s); continue; }
        if (fineCheck(s)) break;
        if (f.k === 'azione') { s.phase = 'azione'; break; }
      }
      step(s);
    }
  }

  /* ---------- partita ---------- */
  function newGame(opts) {
    opts = opts || {};
    var now = Date.now(), names = opts.names || [opts.name || ''];
    return {
      app: 'stalla', schema: 1, v: 1, nonce: '', createdAt: now, updatedAt: now,
      mode: opts.local ? 'local' : 'online', status: 'waiting',
      seats: names.map(function (nm, i) { return { keys: (i === 0 && opts.key) ? [opts.key] : [], name: String(nm || '').slice(0, 20) }; }),
      host: 0, bots: {}, exp: espansioni(opts.exp), goal: 7,
      deck: [], discard: [], nursery: [], box: [], hand: {}, stable: {},
      turn: 0, turnNo: 0, phase: 'wait', giocate: 0, maxGiocate: 1, usati: [], salta: false, extra: 0, vuoto: false, dorme: [],
      chain: [], inGioco: null, stack: [], queue: [], ctx: {}, eid: 0, pid: 0, prompt: null,
      log: [], logN: 0, result: null
    };
  }
  function setup(s) {
    var k = n(s), p;
    s.exp = espansioni(s.exp);
    s.goal = k >= 6 ? 6 : 7;
    s.nursery = shuffle(nidoPer(s.exp));
    s.deck = shuffle(mazzoPer(s.exp, k));
    s.discard = []; s.box = []; s.hand = {}; s.stable = {};
    for (p = 0; p < k; p++) { s.hand[p] = []; s.stable[p] = [s.nursery.pop()]; }
    if (k === 2) {
      for (p = 0; p < k; p++) {
        for (var i = s.deck.length - 1; i >= 0; i--) if (keyOf(s.deck[i]) === 'nitrito') { s.hand[p].push(s.deck.splice(i, 1)[0]); break; }
      }
    }
    for (p = 0; p < k; p++) pescaN(s, p, MANO_INIZIO);
    s.status = 'playing'; s.result = null; s.log = []; s.logN = 0; s.turnNo = 0;
    s.stack = []; s.queue = []; s.chain = []; s.ctx = {}; s.eid = 0; s.prompt = null;
    s.vuoto = false; s.extra = 0; s.inGioco = null; s.dorme = [];
    iniziaTurno(s, randInt(k));
    run(s);
    return s;
  }
  function startGame(state) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length < MIN_PLAYERS) return { ok: false, error: 'Servono almeno ' + MIN_PLAYERS + ' giocatori (anche bot).' };
    var s = clone(state);
    setup(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function startLocal(names, exp) { var s = newGame({ local: true, names: names, exp: exp }); return setup(s); }
  function startBots(names, level, exp) {
    var s = newGame({ local: true, names: names, exp: exp });
    s.mode = 'bot';
    for (var i = 1; i < names.length; i++) s.bots[i] = level;
    return setup(s);
  }
  function rematch(state) {
    if (!state || state.status !== 'gameOver') return { ok: false, error: 'La partita non è finita.' };
    var s = clone(state);
    setup(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function setExp(state, list) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    var s = clone(state);
    s.exp = espansioni(list);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function join(state, key, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length >= MAX_PLAYERS) return { ok: false, error: 'Il tavolo è pieno (' + MAX_PLAYERS + ' giocatori).' };
    if (seatOf(state, key) >= 0) return { ok: false, error: 'Sei già seduto.' };
    var s = clone(state);
    s.seats.push({ keys: key ? [key] : [], name: String(name || '').slice(0, 20) });
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function addBot(state, level, name) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (state.seats.length >= MAX_PLAYERS) return { ok: false, error: 'Il tavolo è pieno.' };
    var s = clone(state);
    s.seats.push({ keys: [], name: String(name || 'Bot').slice(0, 20) });
    s.bots = s.bots || {};
    s.bots[s.seats.length - 1] = level;
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function removeBot(state, seat) {
    if (!state || state.status !== 'waiting') return { ok: false, error: 'La partita è già cominciata.' };
    if (!state.bots || !state.bots[seat]) return { ok: false, error: 'Non è un bot.' };
    var s = clone(state), bots = {};
    s.seats.splice(seat, 1);
    Object.keys(state.bots).forEach(function (k) { var i = +k; if (i !== seat) bots[i > seat ? i - 1 : i] = state.bots[k]; });
    s.bots = bots;
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
  function hnum(s, p) { return (s.seats[p] && s.seats[p].name) || ('Giocatore ' + (p + 1)); }
  function bersagli(s, p, c) {
    var t = kind(c), out = [];
    if (t !== 'bonus' && t !== 'malus') return out;
    if (t === 'bonus' && has(s, p, 'pericolante')) return out;
    for (var q = 0; q < n(s); q++) if (entra(s, c, q)) out.push(q);
    return out;
  }
  // Perché questa carta non si può giocare adesso (null se si può).
  function playError(s, p, m) {
    var c = m.card;
    if (mano(s, p).indexOf(c) < 0) return 'Non hai questa carta in mano.';
    if (s.giocate >= s.maxGiocate) return 'In questo turno hai già giocato.';
    var t = kind(c), key = keyOf(c);
    if (t === 'istante') return isNeigh(c) ? 'Il Nitrito si gioca solo per fermare la carta di un altro giocatore.' : 'Questa istantanea si gioca solo nel momento che dice la carta.';
    if (t === 'semplice' || t === 'magico') return entra(s, c, p) ? null : 'Un altro giocatore ha la Reginetta: gli unicorni semplici non entrano nella tua stalla.';
    if (t === 'bonus' && has(s, p, 'pericolante')) return 'Con la Stalla pericolante non puoi giocare Bonus.';
    if (t === 'bonus' || t === 'malus') {
      if (typeof m.to !== 'number' || m.to < 0 || m.to >= n(s) || m.to !== Math.floor(m.to)) return 'Scegli in quale stalla metterla.';
      return entra(s, c, m.to) ? null : 'Il Cerchio di sale non lascia entrare Malus in quella stalla.';
    }
    if (t === 'magia') return REQ[key] ? REQ[key](s, p) : null;
    return 'Questa carta non si può giocare.';
  }
  function answerError(s, seat, m) {
    var P = s.prompt, cs = m.cards, i;
    if (m.pid != null && m.pid !== P.id) return 'Nel frattempo la situazione è cambiata.';
    switch (P.kind) {
      case 'carte':
        if (m.skip) return P.may ? null : 'Qui devi scegliere.';
        if (!Array.isArray(cs) || !uniq(cs) || cs.length < P.min || cs.length > P.n) return P.n === 1 ? 'Scegli una carta.' : 'Scegli ' + P.n + ' carte.';
        for (i = 0; i < cs.length; i++) if (P.opts.indexOf(cs[i]) < 0) return 'Questa carta non si può scegliere.';
        return null;
      case 'giocatore':
        if (m.skip) return P.may ? null : 'Scegli un giocatore.';
        return P.opts.indexOf(m.target) >= 0 ? null : 'Scegli uno dei giocatori indicati.';
      case 'scelta': return P.opts.indexOf(m.pick) >= 0 ? null : 'Scegli una delle possibilità.';
      case 'opzione':
        if (m.skip) return P.may ? null : 'Qui devi scegliere.';
        return P.opts.indexOf(m.pick) >= 0 ? null : 'Scegli una delle possibilità.';
      case 'vedi': return null;
      case 'giocatori': {
        var ts = m.targets;
        if (!Array.isArray(ts) || !uniq(ts) || ts.length < (P.min || 0)) return 'Scegli i giocatori.';
        for (i = 0; i < ts.length; i++) if (P.opts.indexOf(ts[i]) < 0) return 'Scegli tra i giocatori indicati.';
        return null;
      }
      case 'reazione':
        if (m.pass) return null;
        if (!Array.isArray(cs) || cs.length !== 1 || mano(s, seat).indexOf(cs[0]) < 0 || def(cs[0]).rea !== P.tipo) return 'Non è una carta che puoi giocare adesso.';
        return nitrisce(s, seat) ? null : 'Adesso non puoi giocare istantanee.';
      case 'si': return typeof m.yes === 'boolean' ? null : 'Rispondi sì o no.';
      case 'nitrito':
        if (m.pass) return null;
        if (!Array.isArray(cs) || cs.length !== 1) return 'Scegli un Nitrito.';
        if (mano(s, seat).indexOf(cs[0]) < 0 || !isNeigh(cs[0])) return 'Non è un Nitrito della tua mano.';
        return nitrisce(s, seat) ? null : 'Adesso non puoi giocare Nitriti.';
      case 'ogni':
        if (!Array.isArray(cs) || cs.length !== 1) return 'Scegli una carta.';
        return ((P.opts || {})[seat] || []).indexOf(cs[0]) >= 0 ? null : 'Questa carta non si può scegliere.';
    }
    return 'Risposta non valida.';
  }
  function validate(s, seat, m) {
    if (!s || s.status !== 'playing') return 'La partita non è in corso.';
    if (!m || typeof m !== 'object') return 'Mossa non valida.';
    if (typeof seat !== 'number' || seat < 0 || seat >= n(s)) return 'Non sei seduto al tavolo.';
    var P = s.prompt;
    if (m.type === 'answer') {
      if (!P) return 'Non c\'è niente da decidere.';
      if (P.wait ? P.wait.indexOf(seat) < 0 : P.s !== seat) return 'Deve decidere un altro giocatore.';
      return answerError(s, seat, m);
    }
    if (P) return 'Aspetta la scelta di ' + hnum(s, P.s) + '.';
    var f = top(s);
    if (seat !== s.turn || !f || f.k !== 'azione') return 'Non è il tuo turno.';
    switch (m.type) {
      case 'play': return playError(s, seat, m);
      case 'draw': return s.giocate ? 'Hai già giocato una carta: adesso non puoi pescare.' : null;
      case 'end': return null;
    }
    return 'Mossa sconosciuta.';
  }
  function answer(s, seat, m) {
    var P = s.prompt, f = top(s), i;
    if (P.kind === 'nitrito') {
      if (m.pass) {
        P.wait.splice(P.wait.indexOf(seat), 1);
        if (P.wait.length) P.s = P.wait[0]; else s.prompt = null;
        return;
      }
      var c = m.cards[0];
      dallaMano(s, seat, c);
      s.chain.push({ c: c, p: seat });
      pushLog(s, { t: 'nitrito', s: seat, c: c, on: P.on, by: P.by });
      s.prompt = null; f.aperta = false;
      return;
    }
    if (P.kind === 'reazione') {
      if (m.pass) {
        P.wait.splice(P.wait.indexOf(seat), 1);
        if (P.wait.length) P.s = P.wait[0]; else s.prompt = null;
        return;
      }
      // la carta va subito nella catena (così non resta mai «in aria»)
      dallaMano(s, seat, m.cards[0]);
      s.chain = [{ c: m.cards[0], p: seat, to: seat, rea: { tipo: f.tipo, c: f.c || null, q: f.q, by: f.by, fid: f.fid } }];
      f.giocata = seat;
      s.prompt = null;
      return;
    }
    if (P.kind === 'ogni') {
      f.got[seat] = m.cards[0];
      i = P.wait.indexOf(seat); P.wait.splice(i, 1);
      if (P.wait.length) P.s = P.wait[0]; else s.prompt = null;
      return;
    }
    f.ans = { cards: m.cards, skip: !!m.skip, target: m.target, pick: m.pick, yes: m.yes, targets: m.targets };
    s.prompt = null;
  }
  function gioca(s, p, m) {
    var c = m.card, t = kind(c);
    dallaMano(s, p, c);
    s.giocate += 1;
    var to = (t === 'bonus' || t === 'malus') ? m.to : p;
    s.chain = [{ c: c, p: p, to: to }];
    pushLog(s, { t: 'gioca', s: p, c: c, to: to });
    s.stack.push({ k: 'dopo', turno: 1 }, { k: 'risolvi' }, { k: 'finestra' });
    if (t === 'magia' && has(s, p, 'colpo_critico')) s.stack.push({ k: 'critico', p: p, e: 0 });
  }
  // Giocare subito una Magia dalla mano (Unicorno Mago, Colpo critico): si può fermare con un Nitrito ma non conta
  // come la carta del turno. Se adesso non si può giocare, resta in mano.
  function subito(s, p, c) {
    var err = REQ[keyOf(c)] ? REQ[keyOf(c)](s, p) : null;
    if (err || mano(s, p).indexOf(c) < 0) { pushLog(s, { t: 'resta', s: p, c: c }); return; }
    dallaMano(s, p, c);
    s.chain = [{ c: c, p: p, to: p }];
    pushLog(s, { t: 'gioca', s: p, c: c, to: p, subito: 1 });
    s.stack.push({ k: 'risolvi' }, { k: 'finestra' });
    if (has(s, p, 'colpo_critico')) s.stack.push({ k: 'critico', p: p, e: 0 });
  }
  function act(state, seat, m) {
    var err = validate(state, seat, m);
    if (err) return { ok: false, error: err };
    var s = clone(state);
    switch (m.type) {
      case 'answer': answer(s, seat, m); break;
      case 'play': gioca(s, seat, m); break;
      case 'draw': {
        var c = pesca1(s, seat);
        pushLog(s, { t: 'pesca', s: seat, n: c ? 1 : 0, azione: 1 });
        s.giocate = s.maxGiocate;
        s.stack.pop();
        break;
      }
      case 'end': pushLog(s, { t: 'passa', s: seat }); s.stack.pop(); break;
    }
    run(s);
    touch(s, state.v);
    return { ok: true, state: s };
  }
  function nextActor(s) {
    if (!s || s.status !== 'playing') return -1;
    if (s.prompt) return s.prompt.wait ? (s.prompt.wait[0] == null ? -1 : s.prompt.wait[0]) : s.prompt.s;
    var f = top(s);
    return f && f.k === 'azione' ? s.turn : -1;
  }
  function waitingFor(s) {
    if (s && s.status === 'playing' && s.prompt && s.prompt.wait) return s.prompt.wait.slice();
    var a = nextActor(s);
    return a >= 0 ? [a] : [];
  }
  function promptFor(s, seat) {
    var P = s && s.status === 'playing' ? s.prompt : null;
    if (!P) return null;
    return (P.wait ? P.wait.indexOf(seat) >= 0 : P.s === seat) ? P : null;
  }

  // Le mosse possibili (per i test e per i bot): per le carte con più scelte, alcune combinazioni.
  function legalMoves(s, p) {
    var out = [], P = promptFor(s, p), i;
    if (!s || s.status !== 'playing') return out;
    if (s.prompt) {
      if (!P) return out;
      var base = function (x) { x.type = 'answer'; x.pid = P.id; return x; };
      switch (P.kind) {
        case 'carte':
          if (P.may) out.push(base({ skip: true }));
          if (P.n === 1) P.opts.forEach(function (c) { out.push(base({ cards: [c] })); });
          else if (P.min != null && P.min < P.n) P.opts.forEach(function (c) { out.push(base({ cards: P.opts.slice(0, Math.max(1, P.min) - 1).filter(function (x) { return x !== c; }).concat([c]) })); });
          else {
            out.push(base({ cards: P.opts.slice(0, P.n) }));
            if (P.opts.length > P.n) out.push(base({ cards: P.opts.slice(P.opts.length - P.n) }));
          }
          break;
        case 'giocatore':
          if (P.may) out.push(base({ skip: true }));
          P.opts.forEach(function (q) { out.push(base({ target: q })); });
          break;
        case 'scelta': P.opts.forEach(function (x) { out.push(base({ pick: x })); }); break;
        case 'opzione':
          if (P.may) out.push(base({ skip: true }));
          P.opts.forEach(function (x) { out.push(base({ pick: x })); });
          break;
        case 'vedi': out.push(base({ yes: true })); break;
        case 'giocatori':
          out.push(base({ targets: [] }), base({ targets: [p] }), base({ targets: P.opts.slice() }));
          break;
        case 'reazione':
          out.push(base({ pass: true }));
          if (nitrisce(s, p)) mano(s, p).forEach(function (c) { if (def(c).rea === P.tipo) out.push(base({ cards: [c] })); });
          break;
        case 'si': out.push(base({ yes: true }), base({ yes: false })); break;
        case 'nitrito':
          out.push(base({ pass: true }));
          if (nitrisce(s, p)) mano(s, p).forEach(function (c) { if (isNeigh(c)) out.push(base({ cards: [c] })); });
          break;
        case 'ogni': (P.opts[p] || []).forEach(function (c) { out.push(base({ cards: [c] })); }); break;
      }
      return out;
    }
    if (nextActor(s) !== p) return out;
    mano(s, p).forEach(function (c) {
      var t = kind(c);
      if (t === 'bonus' || t === 'malus') {
        for (i = 0; i < n(s); i++) if (!playError(s, p, { card: c, to: i })) out.push({ type: 'play', card: c, to: i });
      } else if (!playError(s, p, { card: c })) out.push({ type: 'play', card: c });
    });
    if (!s.giocate) out.push({ type: 'draw' });
    out.push({ type: 'end' });
    return out;
  }

  var api = {
    CARTE: CARTE, TYPES: TYPES, META: META, ALL: ALL, TIPI: TIPI, ESPANSIONI: ESPANSIONI, VIA_IN_DUE: VIA_IN_DUE,
    MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, MANO_MAX: MANO_MAX,
    keyOf: keyOf, def: def, kind: kind, isUni: isUni, isNeigh: isNeigh, attivo: attivo, has: has, panda: panda,
    conta: conta, lettere: lettere, entra: entra, distruggibile: distruggibile, nitrisce: nitrisce, reattivi: reattivi,
    salda: salda, sacrificabile: sacrificabile, puoVincere: puoVincere, limite: limite, filtra: filtra, expDi: expDi,
    vedeMano: vedeMano, padrone: padrone, bersagli: bersagli, opzioni: opzioni, mazzoPer: mazzoPer, nidoPer: nidoPer,
    newGame: newGame, startGame: startGame, startLocal: startLocal, startBots: startBots, rematch: rematch, setExp: setExp,
    join: join, addBot: addBot, removeBot: removeBot, seatOf: seatOf, addSeatKey: addSeatKey,
    validate: validate, playError: playError, act: act, nextActor: nextActor, waitingFor: waitingFor, promptFor: promptFor,
    legalMoves: legalMoves, clone: clone, randInt: randInt, shuffle: shuffle, _setRng: function (f) { rng = f; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StallaMatta = api;
})(typeof window !== 'undefined' ? window : this);
