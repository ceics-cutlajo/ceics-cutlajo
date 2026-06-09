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
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
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

// La extracción usa Haiku 4.5 (rápido) sobre el documento completo. En Vercel
// Pro elevamos el límite a 120s como margen de seguridad para documentos muy
// extensos (con Haiku rara vez se necesita; típico ~15-40s). Si la llamada se
// pasa de tiempo, el SDK aborta antes (timeout por-request abajo) y el handler
// marca 'error' en vez de dejar la fila colgada.
export const maxDuration = 120;
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

  // 5. Llamar a la IA con SALIDAS ESTRUCTURADAS y validar
  try {
    const anthropic = getAnthropicClient();
    // output_config.format obliga a la API a devolver JSON que cumple el schema
    // (sin comillas sin escapar ni JSON truncado a medias → elimina los errores
    // de "JSON inválido"). messages.parse valida la respuesta contra el schema
    // Zod y entrega response.parsed_output ya tipado.
    const response = await anthropic.messages.parse(
      {
        model: MODELO_EXTRACCION,
        max_tokens: MAX_TOKENS_EXTRACCION,
        system: SYSTEM_PROMPT_EXTRACCION,
        messages: [
          { role: "user", content: buildUserMessage(ext.texto_fuente) },
        ],
        output_config: { format: zodOutputFormat(resultadoIASchema) },
      },
      // Timeout < maxDuration (120s) y SIN reintentos: si la IA tarda demasiado,
      // el SDK lanza APIConnectionTimeoutError y cae al catch de abajo
      // (→ marcarError) DENTRO del presupuesto de la función. maxRetries:0 evita
      // que un reintento interno empuje el total más allá del límite y la función
      // muera dejando la fila colgada en 'procesando'.
      { timeout: 110_000, maxRetries: 0 },
    );

    // Si se agotó el presupuesto de tokens, el JSON vendría incompleto.
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "La IA generó una respuesta demasiado larga y se cortó. Reintenta; si persiste, llena el formulario manualmente.",
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error(
        "La IA no devolvió una respuesta con el formato esperado. Reintenta o llena el formulario manualmente.",
      );
    }

    // El schema lleva tokens_* opcionales; los rellenamos con el uso real.
    const resultado = {
      ...parsed,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
    };

    // 6. Guardar completado (el trigger SQL aplica los campos al protocolo)
    const { error: errCompletado } = await admin
      .from("extracciones_ia")
      .update({
        estado: "completado",
        completed_at: new Date().toISOString(),
        resultado_json: resultado,
      })
      .eq("id", body.extraccionId);
    if (errCompletado) {
      // Si el guardado final falla (DB/RLS), NO dejar la fila en 'procesando':
      // el throw cae al catch → marcarError, y la UI ofrece reintentar.
      throw new Error(
        "No se pudo guardar el resultado de la extracción: " +
          errCompletado.message,
      );
    }

    return NextResponse.json({
      ok: true,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
    });
  } catch (e) {
    let mensaje =
      e instanceof Error ? e.message : "Error desconocido procesando con IA.";
    // El timeout del SDK (documento demasiado largo/lento) llega aquí como
    // "Request timed out" — traducirlo a un mensaje accionable para el usuario.
    if (/tim(e|ed)\s*out/i.test(mensaje)) {
      mensaje =
        "El análisis tardó más del tiempo permitido. Reintenta; si el documento es muy extenso, también puedes saltar y llenar el formulario manualmente.";
    }
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
