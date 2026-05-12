import { notFound, redirect } from "next/navigation";
import { obtenerProtocolo, urlFirmadaDocumento } from "@/lib/protocolos/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import { Revisar } from "./revisar";
import type { PreDictamen } from "@/lib/ia/schema-pre-dictamen";

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

  // Detectar conflicto de interés del usuario actual
  const conflictoInteres =
    datos.protocolo.investigador_principal_id ===
    (await admin
      .from("usuarios")
      .select("id")
      .eq("email", usuario.email)
      .single()).data?.id;

  // URLs firmadas para los documentos (TTL 1h por default en el helper)
  const documentosConUrl = await Promise.all(
    datos.documentos.map(async (d) => ({
      ...d,
      urlDescarga: await urlFirmadaDocumento(d.storage_path),
    })),
  );

  return (
    <Revisar
      protocoloId={id}
      protocolo={datos.protocolo}
      coInvestigadores={datos.coInvestigadores}
      documentos={documentosConUrl}
      ipNombre={ipNombre}
      conflictoInteres={conflictoInteres}
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
  );
}
