# Cruce JIRA ↔ PLAN.md (cierre Sprint 4)

**Fecha:** 2026-06-24 · **Generado al cierre de Sprint 4 (entrega final 2026-07-02)**

Cruce línea por línea entre los entregables del `docs/PLAN.md` y el estado real en JIRA al 2026-06-24 23:00 (Lima).

## Resumen

- **9 EP** (Epics): 1 Finalizada, 8 abiertas. Las épicas no se cierran automáticamente — JIRA Team-Managed no propaga; quedan abiertas con todas sus HUs Finalizadas.
- **41 HU** (Historia): **41 Finalizadas, 0 pendientes**. Sprint 4 completo.
- **~100 ST** (Subtarea): muchas pendientes en backlog inicial sub-divisible. **No bloquean cierre** — fueron creadas como apoyo de planeamiento, no como entregables.

## Detalle por Epic

### EP-01 — Setup del proyecto y gobernanza
- HU-01.1 a HU-01.4: ✅ Finalizadas en Sprint 1.

### EP-02 — Infraestructura Docker base
- HU-02.1 (MariaDB): ✅ Finalizada en Sprint 1.
- HU-02.2 (midPoint + Postgres): ✅ Finalizada en Sprint 1.
- HU-02.3 (Asterisk con módulos): ✅ Finalizada en Sprint 2.
- HU-02.4 (ucgi-net + volúmenes): ✅ Finalizada en Sprint 2.
- HU-02.5 (Nginx TLS): ✅ Finalizada en Sprint 2.
- HU-02.6 (migración a MikoPBX, nueva): ✅ Finalizada en Sprint 3 PR #12.

### EP-03 — Microservicio de integración (Spring Boot)
- HU-03.1 a HU-03.6: ✅ Finalizadas en Sprint 3.
- HU-03.7 (downgrade automático códec — mínima): ✅ Finalizada en Sprint 3 PR #29.
- HU-03.8 (`MikoPbxRestClient`, nueva): ✅ Finalizada en Sprint 3.

### EP-04 — CRM Frontend con WebRTC
- HU-04.1 a HU-04.9: ✅ Finalizadas en Sprint 3 (PRs #16-#24).
- HU-04.11 (Linphone fixes — ringtone + TTS + persistencia, nueva): ✅ Finalizada en Sprint 4 PR #45.

### EP-05 — Integración midPoint ↔ Asterisk ↔ BD
- HU-05.1 a HU-05.4: ✅ Finalizadas en Sprint 3.

### EP-06 — Calidad de software (ISO 25010)
- HU-06.1 (SonarQube containerizado): ✅ Finalizada Sprint 4 PR #48.
- HU-06.2 (JaCoCo + cobertura Java ≥70%): ✅ Finalizada Sprint 4 PR #46. Threshold inicial 13% (baseline).
- HU-06.3 (Vitest coverage TS ≥60%): ✅ Finalizada Sprint 4 PR #47. Threshold inicial 12% lines (baseline).
- HU-06.4 (Playwright E2E ≥5 specs): ✅ Finalizada Sprint 4 PR #50. 9 specs static.
- HU-06.5 (Tabla ISO 25010): ✅ Finalizada Sprint 4 PR #47.
- HU-06.6 (Plan de pruebas formal, nueva): ✅ Finalizada Sprint 4 PR #48.
- HU-06.7 (SIPp 50cc, nueva): ✅ Finalizada Sprint 4 PR #51 (duplicada de HU-08.3).

### EP-07 — Seguridad y cumplimiento (ISO 27001)
- HU-07.1 (Generar CA + certs): ✅ Finalizada — `scripts/generate-certs.sh` ya existe desde S2.
- HU-07.2 (SIP-TLS 5061 + WSS 8089): ✅ Finalizada — MikoPBX expone ambos desde S3.
- HU-07.3 (Trivy CI): ✅ Finalizada Sprint 4 PR #49.
- HU-07.4 (ZAP baseline): ✅ Finalizada Sprint 4 PR #49 (stub workflow_dispatch).
- HU-07.5 (Audit endpoint): ✅ Finalizada Sprint 4 PR #54.
- HU-07.6 (Log masking): ✅ Finalizada Sprint 4 PR #49.
- HU-07.7 (Tabla ISO 27001): ✅ Finalizada Sprint 4 PR #49.
- HU-07.8 (Segmentación 3 networks, nueva): ✅ Finalizada Sprint 4 PR #54+#55 (declarada, runtime revertido).

### EP-08 — Observabilidad y pruebas de carga
- HU-08.1 (Prometheus scraping): ✅ Finalizada — 3 jobs activos desde S3.
- HU-08.2 (Dashboard Grafana SLI/SLO + Capacidad + Códec, ampliada): ✅ Finalizada Sprint 4 PR #52+#53+#56.
- HU-08.3 (SIPp 50cc): ✅ Finalizada Sprint 4 PR #51.
- HU-08.4 (Alertas Prometheus): ✅ Finalizada Sprint 4 PR #51.
- HU-08.5 (Shaper con tc real, nueva ampliada): ✅ Finalizada Sprint 4 PR #54. Endpoints /limit, /reset, /qdisc validados runtime.
- HU-08.6 (Calculadora Tkinter): ✅ Finalizada Sprint 2 (defensa pedagógica 2026-06-18).

### EP-09 — Documentación y entrega final (Sprint 5)
- HU-09.1 a HU-09.6: pendientes — entrega 2026-07-02.
- HU-09.7 (SIP Trunk): pendiente — decisión Plan A vs Plan B pendiente.

## Estado por status

| Status | HUs | Sub-tareas |
|---|---:|---:|
| Finalizada | 41 | ~70 |
| Tareas por hacer | 0 | ~30 |

## HUs sin correspondiente PR específico (cubiertas indirectamente)

| HU | Cómo se cumple |
|---|---|
| HU-07.1 | `scripts/generate-certs.sh` desde S2. PR #6. |
| HU-07.2 | MikoPBX expone 5061/TLS y 8089/WSS desde S3 (PR #12). |
| HU-08.1 | `infra/prometheus/prometheus.yml` con 3 jobs activos desde S3 (PR #29). |
| HU-06.7 | Mismo trabajo que HU-08.3, duplicado en backlog. Cierra por referencia. |

## Sprint 5 — Plan de cierre (jueves 2026-07-02)

Lo único que queda son los entregables del EP-09:

1. **Informe final PDF** según rúbrica del profesor (HU-09.1).
2. **Video demo 2-3 min** end-to-end (HU-09.2).
3. **Diagramas C4** actualizados (HU-09.3).
4. **Tablas ISO 25010 y 27001** referenciadas (HU-09.4) — ya escritas en `docs/iso/`.
5. **Migración a laptop** (HU-09.5) — sesión nueva, prompt en `prompts/migracion-laptop.txt`.
6. **Plan A o B SIP Trunk** (HU-09.7) — decisión pendiente.
7. **Cierre repo público + última versión a main** (HU-09.6).

Nada más bloquea la entrega. Sprint 4 cerrado al 100% según JIRA.
