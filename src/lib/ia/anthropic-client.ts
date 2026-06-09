/**
 * Cliente Anthropic singleton para el motor IA del CEICS.
 *
 * Se instancia una sola vez por proceso (warm function en Vercel) y se reutiliza
 * en cada invocación. La key se lee de `ANTHROPIC_API_KEY` (env var configurada
 * en Vercel Production+Preview y en .env.local para desarrollo).
 */
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada. Revisa Vercel env vars o app/.env.local.",
    );
  }
  // timeout < maxDuration (60s) de Vercel: si una llamada se pasa de tiempo, el
  // SDK lanza una excepción ANTES de que Vercel mate el proceso, de modo que el
  // catch del route handler corre y marca la fila como 'error' (en vez de
  // dejarla colgada en 'procesando' para siempre → spinner infinito).
  // maxRetries:1 evita que reintentos internos del SDK consuman el presupuesto
  // de 60s. Las llamadas que necesiten un límite más estricto (extracción) lo
  // pasan por-request en el 2º argumento de messages.create().
  _client = new Anthropic({ apiKey, timeout: 55_000, maxRetries: 1 });
  return _client;
}

// Extracción de protocolos (sesión 7): Sonnet 4.6 — 14 campos estructurados
// con confianza y citas. Requiere precisión, vale la latencia.
export const MODELO_EXTRACCION = "claude-sonnet-4-6";
export const MAX_TOKENS_EXTRACCION = 4096;

// Pre-dictamen del comité (sesión 8a): Haiku 4.5 — evaluación guiada por
// `ai_prompt_hint` muy específicos por ítem. Tarea mecánica, no razonamiento
// abierto. Haiku genera 3-5× más rápido que Sonnet y cumple el budget de 60s
// del límite Hobby. Si en producción se ven veredictos mediocres en bloques
// críticos (consentimiento, riesgo-beneficio), considerar híbrido Haiku+Sonnet.
export const MODELO_PRE_DICTAMEN = "claude-haiku-4-5-20251001";
// 8000 deja margen amplio para evitar truncación. El prompt instruye al modelo
// a reportar solo items relevantes (no_cumple/parcial/severidad alta), no los
// 100, así que en la práctica usa 2-3K tokens.
export const MAX_TOKENS_PRE_DICTAMEN = 8000;

// Resumen de observaciones (sesión 10, Job 3): Haiku 4.5 — síntesis de los
// comentarios del comité en observaciones formales para el acta. Tarea de
// redacción acotada (1 sola llamada), cabe holgada en 60s. El resultado es un
// borrador editable que el Presidente revisa antes de emitir el acta.
export const MODELO_RESUMEN_OBSERVACIONES = "claude-haiku-4-5-20251001";
// 4096 sobra para ~30 observaciones cortas + nota de síntesis.
export const MAX_TOKENS_RESUMEN_OBSERVACIONES = 4096;
