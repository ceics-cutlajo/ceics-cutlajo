import Link from "next/link";
import {
  obtenerKpisPresidencia,
  listarBandejaComite,
} from "@/lib/protocolos/queries";
import { ETIQUETAS_ESTADO, type EstadoProtocolo } from "@/types/domain";

export default async function PresidenciaPage() {
  const [kpis, bandeja] = await Promise.all([
    obtenerKpisPresidencia(),
    listarBandejaComite(),
  ]);

  const recientes = bandeja.slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow text-ink-500">Presidencia · CEICS</p>
          <h1 className="text-display-1 mt-1">Tablero general</h1>
        </div>
        <Link href="/protocolo/nuevo" className="btn-secondary text-xs">
          Someter protocolo propio
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-4">
        <Kpi label="Recibidos este mes" valor={kpis.recibidosMes} />
        <Kpi label="En evaluación" valor={kpis.enEvaluacion} />
        <Kpi
          label="Listos para dictamen"
          valor={kpis.listosDictamen}
          highlight={kpis.listosDictamen > 0}
        />
        <Kpi label="Aprobados (año)" valor={kpis.aprobadosAno} />
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-display-2">Protocolos recientes</h2>
          <Link
            href="/comite/bandeja"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Ver todos →
          </Link>
        </div>

        {recientes.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            No hay protocolos en evaluación todavía. Cuando un investigador someta un protocolo,
            aparecerá aquí.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2">Clave</th>
                  <th className="px-4 py-2">Título</th>
                  <th className="px-4 py-2">IP</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Enviado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {recientes.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-mono text-xs text-ink-600">{p.clave ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-900">
                      <span className="line-clamp-1">{p.titulo}</span>
                      {p.conflictoInteres && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">
                          Conflicto de interés
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{p.ip_nombre}</td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {p.submitted_at
                        ? new Date(p.submitted_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/protocolo/${p.id}`}
                        className="text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {kpis.recibidosMes === 0 &&
        kpis.enEvaluacion === 0 &&
        kpis.aprobadosAno === 0 && (
          <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
            💡 Aún no se han sometido protocolos en producción. Comparte la liga{" "}
            <span className="font-mono">https://ceics-cutlajo.com</span> con los investigadores del
            CUTLAJO para que registren sus cuentas y empiecen a someter.
          </div>
        )}
    </div>
  );
}

function Kpi({
  label,
  valor,
  highlight,
}: {
  label: string;
  valor: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-5 ${
        highlight ? "border-[var(--accent)]/30 ring-1 ring-[var(--accent)]/20" : ""
      }`}
    >
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

function EstadoBadge({ estado }: { estado: EstadoProtocolo }) {
  const colores: Record<EstadoProtocolo, string> = {
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colores[estado]}`}
    >
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}
