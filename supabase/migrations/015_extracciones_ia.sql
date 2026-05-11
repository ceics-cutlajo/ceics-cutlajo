-- =============================================================
-- 015_extracciones_ia.sql — Soporte para extracción IA de protocolos
-- =============================================================
--
-- Cambios:
--   1. Tabla extracciones_ia: guarda texto plano + JSON estructurado por IA
--      con metadata de modelo, tokens, confianza, fragmentos-fuente.
--   2. Columnas nuevas en protocolos: esperando_extraccion (bool),
--      extraccion_id (fk a extracciones_ia).
--   3. 6 campos clínicos nuevos en protocolos: objetivo_general,
--      objetivos_especificos, criterios_inclusion, criterios_exclusion,
--      metodologia, cronograma. Estos pueden venir de la IA o capturarse manual.

-- ===================
-- estado_extraccion enum
-- ===================
create type estado_extraccion as enum (
  'pendiente',       -- texto extraído, esperando que la IA lo procese
  'procesando',      -- la IA está trabajando en este protocolo
  'completado',      -- JSON estructurado listo
  'error'            -- falló la extracción
);

-- ===================
-- tabla extracciones_ia
-- ===================
create table extracciones_ia (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  documento_id uuid references protocolo_documentos(id) on delete set null,

  -- Texto plano extraído del .docx/.pdf (input para la IA)
  texto_fuente text,
  texto_caracteres int generated always as (length(texto_fuente)) stored,

  -- Resultado estructurado de la IA (output)
  resultado_json jsonb,
  -- Forma esperada de resultado_json:
  -- {
  --   "campos": {
  --     "titulo": { "valor": "...", "confianza": "alta", "fuente": "...párrafo del docx..." },
  --     "resumen": { "valor": "...", "confianza": "media", "fuente": "..." },
  --     "area_conocimiento_id": { "valor": 3, "confianza": "alta", "fuente": "..." },
  --     "objetivos_especificos": { "valor": ["...","..."], "confianza": "alta", "fuente": "..." },
  --     ...
  --   },
  --   "alertas": ["El documento no incluye cronograma explícito", "..."],
  --   "tokens_input": 12345,
  --   "tokens_output": 678
  -- }

  estado estado_extraccion not null default 'pendiente',
  modelo text,                                                -- ej: 'claude-sonnet-4-6'
  error_mensaje text,
  intentos smallint not null default 0,

  created_at timestamptz not null default now(),
  procesando_desde timestamptz,
  completed_at timestamptz
);

create index idx_extracciones_protocolo on extracciones_ia(protocolo_id);
create index idx_extracciones_estado on extracciones_ia(estado);
create index idx_extracciones_pendientes
  on extracciones_ia(created_at)
  where estado in ('pendiente', 'procesando');

-- ===================
-- columnas nuevas en protocolos
-- ===================
alter table protocolos
  add column esperando_extraccion boolean not null default false,
  add column extraccion_id uuid references extracciones_ia(id) on delete set null;

-- 6 campos clínicos que la IA puede pre-llenar
alter table protocolos
  add column objetivo_general text,
  add column objetivos_especificos jsonb default '[]'::jsonb,
  add column criterios_inclusion jsonb default '[]'::jsonb,
  add column criterios_exclusion jsonb default '[]'::jsonb,
  add column metodologia text,
  add column cronograma jsonb default '[]'::jsonb;

-- ===================
-- RLS
-- ===================
alter table extracciones_ia enable row level security;

-- Investigador dueño del protocolo lee sus propias extracciones
create policy ver_extraccion_propia on extracciones_ia
  for select using (
    exists (
      select 1 from protocolos p
      join usuarios u on u.id = p.investigador_principal_id
      where p.id = protocolo_id
      and u.email = (select email from auth.users where id = auth.uid())
    )
    or is_comite_member()
  );

-- Las escrituras las hace el Scheduled Task con service_role; no exponemos insert/update vía RLS.

