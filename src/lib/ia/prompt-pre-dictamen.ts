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

REGLAS DE RESPONSABILIDAD — CRÍTICAS

R0. **Algunos elementos NO son responsabilidad del investigador.** El protocolo NO debe penalizarse por ausencia de información que el CEI evaluador debe proveer (registro CONBIOETICA del comité, composición del comité, POEs del CEI, COI de los miembros del CEI, quórum, capacitación de miembros, notificación de dictámenes). Esos ítems están explícitamente excluidos del checklist que recibes — si aún así te sientes tentado a marcar algo como "no cumple" por información que claramente le corresponde al CEI generar, NO LO HAGAS.

REGLAS CONTEXTUALES — APLICA CON CRITERIO

R1. **Consentimiento informado puede legítimamente no aplicar.** Si el estudio es retrospectivo, transversal con datos secundarios anonimizados, observacional con registros administrativos públicos, o accede a información en agregado, NO demandes CCI individual (CHK-035 a CHK-040). En su lugar evalúa CHK-043 (justificación de dispensa). Si el protocolo no menciona dispensa explícita pero el diseño claramente la justifica, marca el bloque "parcial" con observación: "Falta declaración formal de dispensa de consentimiento conforme CIOMS Pauta 10; el diseño la justifica pero debe documentarse."

R2. **Muestra no probabilística NO requiere cálculo de tamaño.** CHK-017: si el protocolo declara muestra no probabilística (casos consecutivos, conveniencia, todos los disponibles), basta con declararla y justificar la estrategia. NO exijas fórmula, alpha, beta ni poder estadístico. Marca cumple si está declarado.

R3. **Autofinanciamiento es legítimo.** CHK-096: si el protocolo declara autofinanciamiento, financiamiento institucional ordinario (carga académica), o no requiere fondos especiales, marca "cumple" con esa observación. NO exijas presupuesto desagregado por rubros para estudios self-funded de bajo costo. Solo si hay patrocinador externo o financiamiento mayor, exige desglose.

R4. **Publicación es buena práctica, no requisito.** CHK-091: el compromiso de publicar es deseable pero NO es requisito normativo obligatorio en México. Marca "cumple" por defecto. Solo marca "parcial" si hay evidencia explícita de mala conducta (ocultar resultados negativos, publicación parcial sesgada). Si simplemente el protocolo no menciona publicación, considera "cumple" — el investigador puede decidir después.

R5. **Productos de salud: aplicabilidad estricta.** El bloque "productos_salud" entero solo aplica si involucra_medicamento=true, dispositivo médico, biológico o intervención farmacológica/quirúrgica. Si el estudio es puramente observacional, epidemiológico, encuestas o análisis de datos secundarios, marca el bloque "no_aplica" SIN evaluar sus ítems individualmente.

REGLAS DE EVALUACIÓN

1. Evalúas POR BLOQUE TEMÁTICO (11 categorías). Internamente consideras todos los ítems aplicables del checklist, pero solo reportas el veredicto del BLOQUE.
2. Para cada bloque, emites un veredicto global:
   - "cumple": todos los ítems del bloque (o la inmensa mayoría) cumplen.
   - "parcial": cumple con observaciones — varios ítems cumplen pero hay deficiencias menores o información ambigua.
   - "no_cumple": el bloque tiene fallas graves — al menos un ítem crítico no cumple o falta evidencia central.
   - "no_aplica": el bloque entero no aplica a este protocolo (raro, justifica brevemente).
3. Sé conservador. Si tienes duda entre "cumple" y "parcial", elige "parcial". Si entre "parcial" y "no_cumple", elige "no_cumple" cuando los ítems afectados sean de severidad "critica" o "alta".
4. **Justifica cada veredicto en 40-150 palabras** mencionando los ítems CHK-NNN más relevantes que sustentan el veredicto. Sé conciso — los miembros del comité leerán esto.
5. NO inventes evidencia. Si el protocolo no menciona algo, considéralo "no cumple" o "parcial" según el peso del ítem faltante.
6. **NO incluyas el campo "items_evaluados" en tu respuesta.** Reporta solo veredicto + justificación por bloque. La granularidad por ítem se solicita bajo demanda en otra llamada.

