/**
 * Schema Zod del `resultado_json` que escribe el motor IA a `extracciones_ia`.
 *
 * Contrato con el trigger SQL `aplicar_extraccion_ia` (migración 015):
 * el trigger lee `campos -> '<nombre>' ->> 'valor'` y aplica al protocolo.
 * Cualquier cambio en este schema debe revisar el trigger.
 *
 * Todos los campos son opcionales: la IA omite los que no encuentra en el texto
 * para que el investigador los capture manualmente.
 */
import { z } from "zod";

const confianzaSchema = z.enum(["alta", "media", "baja"]);
const fuenteSchema = z.string().max(500).optional();

function campoOpcional<T extends z.ZodTypeAny>(valorSchema: T) {
  return z
    .object({
      valor: valorSchema,
      confianza: confianzaSchema,
      fuente: fuenteSchema,
    })
    .optional();
}

const cronogramaItemSchema = z.object({
  etapa: z.string(),
  inicio: z.string().optional(),
  fin: z.string().optional(),
});

export const TIPOS_INVESTIGACION = [
  "basica",
  "aplicada",
  "tecnologico",
  "innovacion",
  "humanistica",
  "clinica",
] as const;

export const CLASIFICACIONES_RIESGO = [
  "sin_riesgo",
  "riesgo_minimo",
  "riesgo_mayor_minimo",
] as const;

export const resultadoIASchema = z.object({
  campos: z.object({
    titulo: campoOpcional(z.string().min(20).max(300)),
    resumen: campoOpcional(z.string().min(100).max(3000)),
    area_conocimiento_id: campoOpcional(z.number().int().min(1).max(9)),
    tipo_investigacion_id: campoOpcional(z.enum(TIPOS_INVESTIGACION)),
    clasificacion_riesgo: campoOpcional(z.enum(CLASIFICACIONES_RIESGO)),
    involucra_humanos: campoOpcional(z.boolean()),
    involucra_menores: campoOpcional(z.boolean()),
    involucra_datos_geneticos: campoOpcional(z.boolean()),
    involucra_medicamento: campoOpcional(z.boolean()),
    objetivo_general: campoOpcional(z.string().min(30)),
    objetivos_especificos: campoOpcional(z.array(z.string().min(5).max(1500))),
    criterios_inclusion: campoOpcional(z.array(z.string().min(3).max(1000))),
    criterios_exclusion: campoOpcional(z.array(z.string().min(3).max(1000))),
    metodologia: campoOpcional(z.string().min(50)),
    cronograma: campoOpcional(z.array(cronogramaItemSchema)),
  }),
  alertas: z.array(z.string()).optional(),
  tokens_input: z.number().int().nonnegative().optional(),
  tokens_output: z.number().int().nonnegative().optional(),
});

export type ResultadoIA = z.infer<typeof resultadoIASchema>;

// ---------------------------------------------------------------------------
// JSON Schema equivalente para SALIDAS ESTRUCTURADAS de la API (output_config.
// format). Construido a mano (no con zodOutputFormat) para no depender de la
// versión de Zod del SDK. Las salidas estructuradas NO admiten min/max/longitud,
// así que aquí solo van tipos/enums/forma; las longitudes las valida el schema
// Zod de arriba de forma tolerante tras parsear. Todos los campos de `campos`
// son opcionales (la IA omite lo que no encuentra). Mantener en sync con el
// schema Zod y con el trigger `aplicar_extraccion_ia` (migración 015).
// ---------------------------------------------------------------------------
function campoJson(valor: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["valor", "confianza"],
    properties: {
      valor,
      confianza: { type: "string", enum: ["alta", "media", "baja"] },
      fuente: { type: "string" },
    },
  };
}

export const resultadoJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["campos"],
  properties: {
    campos: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {
        titulo: campoJson({ type: "string" }),
        resumen: campoJson({ type: "string" }),
        area_conocimiento_id: campoJson({ type: "integer" }),
        tipo_investigacion_id: campoJson({
          type: "string",
          enum: [...TIPOS_INVESTIGACION],
        }),
        clasificacion_riesgo: campoJson({
          type: "string",
          enum: [...CLASIFICACIONES_RIESGO],
        }),
        involucra_humanos: campoJson({ type: "boolean" }),
        involucra_menores: campoJson({ type: "boolean" }),
        involucra_datos_geneticos: campoJson({ type: "boolean" }),
        involucra_medicamento: campoJson({ type: "boolean" }),
        objetivo_general: campoJson({ type: "string" }),
        objetivos_especificos: campoJson({
          type: "array",
          items: { type: "string" },
        }),
        criterios_inclusion: campoJson({
          type: "array",
          items: { type: "string" },
        }),
        criterios_exclusion: campoJson({
          type: "array",
          items: { type: "string" },
        }),
        metodologia: campoJson({ type: "string" }),
        cronograma: campoJson({
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["etapa"],
            properties: {
              etapa: { type: "string" },
              inicio: { type: "string" },
              fin: { type: "string" },
            },
          },
        }),
      },
    },
    alertas: { type: "array", items: { type: "string" } },
  },
};
