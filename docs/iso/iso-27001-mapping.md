# Mapeo ISO/IEC 27001:2022 Anexo A → Evidencias del lab UCGI

**HU asociada:** IUDCYGI-48 (HU-07.7) · **Última actualización:** 2026-06-24

Tabla que asocia 12 controles del Anexo A de ISO/IEC 27001:2022 con el componente del lab que los implementa y la evidencia verificable. Es el documento que se entrega como apéndice de seguridad del informe final.

---

## Tabla de controles

| Control | Cláusula | Componente | Evidencia / verificación |
|---|---|---|---|
| **Política de seguridad** | A.5.1 | Repo + `CONTRIBUTING.md` + `CLAUDE.md` | Reglas de no-secretos en commits, GitFlow obligatorio, identidades firmadas. |
| **Acceso autorizado a información** | A.5.15 | midPoint + Spring Security JWT | `JwtAuthFilter.java`, midPoint resources XML, ROLE_AGENT vs ROLE_ADMIN. |
| **Gestión de identidades** | A.5.16 | midPoint Scripted SQL + REST | `infra/midpoint/resources/`, provisioning idempotente. |
| **Autenticación** | A.5.17 | bcrypt (12 rounds) + JWT HS256 | `PasswordConfig.java`, `JwtService.signWith()`. |
| **Uso aceptable de información** | A.8.10 | Masking en logs | `MaskingConverter.java` (HU-07.6), `tests/security/check-logs.sh`. |
| **Monitoreo de actividades** | A.8.16 | midPoint audit trail + Asterisk verbose + `auth_log` (HU-07.5) | midPoint `audit/` table, `messages` de Asterisk con cada llamada, `audit_log` con login + provisioning. |
| **Gestión de vulnerabilidades técnicas** | A.8.8 | Trivy en CI (HU-07.3) | `.github/workflows/security.yml`, severidad CRITICAL bloquea merge. SARIF subido a pestaña Security. |
| **Protección contra software malicioso** | A.8.28 | Imágenes oficiales firmadas + Trivy + actualización periódica | Imágenes con tag inmutable, `docker-compose.yml`, scan nocturno opcional. |
| **Cifrado en tránsito (TLS)** | A.8.24 / A.13.1.1 | nginx TLS 1.3, SIP-TLS 5061, WSS 8089, DTLS-SRTP | `infra/nginx/conf.d/`, `pjsip.conf` transport-tls/wss, runbook `docs/runbooks/generar-certificados.md`. |
| **Cifrado en reposo** | A.8.24 | Volúmenes con configs + bcrypt para passwords + JWT firmado | `docker volume ls` `ucgi-*`, passwords nunca en plano (HU-07.6). |
| **Backup y recuperación** | A.8.13 | Volúmenes persistentes + bootstrap idempotente | `docker-compose.yml` `volumes:`, `bootstrap.sh` reaplica overrides al boot. |
| **Segmentación de red** | A.13.1.1 (heredado) | 3 networks `ucgi-frontend` / `ucgi-voip` / `ucgi-backend` | `docker-compose.yml` `networks:`, HU-07.8. |

---

## Detalle por control crítico

### A.8.10 — Uso aceptable de información (HU-07.6)

**Implementación:** `MaskingConverter` en `services/integration-api/src/main/java/com/ucgi/integrationapi/logging/MaskingConverter.java`. Logback-spring.xml lo invoca como `%mask` en el pattern del appender CONSOLE. Cubre 11 patrones de secretos: password (key=value, key:"value" JSON), Authorization Bearer/Basic, sip_secret, apiKey, X-Api-Key, adminPassword.

**Verificación automatizada:** `tests/security/check-logs.sh` corre contra el stack levantado, lee `.env` (valores reales), greppea las últimas 2000 líneas de logs de `ucgi-integration-api`, `ucgi-midpoint`, `ucgi-mikopbx`. Falla con exit 1 si encuentra cualquier secreto en plano.

**Tests unitarios:** `MaskingConverterTest` con 7 casos (key=value, JSON, Bearer, sip_secret, apiKey, adminPassword, sin secretos no toca).

### A.8.8 — Gestión de vulnerabilidades técnicas (HU-07.3)

**Implementación:** Workflow `security.yml` en `.github/workflows/`. Strategy matrix con 3 imágenes (integration-api, crm-frontend, nginx). Cada job hace `docker build` + `aquasecurity/trivy-action@0.28.0` con severidad `CRITICAL,HIGH`, formato SARIF subido a la pestaña Security de GitHub.

**Gate de merge:** un segundo paso corre Trivy en formato table con `severity=CRITICAL` y `exit-code=1` — los HIGH solo se loguean para revisión humana.

**Frecuencia:** cada PR a `main`/`develop` + on-push. Nightly opcional puede sumarse cuando exista un preview env.

### A.8.24 / A.13.1.1 — Cifrado en tránsito

**Implementación:**
- **HTTP/HTTPS:** nginx termina TLS 1.3 en :443. HSTS, security headers, redirect 80→443.
- **SIP signaling:** PJSIP transport-tls bound a 0.0.0.0:5061 con cert autofirmado regenerado por `bootstrap.sh` con SAN amplio.
- **WebSocket:** WSS bound a 0.0.0.0:8089 — SIP.js del browser usa el mismo certificado.
- **Media:** DTLS-SRTP entre browser ↔ MikoPBX (perfil `UDP/TLS/RTP/SAVPF`). Para Linphone móvil (que no soporta DTLS) el RTP es plano sobre la red docker controlada (HU-04.11 doc).

**Verificación:** `nmap --script ssl-enum-ciphers -p 443 localhost` lista TLS 1.3 únicamente. `tests/security/sip-tls-check.sh` (pendiente HU-07.2.x) intenta SIP-TLS handshake.

### A.13.1.1 — Segmentación de red (HU-07.8)

**Implementación:** 3 networks en `docker-compose.yml`:
- `ucgi-frontend` (nginx + crm + integration-api dual-NIC).
- `ucgi-voip` (mikopbx + integration-api dual-NIC).
- `ucgi-backend` (db + midpoint-db + sonar-db + midpoint + sonar).

**Verificación:** `docker network inspect ucgi-backend --format '{{range .Containers}}{{.Name}} {{end}}'` debe listar solo servicios de backend. Los containers `nginx` y `crm` NO deben aparecer.

---

## Mapeo cruzado con ISO 25010

Estos controles refuerzan las características de Seguridad (sub-Confidencialidad, Integridad, No-repudio, Autenticidad, Auditabilidad) documentadas en `docs/iso/iso-25010-mapping.md` §6.

| Característica ISO 25010 | Controles ISO 27001 que la implementan |
|---|---|
| Confidencialidad | A.8.10, A.8.24, A.13.1.1 |
| Integridad | A.5.15, A.5.17, A.8.10 |
| No-repudio | A.8.16 + CDR + audit trail |
| Auditabilidad | A.8.16 + Asterisk verbose + Spring Actuator |
| Autenticidad | A.5.15, A.5.16, A.5.17 |
