-- =============================================================
-- 018_actas_storage_oficio.sql — Sesión 9b
--   - Bucket de Storage para actas (DOCX + PDF)
--   - Función siguiente_numero_oficio(anio) atómica
--   - Columna protocolos.recomendacion_comite (para que el Presidente
--     vea prerellenado el resultado del comité antes de emitir el acta)
-- =============================================================

-- ----------------------------------------------------------------
-- 1. Bucket 'actas' (privado, lectura por IP del protocolo + comité)
-- ----------------------------------------------------------------
--
-- Path convention:
--   {protocolo_id}/acta-{numero_oficio_slug}.docx
--   {protocolo_id}/acta-{numero_oficio_slug}.pdf
--
-- Reglas:
--   - Solo lectura para authenticated (IP del protocolo o miembro del comité)
--   - Las server actions usan service_role para subir; no se permite
--     INSERT/UPDATE/DELETE desde el cliente (acta es inmutable).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'actas',
  'actas',
  false,
  10485760,  -- 10 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

-- Drop policies si existían (idempotencia)
drop policy if exists "actas_select_dueno_o_comite" on storage.objects;

-- SELECT: IP del protocolo o miembro del comité
create policy "actas_select_dueno_o_comite"
on storage.objects for select
to authenticated
using (
  bucket_id = 'actas'
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

-- (No se crean policies de INSERT/UPDATE/DELETE: solo service_role escribe.)

-- ----------------------------------------------------------------
-- 2. Función siguiente_numero_oficio(anio int) returns text
-- ----------------------------------------------------------------
-- Devuelve el siguiente número de oficio en formato CEICS-CUTLAJO/YYYY/NNN
-- Usa pg_advisory_xact_lock para serializar la asignación dentro del año
-- y evitar race conditions entre dos llamadas concurrentes.

create or replace function siguiente_numero_oficio(p_anio int)
returns text
language plpgsql
as $$
declare
  v_consecutivo int;
  v_oficio text;
begin
  -- Lock por año para serializar asignación concurrente
  perform pg_advisory_xact_lock(hashtext('siguiente_numero_oficio_' || p_anio::text));

  select coalesce(
    max((regexp_match(numero_oficio, '^CEICS-CUTLAJO/\d{4}/(\d{3})$'))[1]::int),
    0
  ) + 1
  into v_consecutivo
  from actas
  where extract(year from fecha_emision)::int = p_anio;

  if v_consecutivo > 999 then
    raise exception 'Se agotaron los consecutivos de oficio para el año %', p_anio;
  end if;

  v_oficio := format('CEICS-CUTLAJO/%s/%s', p_anio, lpad(v_consecutivo::text, 3, '0'));
  return v_oficio;
end;
$$;

comment on function siguiente_numero_oficio(int) is
  'Genera el siguiente número de oficio anual atómicamente. Formato: CEICS-CUTLAJO/{YYYY}/{NNN}. Lock por advisory transaction para evitar duplicados.';

-- ----------------------------------------------------------------
-- 3. Columna protocolos.recomendacion_comite
-- ----------------------------------------------------------------
-- Cuando el comité cierra la votación, la lógica TypeScript decide la
-- recomendación (aprobar / aprobar_con_observaciones / no_aprobar /
-- sin_decisivos) y la guarda aquí. El Presidente la ve prerellenada
-- al abrir el formulario "Emitir Dictamen" y puede ratificar o ajustar.
--
-- Reusa el enum tipo_voto extendido en 016, más un literal 'sin_decisivos'
-- representado como NULL semánticamente. Para mantener tipos simples
-- usamos un text con CHECK constraint.

alter table protocolos
  add column if not exists recomendacion_comite text
    check (recomendacion_comite in (
      'aprobar',
      'aprobar_con_observaciones',
      'no_aprobar',
      'sin_decisivos'
    ));

comment on column protocolos.recomendacion_comite is
  'Recomendación del comité tras cerrar la votación. Sirve para prerellenar el formulario "Emitir Dictamen" del Presidente. Valores: aprobar, aprobar_con_observaciones, no_aprobar, sin_decisivos.';
