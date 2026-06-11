import { fechaLargaDesdeIsoOFallback } from "@/lib/actas/formatos";
import { BotonReenviarActa } from "./boton-reenviar-acta";

export type CardActaProps = {
  actaId: string;
  numeroOficio: string;
  resolucion:
    | "aprobado"
    | "aprobado_con_observaciones"
    | "condicionado"
    | "no_aprobado";
  fechaEmisionIso: string;
  vigenciaMeses: number;
  fechaVencimientoIso: string | null;
  hashFolio: string;
  docxUrl: string | null;
  pdfUrl: string | null;
  enviadaAt: string | null;
  /** Muestra el aviso de "correo no enviado" + botón de reenvío
   * (solo para Presidencia/Secretaría). */
  puedeReenviar?: boolean;
};

const ETIQUETA_RES: Record<CardActaProps["resolucion"], string> = {
  aprobado: "APROBADO",
  aprobado_con_observaciones: "APROBADO CON OBSERVACIONES MENORES",
  condicionado: "CONDICIONADO A MODIFICACIONES MAYORES",
  no_aprobado: "NO APROBADO",
};

const COLOR_RES: Record<CardActaProps["resolucion"], string> = {
  aprobado: "text-good",
  aprobado_con_observaciones: "text-warn",
  condicionado: "text-warn",
  no_aprobado: "text-bad",
};

export function CardActa(props: CardActaProps) {
  return (
    <section className="card border border-good/30 bg-good-soft/30 p-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow text-ink-500">Acta de aprobación emitida</p>
          <h2 className="mt-1 text-display-2">
            Oficio{" "}
            <span className="font-mono text-base">{props.numeroOficio}</span>
          </h2>
        </div>
        <div className="text-right">
          <p className="text-eyebrow text-ink-500">Resolución</p>
          <p className={`mt-1 text-sm font-semibold ${COLOR_RES[props.resolucion]}`}>
            {ETIQUETA_RES[props.resolucion]}
          </p>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-eyebrow text-ink-500">Fecha de emisión</dt>
          <dd className="mt-1 text-sm">{fechaLargaDesdeIsoOFallback(props.fechaEmisionIso)}</dd>
        </div>
        <div>
          <dt className="text-eyebrow text-ink-500">Vigencia</dt>
          <dd className="mt-1 text-sm">{props.vigenciaMeses} meses</dd>
        </div>
        <div>
          <dt className="text-eyebrow text-ink-500">Vence</dt>
          <dd className="mt-1 text-sm">
            {fechaLargaDesdeIsoOFallback(props.fechaVencimientoIso)}
          </dd>
        </div>
        <div>
          <dt className="text-eyebrow text-ink-500">Folio digital</dt>
          <dd className="mt-1 font-mono text-xs">{props.hashFolio}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-3">
        {props.pdfUrl && (
          <a
            href={props.pdfUrl}
            className="btn-primary text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Descargar PDF
          </a>
        )}
        {props.docxUrl && (
          <a
            href={props.docxUrl}
            className="btn-secondary text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Descargar DOCX
          </a>
        )}
      </div>

      {props.enviadaAt && (
        <p className="mt-4 text-xs text-ink-500">
          Acta enviada por correo al investigador el{" "}
          {fechaLargaDesdeIsoOFallback(props.enviadaAt)}.
        </p>
      )}

      {!props.enviadaAt && props.puedeReenviar && (
        <div className="mt-4 space-y-2 rounded-md border border-warn/30 bg-warn-soft/40 p-3">
          <p className="text-xs font-medium text-ink-800">
            ⚠ El correo con el acta al investigador no se ha enviado.
          </p>
          <BotonReenviarActa actaId={props.actaId} />
        </div>
      )}
    </section>
  );
}
