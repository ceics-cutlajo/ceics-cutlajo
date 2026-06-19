-- =============================================================
-- 027_anexos.sql — Anexos libres (múltiples) en la carga de documentos
-- =============================================================
-- El investigador puede adjuntar documentos de apoyo de tipo libre
-- (p.ej. "Carta de autorización del sitio", oficios, formatos) además de los
-- 7 documentos fijos del catálogo. Los anexos viven en la misma tabla
-- `protocolo_documentos` con tipo 'anexo', pueden ser VARIOS por ronda y llevan
-- una etiqueta libre. La IA del pre-dictamen los lee igual que los demás.

-- 1. Tipo 'anexo' en el catálogo (no obligatorio).
insert into tipos_documento (id, nombre, descripcion, obligatorio, condicion_obligatoriedad, orden, vigente)
values (
  'anexo',
  'Anexo',
  'Documento adicional de apoyo (p.ej. carta de autorización del sitio, oficios, formatos).',
  false,
  null,
  8,
  true
)
on conflict (id) do nothing;

-- 2. Etiqueta libre para describir cada anexo.
alter table protocolo_documentos
  add column if not exists etiqueta text;

-- 3. Permitir MÚLTIPLES anexos por ronda: el UNIQUE total bloqueaba más de un
--    documento del mismo tipo por ronda. Lo sustituimos por un índice único
--    PARCIAL que excluye los anexos — los tipos fijos siguen siendo uno por
--    ronda (conserva la garantía de la migración 024); los anexos no se limitan.
alter table protocolo_documentos
  drop constraint if exists uq_doc_protocolo_tipo_ronda;

create unique index if not exists uq_doc_protocolo_tipo_ronda
  on protocolo_documentos (protocolo_id, tipo_documento_id, ronda)
  where tipo_documento_id <> 'anexo';
