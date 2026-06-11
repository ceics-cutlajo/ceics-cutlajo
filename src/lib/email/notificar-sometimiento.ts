/**
 * Confirmación de sometimiento al Investigador Principal.
 *
 * Se dispara cuando el investigador hace clic en "Enviar al CEICS" desde el
 * wizard, justo después de que el protocolo pasa de `borrador` a
 * `en_evaluacion_ia`. Sirve como acuse de recibo institucional con el detalle
 * del protocolo recibido y los próximos pasos del flujo CEICS.
 *
 * Mismo patrón fail-soft que los otros notificadores: si Resend falla, se
 * loggea pero NO se revierte el cambio de estado del protocolo.
 */
import { EMAIL_COLORES } from "./colores";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type NotificacionSometimientoInput = {
  protocoloId: string;
  claveProtocolo: string | null;
  tituloProtocolo: string;
  ipNombre: string;
  ipEmail: string;
};

export async function notificarSometimiento(
  input: NotificacionSometimientoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarSometimiento] RESEND_API_KEY no configurada — omitiendo envío real",
      { protocoloId: input.protocoloId, ipEmail: input.ipEmail },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario = overrideTo && overrideTo.length > 0 ? overrideTo : input.ipEmail;
  const claveTxt = input.claveProtocolo ?? "(clave pendiente)";
  const subject = `Recibimos tu protocolo ${claveTxt} en el CEICS`;

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
      console.error("[notificarSometimiento] Resend respondió error", r.status, body);
      return {
        ok: false,
        error: `Resend HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido al enviar email";
    console.error("[notificarSometimiento] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function construirTexto(i: NotificacionSometimientoInput): string {
  const link = `${BASE_URL_PUBLICO}/protocolo/${i.protocoloId}`;
  const claveTxt = i.claveProtocolo ?? "(clave pendiente)";
  return [
    `Estimado/a ${i.ipNombre},`,
    ``,
    `Hemos recibido tu protocolo en el Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco.`,
    ``,
    `   Clave asignada: ${claveTxt}`,
    `   Título: ${i.tituloProtocolo}`,
    ``,
    `Próximos pasos del flujo:`,
    `   1. La inteligencia artificial realizará un pre-análisis del protocolo que los miembros del comité analizarán y validarán manualmente.`,
    `   2. Los miembros del CEICS revisarán tu protocolo a la luz del marco normativo nacional e internacional y emitirán sus votos.`,
    `   3. El Presidente del CEICS emitirá el dictamen final y firmará el acta oficial.`,
    `   4. Recibirás un correo con el acta de aprobación en formato PDF y DOCX cuando el dictamen esté listo.`,
    ``,
    `Puedes consultar el estado de tu protocolo en cualquier momento:`,
    link,
    ``,
    `Este acuse de recibo no implica resolución del CEICS. El dictamen oficial se emitirá conforme a la Ley General de Salud, NOM-012-SSA3-2012 y la Declaración de Helsinki.`,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `   División Salud · Centro Universitario de Tlajomulco · Universidad de Guadalajara`,
  ].join("\n");
}

function construirHtml(i: NotificacionSometimientoInput): string {
  const link = `${BASE_URL_PUBLICO}/protocolo/${i.protocoloId}`;
  const claveTxt = i.claveProtocolo ?? "(clave pendiente)";
  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: ${EMAIL_COLORES.texto}; background: ${EMAIL_COLORES.fondo}; margin: 0; padding: 24px; }
  .wrap { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .header { background: ${EMAIL_COLORES.encabezado}; padding: 24px; }
  .header .eyebrow { color: ${EMAIL_COLORES.eyebrow}; text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; font-weight: 600; margin: 0 0 4px 0; }
  .header h1 { color: white; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.3; }
  .accent { height: 4px; background: ${EMAIL_COLORES.franja}; }
  .body { padding: 28px 24px; line-height: 1.6; }
  .body p { margin: 0 0 14px 0; }
  .data { background: ${EMAIL_COLORES.fondo}; border-left: 3px solid ${EMAIL_COLORES.franja}; padding: 14px 16px; margin: 18px 0; font-size: 14px; }
  .data .label { color: ${EMAIL_COLORES.textoSuave}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .data .value { color: ${EMAIL_COLORES.texto}; font-weight: 600; margin-bottom: 10px; }
  .data .value:last-child { margin-bottom: 0; }
  .pasos { padding-left: 22px; margin: 16px 0; }
  .pasos li { margin-bottom: 8px; }
  .cta { display: inline-block; background: ${EMAIL_COLORES.cta}; color: white; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: 600; margin: 8px 0 18px 0; }
  .footer { background: ${EMAIL_COLORES.footerFondo}; padding: 16px 24px; font-size: 12px; color: ${EMAIL_COLORES.textoSuave}; text-align: center; border-top: 1px solid ${EMAIL_COLORES.bordeSuave}; }
  .nota { font-size: 13px; color: ${EMAIL_COLORES.textoSuave}; font-style: italic; margin-top: 18px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <p class="eyebrow">Acuse de recibo · CEICS CUTLAJO</p>
    <h1>Recibimos tu protocolo</h1>
  </div>
  <div class="accent"></div>
  <div class="body">
    <p>Estimado/a <strong>${escapeHtml(i.ipNombre)}</strong>,</p>
    <p>Confirmamos que el Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco ha recibido tu protocolo para evaluación.</p>
    <div class="data">
      <div class="label">Clave asignada</div>
      <div class="value">${escapeHtml(claveTxt)}</div>
      <div class="label">Título</div>
      <div class="value">${escapeHtml(i.tituloProtocolo)}</div>
    </div>
    <p><strong>Próximos pasos del flujo:</strong></p>
    <ol class="pasos">
      <li>La inteligencia artificial realizará un pre-análisis del protocolo que los miembros del comité analizarán y validarán manualmente.</li>
      <li>Los miembros del CEICS revisarán tu protocolo a la luz del marco normativo nacional e internacional y emitirán sus votos.</li>
      <li>El Presidente del CEICS emitirá el dictamen final y firmará el acta oficial.</li>
      <li>Recibirás un correo con el acta de aprobación en formato PDF y DOCX cuando el dictamen esté listo.</li>
    </ol>
    <p>Puedes consultar el estado de tu protocolo en cualquier momento:</p>
    <p><a href="${link}" style="display:inline-block;background:${EMAIL_COLORES.cta};color:#ffffff !important;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;margin:8px 0 18px 0;"><span style="color:#ffffff !important;text-decoration:none;">Ver mi protocolo →</span></a></p>
    <p class="nota">Este acuse de recibo no implica resolución del CEICS. El dictamen oficial se emitirá conforme a la Ley General de Salud, NOM-012-SSA3-2012 y la Declaración de Helsinki.</p>
  </div>
  <div class="footer">
    Sistema CEICS CUTLAJO · División Salud · Centro Universitario de Tlajomulco · Universidad de Guadalajara
  </div>
</div>
</body>
</html>
`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
