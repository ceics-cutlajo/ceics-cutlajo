-- =============================================================
-- 010_rls.sql — Row Level Security policies
-- =============================================================

-- Helper: roles del usuario actual
create or replace function current_user_roles() returns rol_sistema[]
language sql security definer set search_path = public as $$
  select coalesce(array_agg(rol), '{}') from usuario_roles where usuario_id = auth.uid();
$$;

-- Helper: ¿es del comité (incluye presidente)?
create or replace function is_comite_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from usuario_roles
    where usuario_id = auth.uid()
    and rol in ('comite_vocal', 'comite_secretario', 'presidente', 'admin_sistema')
  );
$$;

-- ===================
-- usuarios
-- ===================
alter table usuarios enable row level security;

create policy ver_propio_perfil on usuarios
  for select using (id = auth.uid() or is_comite_member());

create policy editar_propio_perfil on usuarios
  for update using (id = auth.uid());

-- inserción la maneja el flujo de signup vía service role

-- ===================
-- protocolos
-- ===================
alter table protocolos enable row level security;

create policy ver_protocolos on protocolos
  for select using (
    investigador_principal_id = auth.uid()
    or is_comite_member()
  );

create policy crear_protocolo on protocolos
  for insert with check (investigador_principal_id = auth.uid());

create policy editar_borrador_propio on protocolos
  for update using (
    investigador_principal_id = auth.uid()
    and estado in ('borrador', 'observaciones')
  );

-- ===================
-- protocolo_co_investigadores
-- ===================
alter table protocolo_co_investigadores enable row level security;

create policy ver_co_inv on protocolo_co_investigadores
  for select using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and (p.investigador_principal_id = auth.uid() or is_comite_member())
    )
  );

create policy modificar_co_inv on protocolo_co_investigadores
  for all using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and p.investigador_principal_id = auth.uid()
      and p.estado in ('borrador', 'observaciones')
    )
  );

-- ===================
-- protocolo_documentos
-- ===================
alter table protocolo_documentos enable row level security;

create policy ver_documentos on protocolo_documentos
  for select using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and (p.investigador_principal_id = auth.uid() or is_comite_member())
    )
  );

create policy subir_documentos on protocolo_documentos
  for insert with check (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and p.investigador_principal_id = auth.uid()
      and p.estado in ('borrador', 'observaciones')
    )
  );

-- ===================
-- pre_informes
-- ===================
alter table pre_informes enable row level security;

create policy ver_preinforme on pre_informes
  for select using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and (p.investigador_principal_id = auth.uid() or is_comite_member())
    )
  );

-- inserción la maneja el scheduled task con service role

-- ===================
-- evaluaciones
-- ===================
alter table evaluaciones enable row level security;

create policy ver_evaluaciones on evaluaciones
  for select using (
    miembro_id = auth.uid()
    or is_comite_member()
  );

create policy votar_protocolo on evaluaciones
  for insert with check (
    miembro_id = auth.uid()
    and is_comite_member()
  );

-- ===================
-- evaluaciones_secciones
-- ===================
alter table evaluaciones_secciones enable row level security;

create policy ver_eval_sec on evaluaciones_secciones
  for select using (
    exists (
      select 1 from evaluaciones e
      where e.id = evaluacion_id
      and (e.miembro_id = auth.uid() or is_comite_member())
    )
  );

create policy crear_eval_sec on evaluaciones_secciones
  for insert with check (
    exists (
      select 1 from evaluaciones e
      where e.id = evaluacion_id
      and e.miembro_id = auth.uid()
    )
  );

-- ===================
-- actas
-- ===================
alter table actas enable row level security;

create policy ver_actas on actas
  for select using (
    is_comite_member()
    or exists (
      select 1 from protocolos p
      where p.id = protocolo_id and p.investigador_principal_id = auth.uid()
    )
  );

create policy crear_acta on actas
  for insert with check ('presidente' = any(current_user_roles()));

-- ===================
-- protocolo_eventos
-- ===================
alter table protocolo_eventos enable row level security;

create policy ver_eventos on protocolo_eventos
  for select using (
    is_comite_member()
    or exists (
      select 1 from protocolos p
      where p.id = protocolo_id and p.investigador_principal_id = auth.uid()
    )
  );

-- ===================
-- usuario_roles (solo admin)
-- ===================
alter table usuario_roles enable row level security;

create policy ver_roles_propios on usuario_roles
  for select using (usuario_id = auth.uid() or 'admin_sistema' = any(current_user_roles()));
