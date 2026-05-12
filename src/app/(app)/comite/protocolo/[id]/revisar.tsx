"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ProtocoloCompleto,
  CoInvestigadorRow,
  DocumentoRow,
} from "@/lib/protocolos/queries";
import { ETIQUETAS_DOCUMENTO, type TipoDocumento } from "@/lib/protocolos/schemas";
import { ETIQUETAS_CATEGORIA, CATEGORIAS, type Categoria } from "@/lib/checklist";
import type { PreDictamen, BloqueEvaluado, ItemEvaluado } from "@/lib/ia/schema-pre-dictamen";

type DocumentoConUrl = DocumentoRow & { urlDescarga: string | null };

type PreInforme = {
  id: string;
  version: number;
  generado_at: string;
  modelo_usado: string | null;
  resumen_ejecutivo: string;
  cumple_global: boolean;
  total_items_evaluados: number;
  items_cumple: number;
  items_no_cumple: number;
  items_parcial: number;
  items_no_aplica: number;
  observaciones_criticas: string[];
  sugerencias: string[];
  duracion_segundos: number | null;
  contenido: PreDictamen;
};

type Props = {
  protocoloId: string;
  protocolo: ProtocoloCompleto;
  coInvestigadores: CoInvestigadorRow[];
  documentos: DocumentoConUrl[];
  ipNombre: string;
  conflictoInteres: boolean;
  preInforme: PreInforme | null;
};

