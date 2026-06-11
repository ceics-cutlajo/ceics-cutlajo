/**
 * Aviso al Presidente del CEICS cuando un investigador NUEVO se registra en la
 * plataforma (no existía antes en `usuarios`). Sirve para que la Presidencia se
 * entere del crecimiento del padrón sin tener que revisar Supabase a mano.
 *
 * Integración HTTP directa con la API de Resend (sin SDK). Patrón fail-soft: si
 * la API key no está configurada o el envío falla, se loggea y se devuelve ok —
 * el registro del investigador NUNCA debe bloquearse por un fallo de email.
 *
 * Remitente: dominio propio `ceics-cutlajo.com` verificado en Resend.
 */
import { EMAIL_COLORES } from "./colores";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type NotificacionNuevoRegistroInput = {
  nombreCompleto: string;
  emailNuevo: string;
  codigoUdg: string;
  adscripcion: string;
  emailPresidente: string;
};

export async function notificarNuevoRegistro(
  input: NotificacionNuevoRegistroInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarNuevoRegistro] RESEND_API_KEY no configurada — omitiendo envío real",
      { emailNuevo: input.emailNuevo, emailPresidente: input.emailPresidente },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario =
    overrideTo && overrideTo.length > 0 ? overrideTo : input.emailPresidente;
  const subject = `Nuevo registro en la plataforma: ${input.nombreCompleto}`;

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
      console.error("[notificarNuevoRegistro] Resend respondió error", r.status, body);
      return {
        ok: false,
        error: `Resend HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`,
      };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido al enviar email";
    console.error("[notificarNuevoRegistro] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function construirTexto(i: NotificacionNuevoRegistroInput): string {
  const linkPadron = `${BASE_URL_PUBLICO}/presidencia`;
  return [
    `Estimado/a Presidente del CEICS,`,
    ``,
    `Un nuevo investigador acaba de registrarse en la plataforma:`,
    ``,
    `   Nombre: ${i.nombreCompleto}`,
    `   Correo: ${i.emailNuevo}`,
    `   Código UdeG: ${i.codigoUdg}`,
    `   Adscripción: ${i.adscripcion}`,
    ``,
    `Aún no ha sometido ningún protocolo; te avisaremos por separado cuando lo haga.`,
    ``,
    `Puedes ver el panel de la Presidencia aquí:`,
    linkPadron,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `Comité de Ética en Investigación en Ciencias de la Salud`,
    `División de Salud · CUTLAJOMULCO · Universidad de Guadalajara`,
  ].join("\n");
}

function construirHtml(i: NotificacionNuevoRegistroInput): string {
  const linkPadron = `${BASE_URL_PUBLICO}/presidencia`;
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${EMAIL_COLORES.fondo};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL_COLORES.texto};">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:${EMAIL_COLORES.encabezado};padding:24px 32px;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">CEICS CUTLAJO</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">Nuevo investigador registrado</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
        Estimado/a Presidente del CEICS, un nuevo investigador acaba de registrarse en la plataforma:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;width:38%;">Nombre</td>
          <td style="padding:6px 0;font-size:14px;font-weight:500;">${escapeHtml(i.nombreCompleto)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;">Correo</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(i.emailNuevo)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;">Código UdeG</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(i.codigoUdg)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;">Adscripción</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(i.adscripcion)}</td>
        </tr>
      </table>
      <p style="margin:20px 0 16px 0;font-size:13px;color:${EMAIL_COLORES.textoSuave};line-height:1.6;">
        Aún no ha sometido ningún protocolo; recibirás un aviso por separado cuando lo haga.
      </p>
      <div style="text-align:center;margin:24px 0 8px 0;">
        <a href="${linkPadron}" style="display:inline-block;background:${EMAIL_COLORES.cta};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:500;">
          Abrir panel de Presidencia
        </a>
      </div>
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
