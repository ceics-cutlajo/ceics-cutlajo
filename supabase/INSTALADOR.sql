-- =============================================================
-- INSTALADOR SUPABASE — CEICS CUTLAJO (v3)
-- Aplica TODAS las migraciones en orden.
-- Generado: 2026-05-11T14:54:46Z
--
-- INSTRUCCIONES:
-- 1. Si ya intentaste correr versión anterior y falló, primero ejecuta:
--    drop schema public cascade;
--    create schema public;
--    grant all on schema public to public;
--    grant all on schema public to anon, authenticated, service_role;
-- 2. Pega TODO este archivo en SQL Editor de Supabase
-- 3. Click Run (Cmd/Ctrl+Enter)
-- =============================================================


-- =============================================================
-- migrations/001_enums.sql
-- =============================================================
-- =============================================================
-- 001_enums.sql — Tipos personalizados (enums)
-- =============================================================

create type rol_sistema as enum (
  'investigador',
  'comite_vocal',
  'comite_secretario',
  'presidente',
  'admin_sistema'
);

create type estado_protocolo as enum (
  'borrador',
  'en_evaluacion_ia',
  'en_revision_comite',
  'listo_dictamen',
  'aprobado',
  'aprobado_con_observaciones',
  'observaciones',
  'rechazado',
  'retirado'
);

create type tipo_voto as enum (
  'aprobar',
  'no_aprobar',
  'abstener'
);

create type severidad_criterio as enum (
  'critica',
  'alta',
  'media',
  'baja'
);

create type resultado_cumplimiento as enum (
  'cumple',
  'no_cumple',
  'parcial',
  'no_aplica'
);

create type clasificacion_riesgo as enum (
  'sin_riesgo',
  'riesgo_minimo',
  'riesgo_mayor_minimo'
);


-- =============================================================
-- migrations/002_identidad.sql
-- =============================================================
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


-- =============================================================
-- migrations/003_catalogos.sql
-- =============================================================
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


-- =============================================================
-- migrations/004_checklist.sql
-- =============================================================
-- =============================================================
-- 004_checklist.sql — Tabla de items de evaluación normativa
-- (los 100 items se cargan desde NORMATIVIDAD/04_CHECKLIST_MAESTRO.json
--  en migration 005 con un INSERT bulk)
-- =============================================================

create table checklist_items (
  id text primary key,
  categoria text not null,
  subcategoria text,
  criterio text not null,
  evidencia_esperada text not null,
  fuentes jsonb not null,
  severidad severidad_criterio not null,
  peso smallint not null check (peso between 1 and 5),
  aplicabilidad jsonb not null,
  seccion_protocolo smallint,
  ai_prompt_hint text not null,
  version text not null default '1.0',
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now()
);

create index idx_checklist_categoria on checklist_items(categoria);
create index idx_checklist_severidad on checklist_items(severidad);
create index idx_checklist_vigente on checklist_items(vigente_desde, vigente_hasta);


-- =============================================================
-- migrations/005_checklist_seed.sql
-- =============================================================
-- =============================================================
-- 005_checklist_seed.sql — GENERADO AUTOMÁTICAMENTE
-- Fuente: NORMATIVIDAD/04_CHECKLIST_MAESTRO.json
-- Total items: 100
-- Fecha: 2026-05-11T13:54:48.041Z
-- NO EDITAR A MANO. Regenerar con `node scripts/gen-seed.js`.
-- =============================================================

