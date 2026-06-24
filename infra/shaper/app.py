#!/usr/bin/env python3
"""
ucgi-shaper · servicio de capacidad VoIP del lab.

Endpoints:
  - GET /status   → estado de la red + política de códec sugerida.
  - GET /healthz  → "ok".
  - GET /metrics  → métricas en formato Prometheus para Grafana.
  - POST /admin/bandwidth → override del BW reportado (modo demo).
                            Body: {"mbps": <int>}
  - POST /admin/active-calls → override del número de llamadas activas (modo demo).
                               Body: {"calls": <int>}

Fórmula (idéntica a tools/voip-bw-calculator, ver docs/iso/calculo-capacidad-voip.md):

  bw_per_call(codec) = (frame_bytes(codec) + 58 bytes overhead) * 8 * 50 pps * 2 / 1000  → kbps bidireccional
  required_bw(codec, cc) = bw_per_call(codec) * cc
  usable_bw(bw_mbps) = bw_mbps * 1000 * (1 - HEADROOM)

Decisión de tier (más BW → más calidad):
  if usable_bw >= 460 * cc:                FULL        (opus_24 + vp8)
  elif usable_bw >= bw_per_call(opus) * cc: MIXED       (opus_24)
  elif usable_bw >= bw_per_call(g729) * cc: DOWNGRADED  (g729)
  else:                                     EMERGENCY  (rechazar)

Fuente de las métricas en tiempo real:
  - bandwidthMbps: por default lee la capacidad de la interfaz docker del shaper
    (/sys/class/net/eth0/speed → o un valor estático si no es disponible). Se puede
    override con env `UCGI_SHAPER_BANDWIDTH_MBPS`.
  - activeCalls: consulta MikoPBX REST `GET /pbxcore/api/v3/pbx/getActiveChannels`
    cada 5s. Devuelve el conteo de canales PJSIP en estado UP. Si falla, conserva el
    último valor conocido.
"""
import logging
import os
import subprocess
import threading
import time
from typing import Optional

import requests
from flask import Flask, Response, jsonify, request

# ---------- Configuración de la fórmula ----------
HEADROOM = float(os.environ.get("UCGI_SHAPER_HEADROOM", "0.20"))   # 20%
PACKETS_PER_SECOND = 50                                              # ptime=20ms en MikoPBX
OVERHEAD_BYTES_PER_PACKET = 58  # 12 RTP + 8 UDP + 20 IPv4 + 18 Ethernet

CODEC_FRAME_BYTES = {
    "opus_24":   60,
    "g711_alaw": 160,
    "g711_ulaw": 160,
    "gsm":       33,
    "g729":      20,
}
FULL_KBPS_PER_CALL = 460.0   # opus + vp8 estimado

# ---------- Configuración de la fuente real ----------
# MikoPBX REST API: lee llamadas activas vía /pbxcore/api/v3/pbx/getActiveCalls.
MIKOPBX_HOST = os.environ.get("UCGI_SHAPER_MIKOPBX_HOST", "mikopbx")
MIKOPBX_PORT = int(os.environ.get("UCGI_SHAPER_MIKOPBX_PORT", "443"))
MIKOPBX_LOGIN = os.environ.get("UCGI_SHAPER_MIKOPBX_LOGIN", "admin")
MIKOPBX_PASSWORD = os.environ.get("UCGI_SHAPER_MIKOPBX_PASSWORD", "Deathnote2005")
MIKOPBX_BASE = f"https://{MIKOPBX_HOST}:{MIKOPBX_PORT}"

POLL_INTERVAL_S = int(os.environ.get("UCGI_SHAPER_POLL_INTERVAL_S", "5"))

# BW reportado por default — si no se pasa override, tomamos el del NIC docker.
DEFAULT_BANDWIDTH_MBPS = int(os.environ.get("UCGI_SHAPER_BANDWIDTH_MBPS", "0"))


def bw_per_call_kbps(codec: str) -> float:
    payload = CODEC_FRAME_BYTES[codec]
    bytes_per_packet = payload + OVERHEAD_BYTES_PER_PACKET
    return (bytes_per_packet * 8 * PACKETS_PER_SECOND * 2) / 1000.0


def _decide_tier(bw_mbps: int, active_calls: int) -> dict:
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


