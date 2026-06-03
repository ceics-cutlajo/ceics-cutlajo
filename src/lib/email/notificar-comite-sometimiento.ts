/**
 * Aviso al comité de un nuevo protocolo sometido.
 *
 * Se dispara cuando el investigador hace clic en "Enviar al CEICS" (también en
 * re-evaluación), justo después del acuse de recibo al IP. Notifica a TODOS los
 * miembros del comité que llegó un nuevo protocolo para evaluación, con sus
 * datos esenciales y el enlace directo a la vista de comité.
 *
 * Se envía un correo por miembro (un destinatario por llamada). Mismo patrón
 * fail-soft que los otros notificadores: si Resend falla, se loggea pero NO se
 * revierte el cambio de estado del protocolo.
 */
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type NotificacionComiteSometimientoInput = {
  protocoloId: string;
  claveProtocolo: string | null;
  tituloProtocolo: string;
  ipNombre: string;
  coInvestigadores: string[];
  area?: string;
  tipoInvestigacion?: string;
  riesgo?: string;
  destinatarioEmail: string;
  destinatarioNombre: string;
};

export async function notificarComiteSometimiento(
  input: NotificacionComiteSometimientoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarComiteSometimiento] RESEND_API_KEY no configurada — omitiendo envío real",
      { protocoloId: input.protocoloId, destinatarioEmail: input.destinatarioEmail },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario =
    overrideTo && overrideTo.length > 0 ? overrideTo : input.destinatarioEmail;
  const claveTxt = input.claveProtocolo ?? "(clave pendiente)";
  const subject = `Nuevo protocolo sometido al CEICS: ${claveTxt}`;

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
      console.error(
        "[notificarComiteSometimiento] Resend respondió error",
        r.status,
        body,
      );
      return {
        ok: false,
        error: `Resend HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido al enviar email";
    console.error("[notificarComiteSometimiento] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function construirTexto(i: NotificacionComiteSometimientoInput): string {
  const link = `${BASE_URL_PUBLICO}/comite/protocolo/${i.protocoloId}`;
  const claveTxt = i.claveProtocolo ?? "(clave pendiente)";
  const lineas: string[] = [
    `Estimado/a ${i.destinatarioNombre},`,
    ``,
    `Ha llegado un nuevo protocolo al Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco para su evaluación.`,
    ``,
    `   Clave: ${claveTxt}`,
    `   Título: ${i.tituloProtocolo}`,
    `   Investigador Principal: ${i.ipNombre}`,
  ];

  if (i.coInvestigadores.length > 0) {
    lineas.push(`   Co-investigadores:`);
    for (const co of i.coInvestigadores) {
      lineas.push(`      - ${co}`);
    }
  }

  if (i.area) lineas.push(`   Área de conocimiento: ${i.area}`);
  if (i.tipoInvestigacion) lineas.push(`   Tipo de investigación: ${i.tipoInvestigacion}`);
  if (i.riesgo) lineas.push(`   Clasificación de riesgo: ${i.riesgo}`);

  lineas.push(
    ``,
    `Puedes revisar el protocolo en la plataforma y, cuando se abra la votación, emitir tu voto si no tienes conflicto de interés:`,
    link,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `   División Salud · Centro Universitario de Tlajomulco · Universidad de Guadalajara`,
  );

  return lineas.join("\n");
}

function construirHtml(i: NotificacionComiteSometimientoInput): string {
  const link = `${BASE_URL_PUBLICO}/comite/protocolo/${i.protocoloId}`;
  const claveTxt = i.claveProtocolo ?? "(clave pendiente)";

  const coInvHtml =
    i.coInvestigadores.length > 0
      ? `
      <div class="label">Co-investigadores</div>
      <div class="value">${i.coInvestigadores.map((c) => escapeHtml(c)).join("<br>")}</div>`
      : "";

  const areaHtml = i.area
    ? `
      <div class="label">Área de conocimiento</div>
      <div class="value">${escapeHtml(i.area)}</div>`
    : "";

  const tipoHtml = i.tipoInvestigacion
    ? `
      <div class="label">Tipo de investigación</div>
      <div class="value">${escapeHtml(i.tipoInvestigacion)}</div>`
    : "";

  const riesgoHtml = i.riesgo
    ? `
      <div class="label">Clasificación de riesgo</div>
      <div class="value">${escapeHtml(i.riesgo)}</div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #2e2d2b; background: #fafaf9; margin: 0; padding: 24px; }
  .wrap { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .header { background: #680538; padding: 24px; }
  .header .eyebrow { color: #ed1e77; text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; font-weight: 600; margin: 0 0 4px 0; }
  .header h1 { color: white; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.3; }
  .accent { height: 4px; background: #ed1e77; }
  .body { padding: 28px 24px; line-height: 1.6; }
  .body p { margin: 0 0 14px 0; }
  .data { background: #fafaf9; border-left: 3px solid #ed1e77; padding: 14px 16px; margin: 18px 0; font-size: 14px; }
  .data .label { color: #6b6a66; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .data .value { color: #1c1b1a; font-weight: 600; margin-bottom: 10px; }
  .data .value:last-child { margin-bottom: 0; }
  .cta { display: inline-block; background: #ed1e77; color: white; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: 600; margin: 8px 0 18px 0; }
  .footer { background: #f4f4f2; padding: 16px 24px; font-size: 12px; color: #6b6a66; text-align: center; border-top: 1px solid #ecebe8; }
  .nota { font-size: 13px; color: #6b6a66; font-style: italic; margin-top: 18px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <p class="eyebrow">Nuevo protocolo · CEICS CUTLAJO</p>
    <h1>Protocolo sometido a evaluación</h1>
  </div>
  <div class="accent"></div>
  <div class="body">
    <p>Estimado/a <strong>${escapeHtml(i.destinatarioNombre)}</strong>,</p>
    <p>Ha llegado un nuevo protocolo al Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco para su evaluación.</p>
    <div class="data">
      <div class="label">Clave</div>
      <div class="value">${escapeHtml(claveTxt)}</div>
      <div class="label">Título</div>
      <div class="value">${escapeHtml(i.tituloProtocolo)}</div>
      <div class="label">Investigador Principal</div>
      <div class="value">${escapeHtml(i.ipNombre)}</div>${coInvHtml}${areaHtml}${tipoHtml}${riesgoHtml}
    </div>
    <p>Puedes revisar el protocolo en la plataforma y, cuando se abra la votación, emitir tu voto si no tienes conflicto de interés:</p>
    <p><a href="${link}" style="display:inline-block;background:#ed1e77;color:#ffffff !important;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;margin:8px 0 18px 0;"><span style="color:#ffffff !important;text-decoration:none;">Revisar protocolo →</span></a></p>
    <p class="nota">Este aviso se genera automáticamente al someterse un protocolo. El dictamen oficial se emitirá conforme a la Ley General de Salud, NOM-012-SSA3-2012 y la Declaración de Helsinki.</p>
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
