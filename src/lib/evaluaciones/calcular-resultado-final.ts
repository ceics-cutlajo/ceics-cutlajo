import type { EvaluacionMiembro, TipoVoto } from "./types";

export type ResultadoFinal = {
  /** Tipo de voto que gana el conteo, ya aplicado voto de calidad si hubo empate. */
  ganador: TipoVoto;
  /** Conteo bruto de cada tipo (incluye abstenciones). */
  conteo: Record<TipoVoto, number>;
  /** True si hubo empate exacto y el voto del Presidente lo resolvió. */
  voto_calidad_aplicado: boolean;
  /** Si `voto_calidad_aplicado=true`: qué votó el Presidente. */
  voto_presidente?: TipoVoto;
  /**
   * True si hubo empate y el Presidente no votó por ninguno de los empatados
   * (caso raro, p.ej. abstención por COI). El sistema aplica fallback
   * conservador y deja la marca para revisión humana.
   */
  desempate_no_resuelto?: boolean;
  /**
   * True si TODOS los miembros que votaron lo hicieron como abstención
   * (incluido COI), por lo que no hay votos decisivos. El protocolo NO debe
   * cerrarse automáticamente en este caso — requiere intervención del comité.
   */
  sin_votos_decisivos?: boolean;
};

/** Tipos de voto "decisivos" (excluye `abstener`). */
const TIPOS_DECISIVOS: ReadonlyArray<TipoVoto> = [
  "aprobar",
  "aprobar_con_observaciones",
  "no_aprobar",
];

/**
 * Prioridad conservadora cuando se aplica fallback de desempate no resuelto:
 * primero el resultado más estricto, luego intermedios, luego permisivo.
 */
const PRIORIDAD_FALLBACK: ReadonlyArray<TipoVoto> = [
  "no_aprobar",
  "aprobar_con_observaciones",
  "aprobar",
];

/**
 * Calcula el resultado final del comité a partir de las evaluaciones emitidas.
 *
 * Reglas:
 *   1. Las abstenciones (incluyendo COI obligatorio) no compiten por mayoría.
 *   2. Se cuentan los 3 tipos decisivos y se toma el más votado.
 *   3. Si hay empate exacto entre dos o más tipos decisivos y el Presidente
 *      votó por uno de los empatados, su voto desempata (voto de calidad).
 *   4. Si hay empate y el Presidente no votó (o votó algo fuera del empate),
 *      se devuelve el resultado más conservador entre los empatados y se
 *      marca `desempate_no_resuelto=true` para que la UI pida intervención.
 *
 * `presidenteId` es el `usuarios.id` del Presidente actual del comité.
 */
export function calcularResultadoFinal(
  evaluaciones: EvaluacionMiembro[],
  presidenteId: string,
): ResultadoFinal {
  const conteo: Record<TipoVoto, number> = {
    aprobar: 0,
    aprobar_con_observaciones: 0,
    no_aprobar: 0,
    abstener: 0,
  };
  for (const e of evaluaciones) {
    conteo[e.voto_global] += 1;
  }

  const totalDecisivos =
    conteo.aprobar + conteo.aprobar_con_observaciones + conteo.no_aprobar;
  if (totalDecisivos === 0) {
    return {
      ganador: "abstener",
      conteo,
      voto_calidad_aplicado: false,
      sin_votos_decisivos: true,
    };
  }

  const ranking = TIPOS_DECISIVOS.map((t) => ({ tipo: t, count: conteo[t] })).sort(
    (a, b) => b.count - a.count,
  );
  const max = ranking[0];

  const empatados = ranking.filter((r) => r.count === max.count && max.count > 0);

  if (empatados.length <= 1) {
    return { ganador: max.tipo, conteo, voto_calidad_aplicado: false };
  }

  const tiposEmpatados = empatados.map((e) => e.tipo);
  const evalPresidente = evaluaciones.find((e) => e.miembro_id === presidenteId);

  if (
    evalPresidente &&
    !evalPresidente.conflicto_interes &&
    tiposEmpatados.includes(evalPresidente.voto_global)
  ) {
    return {
      ganador: evalPresidente.voto_global,
      conteo,
      voto_calidad_aplicado: true,
      voto_presidente: evalPresidente.voto_global,
    };
  }

  const ganador = PRIORIDAD_FALLBACK.find((p) => tiposEmpatados.includes(p))!;
  return {
    ganador,
    conteo,
    voto_calidad_aplicado: false,
    desempate_no_resuelto: true,
  };
}

/**
 * Mapea el tipo de voto ganador al estado_protocolo correspondiente.
 *
 *   aprobar                        → 'aprobado'
 *   aprobar_con_observaciones      → 'aprobado_con_observaciones'
 *   no_aprobar                     → 'observaciones'  (el flujo CEICS pide
 *                                    devolver al investigador para corrección
 *                                    antes de rechazo definitivo; el estado
 *                                    'rechazado' lo emite el Presidente como
 *                                    decisión final tras múltiples iteraciones).
 *
 * El estado `rechazado` queda reservado para el dictamen final presidencial
 * (sesión 9). En 8b el peor desenlace automático es `observaciones`.
 */
export function estadoFinalDesdeVoto(
  ganador: TipoVoto,
):
  | "aprobado"
  | "aprobado_con_observaciones"
  | "observaciones" {
  switch (ganador) {
    case "aprobar":
      return "aprobado";
    case "aprobar_con_observaciones":
      return "aprobado_con_observaciones";
    case "no_aprobar":
      return "observaciones";
    case "abstener":
      throw new Error(
        "estadoFinalDesdeVoto no acepta 'abstener' — esto indica un cierre sin votos decisivos.",
      );
  }
}
