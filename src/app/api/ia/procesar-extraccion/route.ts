/**
 * POST /api/ia/procesar-extraccion
 *
 * Procesa una fila pendiente de `extracciones_ia` llamando a Claude Sonnet 4.6.
 * Disparado desde el cliente (pantalla `/protocolo/[id]/procesando`) tras subir
 * el documento. Idempotente: el UPDATE atómico pendiente→procesando garantiza
 * que solo el primer request gana.
 *
 * Flujo:
 *   1. Auth por cookie de sesión Supabase.
 *   2. Verifica que el solicitante sea dueño del protocolo asociado.
 *   3. Carga la extracción y reclama atómicamente (pendiente → procesando).
 *   4. Llama a Sonnet con SYSTEM_PROMPT_EXTRACCION + texto_fuente.
 *   5. Parsea, valida con Zod y escribe `completado` (o `error`).
 *   6. El trigger SQL `aplicar_extraccion_ia` aplica los campos al protocolo.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAnthropicClient,
  MAX_TOKENS_EXTRACCION,
  MODELO_EXTRACCION,
} from "@/lib/ia/anthropic-client";
import {
  SYSTEM_PROMPT_EXTRACCION,
  buildUserMessage,
} from "@/lib/ia/prompt-extraccion";
import { resultadoIASchema } from "@/lib/ia/schema-resultado";

// Llamadas a Sonnet con un protocolo largo pueden tardar 30-50s. Vercel Hobby
// permite hasta 60s con maxDuration. Si llegamos al límite, el handler aborta
// y el cliente puede reintentar.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  extraccionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad-request", message: "extraccionId requerido (uuid)" },
      { status: 400 },
    );
  }

  // 2. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json(
      { ok: false, error: "no-auth" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", user.email)
    .single();
  if (!usuario) {
    return NextResponse.json(
      { ok: false, error: "no-profile" },
      { status: 403 },
    );
  }

  // 3. Cargar extracción y verificar ownership
  const { data: ext } = await admin
    .from("extracciones_ia")
    .select("id, protocolo_id, texto_fuente, estado, intentos")
    .eq("id", body.extraccionId)
    .single();
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "extraccion-no-encontrada" },
      { status: 404 },
    );
  }

  const { data: prot } = await admin
    .from("protocolos")
    .select("investigador_principal_id, estado")
    .eq("id", ext.protocolo_id)
    .single();
  if (!prot) {
    return NextResponse.json(
      { ok: false, error: "protocolo-no-encontrado" },
      { status: 404 },
    );
  }
  if (prot.investigador_principal_id !== usuario.id) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  // 4. Reclamo atómico pendiente → procesando
  if (ext.estado !== "pendiente") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `estado-actual: ${ext.estado}`,
    });
  }

  if (!ext.texto_fuente || ext.texto_fuente.trim().length < 50) {
    await marcarError(
      admin,
      body.extraccionId,
      "Texto fuente vacío o demasiado corto (<50 caracteres) para extraer información.",
    );
    return NextResponse.json(
      { ok: false, error: "texto-insuficiente" },
      { status: 422 },
    );
  }

  const { data: claimed, error: claimErr } = await admin
    .from("extracciones_ia")
    .update({
      estado: "procesando",
      procesando_desde: new Date().toISOString(),
      modelo: MODELO_EXTRACCION,
      intentos: (ext.intentos ?? 0) + 1,
    })
    .eq("id", body.extraccionId)
    .eq("estado", "pendiente")
    .select("id")
    .single();
  if (claimErr || !claimed) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ya-procesada",
    });
  }

  // 5. Llamar a Sonnet, parsear, validar
  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: MODELO_EXTRACCION,
      max_tokens: MAX_TOKENS_EXTRACCION,
      system: SYSTEM_PROMPT_EXTRACCION,
      messages: [
        { role: "user", content: buildUserMessage(ext.texto_fuente) },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Respuesta de IA sin contenido de texto.");
    }

    const rawJson = extractJsonObject(textBlock.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      throw new Error(
        "La IA no devolvió JSON válido. " +
          (e instanceof Error ? e.message : String(e)),
      );
    }

    // Inyectar metadata de tokens antes de validar
    if (typeof parsed === "object" && parsed !== null) {
      (parsed as Record<string, unknown>).tokens_input =
        response.usage.input_tokens;
      (parsed as Record<string, unknown>).tokens_output =
        response.usage.output_tokens;
    }

    const validated = resultadoIASchema.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.errors
        .slice(0, 5)
        .map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`)
        .join("; ");
      throw new Error(`JSON no cumple schema: ${issues}`);
    }

    // 6. Guardar completado (el trigger SQL aplica los campos al protocolo)
    await admin
      .from("extracciones_ia")
      .update({
        estado: "completado",
        completed_at: new Date().toISOString(),
        resultado_json: validated.data,
      })
      .eq("id", body.extraccionId);

    return NextResponse.json({
      ok: true,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
    });
  } catch (e) {
    const mensaje =
      e instanceof Error ? e.message : "Error desconocido procesando con IA.";
    await marcarError(admin, body.extraccionId, mensaje);
    return NextResponse.json(
      { ok: false, error: "ia-error", message: mensaje },
      { status: 500 },
    );
  }
}

async function marcarError(
  admin: ReturnType<typeof createAdminClient>,
  extraccionId: string,
  mensaje: string,
) {
  await admin
    .from("extracciones_ia")
    .update({
      estado: "error",
      completed_at: new Date().toISOString(),
      error_mensaje: mensaje.slice(0, 1000),
    })
    .eq("id", extraccionId);
}

/**
 * Sonnet a veces envuelve el JSON en bloques markdown (```json ... ```) o añade
 * preámbulo pese al system prompt. Esta función extrae el primer objeto JSON
 * balanceado de la respuesta. Si no encuentra estructura clara, devuelve el
 * texto original (que fallará en JSON.parse y dará error informativo).
 */
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    return fenced[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return text;
}
