-- 01-schemas.sql
-- Ajusta el esquema `crm` (creado por MariaDB desde MARIADB_DATABASE) a utf8mb4
-- y asegura privilegios completos para el usuario de aplicacion.
--
-- NOTA: midPoint NO usa este MariaDB. midPoint 4.4 dropeo el conector MariaDB,
-- asi que corre contra un PostgreSQL aparte (servicio `midpoint-db` en compose).
-- MariaDB queda dedicado al esquema CRM unicamente.
--
-- Se ejecuta automaticamente al primer arranque del contenedor `db` porque el
-- directorio /docker-entrypoint-initdb.d/ esta montado en el compose.

ALTER DATABASE crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON crm.* TO 'ucgi_app'@'%';

FLUSH PRIVILEGES;
