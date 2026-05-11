-- =============================================================
-- 008_actas.sql — Actas oficiales generadas por el Presidente
-- =============================================================

create table actas (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null unique references protocolos(id),
  numero_oficio text not null unique,
  fecha_emision date not null default current_date,
  presidente_id uuid not null references usuarios(id),
  resolucion text not null check (resolucion in ('aprobado', 'aprobado_con_observaciones', 'no_aprobado')),
  vigencia_meses smallint not null default 12,
  fecha_vencimiento date,
  votos_favor smallint not null,
  votos_contra smallint not null,
  votos_abstencion smallint not null,
  observaciones text,
  marco_normativo jsonb not null,
  hash_folio text not null,
  url_validacion text,
  docx_storage_path text,
  pdf_storage_path text,
  enviada_a_investigador_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_actas_numero on actas(numero_oficio);
create index idx_actas_fecha on actas(fecha_emision);
