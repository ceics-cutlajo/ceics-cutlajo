/**
 * Descarga del acta oficial (PDF o DOCX) por redirección a URL firmada FRESCA.
 *
 * Mismo motivo que /api/documentos/[id]: las firmas de Supabase Storage caducan
 * (claim `exp`). Antes el acta se firmaba al renderizar la página con 10 min de
 * vida; si alguien dejaba el expediente abierto más de 10 min, fallaba igual.
 * Aquí se firma en el instante del clic, así nunca está vencida, y se autoriza
 * cada descarga (miembro del comité o el investigador dueño del protocolo).
 *
 * Formato por querystring: ?f=pdf (por defecto) o ?f=docx.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  obtenerUsuarioActual,
  esMiembroComite,
} from "@/lib/auth/usuario-actual";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formato =
    new URL(request.url).searchParams.get("f") === "docx" ? "docx" : "pdf";

  // Sesión obligatoria (si no hay, obtenerUsuarioActual redirige a /login).
  const usuario = await obtenerUsuarioActual();

  const admin = createAdminClient();
  const { data: acta } = await admin
    .from("actas")
    .select("protocolo_id, docx_storage_path, pdf_storage_path")
    .eq("id", id)
    .single();

  if (!acta) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  // Autorización: miembro del comité o el investigador principal del protocolo.
  let permitido = esMiembroComite(usuario.roles);
  if (!permitido) {
    const [{ data: prot }, { data: perfil }] = await Promise.all([
      admin
        .from("protocolos")
        .select("investigador_principal_id")
        .eq("id", acta.protocolo_id)
        .single(),
      admin.from("usuarios").select("id").eq("email", usuario.email).single(),
    ]);
    permitido = !!perfil && prot?.investigador_principal_id === perfil.id;
  }

  if (!permitido) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const path =
    formato === "docx" ? acta.docx_storage_path : acta.pdf_storage_path;
  if (!path) {
    return NextResponse.json(
      { error: "El acta no tiene ese formato disponible" },
      { status: 404 },
    );
  }

  // Firma fresca, usada de inmediato por la redirección → nunca caduca antes
  // de que el navegador la siga.
  const { data: signed, error } = await admin.storage
    .from("actas")
    .createSignedUrl(path, 120);
  if (error || !signed) {
    return NextResponse.json(
      { error: "El archivo no está disponible" },
      { status: 502 },
    );
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
