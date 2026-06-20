# Credenciales y puertos del stack UCGI

> Referencia operativa para Joaquín durante el desarrollo y la defensa.
> **Solo aplica al entorno de DESARROLLO** (compose con `.env.example`).
> Última actualización: 2026-06-20.

## Resumen visual

| Servicio | URL host | Puerto interno | Credencial principal |
|---|---|---|---|
| **CRM** | https://localhost (vía nginx) | `crm:3000` | `agente1` / `demo1234` |
| **Integration API** | http://localhost:8081 | `integration-api:8081` | Bearer JWT del login del CRM |
| **MikoPBX GUI** | http://localhost:8090 · https://localhost:8443 | `mikopbx:80` / `mikopbx:443` | `admin` / `Deathnote2005` |
| **MikoPBX SIP** | UDP/TCP 5060 · TLS 5061 · WS 8088 · WSS 8089 | mismos | extensiones SIP — ver abajo |
| **MikoPBX RTP** | UDP 10000-10200 | mismos | — |
| **midPoint UI** | http://localhost:8080/midpoint/ | `midpoint:8080` | `administrator` / `5ecr3t` |
| **Shaper** | http://localhost:9100/status | `shaper:9100` | sin auth (admin endpoint `POST /admin/bandwidth`) |
| **Prometheus** | http://localhost:9090 | `prometheus:9090` | sin auth |
| **Grafana** | http://localhost:3001 | `grafana:3000` | `admin` / `changeme` |
| **SonarQube** | http://localhost:9000 | `sonar:9000` | `admin` / `admin` (cambia al primer login) |
| **MariaDB (CRM)** | — (sin port host) | `db:3306` | `ucgi_app` / `changeme-app` (root: `changeme-root`) |
| **Postgres (midPoint)** | — | `midpoint-db:5432` | `midpoint` / `changeme-mp` |
| **Postgres (Sonar)** | — | `sonar-db:5432` | `sonar` / `changeme-sonar` (default Sonar) |

## 1. CRM (browser-facing)

**URL:** `https://localhost` (acepta el cert autofirmado en el browser).
La pantalla principal te lleva a `/login`.

### Usuarios seed

| Username | Password | Rol | Extensión SIP asignada |
|---|---|---|---|
| `admin` | `demo1234` | ADMIN | — (no agente) |
| `agente1` | `demo1234` | AGENTE | 1001 |
| `agente2` | `demo1234` | AGENTE | 1002 |

> **Nota:** los hashes bcrypt del seed (`03-seed-data.sql`) están **corruptos**
> en la versión committeada — no corresponden a "demo1234" como dice el
> comentario. Los hashes correctos los regeneré directamente en la DB.
> Hay un fix pendiente en el branch `feature/hotfix-spring61-mikopbx-bcrypt-seed`
> que repara el seed para que `docker compose down -v` + `up` deje todo en
> estado consistente.

### Rutas internas del CRM (vía nginx)

- `/` → `crm:3000` (Vite SPA servido por nginx alpine).
- `/api/` → `integration-api:8081`.
- `/midpoint/` → `midpoint:8080`.
- `/ws` → `mikopbx:8088` (WebSocket SIP.js — fix de HU-04.2).
- `/healthz` → "ok".

## 2. Integration API (REST)

**URL host:** `http://localhost:8081`.

### Endpoints relevantes

| Path | Auth | HU |
|---|---|---|
| `POST /api/v1/auth/login` | no (público) | HU-03.5 |
| `GET /api/v1/me/sip-credentials` | Bearer | HU-04.2 |
| `POST /api/v1/sip-extensions` | Bearer | HU-03.2 |
| `GET /api/v1/clients`, `POST`, `PUT`, `DELETE` | Bearer | HU-04.3 |
| `GET /api/v1/cdr?clientId=...` | Bearer | HU-03.6 / HU-04.5 |
| `GET`, `POST`, `PUT /api/v1/notes` | Bearer | HU-04.6 |
| `GET /api/v1/metrics/agent` | Bearer | HU-04.7 |
| `GET /api/v1/users`, `POST`, `PUT/{id}/role`, `DELETE` | Bearer ROLE_ADMIN | HU-04.8 |
| `GET /actuator/health`, `/actuator/prometheus` | no (público) | HU-03.1 |

