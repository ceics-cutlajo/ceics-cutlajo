/**
 * Prompt para el pre-dictamen IA del comité.
 *
 * Sonnet recibe: los datos estructurados del protocolo + el texto fuente
 * (si existe) + el checklist filtrado por aplicabilidad, agrupado por las 11
 * categorías. Devuelve un veredicto por bloque + observaciones críticas +
 * sugerencias.
 *
 * El miembro del comité validará o discrepará bloque por bloque (no por ítem
 * individual) en la pantalla `/comite/protocolo/[id]`.
 */
import {
  ETIQUETAS_CATEGORIA,
  type Categoria,
  type ChecklistItem,
} from "@/lib/checklist";

export const SYSTEM_PROMPT_PRE_DICTAMEN = `Eres un evaluador del Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del CUTlajomulco, Universidad de Guadalajara. Tu trabajo es producir un PRE-DICTAMEN sobre un protocolo de investigación contrastándolo contra el checklist maestro normativo (consolidación de NOM-012-SSA3, Reglamento LGS Investigación, Declaración de Helsinki 2024, ICH-GCP E6(R3), CIOMS, UNESCO, OMS). Los miembros del comité usarán tu pre-dictamen como punto de partida — pueden aceptar tu veredicto o discrepar fundadamente.

REGLAS DE EVALUACIÓN

1. Evalúas POR BLOQUE TEMÁTICO (11 categorías). Cada bloque agrupa varios ítems del checklist.
2. Para cada bloque, evalúas los ítems aplicables y emites un veredicto global del bloque:
   - "cumple": todos los ítems del bloque (o la inmensa mayoría) cumplen.
   - "parcial": cumple con observaciones — varios ítems cumplen pero hay deficiencias menores o información ambigua.
   - "no_cumple": el bloque tiene fallas graves — al menos un ítem crítico no cumple o falta evidencia central.
   - "no_aplica": el bloque entero no aplica a este protocolo (raro, justificar).
3. Sé conservador. Si tienes duda razonable entre "cumple" y "parcial", elige "parcial". Si entre "parcial" y "no_cumple", elige "no_cumple" cuando la severidad del ítem afectado sea "critica" o "alta".
4. Justifica cada veredicto de bloque en 50-300 palabras citando los ítems problemáticos.
5. Para cada ítem evaluado dentro del bloque, devuelves: id (CHK-NNN), resultado, observación corta (1-2 frases), y fuente_protocolo (cita o referencia al fragmento del protocolo que sustenta tu evaluación).
6. NO inventes evidencia. Si el protocolo no menciona algo, marca el ítem como "no_cumple" o "parcial" con observación clara.

OBSERVACIONES CRÍTICAS Y SUGERENCIAS

- "observaciones_criticas": lista de hallazgos que el comité debe atender obligatoriamente antes de aprobar (ej. ausencia de consentimiento, riesgo subestimado, falta de aval del centro).
- "sugerencias": lista de mejoras recomendables pero no bloqueantes (ej. redactar mejor el cronograma, agregar plan de difusión).

FORMATO EXACTO DE RESPUESTA

Devuelve UN ÚNICO OBJETO JSON con esta forma exacta. Sin texto antes ni después. Sin bloques markdown. Sin comentarios.

{
  "resumen_ejecutivo": "Párrafo de 200-800 caracteres con el veredicto general en lenguaje claro para el comité.",
  "bloques": {
    "identificacion": {
      "resultado": "cumple|no_cumple|parcial|no_aplica",
      "justificacion": "Texto de 50-300 palabras explicando el veredicto del bloque, citando ítems clave.",
      "items_evaluados": [
        { "id": "CHK-001", "resultado": "cumple", "observacion": "Título claro, en español, sin abreviaturas.", "fuente_protocolo": "Sección 1, párrafo 1 del protocolo." },
        { "id": "CHK-002", "resultado": "parcial", "observacion": "Falta constancia BPC vigente del IP.", "fuente_protocolo": "Anexo CV sin constancia adjunta." }
      ]
    },
    "estructura_cientifica": { ... mismo formato ... },
    "metodologia": { ... },
    "riesgo_beneficio": { ... },
    "consentimiento": { ... },
    "poblaciones_vulnerables": { ... },
    "confidencialidad_datos": { ... },
    "productos_salud": { ... },
    "gobernanza_cei": { ... },
    "transparencia_publicacion": { ... },
    "aspectos_economicos": { ... }
  },
  "observaciones_criticas": [
    "Hallazgo crítico 1 — debe atenderse antes de aprobar.",
    "Hallazgo crítico 2 — ..."
  ],
  "sugerencias": [
    "Sugerencia de mejora 1.",
    "Sugerencia de mejora 2."
  ]
}

REGLAS DE OMISIÓN

- Si un bloque entero NO tiene ítems aplicables al tipo de protocolo (ej. "productos_salud" en un estudio puramente observacional sin fármacos), OMÍTELO del JSON (no incluyas la clave). El comité asume que un bloque omitido = "no aplica".
- "observaciones_criticas" y "sugerencias" son opcionales — omítelos si están vacíos.

Devuelve SOLO el objeto JSON. Nada más.`;