def _nic_speed_mbps(nic: str = "eth0") -> Optional[int]:
    """Lee la velocidad reportada por la NIC docker desde sysfs."""
    try:
        with open(f"/sys/class/net/{nic}/speed", "r", encoding="utf-8") as fp:
            value = fp.read().strip()
        v = int(value)
        return v if v > 0 else None
    except (OSError, ValueError):
        return None


def _initial_bandwidth_mbps() -> int:
    """BW inicial: env override → NIC speed → fallback 100 Mbps."""
    if DEFAULT_BANDWIDTH_MBPS > 0:
        return DEFAULT_BANDWIDTH_MBPS
    nic_value = _nic_speed_mbps()
    return nic_value if nic_value is not None else 100


app = Flask(__name__)
log = logging.getLogger("ucgi-shaper")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")


_state = {
    "bandwidthMbps":   _initial_bandwidth_mbps(),
    "activeCalls":     0,
    "lastSourceError": None,
    "lastSourceAt":    None,
    # Tráfico instantáneo, calculado a partir de delta de rx_bytes/tx_bytes.
    "trafficRxMbps":   0.0,
    "trafficTxMbps":   0.0,
    "trafficTotalMbps": 0.0,
}


# ---------- Lector de tráfico real desde /sys/class/net/eth0/statistics ----------
class TrafficSampler:
    """Lee rx_bytes/tx_bytes del NIC y calcula Mbps por intervalo.

    Esto sí fluctúa con tráfico real (incluye RTP de las llamadas). Es lo que
    el panel "Ancho de banda" del dashboard mostrará como pico cuando haya
    llamadas activas — el `bandwidthMbps` original (capacidad NIC) seguirá
    fijo en lo que reporta el NIC docker.
    """

    def __init__(self, nic: str = "eth0", interval_s: float = 2.0):
        self.nic = nic
        self.interval_s = interval_s
        self.last_rx = 0
        self.last_tx = 0
        self.last_ts: Optional[float] = None

    def _read(self, key: str) -> int:
        try:
            with open(f"/sys/class/net/{self.nic}/statistics/{key}", "r",
                      encoding="utf-8") as fp:
                return int(fp.read().strip())
        except (OSError, ValueError):
            return 0

    def loop(self):
        while True:
            rx = self._read("rx_bytes")
            tx = self._read("tx_bytes")
            now = time.time()
            if self.last_ts is not None and now > self.last_ts:
                dt = now - self.last_ts
                rx_mbps = max(0.0, (rx - self.last_rx) * 8.0 / 1_000_000.0 / dt)
                tx_mbps = max(0.0, (tx - self.last_tx) * 8.0 / 1_000_000.0 / dt)
                _state["trafficRxMbps"]    = round(rx_mbps, 3)
                _state["trafficTxMbps"]    = round(tx_mbps, 3)
                _state["trafficTotalMbps"] = round(rx_mbps + tx_mbps, 3)
            self.last_rx = rx
            self.last_tx = tx
            self.last_ts = now
            time.sleep(self.interval_s)


def _start_traffic_sampler():
    sampler = TrafficSampler()
    thread = threading.Thread(target=sampler.loop, daemon=True,
                              name="traffic-sampler")
    thread.start()
    log.info("Traffic sampler iniciado en eth0 cada %.1fs", sampler.interval_s)


