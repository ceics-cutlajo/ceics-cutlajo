-- =============================================================
-- 001_enums.sql — Tipos personalizados (enums)
-- =============================================================

create type rol_sistema as enum (
  'investigador',
  'comite_vocal',
  'comite_secretario',
  'presidente',
  'admin_sistema'
);

create type estado_protocolo as enum (
  'borrador',
  'en_evaluacion_ia',
  'en_revision_comite',
  'listo_dictamen',
  'aprobado',
  'aprobado_con_observaciones',
  'observaciones',
  'rechazado',
  'retirado'
);

create type tipo_voto as enum (
  'aprobar',
  'no_aprobar',
  'abstener'
);

create type severidad_criterio as enum (
  'critica',
  'alta',
  'media',
  'baja'
);

create type resultado_cumplimiento as enum (
  'cumple',
  'no_cumple',
  'parcial',
  'no_aplica'
);

create type clasificacion_riesgo as enum (
  'sin_riesgo',
  'riesgo_minimo',
  'riesgo_mayor_minimo'
);
