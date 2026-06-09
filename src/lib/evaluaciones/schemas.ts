import { z } from "zod";
import { CATEGORIAS } from "@/lib/checklist";

const resultadoSchema = z.enum(["cumple", "no_cumple", "parcial", "no_aplica"]);

export const bloqueVotoInputSchema = z
  .object({
    bloque: z.enum(CATEGORIAS),
    acordado_con_ia: z.boolean(),
    resultado: resultadoSchema,
    comentario: z.string().max(2000).nullable(),
  })
  .refine(
    (b) => b.acordado_con_ia || (b.comentario != null && b.comentario.trim().length >= 10),
    {
      message:
        "Si discrepas con la IA, el comentario es obligatorio (mínimo 10 caracteres).",
      path: ["comentario"],
    },
  );

export const evaluacionInputSchema = z.object({
  protocoloId: z.string().uuid(),
  comentarioGlobal: z.string().max(2000).optional().nullable(),
  bloques: z.array(bloqueVotoInputSchema).length(11, {
    message: "Debes emitir veredicto sobre los 11 bloques temáticos.",
  }),
  // Dictamen final elegido por el evaluador. La evaluación por bloque solo
  // SUGIERE un voto; el evaluador tiene la última palabra. Si se omite, el
  // servidor usa la sugerencia derivada de los bloques.
  votoFinal: z
    .enum(["aprobar", "aprobar_con_observaciones", "no_aprobar", "abstener"])
    .optional(),
});

export type EvaluacionInput = z.infer<typeof evaluacionInputSchema>;
export type BloqueVotoInput = z.infer<typeof bloqueVotoInputSchema>;

export const abstencionCoiInputSchema = z.object({
  protocoloId: z.string().uuid(),
  motivo: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});
export type AbstencionCoiInput = z.infer<typeof abstencionCoiInputSchema>;
