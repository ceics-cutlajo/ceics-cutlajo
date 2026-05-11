import { obtenerUsuarioActual, nombreCompletoDe } from "@/lib/auth/usuario-actual";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const usuario = await obtenerUsuarioActual();

  // Routing por rol al dashboard correcto
  if (usuario.rolPrincipal === "presidente") redirect("/presidencia");
  if (usuario.rolPrincipal === "comite_vocal" || usuario.rolPrincipal === "comite_secretario")
    redirect("/comite/bandeja");

  // Default: investigador
  return (
    <div className="space-y-8">
      <header>
        <p className="text-eyebrow text-ink-500">Bienvenido/a</p>
        <h1 className="text-display-1 mt-1">{nombreCompletoDe(usuario)}</h1>
        <p className="mt-2 text-ink-600">Aquí podrás someter y dar seguimiento a tus protocolos.</p>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <KpiCard label="Mis protocolos" valor="0" hint="Aún no has sometido ninguno" />
        <KpiCard label="En evaluación" valor="0" hint="Pendientes de dictamen" />
        <KpiCard label="Aprobados" valor="0" hint="Con acta oficial emitida" />
      </section>

      <section className="card p-8 text-center">
        <h2 className="text-display-2">Comienza por someter tu primer protocolo</h2>
        <p className="mt-2 text-ink-500">
          Asegúrate de tener listos los documentos requeridos por el CEICS.
        </p>
        <a href="/protocolo/nuevo" className="btn-primary mt-6 inline-flex">
          Nuevo protocolo
        </a>
      </section>
    </div>
  );
}

function KpiCard({ label, valor, hint }: { label: string; valor: string; hint: string }) {
  return (
    <div className="card p-5">
      <div className="text-eyebrow text-ink-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold text-ink-900">{valor}</div>
      <div className="mt-1 text-xs text-ink-400">{hint}</div>
    </div>
  );
}
