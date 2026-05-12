export const dynamic = "force-dynamic";

export default function PresidenciaComitePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-eyebrow text-ink-500">Presidencia</p>
        <h1 className="text-display-1 mt-1">Comité</h1>
        <p className="mt-2 text-ink-600">
          Gestión de los 7 miembros del CEICS (alta, baja, cambio de rol).
        </p>
      </header>

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ Esta vista se construye en una sesión posterior (administración del comité). Por
        ahora los miembros se gestionan directamente en Supabase Studio (tabla{" "}
        <code className="font-mono text-xs">usuario_roles</code>).
      </div>
    </div>
  );
}
