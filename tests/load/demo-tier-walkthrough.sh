#!/usr/bin/env bash
# Demo orquestador del shaper para la expo del jueves 2026-07-02.
#
# Recorre los 4 tiers del shaper (FULL → MIXED → DOWNGRADED → EMERGENCY)
# mientras el profesor mira Grafana en `http://localhost:3001`. Cada escenario
# dura 35s y mantiene activeCalls sticky (re-set cada 3s) para que el poller
# MikoPBX no resetee antes que Prometheus scrapee.
#
# Paneles a mostrar durante la demo:
#   - id 3   "Codec actual" — debería cambiar de Opus+VP8 → Opus → G.729 → RECHAZAR
#   - id 55  "SLI/SLO Tier shaper" — verde → amarillo → naranja → rojo
#   - id 58  "Capacidad por códec" — línea naranja salta entre líneas de colores
#   - id 56  "Capacidad y umbral 70%" — activas reales se ve subir
#
# Uso:
#   bash tests/load/demo-tier-walkthrough.sh                 # full 6 escenarios
#   bash tests/load/demo-tier-walkthrough.sh quick           # solo 3 (90s total)
#   bash tests/load/demo-tier-walkthrough.sh tier MIXED      # solo escenario MIXED

set -euo pipefail

SHAPER="${SHAPER:-http://localhost:9100}"
SCENARIO_DURATION="${SCENARIO_DURATION:-35}"  # segundos por escenario
KEEPALIVE_INTERVAL="${KEEPALIVE_INTERVAL:-3}"  # cada cuánto re-aplicar override

if ! curl -sf "$SHAPER/healthz" >/dev/null; then
  echo "ERROR: shaper no responde en $SHAPER. Levantá el stack con make up."
  exit 1
fi

run_tier() {
  local label="$1" bw_mbps="$2" active_calls="$3" expected_tier="$4" expected_codec="$5"
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════"
  echo "▶ $label"
  echo "  Esperás ver en Grafana: tier=$expected_tier  codec=$expected_codec"
  echo "  Configuración: BW=${bw_mbps}Mbps  active=${active_calls}  duración=${SCENARIO_DURATION}s"
  echo "═══════════════════════════════════════════════════════════════════════"

  # Sticky loop — re-aplicar override cada KEEPALIVE_INTERVAL segundos.
  local elapsed=0
  while [ "$elapsed" -lt "$SCENARIO_DURATION" ]; do
    curl -sX POST "$SHAPER/admin/bandwidth"     -H "Content-Type: application/json" -d "{\"mbps\":$bw_mbps}" >/dev/null
    curl -sX POST "$SHAPER/admin/active-calls"  -H "Content-Type: application/json" -d "{\"calls\":$active_calls}" >/dev/null
    sleep "$KEEPALIVE_INTERVAL"
    elapsed=$((elapsed + KEEPALIVE_INTERVAL))
    if [ $((elapsed % 9)) -le "$KEEPALIVE_INTERVAL" ]; then
      local s=$(curl -s "$SHAPER/status")
      local t=$(echo "$s" | grep -oP '"tier":"\K[^"]+')
      local c=$(echo "$s" | grep -oP '"codec":"\K[^"]+')
      local a=$(echo "$s" | grep -oP '"activeCalls":\K[0-9]+')
      printf "  t+%2ds  active=%3s  tier=%-11s codec=%s\n" "$elapsed" "$a" "$t" "$c"
    fi
  done
}

cleanup() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════"
  echo "Reset shaper a estado limpio (BW=10000 Mbps, active=0)"
  curl -sX POST "$SHAPER/admin/bandwidth"    -H "Content-Type: application/json" -d '{"mbps":10000}' >/dev/null
  curl -sX POST "$SHAPER/admin/active-calls" -H "Content-Type: application/json" -d '{"calls":0}'    >/dev/null
  curl -sX POST "$SHAPER/reset"              >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ─── Escenarios ────────────────────────────────────────────────────────────
MODE="${1:-full}"

case "$MODE" in
  quick)
    SCENARIO_DURATION=25
    run_tier "FULL — opus+vp8"  100   0  "FULL"       "opus_24+vp8"
    run_tier "MIXED — opus_24"   10  20  "MIXED"      "opus_24"
    run_tier "EMERGENCY"         10 130  "EMERGENCY"  "reject"
    ;;
  tier)
    case "${2:-}" in
      FULL)       run_tier "FULL"        100   0  "FULL"       "opus_24+vp8" ;;
      MIXED)      run_tier "MIXED"        10  20  "MIXED"      "opus_24" ;;
      DOWNGRADED) run_tier "DOWNGRADED"   10  90  "DOWNGRADED" "g729" ;;
      EMERGENCY)  run_tier "EMERGENCY"    10 130  "EMERGENCY"  "reject" ;;
      *) echo "Tier inválido: ${2:-}. Use FULL/MIXED/DOWNGRADED/EMERGENCY"; exit 2 ;;
    esac
    ;;
  full|*)
    run_tier "1/6 · FULL — sano (BW=100 Mbps, 0 activas)"        100   0  "FULL"       "opus_24+vp8"
    run_tier "2/6 · MIXED — bajamos a opus sin video"             10  20  "MIXED"      "opus_24"
    run_tier "3/6 · DOWNGRADED — opus también cae, queda g729"    10  90  "DOWNGRADED" "g729"
    run_tier "4/6 · EMERGENCY — rechazo de nuevas llamadas"       10 130  "EMERGENCY"  "reject"
    run_tier "5/6 · Recuperación — BW=5Mbps, vuelve a MIXED"       5  10  "MIXED"      "opus_24"
    run_tier "6/6 · Estado sano final"                            100   0  "FULL"       "opus_24+vp8"
    ;;
esac
