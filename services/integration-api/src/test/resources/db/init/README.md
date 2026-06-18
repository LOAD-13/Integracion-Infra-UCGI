# Scripts de inicialización para Testcontainers

Estos `*.sql` son copia exacta de `infra/mariadb/init/` (los que el contenedor productivo de MariaDB ejecuta al arrancar). Se duplican aquí para que los tests con Testcontainers monten un esquema idéntico al de producción **sin** acoplar el módulo `integration-api` a la estructura del repo (paths relativos `../../infra/...` se rompen al ejecutar el módulo en aislamiento).

**Si cambia el schema de producción**, copiar los nuevos `*.sql` aquí. Es la única duplicación viva del esquema CRM.
