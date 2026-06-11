import Link from "next/link";

export function BannerEmitirDictamen({
  protocoloId,
  recomendacion,
  modo = "presidente",
}: {
  protocoloId: string;
  recomendacion: string | null;
  /** "presidente": flujo normal. "delegacion_secretaria": Secretaría firma por COI presidencial. */
  modo?: "presidente" | "delegacion_secretaria";
}) {
  const etiqueta = etiquetaRecomendacion(recomendacion);
  const esDelegacion = modo === "delegacion_secretaria";
  return (
    <section
      className={
        esDelegacion
          ? "card border border-brand-wine/40 bg-brand-wine/5 p-6"
          : "card border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-6"
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={
              esDelegacion
                ? "text-eyebrow text-brand-red"
                : "text-eyebrow text-[var(--accent)]"
            }
          >
            {esDelegacion
              ? "Te corresponde firmar por delegación"
              : "Tienes una acción pendiente como Presidente"}
          </p>
          <h2 className="mt-1 text-display-2">
            {esDelegacion
              ? "Protocolo listo para tu dictamen (COI presidencial)"
              : "Protocolo listo para tu dictamen"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-700">
            {esDelegacion ? (
              <>
                El Presidente del CEICS figura como Investigador Principal de
                este protocolo y declaró conflicto de interés. Conforme al
                Reglamento Interno, te corresponde a ti, como Secretario(a),
                emitir y firmar el acta. Recomendación del comité:{" "}
                <strong>{etiqueta}</strong>.
              </>
            ) : (
              <>
                El comité cerró la votación con la recomendación{" "}
                <strong>{etiqueta}</strong>. Como Presidente debes emitir el
                acta oficial: revisa la votación, ajusta
                resolución/vigencia/observaciones si lo consideras necesario, y
                firma el dictamen final.
              </>
            )}
          </p>
        </div>
        <Link
          href={`/presidencia/dictamen/${protocoloId}`}
          className="btn-primary self-start whitespace-nowrap"
        >
          {esDelegacion ? "Emitir como Secretaría →" : "Emitir dictamen →"}
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
