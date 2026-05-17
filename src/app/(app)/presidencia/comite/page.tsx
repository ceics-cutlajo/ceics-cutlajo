import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default function PresidenciaComitePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        variant="teal"
        eyebrow="Presidencia"
        title="Comité"
        description="Gestión de los 7 miembros del CEICS (alta, baja, cambio de rol)."
      />

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ Esta vista se construye en una sesión posterior (administración del comité). Por
        ahora los miembros se gestionan directamente en Supabase Studio (tabla{" "}
        <code className="font-mono text-xs">usuario_roles</code>).
      </div>
    </div>
  );
}
