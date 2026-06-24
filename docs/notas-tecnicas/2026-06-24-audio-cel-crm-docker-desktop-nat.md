# Audio cel→CRM no llega: NAT de Docker Desktop on Windows

**Fecha:** 2026-06-24 · **HU asociada:** IUDCYGI-179 (HU-04.11) · **Estado:** Limitación documentada del entorno

## Síntoma

Después de registrar una cuenta SIP de Linphone móvil contra MikoPBX (ext 1003 por TCP/5060), las llamadas conectan limpio en ambas direcciones (CRM↔cel) — señalización SIP correcta, el video CRM→cel se transmite, el audio CRM→cel se escucha en el cel. **Pero el audio del cel hacia el CRM no llega**: el agente en el browser no escucha al cel y la grabación queda en silencio del lado del cel.

## Diagnóstico

Captura de tcpdump en el contenedor MikoPBX (`udp portrange 10000-10200`) durante una llamada cel→CRM:

```
912 paquetes: 169.254.108.25.52606 > 172.18.0.9.10004   (browser → MikoPBX, DTLS-SRTP)
897 paquetes: 172.18.0.9.10120     > 192.168.100.105.53137  (MikoPBX → cel, RTP plano)
  0 paquetes: 192.168.100.105.*    > 172.18.0.9.10120  (cel → MikoPBX)  ← AUSENTES
```

El cel **no está enviando RTP** a MikoPBX. Analizando el SDP que MikoPBX le envía al cel en el INVITE (extraído del PJSIP logger):

```
INVITE sip:1003@172.18.0.1:56664;transport=TCP SIP/2.0
...
c=IN IP4 172.18.0.9
m=audio 10120 RTP/AVP 8 0 107 3 111 97 112 101 102
```

**`172.18.0.9` es la IP interna del contenedor MikoPBX dentro de la red Docker.** El cel intenta enviar RTP a esa IP y los paquetes se descartan porque `172.18.0.0/16` no es ruteable desde la LAN (192.168.100.x) ni desde Internet.

### Por qué Asterisk no usa la IP externa

MikoPBX tiene configurado en su GUI `Topología de red` → `Dirección IP externa = 192.168.100.102`, lo que en `pjsip.conf` aparece como:

```ini
external_media_address=192.168.100.102
external_signaling_address=192.168.100.102
```

La regla de NAT-SDP de PJSIP dice: *si el peer remoto está fuera de `local_net`, usar `external_media_address` en el c= line del SDP*. La trampa: en Docker Desktop on Windows, **el demonio Docker enmascara la IP origen del cel a `172.18.0.1`** (la IP del gateway de la red `ucgi-net`) cuando los paquetes UDP/TCP entran al contenedor desde fuera de la red Docker. Asterisk recibe el REGISTER del cel y, con `rewrite_contact=yes`, persiste el contact como `sip:1003@172.18.0.1:56664;transport=TCP`. Al evaluar la regla de NAT-SDP, ve que el peer está en `172.18.0.0/16` — que por default está en `local_net` — y decide que el peer es "local" → usa la IP interna (`172.18.0.9`) en el c= line.

El cel, que en realidad está en la LAN (`192.168.100.105`) y NO dentro de Docker, recibe ese SDP con una IP no ruteable y queda enviando RTP a un destino que nunca llega.

## Hipótesis probadas

