/**
 * Schema Zod del `resultado_json` del pre-dictamen IA.
 *
 * Contrato con la tabla `pre_informes` (migración 007):
 *   - El objeto completo se guarda en `pre_informes.contenido` (jsonb)
 *   - Campos derivados (resumen_ejecutivo, cumple_global, items_*) se calculan
 *     en el route handler y se copian a las columnas dedicadas.
 *
 * Granularidad: 11 bloques (categorías del checklist) cada uno con su veredicto
 * + lista de ítems evaluados dentro. El miembro del comité vota por bloque.
 */
import { z } from "zod";

const resultadoSchema = z.enum(["cumple", "no_cumple", "parcial", "no_aplica"]);

const itemEvaluadoSchema = z.object({
  id: z.string().regex(/^CHK-\d{3}$/),
  resultado: resultadoSchema,
  observacion: z.string().min(3).max(300),
  fuente_protocolo: z.string().max(300).optional(),
});

const bloqueEvaluadoSchema = z.object({
  resultado: resultadoSchema,
  justificacion: z.string().min(15).max(800),
  // items_evaluados opcional: en sesión 8a no lo pedimos al modelo (ahorra
  // tokens y tiempo). Si en 8b queremos detalle por ítem para un bloque
  // específico, lo solicitamos bajo demanda con una llamada acotada.
  items_evaluados: z.array(itemEvaluadoSchema).max(40).optional(),
});

export const CATEGORIAS_BLOQUE = [
  "identificacion",
  "estructura_cientifica",
  "metodologia",
  "riesgo_beneficio",
  "consentimiento",
  "poblaciones_vulnerables",
  "confidencialidad_datos",
  "productos_salud",
  "gobernanza_cei",
  "transparencia_publicacion",
  "aspectos_economicos",
] as const;

// Schema parcial usado por cada llamada paralela: evalúa SOLO un subconjunto
// de bloques y NO incluye resumen_ejecutivo (lo construimos en código tras
// hacer merge de las 3 llamadas).
export const preDictamenParcialSchema = z.object({
  bloques: z.object({
    identificacion: bloqueEvaluadoSchema.optional(),
    estructura_cientifica: bloqueEvaluadoSchema.optional(),
    metodologia: bloqueEvaluadoSchema.optional(),
    riesgo_beneficio: bloqueEvaluadoSchema.optional(),
    consentimiento: bloqueEvaluadoSchema.optional(),
    poblaciones_vulnerables: bloqueEvaluadoSchema.optional(),
    confidencialidad_datos: bloqueEvaluadoSchema.optional(),
    productos_salud: bloqueEvaluadoSchema.optional(),
    gobernanza_cei: bloqueEvaluadoSchema.optional(),
    transparencia_publicacion: bloqueEvaluadoSchema.optional(),
    aspectos_economicos: bloqueEvaluadoSchema.optional(),
  }),
  observaciones_criticas: z.array(z.string().min(10).max(500)).max(20).optional(),
  sugerencias: z.array(z.string().min(10).max(500)).max(20).optional(),
  tokens_input: z.number().int().nonnegative().optional(),
  tokens_output: z.number().int().nonnegative().optional(),
});
export type PreDictamenParcial = z.infer<typeof preDictamenParcialSchema>;

// Schema completo: lo que finalmente se persiste en pre_informes.contenido.
// El route handler combina N PreDictamenParcial + construye resumen_ejecutivo
// y produce este objeto antes de validar y escribir.
export const preDictamenSchema = z.object({
  resumen_ejecutivo: z.string().min(50).max(2000),
  bloques: z.object({
    identificacion: bloqueEvaluadoSchema.optional(),
    estructura_cientifica: bloqueEvaluadoSchema.optional(),
    metodologia: bloqueEvaluadoSchema.optional(),
    riesgo_beneficio: bloqueEvaluadoSchema.optional(),
    consentimiento: bloqueEvaluadoSchema.optional(),
    poblaciones_vulnerables: bloqueEvaluadoSchema.optional(),
    confidencialidad_datos: bloqueEvaluadoSchema.optional(),
    productos_salud: bloqueEvaluadoSchema.optional(),
    gobernanza_cei: bloqueEvaluadoSchema.optional(),
    transparencia_publicacion: bloqueEvaluadoSchema.optional(),
    aspectos_economicos: bloqueEvaluadoSchema.optional(),
  }),
  observaciones_criticas: z.array(z.string().min(10).max(500)).max(20).optional(),
  sugerencias: z.array(z.string().min(10).max(500)).max(20).optional(),
  tokens_input: z.number().int().nonnegative().optional(),
  tokens_output: z.number().int().nonnegative().optional(),
});

export type PreDictamen = z.infer<typeof preDictamenSchema>;
export type BloqueEvaluado = z.infer<typeof bloqueEvaluadoSchema>;
export type ItemEvaluado = z.infer<typeof itemEvaluadoSchema>;
