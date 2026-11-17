# Sala giochi

Giochi da tavolo da fare online con gli amici, pubblicati con GitHub Pages:
https://ginotoretti114-ops.github.io/giochi/

## Giochi

- **Gran Bazar** (`gran-bazar/`): gioco di carte per due mercanti. Si gioca online
  (chi crea la partita manda il link all'altro) oppure passandosi lo stesso telefono.
- **Sottozero** (`sottozero/`): da 2 a 8 giocatori, ognuno con una griglia di carte coperte da
  scambiare e scoprire; vince chi, dopo i round scelti (3, 5 o 9), ha meno punti. Online o sullo stesso telefono.

## Com'è fatto

- `index.html`: la pagina iniziale con l'elenco dei giochi (array `GIOCHI` in fondo alla pagina).
- `lib/`: librerie condivise tra i giochi: `mqtt.min.js` (mqtt.js 5.16.1, licenza MIT) e `stanze.js`,
  che gestisce le partite online (stato condiviso, server, salvataggio nel browser).
- una cartella per ogni gioco, con dentro il suo `index.html`, una `copertina.svg` (600×360) e i suoi file.

Non c'è niente da compilare: quello che finisce sul ramo `main` va online da solo in un paio di minuti.

## Aggiungere un gioco

1. Crea una cartella, per esempio `nuovo-gioco/`, con dentro `index.html` e `copertina.svg`.
2. Aggiungi una voce all'array `GIOCHI` in `index.html`.
3. Tutti i giochi stanno sullo stesso sito, quindi condividono la memoria del browser:
   - usa un prefisso tuo per `localStorage` (Gran Bazar usa `gb-…`, Sottozero `sz-…`);
   - per l'online usa argomenti MQTT tuoi (Gran Bazar usa `granbazar/v1/<partita>/state`, Sottozero `sottozero/v1/…`).
4. Per un gioco online a turni conviene partire da `lib/stanze.js`, come fa Sottozero.

## Come funziona l'online di Gran Bazar

Ogni partita è un documento JSON con un numero di versione (`v`) e un `nonce`.
A ogni mossa il gioco pubblica lo stato intero come messaggio *retained* su due server
MQTT pubblici e gratuiti (HiveMQ `wss://broker.hivemq.com:8884/mqtt` ed EMQX
`wss://broker.emqx.io:8084/mqtt`) e lo salva anche nel browser. Vince sempre la versione
più alta (a pari versione, il nonce più alto). Quando un server si ricollega, il gioco gli
rimanda le versioni più recenti che conosce, così i due server si riallineano da soli.

I server sono pubblici: chi conosce il codice della partita può leggerla. Per questo nelle
partite ci sono solo i nomi scelti dai giocatori e le carte.

Le regole stanno in `gran-bazar/motore.js` e `sottozero/motore.js` (codice puro, senza interfaccia).
Sottozero usa lo stesso schema tramite `lib/stanze.js`. Nota: i punti delle carte azione di Sottozero
(oggi 10 ciascuna) sono in `ACTION_VALUE` dentro `sottozero/motore.js`.

## Collaudo

```
node gran-bazar/test/motore.test.js            # scenari di regole + 500 partite simulate
node sottozero/test/motore.test.js             # scenari di regole + 300 partite da 2 a 8 giocatori
PARTITE=3000 node gran-bazar/test/motore.test.js
```
