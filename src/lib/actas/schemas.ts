/**
 * Schemas Zod del formulario "Emitir Dictamen" del Presidente.
 *
 * El Presidente abre la pantalla con valores prerellenados desde la
 * recomendación del comité y puede ajustar antes de pulsar "Emitir Acta".
 */
import { z } from "zod";

export const RESOLUCIONES_ACTA = [
  "APROBADO",
  "APROBADO CON OBSERVACIONES MENORES",
  "CONDICIONADO A MODIFICACIONES MAYORES",
  "NO APROBADO",
] as const;

export const TIPOS_SESION = ["ordinaria", "extraordinaria"] as const;

export const VIGENCIAS_PERMITIDAS = [6, 12, 24] as const;

export const emitirDictamenInputSchema = z
  .object({
    protocoloId: z.string().uuid(),
    resolucion: z.enum(RESOLUCIONES_ACTA),
    vigenciaMeses: z.number().refine(
      (v): v is 6 | 12 | 24 => (VIGENCIAS_PERMITIDAS as readonly number[]).includes(v),
      { message: "Vigencia inválida (debe ser 6, 12 o 24 meses)." },
    ),
    sesionTipo: z.enum(TIPOS_SESION).default("ordinaria"),
    sesionNumero: z.number().int().min(1).max(99),
    observaciones: z
      .array(z.string().min(10, "Cada observación debe tener al menos 10 caracteres."))
      .default([]),
    marcoNormativoExtra: z.array(z.string().min(10)).optional(),
  })
  .superRefine((data, ctx) => {
    const requiereObs =
      data.resolucion === "APROBADO CON OBSERVACIONES MENORES" ||
      data.resolucion === "CONDICIONADO A MODIFICACIONES MAYORES";
    if (requiereObs && data.observaciones.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["observaciones"],
        message:
          "Esta resolución requiere al menos una observación que el investigador deberá atender.",
      });
    }
  });

export type EmitirDictamenInput = z.infer<typeof emitirDictamenInputSchema>;

/**
 * Mapeo de la resolución del acta al estado del protocolo en BD.
 *   APROBADO                                  → 'aprobado'
 *   APROBADO CON OBSERVACIONES MENORES        → 'aprobado_con_observaciones'
 *   CONDICIONADO A MODIFICACIONES MAYORES     → 'observaciones'
 *   NO APROBADO                               → 'rechazado'
 */
export function estadoProtocoloDesdeResolucion(
  resolucion: (typeof RESOLUCIONES_ACTA)[number],
): "aprobado" | "aprobado_con_observaciones" | "observaciones" | "rechazado" {
  switch (resolucion) {
    case "APROBADO":
      return "aprobado";
    case "APROBADO CON OBSERVACIONES MENORES":
      return "aprobado_con_observaciones";
    case "CONDICIONADO A MODIFICACIONES MAYORES":
      return "observaciones";
    case "NO APROBADO":
      return "rechazado";
  }
}

/**
 * Resolución prerellenada en el formulario en función de la recomendación
 * del comité guardada en `protocolos.recomendacion_comite`.
 */
export function resolucionDesdeRecomendacion(
  recomendacion: string | null,
): (typeof RESOLUCIONES_ACTA)[number] {
  switch (recomendacion) {
    case "aprobar":
      return "APROBADO";
    case "aprobar_con_observaciones":
      return "APROBADO CON OBSERVACIONES MENORES";
    case "no_aprobar":
      return "CONDICIONADO A MODIFICACIONES MAYORES";
    default:
      return "APROBADO";
  }
}