| Hipótesis | Acción | Resultado |
|---|---|---|
| Falta el firewall del host | `New-NetFirewallRule` Windows UDP 10000-10200 | El tcpdump confirma que el RTP cel→MikoPBX llega cuando el cel envía al puerto correcto. Acción válida pero insuficiente. |
| `media_address` por endpoint forzaría la IP correcta en SDP | Agregar `media_address=192.168.100.102` a `[1003]` en `pjsip.conf` | Asterisk intenta bindear el RTP a 192.168.100.102 (IP que no existe dentro del contenedor) y rompe el setup de RTP. Las llamadas dejan de conectar. |
| Quitar `172.18.0.0/16` de `local_net` haría que Asterisk trate al cel como externo | Sed sobre los 4 transports en `pjsip.conf` + `module reload res_pjsip.so` | El `module reload` de PJSIP **no aplica cambios en la config de los transports activos**. Verificado con `pjsip show transport transport-tcp`: el `local_net` seguía conteniendo `172.18.0.0/16` en runtime. |
| Reiniciar Asterisk completo dentro del contenedor sí relee la config de transports | `asterisk -rx 'core restart now'` (~25s de downtime) | Después del restart, `pjsip show transport transport-tcp` ya no incluye `172.18.0.0/16` ✅. Pero el SDP saliente al cel **sigue** anunciando `c=IN IP4 172.18.0.9`. La lógica de PJSIP para elegir el "media address" usa la IP del transport bind antes que la regla `local_net`/`external_media_address` cuando el contact remoto está colocalizado con el bind. |
| ICE candidates con `ice_host_candidates=172.18.0.9=192.168.100.102` añadiría el LAN IP como candidato adicional | Editar `rtp.conf` + reload + `ice_support=yes` en 1003 | El SDP saliente incluyó solo el candidato `172.18.0.9` (host), no el externo. El servidor STUN sería necesario para que Asterisk descubra otra IP como candidato srflx. Sin STUN, ICE no resuelve el problema. Adicionalmente, ICE introdujo bugs de sync de hang-up (la llamada Linphone se quedaba colgada aunque el browser ya hubiera colgado) y se revirtió. |

## Causa raíz

La incompatibilidad entre el mecanismo de port-publish de **Docker Desktop on Windows** (que enmascara la IP origen a `172.18.0.1`) y la lógica de NAT-SDP de **Asterisk PJSIP** (que decide la IP a anunciar a partir del contact persistido). En un host Linux bare metal o WSL2 con `networkingMode=mirrored`, la IP origen del cel se preserva como `192.168.100.105` y PJSIP aplica correctamente `external_media_address`. **El código del lab es correcto.**

## Caminos para resolverlo (no aplicados en esta entrega)

1. **Producción real (Linux bare metal):** desplegar el stack sobre Ubuntu Server o Debian. El bug no se manifiesta porque la red Docker en Linux native preserva la IP origen.
2. **WSL2 Mirrored Mode (Windows 11):** crear `C:\Users\<usuario>\.wslconfig` con:
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```
   Reiniciar WSL2. Docker Desktop pasa a heredar la red mirrored y deja de enmascarar.
3. **TURN server (coturn):** desplegar coturn como contenedor adicional. SIP.js del CRM y Linphone usan TURN como relay RTP. Bypasea la NAT pero suma complejidad de infra.
4. **socat puente RTP:** lanzar socat dentro del contenedor mikopbx que escuche en 0.0.0.0:10000-10200 y reenvíe a la IP LAN del host. Hack, no recomendable.

Para la entrega académica del 2026-07-02, **se mantiene la configuración actual** y se documenta el bug. La demo cubre:

* Llamadas bidireccionales agente↔agente (browser↔browser) con audio + video.
* Llamada CRM→cel con audio + video transmitiendo.
* Llamada cel→CRM con señalización OK y audio CRM→cel funcional.
* Ringtone CRM al recibir entrante.
* TTS no-answer al llamante 1003.

La limitación específica del audio cel→CRM se cita explícitamente como *trampa de Docker Desktop on Windows ya identificada*, no como bug del lab.

## Referencias

* Asterisk PJSIP NAT settings: `https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/`
* Docker Desktop networking on Windows: `https://docs.docker.com/desktop/networking/`
* WSL2 mirrored networking: `https://learn.microsoft.com/en-us/windows/wsl/networking#mirrored-mode-networking`
* Bug 488 anterior (browser ↔ ext UDP, simétrico a este): `docs/notas-tecnicas/2026-06-22-bug-crm-488-causa-root-y-fix.md`
