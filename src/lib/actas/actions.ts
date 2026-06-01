"use server";

/**
 * Server actions del módulo de actas (sesión 9b).
 *
 * Acción principal: `emitirDictamenAction(input)` — solo Presidente. Genera
 * DOCX + PDF, los sube a Storage, inserta la fila en `actas`, cambia el
 * estado del protocolo al resultado final, registra evento y dispara email
 * al IP con adjuntos.
 *
 * Patrón:
 *   - service_role + filtrado manual por usuarios.id (ADR-010 pendiente)
 *   - guardia atómica de estado (UPDATE WHERE estado='listo_dictamen')
 *   - idempotente: si ya hay acta para el protocolo, devuelve la existente
 *   - email fail-soft: si Resend falla, el acta queda emitida igual
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import {
  emitirDictamenInputSchema,
  estadoProtocoloDesdeResolucion,
  type EmitirDictamenInput,
} from "./schemas";
import { obtenerDatosBaseActa } from "./queries";
import { generarActaDocx } from "./generar-docx";
import { generarActaPdf } from "./generar-pdf";
import {
  fechaLarga,
  hoyIso,
  sumarMeses,
  generarHashFolio,
  MARCO_NORMATIVO_DEFAULT,
  pathActa,
} from "./formatos";
import { notificarInvestigador } from "@/lib/email/notificar-investigador";
import type { DatosActa, MiembroActa, ResolucionActa } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const BUCKET = "actas";
const URL_BASE_VALIDACION = "https://ceics-cutlajo.com/v/";

type FirmanteResuelto = {
  usuarioId: string;
  rol: "presidente" | "comite_secretario";
  cargo: "Presidente" | "Secretaria" | "Secretario";
  porDelegacion: boolean;
};

/**
 * Resuelve quién está habilitado para firmar el acta del protocolo dado.
 *
 * Reglas:
 *   - Presidente y NO es IP del protocolo → firma (caso normal).
 *   - Presidente y ES IP → bloqueo por COI; debe firmar Secretaría.
 *   - Secretario(a) cuando Presidente es IP → firma por delegación.
 *   - Secretario(a) cuando Presidente NO es IP → no autorizado.
 *   - Cualquier otro rol → no autorizado.
 */
async function obtenerFirmanteActual(args: {
  investigadorPrincipalId: string;
  presidenteTitularId: string;
}): Promise<
  { ok: true; firmante: FirmanteResuelto } | { ok: false; error: string }
> {
  const usuario = await obtenerUsuarioActual();
  const esPresidente = usuario.roles.includes("presidente");
  const esSecretario = usuario.roles.includes("comite_secretario");
  if (!esPresidente && !esSecretario) {
    return {
      ok: false,
      error:
        "Solo el Presidente o el(la) Secretario(a) del CEICS pueden emitir el dictamen final.",
    };
  }

  const admin = createAdminClient();
  const { data: u } = await admin
    .from("usuarios")
    .select("id, nombre")
    .eq("email", usuario.email)
    .single();
  if (!u) return { ok: false, error: "No se encontró tu perfil de usuario." };
  const presidenteEsIP =
    args.presidenteTitularId === args.investigadorPrincipalId;

  if (esPresidente && !presidenteEsIP) {
    return {
      ok: true,
      firmante: {
        usuarioId: u.id,
        rol: "presidente",
        cargo: "Presidente",
        porDelegacion: false,
      },
    };
  }
  if (esPresidente && presidenteEsIP) {
    return {
      ok: false,
      error:
        "Conflicto de interés: eres el Investigador Principal de este protocolo y, " +
        "como Presidente del CEICS, no puedes emitir su acta. Conforme al Reglamento Interno, " +
        "la emisión corresponde al(la) Secretario(a) del comité. Cierra sesión e ingresa " +
        "con la cuenta de Secretaría para emitir este dictamen.",
    };
  }
  if (esSecretario && presidenteEsIP) {
    const nombre = u.nombre as string | null;
    const tokens = (nombre ?? "").trim().toLowerCase().split(/\s+/);
    const algunFemenino = tokens.some(
      (t) => t.endsWith("a") || t.endsWith("á"),
    );
    const cargo = algunFemenino ? "Secretaria" : "Secretario";
    return {
      ok: true,
      firmante: {
        usuarioId: u.id,
        rol: "comite_secretario",
        cargo,
        porDelegacion: true,
      },
    };
  }
  // Secretario sin COI presidencial.
  return {
    ok: false,
    error:
      "El Presidente del CEICS no tiene conflicto de interés con este protocolo; " +
      "la emisión del acta le corresponde a él(ella). La delegación a Secretaría " +
      "solo procede ante COI presidencial.",
  };
}

