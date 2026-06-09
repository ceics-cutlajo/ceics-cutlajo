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

// Extracción de protocolos: Haiku 4.5 — 14 campos estructurados con confianza y
// citas. Se cambió de Sonnet a Haiku (2026-06-09) porque Sonnet sobre el
// documento COMPLETO (~73K caracteres) rebasaba el límite de tiempo de la
// función y colgaba la extracción. Haiku genera 3-5× más rápido y procesa el
// documento entero holgadamente; como esta extracción solo PRE-LLENA el
// formulario (el investigador revisa y corrige todo en el wizard), la precisión
// de Haiku es suficiente. Si la calidad del pre-llenado decepciona, se puede
// volver a Sonnet (ahora cabe con maxDuration=120 en Vercel Pro para documentos
// de tamaño típico).
export const MODELO_EXTRACCION = "claude-haiku-4-5-20251001";
// 8192 (era 4096): el JSON de 15 campos con valores largos (resumen hasta 3000
// chars) + citas podía superar 4096 tokens y TRUNCARSE → JSON inválido. 8192 da
// holgura; el modelo solo genera lo que necesita, así que no encarece ni alenta.
export const MAX_TOKENS_EXTRACCION = 8192;

// Pre-dictamen del comité (modo "a fondo"): Sonnet — mejor que Haiku para
// buscar ítem por ítem en documentos largos y razonar sobre evidencia dispersa.
// Ahora recibe TODOS los documentos del paquete (carta, delegación, CV, BPC,
// consentimiento) además de más texto del protocolo, y REACTIVA la evaluación
// por ítem (cada CHK-NNN con veredicto + observación + fuente). Es una tarea de
// razonamiento, no mecánica: Sonnet justifica mejor por qué un ítem se satisface
// (o no) citando el documento que lo sustenta. Corre en Vercel Pro con budget de
// 300s, suficiente para Sonnet sobre documentos largos.
export const MODELO_PRE_DICTAMEN = "claude-sonnet-4-6";
// 16000 (era 8000): el detalle por ítem (items_evaluados con observación y
// fuente por cada CHK-NNN aplicable) genera bastante más salida que el veredicto
// por bloque solo. 16K da holgura para evitar truncación del JSON.
export const MAX_TOKENS_PRE_DICTAMEN = 16000;

// Resumen de observaciones (sesión 10, Job 3): Haiku 4.5 — síntesis de los
// comentarios del comité en observaciones formales para el acta. Tarea de
// redacción acotada (1 sola llamada), cabe holgada en 60s. El resultado es un
// borrador editable que el Presidente revisa antes de emitir el acta.
export const MODELO_RESUMEN_OBSERVACIONES = "claude-haiku-4-5-20251001";
// 4096 sobra para ~30 observaciones cortas + nota de síntesis.
export const MAX_TOKENS_RESUMEN_OBSERVACIONES = 4096;
