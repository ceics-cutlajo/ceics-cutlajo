/**
 * Schema Zod del Job 3 — Resumen de observaciones.
 *
 * El modelo recibe los comentarios crudos que cada miembro del comité dejó al
 * votar (comentario global + comentarios por bloque + motivos de abstención) y
 * los sintetiza en una lista de observaciones formales, accionables y dirigidas
 * al investigador. El resultado NO se persiste: alimenta el textarea del
 * formulario de dictamen para que el Presidente/Secretario lo revise, edite y
 * finalmente lo guarde en `actas.observaciones` al emitir.
 *
 * Cada observación cumple el contrato de `emitirDictamenInputSchema`
 * (mínimo 10 caracteres por observación).
 */
import { z } from "zod";

export const resumenObservacionesSchema = z.object({
  // Una observación por elemento; el cliente las une con "\n" para el textarea.
  observaciones: z
    .array(z.string().min(10).max(600))
    .max(30),
  // Nota breve de síntesis (opcional). No va al acta; es contexto para el
  // Presidente sobre cómo se construyó el borrador.
  nota_sintesis: z.string().max(600).optional(),
});

export type ResumenObservaciones = z.infer<typeof resumenObservacionesSchema>;