export async function emitirDictamenAction(
  input: EmitirDictamenInput,
): Promise<
  ActionResult<{
    actaId: string;
    numeroOficio: string;
    docxPath: string;
    pdfPath: string;
  }>
> {
  // 1. Validación
  const parsed = emitirDictamenInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos.",
    };
  }
  const datos = parsed.data;

  const admin = createAdminClient();

  // 2. Recopilar datos (incluye la ronda en curso)
  const base = await obtenerDatosBaseActa(datos.protocoloId);
  if (!base) {
    return { ok: false, error: "No se encontró el protocolo o sus datos están incompletos." };
  }
  const rondaActual = base.protocolo.ronda_actual ?? 1;

  // 3. Idempotencia POR RONDA: si ya existe acta para la ronda en curso,
  // devolverla. Las actas de rondas anteriores no bloquean la emisión de la
  // ronda actual (ciclo de re-evaluación).
  const { data: actaExistente } = await admin
    .from("actas")
    .select("id, numero_oficio, docx_storage_path, pdf_storage_path")
    .eq("protocolo_id", datos.protocoloId)
    .eq("ronda", rondaActual)
    .maybeSingle();
  if (actaExistente) {
    return {
      ok: true,
      data: {
        actaId: actaExistente.id,
        numeroOficio: actaExistente.numero_oficio,
        docxPath: actaExistente.docx_storage_path ?? "",
        pdfPath: actaExistente.pdf_storage_path ?? "",
      },
    };
  }

  // 4. Verificar estado
  if (base.protocolo.estado !== "listo_dictamen") {
    return {
      ok: false,
      error: `El protocolo no está listo para dictamen (estado actual: ${base.protocolo.estado}).`,
    };
  }

  // 4. Resolución de firmante: Presidente o Secretaria por delegación
  // (cuando el Presidente es Investigador Principal del protocolo).
  const firmanteResp = await obtenerFirmanteActual({
    investigadorPrincipalId: base.protocolo.investigador_principal_id,
    presidenteTitularId: base.presidente.id,
  });
  if (!firmanteResp.ok) return firmanteResp;
  const firmante = firmanteResp.firmante;

  if (firmante.porDelegacion && !base.secretario) {
    return {
      ok: false,
      error:
        "Se requiere delegación al Secretario(a) por COI presidencial, pero no hay " +
        "un(a) Secretario(a) titular configurado(a) en el padrón del CEICS.",
    };
  }

  // 5. Asignar número de oficio atómicamente
  // Año en zona México para que el oficio sea consistente con fecha_emision_iso
  // (que también se calcula en TZ México vía hoyIso). Evita que oficios emitidos
  // en la noche del 31-dic salgan con el año siguiente por estar ya en UTC.
  const anio = parseInt(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
    }).format(new Date()),
    10,
  );
  const { data: numeroOficio, error: errOficio } = await admin.rpc(
    "siguiente_numero_oficio",
    { p_anio: anio },
  );
  if (errOficio || !numeroOficio) {
    return {
      ok: false,
      error: `No se pudo asignar número de oficio: ${errOficio?.message ?? "respuesta vacía"}`,
    };
  }
  const numeroOficioStr = numeroOficio as string;
  const consecutivo = numeroOficioStr.split("/").pop() ?? "001";

  // 6. Calcular fechas y folio
  const fechaEmisionIso = hoyIso();
  const fechaEmisionLarga = fechaLarga(fechaEmisionIso);
  const fechaVencimientoIso = sumarMeses(fechaEmisionIso, datos.vigenciaMeses);
  const fechaVencimientoLarga = fechaLarga(fechaVencimientoIso);
  const hashFolio = generarHashFolio({
    numero_oficio: numeroOficioStr,
    clave_protocolo: base.protocolo.clave,
    fecha_emision_iso: fechaEmisionIso,
    nombre_ip: base.ip.nombre_completo,
  });
  const urlValidacion = `${URL_BASE_VALIDACION}${hashFolio}`;

  // 7. Construir DatosActa
  const marcoNormativo = [
    ...MARCO_NORMATIVO_DEFAULT,
    ...(datos.marcoNormativoExtra ?? []),
  ];

  // Tabla "Miembros que participaron en la sesión": además de quienes votaron,
  // incluye a la Secretaria firmante cuando actuó por delegación (COI presidencial).
  // base.miembros solo trae a los votantes; aquí añadimos a la firmante con voto=null
  // para que aparezca en la tabla sin contar en el quórum.
  const miembrosTabla = [...base.miembros];
  if (
    firmante.porDelegacion &&
    base.secretario &&
    !miembrosTabla.some((m) => m.usuario_id === firmante.usuarioId)
  ) {
    miembrosTabla.unshift({
      usuario_id: firmante.usuarioId,
      cargo: firmante.cargo,
      nombre_completo: base.secretario.nombre,
      codigo_udg: base.secretario.codigo_udg,
      voto: null,
      motivo_abstencion: null,
    });
  }
  const datosActa: DatosActa = {
    numero_oficio: numeroOficioStr,
    anio_oficio: anio,
    consecutivo_oficio: consecutivo,
    fecha_emision_iso: fechaEmisionIso,
    fecha_emision_larga: fechaEmisionLarga,
    ip: {
      titulo: base.ip.titulo,
      nombre_completo: base.ip.nombre_completo,
      codigo_udg: base.ip.codigo_udg,
      adscripcion: base.ip.adscripcion,
      correo: base.ip.correo,
    },
    protocolo: {
      clave: base.protocolo.clave,
      titulo: base.protocolo.titulo,
      tipo_investigacion: base.protocolo.tipo_investigacion_nombre,
      clasificacion_riesgo: base.protocolo.clasificacion_riesgo_etiqueta,
      area_conocimiento: base.protocolo.area_conocimiento_nombre,
      fecha_sometimiento: base.protocolo.fecha_sometimiento_iso,
      fecha_sometimiento_larga: fechaLarga(
        base.protocolo.fecha_sometimiento_iso,
      ),
    },
    sesion: {
      tipo: datos.sesionTipo,
      numero: datos.sesionNumero,
      fecha_iso: fechaEmisionIso,
      fecha_larga: fechaEmisionLarga,
    },
    resolucion: {
      estado: datos.resolucion as ResolucionActa,
      tiene_observaciones: datos.observaciones.length > 0,
      observaciones: datos.observaciones,
      vigencia_meses: datos.vigenciaMeses,
      fecha_vencimiento_larga: fechaVencimientoLarga,
    },
    marco_normativo: marcoNormativo,
    votacion: {
      total_miembros: base.conteoVotos.totalMiembros,
      presentes: base.conteoVotos.presentes,
      favor: base.conteoVotos.favor,
      contra: base.conteoVotos.contra,
      abstencion: base.conteoVotos.abstencion,
      miembros: miembrosTabla.map<MiembroActa>((m) => ({
        cargo: m.cargo,
        nombre: m.nombre_completo,
        codigo_udg: m.codigo_udg,
        voto: m.voto,
        motivo_abstencion: m.motivo_abstencion ?? undefined,
      })),
    },
    presidente: {
      titulo: base.presidente.titulo,
      nombre: base.presidente.nombre,
      codigo_udg: base.presidente.codigo_udg,
    },
    firmante: (() => {
      const cargoLineasPresidente = [
        "Presidente del Comité de Ética en Investigación",
        "en Ciencias de la Salud (CEICS)",
        "Centro Universitario de Tlajomulco — Universidad de Guadalajara",
      ];
      const cargoLineasSecretaria = [
        `${firmante.cargo} del Comité de Ética en Investigación`,
        "en Ciencias de la Salud (CEICS)",
        "Centro Universitario de Tlajomulco — Universidad de Guadalajara",
      ];
      if (firmante.rol === "presidente") {
        return {
          titulo: base.presidente.titulo,
          nombre: base.presidente.nombre,
          codigo_udg: base.presidente.codigo_udg,
          rol: "presidente" as const,
          cargo: "Presidente" as const,
          cargo_lineas: cargoLineasPresidente,
          por_delegacion: false,
        };
      }
      const sec = base.secretario!;
      return {
        titulo: sec.titulo,
        nombre: sec.nombre,
        codigo_udg: sec.codigo_udg,
        rol: "comite_secretario" as const,
        cargo: firmante.cargo,
        cargo_lineas: cargoLineasSecretaria,
        por_delegacion: true,
        presidente_titular_nombre: base.presidente.nombre,
      };
    })(),
    folio: {
      hash: hashFolio,
      url_verificacion: urlValidacion,
    },
  };

  // 8. Generar DOCX (obligatorio) y PDF (fail-soft).
  //    pdfkit tiene bugs intermitentes en serverless de Vercel; el flujo no
  //    debe bloquearse si el PDF falla. Migración a pdf-lib pendiente 9c.
  let docxBuffer: Buffer;
  try {
    docxBuffer = await generarActaDocx(datosActa);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando DOCX.";
    return { ok: false, error: `No se pudo generar el DOCX: ${msg}` };
  }
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generarActaPdf(datosActa);
  } catch (e) {
    console.error(
      "[emitirDictamenAction] generarActaPdf fallo (fail-soft):",
      e instanceof Error ? e.message : e,
    );
  }

  // 9. Subir a Storage
  const docxPath = pathActa(datos.protocoloId, numeroOficioStr, "docx");
  const pdfPath = pdfBuffer ? pathActa(datos.protocoloId, numeroOficioStr, "pdf") : null;
  const upDocx = await admin.storage.from(BUCKET).upload(docxPath, docxBuffer, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (upDocx.error) {
    return { ok: false, error: `No se pudo subir el DOCX: ${upDocx.error.message}` };
  }
  if (pdfBuffer && pdfPath) {
    const upPdf = await admin.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upPdf.error) {
      console.error("[emitirDictamenAction] subida PDF fallo (fail-soft):", upPdf.error.message);
      pdfBuffer = null;
    }
  }

  // 10. INSERT en `actas`
  const resolucionDb: "aprobado" | "aprobado_con_observaciones" | "no_aprobado" =
    datos.resolucion === "APROBADO"
      ? "aprobado"
      : datos.resolucion === "NO APROBADO"
        ? "no_aprobado"
        : "aprobado_con_observaciones";

  const { data: insertActa, error: errActa } = await admin
    .from("actas")
    .insert({
      protocolo_id: datos.protocoloId,
      ronda: rondaActual,
      numero_oficio: numeroOficioStr,
      fecha_emision: fechaEmisionIso,
      presidente_id: base.presidente.id,
      firmante_id: firmante.usuarioId,
      firmante_rol: firmante.rol,
      resolucion: resolucionDb,
      vigencia_meses: datos.vigenciaMeses,
      fecha_vencimiento: fechaVencimientoIso,
      votos_favor: base.conteoVotos.favor,
      votos_contra: base.conteoVotos.contra,
      votos_abstencion: base.conteoVotos.abstencion,
      observaciones:
        datos.observaciones.length > 0
          ? datos.observaciones.map((o, i) => `${i + 1}. ${o}`).join("\n")
          : null,
      marco_normativo: marcoNormativo,
      hash_folio: hashFolio,
      url_validacion: urlValidacion,
      docx_storage_path: docxPath,
      pdf_storage_path: pdfPath ?? null,
    })
    .select("id")
    .single();
  if (errActa || !insertActa) {
    // Rollback de Storage
    const aBorrar = [docxPath, ...(pdfPath ? [pdfPath] : [])];
    await admin.storage.from(BUCKET).remove(aBorrar);
    return {
      ok: false,
      error: `No se pudo registrar el acta: ${errActa?.message ?? "error desconocido"}`,
    };
  }

  // 11. UPDATE protocolos al estado final + guardia atómica
  const estadoFinal = estadoProtocoloDesdeResolucion(datos.resolucion);
  const { data: protActualizado, error: errProt } = await admin
    .from("protocolos")
    .update({
      estado: estadoFinal,
      numero_oficio: numeroOficioStr,
      vigencia_dictamen_meses: datos.vigenciaMeses,
      fecha_aprobacion: fechaEmisionIso,
      fecha_vencimiento: fechaVencimientoIso,
      dictaminado_at: new Date().toISOString(),
    })
    .eq("id", datos.protocoloId)
    .eq("estado", "listo_dictamen")
    .select("id")
    .maybeSingle();
  if (errProt) {
    return { ok: false, error: `Acta registrada pero no se pudo actualizar el protocolo: ${errProt.message}` };
  }
  if (!protActualizado) {
    return {
      ok: false,
      error: "El protocolo cambió de estado durante la emisión. Acta registrada pero estado inconsistente.",
    };
  }

  // 12. Registrar evento
  await admin.from("protocolo_eventos").insert({
    protocolo_id: datos.protocoloId,
    tipo: "acta_emitida",
    descripcion: firmante.porDelegacion
      ? `Acta emitida (${numeroOficioStr}) por ${firmante.cargo} en delegación por COI presidencial. Resolución: ${datos.resolucion}.`
      : `Acta emitida (${numeroOficioStr}). Resolución: ${datos.resolucion}.`,
    actor_id: firmante.usuarioId,
    datos: {
      numero_oficio: numeroOficioStr,
      resolucion: datos.resolucion,
      vigencia_meses: datos.vigenciaMeses,
      hash_folio: hashFolio,
      firmante_rol: firmante.rol,
      por_delegacion: firmante.porDelegacion,
    },
  });

  // 13. Email al IP (fail-soft)
  if (base.ip.correo) {
    const docxBase64 = docxBuffer.toString("base64");
    const pdfBase64 = pdfBuffer ? pdfBuffer.toString("base64") : null;
    const consecutivoSlug = numeroOficioStr.replace(/\//g, "-");
    const docxNombre = `Acta-${consecutivoSlug}.docx`;
    const pdfNombre = `Acta-${consecutivoSlug}.pdf`;
    const r = await notificarInvestigador({
      protocoloId: datos.protocoloId,
      claveProtocolo: base.protocolo.clave,
      tituloProtocolo: base.protocolo.titulo,
      ipNombre: base.ip.nombre_completo,
      ipEmail: base.ip.correo,
      resolucion: datos.resolucion,
      numeroOficio: numeroOficioStr,
      vigenciaMeses: datos.vigenciaMeses,
      fechaVencimientoLarga: fechaVencimientoLarga,
      observaciones: datos.observaciones,
      docxBase64,
      pdfBase64,
      docxNombreArchivo: docxNombre,
      pdfNombreArchivo: pdfNombre,
    }).catch((e) => {
      console.error("[emitirDictamenAction] notificarInvestigador error:", e);
      return { ok: false as const, error: "Excepción al notificar al investigador." };
    });
    if (r.ok) {
      await admin
        .from("actas")
        .update({ enviada_a_investigador_at: new Date().toISOString() })
        .eq("id", insertActa.id);
    }
  }

  // 14. revalidatePath
  revalidatePath(`/comite/protocolo/${datos.protocoloId}`);
  revalidatePath(`/protocolo/${datos.protocoloId}`);
  revalidatePath(`/presidencia/dictamen/${datos.protocoloId}`);
  revalidatePath("/presidencia");
  revalidatePath("/presidencia/actas");
  revalidatePath("/comite/bandeja");
  revalidatePath("/dashboard");

  return {
    ok: true,
    data: {
      actaId: insertActa.id,
      numeroOficio: numeroOficioStr,
      docxPath,
      pdfPath: pdfPath ?? "",
    },
  };
}

