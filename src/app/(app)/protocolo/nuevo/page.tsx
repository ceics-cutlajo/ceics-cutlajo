import { crearYEditarProtocoloAction } from "@/lib/protocolos/actions";

/**
 * Entry point para iniciar un nuevo protocolo.
 * Server Action que crea borrador y redirige al editor del wizard.
 */
export default function NuevoProtocoloPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-eyebrow text-ink-500">Sometimiento</p>
        <h1 className="text-display-1 mt-1">Nuevo protocolo</h1>
        <p className="mt-2 text-ink-600">
          Antes de comenzar, asegúrate de tener listos los 7 documentos requeridos por el CEICS en
          formato PDF o Word.
        </p>
      </header>

      <div className="card p-8">
        <h2 className="text-display-2">Documentos requeridos</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-ink-700">
          <li>Carta dirigida al Presidente del CEICS</li>
          <li>Formato de protocolo CEICS (28 secciones)</li>
          <li>Carta de delegación de responsabilidades firmada</li>
          <li>CV resumido del Investigador Principal (máx. 5 cuartillas)</li>
          <li>
            Constancia de Buenas Prácticas Clínicas{" "}
            <span className="text-ink-400">(solo investigación clínica)</span>
          </li>
          <li>
            Consentimiento informado{" "}
            <span className="text-ink-400">(si involucra humanos)</span>
          </li>
          <li>
            Asentimiento pediátrico{" "}
            <span className="text-ink-400">(si involucra menores de edad)</span>
          </li>
        </ol>

        <form action={crearYEditarProtocoloAction} className="mt-6">
          <button type="submit" className="btn-primary">
            Crear borrador y comenzar →
          </button>
        </form>

        <p className="mt-4 text-xs text-ink-500">
          Crearemos un borrador asociado a tu cuenta. Podrás editarlo cuantas veces quieras antes de
          enviarlo al CEICS.
        </p>
      </div>
    </div>
  );
}
