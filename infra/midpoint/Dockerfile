# infra/midpoint/Dockerfile
# Imagen midPoint del lab UCGI.
#
# Pin version: 4.7.4 (Marzo 2024). Es la ultima version de midPoint que soporta
# el "generic repository" sobre MariaDB. Desde 4.8 evolveum eliminó ese conector
# y solo soporta el "native repository" sobre PostgreSQL.
#
# Nuestra arquitectura UCGI usa MariaDB 10.6 (decision tomada en docs/PLAN.md §2.1
# para resolver la inconsistencia del PDF original). Por lo tanto, este Dockerfile
# fija midPoint 4.7.4 para mantener compatibilidad con el resto del stack.
#
# Cuando llegue el momento de migrar a una version mas reciente (post-entrega),
# habria que cambiar a PostgreSQL o quedarse en la rama 4.7-support de evolveum.

FROM evolveum/midpoint:4.7.4

LABEL maintainer="UCGI lab — DevOps Mikiasa/RSocualaya"
LABEL component="midpoint"
LABEL description="midPoint IAM 4.7.4 con generic repository MariaDB e init-at-startup"

# INIT_AT_STARTUP=true le indica al entrypoint oficial que ejecute los scripts
# SQL de bootstrap del repositorio en el primer arranque. midPoint trae el DDL
# embebido en /opt/midpoint-dist/doc/config/sql/generic-new/mariadb-*.sql.
ENV INIT_AT_STARTUP=true

# JVM heap moderado para entorno de desarrollo (la imagen oficial respeta MP_MEM_MAX).
ENV MP_MEM_MAX=2048m
ENV MP_MEM_INIT=512m
