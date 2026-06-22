# Bug del CRM "llamada se cuelga al instante" — causa root y fix definitivo

> **Fecha de cierre:** 2026-06-22.
> **PRs involucrados:** #30 (preparación), #31 (intento incompleto), #32 (fix real).
> **Validación:** llamada `1001 → 1002` registra CDR completo en MikoPBX con
> grabación `.webm` (row 13: `2026-06-22 07:46:17 → 07:46:19`).

## 1. Síntoma observado

- CRM cargaba OK, login OK, softphone WebRTC mostraba "🟢 Registrado".
- Al marcar a otra extensión:
  - **Chrome:** UI mostraba "Llamando…" ~3 segundos y luego "colgaba sola" sin razón visible.
  - **Firefox:** colgaba al instante, sin siquiera mostrar el "Llamando…".
  - **MikoPBX:** la pestaña "Historial de llamadas" quedaba vacía (excepto las llamadas que se hicieron con `pjsua`/Linphone vía UDP previamente).
- En la consola del browser (DevTools de Chrome) se veía consistentemente:

```
sip.Inviter | Inviter.onReject
sip.Inviter | Session ... transitioned to state Terminated
```

## 2. Diagnóstico inicial — falsos positivos

Los primeros parches que aplicamos resolvieron problemas reales pero **no eran la causa**:

| Parche aplicado | Bug que cerraba | Por qué NO bastaba |
|---|---|---|
| `hostname: mikopbx.local` | `From: <sip:1001@<hashContainer>>` que sip.js no parseaba | Resolvía el qualify, pero la llamada seguía cayendo |
| Cert TLS con SAN amplio | `CertificateException: no subject alternative DNS name matching mikopbx` en el cliente Java | Resolvía el cliente REST del integration-api, no la negociación SDP del browser |
| Parche del dialplan `PJSIP_DIAL_CONTACTS(${EXTEN}) → PJSIP/${EXTEN}` | El `Dial` descartaba contacts en estado Unreachable | Resolvía el routing del INVITE de Asterisk hacia los contacts, no el handshake DTLS-SRTP previo |
| `aor max_contacts = 1` | Contacts huérfanos del browser cerrado quedaban registrados y bloqueaban el dial | Necesario pero por sí solo no resolvía el rechazo |

En los logs SIP capturados con Playwright headless veíamos consistentemente:

```
INVITE sip:1002@localhost SIP/2.0
  m=audio ... UDP/TLS/RTP/SAVPF 111 63 9 0 8 13 110 126
  a=ice-ufrag:...
  a=fingerprint:sha-256 ...
  a=setup:actpass

← SIP/2.0 100 Trying
← SIP/2.0 488 Not Acceptable Here
```

El **`488 Not Acceptable Here`** se devolvía antes de cualquier negociación SDP de fondo. Asterisk leía el `m=audio ... UDP/TLS/RTP/SAVPF` (perfil WebRTC) y rechazaba.

## 3. Causa root

MikoPBX define **cuatro plantillas de endpoint** en `pjsip.conf` (genera el archivo desde su SQLite al boot y al cambio):

```
[endpoint-auto] — transport vacío, acepta cualquier transporte
[endpoint-udp]  — transport = transport-udp
[endpoint-tcp]  — transport = transport-tcp
[endpoint-wss]  — transport = transport-wss + webrtc = yes ← LA QUE NOS HACÍA FALTA
```

Para cada extensión SIP creada, MikoPBX genera **TRES endpoints separados**:

```
[1002](endpoint-X)     ← endpoint principal, hereda template según m_Sip.transport
[1002-WS](endpoint-wss) ← endpoint paralelo solo WSS, con webrtc=yes
[1002-TLS](endpoint-tls)
```

El matching de Asterisk PJSIP al INVITE entrante usa el **From-user** del SIP digest auth. El browser envía:

```
From: "Agente Uno" <sip:1001@localhost>;tag=...
Authorization: Digest username="1001", ...
```

→ Asterisk busca un endpoint llamado **exactamente `1001`** (no `1001-WS`). El endpoint `1001-WS` solo se usaría si el `From` dijera `1001-WS`, pero el browser no sabe nada de esa convención.

Por eso el INVITE matchea siempre el endpoint **`1002`** (el principal), que en nuestro stack venía con:

```
[1002](endpoint-udp)
webrtc       = no
media_encryption = no
use_avpf     = no
ice_support  = no
```

`webrtc=no` significa que Asterisk **NO acepta** el perfil `UDP/TLS/RTP/SAVPF` ni el SDP con `a=fingerprint`/`a=setup:actpass` que el browser obligatoriamente envía. La negociación falla en el primer chequeo de capabilities → `488 Not Acceptable Here` antes de tocar SDP.

## 4. Por qué los seds sobre pjsip.conf no funcionaban

El primer intento fue parchar `/etc/asterisk/pjsip.conf` desde el sidecar `mikopbx-bootstrap` con `sed`:

```
[endpoint-auto](endpoint-base,!)
webrtc = yes              ← inyectado por sed
```