### Cómo obtener un Bearer rápido (terminal)

```bash
curl -sS -X POST http://localhost:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"demo1234"}'
```

## 3. MikoPBX

- **GUI HTTP:** http://localhost:8090 (admin / `Deathnote2005`).
- **GUI HTTPS:** https://localhost:8443 (mismo cred, cert autofirmado).
- **REST API:** mismos puertos, prefijo `/pbxcore/api/v3/`. Auth con login+password (devuelve JWT 15 min).
- **AMI:** `mikopbx:5038` (solo red interna, no expuesto al host).
- **API key** persistente (en `.env`): `MIKOPBX_API_KEY=d5d3f1e4...`. **No se usa en el cliente Java** — el formato Bearer raw no autentica. Reservado para HU-07.x.

### Extensiones SIP (seed CRM)

| Ext | Username CRM | SIP password |
|---|---|---|
| 1001 | agente1 | `sip-demo-1001` |
| 1002 | agente2 | `sip-demo-1002` |

> **Importante:** las extensiones existen en `crm.sip_extensions` pero la
> provisión real a MikoPBX falla por un bug del cliente Java (POST 301
> redirect HTTP→HTTPS pierde el body). Para la demo, crearlas manualmente
> desde la GUI de MikoPBX (Telephony → Employees) o vía `curl` con login
> JWT al endpoint `POST /pbxcore/api/v3/employees`. **Deuda de Sprint 4.**

## 4. midPoint

- **UI:** http://localhost:8080/midpoint/ (`administrator` / `5ecr3t`).
- **REST:** `POST /midpoint/ws/rest/...` con basic auth.
- Recursos SQL (HU-05.1) y REST (HU-05.2) **definidos en XML** pero todavía
  no importados al midPoint corriendo — usar los `curl` documentados en
  `docs/midpoint/recursos.md`.
- El driver MariaDB para el recurso SQL **no está incluido** en la imagen
  midPoint todavía (deuda S4).

## 5. Shaper

- `GET http://localhost:9100/status` → `{"bandwidthMbps":50,"qdiscActive":false,"policy":"FULL"}`.
- `GET http://localhost:9100/healthz` → "ok".
- `POST http://localhost:9100/admin/bandwidth` body `{"mbps":<int>}` para cambiar el BW reportado en runtime (útil para demo de HU-03.7).

```bash
# Forzar tier DOWNGRADED (espera ~10s para que integration-api lo recoja):
curl -X POST http://localhost:9100/admin/bandwidth \
  -H 'Content-Type: application/json' \
  -d '{"mbps":5}'

# Verlo aplicado en logs:
docker logs ucgi-integration-api --tail 30 | grep "Shaper policy change"
```

## 6. Observabilidad

- **Prometheus:** http://localhost:9090 — scrape de `integration-api`, `shaper` y sí mismo. Reglas reales en HU-08.2.
- **Grafana:** http://localhost:3001 (`admin` / `changeme`). Dashboards en HU-08.2/03.

## 7. Bases de datos

### MariaDB (CRM)

Sin port host. Para conectarse desde tu equipo:

```bash
docker exec -it ucgi-db mariadb -uroot -pchangeme-root crm
```

Schemas relevantes:
- `crm` — tablas: `users`, `sip_extensions`, `clients`, `agent_assignments`, `notes`, `cdr`.

### Postgres midPoint / Sonar

Iguales — solo accesibles desde dentro del compose. Para Sonar:

```bash
docker exec -it ucgi-sonar-db psql -U sonar
```

## 8. Cosas que NO están todavía

- Recursos midPoint **no importados** al midPoint corriendo (los XMLs existen, hay que hacer `curl POST /midpoint/ws/rest/resources`).
- Driver MariaDB no copiado a la imagen midPoint.
- Provisión SIP real desde el API no funciona (HU-03.8 bug).
- CI sigue con `-DskipTests` global salvo el step específico de mappings + shaper.

Estas son las deudas explícitas que entran al Sprint 4.
