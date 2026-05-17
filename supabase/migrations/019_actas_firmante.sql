-- =============================================================
-- 019_actas_firmante.sql — Delegación de firma a Secretario(a)
--
-- Permite que el(la) Secretario(a) firme el acta cuando el Presidente
-- tiene conflicto de interés (es Investigador Principal del protocolo).
--
-- Estrategia: agregar `firmante_id` y `firmante_rol` SIN renombrar
-- `presidente_id`, que ahora pasa a ser un campo informativo del
-- Presidente titular del comité al momento de la emisión (no del firmante).
-- =============================================================

alter table actas
  add column firmante_id uuid references usuarios(id),
  add column firmante_rol rol_sistema;

-- Backfill: actas históricas fueron firmadas por el Presidente.
update actas
  set firmante_id = presidente_id,
      firmante_rol = 'presidente'::rol_sistema
  where firmante_id is null;

alter table actas
  alter column firmante_id set not null,
  alter column firmante_rol set not null;

-- Solo permitimos los dos roles que pueden firmar institucionalmente.
alter table actas
  add constraint actas_firmante_rol_valido
    check (firmante_rol in ('presidente', 'comite_secretario'));

comment on column actas.firmante_id is
  'Usuario que efectivamente firma el acta. Suele ser el Presidente; ' ||
  'cuando éste declara conflicto de interés (es IP del protocolo), ' ||
  'firma el(la) Secretario(a) por delegación, conforme al Reglamento Interno del CEICS.';

comment on column actas.firmante_rol is
  'Rol bajo el cual se firma. Determina el cargo impreso bajo la firma del acta.';

comment on column actas.presidente_id is
  'Presidente titular del CEICS al momento de emisión. ' ||
  'Hasta sesión 9b coincidía con el firmante; desde 9f puede diferir ' ||
  'cuando hay delegación a Secretario(a).';

create index if not exists idx_actas_firmante on actas(firmante_id);
