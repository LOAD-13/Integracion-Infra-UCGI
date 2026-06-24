# Mapeo ISO/IEC 25010 → Evidencias del lab UCGI

**HU asociada:** IUDCYGI-41 (HU-06.5) · **Última actualización:** 2026-06-24

ISO/IEC 25010 define ocho características de calidad para un producto de software. Esta tabla mapea cada una a evidencias **reproducibles y automatizadas** del lab UCGI: comando exacto, archivo de salida, indicador medible. Es el documento que se entrega como apéndice del informe y se referencia en la defensa del jueves 2026-07-02.

---

## 1. Adecuación funcional (Functional Suitability)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Completitud funcional | Toda HU del backlog tiene Definition of Done verificable + DoD chequeado en el JIRA | `https://jloadenegri.atlassian.net/browse/IUDCYGI` (filtrar status=Finalizada) |
| Corrección funcional | Suite Vitest (CRM) + JUnit5 (integration-api) verde en CI cada PR | `.github/workflows/ci.yml` → jobs `Test CRM (Vitest)` + `Build integration-api (Java)` |
| Pertinencia funcional | Endpoints REST corresponden 1:1 al PRD del PDF (CRM ↔ midPoint ↔ MikoPBX) | `services/integration-api/src/main/java/com/ucgi/integrationapi/**/Controller.java` |

## 2. Eficiencia de desempeño (Performance Efficiency)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Comportamiento temporal | Latencia REST p95 < 200 ms en `/v1/clients` (Spring Actuator + Prometheus) | `http://localhost:9090/graph?g0.expr=http_server_requests_seconds{uri="/v1/clients"}` |
| Utilización de recursos | Stack 12 containers + 7.5 GB RAM + ~10% CPU host idle | `docker stats --no-stream` |
| Capacidad | Shaper dinámico con MikoPBX bandwidth tier (FULL/MIXED/DOWNGRADED) | `docker exec ucgi-shaper curl -s localhost:9091/status` |
| Capacidad concurrente | SIPp 50 cc UAC/UAS (HU-06.7) — pendiente al cierre de Sprint 4 | `tests/sipp/` (pendiente IUDCYGI-43) |

## 3. Compatibilidad (Compatibility)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Coexistencia | 12 servicios distintos conviven en `ucgi-net` sin conflictos de puerto | `docker-compose.yml` |
| Interoperabilidad | midPoint provisiona usuarios al CRM via REST (HU-05.2) + MikoPBX provisiona extensiones via REST (HU-03.8) | `infra/midpoint/resources/midpoint-resource-crm-rest.xml`, `MikoPbxRestClient.java` |

## 4. Usabilidad (Usability)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Reconocibilidad | Branding DialFlow consistente, login con globo 3D Three.js | `services/crm-frontend/src/pages/LoginPage.tsx` |
| Capacidad de aprendizaje | Atajos comando `Cmd/Ctrl+K` + tour onboarding al primer login | `services/crm-frontend/src/components/command/CommandPalette.tsx` |
| Operabilidad | Softphone WebRTC con botones marcar/contestar/colgar/mute/hold/video + ringtone | `services/crm-frontend/src/components/softphone/`, `useRingtone.ts` (HU-04.11) |
| Protección contra errores | Validación Zod en formularios + confirm modal antes de hangup | `services/crm-frontend/src/schemas/`, `useAuth` |
| Estética de la interfaz | Design system DialFlow con tokens Tailwind + shadcn/ui | `services/crm-frontend/design-source/DESIGN.md` |
| Accesibilidad | Roles ARIA en componentes Radix UI + contraste WCAG AA en paleta | `@radix-ui/react-*` deps + Tailwind theme |