begin;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-001',
  'identificacion',
  'portada',
  'El protocolo presenta identificacion completa: titulo en espanol sin abreviaturas, codigo interno, version, fecha, idioma y lista de centros participantes.',
  'Portada del protocolo y Seccion 1 del Formato CEIC con titulo identico al de la carta dirigida al Presidente del Comite.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.1","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Sec. 5 Protocolo","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Helsinki 2024 §22","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Verifica que el titulo (1) este en espanol, (2) no exceda 250 caracteres, (3) no use abreviaturas no definidas, (4) coincida exactamente con el titulo de la carta de solicitud y de la portada del protocolo.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-002',
  'identificacion',
  'investigador_principal',
  'El Investigador Principal (IP) esta acreditado: nombramiento UdeG/CUTlajo, CV vigente, cedula profesional, formacion en BPC y autorizacion escrita del titular del Centro.',
  'Anexo con CV firmado, copia de cedula profesional, constancia BPC/ICH-GCP vigente y oficio de autorizacion del Director del Centro.',
  '[{"ref":"RLGSMIS art. 113","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 8","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Principio 9","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Codigo Nuremberg principio 8","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  2,
  'Verifica presencia de los 4 documentos: (1) CV con firma, (2) cedula profesional vigente, (3) constancia BPC con fecha de emision <=3 anos, (4) oficio del titular. Si falta cualquiera, marcar como NO cumple.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-003',
  'identificacion',
  'equipo_investigacion',
  'Cada miembro del equipo de investigacion presenta CV, formacion documentada en BPC/ICH-GCP y capacitacion en bioetica.',
  'Tabla de equipo con nombre, rol, CV resumido, fecha de ultima capacitacion BPC y bioetica.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 8","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"CONBIOETICA Acuerdo Disp. 16a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"ICH-GCP E6(R3) Principio 9","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Codigo Nuremberg principio 8","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  2,
  'Cuenta los miembros del equipo y verifica que cada uno tenga: (a) rol asignado, (b) CV adjunto, (c) constancia BPC vigente. Senalar miembros sin documentacion.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-004',
  'identificacion',
  'patrocinador',
  'Si existe patrocinador externo, esta identificado con datos legales y carta firmada de aceptacion de obligaciones.',
  'Carta del patrocinador en hoja membretada con razon social, RFC, representante legal y obligaciones aceptadas; o declaracion de ausencia de patrocinador.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 9","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Sec. 4 Sponsor","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"COFEPRIS Modulo III","url":"https://www.gob.mx/cofepris/articulos/guia-para-el-ingreso-de-protocolos-de-investigacion"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  3,
  'Si el protocolo tiene financiamiento externo, busca carta de aceptacion en anexos. Si dice ''sin patrocinador'', verifica que el IP/institucion asuma las funciones del patrocinador en el texto.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-005',
  'identificacion',
  'sedes',
  'Las sedes de la investigacion estan identificadas y autorizadas por escrito por sus titulares.',
  'Oficio de autorizacion firmado por el titular de cada sede; en multicentricos, lista de sedes con autorizacion local.',
  '[{"ref":"LGS art. 100 frac. V","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 10","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Common Rule §46.114 Single IRB","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  4,
  'Lista todas las sedes mencionadas en el protocolo y para cada una busca oficio de autorizacion firmado por el titular (Director/Jefe). En multicentrico verifica al menos una autorizacion por sede.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-006',
  'identificacion',
  'tipo_estudio',
  'El tipo de estudio esta clasificado correctamente: observacional/experimental, retro/prospectivo, mono/multicentrico, nacional/internacional.',
  'Apartado ''Tipo de estudio'' con clasificacion explicita y congruente con el diseno descrito.',
  '[{"ref":"RLGSMIS art. 17","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"CIOMS 2016 Pauta 1","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'media',
  2,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  5,
  'Identifica en el texto las cuatro dimensiones: (1) observacional vs experimental, (2) retrospectivo vs prospectivo, (3) mono vs multicentrico, (4) nacional vs internacional. Si falta alguna, marcar incompleto.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-007',
  'identificacion',
  'registro_publico',
  'El protocolo esta registrado o sera registrado previo al inicio en una base publica (ClinicalTrials.gov, ISRCTN, REPEC, RENIS u otro registro reconocido).',
  'Numero de registro NCT/ISRCTN/equivalente o compromiso explicito con fecha estimada de registro pre-reclutamiento.',
  '[{"ref":"Helsinki 2024 §35","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 24","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"OPS Preguntas Guia 9","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Para ensayos clinicos (intervencionistas) busca numero de registro tipo NCTxxxxxxxx o ISRCTN. Si es estudio observacional puro puede no aplicar; documentar en observaciones.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-008',
  'estructura_cientifica',
  'marco_teorico',
  'El protocolo presenta marco teorico actualizado, sustentado en bibliografia reciente y pertinente.',
  'Seccion ''Marco teorico'' con citas bibliograficas, mayoria de los ultimos 5-10 anos.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.2","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"CIOMS 2016 Pauta 1","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Helsinki 2024 §22","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  6,
  'Cuenta numero de citas en el marco teorico y porcentaje publicadas en los ultimos 5 anos (debe ser >=60%). Senala si predomina bibliografia >10 anos.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-009',
  'estructura_cientifica',
  'problema',
  'Existe una definicion clara, especifica y delimitada del problema de investigacion.',
  'Apartado ''Planteamiento del problema'' con magnitud, trascendencia y vacio de conocimiento identificado.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.3","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"OPS Preguntas Guia 1","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  7,
  'Verifica que el planteamiento contenga: (1) descripcion del fenomeno, (2) magnitud o prevalencia con cifras, (3) vacio de conocimiento que el estudio cubrira.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-010',
  'estructura_cientifica',
  'antecedentes',
  'Los antecedentes incluyen literatura nacional e internacional pertinente y reciente.',
  'Seccion de antecedentes con citas internacionales y nacionales y revision sistematica del estado del arte.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.4","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Codigo Nuremberg principio 3","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Helsinki 2024 §22","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  8,
  'Verifica presencia de al menos: (1) 3 referencias internacionales recientes, (2) 1 referencia nacional/latinoamericana, (3) sintesis del estado del arte.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-011',
  'estructura_cientifica',
  'justificacion',
  'La justificacion demuestra valor cientifico y social del estudio y relevancia para necesidades de salud locales/regionales.',
  'Apartado ''Justificacion'' que articula valor cientifico, beneficio esperado para la poblacion CUTlajomulco/Jalisco/Mexico y vacio que cubre.',
  '[{"ref":"LGS art. 96","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 6.2.5","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Helsinki 2024 §4","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 1","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Bioetica 2005 art. 14","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"OPS Preguntas Guia 1","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  9,
  'Identifica 3 elementos: (1) valor cientifico (que conocimiento aporta), (2) valor social (a quien beneficia y como), (3) pertinencia local para Tlajomulco/Jalisco/Mexico.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-012',
  'estructura_cientifica',
  'subsidiariedad',
  'Se demuestra que el conocimiento perseguido no puede obtenerse por otro metodo idoneo menos riesgoso.',
  'Parrafo explicito de subsidiariedad: por que se requiere investigacion en humanos y por que este diseno y no otro alternativo.',
  '[{"ref":"LGS art. 100 frac. II","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"RLGSMIS art. 14 frac. III","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Codigo Nuremberg principio 2","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Convenio Oviedo art. 16(i)","url":"https://rm.coe.int/168007cf98"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  9,
  'Busca explicitamente parrafo que diga por que no es posible responder la pregunta con (a) datos secundarios, (b) modelos animales, (c) simulacion. Si no hay justificacion, marcar como NO cumple.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-013',
  'estructura_cientifica',
  'hipotesis',
  'Cuando aplica al diseno, se enuncia hipotesis de investigacion clara y verificable.',
  'Seccion ''Hipotesis'' con enunciado falsable; o declaracion explicita de que no aplica (estudio descriptivo/cualitativo).',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.6","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"}]'::jsonb,
  'media',
  2,
  '{"tipo_investigacion":["clinica","basica","aplicada"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  10,
  'Si el diseno es analitico/experimental, debe haber hipotesis. Si es descriptivo/cualitativo, debe declarar ''no aplica'' con justificacion. Marcar inconsistente si es ECA sin hipotesis.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-014',
  'estructura_cientifica',
  'objetivos',
  'Existen objetivo general y objetivos especificos, congruentes entre si, con la pregunta y con la metodologia.',
  'Apartado ''Objetivos'' con un objetivo general y al menos 2 especificos, redactados con verbos medibles.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.7","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Principio 2","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  11,
  'Verifica: (1) existe objetivo general, (2) existen >=2 objetivos especificos, (3) los verbos son medibles (determinar, evaluar, comparar, etc.), (4) son congruentes con la pregunta.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-015',
  'estructura_cientifica',
  'referencias',
  'Las referencias bibliograficas son suficientes, actualizadas y siguen un estilo consistente.',
  'Lista de referencias en estilo Vancouver/APA, >=20 referencias en clinicos, mayoria <5 anos.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.10","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"}]'::jsonb,
  'media',
  2,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  28,
  'Cuenta numero total de referencias y porcentaje <5 anos. Verifica estilo consistente. Senalar si <15 referencias en estudios clinicos.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-016',
  'metodologia',
  'diseno',
  'El diseno metodologico es apropiado para la pregunta y objetivos, y esta descrito con detalle reproducible.',
  'Seccion ''Material y metodos'' con tipo de estudio, intervenciones, mediciones, instrumentos, y suficiente detalle para replicacion.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.8","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Principio 2","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"CIOMS 2016 Pauta 1","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"OPS Preguntas Guia 2","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'alta',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  12,
  'Aplica criterios SPIRIT/STROBE/CONSORT segun tipo. Verifica: (1) tipo de estudio congruente con pregunta, (2) procedimientos paso a paso, (3) instrumentos validados, (4) variables operacionalizadas.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-017',
  'metodologia',
  'muestra',
  'Existe calculo justificado del tamano de muestra con formula, parametros y software citados.',
  'Subseccion ''Calculo de muestra'' con formula, valores de alpha/beta/efecto esperado, y software (G*Power, EpiInfo, etc.).',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.9","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"CIOMS 2016 Pauta 1","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"OPS Preguntas Guia 2","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  13,
  'Busca: (1) formula explicita, (2) alpha (usualmente 0.05), (3) poder/beta (>=0.8), (4) tamano de efecto, (5) software citado. Estudios cualitativos pueden usar saturacion teorica.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-018',
  'metodologia',
  'criterios_seleccion',
  'Los criterios de inclusion, exclusion y eliminacion son explicitos, justificados y operacionalizables.',
  'Tres listas separadas de criterios con definiciones operativas claras (no ambiguas).',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.9","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"CIOMS 2016 Pauta 3","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Belmont aplicacion 3","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"Common Rule §46.111(a)(3)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  14,
  'Verifica las 3 listas. Cada criterio debe ser binario verificable. Senalar criterios ambiguos como ''paciente colaborador'' sin definicion.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-019',
  'metodologia',
  'variables',
  'Las variables estan operacionalizadas con tipo (cuali/cuanti), escala de medicion, instrumento y unidades.',
  'Tabla de variables (independientes, dependientes, confusoras) con definicion conceptual y operacional.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.8-9","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"OPS Preguntas Guia 2","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  15,
  'Espera tabla con columnas: nombre, tipo, escala, instrumento, unidades. Si no hay tabla, verifica que el texto las describa.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-020',
  'metodologia',
  'analisis',
  'El plan de analisis estadistico esta predefinido (pruebas, software, manejo de datos faltantes).',
  'Subseccion ''Analisis estadistico'' con pruebas para cada objetivo, software (SPSS, R, Stata), umbral de significancia y plan para datos faltantes.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.9","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Principio 2","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"OPS Preguntas Guia 2","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  16,
  'Verifica que el plan especifique: (1) prueba(s) estadistica(s) por objetivo, (2) software y version, (3) p-valor o IC, (4) manejo de perdidas y missing data.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-021',
  'metodologia',
  'datos_preclinicos',
  'Para investigacion experimental hay respaldo en datos preclinicos (animales, in vitro) o evidencia clinica previa suficiente.',
  'Seccion con resumen de datos preclinicos (toxicologia, farmacologia) o revision de evidencia clinica previa.',
  '[{"ref":"RLGSMIS art. 14 frac. II","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Codigo Nuremberg principio 3","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"ICH-GCP E6(R3) Principio 5","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Helsinki 2024 §22","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  17,
  'Para ensayos con farmacos/dispositivos verifica datos preclinicos en IB. Para intervenciones conductuales basta evidencia clinica previa.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-022',
  'metodologia',
  'cronograma',
  'Existe cronograma realista con hitos temporales y entregables definidos.',
  'Diagrama de Gantt o tabla con fases (preparacion, reclutamiento, intervencion, analisis, reporte) y fechas.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.11","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"}]'::jsonb,
  'media',
  2,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  18,
  'Espera tabla/Gantt con al menos 4 fases y fecha de termino. Verifica que la suma de fases sea coherente con el periodo total declarado.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-023',
  'metodologia',
  'cluster',
  'En ensayos aleatorizados por conglomerados (cluster), se justifica el diseno y se documenta consentimiento individual o de gatekeeper.',
  'Apartado especifico que describa unidad de aleatorizacion, gatekeeper consent y consentimiento individual cuando aplica.',
  '[{"ref":"CIOMS 2016 Pauta 21","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  12,
  'Solo aplica si el diseno es cluster RCT. Verifica que la unidad de aleatorizacion (escuelas, comunidades, clinicas) este definida y exista plan de consentimiento.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-024',
  'riesgo_beneficio',
  'principios_eticos',
  'El protocolo declara explicitamente los principios bioeticos rectores: autonomia, beneficencia, no maleficencia y justicia.',
  'Apartado ''Consideraciones eticas'' que enuncie los 4 principios y como se garantizan en el estudio.',
  '[{"ref":"Belmont principios 1-3","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"CIOMS 2016 Preambulo","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Bioetica 2005 arts. 3-6","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  19,
  'Busca enunciacion explicita de los 4 principios. Verificar que cada uno tenga al menos una frase operativa de como se cumple en el estudio.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-025',
  'riesgo_beneficio',
  'helsinki_apego',
  'El protocolo declara apego a la Declaracion de Helsinki (version vigente 2024) y demas estandares internacionales.',
  'Frase explicita de apego a Helsinki 2024, CIOMS 2016 y, cuando aplique, ICH-GCP E6(R3) e Informe Belmont.',
  '[{"ref":"LGS art. 100","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 5","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Helsinki 2024","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"ICH-GCP E6(R3) Principio 1","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  19,
  'Buscar mencion textual de Helsinki con anio. Si menciona version anterior a 2024 marcar como observacion: ''actualizar a version vigente''.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-026',
  'riesgo_beneficio',
  'dignidad',
  'El protocolo establece el respeto a la dignidad, derechos y bienestar del participante como prioridad sobre intereses de la ciencia.',
  'Declaracion explicita de primacia del participante; frase como ''el bienestar del participante prevalece sobre el interes cientifico''.',
  '[{"ref":"RLGSMIS art. 13","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Convenio Oviedo art. 2","url":"https://rm.coe.int/168007cf98"},{"ref":"Helsinki 2024 §4","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"ICH-GCP E6(R3) Principio 3","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"UNESCO Bioetica 2005 art. 3.2","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  19,
  'Buscar frase clave ''bienestar del participante prevalece'' o equivalente. Si solo se menciona ''cumplimiento etico'' generico, marcar como insuficiente.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-027',
  'riesgo_beneficio',
  'identificacion_riesgos',
  'El protocolo identifica exhaustivamente los riesgos previsibles (fisicos, psicologicos, sociales, economicos) para cada procedimiento.',
  'Tabla o lista ''Riesgos del estudio'' que enumere riesgos por categoria, probabilidad y magnitud.',
  '[{"ref":"RLGSMIS art. 17","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Codigo Nuremberg principio 4","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Helsinki 2024 §17","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"Belmont aplicacion 2","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"CIOMS 2016 Pauta 4","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule §46.111(a)(1)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  20,
  'Verifica las 4 categorias de riesgo (fisico, psicologico, social, economico). Si solo aborda riesgos fisicos, marcar como incompleto en estudios conductuales o con datos sensibles.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-028',
  'riesgo_beneficio',
  'clasificacion_riesgo',
  'El nivel de riesgo esta correctamente clasificado segun art. 17 RLGSMIS: sin riesgo / riesgo minimo / mayor que minimo, con justificacion.',
  'Apartado ''Categoria de riesgo'' con clasificacion y argumentacion basada en los procedimientos del estudio.',
  '[{"ref":"RLGSMIS art. 17","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 6","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  20,
  'Compara procedimientos descritos con las definiciones del art. 17. Senalar inconsistencia (ej: estudio con biopsias clasificado como ''riesgo minimo'').'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-029',
  'riesgo_beneficio',
  'minimizacion',
  'Se describen acciones concretas para minimizar los riesgos identificados (mitigacion).',
  'Para cada riesgo listado, una medida correspondiente de mitigacion (capacitacion, monitoreo, equipo de proteccion, etc.).',
  '[{"ref":"Codigo Nuremberg principio 4","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Helsinki 2024 §17","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"ICH-GCP E6(R3) Principio 4","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Common Rule §46.111(a)(1)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  20,
  'Verifica correspondencia uno-a-uno entre riesgos identificados (CHK-027) y medidas de mitigacion. Sin medidas, marcar incumplimiento.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-030',
  'riesgo_beneficio',
  'balance',
  'Se demuestra que los beneficios esperados (individuales o sociales) superan los riesgos previsibles.',
  'Analisis explicito de balance riesgo/beneficio con argumentacion cualitativa o cuantitativa.',
  '[{"ref":"RLGSMIS art. 14 frac. IV","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Codigo Nuremberg principio 6","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Helsinki 2024 §16-17","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"Belmont aplicacion 2","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"Convenio Oviedo art. 16(ii)","url":"https://rm.coe.int/168007cf98"},{"ref":"CIOMS 2016 Pauta 4","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule §46.111(a)(2)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  20,
  'Verifica argumentacion explicita: ''los beneficios X superan los riesgos Y porque Z''. No basta con listar ambos; debe haber juicio comparativo.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-031',
  'riesgo_beneficio',
  'suspension',
  'Existe mecanismo definido para suspender la investigacion de inmediato ante riesgo, dano o solicitud del participante.',
  'Procedimiento con criterios de suspension, autoridad responsable de decidir y notificacion al CEI.',
  '[{"ref":"LGS art. 100 frac. VI","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"RLGSMIS art. 18","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Codigo Nuremberg principios 9-10","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"ICH-GCP E6(R3) Sec. Terminacion","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  21,
  'Buscar parrafo ''Criterios de suspension'' o ''Stopping rules''. Verifica: (1) criterios objetivos, (2) responsable, (3) notificacion al CEI en plazo definido.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-032',
  'riesgo_beneficio',
  'atencion_dano',
  'La institucion garantiza atencion medica e indemnizacion al participante que sufra dano relacionado con la investigacion.',
  'Clausula en el protocolo y en el consentimiento; carta institucional o poliza de seguro adjunta.',
  '[{"ref":"LGS art. 100 frac. VII","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"RLGSMIS art. 19","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Helsinki 2024 §15","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 14","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Codigo Nuremberg principio 7","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  22,
  'Para riesgo > minimo verificar poliza de seguro vigente. Para riesgo minimo basta carta institucional. Sin ningun mecanismo, marcar critica no cumple.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-033',
  'riesgo_beneficio',
  'eventos_adversos',
  'Existe plan de manejo y reporte de eventos adversos al CEI con periodicidad y formato CIOMS/SAE definidos.',
  'Procedimiento con clasificacion de eventos (leve/moderado/grave/SUSAR), plazos de reporte y formato.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 8","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"NOM-220-SSA1-2016 Farmacovigilancia","url":"https://dof.gob.mx/normasOficiales.php?codp=6750"},{"ref":"ICH-GCP E6(R3) Principio 4","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Helsinki 2024 §18","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  22,
  'Verifica que exista: (1) clasificacion de gravedad, (2) plazos (SUSAR <=15 dias), (3) formato (CIOMS-I para SAE), (4) destinatarios (CEI, COFEPRIS, sponsor).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-034',
  'riesgo_beneficio',
  'monitoreo_seguridad',
  'Cuando aplica, se establece comite de monitoreo de datos y seguridad (DSMB/DMC) o plan equivalente de monitoreo basado en riesgo.',
  'Para ensayos clinicos con riesgo > minimo, charter del DSMB o plan de monitoreo central/in-situ.',
  '[{"ref":"ICH-GCP E6(R3) Principio 4 / Sec. 4 Sponsor","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Common Rule §46.111(a)(6)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  22,
  'Para fases II/III con riesgo significativo verifica DSMB. Para fases I y observacionales puede bastar monitoreo central. Justificar ausencia.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-035',
  'consentimiento',
  'carta_consentimiento',
  'Existe Carta de Consentimiento Informado (CCI) por escrito, en lenguaje comprensible para el participante.',
  'Documento independiente ''Carta de Consentimiento Informado'', en espanol claro, lenguaje no tecnico.',
  '[{"ref":"LGS art. 100 frac. IV","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"RLGSMIS arts. 20-22","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 12","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Codigo Nuremberg principio 1","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Helsinki 2024 §26","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"Belmont aplicacion 1","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"CIOMS 2016 Pauta 9","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Convenio Oviedo art. 5","url":"https://rm.coe.int/168007cf98"},{"ref":"UNESCO Bioetica 2005 art. 6","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"Common Rule §46.116","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Verifica que el documento exista como anexo separado, este en espanol y use lenguaje de nivel maximo bachillerato (Flesch-Huerta o equivalente).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-036',
  'consentimiento',
  'elementos_art21',
  'La CCI incluye los 11 elementos del art. 21 RLGSMIS: justificacion/objetivos, procedimientos, riesgos, beneficios, alternativas, garantia de respuesta, libertad de retiro, confidencialidad, informacion actualizada, indemnizacion, gastos absorbidos.',
  'Lista verificable en la CCI con cada uno de los 11 puntos cubiertos.',
  '[{"ref":"RLGSMIS art. 21","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 12","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Common Rule §46.116(b)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"},{"ref":"CIOMS 2016 Pauta 9","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Recorre los 11 elementos del art. 21 y marca cuales estan presentes en la CCI. Si faltan >2 elementos, marcar critica no cumple.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-037',
  'consentimiento',
  'requisitos_art22',
  'La CCI cumple los 5 requisitos formales del art. 22 RLGSMIS: elaborada por IP, aprobada por CEI, dos testigos identificados, firmas requeridas, duplicado para el sujeto.',
  'Pie de firmas con: sujeto (o representante), 2 testigos con direccion y relacion, IP. Sello del CEI. Mencion de duplicado.',
  '[{"ref":"RLGSMIS art. 22","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"NOM-012-SSA3-2012 Sec. 12","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Verifica los 5 requisitos formales en el pie de la CCI. La firma huella digital esta permitida si el sujeto no sabe firmar.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-038',
  'consentimiento',
  'voluntariedad',
  'La CCI declara explicitamente la voluntariedad y el derecho a retirarse en cualquier momento sin perjuicio para la atencion del participante.',
  'Parrafo dedicado en la CCI: ''Su participacion es voluntaria y puede retirarse en cualquier momento sin que esto afecte su atencion medica''.',
  '[{"ref":"RLGSMIS art. 21 frac. VII","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Codigo Nuremberg principios 1, 9","url":"https://research.unc.edu/human-research-ethics/resources/ccm3_019064/"},{"ref":"Helsinki 2024 §26","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"Convenio Oviedo art. 5","url":"https://rm.coe.int/168007cf98"},{"ref":"UNESCO Bioetica 2005 art. 6","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Buscar la frase clave ''voluntaria'' y ''retirarse en cualquier momento sin perjuicio''. Sin esta frase, marcar incumplimiento critico.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-039',
  'consentimiento',
  'contacto_ip_cei',
  'La CCI proporciona datos de contacto del IP (telefono 24/7) y del CEI para preguntas, dudas y quejas.',
  'Bloque de contactos con nombre, telefono celular del IP y datos del CEI (correo, telefono, direccion).',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 12","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Sec. 3","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"Common Rule §46.116(b)(7)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Verifica los 2 bloques: IP con celular (no solo institucional) y CEI con al menos correo. Telefono 24/7 obligatorio en estudios con riesgo > minimo.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-040',
  'consentimiento',
  'comprension',
  'El proceso de consentimiento incluye verificacion de comprension (preguntas, devolucion oral, espera para reflexion).',
  'Apartado del protocolo que describe el proceso (no solo el documento) e incluye lista de verificacion de comprension.',
  '[{"ref":"Belmont aplicacion 1","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"ICH-GCP E6(R3) Principio 10","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"CIOMS 2016 Pauta 9","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Helsinki 2024 §26","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Diferenciar ''documento'' del ''proceso''. Buscar mencion de tiempo de reflexion (al menos 24 hr en riesgo > minimo) y mecanismo de verificacion de comprension.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-041',
  'consentimiento',
  'key_information',
  'La CCI presenta al inicio un resumen ''key information'' (informacion clave) conciso de proposito, riesgos, beneficios y alternativas.',
  'Primera seccion de la CCI con 1-2 paginas de informacion esencial antes del detalle completo.',
  '[{"ref":"Common Rule §46.116(a)(5)(i)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"},{"ref":"ICH-GCP E6(R3) Principio 10","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Verifica si la CCI inicia con ''Resumen'' o ''Informacion clave''. Si va directa al detalle largo, marcar como mejorable.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-042',
  'consentimiento',
  'econsent',
  'Si se usa eConsent (consentimiento electronico), se documenta el sistema, sus salvaguardas de identidad, integridad y trazabilidad.',
  'Descripcion del sistema eConsent, validacion (Part 11 / GCP), proceso de respaldo en papel cuando proceda.',
  '[{"ref":"ICH-GCP E6(R3) Principio 10-11","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Solo aplica si se declara eConsent. Verifica: (1) sistema validado (audit trail), (2) firma electronica equivalente, (3) opcion de papel para participantes sin acceso digital.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-043',
  'consentimiento',
  'waiver',
  'Si se solicita dispensa o modificacion del consentimiento, esta justificada conforme a CIOMS Pauta 10 y Common Rule §46.116(f).',
  'Solicitud explicita de waiver con: (1) imposibilidad practica, (2) riesgo minimo, (3) no perjudica derechos, (4) informacion posterior cuando aplique.',
  '[{"ref":"CIOMS 2016 Pauta 10","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule §46.116(f)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["epidemiologica","basica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Solo aplica si el protocolo solicita waiver (tipico en estudios retrospectivos con expedientes). Verifica los 4 criterios. Sin justificacion solida, rechazar waiver.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-044',
  'consentimiento',
  'asentimiento_menores',
  'Para menores >=8 anos con capacidad cognitiva suficiente, existe Carta de Asentimiento adaptada al lenguaje del menor.',
  'Documento independiente ''Carta de Asentimiento'' con vocabulario adecuado a la edad, ilustraciones cuando proceda.',
  '[{"ref":"RLGSMIS art. 37","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"CIOMS 2016 Pauta 17","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule Subparte D §46.408","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"},{"ref":"CONBIOETICA Guia 2018","url":"https://www.gob.mx/cms/uploads/attachment/file/460756/7_Guia_CEI_2018_6a.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":true,"involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Solo aplica si incluye menores. Verifica: (1) documento separado del consentimiento parental, (2) lenguaje apropiado a la edad, (3) opcion de rehusarse del menor.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-045',
  'consentimiento',
  'consentimiento_representante',
  'Para menores e incapaces, se obtiene consentimiento por escrito del representante legal (ambos padres si aplica patria potestad).',
  'CCI para representante con clausulas adicionales, identificacion del vinculo y firma de uno o ambos padres.',
  '[{"ref":"RLGSMIS art. 36","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Convenio Oviedo arts. 6-7","url":"https://rm.coe.int/168007cf98"},{"ref":"CIOMS 2016 Pautas 16-17","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule Subparte D §46.408","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"},{"ref":"UNESCO Bioetica 2005 art. 7","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"UNESCO Genoma 1997 art. 5","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":true,"involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Para riesgo > minimo en menores, requerir firma de ambos padres (excepcion: imposibilidad fehaciente). Sin doble firma cuando aplica, rechazar.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-046',
  'consentimiento',
  'broad_consent',
  'Para biobancos, datos secundarios o uso ulterior, el tipo de consentimiento (especifico, amplio o dinamico) esta justificado y descrito.',
  'Apartado dedicado que indique: tipo de consentimiento, gobierno de uso secundario, opciones del participante (opt-in/opt-out por categoria).',
  '[{"ref":"Helsinki 2024 §32","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pautas 11-12","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"GDPR art. 89 + EDPB 2026","url":"https://gdpr-info.eu/art-89-gdpr/"},{"ref":"Common Rule §46.116(d)","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"},{"ref":"UNESCO Datos Geneticos 2003 art. 16","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Solo aplica si el protocolo prevee biobanco o uso secundario. Justificar el tipo (especifico/amplio/dinamico) y describir gobierno (Material Transfer Agreement).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-047',
  'consentimiento',
  'consentimiento_genetico',
  'Para investigacion con datos geneticos humanos, el consentimiento es previo, libre, informado, expreso y sin incentivos economicos indebidos.',
  'Apartado especifico de consentimiento genetico con: finalidad detallada, tipos de analisis, manejo de hallazgos incidentales, retiro.',
  '[{"ref":"UNESCO Datos Geneticos 2003 art. 8","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"},{"ref":"UNESCO Genoma 1997 art. 5","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"},{"ref":"Convenio Oviedo art. 5","url":"https://rm.coe.int/168007cf98"},{"ref":"GDPR art. 9 (datos geneticos)","url":"https://gdpr-info.eu/art-9-gdpr/"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":true}'::jsonb,
  23,
  'Solo aplica si hay analisis genetico/genomico. Verifica menciones explicitas de: tipo de analisis (NGS, GWAS, etc.), hallazgos incidentales, derecho a no saber.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-048',
  'consentimiento',
  'embarazadas',
  'Para mujeres en edad fertil, embarazadas, lactancia o post-parto, hay consentimiento adicional con informacion de riesgos al feto/embrion/RN.',
  'CCI especifica con seccion sobre riesgos reproductivos; cuando aplica, consentimiento del conyuge/concubino.',
  '[{"ref":"RLGSMIS arts. 40-56","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"CIOMS 2016 Pauta 19","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule Subparte B §46.204","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Aplica si hay mujeres embarazadas/lactantes en criterios de inclusion o si existe riesgo teratogenico. Verificar prueba de embarazo, anticoncepcion, monitoreo fetal.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-049',
  'poblaciones_vulnerables',
  'identificacion_vulnerabilidad',
  'Se identifica y caracteriza la vulnerabilidad de los grupos participantes (etnica, economica, edad, capacidad mental, dependencia institucional).',
  'Apartado ''Vulnerabilidad'' con descripcion del tipo de vulnerabilidad y plan de mitigacion.',
  '[{"ref":"RLGSMIS arts. 34, 57-59","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Helsinki 2024 §19-20","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"Belmont aplicacion 3","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"CIOMS 2016 Pauta 15","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Bioetica 2005 art. 8","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Verificar si la poblacion incluye categorias vulnerables. Si las incluye y el protocolo no las menciona, marcar como omision critica.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-050',
  'poblaciones_vulnerables',
  'justificacion_inclusion',
  'Existe justificacion cientifica explicita para incluir grupos vulnerables y demostracion de que el conocimiento no puede generarse en otra poblacion.',
  'Argumentacion en el protocolo: por que no se puede estudiar en adultos sanos / poblacion general.',
  '[{"ref":"CIOMS 2016 Pauta 17","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Belmont aplicacion 3","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"Helsinki 2024 §19-20","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Solo aplica si hay grupos vulnerables. Buscar parrafo de justificacion. Sin justificacion solida, marcar incumplimiento.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-051',
  'poblaciones_vulnerables',
  'subordinados',
  'Para grupos subordinados (estudiantes, trabajadores, militares, internos), hay garantias reforzadas frente a coercion: confidencialidad ante superiores, reclutamiento por terceros.',
  'Procedimiento de reclutamiento que evita conflictos jerarquicos; declaracion de no-represalia firmada.',
  '[{"ref":"RLGSMIS arts. 57-59","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"CIOMS 2016 Pauta 15","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Common Rule Subparte C presos","url":"https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Aplica si IP es profesor que recluta a sus alumnos, jefe que recluta a sus empleados, etc. Verificar uso de reclutador independiente y confidencialidad de la decision.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-052',
  'poblaciones_vulnerables',
  'indigenas',
  'Para investigacion con comunidades indigenas, existe consulta culturalmente apropiada en lengua originaria y participacion comunitaria.',
  'Procedimiento de consulta previa, libre e informada conforme Convenio 169 OIT; CCI traducida y validada.',
  '[{"ref":"LGS art. 100","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"},{"ref":"CIOMS 2016 Pauta 7","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Bioetica 2005 art. 12","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"Convenio 169 OIT","url":"https://www.ilo.org/dyn/normlex/en/f?p=NORMLEXPUB:12100:0::NO::P12100_ILO_CODE:C169"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Aplica si reclutamiento incluye comunidades indigenas. Verificar: traduccion validada, consulta a autoridades comunitarias, devolucion de resultados a la comunidad.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-053',
  'poblaciones_vulnerables',
  'incapaces',
  'Para adultos sin capacidad de consentir, existen salvaguardas y autorizacion legal del representante con interes superior del participante.',
  'Procedimiento con criterios de incapacidad, designacion de representante legal, opcion de asentimiento residual.',
  '[{"ref":"RLGSMIS art. 34","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"Convenio Oviedo arts. 6-7","url":"https://rm.coe.int/168007cf98"},{"ref":"CIOMS 2016 Pauta 16","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Bioetica 2005 art. 7","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"UNESCO Genoma 1997 art. 5","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Aplica para personas con demencia, deterioro cognitivo, discapacidad intelectual. Verificar test estandarizado de capacidad y reevaluacion durante el estudio.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-054',
  'poblaciones_vulnerables',
  'no_concentracion',
  'El protocolo evita concentrar riesgos o cargas en grupos vulnerables sin justificacion cientifica.',
  'Distribucion equitativa demostrada en criterios de seleccion; muestreo no oportunista en poblaciones cautivas.',
  '[{"ref":"Belmont aplicacion 3","url":"https://www.hhs.gov/ohrp/sites/default/files/the-belmont-report-508c_FINAL.pdf"},{"ref":"CIOMS 2016 Pauta 3","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Bioetica 2005 art. 10","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Verifica que la seleccion no sea exclusivamente por conveniencia (pacientes del IP) o por vulnerabilidad. Senalar muestreo oportunista sin justificacion.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-055',
  'poblaciones_vulnerables',
  'equidad_genero',
  'Hay inclusion equitativa por genero; las mujeres no son excluidas sin justificacion cientifica explicita.',
  'Criterios de inclusion sin restriccion injustificada de genero; analisis estratificado por sexo cuando corresponda.',
  '[{"ref":"CIOMS 2016 Pauta 18","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"SECIHTI Convocatorias 2025/2026 - perspectiva de genero","url":"https://secihti.mx/"},{"ref":"UNESCO Bioetica 2005 art. 10-11","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  14,
  'Verifica que no haya exclusion de mujeres salvo justificacion clinica (ej. estudios de cancer prostatico). Espera analisis por sexo en protocolos clinicos.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-056',
  'poblaciones_vulnerables',
  'no_discriminacion',
  'El protocolo incluye salvaguardas anti-discriminacion (genetica, etnica, religiosa, orientacion sexual, discapacidad).',
  'Clausula expresa de no discriminacion; ausencia de criterios excluyentes injustificados.',
  '[{"ref":"Convenio Oviedo art. 11","url":"https://rm.coe.int/168007cf98"},{"ref":"UNESCO Bioetica 2005 art. 11","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"UNESCO Genoma 1997 art. 6","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"},{"ref":"UNESCO Datos Geneticos 2003 art. 7","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  19,
  'Buscar clausula explicita de no discriminacion. Especialmente critico en estudios geneticos donde resultados pueden estigmatizar.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-057',
  'confidencialidad_datos',
  'datos_sensibles',
  'Se identifican los datos personales sensibles tratados (salud, geneticos, biometricos, origen etnico, orientacion sexual).',
  'Listado de categorias de datos personales con clasificacion de sensibilidad conforme LGPDPPSO art. 3 frac. X.',
  '[{"ref":"LGPDPPSO art. 3 frac. X","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR art. 9","url":"https://gdpr-info.eu/art-9-gdpr/"},{"ref":"UNESCO Datos Geneticos 2003","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verifica listado explicito de categorias. Por defecto los datos de salud son sensibles. Si solo dice ''datos personales'' sin desglose, marcar incompleto.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-058',
  'confidencialidad_datos',
  'consentimiento_datos',
  'Existe consentimiento expreso y por escrito para tratamiento de datos personales sensibles, integrado o anexo a la CCI.',
  'Clausula de consentimiento de datos con base legal, finalidades, derechos ARCO.',
  '[{"ref":"LGPDPPSO art. 21","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR art. 9.2(a)","url":"https://gdpr-info.eu/art-9-gdpr/"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verificar consentimiento expreso (no presunto) para datos sensibles. Para investigacion bajo Art. 89 GDPR puede haber base legal alternativa.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-059',
  'confidencialidad_datos',
  'aviso_privacidad',
  'Se entrega Aviso de Privacidad simplificado e integral al participante con todos los elementos de LGPDPPSO arts. 26-29.',
  'Aviso simplificado en la CCI + aviso integral disponible (URL o anexo); incluye responsable, finalidad, derechos, transferencias.',
  '[{"ref":"LGPDPPSO arts. 26-29","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR arts. 13-14","url":"https://gdpr-info.eu/art-13-gdpr/"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verifica los 2 niveles: (1) simplificado en CCI, (2) integral disponible (URL/QR/anexo). Sin uno de los dos, marcar incompleto.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-060',
  'confidencialidad_datos',
  'medidas_seguridad',
  'Se describen medidas de seguridad tecnicas (cifrado, control de acceso, respaldo), fisicas (resguardo) y administrativas (politicas, capacitacion).',
  'Apartado ''Documento de seguridad'' o equivalente con las 3 categorias de medidas y responsables.',
  '[{"ref":"LGPDPPSO arts. 31-42","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR art. 32","url":"https://gdpr-info.eu/art-32-gdpr/"},{"ref":"ICH-GCP E6(R3) Principio 11","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verifica las 3 categorias: (1) tecnicas (cifrado AES-256, MFA, audit trail), (2) fisicas (acceso restringido), (3) administrativas (politicas, capacitacion anual).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-061',
  'confidencialidad_datos',
  'anonimizacion',
  'Se aplica disociacion, seudonimizacion o anonimizacion de datos cuando el diseno lo permite.',
  'Procedimiento con niveles de identificabilidad (identificable, codificado, seudonimizado, anonimo) y custodia de la clave.',
  '[{"ref":"LGPDPPSO arts. 3, 31","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR art. 32 (seudonimizacion)","url":"https://gdpr-info.eu/art-32-gdpr/"},{"ref":"CIOMS 2016 Pauta 12","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"UNESCO Datos Geneticos 2003 art. 14","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verifica que los datos para analisis esten seudonimizados. Identificar custodio de la lista de equivalencias y separar fisicamente del dataset.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-062',
  'confidencialidad_datos',
  'minimizacion',
  'Se aplica el principio de minimizacion: solo se recolectan los datos estrictamente necesarios para los objetivos del estudio.',
  'Justificacion explicita de cada variable recolectada vinculada a un objetivo.',
  '[{"ref":"GDPR art. 5.1(c)","url":"https://gdpr-info.eu/art-5-gdpr/"},{"ref":"LGPDPPSO art. 4-8 (proporcionalidad)","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Compara variables recolectadas vs. objetivos. Senalar variables sin uso aparente como recoleccion excesiva.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-063',
  'confidencialidad_datos',
  'transferencias',
  'Se describe el procedimiento para transferencias de datos (especialmente internacionales) con cobertura legal adecuada.',
  'Apartado de transferencias con destinatarios, base legal, garantias contractuales o decision de adecuacion.',
  '[{"ref":"LGPDPPSO arts. 65-69","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR arts. 44-49 transferencias","url":"https://gdpr-info.eu/chapter-5/"},{"ref":"UNESCO Datos Geneticos 2003 art. 21","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Aplica si hay transferencia a sponsor internacional, biobanco extranjero o repositorio externo. Verificar SCCs / Material Transfer Agreement firmado.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-064',
  'confidencialidad_datos',
  'derechos_arco',
  'Existe procedimiento documentado para que el participante ejerza derechos ARCO (Acceso, Rectificacion, Cancelacion, Oposicion) durante y despues del estudio.',
  'Apartado en aviso de privacidad con instrucciones, formato y plazo de respuesta a solicitudes ARCO.',
  '[{"ref":"LGPDPPSO arts. 46-55","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR arts. 15-22","url":"https://gdpr-info.eu/chapter-3/"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verifica que el aviso de privacidad describa: como solicitar, donde, plazo (20 dias habiles en Mexico), excepciones (Art. 89 GDPR equivalente).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-065',
  'confidencialidad_datos',
  'brechas',
  'Existe procedimiento de notificacion de brechas de seguridad / vulneraciones a los titulares y a la autoridad en el plazo legal.',
  'Procedimiento con plazos (72 hr en GDPR; ''sin demora'' en LGPDPPSO), responsables y plantilla de comunicacion.',
  '[{"ref":"LGPDPPSO arts. 43-45","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf"},{"ref":"GDPR arts. 33-34","url":"https://gdpr-info.eu/art-33-gdpr/"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Verifica plazo de 72 hrs y responsable. Sin procedimiento, marcar incumplimiento medio.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-066',
  'confidencialidad_datos',
  'dpia',
  'Cuando el tratamiento entrana alto riesgo (datos geneticos, large-scale, perfilado, vulnerables), se realiza una Evaluacion de Impacto en Proteccion de Datos (DPIA).',
  'Documento DPIA anexo con descripcion del tratamiento, evaluacion de necesidad, riesgos y medidas.',
  '[{"ref":"GDPR art. 35","url":"https://gdpr-info.eu/art-35-gdpr/"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":true}'::jsonb,
  25,
  'Aplica si: datos geneticos, biometricos, vigilancia masiva, perfilado, ninos. Si no hay DPIA y es uno de estos casos, marcar incumplimiento.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-067',
  'confidencialidad_datos',
  'expedientes',
  'Si el protocolo accede o genera expedientes clinicos, cumple con NOM-004-SSA3-2012 (autorizacion, secreto profesional, conservacion 5 anos).',
  'Apartado que mencione apego a NOM-004 y autorizacion de uso de expedientes por la institucion.',
  '[{"ref":"NOM-004-SSA3-2012","url":"https://dof.gob.mx/nota_detalle.php?codigo=5272787&fecha=15/10/2012"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  26,
  'Aplica si el protocolo accede a expedientes clinicos. Verificar autorizacion institucional y custodia conforme NOM-004.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-068',
  'confidencialidad_datos',
  'informacion_salud',
  'Si genera datos en salud, usa catalogos oficiales (CIE-10, CIE-9-MC procedimientos) y cumple interoperabilidad NOM-024 cuando aplica.',
  'Mencion explicita de uso de CIE-10 para diagnosticos; en sistemas de informacion, conformidad NOM-024.',
  '[{"ref":"NOM-035-SSA3-2012","url":"https://dof.gob.mx/nota_detalle.php?codigo=5280848&fecha=30/11/2012"},{"ref":"NOM-024-SSA3-2012","url":"https://dof.gob.mx/normasOficiales.php"}]'::jsonb,
  'media',
  2,
  '{"tipo_investigacion":["clinica","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  26,
  'Verifica menciones de CIE-10. Si registra eventos en sistemas electronicos, espera mencion de NOM-024.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-069',
  'confidencialidad_datos',
  'archivo',
  'Existe plan de archivo y conservacion del expediente de investigacion por al menos 5 anos despues de concluido el estudio.',
  'Apartado ''Custodia y conservacion'' con responsable, ubicacion, plazo (>=5 anos) y procedimiento de destruccion.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 11","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"NOM-004-SSA3-2012 Sec. 5.5","url":"https://dof.gob.mx/nota_detalle.php?codigo=5272787&fecha=15/10/2012"},{"ref":"ICH-GCP E6(R3) Sec. 7","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  26,
  'Verifica plazo >=5 anos (>=15 anos para ensayos clinicos con ICH-GCP). Identificar responsable y lugar fisico/digital.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-070',
  'confidencialidad_datos',
  'derecho_saber',
  'Se reconoce el derecho del participante a saber o no saber resultados (especialmente hallazgos incidentales geneticos).',
  'Clausula en CCI: opcion explicita opt-in / opt-out para recibir resultados individuales y hallazgos incidentales.',
  '[{"ref":"Convenio Oviedo art. 10","url":"https://rm.coe.int/168007cf98"},{"ref":"UNESCO Datos Geneticos 2003 art. 10","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"},{"ref":"UNESCO Genoma 1997 art. 5","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":true}'::jsonb,
  23,
  'Aplica especialmente para estudios geneticos. Verificar opciones explicitas: ''Si quiero recibir mis resultados / No quiero recibir mis resultados''.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-071',
  'productos_salud',
  'cofepris_farmacos',
  'Para investigacion con farmacos o biologicos, hay autorizacion COFEPRIS (homoclave 04-010-A) o tramite en curso.',
  'Numero de autorizacion COFEPRIS o acuse de DIGIPRiS adjunto.',
  '[{"ref":"RLGSMIS art. 65","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"},{"ref":"COFEPRIS Homoclave 04-010-A","url":"https://catalogonacional.gob.mx/FichaTramite?traHomoclave=COFEPRIS-04-010-A"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  27,
  'Aplica si hay farmaco/biologico (incluso uso fuera de etiqueta). Sin numero COFEPRIS, marcar critica no cumple.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-072',
  'productos_salud',
  'cofepris_dispositivos',
  'Para investigacion con dispositivos medicos, hay autorizacion COFEPRIS (homoclave 04-010-C).',
  'Numero de autorizacion COFEPRIS o acuse adjunto.',
  '[{"ref":"COFEPRIS Homoclave 04-010-C","url":"https://www.gob.mx/cofepris/acciones-y-programas/ensayos-clinicos-protocolos-de-investigacion-en-seres-humanos"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  27,
  'Aplica si hay dispositivo medico investigacional. Verificar tipo de dispositivo (Clase I-III) y si requiere registro previo.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-073',
  'productos_salud',
  'manual_investigador',
  'Existe Manual del Investigador (Investigator''s Brochure - IB) actualizado, vigente y disponible para el equipo.',
  'Documento IB con version, fecha (<=12 meses), datos preclinicos, clinicos y de seguridad.',
  '[{"ref":"NOM-012-SSA3-2012","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"ICH-GCP E6(R3) Sec. 6","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  27,
  'Aplica para farmacos/dispositivos. Verifica fecha del IB (<=12 meses). Sin IB vigente, no aprobar el protocolo.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-074',
  'productos_salud',
  'farmacovigilancia',
  'Existe plan de farmacovigilancia conforme NOM-220-SSA1-2016 con reporte CIOMS de eventos adversos serios.',
  'Procedimiento de farmacovigilancia con responsable, plazos, formatos CIOMS-I y destinatarios.',
  '[{"ref":"NOM-220-SSA1-2016","url":"https://dof.gob.mx/normasOficiales.php"},{"ref":"ICH-GCP E6(R3) Principio 4","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  27,
  'Aplica para farmacos. Verifica responsable de farmacovigilancia, plazos SUSAR (15 dias), reportes anuales DSUR.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-075',
  'productos_salud',
  'bpc',
  'El equipo investigador cuenta con certificacion vigente en Buenas Practicas Clinicas (ICH-GCP E6(R3)).',
  'Constancias BPC para IP y subinvestigadores con fecha <=3 anos; cursos certificados (CITI, GCP Mexico, etc.).',
  '[{"ref":"ICH-GCP E6(R3) Principio 9","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"COFEPRIS Modulo VI","url":"https://www.gob.mx/cofepris/articulos/guia-para-el-ingreso-de-protocolos-de-investigacion"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  2,
  'Cuenta cuantos miembros del equipo tienen BPC vigente. Senalar miembros sin certificacion en estudios clinicos con farmacos.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-076',
  'productos_salud',
  'seguro',
  'Existe poliza de seguro o mecanismo de responsabilidad civil para los participantes en investigacion con riesgo > minimo.',
  'Caratula de poliza vigente con cobertura y vigencia; o carta institucional con compromiso financiero respaldado.',
  '[{"ref":"COFEPRIS Modulo VIII","url":"https://www.gob.mx/cofepris/articulos/guia-para-el-ingreso-de-protocolos-de-investigacion"},{"ref":"ICH-GCP E6(R3) Sec. 4 Sponsor","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"CIOMS 2016 Pauta 14","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Helsinki 2024 §15","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  22,
  'Para riesgo > minimo verificar poliza vigente con cobertura clara. Para fases I-III obligatorio. Sin seguro en ensayos con farmaco, marcar critica no cumple.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-077',
  'productos_salud',
  'calidad_datos',
  'Los sistemas de captura/manejo de datos cumplen ALCOA+ (atribuibilidad, legibilidad, contemporaneidad, originalidad, exactitud, completitud).',
  'Descripcion de eCRF/CRDB con audit trail, control de versiones, validacion del sistema.',
  '[{"ref":"ICH-GCP E6(R3) Principio 11","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  16,
  'Verificar sistema validado (Part 11), audit trail, gestion de accesos, respaldos. Para estudios investigador-iniciado puede usar REDCap u otro sistema validado.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-078',
  'productos_salud',
  'placebo',
  'El uso de placebo (cuando aplica) esta eticamente justificado: no existe tratamiento estandar comprobado, o riesgo aceptable de no recibir tratamiento.',
  'Argumentacion explicita conforme Helsinki §33: ausencia de mejor intervencion probada o riesgo bajo de privacion temporal.',
  '[{"ref":"Helsinki 2024 §33","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 5","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  12,
  'Aplica si hay grupo placebo. Si existe tratamiento estandar y el placebo expone a dano grave/irreversible, rechazar diseno.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-079',
  'productos_salud',
  'atencion_medica',
  'La atencion medica al participante esta asegurada por medico calificado durante todo el estudio.',
  'Designacion de medico responsable de la atencion clinica con disponibilidad documentada (24/7 en estudios clinicos).',
  '[{"ref":"ICH-GCP E6(R3) Principio 8","url":"https://database.ich.org/sites/default/files/ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf"},{"ref":"RLGSMIS art. 14 frac. VI","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  22,
  'Verifica nombre y cedula del medico responsable y mecanismo de atencion fuera de horario habil.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-080',
  'gobernanza_cei',
  'registro_cei',
  'El CEI evaluador cuenta con registro vigente ante CONBIOETICA (renovacion cada 3 anos) y, si aplica, ante COFEPRIS.',
  'Numero de registro CONBIOETICA y vigencia.',
  '[{"ref":"Acuerdo CONBIOETICA Disp. 14a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"LGS art. 41 Bis (reforma 2026)","url":"https://www.gob.mx/cms/uploads/attachment/file/1048568/2026.1._Reforma_LGS.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Es auto-evaluacion del CEI. Verificar vigencia del registro CONBIOETICA al momento del dictamen.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-081',
  'gobernanza_cei',
  'composicion',
  'El CEI cumple con composicion minima: >=7 miembros titulares, multidisciplinarios, equilibrio de genero, lego comunitario, abogado, profesional con formacion en bioetica.',
  'Listado de miembros titulares y suplentes con perfil profesional y categoria.',
  '[{"ref":"Acuerdo CONBIOETICA Disp. 8a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"WHO Standards 2011 Estandar 2","url":"https://www.who.int/publications/i/item/9789241502948"},{"ref":"UNESCO Bioetica 2005 art. 19","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"UNESCO Genoma 1997 art. 16","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"},{"ref":"CIOMS 2016 Pauta 23","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion. Verificar: (1) >=7 titulares, (2) genero balanceado (40-60), (3) abogado, (4) lego comunitario, (5) bioeticista, (6) profesionales de la salud.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-082',
  'gobernanza_cei',
  'independencia',
  'El CEI demuestra independencia operativa y financiera respecto a la institucion y sus investigadores.',
  'Reglamento interno con autonomia, presupuesto propio o etiquetado, estructura sin conflicto.',
  '[{"ref":"WHO Standards 2011 Estandar 4","url":"https://www.who.int/publications/i/item/9789241502948"},{"ref":"CIOMS 2016 Pauta 23","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion. Verificar que el CEI tenga reglas claras de independencia y que sus decisiones no sean revocadas por la institucion.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-083',
  'gobernanza_cei',
  'poes',
  'El CEI cuenta con Procedimientos Operativos Estandar (POEs) escritos, vigentes y aplicados consistentemente.',
  'Manual de POEs con secciones para recepcion, evaluacion, dictamen, seguimiento, eventos adversos, enmiendas.',
  '[{"ref":"WHO Standards 2011 Estandar 6","url":"https://www.who.int/publications/i/item/9789241502948"},{"ref":"OPS PAHOERC SOPs","url":"https://iris.paho.org/handle/10665.2/49076"},{"ref":"Acuerdo CONBIOETICA Disp. 11a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion. Verificar version vigente, fecha de revision (<=2 anos), aplicacion documentada en actas.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-084',
  'gobernanza_cei',
  'conflicto_interes_cei',
  'Los miembros del CEI declaran conflictos de interes por escrito al inicio del cargo y por cada protocolo evaluado, con abstencion obligatoria cuando aplica.',
  'Formato de declaracion de conflicto de interes firmado por cada miembro al inicio y por protocolo; registro de abstenciones en actas.',
  '[{"ref":"Acuerdo CONBIOETICA Disp. 13a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"WHO Standards 2011 Estandar 8","url":"https://www.who.int/publications/i/item/9789241502948"},{"ref":"CIOMS 2016 Pauta 25","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion. Verificar formatos firmados y registro de abstenciones en cada acta. Sin formato firmado por protocolo, marcar incumplimiento.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-085',
  'gobernanza_cei',
  'quorum_decision',
  'Las decisiones del CEI se toman con quorum reglamentario (al menos mitad mas uno, incluyendo lego y no afiliado) por consenso o voto registrado.',
  'Acta con lista de asistencia, quorum verificado, modalidad de decision y resultado.',
  '[{"ref":"Acuerdo CONBIOETICA Disp. 11a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"WHO Standards 2011 Estandar 8","url":"https://www.who.int/publications/i/item/9789241502948"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion por sesion. Verificar quorum y presencia obligatoria de lego y no afiliado. Sin quorum, decisiones no son validas.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-086',
  'gobernanza_cei',
  'capacitacion_cei',
  'Cada miembro del CEI tiene capacitacion documentada (al menos un curso anual) en bioetica, etica de la investigacion o BPC.',
  'Constancias de cursos por miembro con fecha de los ultimos 12 meses.',
  '[{"ref":"Acuerdo CONBIOETICA Disp. 16a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"WHO Standards 2011 Estandar 5","url":"https://www.who.int/publications/i/item/9789241502948"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion. Verificar matriz de capacitacion del CEI con fechas de los ultimos 12 meses. Senalar miembros sin capacitacion vigente.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-087',
  'gobernanza_cei',
  'seguimiento',
  'Existe mecanismo de seguimiento continuo del protocolo: informes parciales/finales, enmiendas, reportes de eventos adversos y cierre.',
  'Cronograma de seguimiento con periodicidad (>=anual), formatos para enmiendas y reporte SAE.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 8 y 11","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Acuerdo CONBIOETICA Disp. 11a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"WHO Standards 2011 Estandar 10","url":"https://www.who.int/publications/i/item/9789241502948"},{"ref":"Helsinki 2024 §23","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Verifica que el dictamen incluya periodicidad de informes (al menos anual). Para riesgo mayor minimo, esperar seguimiento semestral.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-088',
  'gobernanza_cei',
  'comunicacion_decision',
  'El CEI comunica oportuna y motivadamente sus decisiones (aprobacion, modificacion, no aprobacion, suspension) por escrito al investigador.',
  'Plantilla de dictamen del CEI con tipo de decision, fundamento, recomendaciones y plazos.',
  '[{"ref":"WHO Standards 2011 Estandar 9","url":"https://www.who.int/publications/i/item/9789241502948"},{"ref":"Acuerdo CONBIOETICA Disp. 11a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Auto-evaluacion. Verificar plazo entre sesion y dictamen (<=15 dias habiles).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-089',
  'gobernanza_cei',
  'revision_transnacional',
  'Para investigacion transnacional/multinacional, hay revision etica en pais anfitrion (Mexico) y en pais de origen, con coordinacion documentada.',
  'Dictamenes de CEI extranjeros adjuntos y validacion local del CEI mexicano.',
  '[{"ref":"UNESCO Bioetica 2005 art. 21","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"CIOMS 2016 Pauta 8","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  1,
  'Aplica solo si hay sponsor/centros internacionales. Verificar al menos un dictamen extranjero en idioma original con traduccion.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-090',
  'gobernanza_cei',
  'emergencias',
  'Para investigacion en emergencias de salud publica, desastres o brotes, se mantienen los principios eticos y se siguen plantillas operativas (OPS/OMS).',
  'Apartado especifico con justificacion de emergencia, mecanismos acelerados sin sacrificar etica.',
  '[{"ref":"Helsinki 2024 §36","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 20","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"OPS Plantilla COVID-19","url":"https://iris.paho.org/handle/10665.2/52086"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  12,
  'Aplica si el contexto es pandemia/desastre. Verificar uso de plantillas OPS y mecanismos acelerados de revision (no eliminacion).'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-091',
  'transparencia_publicacion',
  'publicacion_honesta',
  'Existe compromiso de publicacion honesta de resultados (positivos, negativos o neutros) y rechazo a mala conducta cientifica.',
  'Clausula explicita en el protocolo de compromiso de publicar todos los resultados y declaracion de integridad.',
  '[{"ref":"Helsinki 2024 §3 y §35","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 24","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"SECIHTI Reglamento SNII 2025 - integridad","url":"https://secihti.mx/wp-content/uploads/2025/12/REGLAMENTO_SNII_2025.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  28,
  'Buscar parrafo de compromiso. Verificar que mencione publicacion independientemente del resultado.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-092',
  'transparencia_publicacion',
  'acceso_abierto',
  'Cuando hay financiamiento publico, se contempla publicacion en acceso abierto y deposito en Repositorio Nacional / institucional.',
  'Plan de difusion con publicaciones en acceso abierto y mencion del Repositorio Nacional SECIHTI.',
  '[{"ref":"SECIHTI - acceso abierto","url":"https://secihti.mx/"},{"ref":"Helsinki 2024 §35","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  28,
  'Aplica si recibe fondos SECIHTI o publicos. Verificar plan FAIR y deposito en Repositorio Nacional.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-093',
  'transparencia_publicacion',
  'acceso_post_ensayo',
  'Existe plan de acceso post-ensayo a las intervenciones identificadas como beneficiosas y razonablemente seguras.',
  'Apartado ''Acceso post-ensayo'' que describa como los participantes accederan a la intervencion exitosa al concluir el estudio.',
  '[{"ref":"Helsinki 2024 §34","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 2 y 6","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"}]'::jsonb,
  'alta',
  4,
  '{"tipo_investigacion":["clinica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  22,
  'Aplica para ensayos terapeuticos. Excepciones requieren aprobacion explicita del CEI con justificacion.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-094',
  'transparencia_publicacion',
  'compromiso_comunitario',
  'Existe estrategia de compromiso comunitario significativo antes, durante y despues del estudio (consulta, devolucion de resultados).',
  'Plan de involucramiento comunitario con actividades, audiencias y mecanismos de devolucion.',
  '[{"ref":"Helsinki 2024 §6","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"CIOMS 2016 Pauta 7","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"OPS Preguntas Guia 8","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'media',
  3,
  '{"tipo_investigacion":["clinica","epidemiologica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Espera plan con 3 momentos (antes/durante/despues). Especialmente exigente para estudios en comunidades especificas.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-095',
  'transparencia_publicacion',
  'datos_digitales',
  'Para investigacion con datos digitales (redes sociales, mHealth, wearables), hay salvaguardas especificas de privacidad y consentimiento.',
  'Apartado ''Datos digitales'' con tipos de datos, plataformas, terminos de servicio respetados, consentimiento especifico.',
  '[{"ref":"CIOMS 2016 Pauta 22","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"GDPR art. 35 DPIA","url":"https://gdpr-info.eu/art-35-gdpr/"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["epidemiologica","aplicada","basica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  25,
  'Aplica para estudios con apps moviles, wearables, scraping de redes sociales. Verificar consentimiento de la plataforma y de los usuarios.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-096',
  'aspectos_economicos',
  'financiamiento',
  'El protocolo declara fuentes de financiamiento y presupuesto desagregado (personal, materiales, indirectos).',
  'Tabla de presupuesto con fuentes (institucional, SECIHTI, sponsor) y rubros desglosados.',
  '[{"ref":"NOM-012-SSA3-2012 Sec. 6.2.11","url":"https://dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013"},{"ref":"Helsinki 2024 §26","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"SECIHTI Convocatorias","url":"https://secihti.mx/"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  18,
  'Verifica que el presupuesto este detallado por rubro y que las fuentes esten claras. Sin patrocinador, justificar autofinanciamiento.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-097',
  'aspectos_economicos',
  'conflicto_interes',
  'El IP, equipo, patrocinador y cada miembro del CEI declaran exhaustivamente conflictos de interes (financieros, academicos, personales) y mecanismos de mitigacion.',
  'Formato de declaracion de conflictos de interes firmado por cada involucrado, con mitigacion cuando aplica.',
  '[{"ref":"CONBIOETICA Disp. 13a","url":"https://www.dof.gob.mx/nota_detalle.php?codigo=5276107&fecha=31/10/2012"},{"ref":"SECIHTI - integridad","url":"https://secihti.mx/wp-content/uploads/2025/12/REGLAMENTO_SNII_2025.pdf"},{"ref":"CIOMS 2016 Pauta 25","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"Helsinki 2024 §26","url":"https://www.wma.net/policies-post/wma-declaration-of-helsinki/"},{"ref":"OPS Preguntas Guia 9","url":"https://iris.paho.org/handle/10665.2/67780"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":"cualquiera","involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  19,
  'Verifica formato firmado por cada miembro del equipo y por miembros del CEI que evaluaron. Si hay conflicto, debe haber mitigacion explicita.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-098',
  'aspectos_economicos',
  'compensacion',
  'El reembolso de gastos y la compensacion por tiempo a participantes son razonables, no coercitivos y proporcionales.',
  'Apartado ''Compensacion'' con monto, justificacion (tiempo, transporte, comidas) y forma de entrega.',
  '[{"ref":"CIOMS 2016 Pauta 13","url":"https://cioms.ch/wp-content/uploads/2017/01/WEB-CIOMS-EthicalGuidelines.pdf"},{"ref":"RLGSMIS art. 21 frac. XI","url":"https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf"}]'::jsonb,
  'alta',
  3,
  '{"tipo_investigacion":["clinica","basica","aplicada","epidemiologica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  23,
  'Verifica que el monto sea razonable: cubrir gastos no es coercitivo; pago alto que distorsione la decision SI lo es. Para vulnerables ser muy estricto.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-099',
  'aspectos_economicos',
  'beneficios_compartidos',
  'Cuando aplica, hay plan de aprovechamiento compartido de beneficios con participantes, comunidades y/o sociedad.',
  'Apartado de beneficios compartidos, especialmente en investigacion genetica o con comunidades.',
  '[{"ref":"UNESCO Bioetica 2005 art. 15","url":"https://unesdoc.unesco.org/ark:/48223/pf0000146180"},{"ref":"UNESCO Datos Geneticos 2003 art. 19","url":"https://unesdoc.unesco.org/ark:/48223/pf0000136112"}]'::jsonb,
  'media',
  2,
  '{"tipo_investigacion":["clinica","basica","aplicada"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":"cualquiera"}'::jsonb,
  24,
  'Especialmente exigente en investigacion genetica con poblaciones especificas, recursos biologicos o conocimiento tradicional.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  'CHK-100',
  'riesgo_beneficio',
  'prohibiciones_absolutas',
  'El protocolo respeta prohibiciones absolutas: no creacion de embriones para investigacion, no clonacion reproductiva, no modificacion germinal con efecto en descendencia, no lucro con cuerpo humano.',
  'El protocolo no contempla ninguna de las practicas prohibidas; cuando hay duda, declaracion expresa de cumplimiento.',
  '[{"ref":"Convenio Oviedo arts. 18, 21","url":"https://rm.coe.int/168007cf98"},{"ref":"UNESCO Genoma 1997 art. 11","url":"https://unesdoc.unesco.org/ark:/48223/pf0000122990"},{"ref":"LGS art. 100","url":"https://www.diputados.gob.mx/LeyesBiblio/pdf_mov/Ley_General_de_Salud.pdf"}]'::jsonb,
  'critica',
  5,
  '{"tipo_investigacion":["clinica","basica"],"involucra_humanos":true,"involucra_menores":"cualquiera","involucra_datos_geneticos":true}'::jsonb,
  19,
  'Verificar ausencia de procedimientos prohibidos. En investigacion con CRISPR, embriones, celulas germinales o tejidos humanos comerciales, escrutinio maximo.'
) on conflict (id) do update set
  categoria = excluded.categoria,
  subcategoria = excluded.subcategoria,
  criterio = excluded.criterio,
  evidencia_esperada = excluded.evidencia_esperada,
  fuentes = excluded.fuentes,
  severidad = excluded.severidad,
  peso = excluded.peso,
  aplicabilidad = excluded.aplicabilidad,
  seccion_protocolo = excluded.seccion_protocolo,
  ai_prompt_hint = excluded.ai_prompt_hint;

