import { NuevoProtocoloForm } from "./form";

/**
 * Pantalla "Nuevo protocolo" — el investigador elige entre:
 *   A) Subir su .docx/.pdf y dejar que la IA pre-llene el wizard
 *   B) Empezar desde cero con el wizard manual
 */
export default function NuevoProtocoloPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-eyebrow uppercase tracking-widest text-brand-magenta">
          Sometimiento
        </p>
        <h1 className="text-display-1 mt-1 text-ink-900">Nuevo protocolo</h1>
        <p className="mt-2 text-ink-700">
          Elige cómo quieres empezar. Si ya tienes el protocolo redactado en Word o PDF, la IA lee
          el documento y rellena el formulario por ti.
        </p>
      </header>

      <NuevoProtocoloForm />

      <details className="text-sm text-ink-700">
        <summary className="cursor-pointer font-medium hover:text-ink-900">
          ¿Qué documentos necesito tener listos?
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-6">
          <li>Carta dirigida al Presidente del CEICS</li>
          <li>Formato de protocolo CEICS (28 secciones)</li>
          <li>Carta de delegación de responsabilidades firmada</li>
          <li>CV resumido del Investigador Principal (máx. 5 cuartillas)</li>
          <li>Constancia de Buenas Prácticas Clínicas (solo investigación clínica)</li>
          <li>Consentimiento informado (si involucra humanos)</li>
          <li>Asentimiento pediátrico (si involucra menores de edad)</li>
        </ol>
        <p className="mt-2 text-ink-600">
          Solo el formato de protocolo se necesita para arrancar; los demás se suben en el wizard.
        </p>
      </details>
    </div>
  );
}
