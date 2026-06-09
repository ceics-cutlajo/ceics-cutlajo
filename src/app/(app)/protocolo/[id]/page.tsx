import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerProtocolo } from "@/lib/protocolos/queries";
import {
  ETIQUETAS_AREA,
  ETIQUETAS_TIPO_INV,
  ETIQUETAS_RIESGO,
  ETIQUETAS_DOCUMENTO,
  type TipoDocumento,
} from "@/lib/protocolos/schemas";
import { formatearDescripcionEvento } from "@/lib/protocolos/eventos";
import { obtenerVersionMaxPreInforme } from "@/lib/timeline/queries";
import { derivarTimeline } from "@/lib/timeline/derivar-etapa";
import { TimelineProtocolo } from "@/components/timeline/timeline-protocolo";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerActaPorProtocolo } from "@/lib/actas/queries";
import { CardActa } from "@/components/actas/card-acta";

export default async function VerProtocoloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { id } = await params;
  const { enviado } = await searchParams;
  const datos = await obtenerProtocolo(id);
  if (!datos) notFound();

  const { protocolo, coInvestigadores, documentos, eventos, esPropietario } = datos;

  // Datos auxiliares para el timeline (en paralelo con las URLs firmadas)
  const admin = createAdminClient();
  const [versionMaxPreInforme, ipUsuario] = await Promise.all([
    obtenerVersionMaxPreInforme(id),
    admin
      .from("usuarios")
      .select("nombre, apellido_paterno, apellido_materno")
      .eq("id", protocolo.investigador_principal_id)
      .single(),
  ]);
  // La firma de cada documento se genera al dar clic (ruta /api/documentos/[id]),
  // no aquí, para que el enlace no caduque mientras se ve el expediente.
  const docsConUrl = documentos.map((d) => ({
    ...d,
    url: `/api/documentos/${d.id}`,
  }));

  const ipNombre = ipUsuario.data
    ? `${ipUsuario.data.nombre} ${ipUsuario.data.apellido_paterno}${ipUsuario.data.apellido_materno ? " " + ipUsuario.data.apellido_materno : ""}`
    : "—";

  const timeline = derivarTimeline({
    estado: protocolo.estado,
    submitted_at: protocolo.submitted_at,
    versionMaxPreInforme,
  });

  const puedeEditar =
    esPropietario && (protocolo.estado === "borrador" || protocolo.estado === "observaciones");

  // Acta (si ya fue emitida)
  const acta = await obtenerActaPorProtocolo(id);
  let actaDocxUrl: string | null = null;
  let actaPdfUrl: string | null = null;
  if (acta?.docx_storage_path && acta?.pdf_storage_path) {
    const [d, p] = await Promise.all([
      admin.storage.from("actas").createSignedUrl(acta.docx_storage_path, 600),
      admin.storage.from("actas").createSignedUrl(acta.pdf_storage_path, 600),
    ]);
    actaDocxUrl = d.data?.signedUrl ?? null;
    actaPdfUrl = p.data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      {(protocolo.numero_oficio || puedeEditar) && (
        <div className="flex items-center justify-between">
          {protocolo.numero_oficio ? (
            <p className="font-mono text-sm text-ink-500">
              Oficio: {protocolo.numero_oficio}
            </p>
          ) : (
            <span />
          )}
          {puedeEditar && (
            <Link href={`/protocolo/${id}/editar`} className="btn-secondary text-xs">
              Editar borrador
            </Link>
          )}
        </div>
      )}

      {enviado === "1" && (
        <div className="rounded-md border border-good/30 bg-good-soft px-4 py-4 text-sm text-good">
          ✅ <strong>Protocolo enviado al CEICS.</strong> Recibirás un correo cuando el comité emita
          su dictamen. Puedes seguir el estado desde este expediente.
        </div>
      )}

      {/* Acción requerida: el comité devolvió el protocolo con observaciones */}
      {esPropietario && protocolo.estado === "observaciones" && (
        <section className="card border border-warn/40 bg-warn-soft/40 p-6">
          <p className="text-eyebrow text-warn">Acción requerida</p>
          <h2 className="mt-1 text-display-2">
            El comité solicitó modificaciones
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Atiende las siguientes observaciones, actualiza tus documentos y
            vuelve a enviar el protocolo. Se evaluará en una nueva ronda
            conservando el historial de la anterior.
          </p>
          {acta?.observaciones && (
            <div className="mt-4 rounded-md bg-bg-1 p-4">
              <p className="text-eyebrow text-ink-500">
                Observaciones del acta {acta.numero_oficio}
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-800">
                {acta.observaciones}
              </pre>
            </div>
          )}
          <Link
            href={`/protocolo/${id}/editar`}
            className="btn-primary mt-5 inline-block text-sm"
          >
            Corregir y reenviar
          </Link>
        </section>
      )}

      {/* Timeline visual: 7 etapas + card metadata */}
      <TimelineProtocolo
        protocolo={protocolo}
        ipNombre={ipNombre}
        coInvestigadores={coInvestigadores}
        timeline={timeline}
      />

      {acta && (
        <CardActa
          numeroOficio={acta.numero_oficio}
          resolucion={
            acta.resolucion as
              | "aprobado"
              | "aprobado_con_observaciones"
              | "condicionado"
              | "no_aprobado"
          }
          fechaEmisionIso={acta.fecha_emision}
          vigenciaMeses={acta.vigencia_meses}
          fechaVencimientoIso={acta.fecha_vencimiento}
          hashFolio={acta.hash_folio}
          docxUrl={actaDocxUrl}
          pdfUrl={actaPdfUrl}
          enviadaAt={acta.enviada_a_investigador_at}
        />
      )}

      {/* Resumen */}
      {protocolo.resumen && (
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-ink-700">Resumen</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{protocolo.resumen}</p>
        </section>
      )}

      {/* Metadatos */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-ink-700">Datos del proyecto</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
          <Dato
            label="Área de conocimiento"
            value={
              protocolo.area_conocimiento_id
                ? ETIQUETAS_AREA[protocolo.area_conocimiento_id]
                : "—"
            }
          />
          <Dato
            label="Tipo de investigación"
            value={
              protocolo.tipo_investigacion_id
                ? ETIQUETAS_TIPO_INV[
                    protocolo.tipo_investigacion_id as keyof typeof ETIQUETAS_TIPO_INV
                  ]
                : "—"
            }
          />
          <Dato
            label="Clasificación de riesgo"
            value={
              protocolo.clasificacion_riesgo
                ? ETIQUETAS_RIESGO[protocolo.clasificacion_riesgo]
                : "—"
            }
          />
          <Dato
            label="Características"
            value={
              [
                protocolo.involucra_humanos && "Humanos",
                protocolo.involucra_menores && "Menores",
                protocolo.involucra_datos_geneticos && "Genética",
                protocolo.involucra_medicamento && "Medicamento",
              ]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
          {protocolo.submitted_at && (
            <Dato
              label="Enviado"
              value={new Date(protocolo.submitted_at).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
          )}
          {protocolo.fecha_aprobacion && (
            <Dato
              label="Aprobado"
              value={new Date(protocolo.fecha_aprobacion).toLocaleDateString("es-MX")}
            />
          )}
          {protocolo.fecha_vencimiento && (
            <Dato
              label="Vence"
              value={new Date(protocolo.fecha_vencimiento).toLocaleDateString("es-MX")}
            />
          )}
        </dl>
      </section>

      {/* Co-investigadores */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-ink-700">
          Equipo de investigación ({coInvestigadores.length} co-investigador
          {coInvestigadores.length === 1 ? "" : "es"})
        </h2>
        {coInvestigadores.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Sin co-investigadores. El IP es el único responsable.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {coInvestigadores.map((c) => (
              <li key={c.id} className="text-ink-700">
                {c.nombre} {c.apellido_paterno} {c.apellido_materno ?? ""} ·{" "}
                <span className="text-ink-500">{c.adscripcion}</span>
                {c.email && <span className="ml-2 text-ink-400">· {c.email}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documentos */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-ink-700">
          Documentos ({docsConUrl.length})
        </h2>
        {docsConUrl.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Sin documentos cargados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {docsConUrl.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-md border border-ink-200 bg-white px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-ink-900">
                    {ETIQUETAS_DOCUMENTO[d.tipo_documento_id as TipoDocumento] ??
                      d.tipo_documento_id}
                  </div>
                  <div className="font-mono text-xs text-ink-500">
                    {d.nombre_original} · {(d.tamano_bytes / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[var(--accent)] hover:underline"
                  >
                    Descargar ↓
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Línea de tiempo */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-ink-700">Historial</h2>
        <ol className="mt-3 space-y-3">
          {eventos.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
              <div>
                <div className="text-ink-700">{formatearDescripcionEvento(e.descripcion) || e.tipo}</div>
                <div className="text-xs text-ink-400">
                  {new Date(e.created_at).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex justify-start">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-ink-700 hover:text-ink-900 hover:underline"
        >
          ← Volver al dashboard
        </Link>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{value || "—"}</dd>
    </div>
  );
}