export function Revisar(props: Props) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [errorGen, setErrorGen] = useState<string | null>(null);
  const dispatchedRef = useRef(false);

  // Si no hay pre_informe y el protocolo está en estado válido → disparar generación
  useEffect(() => {
    if (props.preInforme) return;
    if (
      !["en_evaluacion_ia", "en_revision_comite", "listo_dictamen"].includes(
        props.protocolo.estado,
      )
    )
      return;
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    setGenerando(true);

    fetch("/api/ia/pre-dictamen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocoloId: props.protocoloId }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok && !data.skipped) {
          setErrorGen(data.message ?? "Error generando pre-dictamen");
        }
        setGenerando(false);
        router.refresh();
      })
      .catch((e) => {
        dispatchedRef.current = false;
        setGenerando(false);
        setErrorGen(e?.message ?? "Error de red");
      });
  }, [props.preInforme, props.protocolo.estado, props.protocoloId, router]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-eyebrow text-ink-500">
          Comité · {props.protocolo.clave ?? "—"}
        </p>
        <h1 className="text-display-1 mt-1">{props.protocolo.titulo}</h1>
        <p className="mt-2 text-sm text-ink-500">
          IP: {props.ipNombre}
          {props.protocolo.submitted_at && (
            <>
              {" "}
              · Enviado{" "}
              {new Date(props.protocolo.submitted_at).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </>
          )}
        </p>
        <p className="mt-2">
          <Link href="/comite/bandeja" className="text-sm text-ink-500 hover:underline">
            ← Volver a la bandeja
          </Link>
        </p>
      </header>

      {props.conflictoInteres && (
        <div className="rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          ⚠ <strong>Conflicto de interés.</strong> Eres el Investigador Principal de este
          protocolo. La votación quedará marcada automáticamente como abstención obligatoria
          cuando se implemente el formulario de voto (sesión 8b).
        </div>
      )}

      {/* Datos del protocolo */}
      <section className="card p-6">
        <h2 className="text-display-2">Datos del protocolo</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DatoCampo label="Tipo de investigación" valor={props.protocolo.tipo_investigacion_id} />
          <DatoCampo
            label="Clasificación de riesgo"
            valor={props.protocolo.clasificacion_riesgo}
          />
          <DatoCampo
            label="Involucra"
            valor={[
              props.protocolo.involucra_humanos && "humanos",
              props.protocolo.involucra_menores && "menores",
              props.protocolo.involucra_datos_geneticos && "datos genéticos",
              props.protocolo.involucra_medicamento && "medicamento",
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          />
          <DatoCampo
            label="Área de conocimiento (SECIHTI)"
            valor={
              props.protocolo.area_conocimiento_id
                ? `Área ${props.protocolo.area_conocimiento_id}`
                : null
            }
          />
        </dl>

        {props.protocolo.resumen && (
          <div className="mt-6">
            <div className="text-eyebrow mb-1 text-ink-500">Resumen</div>
            <p className="text-sm leading-relaxed text-ink-800">{props.protocolo.resumen}</p>
          </div>
        )}

        {props.protocolo.objetivo_general && (
          <div className="mt-6">
            <div className="text-eyebrow mb-1 text-ink-500">Objetivo general</div>
            <p className="text-sm leading-relaxed text-ink-800">{props.protocolo.objetivo_general}</p>
          </div>
        )}

        {props.protocolo.objetivos_especificos.length > 0 && (
          <div className="mt-6">
            <div className="text-eyebrow mb-1 text-ink-500">Objetivos específicos</div>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-ink-800">
              {props.protocolo.objetivos_especificos.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {props.protocolo.metodologia && (
          <div className="mt-6">
            <div className="text-eyebrow mb-1 text-ink-500">Metodología</div>
            <p className="text-sm leading-relaxed text-ink-800">{props.protocolo.metodologia}</p>
          </div>
        )}
      </section>

      {/* Equipo */}
      <section className="card p-6">
        <h2 className="text-display-2">Equipo de investigación</h2>
        <p className="mt-1 text-sm text-ink-500">
          {props.coInvestigadores.length} co-investigador
          {props.coInvestigadores.length === 1 ? "" : "es"}
        </p>
        <div className="mt-4 space-y-2">
          <div className="rounded-md border border-ink-150 px-4 py-3 text-sm">
            <strong>{props.ipNombre}</strong> — Investigador Principal
          </div>
          {props.coInvestigadores.map((c) => (
            <div key={c.id} className="rounded-md border border-ink-150 px-4 py-3 text-sm">
              {c.nombre} {c.apellido_paterno}
              {c.apellido_materno ? ` ${c.apellido_materno}` : ""}
              {c.adscripcion && ` · ${c.adscripcion}`}
              {c.email && (
                <span className="text-ink-500"> · {c.email}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Documentos */}
      <section className="card p-6">
        <h2 className="text-display-2">
          Documentos ({props.documentos.length})
        </h2>
        <ul className="mt-4 space-y-2">
          {props.documentos.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-md border border-ink-150 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {ETIQUETAS_DOCUMENTO[d.tipo_documento_id as TipoDocumento] ??
                    d.tipo_documento_id}
                </div>
                <div className="font-mono text-xs text-ink-500">
                  {d.nombre_original} · {(d.tamano_bytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              {d.urlDescarga ? (
                <a
                  href={d.urlDescarga}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  Descargar ↓
                </a>
              ) : (
                <span className="text-xs text-ink-400">No disponible</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Pre-dictamen IA */}
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-display-2">
            ✨ Pre-dictamen IA
            {props.preInforme && (
              <span className="ml-2 text-xs font-normal text-ink-500">
                v{props.preInforme.version} ·{" "}
                {props.preInforme.modelo_usado ?? "—"}
              </span>
            )}
          </h2>
          {props.preInforme && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                props.preInforme.cumple_global
                  ? "bg-good-soft text-good"
                  : "bg-warn-soft text-warn"
              }`}
            >
              {props.preInforme.cumple_global
                ? "Cumple global"
                : "Requiere atención"}
            </span>
          )}
        </div>

        {!props.preInforme && generando && (
          <div className="mt-6 flex flex-col items-center gap-3 py-12 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-ink-200 border-t-[var(--accent)]" />
            <p className="text-sm text-ink-700">
              Claude está evaluando el protocolo contra los 100 ítems del checklist normativo…
            </p>
            <p className="text-xs text-ink-500">
              Tarda 30-60 segundos. La página se refresca sola cuando termine.
            </p>
          </div>
        )}

        {!props.preInforme && !generando && errorGen && (
          <div className="mt-6 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
            <strong>Error al generar el pre-dictamen:</strong> {errorGen}
            <button
              onClick={() => {
                dispatchedRef.current = false;
                setErrorGen(null);
                router.refresh();
              }}
              className="ml-2 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {props.preInforme && (
          <PreDictamenContenido pre={props.preInforme} />
        )}
      </section>

      <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
        🛠️ El formulario para validar/discrepar bloque por bloque y emitir tu voto se implementa
        en la siguiente sesión (8b). Por ahora puedes leer el pre-dictamen y los documentos.
      </div>
    </div>
  );
}

function PreDictamenContenido({ pre }: { pre: PreInforme }) {
  return (
    <>
      <p className="mt-4 text-sm leading-relaxed text-ink-800">
        {pre.resumen_ejecutivo}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Ítems totales" valor={pre.total_items_evaluados} tono="ink" />
        <Kpi label="Cumple" valor={pre.items_cumple} tono="good" />
        <Kpi label="Parcial" valor={pre.items_parcial} tono="warn" />
        <Kpi label="No cumple" valor={pre.items_no_cumple} tono="bad" />
        <Kpi label="No aplica" valor={pre.items_no_aplica} tono="ink" />
      </dl>

      {pre.observaciones_criticas.length > 0 && (
        <div className="mt-6 rounded-md border border-bad/30 bg-bad-soft px-4 py-3">
          <div className="mb-2 text-eyebrow text-bad">Observaciones críticas</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-bad">
            {pre.observaciones_criticas.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {pre.sugerencias.length > 0 && (
        <div className="mt-4 rounded-md border border-info/30 bg-info-soft px-4 py-3">
          <div className="mb-2 text-eyebrow text-info">Sugerencias</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-info">
            {pre.sugerencias.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mt-8 text-display-3">Evaluación por bloque</h3>
      <div className="mt-3 space-y-2">
        {CATEGORIAS.map((cat) => {
          const bloque = pre.contenido.bloques[cat];
          if (!bloque) return null;
          return <BloqueCard key={cat} categoria={cat} bloque={bloque} />;
        })}
      </div>
    </>
  );
}

function BloqueCard({
  categoria,
  bloque,
}: {
  categoria: Categoria;
  bloque: BloqueEvaluado;
}) {
  const tono = colorPorResultado(bloque.resultado);
  const icono = iconoPorResultado(bloque.resultado);
  return (
    <details className={`rounded-md border ${tono.borde} ${tono.fondo}`}>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span className={`text-lg ${tono.texto}`}>{icono}</span>
          <strong>{ETIQUETAS_CATEGORIA[categoria]}</strong>
          <span className={`text-xs ${tono.texto}`}>· {bloque.resultado}</span>
        </span>
        <span className="text-xs text-ink-500">
          {bloque.items_evaluados.length} ítem
          {bloque.items_evaluados.length === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="border-t border-ink-150 bg-white px-4 py-3 text-sm">
        <p className="mb-3 leading-relaxed text-ink-800">{bloque.justificacion}</p>
        <ul className="space-y-2">
          {bloque.items_evaluados.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </details>
  );
}

function ItemRow({ item }: { item: ItemEvaluado }) {
  const tono = colorPorResultado(item.resultado);
  const icono = iconoPorResultado(item.resultado);
  return (
    <li className="flex gap-2 text-xs">
      <span className={`shrink-0 ${tono.texto}`}>{icono}</span>
      <div className="flex-1">
        <span className="font-mono text-ink-500">{item.id}</span>{" "}
        <span className="text-ink-800">{item.observacion}</span>
        {item.fuente_protocolo && (
          <div className="mt-0.5 text-ink-500 italic">↳ {item.fuente_protocolo}</div>
        )}
      </div>
    </li>
  );
}

function DatoCampo({ label, valor }: { label: string; valor: string | number | null }) {
  return (
    <div>
      <dt className="text-eyebrow text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900">{valor ?? "—"}</dd>
    </div>
  );
}

function Kpi({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: number;
  tono: "good" | "warn" | "bad" | "ink";
}) {
  const colores = {
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    ink: "text-ink-700",
  };
  return (
    <div className="rounded-md border border-ink-150 bg-white px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${colores[tono]}`}>{valor}</div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}

function colorPorResultado(r: string): {
  borde: string;
  fondo: string;
  texto: string;
} {
  switch (r) {
    case "cumple":
      return { borde: "border-good/30", fondo: "bg-good-soft/30", texto: "text-good" };
    case "parcial":
      return { borde: "border-warn/30", fondo: "bg-warn-soft/30", texto: "text-warn" };
    case "no_cumple":
      return { borde: "border-bad/30", fondo: "bg-bad-soft/30", texto: "text-bad" };
    default:
      return { borde: "border-ink-200", fondo: "bg-ink-50", texto: "text-ink-500" };
  }
}

function iconoPorResultado(r: string): string {
  switch (r) {
    case "cumple":
      return "✓";
    case "parcial":
      return "⚠";
    case "no_cumple":
      return "✗";
    default:
      return "⊘";
  }
}
