import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type Norma = { label: string; href: string };

// Enlaces a las fuentes oficiales. Verificados en mayo 2026; los PDF de
// gobierno (diputados/secgral UDG) apuntan al texto vigente publicado.
const MEXICANA: Norma[] = [
  {
    label: "Ley General de Salud (Título Quinto)",
    href: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGS.pdf",
  },
  {
    label: "Reglamento LGS en Materia de Investigación para la Salud",
    href: "https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MIS.pdf",
  },
  {
    label: "NOM-012-SSA3-2012",
    href: "https://www.dof.gob.mx/nota_detalle.php?codigo=5284148&fecha=04/01/2013",
  },
  {
    label: "Lineamientos CONBIOÉTICA",
    href: "https://www.gob.mx/salud/conbioetica",
  },
  {
    label: "Código de Bioética para el Personal de Salud (CONBIOÉTICA)",
    href: "https://www.gob.mx/salud/conbioetica/es/articulos/codigo-de-bioetica-para-el-personal-de-salud?idiom=es",
  },
  {
    label: "COFEPRIS — protocolos con medicamentos",
    href: "https://www.gob.mx/cofepris",
  },
  {
    label: "LGPDPPSO — datos personales",
    href: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf",
  },
  {
    label: "Estatuto General UDG",
    href: "https://secgral.udg.mx/sites/default/files/Normatividad_general/EG%20Noviembre%202025.pdf",
  },
  {
    label: "Código de Ética UDG",
    href: "https://secgral.udg.mx/sites/default/files/Normatividad_general/2018-03-02-codigo-de-etica-feb2018.pdf",
  },
];

const INTERNACIONAL: Norma[] = [
  {
    label: "Código de Núremberg (1947)",
    href: "https://history.nih.gov/display/history/Nuremberg+Code",
  },
  {
    label: "Declaración de Helsinki — WMA 2024",
    href: "https://www.wma.net/policies-post/wma-declaration-of-helsinki/",
  },
  {
    label: "Reporte Belmont (1979)",
    href: "https://www.hhs.gov/ohrp/regulations-and-policy/belmont-report/index.html",
  },
  {
    label: "Pautas CIOMS-OMS 2016 (25 pautas)",
    href: "https://cioms.ch/publications/product/international-ethical-guidelines-for-health-related-research-involving-humans/",
  },
  {
    label: "ICH-GCP E6(R3) — enero 2025",
    href: "https://www.ich.org/page/efficacy-guidelines",
  },
  {
    label: "Convenio de Oviedo (Consejo de Europa)",
    href: "https://www.coe.int/en/web/bioethics/oviedo-convention",
  },
  {
    label: "UNESCO · Declaración de Bioética 2005",
    href: "https://www.unesco.org/en/legal-affairs/universal-declaration-bioethics-and-human-rights",
  },
  {
    label: "Estándares OMS 2011 para CEI",
    href: "https://iris.who.int/handle/10665/44783",
  },
];

export default function NormatividadPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Marco normativo"
        title="Normatividad aplicable"
        description="La evaluación de protocolos se realiza contra un checklist consolidado de 100 ítems basado en normatividad mexicana e internacional. Cada referencia enlaza a su fuente oficial."
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Bloque titulo="Normatividad mexicana" items={MEXICANA} />
        <Bloque titulo="Normatividad internacional" items={INTERNACIONAL} />
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

function Bloque({ titulo, items }: { titulo: string; items: Norma[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-display-2">{titulo}</h3>
      <ul className="mt-4 space-y-1 text-sm text-ink-700">
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 rounded-md px-2 py-1.5 -mx-2 transition-colors hover:bg-ink-50 hover:text-[var(--accent)]"
            >
              <ExternalLink
                size={14}
                className="mt-0.5 flex-shrink-0 text-[var(--accent)]"
              />
              <span className="underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current">
                {it.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
