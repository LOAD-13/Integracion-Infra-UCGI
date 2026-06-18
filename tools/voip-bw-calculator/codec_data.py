"""Constantes por códec utilizadas en el cálculo de capacidad VoIP.

Las definiciones corresponden a las recomendaciones UIT-T para cada códec.
Los bytes por frame se obtienen de bitrate * frame_interval_ms / 8.
"""

RTP_UDP_IP_ETH_OVERHEAD_BYTES = 58  # 12 RTP + 8 UDP + 20 IPv4 + 18 Ethernet
PACKET_INTERVAL_MS = 20             # Asterisk default para todos los códecs aquí
PACKETS_PER_SECOND = int(1000 / PACKET_INTERVAL_MS)  # 50 pps

CODECS = {
    "g711_alaw": {
        "label": "G.711 ALAW",
        "bitrate_kbps": 64,
        "frame_bytes": 160,
        "color": "#2ecc71",
        "notes": "PCM A-law. Europa, Latam, Asia. Sin compresión real.",
    },
    "g711_ulaw": {
        "label": "G.711 ULAW",
        "bitrate_kbps": 64,
        "frame_bytes": 160,
        "color": "#27ae60",
        "notes": "PCM μ-law. Norteamérica, Japón. Sin compresión real.",
    },
    "gsm": {
        "label": "GSM 06.10",
        "bitrate_kbps": 13,
        "frame_bytes": 33,
        "color": "#f1c40f",
        "notes": "Full-Rate GSM. RPE-LTP. 5x menos BW que G.711.",
    },
    "g729": {
        "label": "G.729A",
        "bitrate_kbps": 8,
        "frame_bytes": 20,
        "color": "#e67e22",
        "notes": "CS-ACELP. 8x menos BW que G.711, MOS apenas inferior.",
    },
    "opus_24": {
        "label": "Opus @ 24 kbps",
        "bitrate_kbps": 24,
        "frame_bytes": 60,
        "color": "#3498db",
        "notes": "Códec adaptativo obligatorio en WebRTC (RFC 6716).",
    },
}
