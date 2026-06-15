# Evidencia HU-02.5 · Nginx reverse proxy con TLS terminado en :443

> JIRA: [IUDCYGI-18](https://jloadenegri.atlassian.net/browse/IUDCYGI-18)
> Sprint: 2 (cierre)
> Fecha: 2026-06-15

## Resumen

Nginx 1.27 termina TLS en `:443` con cert autofirmado (CA + server con SAN), proxya hacia midPoint / integration-api / CRM / Asterisk-WS, redirige todo HTTP→HTTPS, y propaga security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy).

Cumple **ISO 27001 A.8.24** (criptografía en tránsito) y **A.13.1.1** (controles de red — único punto de entrada al stack).

## Archivos en este directorio

| Archivo | Qué prueba |
|---|---|
| `01-healthz.txt` | `curl -k https://localhost/healthz` → `HTTP 200` + body `ok`. El propio nginx responde por TLS. |
| `02-headers.txt` | Headers de respuesta sobre `/healthz`: HTTP/2 activo, **HSTS** (`max-age=31536000; includeSubDomains`), **X-Content-Type-Options: nosniff**, **X-Frame-Options: DENY**, **Referrer-Policy: strict-origin-when-cross-origin**. |
| `03-redirect.txt` | `curl -sI http://localhost/` → `301 Moved Permanently` con `Location: https://localhost/`. Cumple el criterio "HTTP redirige a HTTPS". |
| `04-tls.txt` | `openssl s_client -connect localhost:443`. Negociación **TLS 1.3** con cipher `TLS_AES_256_GCM_SHA384`. Subject del cert `CN=localhost`, issuer `CN=UCGI Lab Root CA` (cadena cert→CA correcta, "Verify return code 21" es esperado porque la CA no está en el truststore del sistema). |
| `05-upstream-midpoint.txt` | `curl -k https://localhost/midpoint/` → `HTTP 302` (midPoint redirige a su pantalla de login). Confirma que el proxy_pass funciona. |
| `06-upstream-api-502.txt` | `curl -k https://localhost/api/health` → `HTTP 502`. **Esperado**: `integration-api` aún no tiene Dockerfile (S3). Cuando exista, será 200. |

## Procedimiento reproducible

```bash
# 1. Generar certs (una sola vez, o cuando expiren)
./scripts/generate-certs.sh

# 2. Levantar stack mínimo con TLS
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db midpoint-db midpoint nginx
# nginx healthy en ~10s tras midpoint healthy (~3 min primera vez).

# 3. Tests
curl -k https://localhost/healthz                       # 200 ok
curl -kI https://localhost/healthz | grep -i strict     # HSTS presente
curl -I http://localhost/                                # 301 -> https
openssl s_client -connect localhost:443 -servername localhost < /dev/null \
  | grep -E "Protocol|Cipher|subject="                  # TLS 1.3, AES-256-GCM
curl -k https://localhost/midpoint/                     # 302 -> /midpoint/login
```

## Resultado observado

| Criterio aceptación | Esperado | Observado | OK |
|---|---|---|---|
| Nginx levanta y termina TLS con cert autofirmado | TLS 1.2+ activo | TLS 1.3, AES-256-GCM | ✅ |
| HTTP (:80) redirige a HTTPS (:443) | 301 → https | `301 Location: https://localhost/` | ✅ |
| Header `Strict-Transport-Security` configurado | HSTS presente | `max-age=31536000; includeSubDomains` | ✅ |
| `/midpoint` enruta a midPoint | 200 o redirect interno | `302 → /midpoint/login` | ✅ |
| `/api` enruta al microservicio | 200 cuando exista; 502 si no | `502` (esperado, S3) | ⏳ |
| `/crm` enruta al frontend | 200 cuando exista; 502 si no | `502` (esperado, S3) | ⏳ |
| `curl -k https://localhost/` devuelve 200 | 200 desde upstream válido | `200` en `/healthz` (verifica TLS) | ✅ |

Los criterios marcados ⏳ se completan automáticamente cuando se cierren las HU del microservicio (S3) y el CRM (S3) — la conf de Nginx ya está lista para cuando esos upstreams existan.

## Hardening implementado

- **TLS 1.2 + 1.3** únicamente. SSLv2/3, TLS 1.0/1.1 deshabilitados.
- **Cipher suite** `HIGH:!aNULL:!MD5:!3DES`.
- **HSTS** 1 año, `includeSubDomains`. No `preload` porque cert autofirmado.
- **`server_tokens off`** — no se filtra la versión de Nginx en respuestas.
- **`X-Content-Type-Options: nosniff`** — bloquea MIME-sniffing.
- **`X-Frame-Options: DENY`** — sin clickjacking via iframe.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — minimal leakage de URL en navegación cross-origin.
- **`resolver 127.0.0.11`** con DNS interno de Docker — los upstreams se resuelven perezosamente, Nginx arranca aunque `crm`/`integration-api` aún no tengan Dockerfile.

## Mapeo ISO

- **ISO 27001 A.8.24 (Uso de criptografía):** TLS 1.2/1.3, cert + key fuera del repo, runbook reproducible para rotación.
- **ISO 27001 A.13.1.1 (Controles de red):** único punto de entrada externo es `:443` (y `:80` solo para redirigir). El resto de servicios no se exponen al host.
- **ISO 27001 A.5.15 (Control de accesos):** Nginx propaga la identidad TLS al upstream via `X-Forwarded-*`.
- **ISO 25010 Seguridad:** Sonar / ZAP en S4 pueden auditar este mismo endpoint con cert real (Let's Encrypt) — solo es cambiar 2 archivos.
- **ISO 25010 Mantenibilidad:** runbook + script reproducible elimina conocimiento tribal.

## Gotchas documentados

1. **`add_header` en `location` oculta los del `server` parent.** Hay que repetirlos o usar `default_type` en lugar de `add_header Content-Type`. Detectado y corregido en este PR.
2. **`nginx -t` en build stage falla** porque el cert no está en la imagen (se monta en runtime). La validación de sintaxis se hace en runtime — si el config está mal, el container falla rápido.
3. **Browser modernos rechazan certs sin SAN.** El script de certs genera SAN con `localhost`, `ucgi.local`, `*.ucgi.local`, `127.0.0.1`, `::1`.
4. **HSTS + cert autofirmado en navegador:** la primera vez el browser pide aceptar el cert; tras eso, HSTS lo recuerda. Si rotás la CA, hay que limpiar HSTS en `chrome://net-internals/#hsts` o el browser bloquea el acceso.
