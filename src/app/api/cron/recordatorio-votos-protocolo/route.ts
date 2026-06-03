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
import { diaDesdeSometimiento } from "@/lib/protocolos/semaforo";
import { hoyEnJalisco } from "@/lib/calendario/formato";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    // Idempotencia: ¿ya se mandó este recordatorio para esta ronda?
    const { data: yaEnviado } = await admin
      .from("protocolo_eventos")
      .select("id")
      .eq("protocolo_id", p.id)
      .eq("tipo", eventoTipo)
      .maybeSingle();
    if (yaEnviado) continue;

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

    const claveProtocolo = p.clave ?? p.id;
    const resultados = await Promise.all(
      noVotantes.map((m) =>
        notificarVotoPendiente({
          protocoloId: p.id,
          claveProtocolo,
          tituloProtocolo: p.titulo,
          diaActual,
          destinatarioEmail: m.email,
          destinatarioNombre: `${m.nombre} ${m.apellidoPaterno}`.trim(),
        }),
      ),
    );
    resultados.forEach((res, idx) => {
      if (!res.ok) errores.push(`${p.id}/${noVotantes[idx].email}: ${res.error}`);
    });

    // Marca el recordatorio como enviado aunque algún email individual fallara,
    // para no reenviar a todos en el siguiente tick. Los fallos quedan en log.
    await admin.from("protocolo_eventos").insert({
      protocolo_id: p.id,
      tipo: eventoTipo,
      descripcion: `Recordatorio de voto pendiente (día ${diaActual}, ronda ${ronda}) a ${noVotantes.length} miembro(s) sin votar.`,
      datos: {
        notificados: noVotantes.map((m) => m.email),
        ronda,
        diaActual,
      },
    });

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