OBSERVACIONES CRÍTICAS Y SUGERENCIAS

- "observaciones_criticas": lista de hallazgos que el comité debe atender obligatoriamente antes de aprobar (ej. ausencia de consentimiento, riesgo subestimado, falta de aval del centro).
- "sugerencias": lista de mejoras recomendables pero no bloqueantes (ej. redactar mejor el cronograma, agregar plan de difusión).

FORMATO DE RESPUESTA — OBJETO JSON ÚNICO Y CONCISO

{
  "resumen_ejecutivo": "<200-600 chars>",
  "bloques": {
    "identificacion": { "resultado": "cumple|no_cumple|parcial|no_aplica", "justificacion": "<40-150 palabras>" },
    "estructura_cientifica": { ... },
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
  "observaciones_criticas": ["<obs crítica 1>", "<obs crítica 2>"],
  "sugerencias": ["<sugerencia 1>", "<sugerencia 2>"]
}

Sin texto antes ni después del JSON. Sin markdown. Omite bloques no aplicables y arrays vacíos.`;

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
  bloquesAEvaluar: readonly Categoria[],
): string {
  const partes: string[] = [];

  partes.push(
    `=== INSTRUCCIÓN DE ALCANCE ===\nEn esta llamada EVALÚA EXCLUSIVAMENTE estos bloques (omite cualquier otro): ${bloquesAEvaluar.join(", ")}.\nDevuelve un JSON con la clave "bloques" conteniendo SOLO esos bloques. Sin "resumen_ejecutivo" (lo construimos en código combinando varias llamadas). "observaciones_criticas" y "sugerencias" son opcionales.\n`,
  );

  partes.push("\n=== DATOS DEL PROTOCOLO ===\n");
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
    // Truncar a 5K chars (~1.3K tokens) — necesario para caber en 60s de Vercel
    // Hobby con tiempos de Haiku. Lo importante (intro, objetivos, métodos
    // iniciales, mención de consentimiento) suele estar en los primeros 5K
    // chars. Los datos estructurados arriba complementan.
    const recortado =
      datos.texto_fuente.length > 5000
        ? datos.texto_fuente.slice(0, 5000) +
          "\n\n[...texto del documento truncado por límite de tiempo de inferencia. Usa los datos estructurados de arriba para complementar...]"
        : datos.texto_fuente;
    partes.push(`\n=== FRAGMENTO INICIAL DEL DOCUMENTO ===\n${recortado}`);
  } else {
    partes.push(
      "\n[Nota: no hay texto fuente del documento original — evalúa con los datos estructurados anteriores.]",
    );
  }

  partes.push("\n=== CHECKLIST MAESTRO (SOLO LOS BLOQUES DE ESTA LLAMADA) ===");
  partes.push(
    "Ítems contra los que debes evaluar. Solo aplicables al protocolo. Forma compacta: [ID] (severidad) → guía de evaluación.\n",
  );

  const setBloques = new Set(bloquesAEvaluar);
  for (const [categoria, items] of Object.entries(itemsPorCategoria) as [
    Categoria,
    ChecklistItem[],
  ][]) {
    if (!setBloques.has(categoria)) continue;
    if (items.length === 0) continue;
    partes.push(`\n--- BLOQUE: ${categoria} (${ETIQUETAS_CATEGORIA[categoria]}) ---`);
    for (const item of items) {
      partes.push(`[${item.id}] (${item.severidad}) → ${item.ai_prompt_hint}`);
    }
  }

  partes.push(
    `\n\nDevuelve el JSON con SOLO estos bloques: ${bloquesAEvaluar.join(", ")}. Sin "resumen_ejecutivo". Formato según las instrucciones del sistema.`,
  );

  return partes.join("\n");
}

// Grupos balanceados de bloques para paralelizar 3 llamadas a Haiku.
// Cada llamada cabe holgada en el límite de 60s de Vercel Hobby.
export const GRUPOS_BLOQUES: readonly (readonly Categoria[])[] = [
  ["identificacion", "estructura_cientifica", "metodologia"],
  ["riesgo_beneficio", "consentimiento", "poblaciones_vulnerables", "confidencialidad_datos"],
  ["productos_salud", "gobernanza_cei", "transparencia_publicacion", "aspectos_economicos"],
] as const;
