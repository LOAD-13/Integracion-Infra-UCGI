-- 03-seed-data.sql
-- Seed minimo para arrancar el CRM en desarrollo y pruebas:
--   1 administrador, 2 agentes, 5 clientes, 2 extensiones SIP y 2 asignaciones.
-- Los password_hash son bcrypt de "demo1234" (rondas=10). Solo para entornos
-- de desarrollo; en produccion midPoint provee la autenticacion.

USE crm;

-- ----------------------------------------------------------------------------
-- Usuarios: 1 admin + 2 agentes.
-- password = demo1234 (bcrypt rondas 10). Reemplazado por midPoint en S3.
-- ----------------------------------------------------------------------------
INSERT INTO users (username, email, full_name, password_hash, role, active) VALUES
  ('admin',    'admin@ucgi.local',    'Administrador UCGI',
   '$2a$10$wH9q1m1c3v8Q3aZk0Cf0X.r2c2b8s4K9o9V7w0K2Z1B6gJ5h9pCwS', 'ADMIN',  TRUE),
  ('agente1',  'agente1@ucgi.local',  'Agente Uno',
   '$2a$10$wH9q1m1c3v8Q3aZk0Cf0X.r2c2b8s4K9o9V7w0K2Z1B6gJ5h9pCwS', 'AGENTE', TRUE),
  ('agente2',  'agente2@ucgi.local',  'Agente Dos',
   '$2a$10$wH9q1m1c3v8Q3aZk0Cf0X.r2c2b8s4K9o9V7w0K2Z1B6gJ5h9pCwS', 'AGENTE', TRUE);

-- ----------------------------------------------------------------------------
-- Extensiones SIP para los 2 agentes (los provisionara midPoint en S3, esto
-- es solo para que el softphone pueda probarse desde el dia 1).
-- ----------------------------------------------------------------------------
INSERT INTO sip_extensions (user_id, extension_number, sip_password, enabled)
SELECT id, '1001', 'sip-demo-1001', TRUE FROM users WHERE username = 'agente1';

INSERT INTO sip_extensions (user_id, extension_number, sip_password, enabled)
SELECT id, '1002', 'sip-demo-1002', TRUE FROM users WHERE username = 'agente2';

-- ----------------------------------------------------------------------------
-- Clientes de prueba (5).
-- ----------------------------------------------------------------------------
INSERT INTO clients (name, phone, email, company) VALUES
  ('Ana Vargas',     '+51999111001', 'ana.vargas@example.com',   'Importadora Andina S.A.'),
  ('Bruno Castillo', '+51999111002', 'bruno.castillo@example.com','Logistica del Sur'),
  ('Carla Mendoza',  '+51999111003', 'carla.mendoza@example.com', 'Tech Lima'),
  ('Daniel Soto',    '+51999111004', NULL,                        'Independiente'),
  ('Elena Ramirez',  '+51999111005', 'elena.ramirez@example.com', 'Constructora Pacifico');

-- ----------------------------------------------------------------------------
-- Asignaciones agente <-> cliente (2 agentes, 5 clientes repartidos).
-- agente1: Ana, Bruno, Carla. agente2: Daniel, Elena.
-- ----------------------------------------------------------------------------
INSERT INTO agent_assignments (agent_user_id, client_id, assigned_by_user_id)
SELECT u.id, c.id, (SELECT id FROM users WHERE username = 'admin')
FROM   users u, clients c
WHERE  u.username = 'agente1' AND c.name IN ('Ana Vargas','Bruno Castillo','Carla Mendoza');

INSERT INTO agent_assignments (agent_user_id, client_id, assigned_by_user_id)
SELECT u.id, c.id, (SELECT id FROM users WHERE username = 'admin')
FROM   users u, clients c
WHERE  u.username = 'agente2' AND c.name IN ('Daniel Soto','Elena Ramirez');

-- ----------------------------------------------------------------------------
-- Evento de auditoria de bootstrap (evidencia de que el seed corrio).
-- ----------------------------------------------------------------------------
INSERT INTO audit_log (actor_user_id, action, target_type, payload)
SELECT id, 'SEED_BOOTSTRAP', 'DATABASE',
       JSON_OBJECT('source','03-seed-data.sql','users',3,'clients',5,'extensions',2)
FROM   users WHERE username = 'admin';
