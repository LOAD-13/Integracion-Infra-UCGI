# infra/midpoint/Dockerfile
# Imagen midPoint del lab UCGI.
#
# Pin version: 4.4.11 LTS (Marzo 2025). La rama 4.4 es la ultima version de
# midPoint que mantiene soporte funcional de MariaDB en el generic repository.
# En 4.5+ el conector mariadb fue marcado deprecated y en 4.7.4 ya lanza
# "Unsupported database type: mariadb" al arrancar. Desde 4.8 evolveum elimino
# el generic repo por completo (solo PostgreSQL native).
#
# Mantener 4.4 LTS nos da soporte oficial hasta ~2026 (rama 4.4-support).
#
# Nuestra arquitectura UCGI usa MariaDB 10.6 (decision tomada en docs/PLAN.md §2.1
# para resolver la inconsistencia del PDF original). Por lo tanto, este Dockerfile
# fija midPoint 4.4.11 para mantener compatibilidad con el resto del stack.
#
# Cuando llegue el momento de migrar a una version mas reciente (post-entrega),
# habria que cambiar a PostgreSQL o quedarse en la rama 4.7-support de evolveum.

FROM evolveum/midpoint:4.4.11

LABEL maintainer="UCGI lab — DevOps Mikiasa/RSocualaya"
LABEL component="midpoint"
LABEL description="midPoint IAM 4.4.11 con generic repository MariaDB e init-at-startup"

# INIT_AT_STARTUP=true le indica al entrypoint oficial que ejecute los scripts
# SQL de bootstrap del repositorio en el primer arranque. La imagen 4.4.11 trae
# el DDL PostgreSQL en /opt/midpoint/doc/config/sql/generic-old/postgresql-4.4-all.sql.
ENV INIT_AT_STARTUP=true

# JVM heap moderado para entorno de desarrollo (la imagen oficial respeta MP_MEM_MAX).
ENV MP_MEM_MAX=2048m
ENV MP_MEM_INIT=512m
