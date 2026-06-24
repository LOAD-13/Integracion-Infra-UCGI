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

# ---------- Inyectar overrides webrtc + transport=auto en SQLite ----------
#
# MikoPBX regenera pjsip.conf desde su SQLite cada vez que el modelo m_Sip
# cambia (creación/edición de empleados, REST API, GUI). Cualquier sed que
# hagamos sobre /etc/asterisk/pjsip.conf se borra a los pocos segundos.
#
# Solución persistente: meter las directivas WebRTC en la columna
# `manualattributes` del m_Sip (base64 de INI con secciones [endpoint] y [aor])
# y forzar transport='' para que MikoPBX use el template `endpoint-auto` (que
# acepta cualquier transport). Cada vez que MikoPBX regenere pjsip.conf, va a
# inyectar nuestros overrides automáticamente.

MIKO_DB="/cf/conf/mikopbx.db"
OVERRIDE_INI='[endpoint]
webrtc=yes
media_encryption=dtls
use_avpf=yes
ice_support=yes
dtls_auto_generate_cert=yes
rtcp_mux=yes
direct_media=no
rtp_symmetric=yes
rewrite_contact=yes

[aor]
max_contacts=1
remove_existing=yes
remove_unavailable=yes
qualify_frequency=0'

# base64 -w0 portable: usamos `tr -d` por si la build de coreutils en MikoPBX
# es muy vieja.
B64=$(printf '%s' "${OVERRIDE_INI}" | run base64 | run tr -d '\n')

if [ -n "${B64}" ]; then
  CHANGED=$(run sqlite3 "${MIKO_DB}" \
    "SELECT count(*) FROM m_Sip WHERE extension IN ('1001','1002') AND (manualattributes != '${B64}' OR transport != '');" \
    2>/dev/null || echo 0)
  if [ "${CHANGED}" != "0" ]; then
    log "Inyectando manualattributes webrtc=yes + transport='' en m_Sip (1001, 1002)"
    run sqlite3 "${MIKO_DB}" \
      "UPDATE m_Sip SET manualattributes='${B64}', transport='' WHERE extension IN ('1001','1002');"
    # Disparar regeneración de pjsip.conf a través de un UPDATE que cause un
    # ModelEvent (cambio en m_Sip.disabled toggle no-op).
    run sqlite3 "${MIKO_DB}" \
      "UPDATE m_Sip SET disabled=disabled WHERE extension IN ('1001','1002');"
    log "Overrides aplicados; pjsip.conf se regenerará en el próximo reload."
  else
    log "Overrides webrtc/transport ya presentes en SQLite. Nada que hacer."
  fi
else
  log "WARN: no se pudo generar B64 del INI override; bootstrap continúa."
fi

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

# ---------- Inyectar manualattributes para 1003 (Linphone móvil) ----------
#
# Linphone móvil NO soporta DTLS-SRTP. Si 1003 hereda webrtc=yes del template
# endpoint-auto (parchado arriba), MikoPBX le ofrece SDP UDP/TLS/RTP/SAVPF y
# Linphone responde 488 "Not Acceptable Here".
#
# Override por endpoint: apagamos webrtc específicamente para 1003 manteniendo
# rtp_symmetric + force_rport + rewrite_contact para que el NAT del cel funcione.
# A diferencia de 1001/1002, no podemos confiar en regeneración SQL→pjsip.conf
# porque MikoPBX no inyecta manualattributes desde m_Sip en endpoints simples;
# por eso el patch va directo sobre pjsip.conf y queda idempotente.

OVERRIDE_1003='webrtc=no\nuse_avpf=no\nrtcp_mux=no\nmedia_encryption=no\ndtls_auto_generate_cert=no\nice_support=no\ndirect_media=no\nrtp_symmetric=yes\nrewrite_contact=yes\nforce_rport=yes'

if run grep -q '^\[1003\](endpoint-auto)$' "${PJSIP_CONF}"; then
  HAS_1003_OVERRIDE=$(run sh -c "awk '/^\[1003\]\(endpoint-auto\)/{flag=1;next} /^\[/{flag=0} flag && /^webrtc *= *no/' ${PJSIP_CONF}" || true)
  if [ -z "${HAS_1003_OVERRIDE}" ]; then
    log "Inyectando overrides webrtc=no en endpoint 1003 (Linphone móvil)"
    # Limpio overrides residuales antes de insertar (idempotencia).
    run sed -i "/^\[1003\](endpoint-auto)\$/,/^\[/{/^webrtc=/d;/^use_avpf=/d;/^rtcp_mux=/d;/^media_encryption=/d;/^dtls_auto_generate_cert=/d;/^ice_support=/d;/^direct_media=/d;/^rtp_symmetric=/d;/^rewrite_contact=/d;/^force_rport=/d;/^media_address=/d}" "${PJSIP_CONF}"
    run sed -i "/^\[1003\](endpoint-auto)\$/a ${OVERRIDE_1003}" "${PJSIP_CONF}"
    run asterisk -rx 'module reload res_pjsip.so' >/dev/null || true
    log "endpoint 1003 parchado (webrtc=no) y PJSIP recargado."
  else
    log "endpoint 1003 ya tiene webrtc=no. Nada que hacer."
  fi
else
  log "Endpoint 1003 no encontrado en ${PJSIP_CONF}. Saltando (creálo desde el integration-api primero)."
fi

