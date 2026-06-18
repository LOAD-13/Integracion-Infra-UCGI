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

## Endpoints en HU-03.1

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/actuator/health` | Liveness/readiness (200 con `{"status":"UP"}`) |
| GET | `/actuator/info` | Metadatos del build |
| GET | `/actuator/prometheus` | Métricas JVM en formato Prometheus |

Los endpoints de negocio se añaden en HU-03.2 (`POST /api/v1/sip-extensions`), HU-03.5 (`POST /api/v1/auth/login`) y HU-03.6 (`GET /api/v1/cdr`).

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
- En HU-03.1 se excluyen las auto-config de DataSource, JPA y Security para que el contenedor arranque sin BD ni auth. Se reactivan progresivamente en HU-03.2 (JPA) y HU-03.5 (Security+JWT) eliminando las entradas correspondientes en `spring.autoconfigure.exclude` de `application.yml`.
