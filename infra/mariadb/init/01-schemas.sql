-- 01-schemas.sql
-- Crea el esquema `midpoint` (el esquema `crm` lo crea MariaDB automaticamente
-- desde la variable MARIADB_DATABASE del contenedor) y otorga privilegios al
-- usuario de aplicacion `ucgi_app` sobre ambos esquemas.
--
-- Se ejecuta automaticamente al primer arranque del contenedor `db` porque el
-- directorio /docker-entrypoint-initdb.d/ esta montado en el compose.

-- Crear el esquema midpoint con utf8mb4 (recomendado por evolveum/midpoint
-- para soportar caracteres unicode en nombres y descripciones).
CREATE DATABASE IF NOT EXISTS midpoint
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Asegurar que el esquema crm tambien usa utf8mb4 (por si MariaDB lo creo
-- con otro charset por defecto).
ALTER DATABASE crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Otorgar privilegios al usuario de aplicacion sobre ambos esquemas.
-- El usuario `ucgi_app` lo crea MariaDB automaticamente con MARIADB_USER,
-- pero los privilegios automaticos cubren solo MARIADB_DATABASE (`crm`).
GRANT ALL PRIVILEGES ON midpoint.* TO 'ucgi_app'@'%';
GRANT ALL PRIVILEGES ON crm.*      TO 'ucgi_app'@'%';

FLUSH PRIVILEGES;
