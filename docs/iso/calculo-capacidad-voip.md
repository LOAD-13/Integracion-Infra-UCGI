# Cálculo de capacidad VoIP: códecs, overhead, llamadas simultáneas y demostración

> **Documento ISO 25010 — Eficiencia de Desempeño.**
> Materializa la respuesta a la pregunta del profesor: *"¿cuántas llamadas simultáneas soporta el sistema con X Mbps?"*. Combina la fórmula teórica con la demostración práctica vía `ucgi-shaper` + downgrade automático de códec.

---

## 1. Propósito

Este documento responde a tres preguntas que la rúbrica del lab y el profesor formulan explícitamente:

1. **¿Cuál es la capacidad teórica de llamadas simultáneas según el ancho de banda disponible?**
2. **¿Cómo lo demostramos en runtime sin un router físico?**
3. **¿Cómo reacciona el sistema cuando el ancho de banda disponible disminuye?**

La respuesta es una combinación de **fórmulas matemáticas**, una **herramienta interactiva standalone** (`tools/voip-bw-calculator/`) y un **servicio en compose** (`services/ucgi-shaper/`) que limita el BW en runtime y orquesta el downgrade de códec vía `integration-api`.

---

## 2. Fórmula matemática del ancho de banda por llamada

El bitrate del códec **NO es** el ancho de banda que la llamada consume en la red. A los `bitrate_audio` hay que sumarles las cabeceras de los protocolos de transporte:

```
Payload audio por paquete  = bitrate_audio × intervalo_paquete
Overhead por paquete       = RTP(12) + UDP(8) + IPv4(20) + Ethernet(18) = 58 bytes
Paquetes por segundo (pps) = 1000 / intervalo_paquete_ms

BW por sentido (bps) = (payload_audio_bytes + overhead_bytes) × 8 × pps
BW por llamada (bps) = 2 × BW por sentido    (dos sentidos: agente1 ↔ agente2)
```

### 2.1 Constantes por códec

| Códec | Bitrate audio | Intervalo paquete | Bytes payload | pps | Bytes total/paquete | BW por sentido | BW por llamada |
|-------|---------------|-------------------|---------------|-----|---------------------|----------------|----------------|
| **G.711 ALAW** | 64 kbps | 20 ms | 160 | 50 | 218 | 87.2 kbps | **174.4 kbps** |
| **G.711 ULAW** | 64 kbps | 20 ms | 160 | 50 | 218 | 87.2 kbps | **174.4 kbps** |
| **GSM 06.10** | 13 kbps | 20 ms | 33 | 50 | 91 | 36.4 kbps | **72.8 kbps** |
| **G.729A** | 8 kbps | 20 ms | 20 | 50 | 78 | 31.2 kbps | **62.4 kbps** |
| **Opus @ 24 kbps** | 24 kbps | 20 ms | 60 | 50 | 118 | 47.2 kbps | **94.4 kbps** |

> Los valores de bytes de payload se obtienen de `bitrate × intervalo / 8`. Para G.729 el frame nativo es 10 ms (10 bytes), pero se paquetiza con 2 frames por paquete (20 ms, 20 bytes), por eso pps = 50.

### 2.2 Llamadas simultáneas teóricas

```
Llamadas teóricas = BW_total / BW_por_llamada
Llamadas reales   = Llamadas teóricas × (1 - holgura)
```

Holgura recomendada: **30%** para absorber jitter, retransmisiones y picos de control. Tabla resultado:

| Códec | BW por llamada | Llamadas teóricas (50 Mbps) | Llamadas reales (30% holgura) | Llamadas reales (100 Mbps) | Llamadas reales (1 Gbps) |
|-------|----------------|-----------------------------|-------------------------------|----------------------------|---------------------------|
| **G.711** | 174.4 kbps | 286 | **200** | 401 | 4 013 |
| **GSM** | 72.8 kbps | 686 | **480** | 961 | 9 615 |
| **G.729** | 62.4 kbps | 801 | **560** | 1 121 | 11 217 |
| **Opus** | 94.4 kbps | 529 | **370** | 740 | 7 415 |

### 2.3 Implementación de la fórmula en código

