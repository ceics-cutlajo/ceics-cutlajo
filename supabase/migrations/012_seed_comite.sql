-- =============================================================
-- 012_seed_comite.sql — Seed inicial del comité CEICS
--
-- IMPORTANTE: Estos usuarios deben existir PRIMERO en auth.users
-- (creados vía Supabase Auth o vía script con service role).
-- Este seed solo crea el perfil en la tabla `usuarios` y asigna roles.
-- =============================================================

-- Insertar perfiles de los 7 miembros oficiales del CEICS
-- Si ya existen (idempotente), actualizar cargo y división
insert into usuarios (
  email, nombre, apellido_paterno, apellido_materno,
  codigo_udg, division, departamento, activo, email_verificado
) values
  ('jaime.briseno@academicos.udg.mx',     'Jaime',          'Briseño',     'Ramírez',  '2957686', 'Salud', 'CEICS', true, true),
  ('judith.dearcos@academicos.udg.mx',    'Judith Carolina','De Arcos',    'Jiménez',  '2967536', 'Salud', 'CEICS', true, true),
  ('oscar.fernandezdiaz@academicos.udg.mx','Oscar Francisco','Fernández',  'Díaz',     '2963130', 'Salud', 'CEICS', true, true),
  ('cecilia.mendez@academicos.udg.mx',    'Ana Cecilia',    'Méndez',      'Magaña',   '2953815', 'Salud', 'CEICS', true, true),
  ('ruth.rodriguez@academicos.udg.mx',    'Ruth',           'Rodríguez',   'Montaño',  '2949191', 'Salud', 'CEICS', true, true),
  ('anayeli.patino@academicos.udg.mx',    'Anayeli de Jesús','Patiño',     'Laguna',   '2969114', 'Salud', 'CEICS', true, true),
  ('nancye.navarro@academicos.udg.mx',    'Nancy Evelyn',   'Navarro',     'Ruiz',     '2951423', 'Salud', 'CEICS', true, true)
on conflict (email) do update set
  division = excluded.division,
  departamento = excluded.departamento,
  activo = true;

-- Asignar roles del comité
with miembros as (
  select id, email from usuarios where email like '%@academicos.udg.mx' and division = 'Salud'
)
insert into usuario_roles (usuario_id, rol)
select id, 'presidente'::rol_sistema        from miembros where email = 'jaime.briseno@academicos.udg.mx'
union all
select id, 'comite_secretario'::rol_sistema from miembros where email = 'judith.dearcos@academicos.udg.mx'
union all
select id, 'comite_vocal'::rol_sistema      from miembros where email in (
  'oscar.fernandezdiaz@academicos.udg.mx',
  'cecilia.mendez@academicos.udg.mx',
  'ruth.rodriguez@academicos.udg.mx',
  'anayeli.patino@academicos.udg.mx',
  'nancye.navarro@academicos.udg.mx'
)
on conflict (usuario_id, rol) do nothing;

-- Todos los miembros del comité también pueden actuar como investigadores (rol dual)
with miembros as (
  select id from usuarios where division = 'Salud' and departamento = 'CEICS'
)
insert into usuario_roles (usuario_id, rol)
select id, 'investigador'::rol_sistema from miembros
on conflict (usuario_id, rol) do nothing;
