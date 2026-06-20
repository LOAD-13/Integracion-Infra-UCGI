# Runbook · Probar videollamadas en el CRM (HU-04.9)

> Última actualización: 2026-06-19. Audiencia: equipo UCGI durante la defensa.

## Objetivo

Demostrar que dos agentes del CRM pueden establecer una videollamada
end-to-end usando WebRTC: SIP.js sobre `wss` → MikoPBX (Asterisk 20) con
códecs de voz + `vp8`/`h264`.

## Prerequisitos

- Stack levantado: `docker compose up -d` con MikoPBX healthy.
- Dos navegadores Chrome/Edge (Chromium) — Firefox también funciona pero los
  permisos de cámara/micro a veces requieren `about:webrtc` para depurar.
- Dos cuentas seed: `agente1` (extensión 1001) y `agente2` (extensión 1002),
  ambas con password seed bcrypt en `infra/mariadb/init/03-seed-data.sql`.
- Cámaras enchufadas/integradas en al menos uno de los equipos.

## Paso a paso

1. **Loguearse como `agente2`** en una ventana Chrome **incógnita**
   (`http://localhost/login`). Una vez en el panel, el badge del softphone
   pasa a **Registrado**.
2. **Activar video** desde el botón `Activar video` del softphone.
   - El navegador pide permisos de cámara — aceptar.
   - Verificar que aparece la preview del propio video (recuadro derecho).
3. **Loguearse como `agente1`** en otra ventana Chrome (perfil/incógnita
   distinto). Activar video también.
4. En `agente1`, marcar `1002` y presionar **Llamar**.
5. En `agente2`, la tarjeta del softphone cambia a **Llamada entrante** con
   `Entrante de 1001`. Presionar **Contestar**.
6. Ambos navegadores muestran las dos superficies de video (`Tu propio
   video` + `Video remoto del interlocutor`). El audio debe fluir
   bidireccional.

## Fallback solo-audio

- Si el browser deniega permisos de cámara → el toggle de video se queda en
  apagado y aparece el banner *"La cámara no está disponible — el softphone
  seguirá funcionando en modo solo-audio."*
- Si la cámara funcionaba y se desconecta durante una llamada, el peer
  enviará un track vacío hasta que se haga un re-INVITE; la solución
  pragmática es colgar y volver a llamar.

## Verificación lado MikoPBX

- GUI `http://localhost:8090` → **Status → Active calls**.
- Detalle de la llamada activa: ver columna *Codec* — debería listar
  `opus`/`ulaw` para audio y `VP8` o `H264` para video.
- Si solo aparece audio: revisar que la plantilla pjsip de provisioning
  incluya `allow=opus,ulaw,alaw,gsm,g729,vp8,h264` (ya configurado por
  HU-02.6 + HU-03.8).

## Wireshark (opcional para defensa)

- Filtro `sip and ip.addr == 127.0.0.1` para capturar el `INVITE` con el
  bloque `m=video ... VP8/H264` y el `200 OK` aceptando.
- Para SRTP (cifrado), activar primero TLS 5061/8089 (HU-07.2, S4).

## Códecs y ancho de banda

| Códec video | BW típico (kbps) |
|---|---|
| VP8 360p 30fps | ~600 kbps |
| H.264 360p 30fps | ~500 kbps |
| VP8 720p 30fps | ~1500 kbps |

El runbook del shaper (HU-08.5, S4) cubre cómo limitar BW para forzar
fallback de calidad/códec durante la defensa.

## Referencias

- HU-02.6 IUDCYGI-169 — adopción MikoPBX.
- HU-03.8 IUDCYGI-170 — provisión REST con códecs vp8/h264.
- HU-04.2 IUDCYGI-26 — softphone base (audio).
- HU-04.9 IUDCYGI-171 — este runbook + UI video.
