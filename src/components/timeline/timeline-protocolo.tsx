/**
 * Timeline visual estilo Frontiers para mostrar la fase del protocolo.
 * Server Component: recibe ya derivado el snapshot del timeline.
 */
import type { TimelineSnapshot, Etapa } from "@/lib/timeline/derivar-etapa";
import type { ProtocoloCompleto, CoInvestigadorRow } from "@/lib/protocolos/queries";
import {
  ETIQUETAS_AREA,
  ETIQUETAS_TIPO_INV,
  ETIQUETAS_RIESGO,
} from "@/lib/protocolos/schemas";
import { ETIQUETAS_ESTADO } from "@/types/domain";

type Props = {
  protocolo: Pick<
    ProtocoloCompleto,
    | "clave"
    | "titulo"
    | "estado"
    | "submitted_at"
    | "area_conocimiento_id"
    | "tipo_investigacion_id"
    | "clasificacion_riesgo"
  >;
  ipNombre: string;
  coInvestigadores: Pick<CoInvestigadorRow, "nombre" | "apellido_paterno" | "apellido_materno">[];
  timeline: TimelineSnapshot;
  /** Solo presente para la vista del comité; activa el estado contextual con conteo. */
  progresoVotacion?: { emitidos: number; total: number };
  /** True cuando el Presidente titular es el IP y la Secretaría firma por delegación. */
  firmaPorDelegacion?: boolean;
};

