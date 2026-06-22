# Bugs descubiertos durante el levantamiento del stack y la demo (Sprint 3 → 4)

> Generado el 2026-06-20 al final de la sesión de demo del Sprint 3. Este
> documento es la **fuente de verdad técnica** para la próxima sesión que
> ataque la deuda. Incluye lo que se resolvió, lo que quedó parchado in-memory
> (no persistente), y lo que quedó como bloqueante de la demo de llamadas
> WebRTC.

## 1. Resumen ejecutivo

Durante el levantamiento del stack (`docker compose up -d --build`) y la
preparación de la demo de "softphone CRM → llamada SIP → grabación", aparecieron
**8 bugs distintos**. Seis de ellos se resolvieron con commits firmados en la
branch local `feature/hotfix-spring61-mikopbx-bcrypt-seed` (NO pusheada). Los
otros dos son bloqueantes serios que requieren debugging dedicado en el
Sprint 4.

| # | Bug | Estado | Branch / archivo |
|---|---|---|---|
| 1 | Prometheus bind-mount creaba dirs vacíos | ✅ Resuelto | hotfix `e49cff4` |
| 2 | Seed bcrypt corruption (`demo1234`) | ✅ Resuelto | hotfix `2f81b23` |
| 3 | Spring 6.1 constructor ambiguity (4 clases) | ✅ Resuelto | hotfix `b361508` |
| 4 | Nginx `/api/` proxy_pass strip path | ✅ Resuelto | hotfix `72f9589` |
| 5 | `VITE_SIP_WS_URL` apuntaba a `/ws` | ✅ Resuelto | hotfix `03a6390` |
| 6 | MikoPbxRestClient 301 redirect HTTP→HTTPS | ⚠️ Intento parcial | hotfix `b361508` |
| 7 | MikoPBX dialplan filtra contacts Unreachable | ⚠️ Parche in-memory | NO commit |
| 8 | **MikoPBX From: `<sip:X@227216678a3e>` rompe sip.js** | ❌ Sin resolver | — |

## 2. Bugs RESUELTOS (en branch hotfix local, no pusheada)

### 2.1 — Prometheus bind-mount (commit `e49cff4`)

**Síntoma:** `docker compose up -d` fallaba al iniciar `ucgi-prometheus` con
`failed to mount /etc/prometheus/prometheus.yml: not a directory`.

**Causa:** los archivos `infra/prometheus/{prometheus.yml,alerts.yml}` no
existían en el repo (solo había `.gitkeep`). El compose hacía bind-mount
de esos paths, Docker **creaba automáticamente directorios** con ese nombre
(propiedad root) cuando no encontraba archivos. La siguiente iteración fallaba
al intentar montar el "archivo" (que ahora era un directorio).

**Fix:** crear los 2 archivos YAML con config mínima (scraping de
integration-api, shaper y self).

**Cómo prevenir:** chequeo previo en el README de "levantar primera vez": si
ves dirs en `infra/prometheus/`, borralas y dejá los `.gitkeep` antes de
levantar.

### 2.2 — Seed bcrypt corruption (commit `2f81b23`)

**Síntoma:** login con `agente1` / `demo1234` devuelve 401 "Credenciales
inválidas".

**Causa:** `infra/mariadb/init/03-seed-data.sql` tenía el hash
`$2a$10$wH9q1m1c3v8Q3aZk0Cf0X.r2c2b8s4K9o9V7w0K2Z1B6gJ5h9pCwS` con
comentario `-- bcrypt de "demo1234"`. El hash en realidad no corresponde
a "demo1234" — fue copy-pasteado de otro proyecto o generado con un
algoritmo distinto.

**Fix:** generar un hash bcrypt rondas=10 real de "demo1234":

```bash
docker run --rm python:3.12-alpine sh -c \
  'pip install --quiet bcrypt && python -c "import bcrypt; print(bcrypt.hashpw(b\"demo1234\", bcrypt.gensalt(10)).decode())"'
```

Resultado: `$2b$10$0orMRg7OLziDYLW9kzLHXeXgEWOnrVpeYrhrbvRFtZUVeeeLX6e.e`.

**Cómo prevenir:** añadir un test JUnit que cargue `BCryptPasswordEncoder` y
verifique que `matches("demo1234", seed_hash)` devuelve true. Sirve como
guardrail en CI.

### 2.3 — Spring 6.1 constructor ambiguity (commit `b361508`)

