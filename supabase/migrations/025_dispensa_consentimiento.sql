-- =============================================================
-- 025_dispensa_consentimiento.sql — Dispensa de consentimiento informado
-- =============================================================
--
-- Para estudios RETROSPECTIVOS o que usan DATOS SECUNDARIOS / ANONIMIZADOS, el
-- comité puede DISPENSAR el consentimiento informado (Reglamento de la LGS en
-- materia de investigación, Art. 23 fr. II–III). El investigador lo solicita
-- marcando esta bandera en el paso 1 del wizard; entonces la "Carta de
-- consentimiento informado" deja de ser OBLIGATORIA para poder enviar el
-- protocolo. La justificación de la dispensa se incluye en la Carta dirigida al
-- Presidente (que ya es obligatoria); el comité decide si la concede.
--
-- Aditiva y retrocompatible: default false → los protocolos existentes no se ven
-- afectados (el consentimiento sigue siendo obligatorio salvo que se marque).

alter table protocolos
  add column if not exists solicita_dispensa_consentimiento boolean not null default false;
