#!/usr/bin/env bash
#
# generate-certs.sh — Genera una CA autofirmada y un cert servidor TLS
# para que Nginx (HU-02.5) y eventualmente Asterisk (HU-07.2) puedan
# terminar HTTPS / SIP-TLS / WSS sin depender de una autoridad externa.
#
# Uso:
#   ./scripts/generate-certs.sh                    # CN=localhost por defecto
#   ./scripts/generate-certs.sh ucgi.local         # CN custom
#
# Resultado en infra/nginx/certs/:
#   ca.crt        Root CA (instalable en navegador para evitar warning)
#   ca.key        Clave privada de la CA  (NO commitear)
#   server.crt    Cert del servidor firmado por la CA
#   server.key    Clave privada del servidor (NO commitear)
#
# El .gitignore ya excluye *.key / *.crt / *.pem dentro de infra/nginx/certs/
# y solo conserva .gitkeep.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS_DIR="${CERTS_DIR:-$REPO_ROOT/infra/nginx/certs}"
CN="${1:-localhost}"
DAYS="${DAYS:-365}"

mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

echo "==> Generando certs en $CERTS_DIR (CN=$CN, validez=$DAYS días)"

# 1. Root CA
if [[ ! -f ca.key ]]; then
  openssl genrsa -out ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS" \
    -out ca.crt \
    -subj "/C=PE/ST=Lima/L=Lima/O=UCGI Lab/OU=DevOps/CN=UCGI Lab Root CA"
  echo "    ca.crt + ca.key (NUEVA CA)"
else
  echo "    ca.crt + ca.key ya existen, reuso"
fi

# 2. Server key + CSR
openssl genrsa -out server.key 2048 2>/dev/null
openssl req -new -key server.key -out server.csr \
  -subj "/C=PE/ST=Lima/L=Lima/O=UCGI Lab/OU=Web/CN=$CN"

# 3. SAN extensions — navegadores modernos rechazan certs sin SAN
cat > server.ext <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = $CN
DNS.3 = ucgi.local
DNS.4 = *.ucgi.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# 4. Sign server cert with our CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS" -sha256 -extfile server.ext

# 5. Cleanup transient files
rm -f server.csr server.ext ca.srl

# 6. Permisos: claves privadas solo readable por owner
chmod 600 server.key ca.key
chmod 644 server.crt ca.crt

echo ""
echo "==> Generados:"
ls -la *.crt *.key 2>/dev/null
echo ""
echo "==> Para usar:"
echo "    docker compose up -d nginx"
echo "    curl -k https://localhost/         # -k acepta el cert autofirmado"
echo "    # Para evitar el warning del browser, instalar ca.crt como Trusted Root"
echo "    # ver docs/runbooks/generar-certificados.md"
