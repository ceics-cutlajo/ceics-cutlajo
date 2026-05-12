export const dynamic = "force-dynamic";

export default function PresidenciaActasPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-eyebrow text-ink-500">Presidencia</p>
        <h1 className="text-display-1 mt-1">Actas</h1>
        <p className="mt-2 text-ink-600">
          Histórico de actas de aprobación e informes finales de observaciones.
        </p>
      </header>

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ La generación y vista de actas se implementa en la sesión 9 junto con el Job 3
        (resumen de observaciones IA).
      </div>
    </div>
  );
}