commit;

-- ✅ 100 ítems insertados/actualizados.

-- =============================================================
-- migrations/006_protocolos.sql
-- =============================================================
-- =============================================================
-- 006_protocolos.sql — Protocolos, co-investigadores, documentos, eventos
-- =============================================================

create table protocolos (
  id uuid primary key default gen_random_uuid(),
  numero_consecutivo serial not null,
  clave text,                                                -- relleno por trigger (ver 009_triggers.sql)
  titulo text not null,
  resumen text,
  investigador_principal_id uuid not null references usuarios(id),
  area_conocimiento_id smallint references areas_conocimiento(id),
  tipo_investigacion_id text references tipos_investigacion(id),
  clasificacion_riesgo clasificacion_riesgo,
  involucra_humanos boolean default true,
  involucra_menores boolean default false,
  involucra_datos_geneticos boolean default false,
  involucra_medicamento boolean default false,
  estado estado_protocolo not null default 'borrador',
  numero_oficio text unique,
  vigencia_dictamen_meses smallint default 12,
  fecha_aprobacion date,
  fecha_vencimiento date,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  dictaminado_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_protocolos_ip on protocolos(investigador_principal_id);
create index idx_protocolos_estado on protocolos(estado);
create index idx_protocolos_numero_oficio on protocolos(numero_oficio);

create table protocolo_co_investigadores (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  nombre text not null,
  apellido_paterno text not null,
  apellido_materno text,
  adscripcion text,
  email text,
  orden smallint not null,
  created_at timestamptz not null default now()
);

create index idx_co_inv_protocolo on protocolo_co_investigadores(protocolo_id);

create table protocolo_documentos (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  tipo_documento_id text not null references tipos_documento(id),
  nombre_original text not null,
  storage_path text not null,
  mime_type text not null,
  tamano_bytes bigint not null,
  hash_sha256 text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references usuarios(id)
);

create index idx_docs_protocolo on protocolo_documentos(protocolo_id);

create table protocolo_eventos (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  tipo text not null,
  descripcion text,
  actor_id uuid references usuarios(id),
  datos jsonb,
  created_at timestamptz not null default now()
);

create index idx_eventos_protocolo on protocolo_eventos(protocolo_id);
create index idx_eventos_tipo on protocolo_eventos(tipo);


-- =============================================================
-- migrations/007_evaluacion.sql
-- =============================================================
-- =============================================================
-- 007_evaluacion.sql — Pre-informes IA, evaluaciones, votos por sección
-- =============================================================

create table pre_informes (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  version smallint not null default 1,
  generado_at timestamptz not null default now(),
  generado_por text not null default 'cowork_scheduled_task',
  modelo_usado text,
  contenido jsonb not null,
  resumen_ejecutivo text not null,
  cumple_global boolean not null,
  total_items_evaluados smallint not null,
  items_cumple smallint not null,
  items_no_cumple smallint not null,
  items_parcial smallint not null,
  items_no_aplica smallint not null,
  observaciones_criticas text[],
  sugerencias text[],
  duracion_segundos integer,
  unique (protocolo_id, version)
);

create index idx_preinforme_protocolo on pre_informes(protocolo_id);

create table evaluaciones (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  miembro_id uuid not null references usuarios(id),
  voto_global tipo_voto not null,
  comentario_global text,
  conflicto_interes boolean not null default false,
  motivo_abstencion text,
  votado_at timestamptz not null default now(),
  inmutable boolean not null default true,
  unique (protocolo_id, miembro_id)
);

create index idx_eval_protocolo on evaluaciones(protocolo_id);
create index idx_eval_miembro on evaluaciones(miembro_id);

create table evaluaciones_secciones (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references evaluaciones(id) on delete cascade,
  checklist_item_id text references checklist_items(id),
  resultado resultado_cumplimiento not null,
  comentario text,
  created_at timestamptz not null default now(),
  unique (evaluacion_id, checklist_item_id)
);

create index idx_eval_sec_eval on evaluaciones_secciones(evaluacion_id);


-- =============================================================
-- migrations/008_actas.sql
-- =============================================================
-- =============================================================
-- 008_actas.sql — Actas oficiales generadas por el Presidente
-- =============================================================

create table actas (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null unique references protocolos(id),
  numero_oficio text not null unique,
  fecha_emision date not null default current_date,
  presidente_id uuid not null references usuarios(id),
  resolucion text not null check (resolucion in ('aprobado', 'aprobado_con_observaciones', 'no_aprobado')),
  vigencia_meses smallint not null default 12,
  fecha_vencimiento date,
  votos_favor smallint not null,
  votos_contra smallint not null,
  votos_abstencion smallint not null,
  observaciones text,
  marco_normativo jsonb not null,
  hash_folio text not null,
  url_validacion text,
  docx_storage_path text,
  pdf_storage_path text,
  enviada_a_investigador_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_actas_numero on actas(numero_oficio);
create index idx_actas_fecha on actas(fecha_emision);


-- =============================================================
-- migrations/009_triggers.sql
-- =============================================================
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


-- =============================================================
-- migrations/010_rls.sql
-- =============================================================
-- =============================================================
-- 010_rls.sql — Row Level Security policies
-- =============================================================

-- Helper: roles del usuario actual
create or replace function current_user_roles() returns rol_sistema[]
language sql security definer set search_path = public as $$
  select coalesce(array_agg(rol), '{}') from usuario_roles where usuario_id = auth.uid();
$$;

-- Helper: ¿es del comité (incluye presidente)?
create or replace function is_comite_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from usuario_roles
    where usuario_id = auth.uid()
    and rol in ('comite_vocal', 'comite_secretario', 'presidente', 'admin_sistema')
  );
$$;

-- ===================
-- usuarios
-- ===================
alter table usuarios enable row level security;

create policy ver_propio_perfil on usuarios
  for select using (id = auth.uid() or is_comite_member());

create policy editar_propio_perfil on usuarios
  for update using (id = auth.uid());

-- inserción la maneja el flujo de signup vía service role

-- ===================
-- protocolos
-- ===================
alter table protocolos enable row level security;

create policy ver_protocolos on protocolos
  for select using (
    investigador_principal_id = auth.uid()
    or is_comite_member()
  );

create policy crear_protocolo on protocolos
  for insert with check (investigador_principal_id = auth.uid());

create policy editar_borrador_propio on protocolos
  for update using (
    investigador_principal_id = auth.uid()
    and estado in ('borrador', 'observaciones')
  );

-- ===================
-- protocolo_co_investigadores
-- ===================
alter table protocolo_co_investigadores enable row level security;

create policy ver_co_inv on protocolo_co_investigadores
  for select using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and (p.investigador_principal_id = auth.uid() or is_comite_member())
    )
  );

