-- =============================================================
-- 017_notificacion_presidente.sql — Idempotencia de email a Presidente (sesión 8b)
-- =============================================================
--
-- Cuando todos los miembros elegibles del comité emiten su voto sobre un
-- protocolo, la plataforma envía automáticamente un email al Presidente
-- avisando que el caso está listo para dictamen final.
--
-- Esta columna registra cuándo se envió ese email para garantizar que
-- nunca se mande dos veces (idempotencia). Si la server action de cierre
-- de voto se invoca de nuevo (p.ej. doble click, re-deploy mid-flight),
-- comprueba este timestamp antes de llamar a Resend.

alter table protocolos
  add column if not exists notificacion_presidente_at timestamptz;

comment on column protocolos.notificacion_presidente_at is
  'Marca de tiempo del envío del email automático al Presidente cuando el comité cerró la votación. NULL = aún no enviado.';
