"""Tests unitarios de bw_calc.

Verifican las fórmulas contra los valores canónicos documentados en
docs/iso/calculo-capacidad-voip.md.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from bw_calc import bw_per_call_kbps, realistic_calls, theoretical_calls


def test_bw_per_call_g711_is_174_4_kbps():
    assert bw_per_call_kbps("g711_alaw") == pytest.approx(174.4, rel=1e-3)
    assert bw_per_call_kbps("g711_ulaw") == pytest.approx(174.4, rel=1e-3)


def test_bw_per_call_g729_is_62_4_kbps():
    assert bw_per_call_kbps("g729") == pytest.approx(62.4, rel=1e-3)


def test_bw_per_call_gsm_is_72_8_kbps():
    assert bw_per_call_kbps("gsm") == pytest.approx(72.8, rel=1e-3)


def test_bw_per_call_opus24_is_94_4_kbps():
    assert bw_per_call_kbps("opus_24") == pytest.approx(94.4, rel=1e-3)


def test_g711_at_50mbps_no_headroom_gives_286_calls():
    assert theoretical_calls(50, "g711_alaw") == 286


def test_g711_at_50mbps_30pct_headroom_gives_200_calls():
    assert realistic_calls(50, "g711_alaw", 30) == 200


def test_g729_at_50mbps_30pct_headroom_gives_560_calls():
    # 50000 * 0.7 / 62.4 = 560.897 -> int = 560
    assert realistic_calls(50, "g729", 30) == 560


def test_g711_at_100mbps_no_headroom_gives_573_calls():
    # 100000 / 174.4 = 573.4
    assert theoretical_calls(100, "g711_ulaw") == 573


def test_zero_headroom_equals_theoretical():
    assert realistic_calls(100, "gsm", 0) == theoretical_calls(100, "gsm")
