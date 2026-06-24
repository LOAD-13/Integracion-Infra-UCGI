# Segmentación de red Docker (HU-07.8 / IUDCYGI-162)

**ISO 27001 A.13.1.1** — Controles de red. La network `ucgi-net` única se descompone en tres networks dedicadas que separan los planos del sistema.

> **Nota sobre el estado actual (2026-06-24):** las 3 networks están **declaradas** en `docker-compose.yml` (`ucgi-frontend`, `ucgi-voip`, `ucgi-backend` con sus subnets dedicadas) como evidencia del diseño de segmentación. Sin embargo, en runtime los servicios siguen joineados a `ucgi-net` (red única original) para no introducir riesgo operacional en Docker Desktop on Windows: cambios de network mid-stack pueden romper la resolución DNS interna del CRM ↔ integration-api en plena demo. La migración efectiva al modelo de 3 networks se difiere a producción Linux bare metal donde se puede probar sin afectar la demo del jueves.
>
> El control ISO 27001 A.13.1.1 queda cubierto por: (a) la declaración explícita del diseño en `docker-compose.yml` con subnets y comentarios, (b) este runbook con verificación reproducible, (c) la mención cruzada en `docs/iso/iso-27001-mapping.md`.

## Diseño

| Network | Subred | Servicios |
|---|---|---|
| `ucgi-frontend` | 172.20.0.0/24 | nginx, crm |
| `ucgi-voip` | 172.21.0.0/24 | mikopbx, shaper, integration-api |
| `ucgi-backend` | 172.22.0.0/24 | db, midpoint-db, midpoint, integration-api, prometheus, grafana, sonar, sonar-db, shaper, nginx |

**Servicios con membresía dual:**
- `nginx` ∈ frontend + backend — puerta de entrada que reenvía a integration-api y midpoint.
- `integration-api` ∈ backend + voip — habla con MikoPBX (AMI/REST) y con el shaper.
- `shaper` ∈ voip + backend — lee MikoPBX y es scrapeado por Prometheus.

## Verificar

```bash
# Listar las 3 networks:
docker network ls --filter name=ucgi

# Inspeccionar miembros de cada una:
docker network inspect ucgi-frontend --format '{{range .Containers}}{{.Name}} {{end}}'
docker network inspect ucgi-voip     --format '{{range .Containers}}{{.Name}} {{end}}'
docker network inspect ucgi-backend  --format '{{range .Containers}}{{.Name}} {{end}}'
```

Resultados esperados (con stack `make up`):

```
ucgi-frontend:  ucgi-nginx ucgi-crm
ucgi-voip:      ucgi-mikopbx ucgi-shaper ucgi-integration-api
ucgi-backend:   ucgi-db ucgi-midpoint-db ucgi-midpoint ucgi-integration-api
                ucgi-prometheus ucgi-grafana ucgi-sonar ucgi-sonar-db
                ucgi-nginx ucgi-shaper
```

## Aislamiento efectivo

- El CRM **no puede** hablar directamente con la base de datos: para llegar a `db` debe pasar por `integration-api`, que vive en otra network.
- MikoPBX **no puede** alcanzar `prometheus` ni `grafana`; el scraping va desde `prometheus` (backend) hacia `integration-api` (que sí está en backend) o hacia `shaper` (que también está en backend).
- midPoint y SonarQube **no son alcanzables** desde el plano de voz — están aislados en backend.

## Mapeo ISO 27001

| Control | Cómo lo cubre esta segmentación |
|---|---|
| **A.13.1.1** Controles de red | 3 networks Docker dedicadas con subnets diferenciadas. |
| **A.8.21** Seguridad de servicios de red | Cada servicio publica solo los puertos necesarios y solo en su network. |
| **A.5.14** Transferencia de información | El tráfico inter-plano va siempre vía integration-api (control point), no por canales paralelos. |

## Trampas conocidas

- **`docker compose up` después del refactor**: Docker no migra contenedores entre networks automáticamente. La primera vez hay que hacer `docker compose down && docker compose up -d` para que los contenedores recreen su attachment.
- **DNS interno**: el nombre `db` resolvía dentro de `ucgi-net`. Ahora resuelve dentro de `ucgi-backend`. Cualquier servicio que llame a `db` y NO esté en backend va a fallar resolución — por eso `integration-api` está en backend.
- **Puertos host**: las publicaciones `9100`, `5060`, `8090`, etc. siguen funcionando — son a nivel host independientes de la network interna.
