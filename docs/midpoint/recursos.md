# Recursos midPoint del lab UCGI

> Documentación de los recursos de identidad configurados en midPoint y su
> rol en la integración con el CRM y MikoPBX. Última actualización:
> 2026-06-19 (HU-05.1).

## Inventario

| Resource OID | Nombre | Tipo conector | Origen / Destino | HU |
|---|---|---|---|---|
| `11111111-1111-1111-1111-111111111111` | CRM SQL | DatabaseTable (JDBC MariaDB) | `crm.users` | HU-05.1 (IUDCYGI-33) |
| `22222222-2222-2222-2222-222222222222` | Integration API REST | Scripted REST (Groovy) | `integration-api` | HU-05.2 (IUDCYGI-34) |

## CRM SQL

**Archivo:** `infra/midpoint/resources/resource-crm-sql.xml`

### Mapeo de columnas

| Columna `crm.users` | Atributo midPoint (`AccountObjectClass`) | Atributo UserType | Sentido |
|---|---|---|---|
| `username` | `ri:username` | `name` | inbound + outbound |
| `email` | `ri:email` | `emailAddress` | inbound + outbound |
| `full_name` | `ri:full_name` | `fullName` | inbound + outbound |
| `role` | `ri:role` | `extension/crmRole` | inbound (informativo) |
| `active` | `ri:active` | `activation/administrativeStatus` | bidireccional con script de conversión `'enabled' ↔ true` |
| `password_hash` | (passwordColumn) | `credentials/password` | outbound `weak` (no rota lo que ya esté hasheado) |

### Cómo importar

1. Levantar midPoint: `docker compose up -d midpoint midpoint-db db` y esperar healthy.
2. Importar el XML vía REST:

   ```bash
   curl -k -u administrator:$MP_ADMIN_PASSWORD \
     -H "Content-Type: application/xml" \
     -X POST \
     --data-binary @infra/midpoint/resources/resource-crm-sql.xml \
     https://localhost:8443/midpoint/ws/rest/resources
   ```

   (Para acceder por UI: `http://localhost:8080/midpoint/` → Configuration →
   Import Object → seleccionar el archivo.)
3. **Test Connection** desde la UI: Resources → "CRM SQL" → barra superior
   → Test Connection. Los 4 cuadrantes (Connector init, Configuration,
   Connection, Schema) deben quedar verdes.
4. Importar usuarios desde el recurso: Resources → "CRM SQL" → Accounts →
   Import. midPoint creará/linkeará los `UserType` correspondientes.

### Troubleshooting

- **Test connection falla en "Schema":** el conector DatabaseTable necesita
  que la tabla tenga `keyColumn` único. `crm.users.id` es PK, así que debería
  funcionar. Si no, revisar que el conector pueda hacer `SHOW COLUMNS`.
- **`Could not find driver`:** el bundle ConnId DatabaseTable trae el driver
  para H2/PostgreSQL pero no para MariaDB — agregar el JAR al
  `/opt/midpoint/var/lib/midpoint/icf-connectors/` del contenedor (no incluido
  todavía en `infra/midpoint/Dockerfile`; pendiente de subtarea).

## Integration API REST

**Archivo:** `infra/midpoint/resources/resource-integration-api.xml` (HU-05.2).

Conector Scripted REST con scripts Groovy embebidos en
`infra/midpoint/scripts/integration-api/`:

| Script | Responsabilidad |
|---|---|
| `TestREST.groovy` | Test Connection — `GET /actuator/health` debe responder UP. |
| `SchemaREST.groovy` | Define `__ACCOUNT__` con `extensionNumber` (key, no actualizable) + `sipPassword` + `displayName`. |
| `CreateREST.groovy` | `POST /api/v1/sip-extensions`; 409 → idempotente; relogin si 401. |
| `UpdateREST.groovy` | `PUT /api/v1/sip-extensions/{id}`; noop si el endpoint no existe todavía. |
| `DeleteREST.groovy` | `DELETE /api/v1/sip-extensions/{id}`; 404 idempotente. |
| `SearchREST.groovy` | `GET /api/v1/sip-extensions` paginado → ConnectorObjects. |

**Auth:** los scripts hacen login técnico contra `POST /api/v1/auth/login`
con el user/password configurado en el resource (admin / `5ecr3t` en dev).
El JWT se obtiene por llamada — en producción se cachearía en una variable
estática del script con TTL 50 min.

**Cómo importar:**

```bash
# 1. Montar scripts en el contenedor midPoint (Dockerfile HU-05.x):
#    COPY infra/midpoint/scripts /opt/midpoint/var/lib/midpoint/scripts
# 2. Importar el XML del recurso:
curl -k -u administrator:$MP_ADMIN_PASSWORD \
  -H "Content-Type: application/xml" \
  -X POST \
  --data-binary @infra/midpoint/resources/resource-integration-api.xml \
  https://localhost:8443/midpoint/ws/rest/resources
```

### Mapeo de atributos

| Atributo midPoint | Atributo CRM/MikoPBX | Outbound |
|---|---|---|
| `ri:username` | `crm.sip_extensions.user.username` | `$user/name` |
| `ri:displayName` | `crm.sip_extensions.display_name` | `$user/fullName` |
| `ri:extensionNumber` | `crm.sip_extensions.extension_number` | UUID-derived (1000-1099) |
| `ri:sipPassword` | `crm.sip_extensions.sip_password` | secure random 24 chars |

## Rol AgenteCallCenter

**Archivo:** `infra/midpoint/roles/role-agente-callcenter.xml` (HU-05.3).

Define el rol cuya asignación a un `UserType` dispara el outbound mapping
hacia el recurso REST → API → MikoPBX provisioning. Documentación al cerrar
HU-05.3.