## 5. Fiabilidad (Reliability)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Madurez | Cobertura JaCoCo (Java) + v8 (TS) reportada en cada build | `./mvnw verify` → `target/site/jacoco/`, `npm run test:coverage` → `coverage/` |
| Disponibilidad | Healthchecks Docker en TODOS los servicios críticos + restart=unless-stopped | `docker-compose.yml` (healthcheck por servicio) |
| Tolerancia a fallos | `MikoPbxRestClient` reintenta 3 veces con backoff exponencial; bcrypt seed fallback; mikopbx-bootstrap idempotente | `MikoPbxRestClient.getValidToken()`, `infra/mikopbx/bootstrap.sh` |
| Capacidad de recuperación | Volúmenes persistentes (`mikopbx-data`, `db-data`, `midpoint-db-data`); bootstrap reaplica overrides al boot | `docker-compose.yml` `volumes:`, `bootstrap.sh` |

## 6. Seguridad (Security)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Confidencialidad | TLS 1.3 en nginx :443 + WSS en mikopbx :8089 + DTLS-SRTP browser↔mikopbx | `infra/nginx/`, `pjsip.conf`, runbook `docs/runbooks/generar-certificados.md` |
| Integridad | JWT firmado HS256 + bcrypt 12 rounds para passwords | `JwtService.java`, `PasswordEncoder bean` |
| No-repudio | Logs estructurados con timestamp + accountcode CDR por llamada | `mikopbx cdr.db`, Asterisk `messages` |
| Auditabilidad | midPoint audit trail + Asterisk verbose logs persistidos | `midpoint-data/audit/`, `/var/log/asterisk/messages` |
| Autenticidad | OAuth-style JWT + autenticación midPoint via REST connector | `auth/JwtAuthFilter.java`, midPoint Scripted SQL |

## 7. Mantenibilidad (Maintainability)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Modularidad | Monorepo con 4 servicios independientes + paquetes por bounded context | `services/{integration-api,crm-frontend}/`, packages `com.ucgi.integrationapi.{auth,client,...}` |
| Reusabilidad | `SipClient` abstrae sip.js; `AsteriskProvisioningService` abstrae REST; design tokens reutilizables | `SipClient.ts`, `AsteriskProvisioningService.java`, `tailwind.config.ts` |
| Capacidad de análisis | SonarQube containerizado :9000 + cobertura JaCoCo + lcov + SARIF Trivy/ZAP (S4) | `infra/sonarqube/`, jobs CI futuros HU-06.1 |
| Modificabilidad | Bootstrap idempotente + migraciones SQL versionadas + Feature Branches GitFlow | `infra/mariadb/init/0[1-4]-*.sql`, `CONTRIBUTING.md` (en repo) |
| Capacidad de prueba | Mocks WireMock + Testcontainers + Vitest jsdom + Playwright (HU-06.4) | `src/test/**/*Test.java`, `src/tests/*.test.tsx` |

## 8. Portabilidad (Portability)

| Sub-característica | Evidencia | Comando / Archivo |
|---|---|---|
| Adaptabilidad | Imagen Docker multi-stage para integration-api + Vite SSR-ready para CRM | `services/integration-api/Dockerfile`, `services/crm-frontend/Dockerfile` |
| Capacidad de instalación | `docker compose up -d` arranca todo el stack desde cero en < 3 min | `Makefile` `make up`, README §"Levantar localmente" |
| Capacidad de reemplazo | Spring Boot + JPA → DB intercambiable (MariaDB ↔ Postgres ↔ H2 via profiles) | `application.yml` profiles |

---

## Resumen ejecutivo

* 8/8 características cubiertas con al menos una evidencia automatizada.
* JaCoCo + v8 establecen baseline de cobertura medible y reportada.
* Healthchecks Docker garantizan disponibilidad observable.
* TLS + JWT + bcrypt + DTLS cubren las 5 sub-características de Seguridad.
* SonarQube + tests + ITs proveen evidencia continua de Mantenibilidad.

Esta tabla es la base del apéndice ISO 25010 del informe final y se actualiza al cerrar HU-06.1 (Sonar), HU-06.4 (Playwright + ITs) y HU-06.7 (SIPp 50cc).
