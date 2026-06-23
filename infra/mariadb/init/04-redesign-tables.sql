-- 04-redesign-tables.sql
-- Tablas y columnas nuevas que da soporte al rediseno del CRM DialFlow:
--   * Catalogo de tags + asignacion N:M a clientes.
--   * Habilidades (skills) y agentes asignados.
--   * Reglas de routing entrante (DID/trunk -> skill, con horario).
--   * Configuracion de parking + menu IVR post-timeout.
--   * Campanas outbound (Manual, Progresiva, Predictiva) y contactos.
--   * Notificaciones por usuario.
--   * Estado de agente (disponible / descanso / ocupado / DND / offline)
--     persistido en users.
--
-- Idempotente: usa IF NOT EXISTS y ADD COLUMN IF NOT EXISTS (MariaDB 10.0+).

USE crm;

-- ----------------------------------------------------------------------------
-- users: estado de agente persistente.
-- ----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS agent_status ENUM('AVAILABLE','BREAK','BUSY','DND','OFFLINE')
      NOT NULL DEFAULT 'OFFLINE' AFTER active,
  ADD COLUMN IF NOT EXISTS status_since TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER agent_status;

-- ----------------------------------------------------------------------------
-- sip_extensions: marca de manualattributes para que el servicio sepa si la
-- extension fue creada con override o con defaults.
-- ----------------------------------------------------------------------------
ALTER TABLE sip_extensions
  ADD COLUMN IF NOT EXISTS manual_attributes_applied BOOLEAN NOT NULL DEFAULT FALSE AFTER enabled;

