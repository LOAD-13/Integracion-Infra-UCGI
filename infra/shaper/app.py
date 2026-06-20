#!/usr/bin/env python3
"""
ucgi-shaper · servicio stub para HU-08.5 (mínimo) + HU-03.7.

Expone:
  - GET /status → {"bandwidthMbps": <int>, "qdiscActive": <bool>, "policy": "<str>"}
  - GET /healthz → "ok"
  - POST /admin/bandwidth → cambia el BW reportado (útil para demo manual).
                          Body: {"mbps": <int>}

DEUDA: la versión completa (Sprint 4) reemplaza este stub por uno que use
`tc qdisc tbf` para fijar BW real en una interfaz, y reporta lecturas tomadas
de /sys/class/net/.../statistics/. Mientras tanto el shaper sirve para
ejercitar todo el camino integration-api → polling → decisión de códec.
"""
import os
from flask import Flask, jsonify, request

app = Flask(__name__)
_state = {
    "bandwidthMbps": int(os.environ.get("MOCK_BANDWIDTH_MBPS", "50")),
    "qdiscActive": os.environ.get("MOCK_QDISC_ACTIVE", "false").lower() == "true",
}


@app.get("/healthz")
def healthz():
    return "ok", 200


@app.get("/status")
def status():
    bw = _state["bandwidthMbps"]
    policy = _policy_for(bw)
    return jsonify(
        bandwidthMbps=bw,
        qdiscActive=_state["qdiscActive"],
        policy=policy,
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


def _policy_for(mbps: int) -> str:
    """Misma política que el integration-api — devolvemos info para defensa."""
    if mbps >= 30:
        return "FULL"
    if mbps >= 10:
        return "MIXED"
    return "DOWNGRADED"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9100)
