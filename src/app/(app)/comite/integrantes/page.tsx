import Image from "next/image";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  INTEGRANTES_COMITE,
  ETIQUETA_ROL_COMITE,
  inicialesIntegrante,
  type IntegranteComite,
} from "@/lib/comite/integrantes";

export const dynamic = "force-dynamic";

export default function ComiteIntegrantesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CEICS · CUTLAJO"
        title="Integrantes del Comité"
        description="Comité de Ética en Investigación en Ciencias de la Salud de la División de Salud, Centro Universitario de Tlajomulco (UdeG). Conoce la trayectoria de quienes evalúan los protocolos."
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {INTEGRANTES_COMITE.map((m) => (
          <TarjetaIntegrante key={m.nombre} integrante={m} />
        ))}
      </div>
    </div>
  );
}

function TarjetaIntegrante({ integrante }: { integrante: IntegranteComite }) {
  const esPresidente = integrante.rolComite === "presidente";

  return (
    <article className="card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Avatar integrante={integrante} />
        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
              esPresidente
                ? "bg-navy-500/10 text-navy-700"
                : "bg-brand-wine/10 text-brand-red"
            }`}
          >
            {ETIQUETA_ROL_COMITE[integrante.rolComite]}
          </span>
          <h2 className="mt-1 truncate font-display text-lg font-semibold text-ink-900">
            {integrante.nombre}
          </h2>
          <p className="truncate text-xs text-ink-500">{integrante.cargoTitulo}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-ink-700">{integrante.resena}</p>

      {integrante.orcid && (
        <a
          href={`https://orcid.org/${integrante.orcid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex w-fit items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          <span className="font-mono">ORCID</span>
          <span className="text-ink-500">{integrante.orcid}</span>
        </a>
      )}
    </article>
  );
}

function Avatar({ integrante }: { integrante: IntegranteComite }) {
  if (integrante.foto) {
    return (
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-ink-200">
        <Image
          src={integrante.foto}
          alt={`Fotografía de ${integrante.nombre}`}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xl font-semibold text-white ring-2 ring-ink-200">
      {inicialesIntegrante(integrante.nombre)}
    </div>
  );
}
