import {
  agruparPorCategoria,
  ETIQUETAS_CATEGORIA,
  CATEGORIAS,
  ITEMS_RESPONSABILIDAD_COMITE,
  type ChecklistItem,
  type Severidad,
} from "@/lib/checklist";
import { PageHeader } from "@/components/layout/PageHeader";

// Mapa de severidad → clases de badge. Usa los tokens soft/strong de
// globals.css + tailwind.config (ok/warn/bad/info, ink-50..900).
const SEVERIDAD_BADGE: Record<Severidad, string> = {
  critica: "bg-bad-soft text-bad",
  alta: "bg-warn-soft text-warn",
  media: "bg-ink-100 text-ink-700",
  baja: "bg-ink-50 text-ink-600",
};

const SEVERIDAD_LABEL: Record<Severidad, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

// Aclaraciones de POLÍTICA del CEICS para ítems cuya norma cruda (criterio) es
// más estricta que lo que el Comité exige en la práctica. No reescribimos el
// criterio normativo; lo matizamos para no confundir al investigador.
const NOTAS_POLITICA_CEICS: Record<string, string> = {
  "CHK-002":
    "Política del CEICS: basta tu resumen curricular y tu adscripción institucional. NO se exige cédula profesional ni firma en el CV. La constancia de BPC solo aplica a investigación clínica con intervención.",
  "CHK-005":
    "Política del CEICS: la autorización de sede solo aplica si el estudio tiene una sede física (hospital/clínica). Los estudios con bases de datos abiertas/públicas o datos secundarios no requieren autorización de sede.",
};

// ---------------------------------------------------------------------------
// Principios
// ---------------------------------------------------------------------------

const PRINCIPIOS = [
  {
    titulo: "Marco normativo",
    parrafos: [
      "La evaluación de todo protocolo se rige por la Ley General de Salud y su Reglamento en Materia de Investigación para la Salud, la NOM-012-SSA3-2012, la Declaración de Helsinki (2024), las pautas CIOMS y la Guía ICH-GCP E6(R3), además de la normativa de la Universidad de Guadalajara.",
    ],
    enlaceNormatividad: true,
  },
  {
    titulo: "Honestidad e integridad científica",
    parrafos: [
      "El protocolo debe ser veraz, original y reproducible. El investigador declara conflictos de interés y fuentes de financiamiento, y se compromete a NO incurrir en fabricación, falsificación ni plagio de datos o textos.",
      "El título, los objetivos y la población deben coincidir EXACTAMENTE entre la carta de solicitud, el protocolo y el consentimiento. La autoría y la delegación de responsabilidades deben reflejar la participación real de cada integrante del equipo.",
    ],
    enlaceNormatividad: false,
  },
  {
    titulo: "Buenas prácticas clínicas (BPC)",
    parrafos: [
      "Estándar internacional (ICH-GCP) para el diseño, conducción, registro y reporte de estudios con seres humanos: protección y bienestar de los participantes por encima de los intereses de la ciencia, consentimiento informado válido, manejo y resguardo confidencial de los datos, registro fidedigno y trazable de la información, y constancia vigente de BPC del investigador en estudios clínicos.",
    ],
    enlaceNormatividad: false,
  },
] as const;

// ---------------------------------------------------------------------------
// Documentos requeridos
// ---------------------------------------------------------------------------

type Documento = {
  clave: string;
  label: string;
  obligatoriedad: string;
  descripcion: string;
  descarga?: string;
};

