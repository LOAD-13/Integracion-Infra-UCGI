#!/usr/bin/env bash
# HU-07.6 (IUDCYGI-47) — verifica que ningún secreto conocido del .env quede en
# logs del stack levantado. Se ejecuta manualmente o desde CI (HU-09.x preview env).
#
# Uso:
#   bash tests/security/check-logs.sh
#
# Salida:
#   - exit 0 si no se encuentra ningún match.
#   - exit 1 + lista de matches en stderr si algún secreto aparece en plano.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "[skip] $ENV_FILE no existe; corré 'cp .env.example .env' primero" >&2
  exit 0
fi

# Lista de variables sensibles cuyos valores no deben aparecer en logs.
SENSITIVE_VARS=(
  SPRING_DATASOURCE_PASSWORD
  JWT_SECRET
  MIDPOINT_ADMIN_PASSWORD
  MIKOPBX_ADMIN_PASSWORD
  MIKOPBX_API_KEY
  ASTERISK_AMI_SECRET
)

# Extrae los valores no vacíos.
VALUES=()
for var in "${SENSITIVE_VARS[@]}"; do
  val=$(grep -E "^${var}=" "$ENV_FILE" | head -1 | cut -d= -f2-) || true
  if [ -n "$val" ] && [ "$val" != "changeme" ] && [ "$val" != "admin" ]; then
    VALUES+=("$val")
  fi
done

if [ ${#VALUES[@]} -eq 0 ]; then
  echo "[ok] no hay secretos no-default en $ENV_FILE"
  exit 0
fi

# Containers a inspeccionar. Si docker compose no está disponible, salimos OK.
if ! command -v docker >/dev/null 2>&1; then
  echo "[skip] docker no disponible" >&2
  exit 0
fi

CONTAINERS=(ucgi-integration-api ucgi-midpoint ucgi-mikopbx)
FOUND_MATCHES=0

for container in "${CONTAINERS[@]}"; do
  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "[skip] container $container no levantado"
    continue
  fi
  logs=$(docker logs --tail=2000 "$container" 2>&1 || true)
  for value in "${VALUES[@]}"; do
    # Sanity check — evita grep con strings muy cortos (false positives).
    if [ ${#value} -lt 6 ]; then continue; fi
    if echo "$logs" | grep -F -- "$value" >/dev/null; then
      echo "[FAIL] secreto encontrado en logs de $container: ${value:0:3}***" >&2
      FOUND_MATCHES=$((FOUND_MATCHES + 1))
    fi
  done
done

if [ "$FOUND_MATCHES" -gt 0 ]; then
  echo "[FAIL] $FOUND_MATCHES match(es) — revisar logback/MaskingConverter" >&2
  exit 1
fi

echo "[ok] sin secretos en plano en los logs de ${#CONTAINERS[@]} containers"
