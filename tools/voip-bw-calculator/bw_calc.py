"""Cálculo de capacidad VoIP.

Funciones puras, sin dependencias de UI. Toda la lógica matemática vive aquí
para que sea testeable con pytest.
"""

from codec_data import (
    CODECS,
    PACKETS_PER_SECOND,
    RTP_UDP_IP_ETH_OVERHEAD_BYTES,
)


def bw_per_call_kbps(codec_key: str) -> float:
    """Ancho de banda en kbps que consume una llamada bidireccional en la red.

    Considera overhead RTP+UDP+IPv4+Ethernet sobre el payload del códec,
    multiplicado por dos para los dos sentidos de la conversación.
    """
    codec = CODECS[codec_key]
    bytes_per_packet = codec["frame_bytes"] + RTP_UDP_IP_ETH_OVERHEAD_BYTES
    bps_one_direction = bytes_per_packet * 8 * PACKETS_PER_SECOND
    kbps_two_directions = 2 * bps_one_direction / 1000
    return kbps_two_directions


def theoretical_calls(total_bw_mbps: float, codec_key: str) -> int:
    """Llamadas simultáneas teóricas sin reservar holgura."""
    total_kbps = total_bw_mbps * 1000
    return int(total_kbps / bw_per_call_kbps(codec_key))


def realistic_calls(total_bw_mbps: float, codec_key: str, headroom_pct: float) -> int:
    """Llamadas simultáneas reservando un porcentaje de holgura por jitter."""
    usable_kbps = total_bw_mbps * 1000 * (1 - headroom_pct / 100)
    return int(usable_kbps / bw_per_call_kbps(codec_key))


def calls_table(total_bw_mbps: float, headroom_pct: float) -> list[dict]:
    """Filas para la tabla principal de la GUI / informe."""
    rows = []
    for key, codec in CODECS.items():
        bw_call = bw_per_call_kbps(key)
        rows.append({
            "key": key,
            "label": codec["label"],
            "bitrate_kbps": codec["bitrate_kbps"],
            "bw_per_call_kbps": round(bw_call, 1),
            "theoretical": theoretical_calls(total_bw_mbps, key),
            "realistic": realistic_calls(total_bw_mbps, key, headroom_pct),
            "color": codec["color"],
        })
    return rows
