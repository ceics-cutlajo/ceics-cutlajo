import Link from "next/link";
import { listarBandejaComite } from "@/lib/protocolos/queries";
import { ETIQUETAS_ESTADO, type EstadoProtocolo } from "@/types/domain";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function BandejaComitePage() {
  const protocolos = await listarBandejaComite();

  const pendientes = protocolos.filter((p) => !p.conflictoInteres);
  const conflicto = protocolos.filter((p) => p.conflictoInteres);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comité"
        title="Bandeja de protocolos"
        description="Protocolos pendientes de tu evaluación. El sistema marca automáticamente los que tienen conflicto de interés."
      />

      {/* Pendientes */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-150 bg-ink-50 px-6 py-3">
          <div className="text-eyebrow text-ink-500">
            Pendientes ({pendientes.length})
          </div>
        </div>
        {pendientes.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-ink-500">
            No hay protocolos por revisar en este momento.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {pendientes.map((p) => (
              <ProtocoloRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      {/* Con conflicto de interés */}
      {conflicto.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-ink-150 bg-bad-soft px-6 py-3">
            <div className="text-eyebrow text-bad">
              Conflicto de interés — abstención obligatoria ({conflicto.length})
            </div>
          </div>
          <ul className="divide-y divide-ink-100">
            {conflicto.map((p) => (
              <ProtocoloRow key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

function ProtocoloRow({
  p,
}: {
  p: Awaited<ReturnType<typeof listarBandejaComite>>[number];
}) {
  return (
    <li>
      <Link
        href={`/comite/protocolo/${p.id}`}
        className="flex items-start gap-4 px-6 py-4 hover:bg-ink-50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-500">{p.clave ?? "—"}</span>
            <EstadoBadge estado={p.estado} />
            {p.conflictoInteres && (
              <span className="inline-flex items-center rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">
                Abstención obligatoria
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium text-ink-900">{p.titulo}</h3>
          <p className="mt-1 text-xs text-ink-500">
            IP: {p.ip_nombre}
            {p.submitted_at && (
              <>
                {" "}
                · Enviado{" "}
                {new Date(p.submitted_at).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--accent)]">Abrir →</span>
      </Link>
    </li>
  );
}

function EstadoBadge({ estado }: { estado: EstadoProtocolo }) {
  const colores: Record<EstadoProtocolo, string> = {
    borrador: "bg-ink-100 text-ink-700",
    en_evaluacion_ia: "bg-warn-soft text-warn",
    en_revision_comite: "bg-warn-soft text-warn",
    listo_dictamen: "bg-warn-soft text-warn",
    aprobado: "bg-good-soft text-good",
    aprobado_con_observaciones: "bg-good-soft text-good",
    observaciones: "bg-warn-soft text-warn",
    rechazado: "bg-bad-soft text-bad",
    retirado: "bg-ink-100 text-ink-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colores[estado]}`}
    >
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}