**Síntoma:** `integration-api` no levanta con
`BeanInstantiationException: No default constructor found` en cascada:
`MikoPbxRestClient` → `AsteriskProvisioningService` → `AsteriskAmiClient` →
`PjsipConfigWriter`.

**Causa:** Spring 6.1 (vs 6.0) dejó de elegir constructor automáticamente
cuando una clase `@Component`/`@Service` expone dos constructores públicos
(uno productivo + uno "para tests"). Sin `@Autowired` explícito en el
primario, cae al fallback `BeanUtils.instantiateClass()` que busca un
constructor sin args.

**Fix:** anotar `@Autowired` en el constructor primario de las 4 clases.

**Documentación cruzada:** `memory/feedback_spring_constructor_ambiguity.md`.

### 2.4 — Nginx `/api/` strip path (commit `72f9589`)

**Síntoma:** login via `https://localhost/api/v1/auth/login` devuelve 401
"Token ausente o inválido" con `path:/`. Login via
`http://localhost:8081/api/v1/auth/login` directo funciona OK.

**Causa:**

```nginx
location /api/ {
    set $upstream_api http://integration-api:8081/;   ← trailing /
    proxy_pass $upstream_api;
}
```

Cuando `proxy_pass` termina en `/` o tiene URI fija, nginx **strip el
prefijo `/api/`** y reenvía `/v1/auth/login` al backend. Pero los
controllers tienen `@RequestMapping("/api/v1/auth")` → 404 / 401 al caer
fuera del SecurityConfig.permitAll().

**Fix:** `proxy_pass http://integration-api:8081;` sin URI, sin trailing
slash → nginx preserva el path completo.

**Trampa adicional:** el `nginx.conf` está **bakeado en la imagen via
`COPY`** (no es bind-mount). Para que el cambio surta efecto: `docker
compose build nginx && docker compose up -d nginx`.

### 2.5 — `VITE_SIP_WS_URL` path wrong (commit `03a6390`)

**Síntoma:** softphone CRM falla con WebSocket close 1006 (Abnormal Closure)
después del TLS handshake.

**Causa:** `.env` traía `VITE_SIP_WS_URL=wss://localhost:8089/ws`. MikoPBX
expone el WebSocket de Asterisk en `/asterisk/ws`, NO en `/ws`.

**Fix:** `VITE_SIP_WS_URL=wss://localhost:8089/asterisk/ws` + rebuild del
CRM (Vite injecta este value en build time).

**Verificación:**

```bash
curl -kI -H 'Upgrade: websocket' -H 'Connection: Upgrade' \
  -H 'Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==' \
  -H 'Sec-WebSocket-Version: 13' \
  https://localhost:8089/asterisk/ws
# Debe devolver 101 Switching Protocols
```

## 3. Bugs PARCIALMENTE resueltos o con parche temporal

### 3.1 — MikoPbxRestClient 301 redirect HTTP→HTTPS

**Síntoma:** al hacer `POST /api/v1/sip-extensions` con Bearer admin, la fila
se persiste en `crm.sip_extensions` pero MikoPBX no recibe la creación del
employee. Log: `Login MikoPBX falló (IO)`.

**Causa:**
- `MIKOPBX_PORT=80` apunta a HTTP plano dentro de la red docker.
- MikoPBX (Alpine + nginx) redirige todo HTTP → HTTPS con un 301 Moved.
- `java.net.http.HttpClient` con `Redirect.ALWAYS` sigue el redirect pero
  **NO reenvía el body del POST** (RFC 7231 §6.4.2 — solo 307/308 lo reenvían).
- El segundo POST llega sin body → MikoPBX 401 → `MikoPbxException`.

**Intentos hechos en sesión 2026-06-19/20:**

1. ✅ Agregar `@Autowired` (resolvió un crash distinto).
2. ❌ Cambiar `MikoPbxProperties.baseUrl()` para devolver `https://` directo + `SSLContext` inseguro en el cliente. **No solucionó** — el log sigue diciendo `(IO)` sin más detalle.

**Hipótesis para próxima sesión:**

- Loguear `req.uri()` justo antes del `http.send()` para confirmar qué URI/scheme se está usando realmente.
- Verificar que el SSLContext inseguro está realmente activo (puede que el `defaultHttp()` no se invoque si el bean ya fue construido con el `HttpClient` default desde el `MIKOPBX_PORT=80`).
- Migrar a **Apache HttpClient 5** (más permisivo con redirects + body).
- Implementar el redirect manual: si la primera response es 301/302 con `Location: https://...`, hacer otro POST a esa URL preservando el body.