# ---------- Worker poller a MikoPBX ----------
class MikoPbxPoller:
    """Worker que consulta MikoPBX cada `POLL_INTERVAL_S` y actualiza activeCalls."""

    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False  # cert autofirmado del lab
        requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
        self.token: Optional[str] = None
        self.token_expires_at = 0.0

    def get_token(self) -> Optional[str]:
        if self.token and time.time() < self.token_expires_at - 30:
            return self.token
        try:
            resp = self.session.post(
                f"{MIKOPBX_BASE}/pbxcore/api/v3/auth:login",
                json={"login": MIKOPBX_LOGIN, "password": MIKOPBX_PASSWORD},
                timeout=3.0,
            )
            data = resp.json().get("data", {})
            token = data.get("accessToken")
            if not token:
                _state["lastSourceError"] = "auth response sin accessToken"
                return None
            self.token = token
            self.token_expires_at = time.time() + float(data.get("expiresIn", 900))
            return token
        except Exception as exc:  # noqa: BLE001
            _state["lastSourceError"] = f"auth: {exc}"
            return None

    def query_active_calls(self) -> Optional[int]:
        token = self.get_token()
        if not token:
            return None
        try:
            # MikoPBX REST API v3 sigue el Google API Design (recurso:metodo con `:`),
            # así que el path correcto es /pbxcore/api/v3/pbx-status:getActiveCalls
            # (NO /pbx/getActiveCalls que devuelve 404).
            resp = self.session.get(
                f"{MIKOPBX_BASE}/pbxcore/api/v3/pbx-status:getActiveCalls",
                headers={"Authorization": f"Bearer {token}"},
                timeout=3.0,
            )
            payload = resp.json()
            if not payload.get("result", False):
                _state["lastSourceError"] = (
                    f"getActiveCalls result=false: {payload.get('messages')}"
                )
                return None
            data = payload.get("data", [])
            # data es una lista de calls (no canales): un elemento = una llamada.
            if isinstance(data, list):
                return len(data)
            return 0
        except Exception as exc:  # noqa: BLE001
            _state["lastSourceError"] = f"getActiveCalls: {exc}"
            return None

    def loop(self):
        while True:
            active = self.query_active_calls()
            if active is not None:
                _state["activeCalls"] = active
                _state["lastSourceError"] = None
                _state["lastSourceAt"] = time.time()
            time.sleep(POLL_INTERVAL_S)


def _start_poller():
    poller = MikoPbxPoller()
    thread = threading.Thread(target=poller.loop, daemon=True, name="mikopbx-poller")
    thread.start()
    log.info("MikoPBX poller iniciado contra %s cada %ds", MIKOPBX_BASE, POLL_INTERVAL_S)


@app.get("/healthz")
def healthz():
    return "ok", 200


