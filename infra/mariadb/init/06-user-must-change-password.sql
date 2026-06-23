-- 06-user-must-change-password.sql
-- Flag para forzar cambio de contraseña en el primer login. Lo levantan los
-- POST /v1/users (admin provisiona) y lo bajan POST /v1/me/change-password.

USE crm;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER active;