/**
 * Devuelve URLs firmadas para descargar el DOCX y PDF del acta.
 * El llamador debe verificar previamente que el usuario tiene permiso
 * (IP del protocolo o miembro del comité).
 */
export async function urlsFirmadasActaAction(
  protocoloId: string,
): Promise<
  ActionResult<{ docxUrl: string; pdfUrl: string }>
> {
  const admin = createAdminClient();
  const { data: acta } = await admin
    .from("actas")
    .select("docx_storage_path, pdf_storage_path")
    .eq("protocolo_id", protocoloId)
    .order("ronda", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!acta || !acta.docx_storage_path || !acta.pdf_storage_path) {
    return { ok: false, error: "No hay acta emitida para este protocolo." };
  }
  const [docxResp, pdfResp] = await Promise.all([
    admin.storage.from(BUCKET).createSignedUrl(acta.docx_storage_path, 60 * 10),
    admin.storage.from(BUCKET).createSignedUrl(acta.pdf_storage_path, 60 * 10),
  ]);
  if (docxResp.error || !docxResp.data || pdfResp.error || !pdfResp.data) {
    return {
      ok: false,
      error:
        docxResp.error?.message ?? pdfResp.error?.message ?? "Error generando enlaces.",
    };
  }
  return {
    ok: true,
    data: { docxUrl: docxResp.data.signedUrl, pdfUrl: pdfResp.data.signedUrl },
  };
}
