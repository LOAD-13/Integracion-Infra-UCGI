#!/bin/sh
# Bootstrap MikoPBX tras el healthcheck.
#
# Hace dos cosas críticas que MikoPBX no soporta nativamente y que descubrimos
# durante la preparación de la demo del Sprint 3:
#
#   1) Parche del dialplan `set-dial-contacts` para no descartar endpoints en
#      estado Unreachable. PJSIP_DIAL_CONTACTS(ext) filtra los Unreachable por
#      default, lo cual rompe llamadas cuando el qualify de un endpoint WSS
#      falla (lo que pasa porque el From SIP de MikoPBX traía el hash del
#      container — ver bug 8 / `hostname: mikopbx.local`). Reemplazamos por
#      el PJSIP/<ext> directo, idéntico al patrón que el propio dialplan usa
#      en sus hints.
#
#   2) Recarga el dialplan en Asterisk para que el sed surta efecto.
#
# Se ejecuta cada vez que el stack se levanta. Idempotente: el sed corre solo
# si detecta el patrón viejo presente.
#
# Requiere /var/run/docker.sock montado read-only para hacer `docker exec`
# contra el container `ucgi-mikopbx`.

set -eu

TARGET_CONTAINER="${TARGET_CONTAINER:-ucgi-mikopbx}"
EXTENSIONS_CONF="${EXTENSIONS_CONF:-/etc/asterisk/extensions.conf}"

log() {
  printf '[mikopbx-bootstrap] %s\n' "$*"
}

run() {
  docker exec "${TARGET_CONTAINER}" "$@"
}

log "Esperando que ${TARGET_CONTAINER} esté reachable..."
for _ in $(seq 1 30); do
  if run sh -c "test -f ${EXTENSIONS_CONF}" 2>/dev/null; then
    break
  fi
  sleep 2
done

if ! run sh -c "test -f ${EXTENSIONS_CONF}"; then
  log "ERROR: ${EXTENSIONS_CONF} no existe en ${TARGET_CONTAINER}. Abortando."
  exit 1
fi

log "Hostname interno del container: $(run hostname || echo unknown)"

PATCH_NEEDED=0
if run grep -q 'PJSIP_DIAL_CONTACTS(${EXTEN})' "${EXTENSIONS_CONF}"; then
  PATCH_NEEDED=1
fi

if [ "${PATCH_NEEDED}" = "1" ]; then
  log "Parchando ${EXTENSIONS_CONF} (PJSIP_DIAL_CONTACTS → PJSIP/...)"
  run sed -i \
    -e 's|${PJSIP_DIAL_CONTACTS(${EXTEN})}|PJSIP/${EXTEN}|g' \
    -e 's|${PJSIP_DIAL_CONTACTS(${EXTEN}-WS)}|PJSIP/${EXTEN}-WS|g' \
    -e 's|${PJSIP_DIAL_CONTACTS(${EXTEN}-TLS)}|PJSIP/${EXTEN}-TLS|g' \
    "${EXTENSIONS_CONF}"

  log "Recargando dialplan en Asterisk"
  run asterisk -rx 'dialplan reload' >/dev/null
  log "Parche aplicado y dialplan recargado."
else
  log "Dialplan ya parchado. Nada que hacer."
fi

# ---------- Regeneración del cert TLS con SANs útiles ----------
#
# MikoPBX genera su cert autofirmado al primer boot usando ÚNICAMENTE el
# hostname del container (un hash random) como CN/SAN. Cuando un cliente HTTP
# se conecta por otro nombre de red (`mikopbx`, `mikopbx.local`, `localhost`)
# la verificación de SAN falla con `No subject alternative DNS name
# matching X found` y rompe el provisioning del integration-api.
#
# Regeneramos el cert con SAN amplia (DNS: mikopbx, mikopbx.local, localhost +
# IP: 127.0.0.1) y reiniciamos nginx + asterisk para que tomen el cert nuevo.
# Idempotente: solo regenera si detecta que el SAN actual no incluye "mikopbx".

