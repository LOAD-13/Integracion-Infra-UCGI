# ¿Qué hacen midPoint y SonarQube en el lab?

Estos dos servicios están UP en el compose pero su valor sólo se ve después de configurarlos. Aquí queda explicado qué hacen y cómo usarlos para la defensa del jueves.

---

## SonarQube

**URL:** http://localhost:9000 · **Usuario inicial:** `admin/admin` (cambialo al primer login).

### Qué hace

Analiza estáticamente tu código Java (integration-api) y TypeScript (CRM). Detecta:
- **Bugs reales**: NullPointerException posibles, recursos no cerrados, switches sin default, etc.
- **Code smells**: complejidad ciclomática alta, métodos largos, duplicación.
- **Vulnerabilities**: SQL injection patterns, hard-coded secrets, weak crypto.
- **Coverage**: lee el reporte JaCoCo / lcov y muestra qué líneas no tienen test.
- **Quality Gate**: pinta verde/rojo según tus thresholds (HU-06.1).

### Por qué importa para la rúbrica

ISO 25010 → **Mantenibilidad → Capacidad de análisis**. SonarQube es la evidencia más visible de que el código se puede inspeccionar automáticamente.

### Cómo usarlo

1. Levantar SonarQube si no está UP: `docker compose up -d sonar sonar-db`.
2. Esperar ~60s al primer arranque (download de bundled plugins).
3. Login admin/admin → cambiar password.
4. Crear token: `My Account → Security → Generate Token` → copiar.
5. Exportarlo: `export SONAR_TOKEN=<token>`.
6. Lanzar el análisis: `make sonar` (corre Java + TS).
7. Abrir el proyecto en la UI: `ucgi-integration-api` y `ucgi-crm-frontend`.

### Lo que vas a ver

Dashboard con:
- Coverage % (consume el `target/site/jacoco/jacoco.xml` y `coverage/lcov.info`).
- Issues clasificados por severidad (Blocker/Critical/Major/Minor/Info).
- Duplicación (% de líneas duplicadas).
- Tech debt en horas-hombre estimadas.

### Para la demo

Cargar el dashboard mostrando que ambos proyectos tienen Quality Gate verde + cobertura medida + 0 bugs Critical. Eso responde a "¿cómo verifican calidad?" con métricas concretas.

---

## midPoint

**URL:** http://localhost:8080/midpoint · **Usuario inicial:** `administrator / 5ecr3t`.

### Qué hace

midPoint es un **IDM (Identity Management)**: gestiona el ciclo de vida de usuarios y los provisiona automáticamente en sistemas externos. En el lab cumple dos roles:

1. **Single source of truth de usuarios**: vos creás un usuario en midPoint UI → midPoint lo escribe en `crm.users` (vía Scripted SQL Resource), y le pega al `integration-api` para crear la extensión SIP (vía REST Resource).
2. **Provisioning automático**: cuando asignás el rol `AgenteCallCenter` a un usuario, midPoint dispara el provisioning SIP en MikoPBX sin que vos toques nada.

### Por qué importa para la rúbrica

- ISO 25010 → **Compatibilidad → Interoperabilidad**: midPoint habla SQL con MariaDB Y REST con el microservicio.
- ISO 27001 → **A.5.15 + A.5.16 + A.5.17**: gestión de identidades, control de accesos, autenticación centralizada.
- Resuelve la inconsistencia #5 del PDF (sin LDAP, sólo conectores).

### Configuración mínima para que sirva

Los XMLs ya están en `infra/midpoint/resources/`. Importarlos:

1. Login `administrator/5ecr3t`.
2. `Configuration → Import Object` → subir `infra/midpoint/resources/midpoint-resource-crm-sql.xml`. Aparece en `Resources` como "CRM SQL".
3. Mismo flujo con `infra/midpoint/resources/midpoint-resource-crm-rest.xml`. Aparece como "CRM REST".
4. Importar el rol con `infra/midpoint/roles/role-agente-call-center.xml`. Aparece en `Roles → All`.
5. Para cada resource: `Test Connection` debe dar verde.

### Lo que vas a ver

- **Users**: lista con los usuarios de `crm.users` cuando hacés "Live Sync" del SQL resource.
- **Roles**: el `AgenteCallCenter` con inducements que disparan provision SIP.
- **Audit Trail**: cada cambio queda registrado con timestamp + actor + acción. Eso es ISO 27001 A.8.16.
- **Reconciliation**: midPoint puede correr `Reconciliation Task` para verificar que el estado en CRM SQL y MikoPBX coincida con el modelo.

### Para la demo

Mostrar el flujo:
1. Login midPoint admin.
2. `Users → New User` → llenar nombre, login, password → `Assignments → AgenteCallCenter`.
3. Save. Midpoint:
   - Crea fila en `crm.users` con el password bcrypteado.
   - Llama a `POST /api/v1/sip-extensions` del integration-api.
   - El integration-api crea la extensión en MikoPBX.
4. Verificar: el usuario nuevo aparece en el CRM (`admin → Users`) Y en MikoPBX GUI.

Eso responde a "¿cómo gestionan identidades?" con un IDM real funcionando, no con SQL hardcodeado.

---

## TL;DR para la defensa

- **SonarQube** es el "compilador con esteroides" que demuestra calidad de código + coverage + 0 bugs Critical.
- **midPoint** es el "Active Directory de software libre" que demuestra gestión centralizada de identidades + auto-provisioning + audit trail.
- Ambos están en docker-compose, ambos arrancan solos, y ambos tienen su sección dedicada en `docs/iso/iso-25010-mapping.md` y `iso-27001-mapping.md`.
