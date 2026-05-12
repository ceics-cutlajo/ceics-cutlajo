import type { ResultadoCumplimiento, TipoVoto } from "./types";

/**
 * Deriva el voto global del miembro a partir de los 11 bloques temáticos.
 *
 * Regla institucional: el peor bloque manda.
 *   - Si algún bloque es `no_cumple`         → `no_aprobar`
 *   - Si algún bloque es `parcial`           → `aprobar_con_observaciones`
 *   - Si todos son `cumple` o `no_aplica`    → `aprobar`
 *
 * `no_aplica` no penaliza: es legítimo que un bloque no aplique al diseño del
 * estudio (p.ej. `productos_salud` en un observacional puro, regla R5 del prompt).
 *
 * Esta función NO se aplica a abstenciones por conflicto de interés: en ese
 * caso el voto global se asigna directamente a `abstener` sin pasar por bloques.
 */
export function derivarVotoGlobal(
  bloques: { resultado: ResultadoCumplimiento }[],
): TipoVoto {
  if (bloques.length === 0) {
    throw new Error(
      "derivarVotoGlobal requiere al menos un bloque para derivar el voto.",
    );
  }
  if (bloques.some((b) => b.resultado === "no_cumple")) return "no_aprobar";
  if (bloques.some((b) => b.resultado === "parcial")) {
    return "aprobar_con_observaciones";
  }
  return "aprobar";
}