**El parche persistía solo hasta el siguiente cambio en `m_Sip`.** Cualquier UPDATE en la tabla (creación de empleado vía API REST, ajuste desde la GUI, ejecución del `SipExtensionBootstrapper` del integration-api) dispara `WorkerModelsEvents → ReloadPJSIPAction → SIPConf::reload()` que regenera **completamente** `pjsip.conf` desde SQLite + plantillas. Los seds del bootstrap quedaban sobrescritos a los segundos.

Esto es por diseño de MikoPBX: el archivo `pjsip.conf` se trata como un build artifact, no como configuración source. La configuración source vive en SQLite.

## 5. Fix definitivo — `manualattributes` en SQLite

Cada fila de `m_Sip` tiene una columna `manualattributes` con formato:

```
base64( INI con secciones [endpoint], [aor], [auth], [identify], ... )
```

`SIPConf::generatePeerEndpoint()` lee `manualattributes`, decodifica y aplica las claves con **mayor prioridad que el template** y los unique params. La línea clave del código MikoPBX:

```php
// Apply manual attributes (highest priority, can override template and unique params)
if (!empty($manual_attributes['endpoint'])) {
    foreach ($manual_attributes['endpoint'] as $key => $value) {
        if (!in_array($key, ['type'])) {
            $conf .= "$key = $value\n";
        }
    }
}
```

Aprovechando eso, el `bootstrap.sh` ahora hace un `UPDATE m_Sip SET manualattributes='<base64>', transport='' WHERE extension IN ('1001','1002')` con este INI:

```ini
[endpoint]
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
qualify_frequency=0
```

`transport=''` hace que MikoPBX use el template `endpoint-auto` (sin transport pinned) en lugar de `endpoint-udp`, así el INVITE WSS no choca con un `transport = transport-udp` heredado del template.

`qualify_frequency=0` evita que MikoPBX marque el contact como `NonQual` cuando el browser no responde inmediatamente al qualify OPTIONS (el browser sí responde al INVITE directo, no necesitamos qualify periódico para que aparezca `Avail`).

`webrtc=yes` activa internamente en Asterisk:
- `use_avpf=yes` → acepta perfil `AVPF` / `SAVPF`.
- `media_encryption=dtls` → habilita DTLS-SRTP.
- `dtls_setup=actpass` → permite negociar quién inicia el handshake DTLS.
- `ice_support=yes` → procesa candidates ICE del SDP.
- `rtcp_mux=yes` → multiplexa RTP+RTCP en un solo puerto (requerido por browsers).
- `force_avp=no` (default en Asterisk ≥16) → **sigue aceptando** `RTP/AVP` plain también, así Linphone Desktop/móvil sobre UDP/5060 funciona sin cambios.

## 6. Validación

Llamada `1001 → 1002` end-to-end:

```
Browser caller (Playwright):
  Inviter Session transitioned to state Established
  iceconnectionstate=connected
  connectionstate=connected

Browser callee (Playwright):
  Invitation Session transitioned to state Established
  iceconnectionstate=connected
  connectionstate=connected

MikoPBX cdr.db row 13:
  start    = 2026-06-22 07:46:17.021
  endtime  = 2026-06-22 07:46:19.594
  src      = 1001
  dst      = 1002
  recording = /storage/usbdisk1/mikopbx/astspool/monitor/.../mikopbx-1782103576.0_sX4mHP.webm
```

## 7. Lecciones aprendidas

1. **No confiar en seds sobre archivos generados.** MikoPBX, FreePBX y similares usan SQLite + templates → cualquier modificación en runtime puede borrar el sed. Para persistencia hay que ir a la fuente (SQLite, en este caso `m_Sip.manualattributes`).
2. **El `488` de Asterisk se decide ANTES del SDP negotiation completo.** Si el perfil `m=audio UDP/TLS/RTP/SAVPF` no coincide con las capabilities del endpoint, Asterisk corta. No es un problema de codecs ni de DTLS — es de profile match.
3. **El From-user dicta qué endpoint matchea, no el transport.** Si el browser registra como `1001` y el endpoint paralelo es `1001-WS`, el INVITE NO va al WS — va al principal. La existencia del endpoint paralelo `1001-WS` en MikoPBX es para conveniencia de outbound dial, no para inbound matching.
4. **Validar siempre con CDR + grabación, no solo con el estado SIP de sip.js.** En el PR #31 yo afirmé "llamada Established" basándome solo en el `Session.state = Established` del Inviter — pero MikoPBX no registraba CDR. Significaba que la sesión SIP del Inviter se establecía a nivel signaling pero el media path no completaba el handshake DTLS, así que MikoPBX no contaba la llamada como real. El CDR + el `.webm` son la única evidencia confiable.

## 8. Cómo prevenir regresiones

- `bootstrap.sh` aplica el manualattributes en cada `docker compose up`. Idempotente.
- Si en el futuro se agregan extensiones nuevas (HU-04.8 admin de usuarios o vía midPoint HU-05.3), el `SipExtensionBootstrapper` del integration-api **debería** setearles también `manualattributes`. Mejora pendiente en el Java code.
- Smoke test sugerido para CI futuro: levantar el stack con Playwright headless dentro de un job de CI, hacer llamada `agente1 → agente2`, verificar que el CDR aparece en `cdr.db`. Si no aparece, fallar el job.
