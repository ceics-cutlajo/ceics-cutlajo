-- =============================================================
-- 026_correcciones_menores.sql — Estado para el carril de
-- "observaciones menores" (resubida ligera del investigador).
-- =============================================================
-- Flujo nuevo (sesión 2026-06-18):
--   Dictamen "APROBADO CON OBSERVACIONES MENORES" → estado
--   'aprobado_con_observaciones'. El investigador atiende las observaciones,
--   actualiza documentos si aplica y "Envía correcciones" → el protocolo pasa
--   a 'correcciones_menores' y se incrementa ronda_actual. La Presidencia
--   (o Secretaría por delegación) ratifica el cumplimiento SIN nueva votación
--   del comité y emite el acta final ('aprobado'), que cita el oficio previo y
--   deja constancia de que se incorporaron las correcciones.
--
-- Esta migración solo agrega el nuevo valor al enum estado_protocolo.
-- ALTER TYPE ... ADD VALUE no puede correr dentro de una transacción en
-- algunas versiones de Postgres; ejecútalo como sentencia suelta en el SQL
-- Editor de Supabase. 'IF NOT EXISTS' lo hace idempotente.

alter type estado_protocolo add value if not exists 'correcciones_menores';
