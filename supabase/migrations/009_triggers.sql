-- =============================================================
-- 009_triggers.sql — Triggers de auditoría y reglas de negocio
-- =============================================================

-- Trigger universal: updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_usuarios_updated before update on usuarios
  for each row execute function set_updated_at();

create trigger trg_protocolos_updated before update on protocolos
  for each row execute function set_updated_at();

-- Inmutabilidad de evaluaciones (un voto NO se modifica)
create or replace function prevent_evaluacion_update()
returns trigger language plpgsql as $$
begin
  if old.inmutable then
    raise exception 'Una evaluación emitida no puede modificarse (inmutable=true)';
  end if;
  return new;
end $$;

create trigger trg_eval_inmutable before update on evaluaciones
  for each row execute function prevent_evaluacion_update();

-- Generar `clave` del protocolo al insertar (formato YYYY-NNN)
-- Se usa trigger en lugar de columna GENERATED porque extract() no es immutable.
create or replace function set_protocolo_clave()
returns trigger language plpgsql as $$
begin
  new.clave := extract(year from coalesce(new.created_at, now()))::text || '-' ||
               lpad(new.numero_consecutivo::text, 3, '0');
  return new;
end $$;

create trigger trg_protocolo_clave before insert on protocolos
  for each row execute function set_protocolo_clave();

-- Log automático de cambios de estado del protocolo
create or replace function log_cambio_estado_protocolo()
returns trigger language plpgsql as $$
begin
  if old.estado is distinct from new.estado then
    insert into protocolo_eventos (protocolo_id, tipo, descripcion, datos)
    values (
      new.id,
      'cambio_estado',
      format('Estado cambió de %s a %s', old.estado, new.estado),
      jsonb_build_object('estado_anterior', old.estado, 'estado_nuevo', new.estado)
    );
  end if;
  return new;
end $$;

create trigger trg_log_estado after update on protocolos
  for each row execute function log_cambio_estado_protocolo();
