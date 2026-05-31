-- =============================================================
-- 021_calendario_reuniones.sql — Calendario de sesiones del CEICS
-- =============================================================
--
-- Cambios:
--   1. Tabla sesiones_comite: agenda de reuniones del comité. Solo
--      Presidencia y Secretaría programan (gateado en la capa de app con
--      service_role); el resto consulta. Guarda fecha/hora, modalidad,
--      datos de Google Meet, orden del día (texto libre) y marcas de
--      recordatorio enviado (7 días / 1 día antes) para evitar duplicados.
--   2. RLS: SELECT abierto a usuarios autenticados (la app filtra qué campos
--      ve un investigador). Sin políticas de escritura → solo service_role
--      escribe, a través de las server actions con verificación de rol.
--   3. Seed de la primera sesión (miércoles 3 jun 2026, 9:00, virtual).
--
-- Zona horaria de referencia: America/Mexico_City (UTC-6, sin horario de
-- verano desde 2022). Las horas se guardan como `time` local de Jalisco.
-- =============================================================

create table if not exists sesiones_comite (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  fecha           date not null,
  hora_inicio     time not null default '09:00',
  hora_fin        time,
  modalidad       text not null default 'virtual'
                    check (modalidad in ('virtual', 'presencial', 'hibrida')),
  ubicacion       text,                 -- sede física (si presencial/híbrida)
  meet_link       text,                 -- enlace de Google Meet
  meet_telefono   text,                 -- teléfono de marcación
  meet_pin        text,                 -- PIN telefónico
  orden_del_dia   text,                 -- convocatoria + puntos (texto libre)
  created_by      uuid references usuarios(id) on delete set null,
  -- Marcas de recordatorio por correo (null = aún no enviado)
  recordatorio_7d_at timestamptz,
  recordatorio_1d_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table sesiones_comite is
  'Agenda de sesiones del CEICS. Programada por Presidencia/Secretaría.';

create index if not exists idx_sesiones_comite_fecha
  on sesiones_comite (fecha);

-- updated_at automático (función universal de 009_triggers.sql)
drop trigger if exists trg_sesiones_comite_updated on sesiones_comite;
create trigger trg_sesiones_comite_updated before update on sesiones_comite
  for each row execute function set_updated_at();

-- RLS: lectura para autenticados; escritura solo service_role (sin política).
alter table sesiones_comite enable row level security;

drop policy if exists sesiones_comite_select on sesiones_comite;
create policy sesiones_comite_select on sesiones_comite
  for select to authenticated using (true);

-- -------------------------------------------------------------
-- Seed: primera sesión del CEICS (idempotente por título+fecha)
-- -------------------------------------------------------------
insert into sesiones_comite (
  titulo, fecha, hora_inicio, hora_fin, modalidad,
  meet_link, meet_telefono, meet_pin, orden_del_dia
)
select
  'Primera Sesión del CEICS · 2026-28',
  date '2026-06-03',
  time '09:00',
  time '10:00',
  'virtual',
  'https://meet.google.com/nhq-xiwb-sro',
  '+52 55 8421 0898',
  '243 319 147 8127',
  $od$Por este medio se les hace una cordial invitación para participar en la primera sesión académica del Comité de Ética en Investigación para la Salud, a celebrarse el próximo miércoles 3 de junio en el horario de las 9:00 horas, en modalidad virtual, como miembros del comité.

Lo anterior con fundamento en el artículo 63, Fracción I de la Ley Orgánica y 141 Fracción XII del Estatuto General de la Universidad de Guadalajara.

Orden del día:

1. Lista de asistencia y recuento del quórum legal.
2. Revisión y manejo de la plataforma.
3. Calendarización de actividades del comité.
4. Revisión de protocolos pendientes.
5. Asuntos varios.

Esperamos su puntual asistencia, les enviamos saludos cordiales.$od$
where not exists (
  select 1 from sesiones_comite
  where titulo = 'Primera Sesión del CEICS · 2026-28'
    and fecha = date '2026-06-03'
);
