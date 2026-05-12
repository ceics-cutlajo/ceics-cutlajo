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
  _client = new Anthropic({ apiKey });
  return _client;
}

// Modelo por defecto para todos los jobs IA del CEICS. Ver memoria
// project-modelo-ia-protocolos: Sonnet 4.6 para extracción, fallback a Opus solo
// para casos límite documentados.
export const MODELO_EXTRACCION = "claude-sonnet-4-6";

// Tope alto pero finito de tokens de salida. Un resultado típico (14 campos con
// valor/confianza/fuente + alertas) cabe en 2-3K tokens; 4096 deja margen.
export const MAX_TOKENS_EXTRACCION = 4096;
