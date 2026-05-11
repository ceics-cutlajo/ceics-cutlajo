export default function BandejaComitePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-eyebrow text-ink-500">Comité</p>
        <h1 className="text-display-1 mt-1">Bandeja de protocolos</h1>
        <p className="mt-2 text-ink-600">
          Protocolos pendientes de tu evaluación. El sistema marca automáticamente los que tienen
          conflicto de interés.
        </p>
      </header>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-150 bg-ink-50 px-6 py-3 text-eyebrow text-ink-500">
          Pendientes
        </div>
        <div className="px-6 py-12 text-center text-sm text-ink-500">
          No hay protocolos por revisar en este momento.
        </div>
      </div>

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ La interfaz de votación se implementa en la sesión 5. Por ahora solo verás esta bandeja
        vacía aunque haya protocolos en evaluación.
      </div>
    </div>
  );
}
