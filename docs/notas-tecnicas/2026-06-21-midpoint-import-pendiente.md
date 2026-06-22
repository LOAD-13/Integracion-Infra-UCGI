# midPoint — driver MariaDB ya presente, import de XMLs pendiente

> Estado al cierre de la sesión 2026-06-21. Esta nota documenta hasta dónde
> llegamos con la integración midPoint y qué queda como deuda explícita para
> la próxima sesión.

## 1. Driver MariaDB JDBC

**RESUELTO sin cambios.** La imagen `evolveum/midpoint:4.4.11` ya incluye el
driver:

```
/opt/midpoint/var/work/Tomcat/localhost/midpoint/application-jars/mariadb-java-client-3.1.4.jar
```

No es necesario añadirlo al Dockerfile. El conector
`com.evolveum.polygon.connector.databasetable` y los scripts Groovy ya pueden
abrir conexiones JDBC a `jdbc:mariadb://db:3306/crm` sin nada extra.

Comando de verificación:

```bash
docker exec ucgi-midpoint find /opt/midpoint -name 'mariadb*.jar'
```

## 2. Import de los XMLs vía REST — bloqueado

Intentado durante esta sesión:

```bash
curl -u administrator:5ecr3t -X POST -H 'Content-Type: application/xml' \
  --data-binary @infra/midpoint/resources/resource-crm-sql.xml \
  http://localhost:8080/midpoint/ws/rest/resources
```

Respuesta:

```
HTTP/1.1 500
SchemaException: object delta does not have complete definition
```

### Causa probable

Los XMLs en `infra/midpoint/resources/` y `infra/midpoint/roles/` se escribieron
en HU-05.1/05.2/05.3 contra el schema 4.7+ (que es lo que documenta la wiki
actual de evolveum). midPoint 4.4.11 tiene un schema más estricto y rechaza
algunos elementos sin namespace explícito.

### Trabajo pendiente

1. Validar los 3 XMLs contra el schema 4.4 (`xsdval` o el plugin Studio).
2. Añadir namespaces faltantes (probablemente `ri:`, `q:` en los `objectClass`
   de las definitions inline).
3. Volver a probar el import — los `200 Created` deberían poder verse en la GUI
   (Configuration → Repository Objects → ResourceType).
4. Configurar la connection string en el XML con `db:3306/crm` y `ucgi_app /
   changeme-app`.
5. Probar el provisioning real: asignar rol AgenteCallCenter a un user nuevo y
   ver que aparece la fila en `crm.users` + extensión en MikoPBX (vía REST API
   del integration-api).

### Workaround temporal

La GUI de midPoint permite **importar XMLs manualmente** mientras el flujo
automático no esté listo:

1. `http://localhost:8080/midpoint/`  → admin: `administrator / 5ecr3t`.
2. Configuration → Import Object → seleccionar el XML → Import.
3. Si el XML tiene errores de schema, la GUI los muestra línea por línea y
   permite corregir antes de guardar.

## 3. Por qué no entró en esta sesión

La sesión fue dedicada a cerrar los **bugs bloqueantes de la demo** (sip.js
hostname/SAN, dialplan, MikoPbxRestClient 301, auto-provisión SIP). El midPoint
end-to-end requiere su propia ventana: ajustar 3 XMLs grandes y probarlos sin
afectar el resto del stack. La decisión consciente fue dejarlo para una sesión
dedicada de Sprint 4, después de cerrar HU-08.5 / HU-07.8 completas.

## 4. Cómo retomar

Sprint 4 — sesión "midPoint end-to-end":

1. Levantar el stack y verificar que midPoint UI responde.
2. Abrir cada XML en VS Code con el schema XSD 4.4 de evolveum (descargar de
   <https://github.com/Evolveum/midpoint/tree/v4.4.11/infra/schema/src/main/resources/xml>).
3. Iterar XML → import → fix error → import hasta ver `201 Created`.
4. Ejecutar `scripts/smoke-midpoint-provisioning.sh` (a crear) que dispare:
   - asignar rol AgenteCallCenter a un user nuevo
   - verificar fila en `crm.users`
   - verificar extensión en MikoPBX
   - asignar revocación del rol
   - verificar limpieza
