# Sala giochi

Giochi da tavolo da fare online con gli amici, pubblicati con GitHub Pages:
https://ginotoretti114-ops.github.io/giochi/

## Giochi

- **Gran Bazar** (`gran-bazar/`): gioco di carte per due mercanti. Si gioca online
  (chi crea la partita manda il link all'altro) oppure passandosi lo stesso telefono.
- **Sottozero** (`sottozero/`): da 2 a 8 giocatori, ognuno con una griglia di carte coperte da
  scambiare e scoprire; vince chi, dopo i round scelti (3, 5 o 9), ha meno punti. Online o sullo stesso telefono.
- **Piccante** (`piccante/`): gioco a prese da 2 a 8 giocatori con scommessa. Ogni presa sbagliata è un
  peperoncino; ogni round una delle 40 missioni cambia le regole. Online (ognuno vede solo le sue carte) o sullo
  stesso telefono, che dice a chi passarlo prima di mostrare le carte.
- **Diavolerie** (`diavolerie/`): da 2 a 5 giocatori, carte e dadi. Si raccolgono anime, si comprano bambini
  e animali dal Quartiere e si spengono per evocare demoni: vince chi ha 3 demoni e 10 anime. Online, sullo
  stesso telefono (l'unica cosa segreta sono i demoni in mano) o contro il computer: da 1 a 4 bot, livello
  facile, medio o difficile.
- **Sette Stelle** (`sette-stelle/`): da 2 a 8 giocatori, «pesca o fermati». Si pescano stelle numerate da 0 a 12:
  con un doppione si sballa, con sette numeri diversi si chiude il round con 15 punti in più; vince chi arriva a 200.
  Online (con bot per riempire il tavolo), sullo stesso telefono o contro il computer (da 1 a 5 bot).
- **Polvere e Piombo** (`polvere-e-piombo/`): da 4 a 7 giocatori, western a ruoli segreti: Sceriffo e Vice contro
  Fuorilegge, più un Rinnegato. 80 carte con valore e seme (per «Estrai!»), 16 personaggi, distanze e armi.
  Online (ognuno vede solo ruolo e carte sue; i bot completano il tavolo), sullo stesso telefono (che dice a chi
  passarlo) o contro il computer (da 3 a 6 bot).
- **Stalla Matta** (`stalla-matta/`): da 2 a 8 giocatori, carte con unicorni: vince chi ne ha 7 nella stalla (6 da
  6 giocatori in su), tra Magie, Bonus, Malus e Nitriti che fermano le carte degli altri. Mazzo base completo (127
  carte) e le cinque espansioni da accendere nella lobby: Brutti sogni (53 carte), Miti e leggende (54), Avventure
  (54), Draghi (54) e Diluvio arcobaleno (54).
  Online, sullo stesso telefono o contro il computer (da 1 a 5 bot).

Tutte le pagine hanno musica di sottofondo ed effetti sonori, con un pulsante per scegliere tra musica ed
effetti, solo effetti o niente (la scelta vale per tutti i giochi).

Ogni giocatore ha un profilo nella pagina iniziale: le partite finite danno esperienza e fanno salire di livello
(di più se si vince, contro persone o contro il computer al livello difficile), ci sono 31 medaglie da sbloccare e
ogni giorno tre sfide nuove, uguali per tutti. Alla fine di una partita un avviso mostra cosa si è guadagnato.
Senza account i progressi restano nel browser (`lib/profilo.js`). Con un account (accesso con Google o con un
link via email, `lib/conti.js` su Supabase) sono salvati nell'account e uguali su tutti i dispositivi; si possono
eliminare in ogni momento. Cosa viene salvato e dove è spiegato in `privacy.html`.

C'è anche un sito di prova, https://ginotoretti114-ops.github.io/giochi/prova/, dove le novità arrivano prima che
sul sito vero: ha una striscia rosa con la scritta PROVA, le sue partite online e la sua memoria del browser, così
le prove non toccano le partite vere. Quando le novità vanno bene passano al sito vero (`strumenti/prova.sh`).

Le pagine si adattano allo schermo. Sul telefono (sotto i 1000 pixel di larghezza) tutto sta in una colonna, con le
mosse in basso a portata di pollice. Sul computer (o su un tablet in orizzontale) la lobby e il tavolo si dividono
in due colonne: a sinistra quello che è di tutti (avversari, mercato, dadi, carte in tavola, cronaca), a destra lo
stato del turno, la tua zona e le mosse, che restano ferme mentre scorri; i fogli (regole, punti, dettagli delle
carte) si aprono come finestre al centro e il passaggio del mouse evidenzia i pulsanti. Se cambi la larghezza della
finestra la pagina passa da una disposizione all'altra senza ricaricare.

## Com'è fatto

- `index.html`: la pagina iniziale con l'elenco dei giochi (array `GIOCHI` in fondo alla pagina).
- `lib/`: librerie condivise tra i giochi: `mqtt.min.js` (mqtt.js 5.16.1, licenza MIT), `stanze.js`,
  che gestisce le partite online (stato condiviso, server, salvataggio nel browser), e `suoni.js`, la musica
  (generata al momento con Web Audio, nessun file audio) e gli effetti sonori.
- una cartella per ogni gioco, con dentro il suo `index.html`, una `copertina.svg` (600×360) e i suoi file.
- disposizione per computer: in ogni gioco `isWide()` (media query `min-width: 1000px`) fa costruire a `lobbyHTML` e
  `boardHTML` un `<div class="desk">` con `.col-l` e `.col-r`; le regole CSS stanno nei blocchi
  `@media (min-width: 1000px)` in fondo allo stile. Le due disposizioni usano gli stessi id e gli stessi `data-act`.

Non c'è niente da compilare: quello che finisce sul ramo `main` va online da solo in un paio di minuti.

## Aggiungere un gioco

1. Crea una cartella, per esempio `nuovo-gioco/`, con dentro `index.html` e `copertina.svg`.
2. Aggiungi una voce all'array `GIOCHI` in `index.html`.
3. Tutti i giochi stanno sullo stesso sito, quindi condividono la memoria del browser:
   - usa un prefisso tuo per `localStorage` (Gran Bazar usa `gb-…`, Sottozero `sz-…`, Piccante `pc-…`,
     Diavolerie `dv-…`, Sette Stelle `ss-…`, Polvere e Piombo `pp-…`, Stalla Matta `sm-…`; la scelta dell'audio è `sala-audio`, comune a tutti);
   - per l'online usa argomenti MQTT tuoi (Gran Bazar usa `granbazar/v1/<partita>/state`, Sottozero `sottozero/v1/…`,
     Piccante `piccante/v1/…`, Diavolerie `diavolerie/v1/…`, Sette Stelle `settestelle/v1/…`, Polvere e Piombo `polvereepiombo/v1/…`,
     Stalla Matta `stallamatta/v1/…`).
4. Per un gioco online a turni conviene partire da `lib/stanze.js`, come fa Sottozero.
5. Per i suoni includi `../lib/suoni.js`, scegli la musica con `Suoni.tema('nome')` (temi: `sala`, `bazar`,
   `sottozero`, `piccante`, `diavolerie`, `settestelle`, `polvere`, `stalla`; per aggiungerne uno basta una voce in `THEMES`), metti il pulsante con
   `Suoni.bottone()` e suona gli effetti con `Suoni.effetto('carta')` o `Suoni.sequenza([...])`
   (effetti: `click`, `carta`, `mescola`, `dadi`, `anima`, `moneta`, `compra`, `evoca`, `ruba`, `scarta`, `turno`,
   `vittoria`, `errore`, `punti`, `fuoco`). I browser fanno partire l'audio solo dopo il primo tocco sulla pagina.

## Come funziona l'online di Gran Bazar

Ogni partita è un documento JSON con un numero di versione (`v`) e un `nonce`.
A ogni mossa il gioco pubblica lo stato intero come messaggio *retained* su due server
MQTT pubblici e gratuiti (HiveMQ `wss://broker.hivemq.com:8884/mqtt` ed EMQX
`wss://broker.emqx.io:8084/mqtt`) e lo salva anche nel browser. Vince sempre la versione
più alta (a pari versione, il nonce più alto). Quando un server si ricollega, il gioco gli
rimanda le versioni più recenti che conosce, così i due server si riallineano da soli.

I server sono pubblici: chi conosce il codice della partita può leggerla. Per questo nelle
partite ci sono solo i nomi scelti dai giocatori e le carte.

Le regole stanno in `gran-bazar/motore.js`, `sottozero/motore.js`, `piccante/motore.js` e `diavolerie/motore.js`
(codice puro, senza interfaccia). Sottozero, Piccante e Diavolerie usano lo stesso schema tramite `lib/stanze.js`. Nota: i punti delle carte azione di Sottozero
(oggi 10 ciascuna) sono in `ACTION_VALUE` dentro `sottozero/motore.js`.

In Piccante alcune mosse si fanno tutti insieme (passare carte, scegliere il compagno, giocare in contemporanea):
se due giocatori pubblicano nello stesso istante una delle due versioni si perde, e chi non ritrova la sua scelta
nello stato arrivato la riapplica e ripubblica da solo. Le 40 missioni sono in `MISSIONS` dentro `piccante/motore.js`:
il regolamento ne descrive gli effetti ma non il contenuto carta per carta (carte da distribuire, carte da passare,
numero vietato, numeri piccanti), quindi quei valori sono ricostruiti e si possono correggere lì.

In Diavolerie le carte sono in `BLOCK`, `DEMONS` e `CANDLES` dentro `diavolerie/motore.js` (numero da tirare, copie,
effetto); i testi delle carte li scrive `text()`. L'elenco completo delle carte originali non è pubblico: gli effetti
vengono dal regolamento, dalle recensioni e dalle domande dei giocatori, con nomi e disegni nuovi. Il campo `o` dice
quanto è fedele ogni carta: `2` numero ed effetto come nell'originale, `1` effetto originale ma numero o dettaglio
ricostruiti, assente carta ricostruita nello stesso spirito. Il mazzo rispetta la composizione originale
(32 animali, tutti col 7; 34 bambine e 34 bambini, ognuno con 12 dolci, 12 pesti e 10 né l'uno né l'altro).
Quando un tiro attiva più carte dello stesso giocatore, il gioco le attiva nell'ordine più utile invece di farlo scegliere.

I giocatori del computer di Diavolerie sono in `diavolerie/bot.js`: `DiavolerieBot.mossa(stato, posto, livello)`
restituisce una mossa per il motore. Il facile sceglie quasi a caso; il medio dà un valore in anime a ogni carta
(effetto per probabilità del numero) e spegne quelle che valgono meno; il difficile in più tiene da parte le anime
per vincere, colpisce chi è in testa e ritira i dadi quando conviene. Le partite contro il computer restano nel
browser (`dv-bot`) e non passano dai server.

## Sette Stelle e Polvere e Piombo

Seguono le regole dei giochi originali con nomi e grafica nuovi. In Sette Stelle il mazzo è quello originale
(94 carte: 79 numeri, 6 bonus, 9 azioni); l'unica scelta nostra è che, se due giocatori sono in testa a pari punti
sopra i 200, si gioca un altro round. In Polvere e Piombo le 80 carte hanno lo stesso valore e seme delle originali,
così «Estrai!» ha le stesse probabilità (cuori per Botte e Galera, dal 2 al 9 di picche per il Candelotto);
le decisioni durante il turno degli altri (schivare, la Sfida, i Bisonti, il Mercato, restare in vita) passano
da un `prompt` per volta, e chi deve rispondere è `nextActor`.

Entrambi hanno i bot in `bot.js` (`SetteStelleBot` e `PolvereBot`, livelli `facile`, `medio`, `difficile`), che giocano
sia contro il computer sia nelle partite online: nella sala d'attesa chi crea la partita può aggiungere bot, e durante
la partita li muove il suo telefono (se non c'è, dopo qualche secondo ci pensano gli altri giocatori seduti).
I bot di Polvere e Piombo usano solo quello che vedrebbe un giocatore: il proprio ruolo e le proprie carte, lo Sceriffo,
i ruoli dei morti e una «reputazione» pubblica (`rep`) che il motore aggiorna quando qualcuno attacca qualcun altro.

## Stalla Matta

Segue il mazzo base della seconda edizione dell'originale (114 carte e 13 cuccioli), con nomi e grafica nuovi; il
campo `o` delle carte dice che testo e numero di copie sono quelli originali. Le espansioni stanno in `ESPANSIONI`
(`pronta: false` finché non ci sono le carte) e le carte nuove si aggiungono a `CARTE` con il loro `exp`: la lobby,
la sala d'attesa e il foglio delle regole le mostrano da sole. Pronta: Brutti sogni (`incubi`, 50 carte e 3 cuccioli),
che porta le carte tolte dal gioco (`s.box`), gli Incubi (Malus con `inc`), il Nitrito maledetto e le carte che non si
sacrificano né si distruggono (`salda`). Pronta anche Miti e leggende (`leggende`, 50 carte e 4 cuccioli): le Magie
giocate subito (`subito`: Unicorno Mago, Colpo critico), i Nitriti con un effetto, il Maleficio che passa di mano, la
Pace divina e il Cavaliere senza macchia. Pronta anche Avventure (`avventure`, 50 carte e 4 cuccioli): le carte
«scegli: … oppure …» (passo `oppure`, domanda `opzione`), le istantanee che non sono Nitriti (`rea`: Canna da pesca
quando qualcuno ruba, Rete quando sacrifica o distrugge, Razzo all'inizio del turno di un altro; domanda `reazione`
solo a chi ce l'ha, e gli altri vedono «Un momento»), lo Zainetto che passa di mano e la Macchia nera. Pronta
anche Draghi (`draghi`, 48 carte e 6 cuccioli): le carte con «drago» nel nome (filtro `drago`, come «Dragon»
nell'originale), l'Unicorno Ammazzadraghi (`distruggibile` guarda la carta che distrugge), la Benedizione del drago
(`attivo` spegne i Malus), l'Unicorno Drago che scatta ogni volta che lascia la stalla (`LASCIA`, in `togli`) e le
carte in fondo al mazzo. Tre carte hanno il numero di copie ricostruito (`o: 1`), con le 54 carte della scatola.
Pronta anche Diluvio arcobaleno (`diluvio`, 52 carte e 2 cuccioli): 8 sono altre copie di quattro carte del mazzo
base, scritte nel campo `copie` della carta (`expDi` dice da quale espansione arriva ogni copia); poi le sette Magie
dell'apocalisse (`APOCALISSE`), la Principessa Arcobaleno (domanda `giocatori`, più giocatori insieme), il Pisolino
(`s.dorme`, guardato da `prossimo`) e i limiti della mano di Carestia e Zoccoletti (`limite`).
In due, oltre agli unicorni semplici, si tolgono le carte di `VIA_IN_DUE`. Gli effetti sono passi su una pila (`stack`) con un `prompt` per volta; il Nitrito
e gli effetti «ogni giocatore» chiedono a più giocatori insieme (`prompt.wait`), e online ognuno risponde dal suo
telefono (se due risposte si incrociano, la pagina rimanda la propria). Chi non ha Nitriti lascia passare da solo,
dopo una pausa a caso. I bot (`StallaBot`) usano solo quello che si vede al tavolo e la propria mano.

## Collaudo

```
node gran-bazar/test/motore.test.js            # scenari di regole + 500 partite simulate
node sottozero/test/motore.test.js             # scenari di regole + 300 partite da 2 a 8 giocatori
node piccante/test/motore.test.js              # scenari di regole e missioni + 300 partite da 2 a 8 giocatori
node diavolerie/test/motore.test.js            # scenari di carte e demoni + 300 partite da 2 a 5 giocatori
node diavolerie/test/bot.test.js               # sfide tra i livelli dei bot: il più forte deve vincere più spesso
node sette-stelle/test/motore.test.js          # scenari di regole + 400 partite da 2 a 8 giocatori
node sette-stelle/test/bot.test.js             # i bot dei tre livelli uno contro l'altro
node polvere-e-piombo/test/motore.test.js      # ruoli, distanze, carte e personaggi + 300 partite da 4 a 7 giocatori
node polvere-e-piombo/test/bot.test.js         # i bot dei tre livelli: vittorie per posto, ruoli a caso
node stalla-matta/test/motore.test.js          # una prova per ogni carta + 350 partite da 2 a 8 giocatori (base e con espansioni)
node stalla-matta/test/bot.test.js             # i bot dei tre livelli uno contro l'altro, col mazzo base e con le espansioni
PARTITE=3000 node gran-bazar/test/motore.test.js
```