create policy modificar_co_inv on protocolo_co_investigadores
  for all using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and p.investigador_principal_id = auth.uid()
      and p.estado in ('borrador', 'observaciones')
    )
  );

-- ===================
-- protocolo_documentos
-- ===================
alter table protocolo_documentos enable row level security;

create policy ver_documentos on protocolo_documentos
  for select using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and (p.investigador_principal_id = auth.uid() or is_comite_member())
    )
  );

create policy subir_documentos on protocolo_documentos
  for insert with check (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and p.investigador_principal_id = auth.uid()
      and p.estado in ('borrador', 'observaciones')
    )
  );

-- ===================
-- pre_informes
-- ===================
alter table pre_informes enable row level security;

create policy ver_preinforme on pre_informes
  for select using (
    exists (
      select 1 from protocolos p
      where p.id = protocolo_id
      and (p.investigador_principal_id = auth.uid() or is_comite_member())
    )
  );

-- inserción la maneja el scheduled task con service role

-- ===================
-- evaluaciones
-- ===================
alter table evaluaciones enable row level security;

create policy ver_evaluaciones on evaluaciones
  for select using (
    miembro_id = auth.uid()
    or is_comite_member()
  );

create policy votar_protocolo on evaluaciones
  for insert with check (
    miembro_id = auth.uid()
    and is_comite_member()
  );

