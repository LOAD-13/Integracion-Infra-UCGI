#!/bin/bash
# Smoke test del provisioning SIP end-to-end vía REST:
#   1. login admin → JWT
#   2. POST /api/v1/sip-extensions con un número nuevo
#   3. verifica que MikoPBX tiene la nueva extensión (pjsip show auths)
#
# Útil tras un fix del MikoPbxRestClient o del bootstrap. Si el integration-api
# devuelve 201 pero MikoPBX no muestra la extensión, el provisioning rompió.
set -euo pipefail

EXT="${1:-1099}"
USERNAME="${2:-agente_smoke_${EXT}}"
SECRET="${3:-sip-smoke-${EXT}-test}"

TOKEN=$(curl -sk -X POST -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"demo1234"}' \
  https://localhost/api/v1/auth/login | sed 's/.*accessToken":"//' | sed 's/".*//')

if [ -z "${TOKEN}" ]; then
  echo "Login admin falló" >&2
  exit 1
fi
echo "Token len: ${#TOKEN}"

echo "---POST sip-extensions ${EXT}---"
RESP=$(curl -sk -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${SECRET}\",\"extensionNumber\":\"${EXT}\",\"displayName\":\"Smoke ${EXT}\"}" \
  https://localhost/api/v1/sip-extensions)
echo "${RESP}"

echo "---verify in mikopbx---"
docker exec ucgi-mikopbx asterisk -rx 'pjsip show auths' 2>&1 | grep -E "${EXT}" || echo "ext ${EXT} no aparece en MikoPBX"

echo "---cleanup (delete fila de la BD)---"
docker exec ucgi-db mysql -u ucgi_app -pchangeme-app -e "DELETE FROM crm.sip_extensions WHERE extension_number='${EXT}';" 2>&1 | tail -3
