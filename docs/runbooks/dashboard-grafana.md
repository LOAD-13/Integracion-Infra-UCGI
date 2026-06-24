# Dashboard Grafana — UCGI Overview

**HU asociada:** IUDCYGI-50 (HU-08.2) — Dashboard ampliado con paneles SLI/SLO + Capacidad + Códec.

Acceso: `http://localhost:3001` · usuario/clave por default `admin/admin` (cambiar al primer login).

## Paneles (25 totales)

### Header (paneles 1-7)
- **Integration API**: up/down de cada job de Prometheus.
- **Shaper**: estado del contenedor `ucgi-shaper` + tier activo.
- **Codec actual**: códec audio + video elegido por el shaper.
- **Tráfico actual**: RX+TX en Mbps medido en `/sys/class/net/eth0`.
- **Llamadas activas**: leído de MikoPBX REST `/v3/calls/active`.
- **Req/s 5m + Error rate 5m**: latencia y ratio de 5xx.

### Series temporales (paneles 10-22, 30-32, 40-41, 50-51)
- HTTP requests/sec por endpoint.
- Latency p50/p95/p99 del integration-api.
- Shaper: tráfico Mbps + llamadas activas + tier en el tiempo + required kbps.
- JVM: Heap, GC pause, threads.
- Hikari: conexiones DB + latencia adquisición + uso.
- Prometheus: scrape duration + estado de targets.

### Nuevos paneles SLI/SLO (52-55) — HU-08.2

Cuatro indicadores con verde/amarillo/rojo según el SLO de cada métrica:

| ID | Panel | SLO | Verde | Amarillo | Rojo |
|---|---|---|---|---|---|
| 52 | Disponibilidad API | `up == 1` | UP | — | DOWN |
| 53 | Latencia p95 | < 200 ms | < 200 ms | 200-500 ms | > 500 ms |
| 54 | Error rate | < 5% | < 1% | 1-5% | > 5% |
| 55 | Tier shaper | tier ≥ 2 | FULL (3) | MIXED (2) | DOWNGRADED (1) / EMERGENCY (0) |

### Capacidad y umbral 70% (panel 56)

Timeseries con:
- Línea de **llamadas activas** (`ucgi_shaper_active_calls`).
- Línea de **tráfico total Mbps** (`ucgi_shaper_traffic_total_mbps`).
- Threshold visual en **35** (umbral 50%) y **70** (umbral 70%).

Cuando la línea de activas cruza la zona roja (≥ 70), el shaper inicia downgrade de tier en el próximo evaluation.

### Códec por sesión (panel 57)

Tabla viva. Por ahora muestra el códec dominante (`ucgi_shaper_codec_info` gauge con label).

**Limitación documentada:** la tabla por sesión real (extensión orig → dest → códec → MOS → jitter → packet loss) requiere un exporter Asterisk con métricas por canal. Ese exporter se diferirá a HU-09.x.

## Métricas Prometheus que consume

- `up{job="integration-api"}`
- `http_server_requests_seconds_count` / `_bucket`
- `ucgi_shaper_tier`
- `ucgi_shaper_active_calls`
- `ucgi_shaper_traffic_total_mbps`
- `ucgi_shaper_codec_info`
- `ucgi_shaper_required_kbps`

## Editar el dashboard

El JSON está en `infra/grafana/dashboards/ucgi-overview.json` y se monta read-only en el contenedor `ucgi-grafana`. Cambios:

1. Editar el JSON (preferí mantenerlo idempotente y versionar).
2. `docker compose restart grafana` — Grafana relee el JSON al boot.
3. Si hacés ediciones desde la UI, exportá el JSON y reemplazá el del repo.

## Alertas asociadas (HU-08.4)

Los thresholds de los paneles SLI/SLO coinciden con las reglas de `infra/prometheus/alerts.yml`:
- `ApiLatencyP95High` → panel 53 zona roja.
- `ApiErrorRateHigh` → panel 54 zona roja.
- `IntegrationApiDown` → panel 52 DOWN.
- `BandwidthSaturated` → panel 56 zona roja.
- `CodecDowngradeForced` → panel 55 amarillo/naranja.
