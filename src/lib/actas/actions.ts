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
import { obtenerDatosBaseActa, obtenerActaRondaPrevia } from "./queries";
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

/** Resolución guardada en BD → estado final del protocolo (espejo de
 * estadoProtocoloDesdeResolucion, que trabaja con las etiquetas de UI). */
const ESTADO_DESDE_RESOLUCION_DB: Record<
  "aprobado" | "aprobado_con_observaciones" | "condicionado" | "no_aprobado",
  "aprobado" | "aprobado_con_observaciones" | "observaciones" | "rechazado"
> = {
  aprobado: "aprobado",
  aprobado_con_observaciones: "aprobado_con_observaciones",
  condicionado: "observaciones",
  no_aprobado: "rechazado",
};

/** Resolución guardada en BD → etiqueta de UI (para reenvíos de correo). */
const RESOLUCION_UI_DESDE_DB: Record<
  "aprobado" | "aprobado_con_observaciones" | "condicionado" | "no_aprobado",
  "APROBADO" | "APROBADO CON OBSERVACIONES MENORES" | "CONDICIONADO A MODIFICACIONES MAYORES" | "NO APROBADO"
> = {
  aprobado: "APROBADO",
  aprobado_con_observaciones: "APROBADO CON OBSERVACIONES MENORES",
  condicionado: "CONDICIONADO A MODIFICACIONES MAYORES",
  no_aprobado: "NO APROBADO",
};

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
    /** Mensaje no bloqueante para el firmante (p. ej. PDF o correo fallidos). */
    advertencia?: string;
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
    .select(
      "id, numero_oficio, docx_storage_path, pdf_storage_path, resolucion, vigencia_meses, fecha_emision, fecha_vencimiento",
    )
    .eq("protocolo_id", datos.protocoloId)
    .eq("ronda", rondaActual)
    .maybeSingle();
  if (actaExistente) {
    // Auto-rescate: si el acta existe pero el protocolo sigue en
    // listo_dictamen, una emisión previa falló justo en el UPDATE final y el
    // expediente quedó inconsistente (acta oficial sin estado final). Se
    // re-aplica aquí el cambio de estado con los datos del acta existente.
    let advertencia: string | undefined;
    if (base.protocolo.estado === "listo_dictamen") {
      const resDb = actaExistente.resolucion as keyof typeof ESTADO_DESDE_RESOLUCION_DB;
      const { error: errRescate } = await admin
        .from("protocolos")
        .update({
          estado: ESTADO_DESDE_RESOLUCION_DB[resDb],
          numero_oficio: actaExistente.numero_oficio,
          vigencia_dictamen_meses: actaExistente.vigencia_meses,
          fecha_aprobacion: actaExistente.fecha_emision,
          fecha_vencimiento: actaExistente.fecha_vencimiento,
          dictaminado_at: new Date().toISOString(),
        })
        .eq("id", datos.protocoloId)
        .eq("estado", "listo_dictamen");
      if (errRescate) {
        advertencia = `El acta ya existía, pero el protocolo sigue sin estado final y no se pudo reparar: ${errRescate.message}`;
        console.error("[emitirDictamenAction] auto-rescate falló:", errRescate.message);
      } else {
        advertencia =
          "El acta ya existía de un intento previo; el estado del protocolo había quedado inconsistente y se reparó automáticamente.";
        revalidatePath(`/comite/protocolo/${datos.protocoloId}`);
        revalidatePath(`/protocolo/${datos.protocoloId}`);
        revalidatePath("/presidencia");
        revalidatePath("/comite/bandeja");
      }
    }
    return {
      ok: true,
      data: {
        actaId: actaExistente.id,
        numeroOficio: actaExistente.numero_oficio,
        docxPath: actaExistente.docx_storage_path ?? "",
        pdfPath: actaExistente.pdf_storage_path ?? "",
        advertencia,
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
  // Nota de re-evaluación: si esta es una ronda > 1 (ciclo de correcciones
  // mayores), citamos el acta de la ronda previa y dejamos constancia de que el
  // IP incorporó las correcciones. La clave del protocolo se conserva.
  let reevaluacion: DatosActa["reevaluacion"];
  if (rondaActual > 1) {
    const previa = await obtenerActaRondaPrevia(datos.protocoloId, rondaActual);
    if (previa) {
      reevaluacion = {
        oficio_previo: previa.numero_oficio,
        resolucion_previa: RESOLUCION_UI_DESDE_DB[previa.resolucion],
        fecha_previa_larga: fechaLarga(previa.fecha_emision),
        ronda: rondaActual,
      };
    }
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
    reevaluacion,
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
  let pdfPath = pdfBuffer ? pathActa(datos.protocoloId, numeroOficioStr, "pdf") : null;
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
      // También la ruta: si quedara, el acta apuntaría a un PDF inexistente.
      pdfPath = null;
    }
  }

  // 10. INSERT en `actas`
  const resolucionDb:
    | "aprobado"
    | "aprobado_con_observaciones"
    | "condicionado"
    | "no_aprobado" =
    datos.resolucion === "APROBADO"
      ? "aprobado"
      : datos.resolucion === "NO APROBADO"
        ? "no_aprobado"
        : datos.resolucion === "CONDICIONADO A MODIFICACIONES MAYORES"
          ? "condicionado"
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
  const { error: errEvtActa } = await admin.from("protocolo_eventos").insert({
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
  if (errEvtActa) {
    console.error("[emitirDictamenAction] bitácora acta_emitida:", errEvtActa.message);
  }

  // 13. Email al IP (fail-soft, pero el fallo se hace visible al firmante
  // vía `advertencia` y queda en la bitácora para poder reenviar).
  let correoFallo: string | null = null;
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
    } else {
      correoFallo = r.error;
      const { error: errEvtCorreo } = await admin.from("protocolo_eventos").insert({
        protocolo_id: datos.protocoloId,
        tipo: "notificacion_fallida",
        descripcion: "No se pudo enviar por correo el acta al investigador.",
        datos: { destino: "investigador", error: r.error, acta_id: insertActa.id },
      });
      if (errEvtCorreo) {
        console.error("[emitirDictamenAction] bitácora notificacion_fallida:", errEvtCorreo.message);
      }
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

  const advertencias: string[] = [];
  if (!pdfPath) {
    advertencias.push(
      "El acta quedó emitida solo con DOCX: la versión PDF falló al generarse o subirse.",
    );
  }
  if (correoFallo) {
    advertencias.push(
      "El correo con el acta al investigador NO se envió; puedes reenviarlo desde la tarjeta del acta en la página del protocolo.",
    );
  }

  return {
    ok: true,
    data: {
      actaId: insertActa.id,
      numeroOficio: numeroOficioStr,
      docxPath,
      pdfPath: pdfPath ?? "",
      advertencia: advertencias.length > 0 ? advertencias.join(" ") : undefined,
    },
  };
}

// ============================================================
// reenviarActaInvestigadorAction
// ============================================================

/**
 * Reenvía por correo al IP un acta ya emitida cuyo envío original falló
 * (enviada_a_investigador_at en null). Descarga los adjuntos de Storage y
 * reutiliza la plantilla de notificación; al lograrlo marca el timestamp.
 * Solo Presidente o Secretario(a).
 */
export async function reenviarActaInvestigadorAction(
  actaId: string,
): Promise<ActionResult> {
  const usuario = await obtenerUsuarioActual();
  const autorizado =
    usuario.roles.includes("presidente") ||
    usuario.roles.includes("comite_secretario");
  if (!autorizado) {
    return {
      ok: false,
      error: "Solo el Presidente o el(la) Secretario(a) pueden reenviar el acta.",
    };
  }

  const admin = createAdminClient();
  const { data: acta } = await admin
    .from("actas")
    .select(
      "id, protocolo_id, numero_oficio, resolucion, vigencia_meses, fecha_vencimiento, observaciones, docx_storage_path, pdf_storage_path",
    )
    .eq("id", actaId)
    .maybeSingle();
  if (!acta) return { ok: false, error: "No se encontró el acta." };

  const { data: prot } = await admin
    .from("protocolos")
    .select("id, clave, titulo, investigador_principal_id")
    .eq("id", acta.protocolo_id)
    .maybeSingle();
  if (!prot) return { ok: false, error: "No se encontró el protocolo del acta." };

  const { data: ip } = await admin
    .from("usuarios")
    .select("nombre, apellido_paterno, apellido_materno, email")
    .eq("id", prot.investigador_principal_id)
    .maybeSingle();
  if (!ip?.email) {
    return { ok: false, error: "El investigador no tiene correo registrado." };
  }
  const ipNombre = `${ip.nombre} ${ip.apellido_paterno}${
    ip.apellido_materno ? " " + ip.apellido_materno : ""
  }`.trim();

  // Adjuntos desde Storage (el DOCX es obligatorio; el PDF puede no existir).
  if (!acta.docx_storage_path) {
    return { ok: false, error: "El acta no tiene DOCX en el almacén; no se puede reenviar." };
  }
  const docxDl = await admin.storage.from(BUCKET).download(acta.docx_storage_path);
  if (docxDl.error || !docxDl.data) {
    return {
      ok: false,
      error: `No se pudo descargar el DOCX del acta: ${docxDl.error?.message ?? "vacío"}`,
    };
  }
  const docxBase64 = Buffer.from(await docxDl.data.arrayBuffer()).toString("base64");
  let pdfBase64: string | null = null;
  if (acta.pdf_storage_path) {
    const pdfDl = await admin.storage.from(BUCKET).download(acta.pdf_storage_path);
    if (!pdfDl.error && pdfDl.data) {
      pdfBase64 = Buffer.from(await pdfDl.data.arrayBuffer()).toString("base64");
    }
  }

  const resDb = acta.resolucion as keyof typeof RESOLUCION_UI_DESDE_DB;
  const observaciones = (acta.observaciones ?? "")
    .split("\n")
    .map((o: string) => o.replace(/^\d+\.\s*/, "").trim())
    .filter((o: string) => o.length > 0);
  const consecutivoSlug = acta.numero_oficio.replace(/\//g, "-");

  const r = await notificarInvestigador({
    protocoloId: prot.id,
    claveProtocolo: prot.clave,
    tituloProtocolo: prot.titulo,
    ipNombre,
    ipEmail: ip.email,
    resolucion: RESOLUCION_UI_DESDE_DB[resDb],
    numeroOficio: acta.numero_oficio,
    vigenciaMeses: acta.vigencia_meses,
    fechaVencimientoLarga: acta.fecha_vencimiento ? fechaLarga(acta.fecha_vencimiento) : "",
    observaciones,
    docxBase64,
    pdfBase64,
    docxNombreArchivo: `Acta-${consecutivoSlug}.docx`,
    pdfNombreArchivo: `Acta-${consecutivoSlug}.pdf`,
  }).catch((e) => {
    console.error("[reenviarActaInvestigadorAction] excepción:", e);
    return { ok: false as const, error: "Excepción al reenviar el correo." };
  });

  if (!r.ok) {
    return { ok: false, error: `El reenvío falló: ${r.error}` };
  }

  await admin
    .from("actas")
    .update({ enviada_a_investigador_at: new Date().toISOString() })
    .eq("id", acta.id);
  const { error: errEvt } = await admin.from("protocolo_eventos").insert({
    protocolo_id: prot.id,
    tipo: "acta_reenviada",
    descripcion: `Acta ${acta.numero_oficio} reenviada por correo al investigador.`,
    datos: { acta_id: acta.id },
  });
  if (errEvt) {
    console.error("[reenviarActaInvestigadorAction] bitácora:", errEvt.message);
  }

  revalidatePath(`/comite/protocolo/${prot.id}`);
  revalidatePath(`/protocolo/${prot.id}`);
  return { ok: true };
}

// ============================================================
// ratificarCorreccionesMenoresAction
// ============================================================

/**
 * Ratifica el cumplimiento de OBSERVACIONES MENORES sin nueva votación del
 * comité. El protocolo debe estar en estado 'correcciones_menores' (el IP ya
 * envió sus correcciones y la ronda se incrementó a N+1). Emite el acta final
 * 'APROBADO' citando el oficio previo (acta de la ronda N, que dictaminó
 * "aprobado con observaciones menores"), reutilizando los votos de esa ronda.
 * Solo Presidente o Secretario(a) por delegación (mismo COI que el dictamen).
 */
export async function ratificarCorreccionesMenoresAction(
  protocoloId: string,
): Promise<ActionResult<{ actaId: string; numeroOficio: string; advertencia?: string }>> {
  const admin = createAdminClient();

  const { data: protRow } = await admin
    .from("protocolos")
    .select("estado, ronda_actual")
    .eq("id", protocoloId)
    .maybeSingle();
  if (!protRow) return { ok: false, error: "Protocolo no encontrado." };
  if (protRow.estado !== "correcciones_menores") {
    return {
      ok: false,
      error: `Este protocolo no está en correcciones menores (estado: ${protRow.estado}).`,
    };
  }
  const rondaActa = (protRow.ronda_actual as number | null) ?? 1;
  const rondaVotos = Math.max(1, rondaActa - 1);

  const base = await obtenerDatosBaseActa(protocoloId, rondaVotos);
  if (!base) {
    return { ok: false, error: "No se encontró el protocolo o sus datos están incompletos." };
  }

  // Firmante (Presidente, o Secretaria por delegación si el Presidente es IP).
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
        "Se requiere delegación al Secretario(a) por COI presidencial, pero no hay un(a) Secretario(a) titular configurado(a).",
    };
  }

  // Idempotencia por ronda: si ya existe acta para la ronda de ratificación,
  // re-aplicamos el estado final si quedó inconsistente y la devolvemos.
  const { data: actaExistente } = await admin
    .from("actas")
    .select("id, numero_oficio")
    .eq("protocolo_id", protocoloId)
    .eq("ronda", rondaActa)
    .maybeSingle();
  if (actaExistente) {
    await admin
      .from("protocolos")
      .update({ estado: "aprobado", dictaminado_at: new Date().toISOString() })
      .eq("id", protocoloId)
      .eq("estado", "correcciones_menores");
    return {
      ok: true,
      data: { actaId: actaExistente.id, numeroOficio: actaExistente.numero_oficio },
    };
  }

  // Acta previa (la de observaciones menores) → nota de re-evaluación + vigencia.
  const previa = await obtenerActaRondaPrevia(protocoloId, rondaActa);

  // Número de oficio nuevo (consecutivo del año).
  const anio = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric" }).format(
      new Date(),
    ),
    10,
  );
  const { data: numeroOficio, error: errOficio } = await admin.rpc("siguiente_numero_oficio", {
    p_anio: anio,
  });
  if (errOficio || !numeroOficio) {
    return {
      ok: false,
      error: `No se pudo asignar número de oficio: ${errOficio?.message ?? "respuesta vacía"}`,
    };
  }
  const numeroOficioStr = numeroOficio as string;
  const consecutivo = numeroOficioStr.split("/").pop() ?? "001";

  const fechaEmisionIso = hoyIso();
  const fechaEmisionLarga = fechaLarga(fechaEmisionIso);
  const vigenciaMeses = ([6, 12, 24].includes(previa?.vigencia_meses ?? 12)
    ? (previa?.vigencia_meses ?? 12)
    : 12) as 6 | 12 | 24;
  const fechaVencimientoIso = sumarMeses(fechaEmisionIso, vigenciaMeses);
  const fechaVencimientoLarga = fechaLarga(fechaVencimientoIso);
  const hashFolio = generarHashFolio({
    numero_oficio: numeroOficioStr,
    clave_protocolo: base.protocolo.clave,
    fecha_emision_iso: fechaEmisionIso,
    nombre_ip: base.ip.nombre_completo,
  });
  const urlValidacion = `${URL_BASE_VALIDACION}${hashFolio}`;

  const reevaluacion: DatosActa["reevaluacion"] = previa
    ? {
        oficio_previo: previa.numero_oficio,
        resolucion_previa: RESOLUCION_UI_DESDE_DB[previa.resolucion],
        fecha_previa_larga: fechaLarga(previa.fecha_emision),
        ronda: rondaActa,
      }
    : undefined;

  // Tabla de miembros: votos de la ronda previa; si firma la Secretaria por
  // delegación, se añade con voto=null (igual que en emitirDictamenAction).
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
      fecha_sometimiento_larga: fechaLarga(base.protocolo.fecha_sometimiento_iso),
    },
    sesion: {
      tipo: "ordinaria",
      numero: 1,
      fecha_iso: fechaEmisionIso,
      fecha_larga: fechaEmisionLarga,
    },
    resolucion: {
      estado: "APROBADO",
      tiene_observaciones: false,
      observaciones: [],
      vigencia_meses: vigenciaMeses,
      fecha_vencimiento_larga: fechaVencimientoLarga,
    },
    reevaluacion,
    marco_normativo: [...MARCO_NORMATIVO_DEFAULT],
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
    firmante:
      firmante.rol === "presidente"
        ? {
            titulo: base.presidente.titulo,
            nombre: base.presidente.nombre,
            codigo_udg: base.presidente.codigo_udg,
            rol: "presidente",
            cargo: "Presidente",
            cargo_lineas: cargoLineasPresidente,
            por_delegacion: false,
          }
        : {
            titulo: base.secretario!.titulo,
            nombre: base.secretario!.nombre,
            codigo_udg: base.secretario!.codigo_udg,
            rol: "comite_secretario",
            cargo: firmante.cargo,
            cargo_lineas: cargoLineasSecretaria,
            por_delegacion: true,
            presidente_titular_nombre: base.presidente.nombre,
          },
    folio: { hash: hashFolio, url_verificacion: urlValidacion },
  };

  // Generar DOCX (obligatorio) + PDF (fail-soft).
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
      "[ratificarCorreccionesMenoresAction] generarActaPdf fallo (fail-soft):",
      e instanceof Error ? e.message : e,
    );
  }

  const docxPath = pathActa(protocoloId, numeroOficioStr, "docx");
  let pdfPath = pdfBuffer ? pathActa(protocoloId, numeroOficioStr, "pdf") : null;
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
      console.error("[ratificarCorreccionesMenoresAction] subida PDF fallo:", upPdf.error.message);
      pdfBuffer = null;
      pdfPath = null;
    }
  }

  const { data: insertActa, error: errActa } = await admin
    .from("actas")
    .insert({
      protocolo_id: protocoloId,
      ronda: rondaActa,
      numero_oficio: numeroOficioStr,
      fecha_emision: fechaEmisionIso,
      presidente_id: base.presidente.id,
      firmante_id: firmante.usuarioId,
      firmante_rol: firmante.rol,
      resolucion: "aprobado",
      vigencia_meses: vigenciaMeses,
      fecha_vencimiento: fechaVencimientoIso,
      votos_favor: base.conteoVotos.favor,
      votos_contra: base.conteoVotos.contra,
      votos_abstencion: base.conteoVotos.abstencion,
      observaciones: null,
      marco_normativo: [...MARCO_NORMATIVO_DEFAULT],
      hash_folio: hashFolio,
      url_validacion: urlValidacion,
      docx_storage_path: docxPath,
      pdf_storage_path: pdfPath ?? null,
    })
    .select("id")
    .single();
  if (errActa || !insertActa) {
    await admin.storage.from(BUCKET).remove([docxPath, ...(pdfPath ? [pdfPath] : [])]);
    return {
      ok: false,
      error: `No se pudo registrar el acta: ${errActa?.message ?? "error desconocido"}`,
    };
  }

  const { data: protActualizado, error: errProt } = await admin
    .from("protocolos")
    .update({
      estado: "aprobado",
      numero_oficio: numeroOficioStr,
      vigencia_dictamen_meses: vigenciaMeses,
      fecha_aprobacion: fechaEmisionIso,
      fecha_vencimiento: fechaVencimientoIso,
      dictaminado_at: new Date().toISOString(),
    })
    .eq("id", protocoloId)
    .eq("estado", "correcciones_menores")
    .select("id")
    .maybeSingle();
  if (errProt) {
    return { ok: false, error: `Acta registrada pero no se pudo actualizar el protocolo: ${errProt.message}` };
  }
  if (!protActualizado) {
    return {
      ok: false,
      error: "El protocolo cambió de estado durante la ratificación. Acta registrada pero estado inconsistente.",
    };
  }

  await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "acta_emitida",
    descripcion: firmante.porDelegacion
      ? `Acta de ratificación emitida (${numeroOficioStr}) por ${firmante.cargo} en delegación por COI presidencial — observaciones menores atendidas. Resolución: APROBADO.`
      : `Acta de ratificación emitida (${numeroOficioStr}) — observaciones menores atendidas. Resolución: APROBADO.`,
    actor_id: firmante.usuarioId,
    datos: {
      numero_oficio: numeroOficioStr,
      resolucion: "APROBADO",
      ratificacion_menores: true,
      oficio_previo: previa?.numero_oficio ?? null,
      firmante_rol: firmante.rol,
      por_delegacion: firmante.porDelegacion,
    },
  });

  // Email al IP con el acta final (fail-soft).
  let correoFallo: string | null = null;
  if (base.ip.correo) {
    const docxBase64 = docxBuffer.toString("base64");
    const pdfBase64 = pdfBuffer ? pdfBuffer.toString("base64") : null;
    const consecutivoSlug = numeroOficioStr.replace(/\//g, "-");
    const r = await notificarInvestigador({
      protocoloId,
      claveProtocolo: base.protocolo.clave,
      tituloProtocolo: base.protocolo.titulo,
      ipNombre: base.ip.nombre_completo,
      ipEmail: base.ip.correo,
      resolucion: "APROBADO",
      numeroOficio: numeroOficioStr,
      vigenciaMeses,
      fechaVencimientoLarga,
      observaciones: [],
      docxBase64,
      pdfBase64,
      docxNombreArchivo: `Acta-${consecutivoSlug}.docx`,
      pdfNombreArchivo: `Acta-${consecutivoSlug}.pdf`,
    }).catch((e) => {
      console.error("[ratificarCorreccionesMenoresAction] notificarInvestigador error:", e);
      return { ok: false as const, error: "Excepción al notificar al investigador." };
    });
    if (r.ok) {
      await admin
        .from("actas")
        .update({ enviada_a_investigador_at: new Date().toISOString() })
        .eq("id", insertActa.id);
    } else {
      correoFallo = r.error;
      await admin.from("protocolo_eventos").insert({
        protocolo_id: protocoloId,
        tipo: "notificacion_fallida",
        descripcion: "No se pudo enviar por correo el acta de ratificación al investigador.",
        datos: { destino: "investigador", error: r.error, acta_id: insertActa.id },
      });
    }
  }

  revalidatePath(`/comite/protocolo/${protocoloId}`);
  revalidatePath(`/protocolo/${protocoloId}`);
  revalidatePath(`/presidencia/dictamen/${protocoloId}`);
  revalidatePath("/presidencia");
  revalidatePath("/presidencia/actas");
  revalidatePath("/comite/bandeja");
  revalidatePath("/dashboard");

  const advertencias: string[] = [];
  if (!pdfPath) advertencias.push("El acta quedó solo con DOCX: la versión PDF falló.");
  if (correoFallo)
    advertencias.push(
      "El correo con el acta al investigador NO se envió; puedes reenviarlo desde la tarjeta del acta.",
    );

  return {
    ok: true,
    data: {
      actaId: insertActa.id,
      numeroOficio: numeroOficioStr,
      advertencia: advertencias.length > 0 ? advertencias.join(" ") : undefined,
    },
  };
}
