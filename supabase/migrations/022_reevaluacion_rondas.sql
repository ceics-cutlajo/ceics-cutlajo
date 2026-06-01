-- =============================================================
-- 022_reevaluacion_rondas.sql — Módulo de re-evaluación (ciclo de versiones)
-- =============================================================
--
-- Permite que un protocolo devuelto "con observaciones" sea corregido por el
-- investigador y re-evaluado por el comité en una nueva RONDA, conservando todo
-- el historial de la(s) ronda(s) anterior(es): votos, comentarios y actas.
--
-- Fuente de verdad: protocolos.ronda_actual (1, 2, 3…). Cada voto (evaluaciones),
-- pre-informe (pre_informes.version, ya existente) y acta queda etiquetado con
-- su ronda. Al reenviar desde estado 'observaciones', ronda_actual se incrementa.
--
-- IMPORTANTE (verificación tras aplicar):
--   Esta migración cambia dos UNIQUE existentes. Si los nombres por defecto de
--   Postgres no coinciden (poco probable), los DROP ... IF EXISTS no harán nada
--   y los ADD CONSTRAINT fallarán por candado duplicado. En ese caso, lista los
--   constraints con:
--     select conname from pg_constraint where conrelid = 'evaluaciones'::regclass;
--     select conname from pg_constraint where conrelid = 'actas'::regclass;
--   y ajusta el nombre en el DROP correspondiente.

-- 1. protocolos: ronda en curso ------------------------------------------------
alter table protocolos
  add column if not exists ronda_actual smallint not null default 1;

-- 2. evaluaciones: etiquetar voto por ronda ------------------------------------
alter table evaluaciones
  add column if not exists ronda smallint not null default 1;

-- Un miembro podía votar 1 sola vez por protocolo; ahora 1 vez por (protocolo, ronda).
alter table evaluaciones
  drop constraint if exists evaluaciones_protocolo_id_miembro_id_key;
alter table evaluaciones
  add constraint evaluaciones_protocolo_miembro_ronda_key
  unique (protocolo_id, miembro_id, ronda);

create index if not exists idx_eval_protocolo_ronda
  on evaluaciones(protocolo_id, ronda);

-- 3. actas: permitir un acta por ronda -----------------------------------------
alter table actas
  add column if not exists ronda smallint not null default 1;

-- Antes: un acta por protocolo (protocolo_id unique). Ahora: una por (protocolo, ronda).
alter table actas
  drop constraint if exists actas_protocolo_id_key;
alter table actas
  add constraint actas_protocolo_ronda_key unique (protocolo_id, ronda);

create index if not exists idx_actas_protocolo_ronda
  on actas(protocolo_id, ronda);
