import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NormatividadPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Marco normativo"
        title="Normatividad aplicable"
        description="La evaluación de protocolos se realiza contra un checklist consolidado de 100 ítems basado en normatividad mexicana e internacional."
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Bloque
          titulo="Normatividad mexicana"
          items={[
            "Ley General de Salud (Título Quinto)",
            "Reglamento LGS en Materia de Investigación para la Salud",
            "NOM-012-SSA3-2012",
            "Lineamientos CONBIOÉTICA",
            "COFEPRIS — protocolos con medicamentos",
            "LGPDPPSO — datos personales",
            "Estatuto General UDG · Código de Ética UDG",
          ]}
        />
        <Bloque
          titulo="Normatividad internacional"
          items={[
            "Código de Núremberg (1947)",
            "Declaración de Helsinki — WMA 2024",
            "Reporte Belmont (1979)",
            "Pautas CIOMS-OMS 2016 (25 pautas)",
            "ICH-GCP E6(R3) — enero 2025",
            "Convenio de Oviedo · UNESCO Bioética 2005",
            "Estándares OMS 2011 para CEI",
          ]}
        />
      </section>

      <section className="card p-6">
        <h2 className="text-display-2">Documentación interna</h2>
        <p className="mt-2 text-ink-600">
          Acta de Instalación del CEICS y reglamento interno (próximamente).
        </p>
      </section>
    </div>
  );
}

function Bloque({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-display-2">{titulo}</h3>
      <ul className="mt-4 space-y-2 text-sm text-ink-700">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <ExternalLink size={14} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