NGINX_CRT="/etc/ssl/certs/nginx.crt"
NGINX_KEY="/etc/ssl/private/nginx.key"
AST_CRT="/etc/asterisk/ssl/asterisk.crt"
AST_KEY="/etc/asterisk/ssl/asterisk.key"

CURRENT_SAN=$(run openssl x509 -in "${NGINX_CRT}" -noout -ext subjectAltName 2>/dev/null | tr '\n' ' ' || true)
case "${CURRENT_SAN}" in
  *"DNS:mikopbx"*) NEED_REGEN_CERT=0 ;;
  *) NEED_REGEN_CERT=1 ;;
esac

if [ "${NEED_REGEN_CERT}" = "1" ]; then
  log "Cert TLS no contiene SAN 'mikopbx' — regenerando con SANs útiles"

  # Construyo el openssl config inline (Alpine openssl 3.x acepta -addext, pero
  # encadenarlo con varias SANs es más limpio con un config temporal).
  CERT_CFG='/tmp/ucgi-cert.cnf'
  run sh -c "cat > ${CERT_CFG} <<'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C  = PE
ST = Lima
L  = Lima
O  = UCGI Lab
OU = MikoPBX
CN = mikopbx.local

[req_ext]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = mikopbx.local
DNS.2 = mikopbx
DNS.3 = localhost
IP.1  = 127.0.0.1
EOF
"

  TMP_KEY='/tmp/ucgi-new.key'
  TMP_CRT='/tmp/ucgi-new.crt'
  run openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout "${TMP_KEY}" -out "${TMP_CRT}" \
    -config "${CERT_CFG}" -extensions req_ext >/dev/null 2>&1

  # nginx cert (web GUI + REST API)
  run cp "${TMP_CRT}" "${NGINX_CRT}"
  run cp "${TMP_KEY}" "${NGINX_KEY}"
  # asterisk cert (WSS 8089, SIP-TLS 5061)
  run mkdir -p /etc/asterisk/ssl
  run cp "${TMP_CRT}" "${AST_CRT}"
  run cp "${TMP_KEY}" "${AST_KEY}"
  run chown www:www "${AST_CRT}" "${AST_KEY}" || true

  # nginx -s reload aplica el cert nuevo sin downtime para clientes existentes.
  log "Recargando nginx con el cert nuevo"
  run nginx -t >/dev/null 2>&1 && run nginx -s reload || \
    log "WARN: nginx reload falló; el cert nuevo se aplicará en el próximo boot"

  # Asterisk SSL: necesita reload de los módulos PJSIP/HTTP que usan los certs.
  log "Recargando módulos TLS en Asterisk"
  run asterisk -rx 'module reload res_pjsip.so' >/dev/null || true
  run asterisk -rx 'module reload res_http_websocket.so' >/dev/null || true

  run rm -f "${TMP_KEY}" "${TMP_CRT}" "${CERT_CFG}"
  log "Cert regenerado y servicios recargados."
else
  log "Cert TLS ya contiene SAN 'mikopbx'. Nada que hacer."
fi

