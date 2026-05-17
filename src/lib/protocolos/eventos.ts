/**
 * Helpers para formatear eventos del historial del protocolo.
 *
 * Los eventos provienen de dos orígenes: (a) trigger SQL
 * `log_cambio_estado_protocolo` que escribe "Estado cambió de X a Y"
 * usando los slugs de la enum, y (b) inserts directos desde
 * `src/lib/protocolos/actions.ts` que usan los slugs de los tipos
 * de documento. Este helper traduce ambos a etiquetas humanas.
 */
import { ETIQUETAS_ESTADO, type EstadoProtocolo } from "@/types/domain";
import { ETIQUETAS_DOCUMENTO, type TipoDocumento } from "./schemas";

export function formatearDescripcionEvento(
  descripcion: string | null | undefined,
): string {
  if (!descripcion) return "";

  let out = descripcion.replace(
    /Estado cambió de ([a-z_]+) a ([a-z_]+)/i,
    (_, a, b) => {
      const eA = ETIQUETAS_ESTADO[a as EstadoProtocolo] ?? a;
      const eB = ETIQUETAS_ESTADO[b as EstadoProtocolo] ?? b;
      return `Estado cambió de ${eA} a ${eB}`;
    },
  );

  out = out.replace(
    /Documento "([a-z_]+)" (subido|eliminado)/g,
    (_, slug, accion) => {
      const etiqueta = ETIQUETAS_DOCUMENTO[slug as TipoDocumento] ?? slug;
      return `Documento "${etiqueta}" ${accion}`;
    },
  );

  return out;
}
