# Nginx reverse proxy del stack UCGI con TLS terminado en :443.
# La imagen oficial nginx:alpine es suficiente; agregamos curl para healthcheck
# interno y dejamos los configs versionados en el repo.
#
# Los certs (server.crt / server.key / ca.crt) se montan en runtime desde
# infra/nginx/certs/ (gitignored). Generarlos con scripts/generate-certs.sh.

FROM nginx:1.27-alpine

# curl para el HEALTHCHECK contra el propio :443
RUN apk add --no-cache curl ca-certificates

# Reemplazamos el default.conf por nuestro nginx.conf completo
COPY nginx.conf /etc/nginx/nginx.conf

# NO ponemos `nginx -t` aquí en build: el config referencia /etc/nginx/certs/*
# que se montan en runtime, no en la imagen. La validación de sintaxis se hace
# en runtime — si el config está mal, el container falla rápido y el healthcheck
# lo refleja.

EXPOSE 80 443

# El cert real se monta en runtime; en build aún no existe, por eso el
# healthcheck usa --insecure: confirmamos que el proceso responde y termina TLS,
# no que el cert sea válido (eso lo verifica el cliente).
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS --insecure https://localhost/healthz || exit 1
