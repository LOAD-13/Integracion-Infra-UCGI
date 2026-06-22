#!/usr/bin/env python3
"""
ucgi-shaper · stub Flask para HU-08.5 (versión mínima) + HU-03.7.

Expone:
  - GET /status   → estado de la red + política de códec sugerida.
  - GET /healthz  → "ok".
  - GET /metrics  → métricas en formato Prometheus para HU-08.1.
  - POST /admin/bandwidth → cambia el BW reportado.
                            Body: {"mbps": <int>}
  - POST /admin/active-calls → cambia el número de llamadas activas reportadas.
                               Body: {"calls": <int>}

Fórmula de capacidad (idéntica a tools/voip-bw-calculator, ver
docs/iso/calculo-capacidad-voip.md):

  bw_per_call(codec) = (frame_bytes(codec) + 58 bytes overhead) * 8 * 50 pps * 2
                      / 1000  → kbps bidireccional

  required_bw(codec, cc) = bw_per_call(codec) * cc          # kbps

  usable_bw(bw_mbps)     = bw_mbps * 1000 * (1 - HEADROOM)  # kbps con holgura

Decisión de tier:
  if usable_bw >= required_bw(OPUS, cc+1):     FULL
  elif usable_bw >= required_bw(G711, cc+1):   MIXED
  elif usable_bw >= required_bw(G729, cc+1):   DOWNGRADED
  else:                                        EMERGENCY

DEUDA HU-08.5 versión completa (Sprint 4): este stub se reemplaza por uno que
use `tc qdisc tbf` para fijar BW real en la interfaz y leer estadísticas reales
de /sys/class/net/.../statistics/. Hasta entonces los valores son lo que el
operador setea por /admin/*.
"""
import os

from flask import Flask, Response, jsonify, request

app = Flask(__name__)

# ---------- Configuración de la fórmula ----------
HEADROOM = float(os.environ.get("UCGI_SHAPER_HEADROOM", "0.20"))   # 20%
PACKETS_PER_SECOND = 50                                              # ptime=20ms en MikoPBX

# Tamaño del payload (bytes) por frame de cada códec, sin overhead.
# Coincide 1:1 con tools/voip-bw-calculator/codec_data.py.
CODEC_FRAME_BYTES = {
    "opus_24":   60,
    "g711_alaw": 160,
    "g711_ulaw": 160,
    "gsm":       33,
    "g729":      20,
}
OVERHEAD_BYTES_PER_PACKET = 58  # 12 RTP + 8 UDP + 20 IPv4 + 18 Ethernet


def bw_per_call_kbps(codec: str) -> float:
    """BW bidireccional de una llamada con el códec dado, en kbps."""
    payload = CODEC_FRAME_BYTES[codec]
    bytes_per_packet = payload + OVERHEAD_BYTES_PER_PACKET
    return (bytes_per_packet * 8 * PACKETS_PER_SECOND * 2) / 1000.0


# Estimaciones de BW por llamada para cada modo, en kbps bidireccionales.
#   FULL       → opus@24 audio + video VP8 ~360 kbps = ~454 kbps total por llamada.
#                Asumimos 460 para tener margen.
#   MIXED      → opus@24 audio solamente = bw_per_call_kbps('opus_24') ≈ 94 kbps.
#   DOWNGRADED → g729 audio comprimido    = bw_per_call_kbps('g729')   ≈ 62 kbps.
FULL_KBPS_PER_CALL = 460.0


def _decide_tier(bw_mbps: int, active_calls: int) -> dict:
    """Decide el tier de calidad considerando la siguiente llamada (cc + 1).

    Orden: más BW disponible → más calidad. Si entra video, FULL; si solo audio
    de alta calidad, MIXED; si hace falta comprimir, DOWNGRADED; si no alcanza
    para ningún códec, EMERGENCY (rechazo).
    """
    usable_kbps = bw_mbps * 1000 * (1 - HEADROOM)
    cc = active_calls + 1
    opus_required = bw_per_call_kbps("opus_24") * cc
    g729_required = bw_per_call_kbps("g729") * cc
    full_required = FULL_KBPS_PER_CALL * cc

    if usable_kbps >= full_required:
        tier, codec, required = "FULL", "opus_24+vp8", full_required
    elif usable_kbps >= opus_required:
        tier, codec, required = "MIXED", "opus_24", opus_required
    elif usable_kbps >= g729_required:
        tier, codec, required = "DOWNGRADED", "g729", g729_required
    else:
        tier, codec, required = "EMERGENCY", "reject", g729_required

    return {
        "tier": tier,
        "codec": codec,
        "usableKbps": round(usable_kbps, 1),
        "headroom": HEADROOM,
        "requiredKbps": round(required, 1),
        "ccConsidered": cc,
    }


