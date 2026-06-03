-- =============================================================
-- 024_versionado_docs_ronda.sql — Versionado documental por ronda
-- =============================================================
--
-- Hasta ahora, al reenviar un protocolo corregido (re-evaluación) los
-- documentos se REEMPLAZABAN: el archivo de la ronda previa se borraba de
-- Storage, perdiendo el historial. Esta migración añade
-- `protocolo_documentos.ronda` para CONSERVAR la versión de cada ronda.
--
-- La app (subirDocumentoAction) etiqueta cada documento con su ronda y lo sube
-- a un path por ronda ({protocolo}/r{ronda}/{tipo}-{ts}.{ext}); el reemplazo
-- solo ocurre dentro de la MISMA ronda. El listado del expediente muestra la
-- última versión de cada tipo (las anteriores se conservan como historial).
--
-- Datos existentes: ninguno al momento del go-live (reset 2026-06-03). El
-- default 1 cubre cualquier fila futura de ronda única, sin necesidad de backfill.

alter table protocolo_documentos
  add column if not exists ronda smallint not null default 1;

create index if not exists idx_docs_protocolo_ronda
  on protocolo_documentos(protocolo_id, ronda);

-- Integridad: un solo documento de cada tipo por ronda. Impide duplicados y
-- cierra la condición de carrera del patrón borrar+reinsertar de
-- subirDocumentoAction (dos subidas simultáneas del mismo tipo/ronda). El
-- índice único que crea este constraint también optimiza el lookup de
-- "documento existente" (filtra por protocolo_id + tipo_documento_id + ronda).
-- Idempotente: solo lo crea si no existe. Seguro porque la tabla está vacía
-- (reset 2026-06-03), no hay duplicados previos que violen el constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_doc_protocolo_tipo_ronda'
  ) then
    alter table protocolo_documentos
      add constraint uq_doc_protocolo_tipo_ronda
      unique (protocolo_id, tipo_documento_id, ronda);
  end if;
end $$;
