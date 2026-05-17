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
import { extraerTextoDeBuffer } from "./extraccion";
import {
  datosBasicosSchema,
  datosClinicosSchema,
  coInvestigadorSchema,
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from "./schemas";
import { formatearErrorZodClinico } from "./errores";

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
// guardarDatosClinicos
// ============================================================

export async function guardarDatosClinicosAction(
  protocoloId: string,
  payload: unknown,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const parsed = datosClinicosSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: formatearErrorZodClinico(parsed.error) };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("protocolos")
    .update({
      objetivo_general: parsed.data.objetivo_general,
      objetivos_especificos: parsed.data.objetivos_especificos,
      criterios_inclusion: parsed.data.criterios_inclusion,
      criterios_exclusion: parsed.data.criterios_exclusion,
      metodologia: parsed.data.metodologia,
      cronograma: parsed.data.cronograma,
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

  // Acuse de recibo institucional al investigador (fail-soft: si Resend
  // falla no revertimos el sometimiento).
  try {
    const { data: ipFull } = await admin
      .from("protocolos")
      .select(
        "clave, titulo, investigador_principal_id, usuarios:investigador_principal_id (nombre, apellido_paterno, apellido_materno, email)",
      )
      .eq("id", protocoloId)
      .single();
    type IpJoin = {
      clave: string | null;
      titulo: string;
      usuarios:
        | {
            nombre: string;
            apellido_paterno: string;
            apellido_materno: string | null;
            email: string;
          }
        | null;
    };
    const j = ipFull as IpJoin | null;
    if (j?.usuarios?.email) {
      const u = j.usuarios;
      const nombre = `${u.nombre} ${u.apellido_paterno}${u.apellido_materno ? " " + u.apellido_materno : ""}`.trim();
      const { notificarSometimiento } = await import("@/lib/email/notificar-sometimiento");
      const r = await notificarSometimiento({
        protocoloId,
        claveProtocolo: j.clave,
        tituloProtocolo: j.titulo,
        ipNombre: nombre,
        ipEmail: u.email,
      });
      if (!r.ok) {
        console.error("[enviarProtocoloAction] notificarSometimiento error:", r.error);
      }
    }
  } catch (e) {
    console.error("[enviarProtocoloAction] excepción notificando sometimiento:", e);
  }

  revalidatePath(`/protocolo/${protocoloId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ============================================================
// Extracción IA — punto de entrada
// ============================================================

/**
 * Server Action que crea un borrador desde un .docx/.pdf subido por el investigador.
 *
 * Flujo:
 *   1. Crea borrador con título placeholder
 *   2. Sube el archivo como formato_protocolo en Storage
 *   3. Extrae texto plano del archivo
 *   4. Crea fila en extracciones_ia con estado='pendiente' + texto_fuente
 *   5. Marca protocolos.esperando_extraccion = true
 *   6. Redirige a /protocolo/[id]/procesando que auto-refresca
 *
 * Desde la pantalla `procesando`, el cliente dispara POST /api/ia/procesar-extraccion
 * que llama a Claude Sonnet 4.6 y al terminar marca estado='completado'. El
 * trigger SQL `aplicar_extraccion_ia` aplica los campos al protocolo y desactiva
 * esperando_extraccion. Ver `docs/08_MOTOR_IA.md`.
 */
export async function crearProtocoloConIAAction(
  formData: FormData,
): Promise<ActionResult> {
  const usuarioId = await obtenerUsuarioId();
  if (!usuarioId)
    return { ok: false, error: "Completa tu perfil antes de someter un protocolo." };

  const file = formData.get("archivo") as File | null;
  if (!file || file.size === 0)
    return { ok: false, error: "Selecciona el archivo del protocolo (.docx o .pdf)." };
  if (file.size > MAX_BYTES)
    return { ok: false, error: "El archivo excede el límite de 25 MB." };
  if (!MIME_PERMITIDOS.includes(file.type))
    return { ok: false, error: "Formato no permitido. Sube PDF o Word (.doc/.docx)." };

  const admin = createAdminClient();

  // 1. Crear borrador
  const { data: prot, error: errProt } = await admin
    .from("protocolos")
    .insert({
      titulo: "Protocolo sin título (analizando con IA…)",
      investigador_principal_id: usuarioId,
      estado: "borrador",
      esperando_extraccion: true,
      involucra_humanos: true,
      involucra_menores: false,
      involucra_datos_geneticos: false,
      involucra_medicamento: false,
    })
    .select("id")
    .single();
  if (errProt || !prot)
    return { ok: false, error: errProt?.message ?? "No se pudo crear el borrador." };

  // 2. Subir archivo a Storage
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${prot.id}/formato_protocolo-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: errUpload } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (errUpload) {
    // Rollback
    await admin.from("protocolos").delete().eq("id", prot.id);
    return { ok: false, error: "Error al subir archivo: " + errUpload.message };
  }

  // 3. Registrar documento
  const { data: doc, error: errDoc } = await admin
    .from("protocolo_documentos")
    .insert({
      protocolo_id: prot.id,
      tipo_documento_id: "formato_protocolo",
      nombre_original: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      tamano_bytes: file.size,
      uploaded_by: usuarioId,
    })
    .select("id")
    .single();
  if (errDoc || !doc) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    await admin.from("protocolos").delete().eq("id", prot.id);
    return { ok: false, error: errDoc?.message ?? "Error al registrar documento." };
  }

  // 4. Extraer texto del archivo
  let texto: string;
  let warnings: string[] = [];
  try {
    const result = await extraerTextoDeBuffer(buffer, file.type);
    texto = result.texto;
    warnings = result.warnings;
  } catch (e) {
    // Mantener el archivo y el protocolo, pero marcar la extracción como error
    await admin.from("extracciones_ia").insert({
      protocolo_id: prot.id,
      documento_id: doc.id,
      estado: "error",
      error_mensaje: e instanceof Error ? e.message : "Error desconocido al extraer texto",
    });
    await admin
      .from("protocolos")
      .update({ esperando_extraccion: false })
      .eq("id", prot.id);
    revalidatePath("/dashboard");
    redirect(`/protocolo/${prot.id}/editar?aviso=extraccion_fallida`);
  }

  // 5. Crear extracción pendiente con el texto
  const { error: errExt } = await admin.from("extracciones_ia").insert({
    protocolo_id: prot.id,
    documento_id: doc.id,
    texto_fuente: texto,
    estado: "pendiente",
    resultado_json: warnings.length > 0 ? { warnings_extraccion: warnings } : null,
  });
  if (errExt) {
    return { ok: false, error: "Error al guardar extracción: " + errExt.message };
  }

  // 6. Registrar evento
  await admin.from("protocolo_eventos").insert({
    protocolo_id: prot.id,
    tipo: "extraccion_solicitada",
    descripcion: `IA analizará el protocolo (texto: ${texto.length.toLocaleString()} caracteres)`,
    actor_id: usuarioId,
    datos: { caracteres: texto.length, archivo: file.name },
  });

  revalidatePath("/dashboard");
  redirect(`/protocolo/${prot.id}/procesando`);
}

/** Re-disparar extracción si falló o el investigador quiere intentar de nuevo. */
export async function reintentarExtraccionAction(
  protocoloId: string,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const admin = createAdminClient();

  // Buscar el documento formato_protocolo
  const { data: doc } = await admin
    .from("protocolo_documentos")
    .select("id, storage_path, mime_type")
    .eq("protocolo_id", protocoloId)
    .eq("tipo_documento_id", "formato_protocolo")
    .maybeSingle();
  if (!doc) return { ok: false, error: "No hay formato_protocolo subido en este protocolo." };

  // Descargar el archivo, re-extraer texto
  const { data: fileData, error: errDl } = await admin.storage
    .from(BUCKET)
    .download(doc.storage_path);
  if (errDl || !fileData) {
    return { ok: false, error: "No se pudo leer el archivo desde Storage." };
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());
  let texto: string;
  try {
    const result = await extraerTextoDeBuffer(buffer, doc.mime_type);
    texto = result.texto;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al extraer texto",
    };
  }

  // Nueva extracción pendiente (no borramos las anteriores; quedan como historial)
  await admin.from("extracciones_ia").insert({
    protocolo_id: protocoloId,
    documento_id: doc.id,
    texto_fuente: texto,
    estado: "pendiente",
  });

  await admin
    .from("protocolos")
    .update({ esperando_extraccion: true })
    .eq("id", protocoloId);

  await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "extraccion_reintentada",
    descripcion: "El investigador solicitó re-analizar el protocolo con IA",
    actor_id: check.usuarioId,
  });

  revalidatePath(`/protocolo/${protocoloId}/procesando`);
  revalidatePath(`/protocolo/${protocoloId}/editar`);
  return { ok: true };
}

/** Saltar la extracción y abrir el wizard manual directo. */
export async function saltarExtraccionAction(
  protocoloId: string,
): Promise<ActionResult> {
  const check = await verificarPropiedadEditable(protocoloId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  await admin
    .from("protocolos")
    .update({ esperando_extraccion: false })
    .eq("id", protocoloId);

  revalidatePath(`/protocolo/${protocoloId}/editar`);
  redirect(`/protocolo/${protocoloId}/editar`);
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
