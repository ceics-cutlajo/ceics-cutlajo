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
import { jsonrepair } from "jsonrepair";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAnthropicClient,
  MAX_TOKENS_EXTRACCION,
  MODELO_EXTRACCION,
  MAX_BYTES_PDF_OCR,
  MAX_PAGINAS_PDF_OCR,
} from "@/lib/ia/anthropic-client";
import {
  SYSTEM_PROMPT_EXTRACCION,
  buildUserMessage,
  buildUserMessageConDocumento,
} from "@/lib/ia/prompt-extraccion";
import { resultadoIASchema } from "@/lib/ia/schema-resultado";

const BUCKET_PROTOCOLOS = "protocolos";

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
    .select("id, protocolo_id, documento_id, texto_fuente, estado, intentos")
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

  // Si no hay texto extraíble, puede tratarse de un PDF ESCANEADO (sin capa de
  // texto). En ese caso intentamos leerlo por VISIÓN: descargamos el PDF de
  // Storage y lo mandamos a Claude como bloque `document` (base64). Solo si NO
  // es un PDF (o no se puede recuperar) damos el error de texto insuficiente.
  let pdfBase64: string | null = null;
  if (!ext.texto_fuente || ext.texto_fuente.trim().length < 50) {
    const ocr = await intentarPrepararPdfEscaneado(admin, ext.documento_id);
    if (ocr.ok) {
      pdfBase64 = ocr.base64;
    } else {
      await marcarError(admin, body.extraccionId, ocr.mensaje);
      return NextResponse.json(
        { ok: false, error: "texto-insuficiente", message: ocr.mensaje },
        { status: 422 },
      );
    }
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

  // 5. Llamar a la IA (modo normal, rápido) y parsear de forma robusta
  try {
    const anthropic = getAnthropicClient();
    // Generación normal (sin salidas estructuradas): éstas garantizan JSON
    // válido pero la compilación de la gramática sobre el documento completo
    // rebasa el límite de tiempo. En su lugar, Haiku genera rápido y reparamos
    // el JSON con jsonrepair (corrige comillas internas sin escapar, comas
    // finales, fences y truncados) — el defecto típico de Haiku.
    // Dos rutas: PDF escaneado (visión, bloque `document`) o texto plano.
    // Haiku 4.5 soporta visión/PDF, así que el modelo NO cambia.
    const content = pdfBase64
      ? buildUserMessageConDocumento(pdfBase64)
      : buildUserMessage(ext.texto_fuente as string);

    const response = await anthropic.messages.create(
      {
        model: MODELO_EXTRACCION,
        max_tokens: MAX_TOKENS_EXTRACCION,
        system: SYSTEM_PROMPT_EXTRACCION,
        messages: [{ role: "user", content }],
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

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error(
        "La IA no devolvió contenido analizable. Reintenta o llena el formulario manualmente.",
      );
    }

    // Parseo robusto: intento directo y, si falla, reparación con jsonrepair.
    const rawJson = extractJsonObject(textBlock.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      try {
        parsed = JSON.parse(jsonrepair(rawJson));
      } catch {
        throw new Error(
          "La IA no devolvió una respuesta con el formato esperado. Reintenta o llena el formulario manualmente.",
        );
      }
    }

    // Inyectar el uso real de tokens en el objeto parseado.
    const conTokens =
      typeof parsed === "object" && parsed !== null
        ? {
            ...(parsed as Record<string, unknown>),
            tokens_input: response.usage.input_tokens,
            tokens_output: response.usage.output_tokens,
          }
        : parsed;

    // Las salidas estructuradas ya garantizan la FORMA y los tipos; validamos
    // con Zod solo para limpiar, pero NO fallamos si difiere por longitudes
    // mínimas (es un pre-llenado que el investigador revisa y corrige).
    const validated = resultadoIASchema.safeParse(conTokens);
    const resultado = validated.success ? validated.data : conTokens;

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

    // Pre-llenado best-effort del Equipo: si la extracción detectó
    // co-investigadores y el protocolo aún no tiene ninguno capturado, los
    // insertamos. Va en su propio try/catch: si falla, NO rompe la extracción
    // (ya quedó 'completado'); solo se loguea.
    try {
      const coInv = (resultado as { co_investigadores?: Array<{ nombre?: string; apellido_paterno?: string; apellido_materno?: string; adscripcion?: string; email?: string }> }).co_investigadores;
      if (Array.isArray(coInv) && coInv.length > 0) {
        const { count } = await admin
          .from("protocolo_co_investigadores")
          .select("id", { count: "exact", head: true })
          .eq("protocolo_id", ext.protocolo_id);
        if (!count) {
          const filas = coInv
            .filter((c) => c.nombre && c.apellido_paterno)
            .slice(0, 20)
            .map((c, i) => ({
              protocolo_id: ext.protocolo_id,
              nombre: String(c.nombre),
              apellido_paterno: String(c.apellido_paterno),
              apellido_materno: c.apellido_materno ? String(c.apellido_materno) : null,
              adscripcion: c.adscripcion ? String(c.adscripcion) : null,
              email: c.email ? String(c.email) : null,
              orden: i + 1,
            }));
          if (filas.length > 0) {
            await admin.from("protocolo_co_investigadores").insert(filas);
          }
        }
      }
    } catch (e) {
      console.error("[procesar-extraccion] co-investigadores no insertados:", e);
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

/**
 * Recupera el PDF escaneado del documento vinculado a la extracción y lo prepara
 * como base64 (sin saltos de línea) para enviarlo a Claude por visión. Devuelve
 * un mensaje accionable si NO procede (no es PDF, no se recupera, o excede los
 * límites de la API: 32 MB / 100 páginas).
 */
async function intentarPrepararPdfEscaneado(
  admin: ReturnType<typeof createAdminClient>,
  documentoId: string | null,
): Promise<{ ok: true; base64: string } | { ok: false; mensaje: string }> {
  const MENSAJE_GENERICO =
    "El documento no tiene texto seleccionable. Sube una versión con texto (PDF con capa de texto o Word) o llena el formulario manualmente.";

  if (!documentoId) {
    return { ok: false, mensaje: MENSAJE_GENERICO };
  }

  const { data: doc } = await admin
    .from("protocolo_documentos")
    .select("storage_path, mime_type, tamano_bytes")
    .eq("id", documentoId)
    .single();
  if (!doc || doc.mime_type !== "application/pdf") {
    // No es PDF (p.ej. DOCX sin texto, raro) → no aplica visión por PDF.
    return { ok: false, mensaje: MENSAJE_GENERICO };
  }

  // Guarda por tamaño antes de descargar (el subidor ya limita a 25 MB, pero el
  // tope de la API es 32 MB; re-verificamos por defensa).
  if (
    typeof doc.tamano_bytes === "number" &&
    doc.tamano_bytes > MAX_BYTES_PDF_OCR
  ) {
    return {
      ok: false,
      mensaje:
        "El PDF parece escaneado y excede el límite para lectura automática. Sube una versión con texto seleccionable.",
    };
  }

  const { data: fileData, error: errDl } = await admin.storage
    .from(BUCKET_PROTOCOLOS)
    .download(doc.storage_path);
  if (errDl || !fileData) {
    return { ok: false, mensaje: MENSAJE_GENERICO };
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());

  if (buffer.byteLength > MAX_BYTES_PDF_OCR) {
    return {
      ok: false,
      mensaje:
        "El PDF parece escaneado y excede el límite para lectura automática. Sube una versión con texto seleccionable.",
    };
  }

  // Verificación best-effort de número de páginas (≤100 para modelos de 200K).
  // pdf-parse ya es dependencia y devuelve numpages aun cuando no hay texto.
  try {
    // @ts-ignore — pdf-parse importa por subpath sin types modernos
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const info = await pdfParse(buffer);
    if (
      typeof info?.numpages === "number" &&
      info.numpages > MAX_PAGINAS_PDF_OCR
    ) {
      return {
        ok: false,
        mensaje: `El PDF parece escaneado y tiene ${info.numpages} páginas (máximo ${MAX_PAGINAS_PDF_OCR} para lectura automática). Sube una versión con texto seleccionable.`,
      };
    }
  } catch {
    // Si no se puede contar páginas, seguimos: el tope de tamaño ya acota el
    // request y, en el peor caso, la API rechazará el PDF y caerá al catch.
  }

  return { ok: true, base64: buffer.toString("base64") };
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
 * Haiku a veces envuelve el JSON en bloques markdown (```json ... ```) o añade
 * preámbulo pese al system prompt. Extrae el primer objeto JSON balanceado de la
 * respuesta. Si no encuentra estructura clara, devuelve el texto original (que
 * pasará por jsonrepair y, si todo falla, dará un error informativo).
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