La fórmula vive en `tools/voip-bw-calculator/bw_calc.py` con tests unitarios. Pseudocódigo:

```python
RTP_UDP_IP_ETH_OVERHEAD = 58  # bytes
PACKET_INTERVAL_MS = 20

CODECS = {
    "g711_alaw":  {"bitrate_kbps": 64, "frame_bytes": 160},
    "g711_ulaw":  {"bitrate_kbps": 64, "frame_bytes": 160},
    "gsm":        {"bitrate_kbps": 13, "frame_bytes": 33},
    "g729":       {"bitrate_kbps":  8, "frame_bytes": 20},
    "opus_24":    {"bitrate_kbps": 24, "frame_bytes": 60},
}

def bw_per_call_kbps(codec):
    pps = 1000 / PACKET_INTERVAL_MS
    total_bytes_per_packet = CODECS[codec]["frame_bytes"] + RTP_UDP_IP_ETH_OVERHEAD
    bps_per_direction = total_bytes_per_packet * 8 * pps
    return 2 * bps_per_direction / 1000  # kbps total, ida + vuelta

def max_simultaneous_calls(total_bw_mbps, codec, headroom_pct=30):
    bw_call_kbps = bw_per_call_kbps(codec)
    total_kbps = total_bw_mbps * 1000
    theoretical = total_kbps / bw_call_kbps
    realistic = theoretical * (1 - headroom_pct / 100)
    return int(realistic)
```

---

## 3. Herramientas que materializan el cálculo

### 3.1 Calculadora interactiva standalone — `tools/voip-bw-calculator/`

**Para qué:** defensa pedagógica. Cualquiera con Python instalado puede correrla y jugar con los parámetros sin levantar el stack. Útil en la presentación del jueves (sin Docker) y como anexo del informe.

**Cómo correrla:**

```bash
cd tools/voip-bw-calculator
pip install -r requirements.txt
python calculator.py
```

**Lo que muestra:** una ventana Tkinter con sliders de BW y holgura, tabla en vivo de llamadas reales por códec, gráfica de barras comparativas (matplotlib embebido), y la fórmula aplicada visible al pie. Detalles técnicos en `tools/voip-bw-calculator/README.md`.

### 3.2 Shaper en runtime — `services/ucgi-shaper/`

**Para qué:** defensa funcional. El sistema real reacciona ante una limitación de BW. El profesor lo pidió explícitamente: *"creo un router/firewall que me fija ancho de banda como si fuera cliente. Saturo el firewall, degrado la calidad, ¿hasta cuánto soporta?"*.

**Cómo funciona:**

```
                       ┌────────────────────────────────┐
                       │  ucgi-shaper (Alpine + tc)     │
[asterisk]──RTP/UDP───►│  tc qdisc add dev eth0 root    │
                       │     tbf rate 5mbit             │
                       │  ◄── ajustable en runtime ───  │
                       │                                │
                       │  API REST (Flask):             │
                       │  POST /limit  {mbps: 5}        │
                       │  GET  /status → {mbps, queue}  │
                       │  GET  /metrics  ← Prometheus   │
                       └────────────────────────────────┘
                                    │
                                    ▼
                               resto de la red
```

**Endpoints:**

| Método | Path | Body | Respuesta |
|--------|------|------|-----------|
| `POST` | `/limit` | `{"mbps": <int>}` | `200 {"applied": true, "mbps": 5}` |
| `GET` | `/status` | — | `{"mbps": 5, "queue_packets": 12, "active_calls_estimate": 28}` |
| `GET` | `/metrics` | — | Texto Prometheus con `shaper_mbps`, `shaper_queue_packets`, etc. |
| `POST` | `/reset` | — | Quita todo el shaping, vuelve a BW ilimitado |

### 3.3 Integración con `integration-api` — downgrade automático de códec

El `integration-api` consulta periódicamente (cada 10 s) el endpoint `/status` del shaper. La decisión de tier se toma con la **misma fórmula que la calculadora** (§2), aplicada al BW reportado y la concurrencia activa:

