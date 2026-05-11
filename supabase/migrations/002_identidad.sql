-- =============================================================
-- 002_identidad.sql — Usuarios, roles, asignaciones
-- =============================================================

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nombre text not null,
  apellido_paterno text not null,
  apellido_materno text,
  codigo_udg text not null,
  centro_universitario text not null default 'CUTLAJO',
  division text,
  departamento text,
  telefono text,
  activo boolean not null default true,
  email_verificado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login timestamptz,
  constraint email_dominio_udg check (
    email like '%@academicos.udg.mx'
    or email like '%@cutlajomulco.udg.mx'
    or email like '%@alumnos.udg.mx'
  )
);

create index idx_usuarios_email on usuarios(email);
create index idx_usuarios_codigo on usuarios(codigo_udg);

create table roles (
  id rol_sistema primary key,
  descripcion text not null
);

create table usuario_roles (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  rol rol_sistema not null references roles(id),
  asignado_en timestamptz not null default now(),
  asignado_por uuid references usuarios(id),
  primary key (usuario_id, rol)
);

create index idx_usuario_roles_rol on usuario_roles(rol);
