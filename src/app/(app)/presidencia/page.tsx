import Link from "next/link";
import { redirect } from "next/navigation";
import {
  obtenerKpisPresidencia,
  listarProtocolosAno,
} from "@/lib/protocolos/queries";
import {
  obtenerUsuarioActual,
  esMiembroComite,
  puedeEmitirDictamen,
} from "@/lib/auth/usuario-actual";
import { ETIQUETAS_ESTADO, type EstadoProtocolo } from "@/types/domain";
import { PageHeader } from "@/components/layout/PageHeader";

const FORMATO_FECHA: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const ANIO_ACTUAL = new Date().getFullYear();

export default async function PresidenciaPage() {
  const usuario = await obtenerUsuarioActual();
  // El tablero es para el comité (presidencia, secretaría, vocales). Los
  // investigadores puros no tienen acceso.
  if (!esMiembroComite(usuario.roles)) redirect("/dashboard");
  const puedeEmitir = puedeEmitirDictamen(usuario.roles);
  const esPresidente = usuario.roles.includes("presidente");

  const [kpis, protocolos] = await Promise.all([
    obtenerKpisPresidencia(),
    listarProtocolosAno(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        variant="teal"
        eyebrow={esPresidente ? "Presidencia · CEICS" : "Comité · CEICS"}
        title={`Tablero ${ANIO_ACTUAL}`}
        actions={
          <Link
            href="/protocolo/nuevo"
            className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-brand-teal shadow-sm transition hover:bg-white/90"
          >
            Someter protocolo propio
          </Link>
        }
      />

      {!puedeEmitir && (
        <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
          👁️ Tienes acceso de consulta a este tablero. La emisión de dictámenes
          y actas corresponde a la Presidencia y la Secretaría.
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={`Total ${ANIO_ACTUAL}`} valor={kpis.totalAno} />
        <Kpi label="Recibidos este mes" valor={kpis.recibidosMes} />
        <Kpi label="En evaluación" valor={kpis.enEvaluacion} />
        <Kpi label="Dictaminados (año)" valor={kpis.dictaminadosAno} />
        <Kpi
          label="Pendientes mi firma"
          valor={kpis.pendientesMiFirma}
          highlight={kpis.pendientesMiFirma > 0}
        />
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-display-2">Protocolos del año</h2>
          <span className="text-xs text-ink-500">
            {protocolos.length}{" "}
            {protocolos.length === 1 ? "protocolo" : "protocolos"}
          </span>
        </div>

        {protocolos.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            Aún no hay protocolos sometidos en {ANIO_ACTUAL}. Cuando un
            investigador someta uno, aparecerá aquí.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2">Clave</th>
                  <th className="px-4 py-2">Título</th>
                  <th className="px-4 py-2">IP</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2 whitespace-nowrap">Enviado</th>
                  <th className="px-4 py-2 whitespace-nowrap">Vence</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {protocolos.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-mono text-xs text-ink-600 whitespace-nowrap">
                      {p.clave ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-900 max-w-md">
                      <span className="line-clamp-1">{p.titulo}</span>
                      {p.conflictoInteres && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">
                          Conflicto de interés
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700 whitespace-nowrap">
                      {p.ip_nombre}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {p.submitted_at
                        ? new Date(p.submitted_at).toLocaleDateString(
                            "es-MX",
                            FORMATO_FECHA,
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {p.fecha_vencimiento
                        ? new Date(p.fecha_vencimiento).toLocaleDateString(
                            "es-MX",
                            FORMATO_FECHA,
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <AccionRapida
                        estado={p.estado}
                        protocoloId={p.id}
                        conflictoInteres={p.conflictoInteres}
                        puedeEmitir={puedeEmitir}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {kpis.totalAno === 0 && (
        <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
          💡 Aún no se han sometido protocolos en {ANIO_ACTUAL}. Comparte la
          liga <span className="font-mono">https://ceics-cutlajo.com</span> con
          los investigadores del CUTLAJO para que registren sus cuentas y
          empiecen a someter.
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

function AccionRapida({
  estado,
  protocoloId,
  conflictoInteres,
  puedeEmitir,
}: {
  estado: EstadoProtocolo;
  protocoloId: string;
  conflictoInteres: boolean;
  puedeEmitir: boolean;
}) {
  if (puedeEmitir && estado === "listo_dictamen" && !conflictoInteres) {
    return (
      <Link
        href={`/presidencia/dictamen/${protocoloId}`}
        className="text-xs font-semibold text-[var(--accent)] hover:underline"
      >
        Emitir dictamen →
      </Link>
    );
  }
  return (
    <Link
      href={`/protocolo/${protocoloId}`}
      className="text-xs font-medium text-[var(--accent)] hover:underline"
    >
      Ver →
    </Link>
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
