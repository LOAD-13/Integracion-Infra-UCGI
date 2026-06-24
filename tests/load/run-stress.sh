#!/usr/bin/env bash
# HU-08.3 (IUDCYGI-51) — wrapper para ejecutar SIPp con 50 cc contra MikoPBX
# y exportar CSV de latencias + tasa de éxito.
#
# Pre-requisitos:
#   - SIPp instalado (docker run o package nativo: `apt install sip-tester`).
#   - MikoPBX UP healthy en localhost:5060.
#   - Extensión SIP de prueba creada (default 1099) sin password (o setear $SIP_USER/$SIP_PASS).
#
# Uso:
#   bash tests/load/run-stress.sh [target_ip] [target_port] [calls_per_second] [max_simultaneous]
#
# Output:
#   - tests/load/results/stress-<timestamp>.csv (latencias por call)
#   - tests/load/results/stress-<timestamp>.log (SIPp output completo)
#   - Tabla resumen en stdout: total/exitosas/fallidas + tasa éxito.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOAD_DIR="$ROOT_DIR/tests/load"
RESULTS_DIR="$LOAD_DIR/results"
mkdir -p "$RESULTS_DIR"

TARGET_IP="${1:-127.0.0.1}"
TARGET_PORT="${2:-5060}"
CPS="${3:-10}"            # llamadas por segundo
MAX_CC="${4:-50}"         # simultáneas máximas
SCENARIO="${LOAD_DIR}/sipp-uac.xml"
SERVICE="${SIP_TARGET_EXT:-1099}"
DURATION_S="${TEST_DURATION:-60}"

TS="$(date +%Y%m%d-%H%M%S)"
CSV_OUT="$RESULTS_DIR/stress-$TS.csv"
LOG_OUT="$RESULTS_DIR/stress-$TS.log"

echo "Lanzando SIPp UAC: target=${TARGET_IP}:${TARGET_PORT}, ext=${SERVICE}, cps=${CPS}, max=${MAX_CC}, dur=${DURATION_S}s"
echo "Resultados: $CSV_OUT"

# `-trace_stat` produce CSV con latencias.
# `-stf` define el archivo donde se guarda el resumen.
sipp -sf "$SCENARIO" \
     -s "$SERVICE" \
     "$TARGET_IP:$TARGET_PORT" \
     -r "$CPS" -rp "1s" \
     -l "$MAX_CC" \
     -m "$((CPS * DURATION_S))" \
     -trace_stat -stf "$CSV_OUT" \
     -trace_msg -message_file "${LOG_OUT}.msg" \
     -timeout "${DURATION_S}s" -timeout_error \
     > "$LOG_OUT" 2>&1 || true

if [ ! -s "$CSV_OUT" ]; then
  echo "[ERROR] SIPp no produjo CSV. Ver $LOG_OUT"
  exit 1
fi

# Resumen rápido del CSV: tomar la última fila (acumulado).
echo "===== Resumen ====="
tail -2 "$CSV_OUT" | head -1 | awk -F';' '{
  for (i=1; i<=NF; i++) {
    if ($i ~ /^[0-9.]+$/) printf("col%d=%s\n", i, $i);
  }
}' | head -20

# Tasa de éxito desde el log:
SUCCESS=$(grep -E "Successful call:" "$LOG_OUT" | tail -1 | awk -F: '{print $2}' | tr -d ' ' || echo 0)
FAILED=$(grep -E "Failed call:" "$LOG_OUT" | tail -1 | awk -F: '{print $2}' | tr -d ' ' || echo 0)
TOTAL=$((${SUCCESS:-0} + ${FAILED:-0}))
if [ "$TOTAL" -gt 0 ]; then
  RATE=$(awk -v s="$SUCCESS" -v t="$TOTAL" 'BEGIN { printf "%.1f", (s/t)*100 }')
  echo "Total: $TOTAL · Exitosas: $SUCCESS · Falladas: $FAILED · Tasa éxito: ${RATE}%"
  if awk "BEGIN { exit !($RATE >= 95.0) }"; then
    echo "[OK] Tasa de éxito ≥ 95% — cumple criterio HU-08.3"
    exit 0
  else
    echo "[WARN] Tasa de éxito < 95% — revisar logs"
    exit 2
  fi
fi