-- ----------------------------------------------------------------------------
-- client_tags: catalogo gestionable de tags.
-- Los is_system=TRUE son seed inmutable (VIP, Moroso, Nuevo, etc.).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_tags (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  name        VARCHAR(40)  NOT NULL,
  color_bg    VARCHAR(40)  NOT NULL,
  color_text  VARCHAR(40)  NOT NULL,
  is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_client_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_tag_assignments (
  client_id BIGINT NOT NULL,
  tag_id    BIGINT NOT NULL,
  PRIMARY KEY (client_id, tag_id),
  KEY idx_cta_tag (tag_id),
  CONSTRAINT fk_cta_client FOREIGN KEY (client_id) REFERENCES clients(id)     ON DELETE CASCADE,
  CONSTRAINT fk_cta_tag    FOREIGN KEY (tag_id)    REFERENCES client_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO client_tags (name, color_bg, color_text, is_system) VALUES
  ('VIP',          'rgba(224,147,11,.15)',  '#b9760a', TRUE),
  ('Moroso',       'rgba(226,59,84,.13)',   '#c4243c', TRUE),
  ('Nuevo',        'rgba(21,168,200,.14)',  '#0c7c97', TRUE),
  ('Reincidente',  'rgba(124,58,237,.13)',  '#7338c4', TRUE),
  ('Empresa',      'rgba(15,48,86,.1)',     '#0f3056', TRUE),
  ('Soporte',      'rgba(22,163,74,.13)',   '#15803d', TRUE)
ON DUPLICATE KEY UPDATE color_bg = VALUES(color_bg), color_text = VALUES(color_text);

-- ----------------------------------------------------------------------------
-- skills: habilidades / colas de routing por especialidad.
-- strategy: como distribuye llamadas entre los agentes asignados.
--   ALL_TO_FIRST  = "todos a mi" (sin balanceo, todas al primer agente disponible)
--   ROUND_ROBIN   = rotacion
--   LONGEST_IDLE  = el que mas tiempo lleva libre
--   LEAST_BUSY    = el que menos llamadas atendio en el turno
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  name            VARCHAR(80)  NOT NULL,
  description     VARCHAR(255) NULL,
  strategy        ENUM('ALL_TO_FIRST','ROUND_ROBIN','LONGEST_IDLE','LEAST_BUSY')
                  NOT NULL DEFAULT 'ROUND_ROBIN',
  max_wait_seconds INT         NOT NULL DEFAULT 120,
  overflow_skill_id BIGINT     NULL,                       -- a que skill saltan si no hay agentes
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_skills_name (name),
  CONSTRAINT fk_skills_overflow FOREIGN KEY (overflow_skill_id) REFERENCES skills(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skill_agents (
  skill_id  BIGINT NOT NULL,
  user_id   BIGINT NOT NULL,
  priority  INT    NOT NULL DEFAULT 0,                     -- mayor = se intenta antes
  PRIMARY KEY (skill_id, user_id),
  KEY idx_sa_user (user_id),
  CONSTRAINT fk_sa_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  CONSTRAINT fk_sa_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO skills (name, description, strategy, max_wait_seconds) VALUES
  ('General',  'Atencion comercial generica.',     'ROUND_ROBIN',  120),
  ('Soporte',  'Soporte tecnico nivel 1.',         'LONGEST_IDLE', 180),
  ('Cobranza', 'Gestion de cobranzas y morosos.',  'ALL_TO_FIRST', 60)
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ----------------------------------------------------------------------------
-- inbound_routes: reglas de entrada DID/trunk -> skill destino.
-- priority bajo = se evalua antes (ordenable en UI).
-- schedule_kind: 24/7, business hours, custom.
--   business: lun-vie 09:00-18:00 (hardcodeado en service).
--   custom: usa schedule_start/end (HH:MM:SS) sobre dias_mask.
-- fallback_action: que hacer si no hay agentes y se agota wait.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbound_routes (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  did_number      VARCHAR(64)  NOT NULL,                    -- numero o trunk de entrada
  skill_id        BIGINT       NOT NULL,
  priority        INT          NOT NULL DEFAULT 100,
  schedule_kind   ENUM('ALWAYS','BUSINESS','CUSTOM') NOT NULL DEFAULT 'ALWAYS',
  schedule_start  TIME         NULL,
  schedule_end    TIME         NULL,
  days_mask       SMALLINT NOT NULL DEFAULT 127,            -- bits L(1) M(2) X(4) J(8) V(16) S(32) D(64); 127=todos
  fallback_action ENUM('VOICEMAIL','OVERFLOW_SKILL','HANGUP') NOT NULL DEFAULT 'VOICEMAIL',
  fallback_skill_id BIGINT     NULL,
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inbound_priority (priority),
  KEY idx_inbound_did      (did_number),
  CONSTRAINT fk_inbound_skill          FOREIGN KEY (skill_id)          REFERENCES skills(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inbound_fallback_skill FOREIGN KEY (fallback_skill_id) REFERENCES skills(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- parking_config: singleton (1 fila) con la config global del parking IVR.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parking_config (
  id              SMALLINT     NOT NULL DEFAULT 1,
  loop_seconds    INT          NOT NULL DEFAULT 30,
  timeout_seconds INT          NOT NULL DEFAULT 120,        -- a los X seg muestra el menu IVR
  greeting_url    VARCHAR(255) NULL,                        -- locucion inicial
  hold_music_url  VARCHAR(255) NULL,                        -- musica de espera
  volume_pct      SMALLINT     NOT NULL DEFAULT 80,
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_parking_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO parking_config (id, loop_seconds, timeout_seconds, volume_pct, enabled)
  VALUES (1, 30, 120, 80, TRUE)
  ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS parking_ivr_options (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  dtmf_key        VARCHAR(2)   NOT NULL,                    -- 0-9 * #
  label           VARCHAR(120) NOT NULL,
  action          ENUM('CALLBACK','KEEP_WAITING','HANGUP','TRANSFER_SKILL') NOT NULL,
  transfer_skill_id BIGINT     NULL,
  position        INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_parking_dtmf (dtmf_key),
  CONSTRAINT fk_parking_transfer_skill FOREIGN KEY (transfer_skill_id) REFERENCES skills(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO parking_ivr_options (dtmf_key, label, action, position) VALUES
  ('1', 'Solicitar devolucion de llamada', 'CALLBACK',      1),
  ('2', 'Seguir esperando',                'KEEP_WAITING',  2),
  ('3', 'Colgar',                          'HANGUP',        3)
ON DUPLICATE KEY UPDATE label = VALUES(label);

-- ----------------------------------------------------------------------------
-- campaigns: campanas outbound del agente (3 tipos del audio del profe).
-- MANUAL     = el agente marca a mano + devolucion de llamadas.
-- PROGRESSIVE = lista de contactos cargada; el sistema dispara una a una al ritmo del agente.
-- PREDICTIVE  = algoritmo con TMO; dispara N llamadas y distribuye respuestas.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120) NOT NULL,
  type            ENUM('MANUAL','PROGRESSIVE','PREDICTIVE') NOT NULL,
  status          ENUM('DRAFT','RUNNING','PAUSED','FINISHED') NOT NULL DEFAULT 'DRAFT',
  owner_user_id   BIGINT       NULL,                        -- agente al que pertenece (NULL = de todos)
  skill_id        BIGINT       NULL,                        -- para PREDICTIVE/PROGRESSIVE asociado a skill
  pacing_factor   DECIMAL(4,2) NOT NULL DEFAULT 1.00,       -- multiplicador de TMO (predictive)
  max_concurrent  INT          NOT NULL DEFAULT 1,          -- llamadas paralelas (predictive)
  caller_id       VARCHAR(64)  NULL,                        -- numero saliente
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaigns_owner (owner_user_id),
  CONSTRAINT fk_campaign_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)  ON DELETE SET NULL,
  CONSTRAINT fk_campaign_skill FOREIGN KEY (skill_id)      REFERENCES skills(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  campaign_id     BIGINT       NOT NULL,
  client_id       BIGINT       NULL,                        -- opcional si matchea cliente existente
  phone           VARCHAR(64)  NOT NULL,
  display_name    VARCHAR(255) NULL,
  status          ENUM('PENDING','DIALING','ANSWERED','NO_ANSWER','BUSY','FAILED','DONE')
                  NOT NULL DEFAULT 'PENDING',
  attempts        INT          NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP    NULL,
  position        INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_cc_campaign_status (campaign_id, status, position),
  KEY idx_cc_client (client_id),
  CONSTRAINT fk_cc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_client   FOREIGN KEY (client_id)   REFERENCES clients(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- notifications: cola por usuario.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  kind        ENUM('MISSED_CALL','NOTE_ASSIGNED','NEW_CLIENT','METRICS_UPDATED','SYSTEM')
              NOT NULL DEFAULT 'SYSTEM',
  title       VARCHAR(255) NOT NULL,
  link        VARCHAR(255) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at     TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_notif_user_unread (user_id, read_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
