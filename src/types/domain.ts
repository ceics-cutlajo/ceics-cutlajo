/**
 * Tipos de dominio personalizados.
 * Se complementa con `database.types.ts` que se genera con `pnpm db:types`.
 */

export type RolSistema =
  | "investigador"
  | "comite_vocal"
  | "comite_secretario"
  | "presidente"
  | "admin_sistema";

export type EstadoProtocolo =
  | "borrador"
  | "en_evaluacion_ia"
  | "en_revision_comite"
  | "listo_dictamen"
  | "aprobado"
  | "aprobado_con_observaciones"
  | "observaciones"
  | "rechazado"
  | "retirado";

export type TipoVoto = "aprobar" | "no_aprobar" | "abstener";

export type ClasificacionRiesgo = "sin_riesgo" | "riesgo_minimo" | "riesgo_mayor_minimo";

export const ETIQUETAS_ESTADO: Record<EstadoProtocolo, string> = {
  borrador: "Borrador",
  en_evaluacion_ia: "En evaluación IA",
  en_revision_comite: "En revisión del comité",
  listo_dictamen: "Listo para dictamen",
  aprobado: "Aprobado",
  aprobado_con_observaciones: "Aprobado con observaciones",
  observaciones: "Requiere correcciones",
  rechazado: "Rechazado",
  retirado: "Retirado",
};
