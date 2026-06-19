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
import { SemaforoSometimiento } from "@/components/protocolos/SemaforoSometimiento";

const FORMATO_FECHA: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const ANIO_ACTUAL = new Date().getFullYear();

/** Filtros que activa cada tarjeta (KPI) sobre la tabla de protocolos del año. */
type FiltroTablero = "mes" | "evaluacion" | "dictaminados" | "firma";

const ESTADOS_EVALUACION = ["en_evaluacion_ia", "en_revision_comite", "observaciones"];
const ESTADOS_DICTAMINADOS = ["aprobado", "aprobado_con_observaciones", "rechazado"];
const ESTADOS_FIRMA = ["listo_dictamen", "correcciones_menores"];

export default async function PresidenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const usuario = await obtenerUsuarioActual();
  // El tablero es para el comité (presidencia, secretaría, vocales). Los
  // investigadores puros no tienen acceso.
  if (!esMiembroComite(usuario.roles)) redirect("/dashboard");
  const puedeEmitir = puedeEmitirDictamen(usuario.roles);
  const esPresidente = usuario.roles.includes("presidente");

  const { filtro } = await searchParams;
  const filtroActivo: FiltroTablero | null =
    filtro === "mes" || filtro === "evaluacion" || filtro === "dictaminados" || filtro === "firma"
      ? filtro
      : null;

  const [kpis, protocolos] = await Promise.all([
    obtenerKpisPresidencia(),
    listarProtocolosAno(),
  ]);

  // Filtrado de la tabla según la tarjeta activa (mismas definiciones que los KPIs).
  const inicioMes = new Date(ANIO_ACTUAL, new Date().getMonth(), 1);
  const inicioAno = new Date(ANIO_ACTUAL, 0, 1);
  const protocolosFiltrados = protocolos.filter((p) => {
    switch (filtroActivo) {
      case "mes":
        return p.submitted_at != null && new Date(p.submitted_at) >= inicioMes;
      case "evaluacion":
        return ESTADOS_EVALUACION.includes(p.estado);
      case "dictaminados":
        return (
          ESTADOS_DICTAMINADOS.includes(p.estado) &&
          p.dictaminado_at != null &&
          new Date(p.dictaminado_at) >= inicioAno
        );
      case "firma":
        return ESTADOS_FIRMA.includes(p.estado);
      default:
        return true;
    }
  });

  const ETIQUETA_FILTRO: Record<FiltroTablero, string> = {
    mes: "Recibidos este mes",
    evaluacion: "En evaluación",
    dictaminados: "Dictaminados",
    firma: "Pendientes de firma",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        variant="navy"
        eyebrow={esPresidente ? "Presidencia · CEICS" : "Comité · CEICS"}
        title={`Tablero ${ANIO_ACTUAL}`}
        actions={
          <Link
            href="/protocolo/nuevo"
            className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-navy-700 shadow-sm transition hover:bg-white/90"
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
        <Kpi label={`Total ${ANIO_ACTUAL}`} valor={kpis.totalAno} href="/presidencia" activo={filtroActivo === null} />
        <Kpi label="Recibidos este mes" valor={kpis.recibidosMes} href="/presidencia?filtro=mes" activo={filtroActivo === "mes"} />
        <Kpi label="En evaluación" valor={kpis.enEvaluacion} href="/presidencia?filtro=evaluacion" activo={filtroActivo === "evaluacion"} />
        <Kpi label="Dictaminados (año)" valor={kpis.dictaminadosAno} href="/presidencia?filtro=dictaminados" activo={filtroActivo === "dictaminados"} />
        <Kpi
          label="Pendientes mi firma"
          valor={kpis.pendientesMiFirma}
          href="/presidencia?filtro=firma"
          activo={filtroActivo === "firma"}
          highlight={kpis.pendientesMiFirma > 0}
        />
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-display-2">Protocolos del año</h2>
            {filtroActivo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                {ETIQUETA_FILTRO[filtroActivo]}
                <Link href="/presidencia" className="hover:underline" aria-label="Quitar filtro">
                  ✕
                </Link>
              </span>
            )}
          </div>
          <span className="text-xs text-ink-500">
            {protocolosFiltrados.length}{" "}
            {protocolosFiltrados.length === 1 ? "protocolo" : "protocolos"}
            {filtroActivo && ` de ${protocolos.length}`}
          </span>
        </div>

        {protocolos.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            Aún no hay protocolos sometidos en {ANIO_ACTUAL}. Cuando un
            investigador someta uno, aparecerá aquí.
          </p>
        ) : protocolosFiltrados.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">
            No hay protocolos en «{filtroActivo ? ETIQUETA_FILTRO[filtroActivo] : ""}».{" "}
            <Link href="/presidencia" className="font-medium text-[var(--accent)] hover:underline">
              Ver todos
            </Link>
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
                {protocolosFiltrados.map((p) => (
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
                      <span className="inline-flex items-center gap-2">
                        <EstadoBadge estado={p.estado} />
                        <SemaforoSometimiento
                          submittedAt={p.submitted_at}
                          estado={p.estado}
                        />
                      </span>
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
  href,
  activo,
  highlight,
}: {
  label: string;
  valor: number;
  href: string;
  activo?: boolean;
  highlight?: boolean;
}) {
  const acentuado = activo || highlight;
  return (
    <Link
      href={href}
      className={`card block p-5 transition hover:border-[var(--accent)]/40 hover:shadow-sm ${
        activo
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
          : highlight
            ? "border-[var(--accent)]/30 ring-1 ring-[var(--accent)]/20"
            : ""
      }`}
    >
      <div className="text-eyebrow text-ink-500">{label}</div>
      <div
        className={`mt-2 font-display text-3xl font-semibold ${
          acentuado ? "text-[var(--accent)]" : "text-ink-900"
        }`}
      >
        {valor}
      </div>
    </Link>
  );
}

function AccionRapida({
  estado,
  protocoloId,
  puedeEmitir,
}: {
  estado: EstadoProtocolo;
  protocoloId: string;
  puedeEmitir: boolean;
}) {
  // Con conflicto de interés del Presidente (es el IP) el acta se emite igual,
  // pero la firma de registro es de la Secretaría por delegación — eso lo
  // resuelve la pantalla de dictamen, así que aquí sí ofrecemos "Emitir".
  if (puedeEmitir && estado === "listo_dictamen") {
    return (
      <Link
        href={`/presidencia/dictamen/${protocoloId}`}
        className="text-xs font-semibold text-[var(--accent)] hover:underline"
      >
        Emitir dictamen →
      </Link>
    );
  }
  if (puedeEmitir && estado === "correcciones_menores") {
    return (
      <Link
        href={`/presidencia/dictamen/${protocoloId}`}
        className="text-xs font-semibold text-[var(--accent)] hover:underline"
      >
        Ratificar →
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
    correcciones_menores: "bg-info-soft text-info",
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
