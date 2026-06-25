# Guion demo — midPoint + SonarQube

Para la presentación del jueves 2026-07-02. Cubre los 5 minutos que dedicaría a mostrar que ambas piezas están desplegadas, qué hacen y cómo encajan en el lab.

---

## 1. SonarQube (1-2 minutos)

### Qué decir

> "SonarQube es un analizador estático de código. Lo tenemos containerizado en `localhost:9000`. Analiza el Java del microservicio y el TypeScript del CRM. Reporta cobertura JaCoCo y lcov, bugs, code smells, vulnerabilidades y duplicación. Es la evidencia automatizada de ISO 25010 característica Mantenibilidad → Capacidad de análisis."

### Qué mostrar visualmente

#### Opción A — Sin haber corrido scan (sin token configurado)

1. Abrir `http://localhost:9000`.
2. Mostrar la UI Sonar arrancada (pantalla "Projects" vacía o con "Sonar way" quality gate).
3. Mostrar el archivo `sonar-project.properties` en VS Code para cada servicio:
   - `services/integration-api/sonar-project.properties`
   - `services/crm-frontend/sonar-project.properties`
4. Mostrar el `Makefile` con los targets `sonar-up`, `sonar-api`, `sonar-crm`.
5. Decir: "Para correr el análisis solo hay que generar un token desde la UI, exportarlo y correr `make sonar`. El framework está listo."

**Tiempo:** 60-90s.

#### Opción B — Con scan corrido (5 minutos extra antes de la demo)

1. Logueate como `admin/admin` y cambiá password al primer login.
2. `My Account → Security → Generate Token` → nombre "demo", tipo "Global Analysis Token" → copiar.
3. Exportar y correr:
   ```bash
   export SONAR_TOKEN=<token>
   make sonar-api
   ```
4. Esperar ~2 min al primer análisis Java.
5. En la UI verás:
   - Project `UCGI Integration API` con métricas.
   - **Coverage** ~14% (JaCoCo XML cargado).
   - **Bugs / Code Smells / Vulnerabilities** numerados por severidad.
   - **Duplications** %.
   - **Quality Gate** verde si pasa los thresholds default.

Mostrar en demo: dashboard del proyecto con los 4 widgets (Bugs/Vulnerabilities/Code Smells/Coverage) y la sección "Activity" con el run reciente.

**Tiempo:** 90-120s.

### Frase para cerrar

> "Esto cubre las 8 sub-características de ISO 25010 que dependen de calidad de código: madurez (cobertura), análisis (sonar), modificabilidad (issues), reusabilidad (duplicación)."

---

## 2. midPoint (2-3 minutos)

### Qué decir

> "midPoint es un Identity Management de código abierto — el equivalente libre de un Azure AD. En el lab lo usamos para centralizar el ciclo de vida de usuarios: creamos un usuario en midPoint, asignamos un rol AgenteCallCenter, y midPoint dispara la provisión SIP en MikoPBX automáticamente. Cubre ISO 27001 controles A.5.15, A.5.16 y A.5.17."

### Qué mostrar visualmente

#### Opción A — Sin haber importado XMLs (estado actual del lab)

1. Abrir `http://localhost:8080/midpoint`.
2. Login `administrator / 5ecr3t`.
3. Mostrar el dashboard de midPoint vacío.
4. Ir a `Configuration → Repository Objects → Resources` → ver "No items".
5. Mostrar los XMLs en VS Code:
   - `infra/midpoint/resources/midpoint-resource-crm-sql.xml`
   - `infra/midpoint/resources/midpoint-resource-crm-rest.xml`
   - `infra/midpoint/roles/role-agente-call-center.xml`
6. Decir: "Estos 3 XMLs definen los conectores SQL y REST + el rol que dispara provisioning. Para activarlos se importan con `Configuration → Import Object`."

**Tiempo:** 60s.

#### Opción B — Con XMLs importados (5 minutos extra antes de la demo)

1. `Configuration → Import Object` → subir `midpoint-resource-crm-sql.xml`. Aparece en `Resources` como "CRM SQL".
2. `Test Connection` → verde.
3. Igual con `midpoint-resource-crm-rest.xml` → "CRM REST".
4. Importar el rol `role-agente-call-center.xml` → aparece en `Roles`.

Flujo demo end-to-end (más vistoso):

1. `Users → New User`:
   - Name: `Demo User`
   - Username: `demo_jueves`
   - Password: `Demo2026!`
   - **Assignments → +** → seleccionar `AgenteCallCenter` → Save.
2. Esperar ~5s. midPoint:
   - Escribe la fila en `crm.users` con password bcrypteado.
   - Llama a `POST /api/v1/sip-extensions` del integration-api con `{ username: "demo_jueves", ... }`.
   - El integration-api crea la extensión en MikoPBX.
3. Verificar:
   - **Browser nuevo**: login al CRM `demo_jueves / Demo2026!` → entra al dashboard.
   - **GUI MikoPBX** (`http://localhost:8090`, admin/Deathnote2005): `Telephony → Extensions` → aparece la extensión nueva (probablemente 1004 o siguiente disponible).
4. Mostrar el **Audit Trail** de midPoint:
   - `Reports → Audit logs` → ver la entrada del User creation + Assignment.
   - Eso es la evidencia ISO 27001 A.8.16 — monitoreo de actividades.

**Tiempo:** 120-150s.

### Frase para cerrar

> "Eso es provisioning end-to-end: el admin no toca SQL ni REST, solo midPoint UI. El usuario nuevo está en CRM, en MikoPBX, y queda auditado. Si mañana le quito el rol AgenteCallCenter, midPoint deshabilita la extensión SIP automáticamente — lifecycle completo en un único punto."

---

## 3. Si NO hay tiempo de configurar (10 segundos de mención)

Frase canónica para el video o la presentación:

> "Tenemos midPoint y SonarQube containerizados en el stack (puertos 8080 y 9000). midPoint cubre los controles ISO 27001 A.5.15 a A.5.17 sobre gestión de identidades — los conectores SQL y REST hacia el CRM están escritos en `infra/midpoint/resources/`. SonarQube analiza Java y TypeScript con cobertura JaCoCo y lcov; el comando `make sonar` lo lanza. Por tiempo de demostración hoy mostramos solo las UIs desplegadas y la configuración versionada en el repo; el run completo está documentado en `docs/runbooks/que-hacen-midpoint-y-sonar.md`."

---

## Material visual rápido (si querés screenshots para slides)

Para tomar antes del jueves:

1. SonarQube login + dashboard "Projects" (vacío o con uno).
2. SonarQube Quality Profile "Sonar way".
3. midPoint dashboard post-login.
4. midPoint `Resources` con los conectores configurados (Opción B).
5. midPoint `Reports → Audit` con un evento.
6. midPoint creating user form con el assignment del rol AgenteCallCenter.

Guardar todos en `docs/evidencias/HU-05.x/` y `docs/evidencias/HU-06.1/`.
