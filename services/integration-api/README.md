# integration-api

Microservicio intermediario entre **midPoint** (IAM) y **Asterisk** (PBX).

Expone una API REST que midPoint consume para provisionar extensiones SIP, recargar Asterisk vía AMI, autenticar agentes con JWT y exponer el histórico de CDR al CRM. A partir de S3 también consulta `ucgi-shaper` para aplicar downgrade automático de códec según el ancho de banda disponible (HU-03.7).

## Stack

| Capa | Tecnología |
| --- | --- |
| Lenguaje | Java 17 (Eclipse Temurin) |
| Framework | Spring Boot 3.3.5 |
| Build | Maven 3.9.x vía Maven Wrapper |
| Observabilidad | Spring Actuator + Micrometer Prometheus |
| Persistencia (S3+) | Spring Data JPA + MariaDB |
| Seguridad (S3+) | Spring Security + JJWT 0.12 |
| Plantillas (S3+) | JMustache (genera `pjsip.conf`) |
| Asterisk (S3+) | asterisk-java (AMI client) |
| Tests | JUnit 5 + Testcontainers MariaDB + WireMock |

## Endpoints

| Método | Ruta | HU | Qué hace |
| --- | --- | --- | --- |
| GET | `/actuator/health` | 03.1 | Liveness/readiness (200 con `{"status":"UP"}`) |
| GET | `/actuator/info` | 03.1 | Metadatos del build |
| GET | `/actuator/prometheus` | 03.1 | Métricas JVM en formato Prometheus |
| POST | `/api/v1/sip-extensions` | 03.2 | Alta de extensión SIP. Body `{username, password, extensionNumber, displayName}`. Devuelve 201 + Location. Errores: 400 (Bean Validation), 404 (username no existe), 409 (extension o user duplicados). |

Los endpoints futuros: HU-03.5 (`POST /api/v1/auth/login`) y HU-03.6 (`GET /api/v1/cdr`).

## Cómo levantar localmente

```bash
cd services/integration-api
./mvnw -B spring-boot:run
# luego:
curl http://localhost:8081/actuator/health
```

## Build dentro del contenedor

```bash
docker build -t ucgi/integration-api:0.1.0-SNAPSHOT .
docker run --rm -p 8081:8081 ucgi/integration-api:0.1.0-SNAPSHOT
```

El `Dockerfile` es multi-stage (`temurin:17-jdk` → `temurin:17-jre`), corre como usuario no-root `ucgi:ucgi` (uid/gid 1001) y trae healthcheck sobre `/actuator/health`.

## Notas de configuración

- Puerto fijo `:8081` (PLAN.md §3.1).
- A partir de HU-03.2 se reactivan DataSource y JPA (las excludes se redujeron a Security, que vuelve en HU-03.5).
- `hibernate.ddl-auto=validate` — las tablas vienen creadas por `infra/mariadb/init/*.sql`; Hibernate solo verifica que las entidades mapeen columnas existentes. Si una entity tiene una `@Column` que no existe en BD, el contenedor falla al arrancar (intencionado, fail-fast).
- Tests con Testcontainers MariaDB: los init SQL están duplicados en `src/test/resources/db/init/` para que el módulo sea autocontenido (ver README de esa carpeta).