export function TimelineProtocolo({
  protocolo,
  ipNombre,
  coInvestigadores,
  timeline,
  progresoVotacion,
  firmaPorDelegacion,
}: Props) {
  const coInvNombres = coInvestigadores
    .map((c) =>
      `${c.nombre} ${c.apellido_paterno}${c.apellido_materno ? " " + c.apellido_materno : ""}`.trim(),
    )
    .filter(Boolean);

  const contexto = generarMensajeContextual(
    protocolo.estado,
    timeline,
    progresoVotacion,
    firmaPorDelegacion,
  );

  return (
    <section aria-label="Fase del protocolo" className="card overflow-hidden">
      {/* Barra de etapas */}
      <div className="border-b border-ink-150 bg-ink-50 px-4 py-6 sm:px-6">
        <BarraEtapas etapas={timeline.etapas} rondaComite={timeline.rondaComite} />
      </div>

      {/* Card metadata */}
      <div className="space-y-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-eyebrow text-ink-500">
            {protocolo.clave ? `Protocolo ${protocolo.clave}` : "Protocolo"}
          </span>
          <span className="text-eyebrow text-ink-300">·</span>
          <span className="text-eyebrow text-accent">{ETIQUETAS_ESTADO[protocolo.estado]}</span>
        </div>

        <h2 className="text-lg font-semibold leading-snug text-ink-900">{protocolo.titulo}</h2>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Linea label="Investigador principal" valor={ipNombre} />
          <Linea
            label="Co-investigadores"
            valor={coInvNombres.length > 0 ? coInvNombres.join(", ") : "—"}
          />
          <Linea
            label="Sometido"
            valor={
              protocolo.submitted_at
                ? new Date(protocolo.submitted_at).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"
            }
          />
          <Linea
            label="Clasificación de riesgo"
            valor={
              protocolo.clasificacion_riesgo
                ? ETIQUETAS_RIESGO[protocolo.clasificacion_riesgo]
                : "—"
            }
          />
          <Linea
            label="Área de conocimiento"
            valor={
              protocolo.area_conocimiento_id
                ? ETIQUETAS_AREA[protocolo.area_conocimiento_id]
                : "—"
            }
          />
          <Linea
            label="Tipo de investigación"
            valor={
              protocolo.tipo_investigacion_id
                ? ETIQUETAS_TIPO_INV[
                    protocolo.tipo_investigacion_id as keyof typeof ETIQUETAS_TIPO_INV
                  ]
                : "—"
            }
          />
        </dl>

        {contexto && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-ink-150 bg-ink-50 px-3 py-2 text-sm text-ink-700">
            <span aria-hidden className="mt-0.5 text-accent">ℹ</span>
            <p>{contexto}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function BarraEtapas({ etapas, rondaComite }: { etapas: Etapa[]; rondaComite: number }) {
  return (
    <ol className="flex w-full items-start gap-0 overflow-x-auto pb-1">
      {etapas.map((etapa, idx) => {
        const ultima = idx === etapas.length - 1;
        return (
          <li
            key={etapa.numero}
            className="relative flex flex-1 flex-col items-center"
            style={{ minWidth: 0 }}
          >
            <div className="flex w-full items-center">
              {/* Línea izquierda (oculta en primera) */}
              <SegmentoLinea visible={idx > 0} estado={estadoDelSegmentoIzq(etapas, idx)} />
              <CirculoEtapa etapa={etapa} rondaComite={rondaComite} />
              {/* Línea derecha (oculta en última) */}
              <SegmentoLinea visible={!ultima} estado={estadoDelSegmentoDer(etapas, idx)} />
            </div>
            <span
              className={`mt-2 text-center text-sm font-bold leading-tight ${
                etapa.estado === "actual"
                  ? "text-accent"
                  : etapa.estado === "no_aplica"
                    ? "text-navy-600/40"
                    : "text-navy-600"
              }`}
            >
              {etapa.nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CirculoEtapa({ etapa, rondaComite }: { etapa: Etapa; rondaComite: number }) {
  const base = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold";

  if (etapa.estado === "completada") {
    return (
      <div
        className={`${base} bg-navy-500 text-white shadow-sm`}
        title={`Etapa ${etapa.numero} completada`}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (etapa.estado === "actual") {
    return (
      <div className="relative">
        <span className="absolute inset-0 -m-1 rounded-full bg-navy-500/20 animate-pulse" aria-hidden />
        <div
          className={`${base} relative bg-navy-500 text-white shadow-sm`}
          title={`Etapa actual: ${etapa.nombre}${etapa.numero === 5 && rondaComite > 1 ? ` (ronda ${rondaComite})` : ""}`}
        >
          {etapa.numero}
        </div>
      </div>
    );
  }

  if (etapa.estado === "no_aplica") {
    return (
      <div
        className={`${base} border border-dashed border-ink-200 bg-ink-0 text-ink-300`}
        title="Etapa no aplica en este protocolo"
      >
        {etapa.numero}
      </div>
    );
  }

  // pendiente
  return (
    <div
      className={`${base} border border-ink-200 bg-ink-0 text-ink-400`}
      title={`Etapa ${etapa.numero}: ${etapa.nombre} (pendiente)`}
    >
      {etapa.numero}
    </div>
  );
}

function SegmentoLinea({
  visible,
  estado,
}: {
  visible: boolean;
  estado: "completada" | "pendiente" | "no_aplica";
}) {
  if (!visible) return <span className="flex-1" aria-hidden />;
  const color =
    estado === "completada"
      ? "bg-navy-500"
      : estado === "no_aplica"
        ? "bg-ink-150"
        : "bg-ink-200";
  return <span aria-hidden className={`h-0.5 flex-1 ${color}`} />;
}

function estadoDelSegmentoIzq(etapas: Etapa[], idx: number): "completada" | "pendiente" | "no_aplica" {
  // El segmento izquierdo entre i-1 e i: si la anterior está completada y la actual no es "no_aplica", coloreado
  const anterior = etapas[idx - 1];
  const actual = etapas[idx];
  if (!anterior) return "pendiente";
  if (actual.estado === "no_aplica" || anterior.estado === "no_aplica") return "no_aplica";
  if (anterior.estado === "completada") return "completada";
  return "pendiente";
}

function estadoDelSegmentoDer(etapas: Etapa[], idx: number): "completada" | "pendiente" | "no_aplica" {
  const actual = etapas[idx];
  const siguiente = etapas[idx + 1];
  if (!siguiente) return "pendiente";
  if (actual.estado === "no_aplica" || siguiente.estado === "no_aplica") return "no_aplica";
  if (actual.estado === "completada") return "completada";
  return "pendiente";
}

function Linea({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 truncate text-ink-900" title={valor}>
        {valor}
      </dd>
    </div>
  );
}

function generarMensajeContextual(
  estado: Props["protocolo"]["estado"],
  timeline: TimelineSnapshot,
  progreso?: { emitidos: number; total: number },
  firmaPorDelegacion?: boolean,
): string | null {
  switch (estado) {
    case "borrador":
      return "Este protocolo está en construcción. Aún no ha sido enviado al CEICS.";
    case "en_evaluacion_ia":
      return "La inteligencia artificial realizará un pre-análisis del protocolo que los miembros del comité analizarán y validarán manualmente.";
    case "en_revision_comite": {
      const ronda =
        timeline.etapaActual === 5
          ? `Segunda revisión por el comité (ronda ${timeline.rondaComite}).`
          : "El comité está evaluando el protocolo.";
      if (progreso && progreso.total > 0) {
        return `${ronda} ${progreso.emitidos} de ${progreso.total} miembro${progreso.total === 1 ? "" : "s"} ${progreso.emitidos === 1 ? "ha emitido" : "han emitido"} su voto.`;
      }
      return ronda;
    }
    case "observaciones":
      return "El comité solicitó correcciones. El investigador principal debe atender las observaciones y reenviar.";
    case "listo_dictamen":
      return firmaPorDelegacion
        ? "El comité concluyó su evaluación. La Secretaría debe emitir el dictamen final y firmar el acta por delegación del Presidente."
        : "El comité concluyó su evaluación. El Presidente debe emitir el dictamen final y firmar el acta.";
    case "aprobado":
      return "Protocolo aprobado por el CEICS. El acta oficial está disponible.";
    case "aprobado_con_observaciones":
      return "Protocolo aprobado con observaciones. El acta oficial incluye los puntos a vigilar durante el seguimiento.";
    case "rechazado":
      return "Protocolo no aprobado por el CEICS. Consulte el acta para conocer los motivos.";
    case "retirado":
      return "Protocolo retirado por el investigador.";
  }
}