-- ===================
-- evaluaciones_secciones
-- ===================
alter table evaluaciones_secciones enable row level security;

create policy ver_eval_sec on evaluaciones_secciones
  for select using (
    exists (
      select 1 from evaluaciones e
      where e.id = evaluacion_id
      and (e.miembro_id = auth.uid() or is_comite_member())
    )
  );

create policy crear_eval_sec on evaluaciones_secciones
  for insert with check (
    exists (
      select 1 from evaluaciones e
      where e.id = evaluacion_id
      and e.miembro_id = auth.uid()
    )
  );

-- ===================
-- actas
-- ===================
alter table actas enable row level security;

create policy ver_actas on actas
  for select using (
    is_comite_member()
    or exists (
      select 1 from protocolos p
      where p.id = protocolo_id and p.investigador_principal_id = auth.uid()
    )
  );

create policy crear_acta on actas
  for insert with check ('presidente' = any(current_user_roles()));

-- ===================
-- protocolo_eventos
-- ===================
alter table protocolo_eventos enable row level security;

create policy ver_eventos on protocolo_eventos
  for select using (
    is_comite_member()
    or exists (
      select 1 from protocolos p
      where p.id = protocolo_id and p.investigador_principal_id = auth.uid()
    )
  );

-- ===================
-- usuario_roles (solo admin)
-- ===================
alter table usuario_roles enable row level security;

