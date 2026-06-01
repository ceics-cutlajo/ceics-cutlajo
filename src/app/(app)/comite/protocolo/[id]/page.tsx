import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { obtenerProtocolo, urlFirmadaDocumento } from "@/lib/protocolos/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import { Revisar } from "./revisar";
import type { PreDictamen } from "@/lib/ia/schema-pre-dictamen";
import {
  obtenerEvaluacionUsuario,
  listarEvaluacionesProtocolo,
  listarMiembrosElegiblesComite,
} from "@/lib/evaluaciones/queries";
import { obtenerVersionMaxPreInforme } from "@/lib/timeline/queries";
import { derivarTimeline } from "@/lib/timeline/derivar-etapa";
import { TimelineProtocolo } from "@/components/timeline/timeline-protocolo";
import { obtenerActaPorProtocolo } from "@/lib/actas/queries";
import { CardActa } from "@/components/actas/card-acta";
import { BannerEmitirDictamen } from "@/components/actas/banner-emitir-dictamen";

export const dynamic = "force-dynamic";

export default async function ComiteProtocoloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await obtenerUsuarioActual();
  const esComite = usuario.roles.some((r) =>
    ["presidente", "comite_vocal", "comite_secretario", "admin_sistema"].includes(r),
  );
  if (!esComite) {
    redirect("/dashboard");
  }

  const datos = await obtenerProtocolo(id);
  if (!datos) notFound();

  // El comité solo abre protocolos enviados (no borradores ajenos)
  if (datos.protocolo.estado === "borrador") {
    redirect("/comite/bandeja");
  }

  // Pre-informe más reciente (puede no existir todavía)
  const admin = createAdminClient();
  const { data: preInformeRow } = await admin
    .from("pre_informes")
    .select(
      "id, version, generado_at, modelo_usado, contenido, resumen_ejecutivo, cumple_global, total_items_evaluados, items_cumple, items_no_cumple, items_parcial, items_no_aplica, observaciones_criticas, sugerencias, duracion_segundos",
    )
    .eq("protocolo_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Nombre del IP
  const { data: ipUsuario } = await admin
    .from("usuarios")
    .select("nombre, apellido_paterno, apellido_materno, email")
    .eq("id", datos.protocolo.investigador_principal_id)
    .single();
  const ipNombre = ipUsuario
    ? `${ipUsuario.nombre} ${ipUsuario.apellido_paterno}${ipUsuario.apellido_materno ? " " + ipUsuario.apellido_materno : ""}`
    : "(IP no encontrado)";

  // Resolver id del usuario actual
  const { data: usuarioActualRow } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  const usuarioActualId = usuarioActualRow?.id ?? null;

  // Detectar conflicto de interés del usuario actual
  const conflictoInteres =
    !!usuarioActualId &&
    datos.protocolo.investigador_principal_id === usuarioActualId;

  // Evaluación previa del usuario actual (si ya votó)
  const evaluacionPrevia = usuarioActualId
    ? await obtenerEvaluacionUsuario(id, usuarioActualId)
    : null;

  // Progreso de la votación: cuántos miembros han emitido y el total elegible.
  // `decisivos` excluye abstenciones; sirve para ocultar el botón "Forzar cierre"
  // cuando solo hay abstenciones por COI (cerrar en ese estado no tiene sentido).
  const miembrosElegibles = await listarMiembrosElegiblesComite();
  const evaluacionesEmitidas = await listarEvaluacionesProtocolo(id);
  const progresoVotacion = {
    emitidos: evaluacionesEmitidas.length,
    decisivos: evaluacionesEmitidas.filter((e) => e.voto_global !== "abstener").length,
    total: miembrosElegibles.length,
  };

  const esPresidente = usuario.roles.includes("presidente");
  const esSecretario = usuario.roles.includes("comite_secretario");

  // Quién es el Presidente titular del CEICS hoy (para detectar COI presidencial)
  const { data: presidenteTitularRow } = await admin
    .from("usuario_roles")
    .select("usuario_id")
    .eq("rol", "presidente")
    .limit(1)
    .maybeSingle();
  const presidenteTitularId = presidenteTitularRow?.usuario_id ?? null;
  const presidenteEsIP =
    !!presidenteTitularId &&
    presidenteTitularId === datos.protocolo.investigador_principal_id;

  // URLs firmadas + versión máxima de pre-informe (en paralelo)
  const [documentosConUrl, versionMaxPreInforme] = await Promise.all([
    Promise.all(
      datos.documentos.map(async (d) => ({
        ...d,
        urlDescarga: await urlFirmadaDocumento(d.storage_path),
      })),
    ),
    obtenerVersionMaxPreInforme(id),
  ]);

  const timeline = derivarTimeline({
    estado: datos.protocolo.estado,
    submitted_at: datos.protocolo.submitted_at,
    versionMaxPreInforme,
  });

  // Acta del protocolo (si ya fue emitida)
  const acta = await obtenerActaPorProtocolo(id);
  let docxUrl: string | null = null;
  let pdfUrl: string | null = null;
  if (acta?.docx_storage_path && acta?.pdf_storage_path) {
    const [docxResp, pdfResp] = await Promise.all([
      admin.storage.from("actas").createSignedUrl(acta.docx_storage_path, 600),
      admin.storage.from("actas").createSignedUrl(acta.pdf_storage_path, 600),
    ]);
    docxUrl = docxResp.data?.signedUrl ?? null;
    pdfUrl = pdfResp.data?.signedUrl ?? null;
  }
  // El banner se muestra cuando:
  //  - es Presidente y NO es IP del protocolo, o
  //  - es Secretario(a) y el Presidente titular SÍ es IP (delegación por COI).
  const puedeEmitirComoPresidente =
    esPresidente && !presidenteEsIP;
  const puedeEmitirComoSecretaria =
    esSecretario && presidenteEsIP;
  const modoBanner: "presidente" | "delegacion_secretaria" | null =
    puedeEmitirComoPresidente
      ? "presidente"
      : puedeEmitirComoSecretaria
        ? "delegacion_secretaria"
        : null;
  const mostrarBannerEmitir =
    modoBanner !== null &&
    datos.protocolo.estado === "listo_dictamen" &&
    acta === null;

  return (
    <div className="space-y-6">
      <Link href="/comite/bandeja" className="block text-sm text-ink-500 hover:underline">
        ← Volver a la bandeja
      </Link>
      <TimelineProtocolo
        protocolo={datos.protocolo}
        ipNombre={ipNombre}
        coInvestigadores={datos.coInvestigadores}
        timeline={timeline}
        progresoVotacion={progresoVotacion}
        firmaPorDelegacion={presidenteEsIP}
      />
      {mostrarBannerEmitir && modoBanner && (
        <BannerEmitirDictamen
          protocoloId={id}
          recomendacion={datos.protocolo.recomendacion_comite}
          modo={modoBanner}
        />
      )}
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
          docxUrl={docxUrl}
          pdfUrl={pdfUrl}
          enviadaAt={acta.enviada_a_investigador_at}
        />
      )}
      <Revisar
        protocoloId={id}
        protocolo={datos.protocolo}
        coInvestigadores={datos.coInvestigadores}
        documentos={documentosConUrl}
        ipNombre={ipNombre}
        conflictoInteres={conflictoInteres}
        esPresidente={esPresidente}
        evaluacionPrevia={evaluacionPrevia}
        progresoVotacion={progresoVotacion}
        preInforme={
        preInformeRow
          ? {
              id: preInformeRow.id,
              version: preInformeRow.version,
              generado_at: preInformeRow.generado_at,
              modelo_usado: preInformeRow.modelo_usado,
              resumen_ejecutivo: preInformeRow.resumen_ejecutivo,
              cumple_global: preInformeRow.cumple_global,
              total_items_evaluados: preInformeRow.total_items_evaluados,
              items_cumple: preInformeRow.items_cumple,
              items_no_cumple: preInformeRow.items_no_cumple,
              items_parcial: preInformeRow.items_parcial,
              items_no_aplica: preInformeRow.items_no_aplica,
              observaciones_criticas: preInformeRow.observaciones_criticas ?? [],
              sugerencias: preInformeRow.sugerencias ?? [],
              duracion_segundos: preInformeRow.duracion_segundos,
              contenido: preInformeRow.contenido as PreDictamen,
            }
          : null
        }
      />
    </div>
  );
}
