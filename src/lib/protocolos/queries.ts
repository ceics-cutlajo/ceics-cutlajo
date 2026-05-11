/**
 * Queries de lectura para protocolos. Todas corren server-side.
 *
 * NOTA: Usan admin client (service_role) para evitar el desalineamiento entre
 * `auth.uid()` (de auth.users) y `usuarios.id` (UUID propio generado en la app).
 * El filtrado de seguridad se hace explícitamente comparando el `id` del usuario
 * recuperado por email. Cuando se arregle ese mapeo (sesión futura, ADR-010 pendiente)
 * se puede volver a depender de RLS.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import type { EstadoProtocolo } from "@/types/domain";

export type ProtocoloResumen = {
  id: string;
  clave: string | null;
  titulo: string;
  estado: EstadoProtocolo;
  created_at: string;
  submitted_at: string | null;
  numero_oficio: string | null;
};

export type ProtocoloCompleto = {
  id: string;
  clave: string | null;
  numero_consecutivo: number;
  titulo: string;
  resumen: string | null;
  estado: EstadoProtocolo;
  investigador_principal_id: string;
  area_conocimiento_id: number | null;
  tipo_investigacion_id: string | null;
  clasificacion_riesgo: "sin_riesgo" | "riesgo_minimo" | "riesgo_mayor_minimo" | null;
  involucra_humanos: boolean;
  involucra_menores: boolean;
  involucra_datos_geneticos: boolean;
  involucra_medicamento: boolean;
  numero_oficio: string | null;
  created_at: string;
  submitted_at: string | null;
  dictaminado_at: string | null;
  fecha_aprobacion: string | null;
  fecha_vencimiento: string | null;
};

export type CoInvestigadorRow = {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  adscripcion: string | null;
  email: string | null;
  orden: number;
};

export type DocumentoRow = {
  id: string;
  tipo_documento_id: string;
  nombre_original: string;
  storage_path: string;
  mime_type: string;
  tamano_bytes: number;
  uploaded_at: string;
};

export type EventoRow = {
  id: string;
  tipo: string;
  descripcion: string | null;
  created_at: string;
  datos: Record<string, unknown> | null;
};

/**
 * Lista los protocolos del investigador actual. Si es miembro del comité,
 * lista todos los que han sido enviados (no borradores ajenos).
 */
export async function listarProtocolos(): Promise<ProtocoloResumen[]> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();

  // Obtener el id de la tabla usuarios (no el auth.uid)
  const { data: perfil } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  if (!perfil) return [];

  const esComite = usuario.roles.some((r) =>
    ["presidente", "comite_vocal", "comite_secretario", "admin_sistema"].includes(r),
  );

  let query = admin
    .from("protocolos")
    .select("id, clave, titulo, estado, created_at, submitted_at, numero_oficio")
    .order("created_at", { ascending: false });

  if (esComite) {
    // Comité ve todo lo enviado + sus propios borradores
    query = query.or(
      `investigador_principal_id.eq.${perfil.id},estado.neq.borrador`,
    );
  } else {
    query = query.eq("investigador_principal_id", perfil.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listarProtocolos error:", error);
    return [];
  }
  return (data ?? []) as ProtocoloResumen[];
}

export async function obtenerProtocolo(
  protocoloId: string,
): Promise<{
  protocolo: ProtocoloCompleto;
  coInvestigadores: CoInvestigadorRow[];
  documentos: DocumentoRow[];
  eventos: EventoRow[];
  esPropietario: boolean;
} | null> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  if (!perfil) return null;

  const { data: protocolo, error } = await admin
    .from("protocolos")
    .select("*")
    .eq("id", protocoloId)
    .single();
  if (error || !protocolo) return null;

  const esPropietario = protocolo.investigador_principal_id === perfil.id;
  const esComite = usuario.roles.some((r) =>
    ["presidente", "comite_vocal", "comite_secretario", "admin_sistema"].includes(r),
  );

  // Seguridad: el dueño puede ver siempre; comité solo si no es borrador ajeno
  if (!esPropietario && !esComite) return null;
  if (!esPropietario && protocolo.estado === "borrador") return null;

  const [{ data: coInvs }, { data: docs }, { data: eventos }] = await Promise.all([
    admin
      .from("protocolo_co_investigadores")
      .select("id, nombre, apellido_paterno, apellido_materno, adscripcion, email, orden")
      .eq("protocolo_id", protocoloId)
      .order("orden"),
    admin
      .from("protocolo_documentos")
      .select("id, tipo_documento_id, nombre_original, storage_path, mime_type, tamano_bytes, uploaded_at")
      .eq("protocolo_id", protocoloId)
      .order("uploaded_at"),
    admin
      .from("protocolo_eventos")
      .select("id, tipo, descripcion, created_at, datos")
      .eq("protocolo_id", protocoloId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    protocolo: protocolo as ProtocoloCompleto,
    coInvestigadores: (coInvs ?? []) as CoInvestigadorRow[],
    documentos: (docs ?? []) as DocumentoRow[],
    eventos: (eventos ?? []) as EventoRow[],
    esPropietario,
  };
}

/** URL firmada para descargar un documento desde Storage (válida 60 s). */
export async function urlFirmadaDocumento(storagePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("protocolos")
    .createSignedUrl(storagePath, 60);
  if (error || !data) return null;
  return data.signedUrl;
}
