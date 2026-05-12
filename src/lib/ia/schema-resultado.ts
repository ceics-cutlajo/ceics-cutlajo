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
    objetivos_especificos: campoOpcional(z.array(z.string().min(5).max(500))),
    criterios_inclusion: campoOpcional(z.array(z.string().min(3).max(500))),
    criterios_exclusion: campoOpcional(z.array(z.string().min(3).max(500))),
    metodologia: campoOpcional(z.string().min(50)),
    cronograma: campoOpcional(z.array(cronogramaItemSchema)),
  }),
  alertas: z.array(z.string()).optional(),
  tokens_input: z.number().int().nonnegative().optional(),
  tokens_output: z.number().int().nonnegative().optional(),
});

export type ResultadoIA = z.infer<typeof resultadoIASchema>;
