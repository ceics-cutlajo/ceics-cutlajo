-- =============================================================
-- 014_storage_protocolos.sql — Bucket de Storage para documentos de protocolos
-- =============================================================
--
-- Bucket: protocolos
-- Path convention: {protocolo_id}/{tipo_documento}-{timestamp}.{ext}
--
-- Reglas:
--   - Solo investigadores autenticados pueden subir/eliminar archivos en sus propios protocolos
--   - Miembros del comité pueden leer todos los archivos
--   - Acceso público: NO (siempre vía signed URL)
--
-- Las server actions de la app usan service_role para subir/eliminar, así que las
-- policies de RLS de storage son una segunda línea de defensa por si alguien usa
-- la anon key desde el cliente.

-- Crear el bucket si no existe (idempotente)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'protocolos',
  'protocolos',
  false,
  26214400,  -- 25 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];

-- Drop policies si existían (para re-ejecución idempotente)
drop policy if exists "protocolos_select_dueno_o_comite" on storage.objects;
drop policy if exists "protocolos_insert_dueno" on storage.objects;
drop policy if exists "protocolos_delete_dueno" on storage.objects;
drop policy if exists "protocolos_update_dueno" on storage.objects;

-- Helper: dado un path "protocolo_id/archivo.pdf" devuelve el protocolo_id
create or replace function storage_path_protocolo_id(path text) returns uuid
language sql immutable as $$
  select case
    when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(path, '/', 1)::uuid
    else null
  end;
$$;

-- SELECT: dueño del protocolo o miembro del comité
create policy "protocolos_select_dueno_o_comite"
on storage.objects for select
to authenticated
using (
  bucket_id = 'protocolos'
  and (
    is_comite_member()
    or exists (
      select 1 from protocolos p
      join usuarios u on u.id = p.investigador_principal_id
      where p.id = storage_path_protocolo_id(name)
      and u.email = (select email from auth.users where id = auth.uid())
    )
  )
);

-- INSERT: solo el dueño del protocolo, y solo si está en borrador/observaciones
create policy "protocolos_insert_dueno"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'protocolos'
  and exists (
    select 1 from protocolos p
    join usuarios u on u.id = p.investigador_principal_id
    where p.id = storage_path_protocolo_id(name)
    and u.email = (select email from auth.users where id = auth.uid())
    and p.estado in ('borrador', 'observaciones')
  )
);

-- UPDATE: igual que INSERT
create policy "protocolos_update_dueno"
on storage.objects for update
to authenticated
using (
  bucket_id = 'protocolos'
  and exists (
    select 1 from protocolos p
    join usuarios u on u.id = p.investigador_principal_id
    where p.id = storage_path_protocolo_id(name)
    and u.email = (select email from auth.users where id = auth.uid())
    and p.estado in ('borrador', 'observaciones')
  )
);

-- DELETE: igual que INSERT
create policy "protocolos_delete_dueno"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'protocolos'
  and exists (
    select 1 from protocolos p
    join usuarios u on u.id = p.investigador_principal_id
    where p.id = storage_path_protocolo_id(name)
    and u.email = (select email from auth.users where id = auth.uid())
    and p.estado in ('borrador', 'observaciones')
  )
);
