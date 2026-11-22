# Database degli account (Supabase)

Due progetti Supabase gratuiti, server a Francoforte (eu-central-1), organizzazione «ginotoretti114-ops's Org»:

| Sito | Progetto | Riferimento | Pagina iniziale (Site URL) |
| --- | --- | --- | --- |
| prova | `sala-giochi-prova` | `xuylmtdsxyhopyykevlm` | https://ginotoretti114-ops.github.io/giochi/prova/ |
| vero | `sala-giochi` | `vpjeypyfgrgjsfzwkgoe` | https://ginotoretti114-ops.github.io/giochi/ |

Le migrazioni qui accanto sono già applicate a entrambi, nell'ordine dei numeri; una nuova va applicata prima
al progetto di prova e, quando la novità passa al sito vero, all'altro. URL e chiavi pubbliche stanno in
`lib/conti.js`.

Da sistemare a mano nel pannello di Supabase (per ognuno dei due progetti):
- Authentication → URL Configuration → Site URL: l'indirizzo della tabella qui sopra.
- Authentication → Sign In / Providers → Google: attivo, con ID e segreto del client OAuth di Google Cloud
  (URI di reindirizzamento autorizzati: `https://<riferimento>.supabase.co/auth/v1/callback`).
- Per i link via email a chiunque: Authentication → SMTP con un servizio di invio (Resend, Brevo…); senza,
  Supabase manda email solo ai membri dell'organizzazione.
