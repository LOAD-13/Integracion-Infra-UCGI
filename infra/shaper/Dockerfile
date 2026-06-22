# Dockerfile · ucgi-shaper (HU-08.5 / HU-03.7)
#
# Versión mínima viable — Alpine + Flask con un endpoint /status que devuelve
# el ancho de banda configurado (env MOCK_BANDWIDTH_MBPS, default 50). Sirve
# para que el integration-api ejerza el flujo de polling + decisión de códec
# (HU-03.7) sin depender de tc qdisc real.
#
# DEUDA explícita (queda para Sprint 4 — HU-08.5 versión completa):
#   - iproute2 instalado pero NO se hace `tc qdisc tbf` real todavía.
#   - El BW devuelto es estático (no se mide tráfico real ni se aplica límite).
#   - Tests de carga con SIPp (HU-06.7) entrarán cuando el shaper haga tc.
FROM python:3.12-alpine

RUN apk add --no-cache iproute2 curl
RUN pip install --no-cache-dir flask==3.0.3 requests==2.32.3

WORKDIR /app
COPY app.py /app/app.py

ENV MOCK_BANDWIDTH_MBPS=50
ENV MOCK_QDISC_ACTIVE=false

EXPOSE 9100

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:9100/status >/dev/null || exit 1

CMD ["python", "/app/app.py"]
