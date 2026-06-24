# Plan de pruebas — Lab UCGI

**HU asociada:** HU-06.6 · **Versión:** 1.0 · **Fecha:** 2026-06-24

Plan estructurado según las pautas dictadas en clase: Alcance, Roles, Diseño, Suites caja-negra/blanca/experiencia, V&V, Trazabilidad.

---

## 1. Alcance

### En alcance

- **Microservicio `integration-api`** (Spring Boot 3 / Java 17): endpoints REST de autenticación, gestión de clientes, notas, métricas, extensiones SIP, CDR, métricas admin, integraciones midPoint y MikoPBX.
- **CRM React** (`crm-frontend`): vistas de login, dashboard, clientes, llamadas, métricas, admin (usuarios, skills, parking, rutas inbound, tags).
- **MikoPBX**: registro de extensiones SIP, dial-plan, grabación de llamadas, NAT/SDP, MOH `ucgi-tts`.
- **midPoint**: provisioning idempotente de usuarios/extensiones.
- **Infraestructura compose**: 12 servicios, healthchecks, persistencia de volúmenes.
- **Shaper de ancho de banda**: cambio de tier según BW disponible, downgrade de códecs.

### Fuera de alcance

- **Pruebas de penetración avanzadas** (más allá de OWASP ZAP baseline). Se hacen en una iteración futura.
- **Carga > 100 cc** simultáneas. SIPp se acota a 50 cc por las limitaciones del entorno.
- **Conformidad legal específica** (HIPAA, PCI-DSS). El lab es académico.
- **Compatibilidad con browsers que no sean Chromium 122+/Firefox 127+**.

---

## 2. Roles y responsabilidades

| Rol | Persona simulada | Responsabilidad |
|---|---|---|
| Tech Lead | Joaquín Loa | Coordinación, code review, decisión arquitectónica |
| QA / PO | Génesis Salazar (alias `ash`) | Definición de criterios, ejecución de regresión, validación de DoD |
| DevOps #1 | Kiara Santti (alias `mikiasa`) | Infraestructura, CI/CD, pipelines de calidad |
| DevOps #2 | Raúl Socualaya (alias `rsocualaya`) | Networking, TLS, observabilidad |

Cada PR mergeado a `develop` requiere CI verde (4 jobs) + revisión cruzada simulada por las 4 identidades vía `scripts/git-as.sh`.

---

## 3. Diseño de pruebas

### 3.1 Tipos de prueba

| Tipo | Herramienta | Donde | Cuándo |
|---|---|---|---|
| Unitarias Java | JUnit 5 + Mockito + WireMock | `services/integration-api/src/test` | CI cada PR |
| Unitarias TS | Vitest + Testing Library | `services/crm-frontend/src/tests` | CI cada PR |
| Integración Java | Testcontainers + Spring Boot Test | `*IT.java` (gated por `-Pintegration-tests`) | CI dedicado HU-06.4 |
| E2E | Playwright (Chromium) | `tests/e2e/` (HU-06.4) | CI nocturno + on-demand |
| Carga SIP | SIPp UAC/UAS 50 cc | `tests/load/sipp/` (HU-06.7) | Manual antes de demo |
| Seguridad — vulnerabilidades imagen | Trivy | CI step (HU-07.4) | Cada PR + nightly |
| Seguridad — pentest superficial | OWASP ZAP baseline | CI step (HU-07.5) | Nightly |
| Análisis estático | SonarQube + JaCoCo + lcov | `docker compose up sonar` + `make sonar` | On-demand pre-merge |

### 3.2 Pirámide de pruebas (estado actual)

```
                    ┌────────────┐
                    │   E2E (5)  │   ← Playwright, HU-06.4 pendiente
                    └────────────┘
                ┌────────────────────┐
                │  Integración (8)   │   ← Testcontainers, gated
                └────────────────────┘
        ┌────────────────────────────────────┐
        │       Unitarias Java (40)          │   ← JUnit + Mockito en CI
        └────────────────────────────────────┘
   ┌────────────────────────────────────────────────┐
   │             Unitarias TS (37)                  │   ← Vitest en CI
   └────────────────────────────────────────────────┘
```

---

## 4. Suites por enfoque

### 4.1 Caja negra (Black-box)