**Documentación cruzada:** `memory/project_pending_for_next_session.md` (sección 2).

### 3.2 — MikoPBX dialplan filtra contacts Unreachable

**Síntoma:** cuando agente1 marca 1002 desde el CRM softphone, la llamada se
"cuelga rápidamente" (Inviter.onReject inmediato).

**Causa:**

```asterisk
[set-dial-contacts]
exten => _X!,n,Set(DST_CONTACT=${PJSIP_DIAL_CONTACTS(${EXTEN})})
exten => _X!,n,Set(WS_CONTACTS=${PJSIP_DIAL_CONTACTS(${EXTEN}-WS)})
...
```

`PJSIP_DIAL_CONTACTS(ext)` por default **descarta endpoints en estado
Unreachable**. Los endpoints WS quedan Unreachable porque los OPTIONS de
qualify fallan (ver bug 3.3 abajo). Resultado: `DST_CONTACT=""` → línea
`Dial(${DST_CONTACT}, ...) :Set(DIALSTATUS=CHANUNAVAIL)` → cuelga inmediato.

**Parche aplicado (in-memory, no persistente):**

```bash
docker exec ucgi-mikopbx sed -i \
  's|${PJSIP_DIAL_CONTACTS(${EXTEN})}|PJSIP/${EXTEN}|g' \
  /etc/asterisk/extensions.conf
docker exec ucgi-mikopbx sed -i \
  's|${PJSIP_DIAL_CONTACTS(${EXTEN}-WS)}|PJSIP/${EXTEN}-WS|g' \
  /etc/asterisk/extensions.conf
docker exec ucgi-mikopbx sed -i \
  's|${PJSIP_DIAL_CONTACTS(${EXTEN}-TLS)}|PJSIP/${EXTEN}-TLS|g' \
  /etc/asterisk/extensions.conf
docker exec ucgi-mikopbx asterisk -rx 'dialplan reload'
```

**Problemas del parche:**

1. **No persiste** entre restarts del container ni cuando MikoPBX regenera
   configs (lo hace al cambiar empleados desde la GUI).
2. **No basta para hacer funcionar la llamada** — el INVITE sigue siendo
   rechazado por bug 3.3 abajo.

**Cómo persistirlo:**

- Opción A: crear un overlay en `infra/mikopbx/overlay/etc/asterisk/extensions_override.conf` montado como bind-mount via volumen.
- Opción B: rebuild de la imagen MikoPBX con el sed aplicado en el Dockerfile (no recomendable por mantenimiento).
- Opción C: hook de startup que aplique el sed al boot del container.

## 4. Bug BLOQUEANTE sin resolver

### 4.1 — MikoPBX `From: <sip:X@227216678a3e>` rompe sip.js

**Síntoma:** sip.js consola del browser:

```
sip.Parser   | error parsing header 'From'
sip.UserAgent | Failed to parse incoming message. Dropping.
```

…cada vez que MikoPBX envía un `OPTIONS` de qualify al softphone.

**Causa raíz:**

MikoPBX usa el **hostname del contenedor** (`227216678a3e`, el hash que Docker
asigna) como el dominio SIP en el header `From` cuando origina mensajes.
Ejemplo del trace del browser:

```
OPTIONS sip:71bagjok@172.18.0.1:46696;transport=ws SIP/2.0
From: <sip:1001@227216678a3e>;tag=77aeca92-...
```

sip.js valida el dominio SIP contra una whitelist (RFC 3261 + reglas
internas) y `227216678a3e` no pasa porque:

- No es un hostname con TLD válido (sin punto).
- No es una IP.
- No matchea el `realm` que el client conoce (`localhost`).

**Consecuencias en cascada:**

1. sip.js descarta cada OPTIONS de qualify → MikoPBX nunca recibe la
   respuesta → marca el endpoint como Unreachable.
2. El dialplan filtra los Unreachable → DST_CONTACT="" → CHANUNAVAIL.
3. Mi parche del bug 3.2 evita el filtro, pero el INVITE en sí
   probablemente también lleva un `From:` o `To:` con el hostname del
   container → sip.js o el peer remoto lo rechaza igualmente.

**Cómo arreglar (próxima sesión):**

Opciones por orden de simplicidad:

1. **Cambiar el hostname del container** en `docker-compose.yml`:

   ```yaml
   mikopbx:
     image: mikopbx/mikopbx:2026.2.118
     hostname: mikopbx.local      # <-- añadir
     container_name: ucgi-mikopbx
   ```

   Eso hace que el From sea `<sip:1001@mikopbx.local>` que sip.js puede
   parsear.

2. **Configurar PJSIP global** para usar `localhost` como SIP domain:

   ```ini
   [global]
   type = global
   default_realm = localhost
   ```

   y en cada transport:

   ```ini
   [transport-wss]
   type = transport
   protocol = wss
   external_signaling_address = localhost
   external_signaling_port = 8089
   ```

   Esto requiere modificar `pjsip.conf` que MikoPBX gestiona desde su propia
   DB SQLite (no es un archivo plano). Vía GUI no se ve esa opción; vía
   Asterisk CLI con `pjsip set realtime` o editando la DB directamente.

3. **Cambiar el cliente** del CRM de `sip.js` a `JsSIP` o `WebRTC nativo` — más
   permisivos con headers no estándar. Cambia bastante código del SipClient.

**Mi recomendación:** Opción 1 (hostname del container). Es la más rápida
y barata. Combinada con un sed persistente del bug 3.2, deja la demo
funcionando.

## 5. Plan B viable para demo HOY (Linphone Desktop UDP)

El bug 4.1 afecta solo a sip.js (CRM softphone WebRTC). Linphone Desktop
clásico usa SIP UDP 5060 puro — **no pasa por WSS ni por sip.js**, por lo
tanto no debería tener este problema.

Setup:
1. Descargar Linphone Desktop: <https://www.linphone.org/en/download-linphone-desktop/>.
2. **Cuentas → Añadir cuenta SIP**:
   - Username: `1001` (o 1002)
   - SIP domain: `localhost`
   - Password: `sip-demo-1001` (o `sip-demo-1002`)
   - Display name: `Agente Uno`
   - Transport: `UDP`
   - Proxy server: `sip:localhost:5060`
3. Indicator debe pasar a verde "Registered" en <5s.
4. Llamar desde Linphone a `1002` (otro Linphone o el CRM si lo resolvemos).
5. Hablar, colgar.
6. MikoPBX GUI → Historial de llamadas → ▶️ escuchar la grabación WAV.

**Esto SÍ es exactamente lo que demostró el profesor.** El plan A
(softphone integrado en CRM) es una ambición extra del lab que requiere
deuda S4 para cerrarla.

## 6. Cómo seguir en Sprint 4

Orden sugerido de ataque (de menor a mayor complejidad):

1. **Persistir parche dialplan (bug 3.2)** — overlay file + bind-mount en compose.
2. **Cambiar hostname del container MikoPBX (bug 4.1 opción 1)** — 1 línea en compose, ~10 min.
3. **Probar el CRM softphone end-to-end** después de los 2 fixes anteriores. Si funciona, ¡ganamos!
4. **Si NO funciona aún**, investigar `external_signaling_address` (bug 4.1 opción 2) — más laborioso.
5. **Bug 3.1 del cliente Java MikoPBX** — Apache HttpClient 5 o redirect manual. Esto desbloquea HU-05.3 e2e (asignar rol AgenteCallCenter via midPoint dispara la creación de extensión en MikoPBX).
6. Sprint 4 oficial: HU-06.1/06.2/etc. (calidad, JaCoCo, quitar -DskipTests).

## 7. Commits acumulados sin pushear

Branch local `feature/hotfix-spring61-mikopbx-bcrypt-seed` (8 commits):

```
03a6390  fix(crm): VITE_SIP_WS_URL /asterisk/ws · Joaquín
72f9589  fix(nginx): /api/ sin strip · RSocualaya
a718a9c  docs(plan): cierre S3 al 100% · Ash-e
037362a  docs(runbook): credenciales-y-puertos · Ash-e
b361508  fix(api): @Autowired + MikoPbxRestClient HTTPS · Joaquín
2f81b23  fix(seed): bcrypt válidos para demo1234 · Ash-e
e49cff4  fix(prometheus): configs reales · RSocualaya
```

PR sugerido: `feature/hotfix-spring61-mikopbx-bcrypt-seed → develop` con
título "hotfix: 7 bugs descubiertos en levantamiento del stack [POST-S3]".
La merge label de JIRA puede asociar a un nuevo issue tipo Error
(IUDCYGI-172 o el siguiente disponible) si vale documentarlo formalmente.
