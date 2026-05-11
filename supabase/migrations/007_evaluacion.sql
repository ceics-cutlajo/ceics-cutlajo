-- =============================================================
-- 007_evaluacion.sql — Pre-informes IA, evaluaciones, votos por sección
-- =============================================================

create table pre_informes (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  version smallint not null default 1,
  generado_at timestamptz not null default now(),
  generado_por text not null default 'cowork_scheduled_task',
  modelo_usado text,
  contenido jsonb not null,
  resumen_ejecutivo text not null,
  cumple_global boolean not null,
  total_items_evaluados smallint not null,
  items_cumple smallint not null,
  items_no_cumple smallint not null,
  items_parcial smallint not null,
  items_no_aplica smallint not null,
  observaciones_criticas text[],
  sugerencias text[],
  duracion_segundos integer,
  unique (protocolo_id, version)
);

create index idx_preinforme_protocolo on pre_informes(protocolo_id);

create table evaluaciones (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  miembro_id uuid not null references usuarios(id),
  voto_global tipo_voto not null,
  comentario_global text,
  conflicto_interes boolean not null default false,
  motivo_abstencion text,
  votado_at timestamptz not null default now(),
  inmutable boolean not null default true,
  unique (protocolo_id, miembro_id)
);

create index idx_eval_protocolo on evaluaciones(protocolo_id);
create index idx_eval_miembro on evaluaciones(miembro_id);

create table evaluaciones_secciones (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references evaluaciones(id) on delete cascade,
  checklist_item_id text references checklist_items(id),
  resultado resultado_cumplimiento not null,
  comentario text,
  created_at timestamptz not null default now(),
  unique (evaluacion_id, checklist_item_id)
);

create index idx_eval_sec_eval on evaluaciones_secciones(evaluacion_id);
