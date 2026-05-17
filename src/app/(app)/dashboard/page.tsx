import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual, nombreCompletoDe } from "@/lib/auth/usuario-actual";
import { listarProtocolos } from "@/lib/protocolos/queries";
import { ETIQUETAS_ESTADO, type EstadoProtocolo } from "@/types/domain";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function DashboardPage() {
  const usuario = await obtenerUsuarioActual();

  // Routing por rol al dashboard correcto
  if (usuario.rolPrincipal === "presidente") redirect("/presidencia");
  if (usuario.rolPrincipal === "comite_vocal" || usuario.rolPrincipal === "comite_secretario")
    redirect("/comite/bandeja");

  const protocolos = await listarProtocolos();
  const borradores = protocolos.filter((p) => p.estado === "borrador");
  const enEvaluacion = protocolos.filter((p) =>
    ["en_evaluacion_ia", "en_revision_comite", "listo_dictamen", "observaciones"].includes(
      p.estado,
    ),
  );
  const aprobados = protocolos.filter((p) =>
    ["aprobado", "aprobado_con_observaciones"].includes(p.estado),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bienvenido/a"
        title={nombreCompletoDe(usuario)}
        description="Aquí podrás someter y dar seguimiento a tus protocolos."
        actions={
          <Link
            href="/protocolo/nuevo"
            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-magenta-deep shadow-sm transition hover:bg-white/90"
          >
            + Nuevo protocolo
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <KpiCard
          label="Borradores"
          valor={borradores.length.toString()}
          hint={borradores.length === 0 ? "Sin borradores" : "Pendientes de enviar"}
        />
        <KpiCard
          label="En evaluación"
          valor={enEvaluacion.length.toString()}
          hint={enEvaluacion.length === 0 ? "Ninguno en revisión" : "Pendientes de dictamen"}
        />
        <KpiCard
          label="Aprobados"
          valor={aprobados.length.toString()}
          hint={aprobados.length === 0 ? "Aún ninguno" : "Con acta oficial emitida"}
        />
      </section>

      {protocolos.length === 0 ? (
        <section className="card p-8 text-center">
          <h2 className="text-display-2">Comienza por someter tu primer protocolo</h2>
          <p className="mt-2 text-ink-500">
            Asegúrate de tener listos los documentos requeridos por el CEICS.
          </p>
          <Link href="/protocolo/nuevo" className="btn-primary mt-6 inline-flex">
            Nuevo protocolo
          </Link>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-display-2">Mis protocolos</h2>
          <div className="overflow-hidden rounded-md border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Clave</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {protocolos.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-mono text-xs text-ink-600">
                      {p.clave ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-900">
                      <span className="line-clamp-2">{p.titulo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {new Date(p.created_at).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.estado === "borrador" || p.estado === "observaciones" ? (
                        <Link
                          href={`/protocolo/${p.id}/editar`}
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          Continuar →
                        </Link>
                      ) : (
                        <Link
                          href={`/protocolo/${p.id}`}
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          Ver detalle →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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

function EstadoBadge({ estado }: { estado: EstadoProtocolo }) {
  const colorPorEstado: Record<EstadoProtocolo, string> = {
    borrador: "bg-ink-100 text-ink-700",
    en_evaluacion_ia: "bg-warn-soft text-warn",
    en_revision_comite: "bg-warn-soft text-warn",
    listo_dictamen: "bg-warn-soft text-warn",
    aprobado: "bg-good-soft text-good",
    aprobado_con_observaciones: "bg-good-soft text-good",
    observaciones: "bg-warn-soft text-warn",
    rechazado: "bg-bad-soft text-bad",
    retirado: "bg-ink-100 text-ink-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorPorEstado[estado]}`}
    >
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}
