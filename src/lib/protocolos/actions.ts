"use server";

/**
 * Server Actions de protocolos.
 *
 * Convención de seguridad: todas las acciones obtienen el usuario actual desde
 * la sesión (cookie) y verifican explícitamente la propiedad del protocolo
 * comparando `protocolo.investigador_principal_id` con `usuarios.id` (NO con
 * auth.uid()). Las queries usan admin client para evitar la inconsistencia
 * de RLS heredada — el filtrado se hace en código.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import {
  datosBasicosSchema,
  coInvestigadorSchema,
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from "./schemas";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const BUCKET = "protocolos";
const ESTADOS_EDITABLES = ["borrador", "observaciones"] as const;

async function obtenerUsuarioId(): Promise<string | null> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();
  const { data } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  return data?.id ?? null;
}

async function verificarPropiedadEditable(
  protocoloId: string,
): Promise<{ ok: true; usuarioId: string } | { ok: false; error: string }> {
  const usuarioId = await obtenerUsuarioId();
  if (!usuarioId) return { ok: false, error: "No se encontró tu perfil de usuario." };

  const admin = createAdminClient();
  const { data: prot } = await admin
    .from("protocolos")
    .select("investigador_principal_id, estado")
    .eq("id", protocoloId)
    .single();
  if (!prot) return { ok: false, error: "Protocolo no encontrado." };
  if (prot.investigador_principal_id !== usuarioId)
    return { ok: false, error: "No tienes permiso para modificar este protocolo." };
  if (!ESTADOS_EDITABLES.includes(prot.estado))
    return {
      ok: false,
      error: "Solo puedes editar protocolos en estado borrador o con observaciones.",
    };
  return { ok: true, usuarioId };
}

// ============================================================
// crearBorrador
// ============================================================

export async function crearBorradorAction(): Promise<ActionResult<{ id: string }>> {
  const usuarioId = await obtenerUsuarioId();
  if (!usuarioId)
    return { ok: false, error: "Completa tu perfil antes de someter un protocolo." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("protocolos")
    .insert({
      titulo: "Protocolo sin título",
      investigador_principal_id: usuarioId,
      estado: "borrador",
      involucra_humanos: true,
      involucra_menores: false,
      involucra_datos_geneticos: false,
      involucra_medicamento: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear el borrador." };
  }

  // Registrar evento
  await admin.from("protocolo_eventos").insert({
    protocolo_id: data.id,
    tipo: "borrador_creado",
    descripcion: "Borrador creado por el investigador",
    actor_id: usuarioId,
  });

  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

/** Action invocable directamente desde un <form>: crea borrador y redirige al editor. */
export async function crearYEditarProtocoloAction() {
  const res = await crearBorradorAction();
  if (!res.ok) {
    // Devolver al dashboard con mensaje
    redirect(`/dashboard?error=${encodeURIComponent(res.error)}`);
  }
  redirect(`/protocolo/${res.data!.id}/editar`);
}

// ============================================================
// guardarDatosBasicos
// ============================================================

export async function guardarDatosBasicosAction(
  protocoloId: string,
  payload: unknown,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const parsed = datosBasicosSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("protocolos")
    .update({
      titulo: parsed.data.titulo,
      resumen: parsed.data.resumen,
      area_conocimiento_id: parsed.data.area_conocimiento_id,
      tipo_investigacion_id: parsed.data.tipo_investigacion_id,
      clasificacion_riesgo: parsed.data.clasificacion_riesgo,
      involucra_humanos: parsed.data.involucra_humanos,
      involucra_menores: parsed.data.involucra_menores,
      involucra_datos_geneticos: parsed.data.involucra_datos_geneticos,
      involucra_medicamento: parsed.data.involucra_medicamento,
    })
    .eq("id", protocoloId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/protocolo/${protocoloId}`);
  revalidatePath(`/protocolo/${protocoloId}/editar`);
  return { ok: true };
}

// ============================================================
// Co-investigadores
// ============================================================

export async function agregarCoInvestigadorAction(
  protocoloId: string,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const parsed = coInvestigadorSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const { data: existentes } = await admin
    .from("protocolo_co_investigadores")
    .select("orden")
    .eq("protocolo_id", protocoloId)
    .order("orden", { ascending: false })
    .limit(1);

  const siguienteOrden = (existentes?.[0]?.orden ?? 0) + 1;

  const { data, error } = await admin
    .from("protocolo_co_investigadores")
    .insert({
      protocolo_id: protocoloId,
      nombre: parsed.data.nombre,
      apellido_paterno: parsed.data.apellido_paterno,
      apellido_materno: parsed.data.apellido_materno || null,
      adscripcion: parsed.data.adscripcion,
      email: parsed.data.email || null,
      orden: siguienteOrden,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Error al agregar" };

  revalidatePath(`/protocolo/${protocoloId}/editar`);
  return { ok: true, data: { id: data.id } };
}

export async function eliminarCoInvestigadorAction(
  protocoloId: string,
  coInvId: string,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { error } = await admin
    .from("protocolo_co_investigadores")
    .delete()
    .eq("id", coInvId)
    .eq("protocolo_id", protocoloId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/protocolo/${protocoloId}/editar`);
  return { ok: true };
}

// ============================================================
// Documentos
// ============================================================

const MIME_PERMITIDOS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

const MAX_BYTES = 25 * 1024 * 1024;

