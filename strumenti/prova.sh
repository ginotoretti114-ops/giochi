#!/bin/bash
# Sito di prova: https://ginotoretti114-ops.github.io/giochi/prova/  (sito vero: .../giochi/)
#
# Le modifiche nuove si fanno sul ramo «prova». GitHub Pages pubblica solo il ramo main, quindi
# la prova vive in main come cartella prova/, copia esatta dell'ultimo commit del ramo «prova».
# Il sito di prova ha memoria del browser e argomenti MQTT suoi (lib/ambiente.js) e la scritta PROVA.
#
#   strumenti/prova.sh pubblica   mette l'ultimo commit del ramo «prova» su .../giochi/prova/
#   strumenti/prova.sh promuovi   porta il ramo «prova» sul sito vero (lo unisce a main) e riallinea la prova
#
# I due comandi vogliono il lavoro già salvato in un commit sul ramo «prova» e fanno da soli push di
# «prova» e di main. I commit che creano riprendono le righe finali (trailer) dell'ultimo commit di «prova».
set -euo pipefail
# «prova» è sia un ramo sia una cartella: nei comandi git il ramo si scrive refs/heads/prova
cd "$(git rev-parse --show-toplevel)"

cmd=${1:-}
if [ "$cmd" != pubblica ] && [ "$cmd" != promuovi ]; then
  echo "uso: strumenti/prova.sh pubblica|promuovi" >&2; exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Ci sono modifiche non salvate: fai prima un commit sul ramo «prova»." >&2; exit 1
fi
git rev-parse -q --verify refs/heads/prova >/dev/null || { echo "Manca il ramo «prova»." >&2; exit 1; }

git fetch -q origin
# il ramo «prova» locale deve contenere quello online, così nessun commit va perso
if git rev-parse -q --verify refs/remotes/origin/prova >/dev/null && ! git merge-base --is-ancestor origin/prova refs/heads/prova; then
  echo "Il ramo «prova» online ha commit che qui mancano: aggiornalo prima (git pull sul ramo prova)." >&2; exit 1
fi
git -c push.negotiate=true push -q origin prova

tmp=$(mktemp -d)
cleanup() {
  if [ -n "${W:-}" ] && [ "$W" != "." ]; then git worktree remove --force "$W" >/dev/null 2>&1 || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT

# main si modifica qui se è il ramo corrente, altrimenti in una cartella di lavoro temporanea
if [ "$(git branch --show-current)" = main ]; then W=.; else W="$tmp/main"; git worktree add -q "$W" main; fi
git -C "$W" merge -q --ff-only origin/main

trailers=$(git log -1 --format='%(trailers:only)' refs/heads/prova)
subject=$(git log -1 --format='%s' refs/heads/prova)

if [ "$cmd" = promuovi ]; then
  git -C "$W" merge -q --no-ff refs/heads/prova -m "Porta in produzione: $subject" -m "$trailers" || {
    git -C "$W" merge --abort || true
    echo "L'unione di «prova» in main ha dei conflitti: risolvili a mano." >&2; exit 1
  }
fi

# copia dell'ultimo commit di «prova» (senza la prova stessa, gli strumenti, i test e le note),
# con il divieto ai motori di ricerca di indicizzarla
# dopo «promuovi» la prova riparte da quello che è appena andato sul sito vero
src=refs/heads/prova; [ "$cmd" = promuovi ] && src=$(git -C "$W" rev-parse HEAD)
snap="$tmp/snap"; mkdir -p "$snap"
git archive "$src" | tar -x -C "$snap"
rm -rf "$snap/prova" "$snap/strumenti" "$snap/CLAUDE.md" "$snap/README.md" "$snap/.nojekyll" "$snap/.gitignore"
find "$snap" -type d -name test -prune -exec rm -rf {} +
python3 - "$snap" <<'PY'
import pathlib, sys
for f in pathlib.Path(sys.argv[1]).rglob('*.html'):
    s = f.read_text(encoding='utf-8')
    if 'name="robots"' not in s:
        s = s.replace('<head>', '<head>\n<meta name="robots" content="noindex">', 1)
        f.write_text(s, encoding='utf-8')
PY
rm -rf "$W/prova"
cp -a "$snap" "$W/prova"
git -C "$W" add -A prova
if git -C "$W" diff --cached --quiet; then
  echo "La prova era già aggiornata."
else
  git -C "$W" commit -q -m "Sito di prova: $subject" -m "$trailers"
fi
git -C "$W" -c push.negotiate=true push -q origin main

if [ "$cmd" = promuovi ]; then
  # il ramo «prova» riparte da main, così le prossime modifiche partono dal sito vero aggiornato
  if [ "$(git branch --show-current)" = prova ]; then git merge -q --ff-only main; else git branch -f prova main; fi
  git -c push.negotiate=true push -q origin prova
  echo "Sito vero aggiornato: https://ginotoretti114-ops.github.io/giochi/"
fi
echo "Sito di prova: https://ginotoretti114-ops.github.io/giochi/prova/ (online in un paio di minuti)"
