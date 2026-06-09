/**
 * Descarga de un documento del protocolo (redirección a URL firmada FRESCA).
 *
 * Por qué existe: las URLs firmadas de Supabase Storage caducan (claim `exp`).
 * Antes se firmaban al renderizar la página del comité y se incrustaban en los
 * enlaces "Descargar"; si el revisor tardaba más que la vida de la firma en dar
 * clic, Storage respondía `400 InvalidJWT "exp" claim timestamp check failed`.
 * Como un miembro del comité lee el expediente varios minutos antes de bajar un
 * anexo, la firma siempre caducaba. (No era un problema de un usuario: lo
 * reproduce cualquiera que tarde en dar clic.)
 *
 * Aquí la firma se genera en el INSTANTE del clic y se responde con una
 * redirección, así nunca está vencida. De paso, autoriza cada descarga (miembro
 * del comité o el propio investigador dueño del protocolo) en lugar de confiar
 * solo en la página que mostró el enlace.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  obtenerUsuarioActual,
  esMiembroComite,
} from "@/lib/auth/usuario-actual";
import { urlFirmadaDocumento } from "@/lib/protocolos/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Sesión obligatoria (si no hay, obtenerUsuarioActual redirige a /login).
  const usuario = await obtenerUsuarioActual();

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("protocolo_documentos")
    .select("storage_path, protocolo_id")
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 },
    );
  }

  // Autorización: miembro del comité o el investigador principal del protocolo.
  let permitido = esMiembroComite(usuario.roles);
  if (!permitido) {
    const [{ data: prot }, { data: perfil }] = await Promise.all([
      admin
        .from("protocolos")
        .select("investigador_principal_id")
        .eq("id", doc.protocolo_id)
        .single(),
      admin.from("usuarios").select("id").eq("email", usuario.email).single(),
    ]);
    permitido =
      !!perfil && prot?.investigador_principal_id === perfil.id;
  }

  if (!permitido) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Firma fresca, usada de inmediato por la redirección → nunca caduca antes
  // de que el navegador la siga.
  const url = await urlFirmadaDocumento(doc.storage_path);
  if (!url) {
    return NextResponse.json(
      { error: "El archivo no está disponible" },
      { status: 502 },
    );
  }

  return NextResponse.redirect(url, 302);
}
