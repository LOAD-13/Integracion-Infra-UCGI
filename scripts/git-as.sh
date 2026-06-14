#!/usr/bin/env bash
# scripts/git-as.sh — Hace un commit firmado por uno de los 4 integrantes del equipo.
#
# Uso:
#   scripts/git-as.sh joaquin   "feat(api): provisionar extensión SIP [IUDCYGI-20]"
#   scripts/git-as.sh mikiasa   "chore(infra): healthcheck mariadb [IUDCYGI-14]"
#   scripts/git-as.sh rsocualaya "feat(nginx): TLS terminado en 443 [IUDCYGI-18]"
#   scripts/git-as.sh ash       "docs(readme): sección cómo levantar [IUDCYGI-10]"
#
# Requisitos: haber añadido los cambios al stage con `git add` previamente.

set -euo pipefail

ALIAS="${1:-}"
MESSAGE="${2:-}"

if [[ -z "$ALIAS" || -z "$MESSAGE" ]]; then
  echo "Uso: $0 <alias> \"<mensaje>\""
  echo "Alias disponibles: joaquin, mikiasa, rsocualaya, ash"
  exit 1
fi

case "$ALIAS" in
  joaquin)
    NAME="Joaquín Loa Denegri"
    EMAIL="104539394+LOAD-13@users.noreply.github.com"
    ;;
  mikiasa)
    NAME="Mikiasa"
    EMAIL="mikiasa@ucgi.local"
    ;;
  rsocualaya)
    NAME="RSocualaya"
    EMAIL="rsocualaya@ucgi.local"
    ;;
  ash)
    NAME="Ash-e"
    EMAIL="ash-e@ucgi.local"
    ;;
  *)
    echo "Alias desconocido: $ALIAS"
    echo "Alias válidos: joaquin, mikiasa, rsocualaya, ash"
    exit 2
    ;;
esac

git -c "user.name=$NAME" -c "user.email=$EMAIL" commit -m "$MESSAGE"
echo "✓ Commit firmado por $NAME <$EMAIL>"
