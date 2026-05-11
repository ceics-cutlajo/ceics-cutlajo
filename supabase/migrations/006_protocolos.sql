-- =============================================================
-- 006_protocolos.sql — Protocolos, co-investigadores, documentos, eventos
-- =============================================================

create table protocolos (
  id uuid primary key default gen_random_uuid(),
  numero_consecutivo serial not null,
  clave text,                                                -- relleno por trigger (ver 009_triggers.sql)
  titulo text not null,
  resumen text,
  investigador_principal_id uuid not null references usuarios(id),
  area_conocimiento_id smallint references areas_conocimiento(id),
  tipo_investigacion_id text references tipos_investigacion(id),
  clasificacion_riesgo clasificacion_riesgo,
  involucra_humanos boolean default true,
  involucra_menores boolean default false,
  involucra_datos_geneticos boolean default false,
  involucra_medicamento boolean default false,
  estado estado_protocolo not null default 'borrador',
  numero_oficio text unique,
  vigencia_dictamen_meses smallint default 12,
  fecha_aprobacion date,
  fecha_vencimiento date,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  dictaminado_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_protocolos_ip on protocolos(investigador_principal_id);
create index idx_protocolos_estado on protocolos(estado);
create index idx_protocolos_numero_oficio on protocolos(numero_oficio);

create table protocolo_co_investigadores (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  nombre text not null,
  apellido_paterno text not null,
  apellido_materno text,
  adscripcion text,
  email text,
  orden smallint not null,
  created_at timestamptz not null default now()
);

create index idx_co_inv_protocolo on protocolo_co_investigadores(protocolo_id);

create table protocolo_documentos (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  tipo_documento_id text not null references tipos_documento(id),
  nombre_original text not null,
  storage_path text not null,
  mime_type text not null,
  tamano_bytes bigint not null,
  hash_sha256 text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references usuarios(id)
);

create index idx_docs_protocolo on protocolo_documentos(protocolo_id);

create table protocolo_eventos (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  tipo text not null,
  descripcion text,
  actor_id uuid references usuarios(id),
  datos jsonb,
  created_at timestamptz not null default now()
);

create index idx_eventos_protocolo on protocolo_eventos(protocolo_id);
create index idx_eventos_tipo on protocolo_eventos(tipo);