-- ===================
-- Trigger: cuando extraccion se completa, copiar campos a protocolos
-- ===================
create or replace function aplicar_extraccion_ia()
returns trigger language plpgsql as $$
declare
  campos jsonb;
  valor_titulo text;
  valor_resumen text;
  valor_area int;
  valor_tipo text;
  valor_riesgo text;
  valor_involucra_humanos boolean;
  valor_involucra_menores boolean;
  valor_involucra_geneticos boolean;
  valor_involucra_medicamento boolean;
begin
  -- Solo cuando el estado cambia a 'completado'
  if old.estado <> new.estado and new.estado = 'completado' then
    campos := new.resultado_json -> 'campos';
    if campos is null then
      return new;
    end if;

    -- Extraer valores con conversión segura
    valor_titulo := campos -> 'titulo' ->> 'valor';
    valor_resumen := campos -> 'resumen' ->> 'valor';
    valor_area := (campos -> 'area_conocimiento_id' ->> 'valor')::int;
    valor_tipo := campos -> 'tipo_investigacion_id' ->> 'valor';
    valor_riesgo := campos -> 'clasificacion_riesgo' ->> 'valor';
    valor_involucra_humanos := (campos -> 'involucra_humanos' ->> 'valor')::boolean;
    valor_involucra_menores := (campos -> 'involucra_menores' ->> 'valor')::boolean;
    valor_involucra_geneticos := (campos -> 'involucra_datos_geneticos' ->> 'valor')::boolean;
    valor_involucra_medicamento := (campos -> 'involucra_medicamento' ->> 'valor')::boolean;

    update protocolos set
      titulo = coalesce(valor_titulo, titulo),
      resumen = coalesce(valor_resumen, resumen),
      area_conocimiento_id = coalesce(valor_area, area_conocimiento_id),
      tipo_investigacion_id = coalesce(valor_tipo, tipo_investigacion_id),
      clasificacion_riesgo = coalesce(valor_riesgo::clasificacion_riesgo, clasificacion_riesgo),
      involucra_humanos = coalesce(valor_involucra_humanos, involucra_humanos),
      involucra_menores = coalesce(valor_involucra_menores, involucra_menores),
      involucra_datos_geneticos = coalesce(valor_involucra_geneticos, involucra_datos_geneticos),
      involucra_medicamento = coalesce(valor_involucra_medicamento, involucra_medicamento),
      objetivo_general = coalesce(campos -> 'objetivo_general' ->> 'valor', objetivo_general),
      objetivos_especificos = coalesce(campos -> 'objetivos_especificos' -> 'valor', objetivos_especificos),
      criterios_inclusion = coalesce(campos -> 'criterios_inclusion' -> 'valor', criterios_inclusion),
      criterios_exclusion = coalesce(campos -> 'criterios_exclusion' -> 'valor', criterios_exclusion),
      metodologia = coalesce(campos -> 'metodologia' ->> 'valor', metodologia),
      cronograma = coalesce(campos -> 'cronograma' -> 'valor', cronograma),
      esperando_extraccion = false,
      extraccion_id = new.id
    where id = new.protocolo_id
    -- Solo aplicar si el protocolo sigue en borrador (no sobreescribir si ya fue enviado)
    and estado in ('borrador', 'observaciones');

    -- Registrar evento
    insert into protocolo_eventos (protocolo_id, tipo, descripcion, datos)
    values (
      new.protocolo_id,
      'extraccion_ia_aplicada',
      'IA extrajo campos del protocolo y los aplicó al borrador',
      jsonb_build_object(
        'extraccion_id', new.id,
        'modelo', new.modelo,
        'alertas', new.resultado_json -> 'alertas'
      )
    );
  end if;
  return new;
end $$;

create trigger trg_aplicar_extraccion
  after update on extracciones_ia
  for each row execute function aplicar_extraccion_ia();
