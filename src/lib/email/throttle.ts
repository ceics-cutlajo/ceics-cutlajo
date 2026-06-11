/**
 * Control de velocidad para envíos vía Resend.
 *
 * Resend acepta máximo 2 peticiones por segundo; un lote de correos al comité
 * disparado en ráfaga (Promise.all) hace que la mayoría rebote con HTTP 429 y,
 * como los notificadores son fail-soft, esos avisos se perdían en silencio.
 * Todo envío a múltiples destinatarios debe ir EN FILA usando estas utilidades.
 */

/** Pausa entre envíos consecutivos (600 ms ≈ 1.6 req/s, bajo el límite de 2/s). */
export const PAUSA_ENTRE_CORREOS_MS = 600;

export function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResultadoEnvio = { ok: true } | { ok: false; error: string };

/**
 * Ejecuta un envío y, si falla por rate limit (HTTP 429), espera 1.2 s y
 * reintenta UNA vez. Otros errores se devuelven tal cual (fail-soft aguas
 * arriba, igual que siempre).
 */
export async function enviarConReintento(
  enviar: () => Promise<ResultadoEnvio>,
): Promise<ResultadoEnvio> {
  const primero = await enviar();
  if (primero.ok || !primero.error.includes("429")) return primero;
  await pausa(1200);
  return enviar();
}
