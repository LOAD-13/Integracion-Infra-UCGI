-- 05-seed-demo-clients.sql
-- Reemplaza los clientes seed con un set realista para la demo del CRM.
-- Idempotente: borra los clientes "ucgi-seed" y reinserta. Tambien asigna
-- tags del catalogo (que viene de 04-redesign-tables.sql).

USE crm;

-- Limpieza de clientes seed previos (con marca en notes_summary).
DELETE FROM clients WHERE notes_summary = 'ucgi-seed' OR notes_summary IS NULL;

INSERT INTO clients (name, phone, email, company, notes_summary) VALUES
  ('Bruno Sosa',      '+5491144716650', 'bruno.sosa@example.com',     'Importadora Andina',     'ucgi-seed'),
  ('Lucia Martinez',  '+5491144716651', 'lucia.martinez@example.com', 'Distribuidora del Sur',  'ucgi-seed'),
  ('Tomas Quintana',  '+5491144716652', 'tomas.quintana@example.com', 'Constructora Pacifico',  'ucgi-seed'),
  ('Sofia Alvarez',   '+5491144716653', NULL,                         'Independiente',          'ucgi-seed'),
  ('Mateo Romero',    '+5491144716654', 'mateo.romero@example.com',   'Tech Sur S.R.L.',        'ucgi-seed'),
  ('Valentina Rios',  '+5491144716655', 'valentina.rios@example.com', 'Logistica del Sur',      'ucgi-seed'),
  ('Federico Diaz',   '+5491144716656', 'federico.diaz@example.com',  'Importadora Andina',     'ucgi-seed'),
  ('Camila Herrera',  '+5491144716657', NULL,                         'Independiente',          'ucgi-seed');

-- Asignacion de tags (matchea por nombre, asume 04 ya corrio).
INSERT IGNORE INTO client_tag_assignments (client_id, tag_id)
SELECT c.id, t.id FROM clients c, client_tags t
 WHERE (c.name = 'Bruno Sosa'     AND t.name IN ('Reincidente','Moroso'))
    OR (c.name = 'Lucia Martinez' AND t.name IN ('VIP','Empresa'))
    OR (c.name = 'Tomas Quintana' AND t.name IN ('Nuevo'))
    OR (c.name = 'Sofia Alvarez'  AND t.name IN ('Soporte'))
    OR (c.name = 'Mateo Romero'   AND t.name IN ('Empresa','VIP'))
    OR (c.name = 'Valentina Rios' AND t.name IN ('Empresa'))
    OR (c.name = 'Federico Diaz'  AND t.name IN ('Reincidente'))
    OR (c.name = 'Camila Herrera' AND t.name IN ('Nuevo'));

-- Reasignacion de cartera a los agentes.
DELETE FROM agent_assignments;

INSERT INTO agent_assignments (agent_user_id, client_id, assigned_by_user_id)
SELECT u.id, c.id, (SELECT id FROM users WHERE username = 'admin')
FROM   users u, clients c
WHERE  u.username = 'agente1'
  AND  c.name IN ('Bruno Sosa','Lucia Martinez','Tomas Quintana','Sofia Alvarez');

INSERT INTO agent_assignments (agent_user_id, client_id, assigned_by_user_id)
SELECT u.id, c.id, (SELECT id FROM users WHERE username = 'admin')
FROM   users u, clients c
WHERE  u.username = 'agente2'
  AND  c.name IN ('Mateo Romero','Valentina Rios','Federico Diaz','Camila Herrera');
