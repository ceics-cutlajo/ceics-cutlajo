import type { Categoria } from "@/lib/checklist";

/**
 * Resultado de cumplimiento por bloque temático.
 * Coincide con el enum SQL `resultado_cumplimiento` (migración 001).
 */
export type ResultadoCumplimiento = "cumple" | "no_cumple" | "parcial" | "no_aplica";

/**
 * Voto global del miembro del comité.
 * Coincide con el enum SQL `tipo_voto` (migración 001 + 016).
 */
export type TipoVoto =
  | "aprobar"
  | "aprobar_con_observaciones"
  | "no_aprobar"
  | "abstener";

/**
 * Veredicto del miembro sobre un bloque concreto del checklist.
 * Una fila en `evaluaciones_bloques`.
 */
export type BloqueVoto = {
  bloque: Categoria;
  resultado: ResultadoCumplimiento;
  acordado_con_ia: boolean;
  comentario: string | null;
};

/**
 * Cabecera de evaluación de un miembro sobre un protocolo.
 * Una fila en `evaluaciones`.
 */
export type EvaluacionMiembro = {
  miembro_id: string;
  voto_global: TipoVoto;
  conflicto_interes: boolean;
};
