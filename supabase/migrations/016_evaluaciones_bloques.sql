-- =============================================================
-- 016_evaluaciones_bloques.sql — Voto por bloque temático (sesión 8a)
-- =============================================================
--
-- Modelo "validar/discrepar con la IA":
--   1. La IA genera un pre_informe con veredicto por bloque (11 categorías
--      del checklist maestro).
--   2. Cada miembro crea una `evaluaciones` (cabecera) y N filas en
--      `evaluaciones_bloques` (una por bloque).
--   3. Por bloque: el miembro o acuerda con la IA (copia veredicto) o
--      discrepa (su propio veredicto + comentario).
--   4. El voto global del miembro se DERIVA del peor resultado por bloque
--      (no_cumple → no_aprobar, parcial → aprobar_con_observaciones, todos
--      cumple → aprobar).
--
-- Bloques (las 11 categorías unificadas de NORMATIVIDAD/04_CHECKLIST_MAESTRO.json):
--   identificacion, estructura_cientifica, metodologia, riesgo_beneficio,
--   consentimiento, poblaciones_vulnerables, confidencialidad_datos,
--   productos_salud, gobernanza_cei, transparencia_publicacion, aspectos_economicos.

-- ===================
-- 1. Ampliar enum tipo_voto con "aprobar con observaciones"
-- ===================
-- ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción donde se
-- referencia, pero como evaluaciones_bloques NO referencia tipo_voto, no hay
-- conflicto. evaluaciones.voto_global sí lo referencia y existe desde 007.
alter type tipo_voto add value if not exists 'aprobar_con_observaciones';

-- ===================
-- 2. Tabla evaluaciones_bloques
-- ===================
create table evaluaciones_bloques (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references evaluaciones(id) on delete cascade,

  -- Una de las 11 categorías unificadas del checklist maestro
  bloque text not null,

  -- Veredicto final del miembro para este bloque (puede coincidir con el IA o no)
  resultado resultado_cumplimiento not null,

  -- True si el miembro aceptó el veredicto IA tal cual; false si discrepó y puso el suyo
  acordado_con_ia boolean not null,

  -- Comentario del miembro (obligatorio si acordado_con_ia = false, opcional si true)
  comentario text,

  created_at timestamptz not null default now(),

  unique (evaluacion_id, bloque),

  -- Defensa en profundidad: solo los 11 bloques válidos
  check (bloque in (
    'identificacion',
    'estructura_cientifica',
    'metodologia',
    'riesgo_beneficio',
    'consentimiento',
    'poblaciones_vulnerables',
    'confidencialidad_datos',
    'productos_salud',
    'gobernanza_cei',
    'transparencia_publicacion',
    'aspectos_economicos'
  )),

  -- Si el miembro discrepó, debe explicar por qué (comentario no nulo)
  check (acordado_con_ia or (comentario is not null and length(trim(comentario)) >= 10))
);

create index idx_eval_bloques_evaluacion on evaluaciones_bloques(evaluacion_id);
create index idx_eval_bloques_bloque on evaluaciones_bloques(bloque);

-- RLS: habilitado, sin políticas explícitas (writes via service_role; reads
-- desde server actions con admin client). En sesión 8b agregamos políticas
-- cuando exista el form de voto.
alter table evaluaciones_bloques enable row level security;
