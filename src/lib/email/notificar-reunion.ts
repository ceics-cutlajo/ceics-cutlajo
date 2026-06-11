/**
 * Recordatorio por correo de una sesión del CEICS, enviado SOLO a los
 * miembros del comité (7 días antes y 1 día antes). Incluye el orden del día
 * y los datos de conexión (Google Meet).
 *
 * Integración HTTP directa con Resend (sin SDK), patrón fail-soft idéntico al
 * resto de src/lib/email: si falta la API key o falla el envío, se loggea y se
 * devuelve el resultado sin lanzar. El control de duplicados (recordatorio_*_at)
 * lo garantiza el llamador (route handler del cron).
 */
import { EMAIL_COLORES } from "./colores";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type TipoRecordatorio = "7dias" | "1dia";

export type RecordatorioReunionInput = {
  destinatarioEmail: string;
  destinatarioNombre: string;
  tipo: TipoRecordatorio;
  sesion: {
    titulo: string;
    fechaLarga: string; // "miércoles 3 de junio de 2026"
    horario: string; // "9:00 h" o "9:00 – 10:00 h"
    modalidad: string; // "Virtual"
    ubicacion: string | null;
    meetLink: string | null;
    meetTelefono: string | null;
    meetPin: string | null;
    ordenDelDia: string | null;
  };
};

export async function notificarReunion(
  input: RecordatorioReunionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarReunion] RESEND_API_KEY no configurada — omitiendo envío real",
      { destinatario: input.destinatarioEmail, tipo: input.tipo },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario =
    overrideTo && overrideTo.length > 0 ? overrideTo : input.destinatarioEmail;

  const cuando =
    input.tipo === "7dias" ? "en una semana" : "mañana";
  const subject = `Recordatorio: sesión del CEICS ${cuando} — ${input.sesion.fechaLarga}`;

  try {
    const r = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [destinatario],
        subject,
        html: construirHtml(input),
        text: construirTexto(input),
      }),
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("[notificarReunion] Resend respondió error", r.status, body);
      return {
        ok: false,
        error: `Resend HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido al enviar email";
    console.error("[notificarReunion] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function construirTexto(i: RecordatorioReunionInput): string {
  const s = i.sesion;
  const cuando = i.tipo === "7dias" ? "la próxima semana" : "mañana";
  const lineas = [
    `Estimado/a ${i.destinatarioNombre},`,
    ``,
    `Le recordamos que ${cuando} se celebrará una sesión del Comité de Ética en Investigación en Ciencias de la Salud (CEICS):`,
    ``,
    `   ${s.titulo}`,
    `   Fecha: ${s.fechaLarga}`,
    `   Horario: ${s.horario}`,
    `   Modalidad: ${s.modalidad}${s.ubicacion ? ` — ${s.ubicacion}` : ""}`,
    ``,
  ];
  if (s.meetLink) {
    lineas.push(`Enlace de videollamada (Google Meet): ${s.meetLink}`);
    if (s.meetTelefono)
      lineas.push(
        `O marque: ${s.meetTelefono}${s.meetPin ? ` PIN: ${s.meetPin}#` : ""}`,
      );
    lineas.push(``);
  }
  if (s.ordenDelDia) {
    lineas.push(`Orden del día:`, ``, s.ordenDelDia, ``);
  }
  lineas.push(
    `Puede consultar el calendario en: ${BASE_URL_PUBLICO}/comite/calendario`,
    ``,
    `Esperamos su puntual asistencia, le enviamos saludos cordiales.`,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `Comité de Ética en Investigación en Ciencias de la Salud`,
    `División de Salud · CUTLAJOMULCO · Universidad de Guadalajara`,
  );
  return lineas.join("\n");
}

function construirHtml(i: RecordatorioReunionInput): string {
  const s = i.sesion;
  const cuando = i.tipo === "7dias" ? "la próxima semana" : "mañana";
  const calendarioUrl = `${BASE_URL_PUBLICO}/comite/calendario`;

  const bloqueMeet = s.meetLink
    ? `<div style="margin:20px 0;padding:14px 16px;background:${EMAIL_COLORES.panelFondo};border-left:4px solid ${EMAIL_COLORES.panelBorde};border-radius:6px;">
        <div style="font-size:11px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Conexión</div>
        <a href="${escapeHtml(s.meetLink)}" style="display:inline-block;background:${EMAIL_COLORES.panelBorde};color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:500;">Unirse con Google Meet</a>
        <div style="font-size:13px;color:${EMAIL_COLORES.textoSuave};margin-top:10px;word-break:break-all;"><a href="${escapeHtml(s.meetLink)}" style="color:${EMAIL_COLORES.panelBorde};">${escapeHtml(s.meetLink)}</a></div>
        ${
          s.meetTelefono
            ? `<div style="font-size:12px;color:${EMAIL_COLORES.textoSuave};margin-top:8px;">Por teléfono: ${escapeHtml(s.meetTelefono)}${s.meetPin ? ` · PIN: ${escapeHtml(s.meetPin)}#` : ""}</div>`
            : ""
        }
      </div>`
    : "";

  const bloqueOrden = s.ordenDelDia
    ? `<div style="margin:20px 0;">
        <div style="font-size:11px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Orden del día</div>
        <div style="font-size:14px;line-height:1.6;color:${EMAIL_COLORES.texto};white-space:pre-line;">${escapeHtml(s.ordenDelDia)}</div>
      </div>`
    : "";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${EMAIL_COLORES.fondo};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL_COLORES.texto};">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:${EMAIL_COLORES.encabezado};padding:24px 32px;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">CEICS CUTLAJO · Recordatorio</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">Sesión del comité ${cuando}</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
        Estimado/a ${escapeHtml(i.destinatarioNombre)}, le recordamos que <strong>${cuando}</strong> se celebrará una sesión del CEICS:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;width:34%;">Sesión</td>
          <td style="padding:6px 0;font-size:14px;font-weight:500;">${escapeHtml(s.titulo)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;">Fecha</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(s.fechaLarga)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;">Horario</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(s.horario)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;">Modalidad</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(s.modalidad)}${s.ubicacion ? ` — ${escapeHtml(s.ubicacion)}` : ""}</td>
        </tr>
      </table>
      ${bloqueMeet}
      ${bloqueOrden}
      <p style="margin:24px 0 0 0;font-size:13px;color:${EMAIL_COLORES.textoSuave};line-height:1.6;">
        Esperamos su puntual asistencia. Puede consultar el calendario completo en
        <a href="${calendarioUrl}" style="color:${EMAIL_COLORES.enlace};">la plataforma</a>.
      </p>
    </div>
    <div style="padding:18px 32px;background:${EMAIL_COLORES.footerFondo};border-top:1px solid ${EMAIL_COLORES.bordeSuave};font-size:11px;color:${EMAIL_COLORES.textoSuave};line-height:1.5;">
      Sistema CEICS CUTLAJO — Comité de Ética en Investigación en Ciencias de la Salud<br>
      División de Salud · CUTLAJOMULCO · Universidad de Guadalajara
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