export async function subirDocumentoAction(
  protocoloId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const tipo = formData.get("tipo_documento_id") as TipoDocumento | null;
  const file = formData.get("archivo") as File | null;

  if (!tipo || !TIPOS_DOCUMENTO.includes(tipo))
    return { ok: false, error: "Tipo de documento inválido." };
  if (!file || file.size === 0)
    return { ok: false, error: "Selecciona un archivo." };
  if (file.size > MAX_BYTES)
    return { ok: false, error: "El archivo excede el límite de 25 MB." };
  if (!MIME_PERMITIDOS.includes(file.type))
    return { ok: false, error: "Formato no permitido. Sube PDF o Word (.doc/.docx)." };

  const admin = createAdminClient();

  // Si ya existe un documento de este tipo, lo reemplazamos (eliminamos el viejo)
  const { data: existente } = await admin
    .from("protocolo_documentos")
    .select("id, storage_path")
    .eq("protocolo_id", protocoloId)
    .eq("tipo_documento_id", tipo)
    .maybeSingle();

  if (existente) {
    await admin.storage.from(BUCKET).remove([existente.storage_path]);
    await admin.from("protocolo_documentos").delete().eq("id", existente.id);
  }

  // Subir a Storage
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${protocoloId}/${tipo}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: errorUpload } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (errorUpload) {
    return { ok: false, error: "Error al subir: " + errorUpload.message };
  }

  // Registrar metadata
  const { data: doc, error: errorDoc } = await admin
    .from("protocolo_documentos")
    .insert({
      protocolo_id: protocoloId,
      tipo_documento_id: tipo,
      nombre_original: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      tamano_bytes: file.size,
      uploaded_by: check.usuarioId,
    })
    .select("id")
    .single();

  if (errorDoc || !doc) {
    // Rollback del storage
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: errorDoc?.message ?? "Error al registrar documento." };
  }

  await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "documento_subido",
    descripcion: `Documento "${tipo}" subido: ${file.name}`,
    actor_id: check.usuarioId,
    datos: { tipo_documento: tipo, nombre: file.name, tamano: file.size },
  });

  revalidatePath(`/protocolo/${protocoloId}/editar`);
  return { ok: true, data: { id: doc.id } };
}

export async function eliminarDocumentoAction(
  protocoloId: string,
  documentoId: string,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("protocolo_documentos")
    .select("storage_path, tipo_documento_id")
    .eq("id", documentoId)
    .eq("protocolo_id", protocoloId)
    .single();

  if (!doc) return { ok: false, error: "Documento no encontrado." };

  await admin.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await admin
    .from("protocolo_documentos")
    .delete()
    .eq("id", documentoId);
  if (error) return { ok: false, error: error.message };

  await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "documento_eliminado",
    descripcion: `Documento "${doc.tipo_documento_id}" eliminado`,
    actor_id: check.usuarioId,
  });

  revalidatePath(`/protocolo/${protocoloId}/editar`);
  return { ok: true };
}

// ============================================================
// Enviar protocolo
// ============================================================

export async function enviarProtocoloAction(
  protocoloId: string,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  const { data: prot } = await admin
    .from("protocolos")
    .select(
      "titulo, resumen, area_conocimiento_id, tipo_investigacion_id, clasificacion_riesgo, involucra_humanos, involucra_menores",
    )
    .eq("id", protocoloId)
    .single();

  if (!prot) return { ok: false, error: "Protocolo no encontrado." };

  // Validar completitud de datos básicos
  const validacion = datosBasicosSchema.safeParse({
    titulo: prot.titulo,
    resumen: prot.resumen,
    area_conocimiento_id: prot.area_conocimiento_id,
    tipo_investigacion_id: prot.tipo_investigacion_id,
    clasificacion_riesgo: prot.clasificacion_riesgo,
    involucra_humanos: prot.involucra_humanos,
    involucra_menores: prot.involucra_menores,
    involucra_datos_geneticos: false,
    involucra_medicamento: false,
  });
  if (!validacion.success) {
    return {
      ok: false,
      error:
        "Datos básicos incompletos: " +
        (validacion.error.errors[0]?.message ?? "revisa los campos"),
    };
  }

  // Validar documentos obligatorios
  const obligatorios: TipoDocumento[] = [
    "carta_presidente",
    "formato_protocolo",
    "delegacion",
    "cv_ip",
  ];
  if (prot.tipo_investigacion_id === "clinica") obligatorios.push("bpc");
  if (prot.involucra_humanos) obligatorios.push("consentimiento");
  if (prot.involucra_menores) obligatorios.push("asentimiento");

  const { data: docs } = await admin
    .from("protocolo_documentos")
    .select("tipo_documento_id")
    .eq("protocolo_id", protocoloId);

  const subidos = new Set((docs ?? []).map((d) => d.tipo_documento_id));
  const faltantes = obligatorios.filter((t) => !subidos.has(t));
  if (faltantes.length > 0) {
    return {
      ok: false,
      error: `Faltan documentos obligatorios: ${faltantes.join(", ")}`,
    };
  }

  // Cambiar estado a "en_evaluacion_ia" (próxima sesión la IA lo recogerá)
  const { error } = await admin
    .from("protocolos")
    .update({
      estado: "en_evaluacion_ia",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", protocoloId);

  if (error) return { ok: false, error: error.message };

  await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "protocolo_enviado",
    descripcion: "Protocolo enviado al CEICS para evaluación",
    actor_id: check.usuarioId,
  });

  revalidatePath(`/protocolo/${protocoloId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ============================================================
// Eliminar borrador
// ============================================================

export async function eliminarBorradorAction(
  protocoloId: string,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const admin = createAdminClient();

  // Eliminar archivos de Storage primero
  const { data: docs } = await admin
    .from("protocolo_documentos")
    .select("storage_path")
    .eq("protocolo_id", protocoloId);

  if (docs && docs.length > 0) {
    await admin.storage.from(BUCKET).remove(docs.map((d) => d.storage_path));
  }

  const { error } = await admin
    .from("protocolos")
    .delete()
    .eq("id", protocoloId)
    .eq("estado", "borrador");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
