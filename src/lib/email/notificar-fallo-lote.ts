/**
 * Aviso a Presidencia cuando un LOTE COMPLETO de correos masivos falla.
 *
 * Los crons de recordatorios (voto pendiente, reuniones) envían en fila con
 * throttle (lib/email/throttle.ts). Si TODOS los envíos de un lote fallan
 * (p. ej. Resend caído o API key revocada), el fallo queda solo en la bitácora
 * y nadie se entera. Esta función manda UN correo a Presidencia avisando.
 *
 * Patrón idéntico a `notificar-presidente.ts`: integración HTTP directa con
 * Resend (sin SDK), fail-soft (si no hay RESEND_API_KEY retorna ok sin enviar),
 * respeta RESEND_OVERRIDE_TO en pruebas, remitente del dominio propio. El
 * destinatario (Presidencia) se resuelve por rol `presidente` en la BD, igual
 * que en el flujo de dictamen.
 */
import { EMAIL_COLORES } from "./colores";
import { obtenerPresidente } from "@/lib/evaluaciones/queries";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM_DEFAULT = "CEICS CUTLAJO <dictamenes@ceics-cutlajo.com>";
const BASE_URL_PUBLICO = "https://ceics-cutlajo.com";
const RESEND_DASHBOARD_URL = "https://resend.com/emails";

export type NotificarFalloLoteInput = {
  /** Descripción del lote que falló, p. ej. "recordatorios de voto pendiente". */
  contexto: string;
  /** Total de destinatarios a los que se intentó enviar (todos fallaron). */
  totalDestinatarios: number;
  /** Detalle opcional (clave de protocolo, sesión, mensaje de error resumido). */
  detalle?: string;
};

export async function notificarFalloLoteCorreos(
  input: NotificarFalloLoteInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "[notificarFalloLoteCorreos] RESEND_API_KEY no configurada — omitiendo envío real",
      { contexto: input.contexto, totalDestinatarios: input.totalDestinatarios },
    );
    return { ok: true };
  }

  // Destinatario: Presidencia (rol `presidente` en la BD), salvo override en pruebas.
  const overrideTo = process.env.RESEND_OVERRIDE_TO?.trim();
  let destinatario = overrideTo && overrideTo.length > 0 ? overrideTo : "";
  if (!destinatario) {
    const presidente = await obtenerPresidente().catch(() => null);
    if (!presidente?.email) {
      console.error(
        "[notificarFalloLoteCorreos] No se pudo resolver el correo de Presidencia",
      );
      return { ok: false, error: "Presidencia sin correo configurado" };
    }
    destinatario = presidente.email;
  }

  const from = process.env.RESEND_FROM ?? RESEND_FROM_DEFAULT;
  const subject = "⚠️ Fallo de envío masivo de correos del CEICS";

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
        "[notificarFalloLoteCorreos] Resend respondió error",
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
    console.error("[notificarFalloLoteCorreos] excepción:", msg);
    return { ok: false, error: msg };
  }
}

function construirTexto(i: NotificarFalloLoteInput): string {
  return [
    `Estimado/a Presidente del CEICS,`,
    ``,
    `Un lote completo de correos automáticos del sistema NO pudo enviarse.`,
    `Ningún destinatario recibió el aviso.`,
    ``,
    `   Lote: ${i.contexto}`,
    `   Destinatarios afectados: ${i.totalDestinatarios}`,
    ...(i.detalle ? [`   Detalle: ${i.detalle}`] : []),
    ``,
    `Probable causa: el proveedor de correo (Resend) está caído o la clave de`,
    `API fue revocada/agotada. Revisa el dashboard de Resend para confirmar el`,
    `estado del servicio y reenviar si procede:`,
    RESEND_DASHBOARD_URL,
    ``,
    `El sistema reintentará automáticamente en el siguiente ciclo programado.`,
    ``,
    `— Sistema CEICS CUTLAJO`,
    `Comité de Ética en Investigación en Ciencias de la Salud`,
    `División de Salud · CUTLAJOMULCO · Universidad de Guadalajara`,
  ].join("\n");
}

function construirHtml(i: NotificarFalloLoteInput): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${EMAIL_COLORES.fondo};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL_COLORES.texto};">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:${EMAIL_COLORES.encabezado};padding:24px 32px;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">CEICS CUTLAJO</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px;">Fallo de envío masivo de correos</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">
        Estimado/a Presidente del CEICS, un <strong>lote completo</strong> de correos automáticos del sistema no pudo enviarse. Ningún destinatario recibió el aviso.
      </p>
      <div style="margin:20px 0;padding:14px 16px;background:${EMAIL_COLORES.errorSoft};border-left:4px solid ${EMAIL_COLORES.error};border-radius:6px;">
        <div style="font-size:11px;color:${EMAIL_COLORES.textoSuave};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Lote afectado</div>
        <div style="font-size:16px;font-weight:600;color:${EMAIL_COLORES.error};">${escapeHtml(i.contexto)}</div>
        <div style="font-size:13px;color:${EMAIL_COLORES.textoSuave};margin-top:6px;line-height:1.5;">Destinatarios afectados: ${i.totalDestinatarios}${i.detalle ? `<br>${escapeHtml(i.detalle)}` : ""}</div>
      </div>
      <p style="margin:24px 0 16px 0;font-size:14px;line-height:1.6;">
        Probable causa: el proveedor de correo (Resend) está caído o la clave de API fue revocada o agotada. Revisa el dashboard de Resend para confirmar el estado del servicio y reenviar si procede. El sistema reintentará automáticamente en el siguiente ciclo programado.
      </p>
      <div style="text-align:center;margin:24px 0 8px 0;">
        <a href="${RESEND_DASHBOARD_URL}" style="display:inline-block;background:${EMAIL_COLORES.cta};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:500;">
          Abrir dashboard de Resend
        </a>
      </div>
      <p style="margin:16px 0 0 0;font-size:12px;color:${EMAIL_COLORES.textoSuave};text-align:center;">
        O abre este enlace en tu navegador:<br>
        <a href="${RESEND_DASHBOARD_URL}" style="color:${EMAIL_COLORES.enlace};word-break:break-all;">${RESEND_DASHBOARD_URL}</a>
      </p>
    </div>
    <div style="padding:18px 32px;background:${EMAIL_COLORES.footerFondo};border-top:1px solid ${EMAIL_COLORES.bordeSuave};font-size:11px;color:${EMAIL_COLORES.textoSuave};line-height:1.5;">
      Sistema CEICS CUTLAJO — Comité de Ética en Investigación en Ciencias de la Salud<br>
      <a href="${BASE_URL_PUBLICO}" style="color:${EMAIL_COLORES.enlace};">${BASE_URL_PUBLICO}</a> · División de Salud · CUTLAJOMULCO · Universidad de Guadalajara
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