# ---------- Parche endpoint-auto → webrtc=yes (ambidextro UDP/TCP/WSS) ----------
#
# MikoPBX define cuatro plantillas de endpoint en pjsip.conf:
#   - endpoint-auto: transport vacío → matchea CUALQUIER transport.
#   - endpoint-udp : transport = transport-udp
#   - endpoint-tcp : transport = transport-tcp
#   - endpoint-wss : transport = transport-wss + webrtc = yes
#
# El endpoint principal del agente (`[1001]`, `[1002]`, etc.) usa la plantilla
# (endpoint-auto). Captura los INVITE entrantes de cualquier transport, pero
# sin `webrtc=yes` rechaza el SDP `UDP/TLS/RTP/SAVPF` del browser CRM con
# `488 Not Acceptable Here` — porque opus/AVPF/DTLS no están aceptados.
#
# Fix: añadir `webrtc=yes` al template `endpoint-auto`. La directiva activa:
#   - `use_avpf=yes`, `media_encryption=dtls`, `ice_support=yes`,
#     `rtcp_mux=yes`, `dtls_auto_generate_cert=yes` (WebRTC requirements).
#   - Pero `force_avp=no` (default en Asterisk ≥16), lo cual hace que el
#     endpoint también acepte RTP/AVP plain. Es decir, sigue funcionando para
#     Linphone Desktop sobre UDP/5060.
#
# Resultado: el mismo endpoint atiende WSS del browser, UDP de Linphone móvil
# y TLS si se conecta un cliente SIP-TLS — todo desde el From-user `1001`.
# Idempotente: sólo aplica si el template todavía no incluye `webrtc`.

PJSIP_CONF="/etc/asterisk/pjsip.conf"

# ---------- Parche aor-common → max_contacts=1 ----------
#
# El template `[aor-common]` permite hasta 5 contacts simultáneos por AOR. En
# uso normal eso es útil (móvil + desktop + softphone), pero en nuestro lab
# provoca el siguiente bug:
#   - El browser del agente se cierra sin desregistrarse limpio.
#   - El contact queda en PJSIP astdb hasta que el qualify falla (≥60s).
#   - El agente vuelve a abrir el browser → nuevo contact con URI distinto.
#   - El AOR ahora tiene 2 contacts, ambos "Avail" momentáneamente.
#   - Cuando otro agente marca a este, MikoPBX hace INVITE al PRIMER contact
#     (el viejo, browser ya cerrado) y la llamada se queda en ringing.
#
# Con max_contacts=1, Asterisk reemplaza el contact viejo en cada REGISTER
# nuevo del mismo AOR, lo que en nuestro caso es la semántica correcta.

if run grep -q '^max_contacts = 5$' "${PJSIP_CONF}"; then
  log "Parchando ${PJSIP_CONF} (aor-common: max_contacts 5 → 1)"
  run sed -i "s/^max_contacts = 5$/max_contacts = 1/" "${PJSIP_CONF}"
  log "Recargando PJSIP en Asterisk"
  run asterisk -rx 'module reload res_pjsip.so' >/dev/null || true
  log "aor-common.max_contacts parchado."
else
  log "aor-common.max_contacts ya parchado. Nada que hacer."
fi

if run grep -q '^\[endpoint-auto\](endpoint-base,!)$' "${PJSIP_CONF}"; then
  HAS_WEBRTC=$(run sh -c "awk '/^\[endpoint-auto\]/{flag=1;next} /^\[/{flag=0} flag && /^webrtc *= *yes/' ${PJSIP_CONF}" || true)
  if [ -z "${HAS_WEBRTC}" ]; then
    log "Parchando ${PJSIP_CONF} (endpoint-auto: webrtc=yes + ambidextro)"
    # Limpio cualquier transport= que mi versión previa pudo haber dejado.
    run sed -i "/^\[endpoint-auto\](endpoint-base,!)$/,/^\[/{/^transport *= *transport-udp$/d}" "${PJSIP_CONF}"
    # Inserto webrtc=yes justo después de la línea del template.
    run sed -i "/^\[endpoint-auto\](endpoint-base,!)$/a webrtc = yes" "${PJSIP_CONF}"
    log "Recargando PJSIP en Asterisk"
    run asterisk -rx 'module reload res_pjsip.so' >/dev/null || true
    log "endpoint-auto parchado (webrtc=yes) y PJSIP recargado."
  else
    log "endpoint-auto ya tiene webrtc=yes. Nada que hacer."
  fi
else
  log "Template endpoint-auto no encontrado en ${PJSIP_CONF}. Saltando."
fi

log "Bootstrap completado."