Se prueban entradas/salidas sin conocer la implementación. Cubren los flujos del PRD:

- `POST /api/v1/auth/login` con credenciales válidas → 200 + JWT.
- `POST /api/v1/auth/login` con password inválido → 401.
- `GET /api/v1/clients?q=foo` con JWT válido → resultados filtrados.
- `GET /api/v1/clients` sin JWT → 401.
- `POST /api/v1/clients` con payload válido → 201 + recurso.
- `POST /api/v1/clients` con email inválido → 422 + detalle Zod-equivalente.
- Login en CRM, redirect a dashboard, softphone Registered.
- Marcado de cliente → llamada → CDR + grabación.

### 4.2 Caja blanca (White-box)

Se prueban paths internos con conocimiento del código. Cubiertas por JaCoCo + Vitest coverage:

- `JwtService.validateToken()`: token expirado, firma inválida, claim faltante.
- `AsteriskProvisioningService.createEmployee()`: éxito al intento 1, 2, 3 + fallo definitivo (loggea pero no propaga).
- `MikoPbxRestClient.getValidToken()`: refresh antes de 60s, login si no hay token.
- `ShaperPolicyService.computeTier()`: 25 escenarios LIST de cobertura branch.
- `useRingtone` hook: state transitions incoming → connected → idle.

### 4.3 Experiencia (Usability)

Se valida con usuarios simulados ejecutando flujos reales:

- **Flujo agente**: login → ver clientes asignados → marcar uno → conversación → notas → cerrar → métricas.
- **Flujo admin**: crear usuario en midPoint → propagación al CRM → asignación a skill → métricas por agente.
- **Flujo Linphone**: registro cuenta SIP en móvil → llamar al agente → agente contesta en browser → fin → grabación queda en CDR.

---

## 5. Verificación y validación (V&V)

| Punto de control | Verificación | Validación |
|---|---|---|
| Cada PR | Lint + tests unit + build OK (CI 4 jobs) | Revisor confirma DoD del JIRA |
| Cierre de HU | Cobertura no baja del umbral previo | Captura adjunta al JIRA |
| Cierre de Sprint | Demo guiada en branch `develop` | Smoke test manual del scope |
| Entrega final | Stack se levanta en máquina limpia | Profesor reproduce el flujo demo |

---

## 6. Trazabilidad

Cada HU JIRA tiene su rama `feature/EP-XX-HU-YY-slug`. Cada commit lleva la clave `[IUDCYGI-NN]` en el mensaje. El historial git → log de auditoría inversa.

| Característica ISO 25010 | HU del lab | Evidencia |
|---|---|---|
| Funcionalidad | HU-04.1 a HU-04.9 + HU-05.x | Tests JUnit + Vitest verdes |
| Eficiencia | HU-08.5 (shaper) + HU-06.7 (SIPp) | Métrica Prometheus + reporte SIPp |
| Compatibilidad | HU-04.2 + HU-03.8 | sip.js + REST contract tests |
| Usabilidad | HU-04.x rediseño DialFlow + HU-04.11 | Suites Vitest UI + demo manual |
| Fiabilidad | HU-06.2 + HU-06.3 + HU-06.4 | JaCoCo + v8 + Playwright |
| Seguridad | HU-07.x | TLS + JWT + Trivy + ZAP |
| Mantenibilidad | HU-06.1 + HU-06.5 + HU-06.6 (este doc) | Sonar + tabla ISO + plan de pruebas |
| Portabilidad | HU-02.x (compose + multi-stage) | `make up` desde repo limpio |

---

## 7. Criterios de salida del Sprint 4

- ✅ Todos los unit tests verdes en CI (Java + TS).
- ✅ JaCoCo + v8 coverage reportados como artifact en cada PR.
- ✅ Tabla ISO 25010 publicada y referenciada desde el informe.
- ⏳ SonarQube ejecutable localmente vía `make sonar` (HU-06.1).
- ⏳ E2E Playwright pasando para el flujo crítico login → cliente → llamada → CDR (HU-06.4).
- ⏳ SIPp 50 cc concurrentes sin pérdidas mayores al 1% (HU-06.7).
- ⏳ Trivy + ZAP sin Critical (HU-07.4 + HU-07.5).

Las marcadas con ⏳ se cierran en las HUs restantes del sprint.