```
usable_bw_kbps = bandwidthMbps * 1000 * (1 - HEADROOM)        # HEADROOM = 0.20

decisión(bandwidthMbps, activeCalls):
  cc = activeCalls + 1                                         # +1 = próxima llamada
  required_opus = bw_per_call_kbps("opus_24")  * cc            # ≈  94.4 * cc
  required_g711 = bw_per_call_kbps("g711_alaw") * cc           # ≈ 174.4 * cc
  required_g729 = bw_per_call_kbps("g729")     * cc            # ≈  62.4 * cc

  if usable_bw_kbps >= required_g711:  return "FULL"           # opus 24 + video
  if usable_bw_kbps >= required_opus:  return "MIXED"          # opus solo audio
  if usable_bw_kbps >= required_g729:  return "DOWNGRADED"     # g729 comprimido
  return "EMERGENCY"                                             # rechazar llamadas nuevas
```

> El orden de comparación es G.711 → opus → G.729: queremos darle al CRM **el códec más amigable con WebRTC y video** mientras el BW lo permita. Sólo bajamos a G.729 cuando el BW deja de alcanzar incluso para opus a la concurrencia esperada.

| Tier reportado | Códec preferente que el `integration-api` aplica en `pjsip.conf` |
|----------------|------------------------------------------------------------------|
| **FULL** | `allow = opus,ulaw,alaw,gsm,g729` + `vp8,h264` (calidad máxima) |
| **MIXED** | `allow = opus,gsm,g729,ulaw,alaw` (audio solamente) |
| **DOWNGRADED** | `allow = g729,gsm,ulaw,alaw` (priorizar eficiencia) |
| **EMERGENCY** | `allow = g729,gsm` y rechazo de llamadas nuevas con `503` |

Tras reescribir el archivo, el `integration-api` ejecuta `pjsip reload` vía AMI (o lanza el equivalente REST en MikoPBX). **Las llamadas nuevas** se inician con el códec apropiado. **Las llamadas existentes** mantienen su códec original (limitación documentada como evolución futura: re-INVITE en mitad de llamada vía AMI, ver §6).

### 3.4 Coherencia entre la calculadora, el shaper y el integration-api

La fórmula es **idéntica en los tres componentes**: mismos `frame_bytes` por códec, mismo overhead `58 B`, mismo `pps = 50`, misma `HEADROOM = 0.20`. Esto evita la trampa clásica de tener una hoja de cálculo Excel diciendo "X" y el sistema reaccionando con "Y". Verificación:

| Componente | Archivo | Función con la fórmula |
|------------|---------|------------------------|
| Calculadora Tkinter | `tools/voip-bw-calculator/bw_calc.py` | `bw_per_call_kbps(codec)` |
| Shaper Flask runtime | `infra/shaper/app.py` | `bw_per_call_kbps(codec)` + `_decide_tier(...)` |
| Integration-api | `services/integration-api/.../shaper/ShaperPollingService.java` | `decideTier(status)` lee `policy` del shaper |

El shaper expone el tier ya calculado en `/status.policy` para evitar re-implementar la fórmula en Java. El integration-api solo necesita consumir ese campo.

---

## 4. Demo guiada paso a paso (para la defensa final)

Esta secuencia es la que se demuestra ante el profesor y queda grabada en el video de la HU-09.3.

1. **Estado inicial — capacidad máxima.**
   - `curl -X POST http://localhost:9100/limit -d '{"mbps": 100}'`
   - En Grafana, panel "Capacidad y umbral" muestra: BW = 100 Mbps, llamadas teóricas (G.711) = 574, activas = 0.

2. **Generar tráfico — 100 llamadas concurrentes en G.711.**
   - `services/sipp-scenarios/run-stress.sh --codec ulaw --concurrent 100`
   - Panel "Capacidad y umbral" muestra: activas = 100, lejos del umbral.
   - Panel "Códec por sesión" muestra todas las sesiones con G.711 ULAW en verde.

3. **Saturar el shaper — bajar BW a 5 Mbps.**
   - `curl -X POST http://localhost:9100/limit -d '{"mbps": 5}'`
   - Panel "Capacidad y umbral" muestra inmediatamente: BW = 5 Mbps, llamadas teóricas (G.711) = 28. Las 100 activas superan el umbral → línea de umbral en rojo.
   - Las llamadas activas comienzan a degradarse: jitter sube, MOS baja en el panel.