type DatosProtocolo = {
  titulo: string;
  resumen: string | null;
  area_conocimiento_id: number | null;
  tipo_investigacion_id: string | null;
  clasificacion_riesgo: string | null;
  involucra_humanos: boolean;
  involucra_menores: boolean;
  involucra_datos_geneticos: boolean;
  involucra_medicamento: boolean;
  objetivo_general: string | null;
  objetivos_especificos: string[];
  criterios_inclusion: string[];
  criterios_exclusion: string[];
  metodologia: string | null;
  cronograma: { etapa: string; inicio?: string; fin?: string }[];
  ip_nombre: string;
  texto_fuente: string | null;
};

export function buildUserMessagePreDictamen(
  datos: DatosProtocolo,
  itemsPorCategoria: Record<Categoria, ChecklistItem[]>,
): string {
  const partes: string[] = [];

  partes.push("=== DATOS DEL PROTOCOLO ===\n");
  partes.push(`Título: ${datos.titulo}`);
  partes.push(`Investigador Principal: ${datos.ip_nombre}`);
  partes.push(`Tipo de investigación: ${datos.tipo_investigacion_id ?? "no_declarado"}`);
  partes.push(`Clasificación de riesgo declarada: ${datos.clasificacion_riesgo ?? "no_declarada"}`);
  partes.push(
    `Involucra: humanos=${datos.involucra_humanos}, menores=${datos.involucra_menores}, datos_geneticos=${datos.involucra_datos_geneticos}, medicamento=${datos.involucra_medicamento}`,
  );
  if (datos.resumen) partes.push(`\nResumen ejecutivo:\n${datos.resumen}`);
  if (datos.objetivo_general) partes.push(`\nObjetivo general:\n${datos.objetivo_general}`);
  if (datos.objetivos_especificos.length > 0) {
    partes.push(
      `\nObjetivos específicos:\n${datos.objetivos_especificos.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}`,
    );
  }
  if (datos.criterios_inclusion.length > 0) {
    partes.push(
      `\nCriterios de inclusión:\n${datos.criterios_inclusion.map((c) => `  - ${c}`).join("\n")}`,
    );
  }
  if (datos.criterios_exclusion.length > 0) {
    partes.push(
      `\nCriterios de exclusión:\n${datos.criterios_exclusion.map((c) => `  - ${c}`).join("\n")}`,
    );
  }
  if (datos.metodologia) partes.push(`\nMetodología:\n${datos.metodologia}`);
  if (datos.cronograma.length > 0) {
    partes.push(
      `\nCronograma:\n${datos.cronograma.map((c) => `  - ${c.etapa}${c.inicio ? ` (${c.inicio}${c.fin ? ` → ${c.fin}` : ""})` : ""}`).join("\n")}`,
    );
  }

  if (datos.texto_fuente && datos.texto_fuente.length > 0) {
    const recortado =
      datos.texto_fuente.length > 60000
        ? datos.texto_fuente.slice(0, 60000) + "\n\n[...texto truncado a 60k caracteres por límite de contexto...]"
        : datos.texto_fuente;
    partes.push(`\n=== TEXTO ÍNTEGRO DEL DOCUMENTO DEL INVESTIGADOR ===\n${recortado}`);
  } else {
    partes.push(
      "\n[Nota: no hay texto fuente del documento original — evalúa con los datos estructurados anteriores.]",
    );
  }

  partes.push("\n=== CHECKLIST MAESTRO POR BLOQUE ===");
  partes.push(
    "Estos son los ítems contra los que debes evaluar. Solo se incluyen los aplicables a las características declaradas del protocolo.\n",
  );

  for (const [categoria, items] of Object.entries(itemsPorCategoria) as [
    Categoria,
    ChecklistItem[],
  ][]) {
    if (items.length === 0) continue;
    partes.push(`\n--- BLOQUE: ${categoria} (${ETIQUETAS_CATEGORIA[categoria]}) ---`);
    for (const item of items) {
      partes.push(
        `\n[${item.id}] severidad=${item.severidad}, peso=${item.peso}, sec_protocolo=${item.seccion_protocolo}`,
      );
      partes.push(`  Criterio: ${item.criterio}`);
      partes.push(`  Evidencia esperada: ${item.evidencia_esperada}`);
      partes.push(`  Guía IA: ${item.ai_prompt_hint}`);
    }
  }

  partes.push(
    "\n\nDevuelve el JSON del pre-dictamen siguiendo el formato exacto especificado en las instrucciones del sistema.",
  );

  return partes.join("\n");
}
