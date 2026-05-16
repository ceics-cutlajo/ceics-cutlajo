/**
 * Envío del acta al Investigador Principal cuando el Presidente emite el
 * dictamen final. Adjunta DOCX y PDF al correo.
 *
 * Mismo patrón fail-soft que `notificar-presidente`: si falla el envío se
 * loggea, pero la emisión del acta NO debe revertirse.
 */
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type NotificacionInvestigadorInput = {
  protocoloId: string;
  claveProtocolo: string;
  tituloProtocolo: string;
  ipNombre: string;
  ipEmail: string;
  resolucion: string;
  numeroOficio: string;
  vigenciaMeses: number;
  fechaVencimientoLarga: string;
  observaciones: string[];
  docxBase64: string;
  pdfBase64: string | null;
  docxNombreArchivo: string;
  pdfNombreArchivo: string;
};

export async function notificarInvestigador(
  input: NotificacionInvestigadorInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarInvestigador] RESEND_API_KEY no configurada — omitiendo envío real",
      { protocoloId: input.protocoloId, ipEmail: input.ipEmail },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario = overrideTo && overrideTo.length > 0 ? overrideTo : input.ipEmail;
  const subject = `Dictamen de tu protocolo ${input.claveProtocolo} — ${input.numeroOficio}`;

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
        attachments: [
          {
            filename: input.docxNombreArchivo,
            content: input.docxBase64,
          },
          ...(input.pdfBase64
            ? [{ filename: input.pdfNombreArchivo, content: input.pdfBase64 }]
            : []),
        ],
      }),
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("[notificarInvestigador] Resend respondió error", r.status, body);
      return {
        ok: false,
        error: `Resend HTTP ${r.status}: ${body.slice(0, 200) || r.statusText}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido al enviar email";
    console.error("[notificarInvestigador] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function colorResolucion(res: string): string {
  if (res === "APROBADO") return "#1f9d55";
  if (res === "APROBADO CON OBSERVACIONES MENORES") return "#c4884a";
  if (res === "CONDICIONADO A MODIFICACIONES MAYORES") return "#c4884a";
  return "#c44a4a";
}

function construirTexto(i: NotificacionInvestigadorInput): string {
  const link = `${BASE_URL_PUBLICO}/protocolo/${i.protocoloId}`;
  const obsTexto =
    i.observaciones.length > 0
      ? "\nObservaciones que deberás atender:\n" +
        i.observaciones.map((o, idx) => `  ${idx + 1}. ${o}`).join("\n") +
        "\n"
      : "\n";
  return [
    `Estimado/a ${i.ipNombre},`,
    ``,
    `El Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco ha emitido el dictamen final de tu protocolo:`,
    ``,
    `   Clave: ${i.claveProtocolo}`,
    `   Título: ${i.tituloProtocolo}`,
    `   Número de oficio: ${i.numeroOficio}`,
    ``,
    `Resolución: ${i.resolucion}`,
    `Vigencia del dictamen: ${i.vigenciaMeses} meses (hasta ${i.fechaVencimientoLarga}).`,
    obsTexto,
    i.pdfBase64
      ? `Encuentras el acta oficial adjunta en formato PDF y DOCX. También puedes consultar el expediente del protocolo en la plataforma:`
      : `Encuentras el acta oficial adjunta en formato DOCX. También puedes consultar el expediente del protocolo en la plataforma:`,
    link,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `Comité de Ética en Investigación en Ciencias de la Salud`,
    `División de Salud · CUTLAJOMULCO · Universidad de Guadalajara`,
  ].join("\n");
}

function construirHtml(i: NotificacionInvestigadorInput): string {
  const link = `${BASE_URL_PUBLICO}/protocolo/${i.protocoloId}`;
  const color = colorResolucion(i.resolucion);
  const obsHtml =
    i.observaciones.length > 0
      ? `<div style="margin:16px 0;padding:14px 16px;background:#fff8eb;border-left:4px solid #c4884a;border-radius:6px;">
          <div style="font-size:12px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Observaciones a atender</div>
          <ol style="margin:6px 0 0 18px;padding:0;font-size:13px;line-height:1.55;">
            ${i.observaciones.map((o) => `<li style="margin:4px 0;">${escapeHtml(o)}</li>`).join("")}
          </ol>
        </div>`
      : "";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2a2a2a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#c8266c;padding:24px 32px;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">CEICS CUTLAJO</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">Dictamen final de tu protocolo</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
        Estimado/a <strong>${escapeHtml(i.ipNombre)}</strong>, el Comité de Ética en Investigación en Ciencias de la Salud (CEICS) ha emitido el dictamen final de tu protocolo.
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
          <td style="padding:6px 0;font-size:12px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;">Número de oficio</td>
          <td style="padding:6px 0;font-size:14px;font-family:'SF Mono',Menlo,monospace;">${escapeHtml(i.numeroOficio)}</td>
        </tr>
      </table>
      <div style="margin:20px 0;padding:14px 16px;background:#f5f3f0;border-left:4px solid ${color};border-radius:6px;">
        <div style="font-size:11px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Resolución</div>
        <div style="font-size:18px;font-weight:600;color:${color};">${escapeHtml(i.resolucion)}</div>
        <div style="font-size:13px;color:#5a5a5a;margin-top:6px;">Vigencia: ${i.vigenciaMeses} meses (hasta ${escapeHtml(i.fechaVencimientoLarga)}).</div>
      </div>
      ${obsHtml}
      <p style="margin:24px 0 16px 0;font-size:14px;line-height:1.6;">
        El acta oficial está adjunta a este correo en formato ${i.pdfBase64 ? "<strong>PDF</strong> y <strong>DOCX</strong>" : "<strong>DOCX</strong>"}. También puedes consultar el expediente completo en la plataforma:
      </p>
      <div style="text-align:center;margin:24px 0 8px 0;">
        <a href="${link}" style="display:inline-block;background:#c8266c;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:500;">
          Ver protocolo
        </a>
      </div>
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
