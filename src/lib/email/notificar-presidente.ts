/**
 * Envío de email al Presidente del CEICS cuando el comité cierra la votación
 * de un protocolo y el caso queda listo para dictamen final presidencial.
 *
 * Integración HTTP directa con la API de Resend (sin SDK) para mantener el
 * bundle ligero. Patrón fail-soft: si la API key no está configurada o el
 * envío falla, se loggea y se devuelve ok — el cierre del voto NO debe
 * bloquearse por un fallo de email. La idempotencia (notificacion_presidente_at)
 * la garantiza el llamador.
 *
 * Remitente: dominio propio `ceics-cutlajo.com` verificado en Resend
 * (DKIM/SPF/MX/DMARC en Cloudflare DNS desde 2026-05-12).
 */
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type NotificacionPresidenteInput = {
  protocoloId: string;
  claveProtocolo: string;
  tituloProtocolo: string;
  ipNombre: string;
  resumenVoto: string;
  ganador: string;
  emailPresidente: string;
};

export async function notificarPresidente(
  input: NotificacionPresidenteInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarPresidente] RESEND_API_KEY no configurada — omitiendo envío real",
      { protocoloId: input.protocoloId, emailPresidente: input.emailPresidente },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario = overrideTo && overrideTo.length > 0
    ? overrideTo
    : input.emailPresidente;
  const subject = `Protocolo ${input.claveProtocolo} listo para tu dictamen presidencial`;

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
        "[notificarPresidente] Resend respondió error",
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
    console.error("[notificarPresidente] excepción:", msg);
    return { ok: false, error: msg };
  }
}

const ETIQUETA_GANADOR: Record<string, string> = {
  aprobar: "Aprobar",
  aprobar_con_observaciones: "Aprobar con observaciones",
  no_aprobar: "No aprobar (devolver con observaciones)",
  abstener: "Sin voto decisivo",
};

function construirTexto(i: NotificacionPresidenteInput): string {
  const linkProtocolo = `${BASE_URL_PUBLICO}/presidencia/protocolo/${i.protocoloId}`;
  return [
    `Estimado/a Presidente del CEICS,`,
    ``,
    `El comité acaba de cerrar la votación sobre el siguiente protocolo:`,
    ``,
    `   Clave: ${i.claveProtocolo}`,
    `   Título: ${i.tituloProtocolo}`,
    `   Investigador Principal: ${i.ipNombre}`,
    ``,
    `Resultado del comité: ${ETIQUETA_GANADOR[i.ganador] ?? i.ganador}`,
    ``,
    `Detalle del voto:`,
    `   ${i.resumenVoto}`,
    ``,
    `Por favor revisa el protocolo en la plataforma y emite tu dictamen final:`,
    linkProtocolo,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `Comité de Ética en Investigación en Ciencias de la Salud`,
    `División de Salud · CUTLAJOMULCO · Universidad de Guadalajara`,
  ].join("\n");
}

function construirHtml(i: NotificacionPresidenteInput): string {
  const linkProtocolo = `${BASE_URL_PUBLICO}/presidencia/protocolo/${i.protocoloId}`;
  const etiquetaGanador = ETIQUETA_GANADOR[i.ganador] ?? i.ganador;
  const colorGanador =
    i.ganador === "aprobar"
      ? "#1f9d55"
      : i.ganador === "aprobar_con_observaciones"
        ? "#c4884a"
        : i.ganador === "no_aprobar"
          ? "#c44a4a"
          : "#5a5a5a";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2a2a2a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#c8266c;padding:24px 32px;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">CEICS CUTLAJO</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">Protocolo listo para tu dictamen</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
        Estimado/a Presidente del CEICS, el comité acaba de cerrar la votación sobre el siguiente protocolo:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;width:40%;">Clave</td>
          <td style="padding:6px 0;font-size:14px;font-weight:500;">${escapeHtml(i.claveProtocolo)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;">Título</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(i.tituloProtocolo)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;">Investigador Principal</td>
          <td style="padding:6px 0;font-size:14px;">${escapeHtml(i.ipNombre)}</td>
        </tr>
      </table>
      <div style="margin:20px 0;padding:14px 16px;background:#f5f3f0;border-left:4px solid ${colorGanador};border-radius:6px;">
        <div style="font-size:11px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Resultado del comité</div>
        <div style="font-size:16px;font-weight:600;color:${colorGanador};">${escapeHtml(etiquetaGanador)}</div>
        <div style="font-size:13px;color:#5a5a5a;margin-top:6px;line-height:1.5;">${escapeHtml(i.resumenVoto)}</div>
      </div>
      <p style="margin:24px 0 16px 0;font-size:14px;line-height:1.6;">
        Por favor revisa el protocolo en la plataforma y emite tu dictamen final.
      </p>
      <div style="text-align:center;margin:24px 0 8px 0;">
        <a href="${linkProtocolo}" style="display:inline-block;background:#c8266c;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:500;">
          Abrir protocolo
        </a>
      </div>
      <p style="margin:16px 0 0 0;font-size:12px;color:#7a7a7a;text-align:center;">
        O abre este enlace en tu navegador:<br>
        <a href="${linkProtocolo}" style="color:#c8266c;word-break:break-all;">${linkProtocolo}</a>
      </p>
    </div>
    <div style="padding:18px 32px;background:#fafafa;border-top:1px solid #ececec;font-size:11px;color:#7a7a7a;line-height:1.5;">
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
