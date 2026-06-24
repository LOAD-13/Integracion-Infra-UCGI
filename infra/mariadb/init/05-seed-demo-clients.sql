-- 05-seed-demo-clients.sql
-- Seed mínimo del CRM: 1 cliente real (Joaquín) usado para probar CTI.
-- Idempotente: borra todo lo previo marcado como seed y reinserta.

USE crm;

DELETE FROM clients WHERE notes_summary = 'ucgi-seed' OR notes_summary IS NULL;

INSERT INTO clients (name, phone, email, company, notes_summary) VALUES
  ('Joaquin Loa Denegri', '+51949234515',
   'joaquin@example.com', 'UCGI Lab', 'ucgi-seed');

INSERT IGNORE INTO client_tag_assignments (client_id, tag_id)
SELECT c.id, t.id FROM clients c, client_tags t
 WHERE c.name = 'Joaquin Loa Denegri' AND t.name IN ('VIP');

DELETE FROM agent_assignments;

INSERT INTO agent_assignments (agent_user_id, client_id, assigned_by_user_id)
SELECT u.id, c.id, (SELECT id FROM users WHERE username = 'admin')
FROM   users u, clients c
WHERE  u.username = 'agente1' AND c.name = 'Joaquin Loa Denegri';
