-- =============================================================
-- 003_catalogos.sql — Catálogos (áreas SNII, tipos investigación, tipos documento)
-- =============================================================

create table areas_conocimiento (
  id smallint primary key,
  nombre text not null,
  descripcion text,
  vigente boolean not null default true
);

create table tipos_investigacion (
  id text primary key,
  nombre text not null,
  descripcion text,
  requiere_cofepris boolean not null default false,
  vigente boolean not null default true
);

create table tipos_documento (
  id text primary key,
  nombre text not null,
  descripcion text,
  obligatorio boolean not null default true,
  condicion_obligatoriedad jsonb,
  orden smallint not null,
  vigente boolean not null default true
);

-- Seeds inmediatos (catálogos pequeños, mejor en migración)

insert into roles (id, descripcion) values
  ('investigador',     'Investigador que somete protocolos'),
  ('comite_vocal',     'Vocal del CEICS con voto'),
  ('comite_secretario','Secretaría del CEICS'),
  ('presidente',       'Presidente del CEICS'),
  ('admin_sistema',    'Administrador técnico');

-- 9 áreas SNII vigentes 2025
insert into areas_conocimiento (id, nombre) values
  (1, 'Ciencias Físico-Matemáticas y de la Tierra'),
  (2, 'Biología y Química'),
  (3, 'Medicina y Ciencias de la Salud'),
  (4, 'Conducta y Educación'),
  (5, 'Humanidades'),
  (6, 'Ciencias Sociales'),
  (7, 'Biotecnología y Ciencias Agropecuarias, Forestales y Ecosistemas'),
  (8, 'Ingenierías y Desarrollo Tecnológico'),
  (9, 'Interdisciplinaria');

-- 6 tipos de investigación operativos
insert into tipos_investigacion (id, nombre, requiere_cofepris) values
  ('basica',      'Ciencia básica y de frontera',  false),
  ('aplicada',    'Ciencia aplicada',               false),
  ('tecnologico', 'Desarrollo tecnológico',         false),
  ('innovacion',  'Innovación',                     false),
  ('humanistica', 'Investigación humanística',      false),
  ('clinica',     'Investigación clínica',          true);

-- 7 tipos de documento (obligatoriedad condicional en JSON)
insert into tipos_documento (id, nombre, obligatorio, condicion_obligatoriedad, orden) values
  ('carta_presidente',  'Carta dirigida al Presidente del CEICS',     true,  null, 1),
  ('formato_protocolo', 'Formato de protocolo CEICS',                  true,  null, 2),
  ('delegacion',        'Carta de delegación de responsabilidades',    true,  null, 3),
  ('cv_ip',             'CV resumido del Investigador Principal',      true,  null, 4),
  ('bpc',               'Constancias de Buenas Prácticas Clínicas',    false, '{"tipo_investigacion": "clinica"}'::jsonb, 5),
  ('consentimiento',    'Carta de consentimiento informado',           false, '{"involucra_humanos": true}'::jsonb, 6),
  ('asentimiento',      'Carta de asentimiento pediátrico',            false, '{"involucra_menores": true}'::jsonb, 7);