4. **El sistema reacciona — downgrade automático.**
   - El `integration-api` detecta BW < 10 Mbps en su consulta periódica.
   - Reescribe `pjsip.conf` con `allow = g729,gsm,ulaw,alaw`.
   - Ejecuta `pjsip reload`.
   - Las llamadas **nuevas** que entren en este momento se negocian directamente con G.729.

5. **Probar nuevas llamadas con BW reducido.**
   - `services/sipp-scenarios/run-stress.sh --codec g729 --concurrent 50`
   - Panel "Códec por sesión" muestra las nuevas sesiones en naranja (G.729).
   - Panel "Capacidad y umbral" muestra: llamadas teóricas (G.729) = 80, activas = 50, OK.

6. **Recuperar BW.**
   - `curl -X POST http://localhost:9100/limit -d '{"mbps": 100}'`
   - El sistema vuelve a `allow = opus,ulaw,alaw,gsm,g729`. Las llamadas nuevas vuelven a G.711.

Toda la demo dura ~3 minutos. Es el material directo de la HU-09.3.

---

## 5. Mapeo a ISO 25010 — Eficiencia de Desempeño

| Subcaracterística ISO 25010 | Cómo se cubre con este capítulo |
|------------------------------|---------------------------------|
| **Comportamiento temporal** | Latencia p95 de re-INVITE por downgrade, panel SLI/SLO en Grafana. |
| **Utilización de recursos** | BW consumido por llamada según códec, tabla §2.2. |
| **Capacidad** | Número máximo de llamadas simultáneas tolerable, calculadora + demo de shaping. |

Y al control **A.13.1.1 de ISO 27001** (controles de red) la capa de shaping aporta evidencia palpable de aislamiento y control de tráfico.

---

## 6. Limitaciones conocidas y evolución futura

| Limitación actual | Por qué la dejamos así | Cómo se resolvería |
|-------------------|------------------------|---------------------|
| El downgrade ocurre solo en llamadas **nuevas**, no en las activas. | Re-INVITE en mitad de llamada vía AMI requiere ~1 día de código y pruebas. Fuera de scope para el ciclo. | Implementar listener AMI que detecte `Newchannel` y dispare `Originate` con `Set(CHANNEL(audionativeformat)=g729)` o re-INVITE programático. |
| El shaper limita egress de Asterisk, no ingress. | Asimetría asumida: el cuello de botella en VoIP suele ser upload. | Añadir `tc` en eth0 ingress con `ifb` (intermediate functional block) para shapear ambos sentidos. |
| No medimos MOS real, sino R-factor estimado. | MOS objetivo (PESQ/POLQA) requiere capturar audio y comparar con referencia. | Integrar `voipmonitor` para muestrear sesiones y calcular MOS real off-line. |

---

## 7. Referencias

- **RFC 3550** — RTP: A Transport Protocol for Real-Time Applications.
- **RFC 3551** — RTP Profile for Audio and Video Conferences (perfiles G.711, GSM, G.729).
- **ITU-T G.711** — Pulse code modulation (PCM) of voice frequencies.
- **ITU-T G.729** — Coding of speech at 8 kbit/s using conjugate-structure algebraic-code-excited linear prediction.
- **Linux `tc(8)`** — Manual page. `man 8 tc`.
- **Asterisk PJSIP codec configuration** — https://wiki.asterisk.org/wiki/display/AST/PJSIP+Configuration+Sections+and+Relationships
- **Google SRE Book, Cap. 4** — Service Level Objectives.
- **ISO/IEC 25010:2011** — Systems and software Quality Requirements and Evaluation (SQuaRE).

---

## 8. Mantenimiento de este documento

Actualizar cuando:
- Se modifiquen las constantes de overhead en `bw_calc.py`.
- Se cambien los umbrales del downgrade en el `integration-api`.
- Se añadan o quiten códecs en `pjsip.conf.template`.
- Se modifique el script de demo de §4 (ajustar capturas del informe).