create policy ver_roles_propios on usuario_roles
  for select using (usuario_id = auth.uid() or 'admin_sistema' = any(current_user_roles()));


-- =============================================================
-- migrations/011_vistas_funciones.sql
-- =============================================================
-- =============================================================
-- 011_vistas_funciones.sql — Vistas y funciones de negocio
-- =============================================================

-- Vista: estado de votación por protocolo (dashboard del Presidente)
create or replace view v_estado_votacion as
select
  p.id as protocolo_id,
  p.clave,
  p.titulo,
  p.estado,
  p.submitted_at,
  count(e.*) as total_votos,
  count(*) filter (where e.voto_global = 'aprobar') as votos_favor,
  count(*) filter (where e.voto_global = 'no_aprobar') as votos_contra,
  count(*) filter (where e.voto_global = 'abstener') as votos_abstencion,
  count(*) filter (where e.conflicto_interes) as abstenciones_por_conflicto,
  case
    when count(*) filter (where e.voto_global = 'aprobar') >= 4 then 'listo_dictamen'
    when count(e.*) >= 5 and count(*) filter (where e.voto_global = 'aprobar') < 4 then 'no_alcanza_mayoria'
    else 'en_progreso'
  end as situacion
from protocolos p
left join evaluaciones e on e.protocolo_id = p.id
where p.estado in ('en_revision_comite', 'listo_dictamen')
group by p.id;

