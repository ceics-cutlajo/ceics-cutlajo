import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { TablaActas } from "@/components/actas/TablaActas";
import { listarActas } from "@/lib/actas/queries";
import { obtenerUsuarioActual, esMiembroComite } from "@/lib/auth/usuario-actual";

export const dynamic = "force-dynamic";

export default async function PresidenciaActasPage() {
  const usuario = await obtenerUsuarioActual();
  // Histórico de actas: visible para todo el comité (lectura). Las actas no
  // exponen acciones de emisión aquí; solo consulta y folio público.
  if (!esMiembroComite(usuario.roles)) redirect("/dashboard");

  const actas = await listarActas();
  const vencidas = actas.filter((a) => {
    if (!a.fecha_vencimiento) return false;
    return new Date(a.fecha_vencimiento) < new Date();
  }).length;
  const porVencer = actas.filter((a) => {
    if (!a.fecha_vencimiento) return false;
    const dias = Math.floor(
      (new Date(a.fecha_vencimiento).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );
    return dias >= 0 && dias <= 90;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        variant="teal"
        eyebrow="Presidencia"
        title="Actas"
        description="Histórico de actas de dictamen emitidas por el CEICS. Incluye semáforo de vigencia y acceso al folio público de verificación."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-eyebrow text-ink-500">Total</p>
          <p className="mt-1 text-display-2">{actas.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-eyebrow text-ink-500">Por vencer (≤ 90 días)</p>
          <p className="mt-1 text-display-2 text-warn">{porVencer}</p>
        </div>
        <div className="card p-4">
          <p className="text-eyebrow text-ink-500">Vencidas</p>
          <p className="mt-1 text-display-2 text-bad">{vencidas}</p>
        </div>{/* tokens: ok / warn / bad existen en tailwind.config */}
      </div>

      <TablaActas actas={actas} />
    </div>
  );
}
