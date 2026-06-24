# Pruebas de carga con SIPp

**HU asociada:** IUDCYGI-51 (HU-08.3) — pruebas de carga 50 cc contra MikoPBX.

Estos escenarios sintetizan llamadas SIP/UDP contra MikoPBX para medir Eficiencia (ISO 25010 §2 Comportamiento temporal + Capacidad) bajo carga simultánea.

## Archivos

| Archivo | Rol |
|---|---|
| `sipp-uac.xml` | Lado caller — manda INVITE, espera 200, ACK, pausa 5 s, BYE. |
| `sipp-uas.xml` | Lado callee — recibe INVITE, responde 180 → 200, espera ACK + BYE. |
| `run-stress.sh` | Wrapper: 10 cps, hasta 50 cc, 60 s. Exporta CSV + log + tasa de éxito. |

## Pre-requisitos

```bash
# Instalá sip-tester o usá la imagen oficial
sudo apt install sip-tester
# o
docker run --rm --network=host -v "$PWD/tests/load:/sipp" \
  ctaloi/sipp /sipp/sipp-uac.xml ...
```

Crear una extensión de prueba (1099 por default) en MikoPBX sin autenticación o con password conocido (settear `SIP_USER`/`SIP_PASS`).

## Ejecutar

```bash
# 50 cc, 10 cps, 60 segundos, contra MikoPBX local:
bash tests/load/run-stress.sh 127.0.0.1 5060 10 50

# Custom extension:
SIP_TARGET_EXT=1098 TEST_DURATION=120 bash tests/load/run-stress.sh
```

## Salida

- `tests/load/results/stress-<timestamp>.csv` — métricas por segundo (CallRate, latency, response time, etc).
- `tests/load/results/stress-<timestamp>.log` — output completo de SIPp.
- Stdout: tabla resumen Total / Exitosas / Falladas + tasa de éxito.

**Criterio HU-08.3:** tasa de éxito ≥ 95% sobre la corrida de 60 s.

## Lo que NO cubre

- Carga real RTP (sólo señalización). Para SRTP plain RTP se necesita `-rsa` con codecs específicos.
- Llamadas con video (g.711a). Para video se requiere escenario distinto con SDP de m=video.
- Picos > 100 cc — fuera del scope del lab por limitaciones del entorno Docker Desktop.