-- Función: detectar conflicto de interés
create or replace function detectar_conflicto_interes(
  p_miembro_id uuid,
  p_protocolo_id uuid
) returns boolean
language sql stable as $$
  select exists (
    select 1 from protocolos
    where id = p_protocolo_id and investigador_principal_id = p_miembro_id
    union
    select 1 from protocolo_co_investigadores ci
    join usuarios u on u.id = p_miembro_id
    where ci.protocolo_id = p_protocolo_id and lower(ci.email) = lower(u.email)
  );
$$;

-- Función: siguiente número de oficio
create or replace function siguiente_numero_oficio() returns text
language plpgsql as $$
declare
  v_anio int := extract(year from current_date)::int;
  v_consec int;
begin
  select coalesce(max(
    cast(split_part(numero_oficio, '/', 3) as int)
  ), 0) + 1
  into v_consec
  from actas
  where numero_oficio like 'CEICS-CUTLAJO/' || v_anio || '/%';

  return format('CEICS-CUTLAJO/%s/%s', v_anio, lpad(v_consec::text, 3, '0'));
end $$;

-- Vista: protocolos pendientes para evaluación IA
create or replace view v_protocolos_pendientes_ia as
select
  p.id, p.clave, p.titulo, p.submitted_at,
  count(d.*) as total_documentos