@app.get("/status")
def status():
    decision = _decide_tier(_state["bandwidthMbps"], _state["activeCalls"])
    return jsonify(
        bandwidthMbps=_state["bandwidthMbps"],
        activeCalls=_state["activeCalls"],
        trafficRxMbps=_state["trafficRxMbps"],
        trafficTxMbps=_state["trafficTxMbps"],
        trafficTotalMbps=_state["trafficTotalMbps"],
        lastSourceError=_state["lastSourceError"],
        lastSourceAt=_state["lastSourceAt"],
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


# ============================================================================
# HU-08.5 — endpoints de Linux Traffic Control para aplicar el shaping real.
# Requieren capability NET_ADMIN en el contenedor (declarada en docker-compose).
# Si el contenedor no tiene NET_ADMIN, las llamadas tc fallan con permission
# denied y los endpoints devuelven 500 con el stderr de tc.
# ============================================================================

SHAPER_NIC = os.environ.get("UCGI_SHAPER_NIC", "eth0")
_shaping_active = {"applied": False, "mbps": None}


def _run_tc(args: list[str]) -> tuple[int, str, str]:
    """Ejecuta `tc <args>` y devuelve (rc, stdout, stderr)."""
    cmd = ["tc"] + args
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        return proc.returncode, proc.stdout, proc.stderr
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return -1, "", str(exc)


@app.post("/limit")
def apply_limit():
    """Aplica `tc qdisc tbf` para limitar BW en eth0."""
    body = request.get_json(silent=True) or {}
    try:
        mbps = int(body["mbps"])
    except (KeyError, ValueError):
        return jsonify(error="Body inválido: se esperaba {'mbps': <int>}"), 400
    if mbps <= 0 or mbps > 1000:
        return jsonify(error="mbps fuera de rango (1, 1000]"), 400

    # Limpiar qdisc previa (idempotente — ignora error si no existe).
    _run_tc(["qdisc", "del", "dev", SHAPER_NIC, "root"])

    rc, _, err = _run_tc([
        "qdisc", "add", "dev", SHAPER_NIC, "root", "tbf",
        "rate", f"{mbps}mbit", "burst", "32kbit", "latency", "400ms",
    ])
    if rc != 0:
        return jsonify(
            error="tc add falló",
            stderr=err,
            hint="¿Contenedor con cap_add NET_ADMIN?",
        ), 500

    _shaping_active.update(applied=True, mbps=mbps)
    log.info("tc qdisc tbf aplicado a %s con rate=%dmbit", SHAPER_NIC, mbps)
    return jsonify(mbps=mbps, applied=True, nic=SHAPER_NIC), 200


@app.post("/reset")
def reset_limit():
    """Quita la qdisc raíz (sin shaping)."""
    rc, _, err = _run_tc(["qdisc", "del", "dev", SHAPER_NIC, "root"])
    if rc != 0 and "No such file" not in err and "RTNETLINK" not in err:
        return jsonify(error="tc del falló", stderr=err), 500
    _shaping_active.update(applied=False, mbps=None)
    log.info("tc qdisc raíz removida de %s", SHAPER_NIC)
    return jsonify(applied=False, nic=SHAPER_NIC), 200


@app.get("/qdisc")
def show_qdisc():
    """Inspección — devuelve `tc qdisc show dev eth0`."""
    rc, out, err = _run_tc(["qdisc", "show", "dev", SHAPER_NIC])
    return jsonify(rc=rc, output=out.strip(), stderr=err.strip(),
                   shaping=_shaping_active.copy())


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
    """Métricas Prometheus para Grafana."""
    decision = _decide_tier(_state["bandwidthMbps"], _state["activeCalls"])
    tier_codes = {"FULL": 3, "MIXED": 2, "DOWNGRADED": 1, "EMERGENCY": 0}
    lines = [
        "# HELP ucgi_shaper_bandwidth_mbps Capacidad del NIC (Mbps), no es tráfico actual.",
        "# TYPE ucgi_shaper_bandwidth_mbps gauge",
        f"ucgi_shaper_bandwidth_mbps {_state['bandwidthMbps']}",
        "# HELP ucgi_shaper_traffic_rx_mbps Tráfico RX en eth0 ahora (Mbps).",
        "# TYPE ucgi_shaper_traffic_rx_mbps gauge",
        f"ucgi_shaper_traffic_rx_mbps {_state['trafficRxMbps']}",
        "# HELP ucgi_shaper_traffic_tx_mbps Tráfico TX en eth0 ahora (Mbps).",
        "# TYPE ucgi_shaper_traffic_tx_mbps gauge",
        f"ucgi_shaper_traffic_tx_mbps {_state['trafficTxMbps']}",
        "# HELP ucgi_shaper_traffic_total_mbps Suma RX+TX (Mbps).",
        "# TYPE ucgi_shaper_traffic_total_mbps gauge",
        f"ucgi_shaper_traffic_total_mbps {_state['trafficTotalMbps']}",
        "# HELP ucgi_shaper_active_calls Llamadas activas leídas de MikoPBX.",
        "# TYPE ucgi_shaper_active_calls gauge",
        f"ucgi_shaper_active_calls {_state['activeCalls']}",
        "# HELP ucgi_shaper_tier Tier de códec actual (3=FULL,2=MIXED,1=DOWNGRADED,0=EMERGENCY).",
        "# TYPE ucgi_shaper_tier gauge",
        f"ucgi_shaper_tier {tier_codes[decision['tier']]}",
        "# HELP ucgi_shaper_required_kbps BW requerido para la próxima llamada con el codec elegido.",
        "# TYPE ucgi_shaper_required_kbps gauge",
        f"ucgi_shaper_required_kbps {decision['requiredKbps']}",
        "# HELP ucgi_shaper_source_healthy 1 si la última lectura a MikoPBX fue OK, 0 si falló.",
        "# TYPE ucgi_shaper_source_healthy gauge",
        f"ucgi_shaper_source_healthy {0 if _state['lastSourceError'] else 1}",
        "# HELP ucgi_shaper_codec_info Codec actualmente elegido por el shaper.",
        "# TYPE ucgi_shaper_codec_info gauge",
        f'ucgi_shaper_codec_info{{codec="{decision["codec"]}",tier="{decision["tier"]}"}} 1',
    ]
    return Response("\n".join(lines) + "\n", mimetype="text/plain; version=0.0.4")


# Arrancar el poller + traffic sampler siempre que el módulo se cargue.
_start_poller()
_start_traffic_sampler()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9100)
