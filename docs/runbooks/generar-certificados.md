# Runbook · Generar certificados TLS para el lab UCGI

> Para entender el "qué" y el "por qué", ver `infra/nginx/nginx.conf` y `infra/nginx/Dockerfile`.
> Este runbook solo explica el "cómo".

## Cuándo se ejecuta

- **Al clonar el repo en una máquina nueva.** Los `.key` y `.crt` están en `.gitignore` — cada developer/host genera los suyos.
- **Después de tocar el script** `scripts/generate-certs.sh` (cambio de CN, dominios SAN, validez).
- **Cuando los certs expiren** (por defecto 365 días desde su generación).

## Pre-requisitos

- `openssl` instalado (`openssl version` debe responder algo como `OpenSSL 3.x` o `LibreSSL 3.x`).
- Permiso de escritura en `infra/nginx/certs/`.

## Ejecución

```bash
# Desde la raíz del repo:
./scripts/generate-certs.sh                    # CN=localhost (por defecto)
./scripts/generate-certs.sh ucgi.local         # CN custom
DAYS=730 ./scripts/generate-certs.sh           # validez 2 años en lugar de 1
```

El script crea **4 archivos** en `infra/nginx/certs/`:

| Archivo | Qué es | Versionado |
|---|---|---|
| `ca.crt` | Root CA del lab — el ancla de confianza. | ❌ No commitear |
| `ca.key` | Clave privada de la CA — **muy sensible**. | ❌ No commitear (privada) |
| `server.crt` | Cert del servidor (CN=localhost por defecto), firmado por la CA. | ❌ No commitear |
| `server.key` | Clave privada del servidor. | ❌ No commitear (privada) |

Los 4 quedan ignorados por `.gitignore`. La única forma legítima de tenerlos en el repo es generarlos localmente.

## Subject Alternative Names (SAN)

Navegadores modernos (Chrome 58+, Firefox 48+) **rechazan** certs sin SAN aunque el CN coincida. El script declara estos SAN por defecto:

- `DNS: localhost`
- `DNS: <CN custom si se pasó>`
- `DNS: ucgi.local`, `DNS: *.ucgi.local`
- `IP: 127.0.0.1`, `IP: ::1`

Si necesitás un SAN extra (por ejemplo el hostname del VPS), editá `scripts/generate-certs.sh` en la sección `[alt_names]`.

## Levantar Nginx con los certs

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d nginx midpoint
sleep 5
curl -kvI https://localhost/healthz       # 200 con cert autofirmado (-k ignora warning)
curl -I  http://localhost/                # 301 → https://
```

## Confiar la CA en el navegador (opcional, pero recomendado para la demo final)

Sin esto, el navegador muestra **`Your connection is not private`** en cada visita. Para la demo conviene aceptar la CA una sola vez.

### Windows (Chrome/Edge/Firefox)

1. Doble click en `infra/nginx/certs/ca.crt`.
2. **Install Certificate** → **Local Machine** (admin) → **Place all certificates in the following store** → **Trusted Root Certification Authorities**.
3. Reiniciar el navegador.

### Linux (Chrome/Chromium)

```bash
mkdir -p ~/.pki/nssdb
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "UCGI Lab Root CA" -i infra/nginx/certs/ca.crt
```

### Firefox

`Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import` → seleccionar `ca.crt` → marcar "Trust this CA to identify websites".

### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain infra/nginx/certs/ca.crt
```

## Verificación end-to-end

```bash
# 1. Cert válido y SAN correcto:
openssl s_client -connect localhost:443 -servername localhost < /dev/null 2>&1 \
  | grep -E "subject=|issuer=|TLSv|Verify return code"

# 2. HSTS está presente:
curl -kvI https://localhost/healthz 2>&1 | grep -i strict-transport

# 3. Redirect HTTP→HTTPS:
curl -sI http://localhost/ | head -3

# 4. Cipher acceptado (TLS 1.3 si servidor + cliente lo soportan):
curl -kvI https://localhost/healthz 2>&1 | grep -i "SSL connection using"
```

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| `ca.key` filtrada permitiría firmar certs arbitrarios para el dominio del lab. | `ca.key` nunca se commitea; chmod 600; usar solo en localhost. En producción usar Let's Encrypt y guardar la CA fuera del repo. |
| Cert expira sin aviso → todo el lab inaccesible. | Re-ejecutar el script. Considerar un cron alert 30 días antes (queda para HU-08.4 Alertas Prometheus). |
| Browser cachea HSTS de un cert que ya no confiamos → no se puede entrar. | `chrome://net-internals/#hsts` → Delete domain security policies (en el browser de desarrollo). |
| Cert con SAN insuficiente para el dominio real. | Editar `[alt_names]` en el script y regenerar. |

## Mapeo ISO

- **ISO 27001 A.8.24 (Uso de criptografía):** TLS 1.2+ y cifrado en tránsito en todos los planos web. Cert + key documentados, no embedded en imágenes.
- **ISO 27001 A.5.15 (Control de accesos):** Nginx termina TLS y propaga la identidad al upstream con `X-Forwarded-For` y `X-Forwarded-Proto`, manteniendo la trazabilidad.
- **ISO 25010 Seguridad:** 0 vulnerabilidades CRITICAL — los certs autofirmados quedan aceptados solo en el entorno controlado del lab; la prueba final con cert real es trivial (cambiar 2 archivos).