# ---------- Copiar audios TTS al volumen mikopbx-data y convertir ----------
#
# El sidecar tiene /audios montado read-only desde infra/mikopbx/audios del repo.
# Copiamos cada MP3 al directorio MOH del contenedor mikopbx (volumen
# mikopbx-data) y lo convertimos a los formatos nativos de Asterisk (wav/sln/
# alaw/ulaw/gsm) usando sox + ffmpeg que el contenedor mikopbx trae instalados.
# Idempotente: solo convierte si el .sln (representante) no existe.

MOH_DIR="/storage/usbdisk1/mikopbx/media/moh"

if [ -f "/audios/ucgi-tts.mp3" ]; then
  if ! run test -f "${MOH_DIR}/ucgi-tts.sln"; then
    log "Copiando ucgi-tts.mp3 al volumen mikopbx-data"
    docker cp /audios/ucgi-tts.mp3 "${TARGET_CONTAINER}:${MOH_DIR}/ucgi-tts.mp3"

    log "Convirtiendo a wav/sln/alaw/ulaw/gsm dentro de ${TARGET_CONTAINER}"
    run sh -c "cd ${MOH_DIR} && \
      ffmpeg -nostats -loglevel error -y -i ucgi-tts.mp3 -ar 8000 -ac 1 -acodec pcm_s16le ucgi-tts.wav && \
      sox ucgi-tts.wav -r 8000 -c 1 -t raw -e signed -b 16 ucgi-tts.sln && \
      sox ucgi-tts.wav -r 8000 -c 1 -t al ucgi-tts.alaw && \
      sox ucgi-tts.wav -r 8000 -c 1 -t ul ucgi-tts.ulaw && \
      sox ucgi-tts.wav -r 8000 -c 1 ucgi-tts.gsm"
    log "Audios TTS UCGI listos en ${MOH_DIR}."
  else
    log "Audios ucgi-tts.* ya presentes. Nada que hacer."
  fi
else
  log "WARN: /audios/ucgi-tts.mp3 no montado; saltando setup TTS."
fi

# ---------- Registrar clase MOH ucgi-tts ----------
#
# MOH class apuntando al basename ucgi-tts (sin extensión). Asterisk elige
# el formato según los códecs del peer en la llamada (.sln para softphones
# WebRTC vía bridging, .alaw para Linphone móvil, etc).

MOH_CONF="/etc/asterisk/musiconhold.conf"

if ! run grep -q '^\[ucgi-tts\]' "${MOH_CONF}"; then
  log "Agregando clase MOH [ucgi-tts] a ${MOH_CONF}"
  run sh -c "printf '\n[ucgi-tts]; UCGI TTS no-answer (HU-04.11)\nmode=playlist\nentry=${MOH_DIR}/ucgi-tts\n' >> ${MOH_CONF}"
  run asterisk -rx 'module reload res_musiconhold.so' >/dev/null || true
  log "Clase MOH ucgi-tts registrada y res_musiconhold recargado."
else
  log "Clase MOH ucgi-tts ya presente."
fi

# ---------- Dialplan: m(ucgi-tts) cuando el llamante es 1003 ----------
#
# Inserta una línea después del Set(TRANSFER_OPTIONS=Tt) que appendéa
# m(ucgi-tts) cuando ${CALLERID(num)} == "1003". Eso hace que el Dial()
# del internal-users reemplace el ringback estándar por nuestro TTS en
# loop hasta que el agente conteste, rechace o el cel cuelgue.
# Idempotente: marker "ucgi-tts" en el archivo evita re-aplicar.

EXT_CONF="/etc/asterisk/extensions.conf"

if ! run grep -q 'ucgi-tts' "${EXT_CONF}"; then
  log "Parchando ${EXT_CONF} para inyectar m(ucgi-tts) cuando llama 1003"
  # Python adentro del contenedor porque sed con tantos $-escapes es frágil.
  run python3 -c "
import sys
path = '${EXT_CONF}'
with open(path, 'r') as f:
    src = f.read()
anchor = '\tsame => n,ExecIf(\$[\"\${TRANSFER_OPTIONS}x\" == \"x\" || \"\${ISTRANSFER}x\" != \"x\"]?Set(TRANSFER_OPTIONS=Tt))'
patch = '\n\tsame => n,ExecIf(\$[\"\${CALLERID(num)}\" == \"1003\"]?Set(TRANSFER_OPTIONS=\${TRANSFER_OPTIONS}m(ucgi-tts)))'
if anchor in src:
    src = src.replace(anchor, anchor + patch, 1)
    with open(path, 'w') as f:
        f.write(src)
    print('Patched OK')
    sys.exit(0)
# Fallback con espacio trailing (versiones más viejas de MikoPBX).
anchor_sp = anchor + ' '
if anchor_sp in src:
    src = src.replace(anchor_sp, anchor_sp + patch, 1)
    with open(path, 'w') as f:
        f.write(src)
    print('Patched OK (trailing space anchor)')
    sys.exit(0)
print('ANCHOR NOT FOUND - dialplan no patched')
sys.exit(1)
" >/dev/null && run asterisk -rx 'dialplan reload' >/dev/null || log "WARN: patch dialplan TTS falló (anchor distinto); continuando."
  log "Dialplan recargado con m(ucgi-tts) condicional para llamante 1003."
else
  log "Dialplan ya tiene m(ucgi-tts). Nada que hacer."
fi

log "Bootstrap completado."
