/**
 * Deriva la etapa actual del protocolo desde el estado + señales auxiliares,
 * sin depender de una columna persistente. Devuelve el "mapa de timeline"
 * con el estado de las 7 etapas (Frontiers-like).
 *
 * Mapa de etapas:
 *   1. Sometimiento            (IP construye el borrador)
 *   2. Pre-análisis IA         (Jobs 1 y 2)
 *   3. Validación comité       (primera ronda)
 *   4. Correcciones IP         (regreso por observaciones)
 *   5. Re-validación comité    (rondas 2+)
 *   6. Dictamen final          (Presidente/Secretario)
 *   7. Acta de aprobación      (terminal)
 *
 * La distinción entre 3 y 5 se infiere de la versión máxima del pre-informe:
 * la regeneración tras observaciones produce version >= 2.
 */
import type { EstadoProtocolo } from "@/types/domain";

export type EstadoEtapa = "completada" | "actual" | "pendiente" | "no_aplica";

export type Etapa = {
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  nombre: string;
  estado: EstadoEtapa;
};

export type TimelineSnapshot = {
  etapas: Etapa[];
  etapaActual: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  rondaComite: number; // 1 en la primera revisión, 2+ en rondas posteriores
};

const NOMBRES: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string> = {
  1: "Sometimiento",
  2: "Pre-análisis IA",
  3: "Validación comité",
  4: "Correcciones",
  5: "Re-validación",
  6: "Dictamen final",
  7: "Acta de aprobación",
};

export type SeñalesProtocolo = {
  estado: EstadoProtocolo;
  submitted_at: string | null;
  /** Versión máxima del pre-informe (0 si no hay). >=2 indica que hubo ciclo de observaciones. */
  versionMaxPreInforme: number;
};

export function derivarTimeline(p: SeñalesProtocolo): TimelineSnapshot {
  const rondaComite = Math.max(1, p.versionMaxPreInforme || 1);
  const hubieronCiclos = p.versionMaxPreInforme >= 2;
  const etapaActual = calcularEtapaActual(p.estado, hubieronCiclos);

  // Estados terminales positivos/negativos: etapas 4/5 solo "completadas" si hubo ciclo
  const terminal =
    p.estado === "aprobado" ||
    p.estado === "aprobado_con_observaciones" ||
    p.estado === "rechazado" ||
    p.estado === "retirado";

  const etapas: Etapa[] = ([1, 2, 3, 4, 5, 6, 7] as const).map((numero) => ({
    numero,
    nombre: NOMBRES[numero],
    estado: estadoDeEtapa(numero, etapaActual, hubieronCiclos, terminal, p),
  }));

  return { etapas, etapaActual, rondaComite };
}

function calcularEtapaActual(
  estado: EstadoProtocolo,
  hubieronCiclos: boolean,
): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  switch (estado) {
    case "borrador":
      return 1;
    case "en_evaluacion_ia":
      return 2;
    case "en_revision_comite":
      return hubieronCiclos ? 5 : 3;
    case "observaciones":
      return 4;
    case "correcciones_menores":
    case "listo_dictamen":
      return 6;
    case "aprobado":
    case "aprobado_con_observaciones":
    case "rechazado":
    case "retirado":
      return 7;
  }
}

function estadoDeEtapa(
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  actual: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  hubieronCiclos: boolean,
  terminal: boolean,
  p: SeñalesProtocolo,
): EstadoEtapa {
  // Etapas 4 y 5 son opcionales: solo "vivas" si hubo ciclo
  const esCicloOpcional = numero === 4 || numero === 5;

  if (esCicloOpcional && !hubieronCiclos && !estamosEnCiclo(p.estado)) {
    return "no_aplica";
  }

  if (numero === actual) return "actual";
  if (numero < actual) return "completada";

  // Caso especial: en etapa terminal 7 marcamos todas las anteriores como completadas,
  // saltando 4/5 si no aplican (ya filtrado arriba)
  if (terminal && numero < 7) {
    if (esCicloOpcional && !hubieronCiclos) return "no_aplica";
    return "completada";
  }

  return "pendiente";
}

function estamosEnCiclo(estado: EstadoProtocolo): boolean {
  // Si estamos en observaciones, la etapa 4 está actual aunque sea la primera vez
  return estado === "observaciones";
}
