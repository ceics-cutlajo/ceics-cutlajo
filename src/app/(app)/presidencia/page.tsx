export default function PresidenciaPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-eyebrow text-ink-500">Presidencia · CEICS</p>
        <h1 className="text-display-1 mt-1">Tablero general</h1>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-4">
        <Kpi label="Recibidos este mes" valor="0" />
        <Kpi label="En evaluación" valor="0" />
        <Kpi label="Listos para dictamen" valor="0" highlight />
        <Kpi label="Aprobados (año)" valor="0" />
      </section>

      <section className="card p-6">
        <h2 className="text-display-2">Próximos hitos</h2>
        <ul className="mt-4 space-y-3 text-sm text-ink-600">
          <li className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-warn"></span>
            Subir Acta de Instalación del CEICS al sistema
          </li>
          <li className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-info"></span>
            Configurar credenciales de Supabase + Resend (sesión 4)
          </li>
          <li className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-ok"></span>
            Onboarding inicial de los 7 miembros del Comité
          </li>
        </ul>
      </section>

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ El tablero con votación en vivo se implementa en la sesión 7.
      </div>
    </div>
  );
}

function Kpi({
  label,
  valor,
  highlight,
}: {
  label: string;
  valor: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-5 ${highlight ? "border-[var(--accent)]/30 ring-1 ring-[var(--accent)]/20" : ""}`}>
      <div className="text-eyebrow text-ink-500">{label}</div>
      <div
        className={`mt-2 font-display text-3xl font-semibold ${
          highlight ? "text-[var(--accent)]" : "text-ink-900"
        }`}
      >
        {valor}
      </div>
    </div>
  );
}
