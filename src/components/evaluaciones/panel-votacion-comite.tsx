/**
 * Panel presentacional de la votación del comité por protocolo.
 * Muestra a cada miembro elegible con el sentido de su voto (o "Pendiente" /
 * "En conflicto de interés"). Sin comentarios individuales.
 */
import type { VotoMiembro } from "@/lib/evaluaciones/transparencia";
import type { TipoVoto } from "@/lib/evaluaciones/types";

const ETIQUETA_VOTO: Record<TipoVoto, string> = {
  aprobar: "Aprueba",
  aprobar_con_observaciones: "Aprueba con observaciones",
  no_aprobar: "No aprueba",
  abstener: "Abstención",
};

const COLOR_VOTO: Record<TipoVoto, string> = {
  aprobar: "bg-good-soft text-good",
  aprobar_con_observaciones: "bg-warn-soft text-warn",
  no_aprobar: "bg-bad-soft text-bad",
  abstener: "bg-ink-100 text-ink-600",
};

function etiquetaEstado(v: VotoMiembro): { texto: string; clase: string } {
  if (v.estado === "pendiente") {
    return { texto: "Pendiente", clase: "border border-ink-200 text-ink-400" };
  }
  if (v.estado === "conflicto") {
    return { texto: "En conflicto de interés", clase: "bg-ink-100 text-ink-500" };
  }
  const voto = v.voto ?? "abstener";
  return { texto: ETIQUETA_VOTO[voto], clase: COLOR_VOTO[voto] };
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

export function PanelVotacionComite({
  votos,
  className = "",
  titulo = "Votación del comité",
}: {
  votos: VotoMiembro[];
  className?: string;
  titulo?: string;
}) {
  const emitidos = votos.filter((v) => v.estado === "voto").length;
  const totalVotantes = votos.filter((v) => v.estado !== "conflicto").length;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-display-2">{titulo}</h2>
        <span className="text-sm text-ink-500">
          {emitidos} de {totalVotantes}{" "}
          {emitidos === 1 ? "voto emitido" : "votos emitidos"}
        </span>
      </div>
      {votos.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">
          Aún no hay miembros del comité registrados.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-150">
          {votos.map((v) => {
            const e = etiquetaEstado(v);
            return (
              <li
                key={v.miembroId}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="text-sm text-ink-800">
                  {v.nombre} {v.apellidoPaterno}
                  {v.esPresidente && (
                    <span className="ml-2 text-xs text-ink-400">· Presidencia</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {v.estado === "voto" && v.votadoAt && (
                    <span className="text-xs text-ink-400">
                      {fechaCorta(v.votadoAt)}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${e.clase}`}
                  >
                    {e.texto}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Indicador compacto (puntos de color) para listas como la bandeja. */
export function ResumenVotosCompacto({ votos }: { votos: VotoMiembro[] }) {
  const colorPunto = (v: VotoMiembro): string => {
    if (v.estado === "pendiente") return "bg-ink-200";
    if (v.estado === "conflicto") return "bg-ink-300";
    switch (v.voto) {
      case "aprobar":
        return "bg-good";
      case "aprobar_con_observaciones":
        return "bg-warn";
      case "no_aprobar":
        return "bg-bad";
      default:
        return "bg-ink-400";
    }
  };
  const emitidos = votos.filter((v) => v.estado === "voto").length;
  const totalVotantes = votos.filter((v) => v.estado !== "conflicto").length;

  if (votos.length === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Votación del comité: ${emitidos} de ${totalVotantes}`}
    >
      <span className="flex gap-0.5">
        {votos.map((v) => (
          <span
            key={v.miembroId}
            className={`h-2 w-2 rounded-full ${colorPunto(v)}`}
          />
        ))}
      </span>
      <span className="text-xs text-ink-500">
        {emitidos}/{totalVotantes}
      </span>
    </span>
  );
}
