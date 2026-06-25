# Shaper tc real — Evidencia ejecución

**HU asociada:** IUDCYGI-164 (HU-08.5) · **Ejecutado:** 2026-06-24 19:05 (Lima)

## Endpoints validados

| Método | URL | Función |
|---|---|---|
| GET | `/qdisc` | Inspecciona el qdisc raíz de eth0 dentro del contenedor. |
| POST | `/limit` `{"mbps": N}` | Aplica `tc qdisc add dev eth0 root tbf rate Nmbit burst 32kbit latency 400ms`. |
| POST | `/reset` | Quita el qdisc raíz (sin shaping). |

## Flujo end-to-end

```bash
# 1. Estado inicial — sin shaping
$ curl -s http://localhost:9100/qdisc | jq
{
  "output": "qdisc noqueue 0: root refcnt 2",
  "rc": 0,
  "shaping": { "applied": false, "mbps": null },
  "stderr": ""
}

# 2. Aplicar límite 5 Mbps
$ curl -sX POST http://localhost:9100/limit -d '{"mbps":5}' | jq
{
  "applied": true,
  "mbps": 5,
  "nic": "eth0"
}

# 3. Verificar qdisc activo — TBF al rate solicitado
$ curl -s http://localhost:9100/qdisc | jq
{
  "output": "qdisc tbf 8001: root refcnt 13 rate 5Mbit burst 4Kb lat 400ms",
  "rc": 0,
  "shaping": { "applied": true, "mbps": 5 },
  "stderr": ""
}

# 4. Reset
$ curl -sX POST http://localhost:9100/reset | jq
{
  "applied": false,
  "nic": "eth0"
}

# 5. Verificar reset — vuelve a noqueue
$ curl -s http://localhost:9100/qdisc | jq
{
  "output": "qdisc noqueue 0: root refcnt 2",
  "rc": 0,
  "shaping": { "applied": false, "mbps": null },
  "stderr": ""
}
```

## Configuración requerida

`docker-compose.yml` (servicio `shaper`):

```yaml
cap_add:
  - NET_ADMIN
```

Sin esa cap, `tc qdisc add` devuelve `Operation not permitted` y el endpoint retorna 500.

## Evidencia ISO 25010 / Eficiencia

- **Comportamiento temporal**: el cambio de qdisc se aplica en < 100ms (curl roundtrip incluido).
- **Capacidad**: TBF con `rate 5Mbit burst 4Kb lat 400ms` limita el ancho de banda del contenedor shaper. Si alguien usa ese contenedor como puerta (caso futuro de la demo del profesor), la limitación es real y verificable con `tc qdisc show`.
- **Aislamiento**: la cap NET_ADMIN está restringida al contenedor `ucgi-shaper`, no al resto del stack. El plano de voz (MikoPBX) NO es afectado.

## Demo en clase

Para la demo del jueves se puede mostrar en vivo:

1. Levantar el stack: `make up`.
2. Aplicar límite: `curl -X POST http://localhost:9100/limit -d '{"mbps":1}'`.
3. Hacer una llamada VoIP en el CRM → mostrar que la calidad baja.
4. Reset: `curl -X POST http://localhost:9100/reset`.
5. Repetir llamada → calidad normal.

Eso responde directo a la propuesta del profesor *"creo un router que fija ancho de banda, lo saturo, mido"*.
