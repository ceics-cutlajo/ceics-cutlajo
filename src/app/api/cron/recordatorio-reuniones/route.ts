/**
 * Cron diario de recordatorios de sesión del CEICS.
 *
 * Lo dispara Vercel Cron (ver vercel.json) una vez al día a las 09:00 hora de
 * Jalisco (15:00 UTC). Busca sesiones que caen exactamente dentro de 7 días o
 * de 1 día y que aún no tengan enviado el recordatorio correspondiente, y
 * envía el correo SOLO a los miembros del comité (presidente, secretaría,
 * vocales). Marca `recordatorio_7d_at` / `recordatorio_1d_at` para no duplicar.
 *
 * Seguridad: si `CRON_SECRET` está configurada, Vercel la envía como
 * `Authorization: Bearer <CRON_SECRET>`; aquí se valida.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarMiembrosElegiblesComite } from "@/lib/evaluaciones/queries";
import { notificarReunion } from "@/lib/email/notificar-reunion";
import { notificarFalloLoteCorreos } from "@/lib/email/notificar-fallo-lote";
import {
  enviarConReintento,
  pausa,
  PAUSA_ENTRE_CORREOS_MS,
} from "@/lib/email/throttle";
import {
  hoyEnJalisco,
  sumarDiasIso,
  fechaLargaEs,
  horario,
} from "@/lib/calendario/formato";
import { ETIQUETA_MODALIDAD, type SesionComite } from "@/lib/calendario/types";

export const dynamic = "force-dynamic";
// Envío en fila (throttle de Resend): sesiones × miembros con pausa de 600 ms
// pueden acercarse al minuto; margen amplio en Vercel Pro.
export const maxDuration = 120;

type Resultado = {
  ok: boolean;
  hoy: string;
  enviados7d: number;
  enviados1d: number;
  errores: string[];
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
  const fecha7 = sumarDiasIso(hoy, 7);
  const fecha1 = sumarDiasIso(hoy, 1);
  const errores: string[] = [];

  const admin = createAdminClient();
  const tabla = (admin as unknown as { from: (t: string) => any }).from(
    "sesiones_comite",
  );

  // Sesiones en la ventana de 7 o 1 día.
  const { data, error } = await tabla
    .select("*")
    .in("fecha", [fecha7, fecha1]);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudieron leer las sesiones." },
      { status: 500 },
    );
  }

  const sesiones = (data ?? []) as SesionComite[];
  const miembros = await listarMiembrosElegiblesComite();

  let enviados7d = 0;
  let enviados1d = 0;

  for (const s of sesiones) {
    const es7d = s.fecha === fecha7 && !s.recordatorio_7d_at;
    const es1d = s.fecha === fecha1 && !s.recordatorio_1d_at;
    if (!es7d && !es1d) continue;

    const tipo = es7d ? "7dias" : "1dia";
    const datosSesion = {
      titulo: s.titulo,
      fechaLarga: fechaLargaEs(s.fecha),
      horario: horario(s.hora_inicio, s.hora_fin),
      modalidad: ETIQUETA_MODALIDAD[s.modalidad] ?? s.modalidad,
      ubicacion: s.ubicacion,
      meetLink: s.meet_link,
      meetTelefono: s.meet_telefono,
      meetPin: s.meet_pin,
      ordenDelDia: s.orden_del_dia,
    };

    // Pausa entre envíos + reintento en 429: respeta el límite de 2/s de Resend.
    let fallosSesion = 0;
    for (const [idx, m] of miembros.entries()) {
      if (idx > 0) await pausa(PAUSA_ENTRE_CORREOS_MS);
      const res = await enviarConReintento(() =>
        notificarReunion({
          destinatarioEmail: m.email,
          destinatarioNombre: `${m.nombre} ${m.apellidoPaterno}`.trim(),
          tipo,
          sesion: datosSesion,
        }),
      );
      if (!res.ok) {
        errores.push(`${s.id}/${m.email}: ${res.error}`);
        fallosSesion += 1;
      }
    }

    // Si TODOS los envíos fallaron (p. ej. Resend caído), NO se marca la
    // sesión: el siguiente tick diario reintenta el lote completo. Con fallos
    // parciales sí se marca (evita duplicar a quienes ya recibieron); esos
    // fallos quedan registrados en `errores`.
    if (miembros.length > 0 && fallosSesion === miembros.length) {
      errores.push(`${s.id}: todos los envíos fallaron; se reintentará en el siguiente tick`);
      // Nadie recibió el recordatorio de esta sesión: avisar a Presidencia.
      // Fail-soft: la alerta no debe romper el cron ni el reintento posterior.
      await notificarFalloLoteCorreos({
        contexto: `Recordatorio de sesión "${s.titulo}" (${tipo === "7dias" ? "7 días" : "1 día"})`,
        totalDestinatarios: miembros.length,
        detalle: "Ningún miembro del comité recibió el recordatorio de la sesión.",
      }).catch((e) => {
        errores.push(
          `${s.id}: no se pudo alertar a Presidencia del fallo total: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        return { ok: false as const };
      });
      continue;
    }
    const campo = es7d ? "recordatorio_7d_at" : "recordatorio_1d_at";
    const { error: errMarca } = await tabla
      .update({ [campo]: new Date().toISOString() })
      .eq("id", s.id);
    if (errMarca) {
      errores.push(`${s.id}: no se pudo marcar ${campo}: ${errMarca.message}`);
    }

    if (es7d) enviados7d += 1;
    else enviados1d += 1;
  }

  const resultado: Resultado = {
    ok: true,
    hoy,
    enviados7d,
    enviados1d,
    errores,
  };
  return NextResponse.json(resultado);
}
