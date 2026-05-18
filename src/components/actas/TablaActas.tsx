import Link from "next/link";
import type { ActaListadoItem } from "@/lib/actas/queries";
import { fechaLargaDesdeIsoOFallback } from "@/lib/actas/formatos";

const ETIQUETA_RES: Record<ActaListadoItem["resolucion"], string> = {
  aprobado: "Aprobado",
  aprobado_con_observaciones: "Aprobado c/obs.",
  no_aprobado: "No aprobado",
};

const CHIP_RES: Record<ActaListadoItem["resolucion"], string> = {
  aprobado: "bg-ok-soft text-ok border-ok/30",
  aprobado_con_observaciones: "bg-warn-soft text-warn border-warn/30",
  no_aprobado: "bg-bad-soft text-bad border-bad/30",
};

type Semaforo = "verde" | "ambar" | "rojo";

function semaforoVigencia(fechaVencimiento: string | null): Semaforo {
  if (!fechaVencimiento) return "rojo";
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const dias = Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "rojo";
  if (dias <= 90) return "ambar";
  return "verde";
}

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: "bg-ok",
  ambar: "bg-warn",
  rojo: "bg-bad",
};

const SEMAFORO_TEXTO: Record<Semaforo, string> = {
  verde: "vigente",
  ambar: "por vencer",
  rojo: "vencida",
};

export function TablaActas({ actas }: { actas: ActaListadoItem[] }) {
  if (actas.length === 0) {
    return (
      <div className="card p-6 text-sm text-ink-600">
        Aún no se han emitido actas.
      </div>
    );
  }
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-bg-2 text-left text-eyebrow text-ink-500">
          <tr>
            <th className="px-4 py-3 font-medium">Oficio</th>
            <th className="px-4 py-3 font-medium">Protocolo</th>
            <th className="px-4 py-3 font-medium">Resolución</th>
            <th className="px-4 py-3 font-medium">Emitida</th>
            <th className="px-4 py-3 font-medium">Vence</th>
            <th className="px-4 py-3 font-medium">Folio público</th>
          </tr>
        </thead>
        <tbody>
          {actas.map((a) => {
            const sem = semaforoVigencia(a.fecha_vencimiento);
            return (
              <tr key={a.id} className="border-t border-ink-100 hover:bg-bg-2/40">
                <td className="px-4 py-3 font-mono text-xs">{a.numero_oficio}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-ink-600">{a.protocolo_clave}</span>
                  <span className="mx-2 text-ink-300">·</span>
                  <span className="text-ink-800">
                    {a.protocolo_titulo.length > 70
                      ? a.protocolo_titulo.slice(0, 70) + "…"
                      : a.protocolo_titulo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${CHIP_RES[a.resolucion]}`}
                  >
                    {ETIQUETA_RES[a.resolucion]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {fechaLargaDesdeIsoOFallback(a.fecha_emision)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${SEMAFORO_COLOR[sem]}`}
                      aria-label={SEMAFORO_TEXTO[sem]}
                    />
                    <span className="text-ink-700">
                      {fechaLargaDesdeIsoOFallback(a.fecha_vencimiento)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/v/${a.hash_folio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--accent)] hover:underline"
                  >
                    {a.hash_folio}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