const DOCUMENTOS: Documento[] = [
  {
    clave: "carta_presidente",
    label: "Carta al Presidente del CEICS",
    obligatoriedad: "Obligatorio",
    descarga: "/formatos/carta-presidente-ejemplo.docx",
    descripcion:
      "Carta dirigida al Presidente del CEICS exponiendo los motivos del estudio y solicitando su evaluación por el Comité. Se dirige a la Presidencia con atención a la Secretaría.",
  },
  {
    clave: "formato_protocolo",
    label: "Formato de protocolo CEICS",
    obligatoriedad: "Obligatorio",
    descarga: "/formatos/formato-protocolo-ceics.docx",
    descripcion:
      "Protocolo completo siguiendo el formato oficial del CEICS (28 secciones): introducción, antecedentes, justificación, objetivos, material y métodos, criterios de inclusión/exclusión/eliminación, operacionalización de variables, análisis, cronograma, consideraciones éticas, referencias y anexos.",
  },
  {
    clave: "delegacion",
    label: "Delegación de responsabilidades",
    obligatoriedad: "Obligatorio",
    descarga: "/formatos/delegacion-responsabilidades.docx",
    descripcion:
      "Carta donde el Investigador Principal delega entre los miembros del equipo las 15 actividades del estudio (concepción y escritura, obtención del consentimiento, registro y análisis de datos, reporte de eventos adversos, manejo de muestras y del producto de investigación, trámites ante el Comité, etc.).",
  },
  {
    clave: "cv_ip",
    label: "Resumen curricular del Investigador Principal",
    obligatoriedad: "Obligatorio",
    descripcion:
      "Resumen curricular del Investigador Principal y de los participantes, en un máximo de 5 cuartillas. No anexar documentos probatorios.",
  },
  {
    clave: "bpc",
    label: "Constancia de Buenas Prácticas Clínicas",
    obligatoriedad: "Si aplica: investigación clínica",
    descripcion:
      "Carta compromiso o constancia vigente de Buenas Prácticas Clínicas del investigador. Obligatoria en investigación clínica con seres humanos.",
  },
  {
    clave: "consentimiento",
    label: "Consentimiento informado",
    obligatoriedad: "Si aplica: involucra seres humanos",
    descripcion:
      "Modelo de la carta de consentimiento informado que firmarán los participantes. Debe cumplir los elementos de los artículos 21 y 22 del Reglamento de la LGS en Materia de Investigación: información clara del estudio, riesgos y beneficios, voluntariedad y derecho a retirarse sin consecuencias, confidencialidad de los datos, y datos de contacto del Investigador Principal y del CEICS.",
  },
  {
    clave: "asentimiento",
    label: "Asentimiento informado",
    obligatoriedad: "Si aplica: población pediátrica (menores)",
    descripcion:
      "Carta de asentimiento redactada en lenguaje comprensible para menores de edad, complementaria al consentimiento informado que firma el padre/madre o representante legal.",
  },
];

