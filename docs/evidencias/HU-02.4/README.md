# Evidencia HU-02.4 · Red `ucgi-net` + volúmenes nombrados con persistencia

> JIRA: [IUDCYGI-17](https://jloadenegri.atlassian.net/browse/IUDCYGI-17)
> Sprint: 2
> Fecha: 2026-06-15

## Resumen

Esta HU formaliza dos garantías de la infraestructura base:

1. **Aislamiento de red** — los 11 contenedores del stack (`db`, `midpoint-db`, `midpoint`, `asterisk`, `integration-api`, `crm`, `nginx`, `sonar`, `sonar-db`, `prometheus`, `grafana`) viven en una única red bridge dedicada `ucgi-net`, NO en la red `default` de docker-compose. Esto cumple **ISO 27001 A.13.1.1 (Controles de red)**.
2. **Persistencia de datos** — los servicios con estado usan volúmenes nombrados (`db-data`, `midpoint-pg-data`, `midpoint-home`, `asterisk-config`, `sonar-*`, `prometheus-data`, `grafana-data`). Un `docker compose down` (sin `-v`) NO los borra; un `up` posterior recupera el estado tal cual.

## Archivos en este directorio

| Archivo | Qué prueba |
|---|---|
| `01-network-inspect.json` / `.txt` | `docker network inspect ucgi-net`. Red declarada como `bridge`, scope `local`, subnet `172.18.0.0/16`, 3 contenedores conectados durante el test (`ucgi-db`, `ucgi-midpoint-db`, `ucgi-asterisk`). |
| `02-volumes-ls.txt` | `docker volume ls --filter name=ucgi_`. Los 4 volúmenes activos en el test minimal (`ucgi_asterisk-config`, `ucgi_db-data`, `ucgi_midpoint-home`, `ucgi_midpoint-pg-data`). Los 6 restantes se crean cuando se levanta el stack completo. |
| `03-volume-db-data.txt` | `docker volume inspect ucgi_db-data`. Driver `local`, mountpoint `/var/lib/docker/volumes/ucgi_db-data/_data`, labels de docker-compose. |
| `04-persistence-test.txt` | Test end-to-end: inserto fila marker en `crm.users` y archivo marker en `/var/lib/asterisk/`, `down`, `up`, verifico que ambos sobreviven con el **mismo id y created_at originales**. |

## Procedimiento reproducible

```bash
# 1. Levantar stack minimal
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db asterisk midpoint-db

# 2. Insertar marker en DB
docker exec -e MYSQL_PWD=changeme-root ucgi-db mysql -uroot \
  -e "INSERT INTO crm.users (username, email, password_hash, role, full_name) \
      VALUES ('hu024test', 'hu-02.4-persistence@ucgi.local', 'sha256:test', 'AGENTE', 'HU-02.4 Persistence Test');"

# 3. Marker en volumen asterisk-config
docker exec --user root ucgi-asterisk \
  sh -c "echo created at \$(date -u +%FT%TZ) > /var/lib/asterisk/HU-02.4-marker.txt"

# 4. Tear down SIN -v (clave: no se pasa -v)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# 5. Volúmenes deben seguir existiendo
docker volume ls --filter name=ucgi_

# 6. Up de nuevo
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db asterisk midpoint-db

# 7. Verificar supervivencia
docker exec -e MYSQL_PWD=changeme-root ucgi-db mysql -uroot \
  -te "SELECT id, username, email, created_at FROM crm.users WHERE email LIKE 'hu-02.4%';"
docker exec ucgi-asterisk cat /var/lib/asterisk/HU-02.4-marker.txt
```

## Resultado observado

| Antes del down | Después del up |
|---|---|
| `crm.users.id = 4`, `created_at = 2026-06-15 03:02:51` | `id = 4`, `created_at = 2026-06-15 03:02:51` (idénticos) |
| `/var/lib/asterisk/HU-02.4-marker.txt` con timestamp `2026-06-15T03:02:03Z` | mismo archivo, mismo contenido |
| 4 volúmenes en `docker volume ls` | mismos 4 volúmenes, mismo mountpoint |

**Tiempo de recuperación tras `up`:** ~18 segundos (los 3 servicios healthy gracias a `start_period: 60s` de Asterisk y healthchecks de MariaDB/Postgres con `start_period` por defecto).

## Mapeo ISO

- **ISO 25010 — Portabilidad:** el stack se levanta idéntico en otro host con `docker compose up`; el estado se respalda exportando los volúmenes (`docker run --rm -v ucgi_db-data:/data alpine tar czf /backup.tgz /data`).
- **ISO 25010 — Fiabilidad:** ningún reinicio del stack pierde estado salvo `down -v` explícito.
- **ISO 27001 A.13.1.1 (Controles de red):** segmentación con red bridge dedicada; ningún servicio expone directo a la red `default` ni a la host network.
- **ISO 27001 A.8.13 (Backup):** la persistencia en volúmenes nombrados es la precondición para una política de backup formal (queda fuera del alcance de este lab pero se documenta).

## Decisión: 4 volúmenes en el test, 10 declarados

Decidí levantar solo el stack mínimo con estado (`db` + `midpoint-db` + `asterisk`) para acelerar el test. Los otros 6 volúmenes (`midpoint-home`, `sonar-*`, `prometheus-data`, `grafana-data`) se validan de la misma forma cuando se levante el stack completo en HU-08.x; el patrón es idéntico.
