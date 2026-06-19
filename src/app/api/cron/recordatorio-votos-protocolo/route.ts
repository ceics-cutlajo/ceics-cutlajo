/**
 * Cron diario de recordatorios de voto pendiente del CEICS.
 *
 * Lo dispara Vercel Cron (ver vercel.json) una vez al día a las 10:00 hora de
 * Jalisco (16:00 UTC). Recorre los protocolos en revisión del comité
 * ('en_revision_comite') y, al alcanzar el día 10 o el día 14 naturales desde
 * su sometimiento (umbral ">=", no exacto, para no perder un recordatorio si el
 * cron se salta un día; convención del semáforo: `diaDesdeSometimiento`), envía
 * un recordatorio SOLO a los miembros del comité que aún no han registrado su
 * voto en la ronda en curso, excluyendo a quienes están en conflicto de interés
 * (el propio IP o algún co-investigador).
 *
 * Idempotencia: se inserta un evento `recordatorio_dia{10|14}_ronda{N}` en
 * `protocolo_eventos`; si ya existe para ese día y esa ronda, no se reenvía.
 * El reloj se reinicia por ronda porque `submitted_at` se sobrescribe en cada
 * reenvío, así que el conteo siempre parte del último envío.
 *
 * Seguridad: si `CRON_SECRET` está configurada, Vercel la envía como
 * `Authorization: Bearer <CRON_SECRET>`; aquí se valida (401 si no coincide).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listarMiembrosElegiblesComite,
  listarEvaluacionesProtocolo,
  obtenerRondaActual,
} from "@/lib/evaluaciones/queries";
import { notificarVotoPendiente } from "@/lib/email/notificar-voto-pendiente";
import { notificarFalloLoteCorreos } from "@/lib/email/notificar-fallo-lote";
import {
  enviarConReintento,
  pausa,
  PAUSA_ENTRE_CORREOS_MS,
} from "@/lib/email/throttle";
import { diaDesdeSometimiento } from "@/lib/protocolos/semaforo";
import { hoyEnJalisco } from "@/lib/calendario/formato";

export const dynamic = "force-dynamic";
// Envío en fila (throttle de Resend): varios protocolos × varios miembros
// pueden acercarse al minuto; margen amplio en Vercel Pro.
export const maxDuration = 120;

type Resultado = {
  ok: boolean;
  hoy: string;
  dia10: number;
  dia14: number;
  errores: string[];
};

type ProtocoloRow = {
  id: string;
  clave: string | null;
  titulo: string;
  submitted_at: string | null;
  ronda_actual: number | null;
  investigador_principal_id: string;
};

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const hoy = hoyEnJalisco();
  const errores: string[] = [];
  const admin = createAdminClient();

  // Protocolos en revisión del comité con fecha de sometimiento.
  const { data, error } = await admin
    .from("protocolos")
    .select(
      "id, clave, titulo, submitted_at, ronda_actual, investigador_principal_id",
    )
    .eq("estado", "en_revision_comite")
    .not("submitted_at", "is", null);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudieron leer los protocolos." },
      { status: 500 },
    );
  }

  const protocolos = (data ?? []) as ProtocoloRow[];

  let dia10 = 0;
  let dia14 = 0;

  for (const p of protocolos) {
    const diaActual = diaDesdeSometimiento(p.submitted_at);
    if (diaActual < 10) continue;

    // Umbral ">=" (no "==="): si el cron se salta un día, el recordatorio no se
    // pierde — la idempotencia por evento (abajo) evita reenviarlo. A partir del
    // día 14 corresponde el recordatorio dia14; entre 10 y 13, el dia10.
    const tipo = diaActual >= 14 ? "dia14" : "dia10";
    const ronda = p.ronda_actual ?? (await obtenerRondaActual(p.id));
    const eventoTipo = `recordatorio_${tipo}_ronda${ronda}`;

    // Idempotencia POR MIEMBRO: si el recordatorio ya se mandó pero algunos
    // envíos individuales fallaron (quedaron en datos.fallidos), el siguiente
    // tick reintenta SOLO a esos; si no hay fallidos pendientes, se salta.
    const { data: evtPrevio } = await admin
      .from("protocolo_eventos")
      .select("id, datos")
      .eq("protocolo_id", p.id)
      .eq("tipo", eventoTipo)
      .maybeSingle();
    const fallidosPrevios: string[] =
      ((evtPrevio?.datos as { fallidos?: string[] } | null)?.fallidos ?? []);
    if (evtPrevio && fallidosPrevios.length === 0) continue;

    // Miembros del comité, sus votos en la ronda y los emails en conflicto.
    const [miembros, evaluaciones] = await Promise.all([
      listarMiembrosElegiblesComite(),
      listarEvaluacionesProtocolo(p.id, ronda),
    ]);
    const yaVotaron = new Set(evaluaciones.map((e) => e.miembro_id));
    const emailsConflicto = await obtenerEmailsConflicto(
      admin,
      p.id,
      p.investigador_principal_id,
    );

    const noVotantes = miembros.filter(
      (m) =>
        !yaVotaron.has(m.id) &&
        !emailsConflicto.has(m.email.trim().toLowerCase()),
    );

    // Destinatarios: en el primer envío, todos los no-votantes; en un
    // reintento, solo los que fallaron antes y siguen sin votar.
    const destinatarios = evtPrevio
      ? noVotantes.filter((m) => fallidosPrevios.includes(m.email))
      : noVotantes;
    if (evtPrevio && destinatarios.length === 0) {
      // Los fallidos previos ya votaron: limpiar la lista para no revisitar.
      await admin
        .from("protocolo_eventos")
        .update({ datos: { ...(evtPrevio.datos as object), fallidos: [] } })
        .eq("id", evtPrevio.id);
      continue;
    }

    const claveProtocolo = p.clave ?? p.id;
    // En fila con pausa y reintento: Resend limita a 2 envíos/s; en ráfaga
    // (Promise.all) varios recordatorios rebotaban con 429 en silencio.
    const exitosos: string[] = [];
    const fallidos: string[] = [];
    for (const [idx, m] of destinatarios.entries()) {
      if (idx > 0) await pausa(PAUSA_ENTRE_CORREOS_MS);
      const res = await enviarConReintento(() =>
        notificarVotoPendiente({
          protocoloId: p.id,
          claveProtocolo,
          tituloProtocolo: p.titulo,
          diaActual,
          destinatarioEmail: m.email,
          destinatarioNombre: `${m.nombre} ${m.apellidoPaterno}`.trim(),
        }),
      );
      if (res.ok) {
        exitosos.push(m.email);
      } else {
        fallidos.push(m.email);
        errores.push(`${p.id}/${m.email}: ${res.error}`);
      }
    }

    // Si TODOS los envíos del lote fallaron (Resend caído, key revocada…),
    // nadie recibió el recordatorio: avisar a Presidencia. Fail-soft: la alerta
    // no debe romper el cron, así que se ignora su resultado.
    if (destinatarios.length > 0 && exitosos.length === 0) {
      await notificarFalloLoteCorreos({
        contexto: `Recordatorios de voto pendiente del protocolo ${claveProtocolo} (día ${diaActual}, ronda ${ronda})`,
        totalDestinatarios: destinatarios.length,
        detalle: "Ningún miembro sin votar recibió el recordatorio.",
      }).catch((e) => {
        errores.push(
          `${p.id}: no se pudo alertar a Presidencia del fallo total: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        return { ok: false as const };
      });
    }

    // Bitácora honesta: `notificados` solo lleva envíos exitosos; los
    // fallidos quedan en `datos.fallidos` para reintentarlos al día siguiente.
    if (!evtPrevio) {
      const { error: errEvt } = await admin.from("protocolo_eventos").insert({
        protocolo_id: p.id,
        tipo: eventoTipo,
        descripcion: `Recordatorio de voto pendiente (día ${diaActual}, ronda ${ronda}) enviado a ${exitosos.length} de ${destinatarios.length} miembro(s) sin votar.`,
        datos: {
          notificados: exitosos,
          fallidos,
          ronda,
          diaActual,
        },
      });
      if (errEvt) errores.push(`${p.id}: no se pudo registrar el evento: ${errEvt.message}`);
    } else {
      const datosPrevios = (evtPrevio.datos as { notificados?: string[] } | null) ?? {};
      const { error: errEvt } = await admin
        .from("protocolo_eventos")
        .update({
          datos: {
            ...datosPrevios,
            notificados: [...(datosPrevios.notificados ?? []), ...exitosos],
            fallidos,
          },
        })
        .eq("id", evtPrevio.id);
      if (errEvt) errores.push(`${p.id}: no se pudo actualizar el evento: ${errEvt.message}`);
    }

    if (tipo === "dia10") dia10 += 1;
    else dia14 += 1;
  }

  const resultado: Resultado = {
    ok: true,
    hoy,
    dia10,
    dia14,
    errores,
  };
  return NextResponse.json(resultado);
}

/**
 * Conjunto de emails (en minúsculas) en conflicto de interés con el protocolo:
 * el del investigador principal y los de los co-investigadores con email.
 */
async function obtenerEmailsConflicto(
  admin: ReturnType<typeof createAdminClient>,
  protocoloId: string,
  investigadorPrincipalId: string,
): Promise<Set<string>> {
  const emails = new Set<string>();

  const { data: ip } = await admin
    .from("usuarios")
    .select("email")
    .eq("id", investigadorPrincipalId)
    .maybeSingle();
  if (ip?.email) emails.add(ip.email.trim().toLowerCase());

  const { data: coInv } = await admin
    .from("protocolo_co_investigadores")
    .select("email")
    .eq("protocolo_id", protocoloId);
  for (const c of coInv ?? []) {
    if (c.email) emails.add(c.email.trim().toLowerCase());
  }

  return emails;
}
