-- =============================================================
-- 023_resolucion_condicionado.sql — 4º valor de resolución del acta
-- =============================================================
-- BUG (detectado 2026-06-01): la columna `actas.resolucion` solo admitía
-- 3 valores. Tanto "APROBADO CON OBSERVACIONES MENORES" como
-- "CONDICIONADO A MODIFICACIONES MAYORES" se guardaban como
-- 'aprobado_con_observaciones', por lo que el oficio en la WEB mostraba la
-- resolución equivocada (siempre "MENORES").
--   - El PDF, el DOCX y el correo al investigador SÍ eran correctos: usan el
--     texto original de 4 valores, no esta columna.
--   - El ESTADO del protocolo también era correcto (observaciones), así que el
--     flujo de re-evaluación no se vio afectado.
--
-- Este parche agrega el valor 'condicionado' y repara la(s) acta(s) histórica(s)
-- que en realidad eran condicionadas.

-- 1. Ampliar el CHECK de `resolucion` a 4 valores ---------------------------
--    (el CHECK en línea de 008_actas.sql se llama actas_resolucion_check)
alter table actas drop constraint if exists actas_resolucion_check;
alter table actas
  add constraint actas_resolucion_check
  check (resolucion in (
    'aprobado',
    'aprobado_con_observaciones',
    'condicionado',
    'no_aprobado'
  ));

-- 2. Reparar el acta de prueba mal etiquetada (oficio 005 del 2026-011) ------
--    Fue "CONDICIONADO A MODIFICACIONES MAYORES": el protocolo quedó en estado
--    'observaciones' y se reenvió a la ronda 2.
update actas
   set resolucion = 'condicionado'
 where numero_oficio = 'CEICS-CUTLAJO/2026/005'
   and resolucion = 'aprobado_con_observaciones';
