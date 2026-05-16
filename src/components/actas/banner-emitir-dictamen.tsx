import Link from "next/link";

export function BannerEmitirDictamen({
  protocoloId,
  recomendacion,
}: {
  protocoloId: string;
  recomendacion: string | null;
}) {
  const etiqueta = etiquetaRecomendacion(recomendacion);
  return (
    <section className="card border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-eyebrow text-[var(--accent)]">
            Tienes una acción pendiente como Presidente
          </p>
          <h2 className="mt-1 text-display-2">Protocolo listo para tu dictamen</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-700">
            El comité cerró la votación con la recomendación{" "}
            <strong>{etiqueta}</strong>. Como Presidente debes emitir el acta
            oficial: revisa la votación, ajusta resolución/vigencia/observaciones
            si lo consideras necesario, y firma el dictamen final.
          </p>
        </div>
        <Link
          href={`/presidencia/dictamen/${protocoloId}`}
          className="btn-primary self-start whitespace-nowrap"
        >
          Emitir dictamen →
        </Link>
      </div>
    </section>
  );
}

function etiquetaRecomendacion(r: string | null): string {
  switch (r) {
    case "aprobar":
      return "Aprobar";
    case "aprobar_con_observaciones":
      return "Aprobar con observaciones";
    case "no_aprobar":
      return "No aprobar (devolver con observaciones)";
    case "sin_decisivos":
      return "Sin votos decisivos";
    default:
      return "(sin recomendación)";
  }
}
