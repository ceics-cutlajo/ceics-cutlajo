import Link from "next/link";

export default function NuevoProtocoloPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-eyebrow text-ink-500">Sometimiento</p>
        <h1 className="text-display-1 mt-1">Nuevo protocolo</h1>
      </header>

      <div className="card p-8">
        <div className="rounded-md bg-warn-soft px-4 py-3 text-sm text-warn">
          🛠️ <strong>En construcción</strong> — el formulario completo de sometimiento (datos del
          proyecto, co-investigadores y carga de los 7 documentos) se implementa en la sesión 4.
        </div>
        <p className="mt-4 text-ink-600">
          Mientras tanto, puedes revisar la normatividad aplicable y preparar tus documentos en los
          formatos oficiales del CEICS.
        </p>
        <Link href="/normatividad" className="btn-secondary mt-4 inline-flex">
          Ver normatividad
        </Link>
      </div>
    </div>
  );
}
