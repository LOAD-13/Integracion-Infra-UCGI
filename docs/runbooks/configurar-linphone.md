# Runbook · Configurar Linphone como softphone externo para defensa

> Versión inicial: 2026-06-19 (HU-04.2 — softphone WebRTC del CRM).
> Audiencia: equipo UCGI durante la defensa. El profesor pidió ver una llamada
> entrante desde un cliente externo además del softphone embebido en el CRM.

## 1. Para qué sirve

El CRM ya tiene un softphone WebRTC (HU-04.2) que conecta sobre `wss` contra
MikoPBX. Para la defensa también queremos demostrar la pila SIP "tradicional"
(UDP/TCP plano + RTP directo) con un softphone de escritorio. **Linphone
Desktop** es el cliente recomendado:

- Open source, multiplataforma (Windows, macOS, Linux).
- Soporta los códecs que MikoPBX expone (Opus, G.711, GSM, G.729).
- En modo debug muestra los paquetes SIP — útil para defender el flujo.

Descargar desde: <https://www.linphone.org/technical-corner/linphone>.

## 2. Pre-requisitos

- MikoPBX corriendo en el host (`docker compose up -d mikopbx`, healthcheck verde).
- Una extensión SIP creada en la GUI de MikoPBX o via REST (HU-03.8). En esta
  guía usamos el seed `agente1 / extensión 1001 / password sip-demo-1001`
  cargado por `infra/mariadb/init/03-seed-data.sql`.

> Las credenciales reales de un agente provisionado por midPoint las verás en
> la vista de Empleados de MikoPBX (`http://localhost:8090` → Telephony →
> Employees) o en la fila correspondiente de `crm.sip_extensions`.

## 3. Configurar la cuenta SIP en Linphone

1. Abrí Linphone Desktop.
2. **Cuentas → Añadir** (o si es la primera vez, completá el wizard).
3. Elegí **Usar cuenta SIP** (no la red gratuita linphone.org).
4. Completá:
   - **Username:** `1001`
   - **SIP domain:** `localhost`
   - **Password:** `sip-demo-1001`
   - **Display name:** `Agente Uno`
   - **Transport:** `UDP` (para la demo "tradicional"; usar `TLS` cuando
     HU-07.2 active SIP-TLS en 5061).
   - **Proxy server:** `sip:localhost:5060` (puerto expuesto por MikoPBX).
5. Guardá. El indicador de la cuenta debería pasar a verde **Registered**
   en menos de 5 s.

## 4. Hacer una llamada agente↔Linphone

- Loguearse en el CRM (`http://localhost`) como `agente2`. El softphone del
  panel se conecta y queda en estado **Registrado** sobre `wss`.
- Desde Linphone marcar `1002` (la extensión de `agente2`) y pulsar llamar.
- En el CRM aparece la tarjeta del softphone en estado **Llamada entrante**
  con el número del llamante. Pulsar **Contestar**.
- Verificar audio bidireccional. Si querés evidencia visible para la
  defensa, abrir Wireshark con filtro `sip` o `udp.port == 5060` y guardar
  el `INVITE` + `200 OK` + `BYE`.

## 5. Tips para la defensa visual

- Mantené la GUI de MikoPBX abierta en una pestaña: `Status → Active calls`
  muestra la llamada en curso, los códecs negociados y el bitrate. Es la
  evidencia más fuerte del lado del PBX.
- Para mostrar Wireshark con SRTP cifrado, primero activá SIP-TLS y WSS+SRTP
  (HU-07.2, sprint-4) y usá `tls.handshake` como filtro adicional.
- Linphone tiene **Preferences → Audio → Codec priority** — útil para forzar
  G.729 / GSM y demostrar la lógica de downgrade que HU-03.7 introducirá
  cuando se active el shaper.

## 6. Cómo abrir tickets si algo falla

- **Linphone dice "401 Unauthorized"** → la extensión existe pero la password
  no coincide. Generá una nueva en la GUI MikoPBX (Telephony → Employees →
  *Edit* → SIP Password) y actualizá Linphone.
- **Linphone no llega al servidor (`Status: Pending / Timeout`)** → revisá
  que el firewall del host no bloquea UDP 5060 ni el rango RTP
  `10000-10200/udp`. En Docker Desktop Windows verificar que esos puertos
  estén publicados.
- **Audio sólo en un sentido** → es casi siempre tema de NAT. Linphone tiene
  `Network → Use STUN`; configurarlo con `stun.l.google.com:19302` para la
  demo.

## 7. Referencias cruzadas

- HU-02.6 (IUDCYGI-169) — despliegue MikoPBX.
- HU-03.8 (IUDCYGI-170) — provisioning REST desde integration-api.
- HU-04.2 (IUDCYGI-26) — softphone WebRTC del CRM (este PR).
- HU-07.2 (IUDCYGI-43) — SIP-TLS 5061 y wss 8089 (sprint-4).
- HU-09.7 (IUDCYGI-165) — SIP Trunk de salida (sprint-5).
