-- =============================================================
-- 004_checklist.sql — Tabla de items de evaluación normativa
-- (los 100 items se cargan desde NORMATIVIDAD/04_CHECKLIST_MAESTRO.json
--  en migration 005 con un INSERT bulk)
-- =============================================================

create table checklist_items (
  id text primary key,
  categoria text not null,
  subcategoria text,
  criterio text not null,
  evidencia_esperada text not null,
  fuentes jsonb not null,
  severidad severidad_criterio not null,
  peso smallint not null check (peso between 1 and 5),
  aplicabilidad jsonb not null,
  seccion_protocolo smallint,
  ai_prompt_hint text not null,
  version text not null default '1.0',
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now()
);

create index idx_checklist_categoria on checklist_items(categoria);
create index idx_checklist_severidad on checklist_items(severidad);
create index idx_checklist_vigente on checklist_items(vigente_desde, vigente_hasta);
