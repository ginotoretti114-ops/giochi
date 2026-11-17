# Istruzioni per Claude

Sito statico pubblicato con GitHub Pages dal ramo `main` (cartella radice): https://ginotoretti114-ops.github.io/giochi/
Non c'è nessuna build: i file si modificano e si pubblicano così come sono.

- Testi e interfacce in italiano.
- Ogni gioco ha la sua cartella con `index.html` e `copertina.svg` (600×360) e va aggiunto all'array `GIOCHI` in `index.html` della radice.
- Nei giochi, il link «‹ Tutti i giochi» porta a `../` (Gran Bazar lo attiva con `window.GB_HUB_URL = "../"`).
- I giochi condividono la memoria del browser: ognuno usa un suo prefisso in `localStorage` (Gran Bazar usa `gb-`).
- Online a turni: riusare lo schema di Gran Bazar, cioè stato JSON intero con `v` e `nonce`, pubblicato come messaggio retained su due broker MQTT pubblici tramite `lib/mqtt.min.js`, con argomenti MQTT che hanno un prefisso proprio per ogni gioco. Nei server pubblici niente dati personali.
- Stile comune: notte indaco `#131833`, pannelli `#1b2246`, testo `#f6eedd`, accento zafferano `#f5aa3e`; caratteri Rozha One per i titoli e Atkinson Hyperlegible per il testo.
- Le regole di Gran Bazar stanno in `gran-bazar/motore.js`: dopo ogni modifica lanciare `node gran-bazar/test/motore.test.js`.