from protocolos p
left join protocolo_documentos d on d.protocolo_id = p.id
where p.estado = 'en_evaluacion_ia'
group by p.id;

-- Vista: bandeja del comité (protocolos pendientes de votar para un miembro)
create or replace function bandeja_miembro(p_miembro_id uuid)
returns table (
  protocolo_id uuid,
  clave text,
  titulo text,
  submitted_at timestamptz,
  total_votos_recibidos bigint,
  ya_voto boolean,
  conflicto_interes boolean
) language sql stable as $$
  select
    p.id,
    p.clave,
    p.titulo,
    p.submitted_at,
    (select count(*) from evaluaciones e where e.protocolo_id = p.id),
    exists(select 1 from evaluaciones e where e.protocolo_id = p.id and e.miembro_id = p_miembro_id),
    detectar_conflicto_interes(p_miembro_id, p.id)
  from protocolos p
  where p.estado in ('en_revision_comite', 'listo_dictamen')
  order by p.submitted_at asc;
$$;


-- =============================================================
-- migrations/012_seed_comite.sql
-- =============================================================
-- =============================================================
-- 012_seed_comite.sql — Seed inicial del comité CEICS
--
-- IMPORTANTE: Estos usuarios deben existir PRIMERO en auth.users
-- (creados vía Supabase Auth o vía script con service role).
-- Este seed solo crea el perfil en la tabla `usuarios` y asigna roles.
-- =============================================================

-- Insertar perfiles de los 7 miembros oficiales del CEICS
-- Si ya existen (idempotente), actualizar cargo y división
insert into usuarios (
  email, nombre, apellido_paterno, apellido_materno,
  codigo_udg, division, departamento, activo, email_verificado
) values
  ('jaime.briseno@academicos.udg.mx',     'Jaime',          'Briseño',     'Ramírez',  '2957686', 'Salud', 'CEICS', true, true),
  ('judith.dearcos@academicos.udg.mx',    'Judith Carolina','De Arcos',    'Jiménez',  '2967536', 'Salud', 'CEICS', true, true),
  ('oscar.fernandezdiaz@academicos.udg.mx','Oscar Francisco','Fernández',  'Díaz',     '2963130', 'Salud', 'CEICS', true, true),
  ('cecilia.mendez@academicos.udg.mx',    'Ana Cecilia',    'Méndez',      'Magaña',   '2953815', 'Salud', 'CEICS', true, true),
  ('ruth.rodriguez@academicos.udg.mx',    'Ruth',           'Rodríguez',   'Montaño',  '2949191', 'Salud', 'CEICS', true, true),
  ('anayeli.patino@academicos.udg.mx',    'Anayeli de Jesús','Patiño',     'Laguna',   '2969114', 'Salud', 'CEICS', true, true),
  ('nancye.navarro@academicos.udg.mx',    'Nancy Evelyn',   'Navarro',     'Ruiz',     '2951423', 'Salud', 'CEICS', true, true)
on conflict (email) do update set
  division = excluded.division,
  departamento = excluded.departamento,
  activo = true;

-- Asignar roles del comité
with miembros as (
  select id, email from usuarios where email like '%@academicos.udg.mx' and division = 'Salud'
)
insert into usuario_roles (usuario_id, rol)
select id, 'presidente'::rol_sistema        from miembros where email = 'jaime.briseno@academicos.udg.mx'
union all
select id, 'comite_secretario'::rol_sistema from miembros where email = 'anayeli.patino@academicos.udg.mx'
union all
select id, 'comite_vocal'::rol_sistema      from miembros where email in (
  'oscar.fernandezdiaz@academicos.udg.mx',
  'cecilia.mendez@academicos.udg.mx',
  'ruth.rodriguez@academicos.udg.mx',
  'judith.dearcos@academicos.udg.mx',
  'nancye.navarro@academicos.udg.mx'
)
on conflict (usuario_id, rol) do nothing;

-- Todos los miembros del comité también pueden actuar como investigadores (rol dual)
with miembros as (
  select id from usuarios where division = 'Salud' and departamento = 'CEICS'
)
insert into usuario_roles (usuario_id, rol)
select id, 'investigador'::rol_sistema from miembros
on conflict (usuario_id, rol) do nothing;


-- =============================================================
-- migrations/013_grants.sql
-- =============================================================
-- =============================================================
-- 013_grants.sql — Restaurar grants estándar de Supabase
--
-- Cuando se hace `drop schema public cascade` para limpiar la DB,
-- se pierden los GRANTs que Supabase otorga por default a los roles
-- anon, authenticated y service_role.
--
-- Esta migración los restaura. Sin estos grants:
-- - El service_role no puede insertar (falla el signup)
-- - Los usuarios autenticados no pueden leer sus propios protocolos
-- - Las funciones SECURITY DEFINER no pueden ejecutarse
-- =============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Asegurar que objetos creados a futuro hereden los grants
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;


-- =============================================================
-- ✅ INSTALACIÓN COMPLETA
-- =============================================================
