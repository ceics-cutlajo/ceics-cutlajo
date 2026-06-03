/**
 * Recordatorio por correo a un miembro del comité que aún no ha registrado su
 * voto sobre un protocolo en revisión. Lo dispara el cron diario
 * `recordatorio-votos-protocolo` a los días 10 y 14 desde el sometimiento.
 *
 * Integración HTTP directa con Resend (sin SDK), patrón fail-soft idéntico al
 * resto de src/lib/email: si falta la API key o falla el envío, se loggea y se
 * devuelve el resultado sin lanzar. El control de duplicados (idempotencia por
 * evento `recordatorio_diaN_rondaM`) lo garantiza el llamador (route del cron).
 *
 * Honra `RESEND_OVERRIDE_TO` (redirige todos los correos a una bandeja de
 * pruebas) igual que el resto de los notificadores.
 */
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";

export type VotoPendienteInput = {
  protocoloId: string;
  claveProtocolo: string;
  tituloProtocolo: string;
  diaActual: number;
  destinatarioEmail: string;
  destinatarioNombre: string;
};

export async function notificarVotoPendiente(
  input: VotoPendienteInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarVotoPendiente] RESEND_API_KEY no configurada — omitiendo envío real",
      { destinatario: input.destinatarioEmail, clave: input.claveProtocolo, dia: input.diaActual },
    );
    return { ok: true };
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  const destinatario =
    overrideTo && overrideTo.length > 0 ? overrideTo : input.destinatarioEmail;

  const subject = `Recordatorio: tu voto pendiente — ${input.claveProtocolo} (día ${input.diaActual})`;

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
        "[notificarVotoPendiente] Resend respondió error",
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
    const msg =
      e instanceof Error ? e.message : "Error desconocido al enviar email";
    console.error("[notificarVotoPendiente] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function urlVotar(protocoloId: string): string {
  return `${BASE_URL_PUBLICO}/comite/protocolo/${protocoloId}`;
}

function construirTexto(i: VotoPendienteInput): string {
  return [
    `Estimado/a ${i.destinatarioNombre},`,
    ``,
    `Le recordamos que el CEICS tiene como meta resolver cada protocolo en un máximo de 14 días naturales desde su sometimiento.`,
    ``,
    `El siguiente protocolo lleva ${i.diaActual} días en revisión y aún no registra su voto:`,
    ``,
    `   ${i.claveProtocolo} — ${i.tituloProtocolo}`,
    ``,
    `Le pedimos registrar su voto a la brevedad para no demorar el dictamen:`,
    `   ${urlVotar(i.protocoloId)}`,
    ``,
    `Gracias por su compromiso, le enviamos saludos cordiales.`,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `Comité de Ética en Investigación en Ciencias de la Salud`,
    `División de Salud · CUTLAJOMULCO · Universidad de Guadalajara`,
  ].join("\n");
}

function construirHtml(i: VotoPendienteInput): string {
  const url = urlVotar(i.protocoloId);
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2a2a2a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#c8266c;padding:24px 32px;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">CEICS CUTLAJO · Recordatorio</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">Tu voto está pendiente</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
        Estimado/a ${escapeHtml(i.destinatarioNombre)}, le recordamos que el CEICS tiene como meta <strong>resolver cada protocolo en un máximo de 14 días naturales</strong> desde su sometimiento.
      </p>
      <div style="margin:20px 0;padding:14px 16px;background:#eef4f3;border-left:4px solid #2E473C;border-radius:6px;">
        <div style="font-size:11px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Protocolo · día ${i.diaActual}</div>
        <div style="font-size:14px;font-weight:600;color:#2a2a2a;">${escapeHtml(i.claveProtocolo)}</div>
        <div style="font-size:14px;color:#5a5a5a;margin-top:4px;">${escapeHtml(i.tituloProtocolo)}</div>
      </div>
      <p style="margin:16px 0;font-size:15px;line-height:1.6;">
        Aún no registra su voto sobre este protocolo. Le pedimos hacerlo a la brevedad para no demorar el dictamen.
      </p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#2E473C;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:500;">Registrar mi voto</a>
      </div>
      <p style="margin:16px 0 0 0;font-size:13px;color:#5a5a5a;line-height:1.6;word-break:break-all;">
        O abra este enlace: <a href="${escapeHtml(url)}" style="color:#c8266c;">${escapeHtml(url)}</a>
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