_state = {
    "bandwidthMbps": int(os.environ.get("MOCK_BANDWIDTH_MBPS", "50")),
    "qdiscActive":   os.environ.get("MOCK_QDISC_ACTIVE", "false").lower() == "true",
    "activeCalls":   int(os.environ.get("MOCK_ACTIVE_CALLS", "0")),
}


@app.get("/healthz")
def healthz():
    return "ok", 200


@app.get("/status")
def status():
    decision = _decide_tier(_state["bandwidthMbps"], _state["activeCalls"])
    return jsonify(
        bandwidthMbps=_state["bandwidthMbps"],
        qdiscActive=_state["qdiscActive"],
        activeCalls=_state["activeCalls"],
        # Backwards compatible: el integration-api leía `policy` en HU-03.7 mínima.
        policy=decision["tier"],
        **decision,
    )


@app.post("/admin/bandwidth")
def update_bandwidth():
    body = request.get_json(silent=True) or {}
    try:
        mbps = int(body["mbps"])
    except (KeyError, ValueError):
        return jsonify(error="Body inválido: se esperaba {'mbps': <int>}"), 400
    if mbps < 0 or mbps > 10000:
        return jsonify(error="mbps fuera de rango [0, 10000]"), 400
    _state["bandwidthMbps"] = mbps
    return jsonify(bandwidthMbps=mbps), 200


@app.post("/admin/active-calls")
def update_active_calls():
    body = request.get_json(silent=True) or {}
    try:
        calls = int(body["calls"])
    except (KeyError, ValueError):
        return jsonify(error="Body inválido: se esperaba {'calls': <int>}"), 400
    if calls < 0 or calls > 10000:
        return jsonify(error="calls fuera de rango [0, 10000]"), 400
    _state["activeCalls"] = calls
    return jsonify(activeCalls=calls), 200


@app.get("/metrics")
def metrics():
    """Métricas Prometheus para HU-08.1 / dashboards Grafana."""
    decision = _decide_tier(_state["bandwidthMbps"], _state["activeCalls"])
    tier_codes = {"FULL": 3, "MIXED": 2, "DOWNGRADED": 1, "EMERGENCY": 0}
    lines = [
        "# HELP ucgi_shaper_bandwidth_mbps Ancho de banda total reportado (Mbps).",
        "# TYPE ucgi_shaper_bandwidth_mbps gauge",
        f"ucgi_shaper_bandwidth_mbps {_state['bandwidthMbps']}",
        "# HELP ucgi_shaper_qdisc_active 1 si tc qdisc está aplicado.",
        "# TYPE ucgi_shaper_qdisc_active gauge",
        f"ucgi_shaper_qdisc_active {1 if _state['qdiscActive'] else 0}",
        "# HELP ucgi_shaper_active_calls Llamadas activas reportadas.",
        "# TYPE ucgi_shaper_active_calls gauge",
        f"ucgi_shaper_active_calls {_state['activeCalls']}",
        "# HELP ucgi_shaper_tier Tier de códec actual (3=FULL,2=MIXED,1=DOWNGRADED,0=EMERGENCY).",
        "# TYPE ucgi_shaper_tier gauge",
        f"ucgi_shaper_tier {tier_codes[decision['tier']]}",
        "# HELP ucgi_shaper_required_kbps BW requerido para la próxima llamada con el codec elegido.",
        "# TYPE ucgi_shaper_required_kbps gauge",
        f"ucgi_shaper_required_kbps {decision['requiredKbps']}",
        # Métrica con el nombre del códec como label (Grafana 'Value mappings'
        # puede mostrar la label en lugar del valor numérico).
        "# HELP ucgi_shaper_codec_info Codec actualmente elegido por el shaper para la próxima llamada.",
        "# TYPE ucgi_shaper_codec_info gauge",
        f'ucgi_shaper_codec_info{{codec="{decision["codec"]}",tier="{decision["tier"]}"}} 1',
    ]
    return Response("\n".join(lines) + "\n", mimetype="text/plain; version=0.0.4")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9100)
