-- 02-crm-tables.sql
-- Tablas del esquema `crm` requeridas por el microservicio integration-api
-- y el frontend crm-frontend. Diseno alineado con HU-02.1 (DoD) y EP-03/EP-04.

USE crm;

-- ----------------------------------------------------------------------------
-- users — agentes de call center y administradores.
-- La autenticacion real corre via midPoint (recurso SQL), por lo que este
-- esquema es la fuente de verdad para la identidad de los usuarios del CRM.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  username        VARCHAR(64)  NOT NULL,
  email           VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NULL,                  -- bcrypt; NULL si midPoint es el unico IdP
  role            ENUM('ADMIN','AGENTE') NOT NULL DEFAULT 'AGENTE',
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email    (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- sip_extensions — extension SIP asignada por midPoint a cada agente.
-- midPoint inserta aqui al provisionar el rol AgenteCallCenter (HU-05.3).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sip_extensions (
  id                BIGINT      NOT NULL AUTO_INCREMENT,
  user_id           BIGINT      NOT NULL,
  extension_number  VARCHAR(20) NOT NULL,
  sip_password      VARCHAR(64) NOT NULL,             -- autogenerada por midPoint
  enabled           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sip_extension_number (extension_number),
  UNIQUE KEY uk_sip_user             (user_id),
  CONSTRAINT fk_sip_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- clients — clientes/contactos atendidos por el call center.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  name         VARCHAR(255) NOT NULL,
  phone        VARCHAR(32)  NOT NULL,
  email        VARCHAR(255) NULL,
  company      VARCHAR(255) NULL,
  notes_summary TEXT        NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clients_phone (phone),
  KEY idx_clients_name  (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- cdr — Call Detail Records. El microservicio los inserta tras leer eventos
-- AMI de Asterisk. Usados por el CRM para mostrar historial por cliente.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cdr (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  call_id           VARCHAR(128) NOT NULL,            -- uniqueid de Asterisk
  agent_user_id     BIGINT       NULL,
  client_id         BIGINT       NULL,
  caller_number     VARCHAR(64)  NOT NULL,
  callee_number     VARCHAR(64)  NOT NULL,
  direction         ENUM('INBOUND','OUTBOUND','INTERNAL') NOT NULL,
  start_time        DATETIME     NOT NULL,
  answer_time       DATETIME     NULL,
  end_time          DATETIME     NULL,
  duration_seconds  INT          NOT NULL DEFAULT 0,
  disposition       ENUM('ANSWERED','NO_ANSWER','BUSY','FAILED') NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cdr_call_id (call_id),
  KEY idx_cdr_start_time (start_time),
  KEY idx_cdr_agent      (agent_user_id),
  KEY idx_cdr_client     (client_id),
  CONSTRAINT fk_cdr_agent  FOREIGN KEY (agent_user_id) REFERENCES users(id)   ON DELETE SET NULL,
  CONSTRAINT fk_cdr_client FOREIGN KEY (client_id)     REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- notes — notas del agente sobre un cliente, opcionalmente ligadas a una llamada.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  id              BIGINT    NOT NULL AUTO_INCREMENT,
  client_id       BIGINT    NOT NULL,
  author_user_id  BIGINT    NULL,
  cdr_id          BIGINT    NULL,
  body            TEXT      NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notes_client (client_id),
  KEY idx_notes_cdr    (cdr_id),
  CONSTRAINT fk_notes_client FOREIGN KEY (client_id)      REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_author FOREIGN KEY (author_user_id) REFERENCES users(id)   ON DELETE SET NULL,
  CONSTRAINT fk_notes_cdr    FOREIGN KEY (cdr_id)         REFERENCES cdr(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- agent_assignments — relacion N:M entre agentes y clientes que tienen asignados.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_assignments (
  id                   BIGINT    NOT NULL AUTO_INCREMENT,
  agent_user_id        BIGINT    NOT NULL,
  client_id            BIGINT    NOT NULL,
  assigned_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by_user_id  BIGINT    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_assign_agent_client (agent_user_id, client_id),
  KEY idx_assign_client (client_id),
  CONSTRAINT fk_assign_agent       FOREIGN KEY (agent_user_id)       REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_assign_client      FOREIGN KEY (client_id)           REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_assigned_by FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- audit_log — registro de eventos para evidencia ISO 27001 (Control A.8.16).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  event_time      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id   BIGINT       NULL,
  action          VARCHAR(64)  NOT NULL,             -- ej. LOGIN, CALL_INITIATED, CLIENT_UPDATED
  target_type     VARCHAR(64)  NULL,                 -- ej. CLIENT, USER, EXTENSION
  target_id       BIGINT       NULL,
  payload         JSON         NULL,
  ip_address      VARCHAR(45)  NULL,                 -- soporta IPv4 e IPv6
  PRIMARY KEY (id),
  KEY idx_audit_event_time (event_time),
  KEY idx_audit_actor      (actor_user_id),
  KEY idx_audit_action     (action),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
