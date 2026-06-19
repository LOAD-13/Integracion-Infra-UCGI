# Infraestructura Unificada de Comunicaciones y Gestión de Identidad (UCGI)

Laboratorio de Integración de Sistemas — Curso de Calidad de Software.

Prototipo funcional de una plataforma para una telco que integra una central telefónica (Asterisk) con un sistema de gestión de identidades (midPoint) bajo estándares ISO/IEC 25010 y ISO 27001. Todo orquestado con Docker Compose, con un CRM React/WebRTC embebido como interfaz del agente.

## Visión general

| Componente | Tecnología | Función |
|------------|-----------|---------|
| CRM | React 18 + TypeScript + Vite + Tailwind + SIP.js | Panel del agente con softphone WebRTC integrado |
| integration-api | Spring Boot 3 (Java 17) | Microservicio intermediario midPoint ↔ Asterisk |
| midPoint | evolveum/midpoint | Gestión de identidades (IAM) |
| Asterisk | debian:bullseye + PJSIP + WebSocket + SRTP | PBX/VoIP con SIP-TLS y WebRTC |
| MariaDB | mariadb:10.6 | Persistencia (esquemas `midpoint` y `crm`) |
| Nginx | nginx:alpine | Reverse proxy con TLS terminado |
| SonarQube | sonarqube:lts-community | Análisis estático y quality gate |
| Prometheus + Grafana | latest | Observabilidad y dashboards |
| SIPp | scenario XML | Pruebas de carga VoIP |

## Requisitos

- Docker 24+ y Docker Compose 2.20+
- Make (opcional, atajos en `Makefile`)
- 8 GB RAM libres y 15 GB de disco
- Puertos libres en el host: 80, 443, 3306, 5060/udp, 5061/tcp, 8089, 8080, 9000, 9090, 3001 y RTP 10000-10100/udp

## Cómo levantar el entorno

> Instrucciones provisionales del Sprint 1. Se completan a medida que avanza la implementación.

```bash
# 1. Clonar
git clone https://github.com/LOAD-13/Integracion-Infra-UCGI.git
cd Integracion-Infra-UCGI

# 2. Variables y certificados
cp .env.example .env
./scripts/generate-certs.sh

# 3. Levantar
docker compose up -d --build

# 4. Verificar
docker compose ps
curl -k https://localhost/
```

Acceso por defecto:
- CRM: <https://localhost/>
- midPoint: <https://localhost/midpoint> (`administrator` / `5ecr3t`)
- Grafana: <http://localhost:3001>
- SonarQube: <http://localhost:9000>

## Estructura del repositorio

```
Integracion-Infra-UCGI/
├── docker-compose.yml          Orquestación principal (perfil prod)
├── docker-compose.dev.yml      Overrides para desarrollo (SIP plano)
├── .env.example                Plantilla de variables globales
├── docs/                       Arquitectura, ISO, runbooks, evidencias
├── infra/                      Dockerfiles y configs de la infra (asterisk, midpoint, nginx, etc.)
├── services/                   Código fuente
│   ├── integration-api/        Microservicio Spring Boot
│   └── crm-frontend/           CRM React + WebRTC
├── tests/                      Pruebas de carga (SIPp), seguridad (ZAP/Trivy), E2E
├── scripts/                    Utilidades (generar certs, git-as, etc.)
└── .github/workflows/          CI/CD
```

Detalle completo en [`docs/PLAN.md`](docs/PLAN.md).

## Flujo de desarrollo

Usamos **GitFlow simplificado** y **Conventional Commits**:

- `main` — estable, protegida, taggeada (`v0.1`, `v1.0-entrega`, …)
- `develop` — integración. Todo PR de feature aterriza aquí.
- `feature/EP-XX-HU-YY-slug` — una rama por Historia de Usuario.
- `release/X.Y` — preparación de entrega.
- `hotfix/*` — solo si algo crítico salta en `main`.

Convención de commits:

```
feat(api): provisionar extensión SIP [IUDCYGI-20]
fix(crm): reconexión wss tras pérdida de red [IUDCYGI-26]
docs(iso): mapeo control A.8.16 [IUDCYGI-48]
test(api): tests de PjsipConfigWriter [IUDCYGI-21]
chore(infra): bump asterisk 20.5 → 20.7 [IUDCYGI-16]
```

Toda referencia a un issue va con su clave JIRA `[IUDCYGI-NN]`.

## Equipo

| Integrante | Rol | Áreas principales |
|------------|-----|-------------------|
| Joaquín Loa Denegri ([LOAD-13](https://github.com/LOAD-13)) | Integrador + Tech Lead | `services/integration-api`, `services/crm-frontend`, integración midPoint ↔ Asterisk, decisiones técnicas |
| Kiara Santti Saavedra | Arquitecto DevOps #1 | `infra/asterisk`, `infra/midpoint`, `docker-compose.yml`, redes |
| Raul Socualaya | Arquitecto DevOps #2 | `infra/nginx`, certificados TLS, `infra/prometheus`, `infra/grafana` |
| Genesis Salazar Tarazona | Product Owner + QA | `docs/`, backlog JIRA, README, informe final, `tests/`, SonarQube, seguridad |

## Estándares cubiertos

- **ISO/IEC 25010** — Calidad de software (Funcionalidad, Eficiencia, Compatibilidad, Usabilidad, Fiabilidad, Seguridad, Mantenibilidad, Portabilidad). Ver [`docs/iso/iso-25010-mapping.md`](docs/iso/iso-25010-mapping.md).
- **ISO 27001:2022** — Controles del Anexo A (acceso, autenticación, criptografía, monitoreo, controles de red). Ver [`docs/iso/iso-27001-mapping.md`](docs/iso/iso-27001-mapping.md).

## Gestión de tareas

Backlog en JIRA: [proyecto IUDCYGI](https://jloadenegri.atlassian.net/browse/IUDCYGI). 9 épicas, 49 historias, ~100 subtareas.

## Licencia

[MIT](LICENSE).
