import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default function PresidenciaActasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        variant="teal"
        eyebrow="Presidencia"
        title="Actas"
        description="Histórico de actas de aprobación e informes finales de observaciones."
      />

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ La generación y vista de actas se implementa en la sesión 9 junto con el Job 3
        (resumen de observaciones IA).
      </div>
    </div>
  );
}
