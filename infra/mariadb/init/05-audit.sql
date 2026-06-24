-- HU-07.5 (IUDCYGI-46) — Tabla de auditoría para control ISO 27001 A.8.16.
-- Registra cada login, logout y provisioning con timestamp + actor + acción.

USE crm;

CREATE TABLE IF NOT EXISTS audit_log (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    occurred_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actor        VARCHAR(80)  NULL COMMENT 'username del actor (null = system)',
    action       VARCHAR(40)  NOT NULL COMMENT 'login | logout | sip_provision | sip_revoke | role_assign | role_revoke',
    target_type  VARCHAR(40)  NULL COMMENT 'user | extension | role',
    target_id    VARCHAR(80)  NULL COMMENT 'identificador del recurso afectado',
    outcome      VARCHAR(16)  NOT NULL DEFAULT 'success' COMMENT 'success | failure',
    ip_address   VARCHAR(64)  NULL,
    user_agent   VARCHAR(255) NULL,
    metadata     TEXT         NULL COMMENT 'JSON con detalles adicionales',
    PRIMARY KEY (id),
    INDEX idx_occurred (occurred_at),
    INDEX idx_actor (actor),
    INDEX idx_action (action)
);