const ORDEN_DOCUMENTOS = {
  label: "Orden de los documentos requeridos",
  descarga: "/formatos/orden-documentos-requeridos.docx",
  descripcion:
    "Documento oficial del CEICS con la lista y el orden de los documentos para el sometimiento.",
} as const;

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function RequisitosPage() {
  const grupos = agruparPorCategoria();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sometimiento de protocolos"
        title="Requisitos para someter un protocolo"
        description="Lo que necesitas preparar, los documentos a entregar y los 100 puntos que evalúa el pre-análisis del CEICS."
      />

      {/* 1. Principios --------------------------------------------------- */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PRINCIPIOS.map((p) => (
          <div key={p.titulo} className="card p-6">
            <h3 className="text-display-2">{p.titulo}</h3>
            {p.parrafos.map((parrafo, i) => (
              <p key={i} className="mt-3 text-ink-700">
                {parrafo}
              </p>
            ))}
            {p.enlaceNormatividad && (
              <p className="mt-3">
                <a href="/normatividad" className="text-[var(--accent)]">
                  Ver la normatividad aplicable completa →
                </a>
              </p>
            )}
          </div>
        ))}
      </section>

      {/* 2. Documentos requeridos --------------------------------------- */}
      <section className="space-y-4">
        <div className="card p-6">
          <h2 className="text-display-2">Documentos requeridos</h2>
          <p className="mt-2 text-ink-700">
            Todo sometimiento debe incluir los siguientes documentos. Las
            plantillas marcadas se pueden descargar; el resto los elabora el
            investigador conforme a la guía.
          </p>
        </div>

        <ul className="space-y-4">
          {DOCUMENTOS.map((d) => (
            <li key={d.clave} className="card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-ink-900">
                  {d.label}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    d.obligatoriedad === "Obligatorio"
                      ? "bg-ok-soft text-ok"
                      : "bg-warn-soft text-warn"
                  }`}
                >
                  {d.obligatoriedad}
                </span>
              </div>
              <p className="mt-2 text-ink-700">{d.descripcion}</p>
              {d.descarga && (
                <div className="mt-4">
                  <a
                    href={d.descarga}
                    download
                    className="btn-secondary text-sm"
                  >
                    Descargar plantilla (.docx)
                  </a>
                </div>
              )}
            </li>
          ))}

          {/* Referencia: Orden de los documentos (nota final) */}
          <li className="card border-dashed bg-ink-50 p-5">
            <h3 className="text-lg font-semibold text-ink-900">
              {ORDEN_DOCUMENTOS.label}
            </h3>
            <p className="mt-2 text-ink-700">{ORDEN_DOCUMENTOS.descripcion}</p>
            <div className="mt-4">
              <a
                href={ORDEN_DOCUMENTOS.descarga}
                download
                className="btn-secondary text-sm"
              >
                Descargar plantilla (.docx)
              </a>
            </div>
          </li>
        </ul>
      </section>

      {/* 3. Qué evalúa la IA (los 100 puntos) --------------------------- */}
      <section className="space-y-4">
        <div className="card p-6">
          <h2 className="text-display-2">
            Qué evalúa la inteligencia artificial (los 100 puntos)
          </h2>
          <p className="mt-2 text-ink-700">
            Antes de llegar al Comité, cada protocolo pasa por un pre-análisis
            automatizado que lo contrasta contra un checklist consolidado de 100
            criterios (CHK-001 a CHK-100), agrupados en 11 secciones temáticas.
            El Comité revisa después por estas mismas secciones. Conocerlos te
            permite preparar un protocolo más sólido y cuidar cada punto antes
            de someter.
          </p>
          <p className="mt-2 text-ink-700">
            Los 8 puntos marcados como «Responsabilidad del Comité» evalúan la
            gobernanza del propio CEICS (no tu protocolo); se muestran por
            transparencia.
          </p>
        </div>

        {CATEGORIAS.map((cat) => {
          const items = grupos[cat];
          return (
            <details key={cat} className="card">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-ink-900">
                <span className="text-lg font-semibold">
                  {ETIQUETAS_CATEGORIA[cat]}
                </span>
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
                  {items.length} {items.length === 1 ? "ítem" : "ítems"}
                </span>
              </summary>
              <ul className="space-y-3 border-t border-ink-150 px-5 py-4">
                {items.map((item) => (
                  <ItemChecklist key={item.id} item={item} />
                ))}
              </ul>
            </details>
          );
        })}
      </section>
    </div>
  );
}

function ItemChecklist({ item }: { item: ChecklistItem }) {
  const esComite = ITEMS_RESPONSABILIDAD_COMITE.has(item.id);
  return (
    <li className="rounded-md border border-ink-150 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-600">{item.id}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERIDAD_BADGE[item.severidad]}`}
        >
          {SEVERIDAD_LABEL[item.severidad]}
        </span>
        {esComite && (
          <span className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
            Responsabilidad del Comité
          </span>
        )}
      </div>
      <p className="mt-2 text-ink-800">{item.criterio}</p>
      <p className="mt-1 text-sm text-ink-600">{item.evidencia_esperada}</p>
      {NOTAS_POLITICA_CEICS[item.id] && (
        <p className="mt-2 rounded-md border border-info/30 bg-info-soft px-3 py-2 text-sm text-info">
          {NOTAS_POLITICA_CEICS[item.id]}
        </p>
      )}
      {item.fuentes && item.fuentes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Fundamento
          </span>
          {item.fuentes.map((f) => (
            <a
              key={f.ref}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
            >
              {f.ref}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
