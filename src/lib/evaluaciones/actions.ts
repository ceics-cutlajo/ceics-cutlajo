"use server";

/**
 * Server Actions del flujo de voto del comité (sesión 8b).
 *
 * Tres acciones públicas:
 *   - registrarEvaluacionAction        (voto pleno, 11 bloques)
 *   - registrarAbstencionCoiAction     (abstención obligatoria si el miembro es el IP)
 *   - forzarCierreAction               (solo Presidente, cierra antes de tiempo)
 *
 * El cierre real (cálculo de ganador + cambio de estado + notificación al
 * Presidente) está en `cerrarYNotificarSiCorresponde`, llamada por las dos
 * primeras cuando todos los elegibles ya votaron, y por la tercera siempre.
 *
 * Patrón de seguridad: igual que `lib/protocolos/actions.ts` — admin client
 * con filtrado por `usuarios.id` en código (ADR-010 pendiente).
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import { CATEGORIAS } from "@/lib/checklist";
import { derivarVotoGlobal } from "./derivar-voto-global";
import {
  calcularResultadoFinal,
  recomendacionDesdeVoto,
} from "./calcular-resultado-final";
import {
  evaluacionInputSchema,
  abstencionCoiInputSchema,
  type EvaluacionInput,
  type AbstencionCoiInput,
} from "./schemas";
import {
  listarMiembrosElegiblesComite,
  obtenerPresidente,
  listarEvaluacionesProtocolo,
} from "./queries";
import { notificarPresidente } from "@/lib/email/notificar-presidente";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const ROLES_COMITE = ["presidente", "comite_vocal", "comite_secretario"];
const ESTADO_EN_VOTACION = "en_revision_comite";

type AdminClient = ReturnType<typeof createAdminClient>;

async function obtenerUsuarioComite(): Promise<
  | { ok: true; usuarioId: string; esPresidente: boolean }
  | { ok: false; error: string }
> {
  const usuario = await obtenerUsuarioActual();
  const tieneRol = usuario.roles.some((r) => ROLES_COMITE.includes(r));
  if (!tieneRol) {
    return { ok: false, error: "No tienes permiso para votar en el comité." };
  }
  const admin = createAdminClient();
  const { data: u } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  if (!u) return { ok: false, error: "No se encontró tu perfil de usuario." };
  return {
    ok: true,
    usuarioId: u.id,
    esPresidente: usuario.roles.includes("presidente"),
  };
}

type ProtocoloEnVotacion = {
  id: string;
  investigador_principal_id: string;
  estado: string;
  clave: string | null;
  titulo: string;
  ronda_actual: number;
};

async function verificarProtocoloVotable(
  admin: AdminClient,
  protocoloId: string,
): Promise<
  { ok: true; protocolo: ProtocoloEnVotacion } | { ok: false; error: string }
> {
  const { data: prot } = await admin
    .from("protocolos")
    .select("id, investigador_principal_id, estado, clave, titulo, ronda_actual")
    .eq("id", protocoloId)
    .single();
  if (!prot) return { ok: false, error: "Protocolo no encontrado." };
  if (prot.estado !== ESTADO_EN_VOTACION) {
    return {
      ok: false,
      error: `El protocolo ya no está abierto para votación (estado actual: ${prot.estado}).`,
    };
  }
  return { ok: true, protocolo: prot as ProtocoloEnVotacion };
}

// ============================================================
// registrarEvaluacionAction
// ============================================================

export async function registrarEvaluacionAction(
  input: EvaluacionInput,
): Promise<ActionResult<{ evaluacionId: string }>> {
  const parsed = evaluacionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos.",
    };
  }
  const { protocoloId, comentarioGlobal, bloques } = parsed.data;

  const user = await obtenerUsuarioComite();
  if (!user.ok) return user;

  const admin = createAdminClient();
  const check = await verificarProtocoloVotable(admin, protocoloId);
  if (!check.ok) return check;

  if (check.protocolo.investigador_principal_id === user.usuarioId) {
    return {
      ok: false,
      error:
        "Eres el Investigador Principal de este protocolo. Debes abstenerte por conflicto de interés.",
    };
  }

  const rondaActual = check.protocolo.ronda_actual ?? 1;
  const { data: yaVoto } = await admin
    .from("evaluaciones")
    .select("id")
    .eq("protocolo_id", protocoloId)
    .eq("miembro_id", user.usuarioId)
    .eq("ronda", rondaActual)
    .maybeSingle();
  if (yaVoto) {
    return { ok: false, error: "Ya emitiste tu voto en esta ronda de revisión." };
  }

  const visto = new Set(bloques.map((b) => b.bloque));
  if (visto.size !== CATEGORIAS.length) {
    return {
      ok: false,
      error:
        "Debes emitir veredicto exactamente sobre los 11 bloques temáticos, sin omitir ni duplicar ninguno.",
    };
  }

  // La evaluación por bloque sugiere un voto, pero el evaluador puede emitir el
  // dictamen final con su propio criterio (libertad del evaluador).
  const votoSugerido = derivarVotoGlobal(bloques);
  const votoGlobal = parsed.data.votoFinal ?? votoSugerido;
  const ajustadoPorEvaluador =
    parsed.data.votoFinal != null && parsed.data.votoFinal !== votoSugerido;

  const { data: cabecera, error: errCab } = await admin
    .from("evaluaciones")
    .insert({
      protocolo_id: protocoloId,
      miembro_id: user.usuarioId,
      voto_global: votoGlobal,
      comentario_global: comentarioGlobal ?? null,
      conflicto_interes: false,
      motivo_abstencion: null,
      ronda: rondaActual,
    })
    .select("id")
    .single();
  if (errCab || !cabecera) {
    return {
      ok: false,
      error: errCab?.message ?? "No se pudo guardar la evaluación.",
    };
  }

  const filasBloques = bloques.map((b) => ({
    evaluacion_id: cabecera.id,
    bloque: b.bloque,
    resultado: b.resultado,
    acordado_con_ia: b.acordado_con_ia,
    comentario: b.comentario ?? null,
  }));
  const { error: errBloques } = await admin
    .from("evaluaciones_bloques")
    .insert(filasBloques);
  if (errBloques) {
    const { error: errRollback } = await admin
      .from("evaluaciones")
      .delete()
      .eq("id", cabecera.id);
    if (errRollback) {
      console.error(
        "[registrarEvaluacionAction] rollback de cabecera falló (fila huérfana):",
        errRollback.message,
      );
    }
    return { ok: false, error: errBloques.message };
  }

  const { error: errEvtVoto } = await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "voto_emitido",
    descripcion: ajustadoPorEvaluador
      ? `Voto emitido por miembro del comité: ${votoGlobal} (ajustado por el evaluador; sugerencia: ${votoSugerido})`
      : `Voto emitido por miembro del comité: ${votoGlobal}`,
    actor_id: user.usuarioId,
    datos: {
      voto_global: votoGlobal,
      voto_sugerido: votoSugerido,
      ajustado_por_evaluador: ajustadoPorEvaluador,
    },
  });
  if (errEvtVoto) {
    console.error("[bitácora] voto_emitido:", errEvtVoto.message);
  }

  await cerrarYNotificarSiCorresponde(protocoloId, admin, false);

  revalidatePath(`/comite/protocolo/${protocoloId}`);
  revalidatePath("/comite/bandeja");
  return { ok: true, data: { evaluacionId: cabecera.id } };
}

// ============================================================
// registrarAbstencionCoiAction
// ============================================================

export async function registrarAbstencionCoiAction(
  input: AbstencionCoiInput,
): Promise<ActionResult<{ evaluacionId: string }>> {
  const parsed = abstencionCoiInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos.",
    };
  }
  const { protocoloId, motivo } = parsed.data;

  const user = await obtenerUsuarioComite();
  if (!user.ok) return user;

  const admin = createAdminClient();
  const check = await verificarProtocoloVotable(admin, protocoloId);
  if (!check.ok) return check;

  if (check.protocolo.investigador_principal_id !== user.usuarioId) {
    return {
      ok: false,
      error:
        "Esta acción es solo para abstención por COI; tú no eres el IP de este protocolo.",
    };
  }

  const rondaActual = check.protocolo.ronda_actual ?? 1;
  const { data: yaVoto } = await admin
    .from("evaluaciones")
    .select("id")
    .eq("protocolo_id", protocoloId)
    .eq("miembro_id", user.usuarioId)
    .eq("ronda", rondaActual)
    .maybeSingle();
  if (yaVoto) {
    return {
      ok: false,
      error: "Ya registraste tu abstención en esta ronda de revisión.",
    };
  }

  const { data: cabecera, error } = await admin
    .from("evaluaciones")
    .insert({
      protocolo_id: protocoloId,
      miembro_id: user.usuarioId,
      voto_global: "abstener",
      comentario_global: null,
      conflicto_interes: true,
      motivo_abstencion:
        motivo ?? "Investigador Principal del protocolo — abstención obligatoria.",
      ronda: rondaActual,
    })
    .select("id")
    .single();
  if (error || !cabecera) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo registrar la abstención.",
    };
  }

  const { error: errEvtAbst } = await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: "voto_abstencion_coi",
    descripcion: "Abstención obligatoria por conflicto de interés (IP del protocolo).",
    actor_id: user.usuarioId,
  });
  if (errEvtAbst) {
    console.error("[bitácora] voto_abstencion_coi:", errEvtAbst.message);
  }

  await cerrarYNotificarSiCorresponde(protocoloId, admin, false);

  revalidatePath(`/comite/protocolo/${protocoloId}`);
  revalidatePath("/comite/bandeja");
  return { ok: true, data: { evaluacionId: cabecera.id } };
}

// ============================================================
// forzarCierreAction
// ============================================================

export async function forzarCierreAction(
  protocoloId: string,
): Promise<ActionResult<{ ganador: string; estadoNuevo: string }>> {
  const user = await obtenerUsuarioComite();
  if (!user.ok) return user;
  if (!user.esPresidente) {
    return {
      ok: false,
      error: "Solo el Presidente del CEICS puede forzar el cierre de la votación.",
    };
  }

  const admin = createAdminClient();
  const check = await verificarProtocoloVotable(admin, protocoloId);
  if (!check.ok) return check;

  const evals = await listarEvaluacionesProtocolo(
    protocoloId,
    check.protocolo.ronda_actual ?? 1,
  );
  const decisivos = evals.filter((e) => e.voto_global !== "abstener");
  if (decisivos.length === 0) {
    return {
      ok: false,
      error: "No hay votos decisivos emitidos todavía para forzar el cierre.",
    };
  }

  const res = await cerrarYNotificarSiCorresponde(protocoloId, admin, true);
  if (res.ok) {
    revalidatePath(`/comite/protocolo/${protocoloId}`);
    revalidatePath("/comite/bandeja");
    revalidatePath("/presidencia");
  }
  return res;
}

// ============================================================
// cerrarYNotificarSiCorresponde (interno)
// ============================================================

async function cerrarYNotificarSiCorresponde(
  protocoloId: string,
  admin: AdminClient,
  forzado: boolean,
): Promise<ActionResult<{ ganador: string; estadoNuevo: string }>> {
  const { data: prot } = await admin
    .from("protocolos")
    .select(
      "estado, clave, titulo, investigador_principal_id, notificacion_presidente_at, ronda_actual",
    )
    .eq("id", protocoloId)
    .single();
  if (!prot) return { ok: false, error: "Protocolo no encontrado." };
  if (prot.estado !== ESTADO_EN_VOTACION) {
    return {
      ok: true,
      data: { ganador: "(ya cerrado)", estadoNuevo: prot.estado as string },
    };
  }

  const rondaActual = (prot.ronda_actual as number | null) ?? 1;
  const miembros = await listarMiembrosElegiblesComite();
  const evals = await listarEvaluacionesProtocolo(protocoloId, rondaActual);
  if (!forzado && evals.length < miembros.length) {
    return {
      ok: true,
      data: { ganador: "(pendiente)", estadoNuevo: prot.estado as string },
    };
  }

  const presidente = await obtenerPresidente();
  if (!presidente) {
    return {
      ok: false,
      error: "No hay Presidente designado en el sistema; no se puede cerrar el voto.",
    };
  }

  const resultado = calcularResultadoFinal(evals, presidente.id);

  if (resultado.sin_votos_decisivos) {
    // Todos los miembros que votaron lo hicieron como abstención (COI u otro).
    // No hay base para cerrar automáticamente: el protocolo permanece en
    // revisión y requerirá ampliación del padrón (más miembros con cuenta)
    // o intervención manual del comité.
    return {
      ok: true,
      data: { ganador: "(sin decisivos)", estadoNuevo: prot.estado as string },
    };
  }

  const recomendacion = recomendacionDesdeVoto(resultado.ganador);
  const estadoNuevo = "listo_dictamen";

  // UPDATE atómico con guardia: solo si sigue en votación
  const { data: actualizado, error: errUpd } = await admin
    .from("protocolos")
    .update({ estado: estadoNuevo, recomendacion_comite: recomendacion })
    .eq("id", protocoloId)
    .eq("estado", ESTADO_EN_VOTACION)
    .select("id")
    .maybeSingle();
  if (errUpd) {
    return { ok: false, error: errUpd.message };
  }
  if (!actualizado) {
    return { ok: true, data: { ganador: resultado.ganador, estadoNuevo } };
  }

  const { error: errEvtCierre } = await admin.from("protocolo_eventos").insert({
    protocolo_id: protocoloId,
    tipo: forzado ? "comite_cierre_forzado" : "comite_cierre_automatico",
    descripcion: `Comité cerró votación. Recomendación: ${recomendacion}. Listo para dictamen del Presidente.`,
    actor_id: forzado ? presidente.id : null,
    datos: {
      recomendacion,
      conteo: resultado.conteo,
      voto_calidad_aplicado: resultado.voto_calidad_aplicado,
      desempate_no_resuelto: resultado.desempate_no_resuelto ?? false,
      forzado,
    },
  });
  if (errEvtCierre) {
    console.error("[bitácora] cierre de votación:", errEvtCierre.message);
  }

  if (!prot.notificacion_presidente_at) {
    const { data: marcado } = await admin
      .from("protocolos")
      .update({ notificacion_presidente_at: new Date().toISOString() })
      .eq("id", protocoloId)
      .is("notificacion_presidente_at", null)
      .select("id")
      .maybeSingle();

    if (marcado) {
      const resumenVoto =
        `Votos: ${resultado.conteo.aprobar} aprobar, ` +
        `${resultado.conteo.aprobar_con_observaciones} con observaciones, ` +
        `${resultado.conteo.no_aprobar} no aprobar, ` +
        `${resultado.conteo.abstener} abstener.` +
        (resultado.voto_calidad_aplicado
          ? " Voto de calidad presidencial aplicado."
          : "") +
        (resultado.desempate_no_resuelto
          ? " ⚠ Empate sin desempate resuelto por Presidente: se eligió fallback conservador."
          : "");

      const { data: ipRow } = await admin
        .from("usuarios")
        .select("nombre, apellido_paterno, apellido_materno")
        .eq("id", prot.investigador_principal_id)
        .maybeSingle();
      const ipNombre = ipRow
        ? `${ipRow.nombre} ${ipRow.apellido_paterno}${
            ipRow.apellido_materno ? " " + ipRow.apellido_materno : ""
          }`
        : "(IP no encontrado)";

      const rNotif = await notificarPresidente({
        protocoloId,
        claveProtocolo: prot.clave ?? "(sin clave)",
        tituloProtocolo: prot.titulo,
        ipNombre,
        resumenVoto,
        ganador: resultado.ganador,
        emailPresidente: presidente.email,
      }).catch((e) => {
        console.error("[notificarPresidente] excepción:", e);
        return { ok: false as const, error: "Excepción al notificar al Presidente." };
      });
      if (!rNotif.ok) {
        console.error("[cerrarYNotificar] notificarPresidente falló:", rNotif.error);
        // Revertir el flag: el sistema NO debe creer que el Presidente fue
        // notificado, y un reintento posterior podrá volver a enviar.
        await admin
          .from("protocolos")
          .update({ notificacion_presidente_at: null })
          .eq("id", protocoloId);
        const { error: errEvtNotif } = await admin.from("protocolo_eventos").insert({
          protocolo_id: protocoloId,
          tipo: "notificacion_fallida",
          descripcion:
            "No se pudo enviar por correo el aviso al Presidente de que el protocolo está listo para dictamen.",
          datos: { destino: "presidente", error: rNotif.error },
        });
        if (errEvtNotif) {
          console.error("[bitácora] notificacion_fallida:", errEvtNotif.message);
        }
      }
    }
  }

  return { ok: true, data: { ganador: resultado.ganador, estadoNuevo } };
}
