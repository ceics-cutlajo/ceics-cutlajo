-- =============================================================
-- 011_vistas_funciones.sql — Vistas y funciones de negocio
-- =============================================================

-- Vista: estado de votación por protocolo (dashboard del Presidente)
create or replace view v_estado_votacion as
select
  p.id as protocolo_id,
  p.clave,
  p.titulo,
  p.estado,
  p.submitted_at,
  count(e.*) as total_votos,
  count(*) filter (where e.voto_global = 'aprobar') as votos_favor,
  count(*) filter (where e.voto_global = 'no_aprobar') as votos_contra,
  count(*) filter (where e.voto_global = 'abstener') as votos_abstencion,
  count(*) filter (where e.conflicto_interes) as abstenciones_por_conflicto,
  case
    when count(*) filter (where e.voto_global = 'aprobar') >= 4 then 'listo_dictamen'
    when count(e.*) >= 5 and count(*) filter (where e.voto_global = 'aprobar') < 4 then 'no_alcanza_mayoria'
    else 'en_progreso'
  end as situacion
from protocolos p
left join evaluaciones e on e.protocolo_id = p.id
where p.estado in ('en_revision_comite', 'listo_dictamen')
group by p.id;

-- Función: detectar conflicto de interés
create or replace function detectar_conflicto_interes(
  p_miembro_id uuid,
  p_protocolo_id uuid
) returns boolean
language sql stable as $$
  select exists (
    select 1 from protocolos
    where id = p_protocolo_id and investigador_principal_id = p_miembro_id
    union
    select 1 from protocolo_co_investigadores ci
    join usuarios u on u.id = p_miembro_id
    where ci.protocolo_id = p_protocolo_id and lower(ci.email) = lower(u.email)
  );
$$;

-- Función: siguiente número de oficio
create or replace function siguiente_numero_oficio() returns text
language plpgsql as $$
declare
  v_anio int := extract(year from current_date)::int;
  v_consec int;
begin
  select coalesce(max(
    cast(split_part(numero_oficio, '/', 3) as int)
  ), 0) + 1
  into v_consec
  from actas
  where numero_oficio like 'CEICS-CUTLAJO/' || v_anio || '/%';

  return format('CEICS-CUTLAJO/%s/%s', v_anio, lpad(v_consec::text, 3, '0'));
end $$;

-- Vista: protocolos pendientes para evaluación IA
create or replace view v_protocolos_pendientes_ia as
select
  p.id, p.clave, p.titulo, p.submitted_at,
  count(d.*) as total_documentos
from protocolos p
left join protocolo_documentos d on d.protocolo_id = p.id
where p.estado = 'en_evaluacion_ia'
group by p.id;

-- Vista: bandeja del comité (protocolos pendientes de votar para un miembro)
create or replace function bandeja_miembro(p_miembro_id uuid)
returns table (
  protocolo_id uuid,
  clave text,
  titulo text,
  submitted_at timestamptz,
  total_votos_recibidos bigint,
  ya_voto boolean,
  conflicto_interes boolean
) language sql stable as $$
  select
    p.id,
    p.clave,
    p.titulo,
    p.submitted_at,
    (select count(*) from evaluaciones e where e.protocolo_id = p.id),
    exists(select 1 from evaluaciones e where e.protocolo_id = p.id and e.miembro_id = p_miembro_id),
    detectar_conflicto_interes(p_miembro_id, p.id)
  from protocolos p
  where p.estado in ('en_revision_comite', 'listo_dictamen')
  order by p.submitted_at asc;
$$;
