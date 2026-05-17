-- =============================================================
-- 020_swap_roles_judith_anayeli.sql — Reasignación de roles del comité
--
-- Notificación recibida 2026-05-17: Anayeli Patiño asume la Secretaría
-- del CEICS; Judith De Arcos pasa a ser Vocal. Se invierten los roles
-- asignados originalmente en 012_seed_comite.sql.
--
-- Idempotente: ON CONFLICT garantiza que correr la migración varias
-- veces no duplique registros.
-- =============================================================

-- Judith De Arcos: secretaria → vocal
delete from usuario_roles
where usuario_id = (select id from usuarios where email = 'judith.dearcos@academicos.udg.mx')
  and rol = 'comite_secretario';

insert into usuario_roles (usuario_id, rol)
select id, 'comite_vocal'::rol_sistema from usuarios
where email = 'judith.dearcos@academicos.udg.mx'
on conflict (usuario_id, rol) do nothing;

-- Anayeli Patiño: vocal → secretaria
delete from usuario_roles
where usuario_id = (select id from usuarios where email = 'anayeli.patino@academicos.udg.mx')
  and rol = 'comite_vocal';

insert into usuario_roles (usuario_id, rol)
select id, 'comite_secretario'::rol_sistema from usuarios
where email = 'anayeli.patino@academicos.udg.mx'
on conflict (usuario_id, rol) do nothing;
