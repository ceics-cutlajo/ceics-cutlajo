/**
 * POST /api/ia/resumen-observaciones  (Job 3)
 *
 * Sintetiza los comentarios que los miembros del comité dejaron al votar
 * (comentario global + motivos de abstención + comentarios por bloque) en una
 * lista de observaciones formales y accionables dirigidas al Investigador
 * Principal.
 *
 * Disparado on-demand desde el formulario de dictamen del Presidente/Secretario
 * (botón "Generar borrador con IA"). El resultado NO se persiste: se devuelve al
 * cliente para rellenar el textarea de observaciones, que el Presidente revisa y
 * edita antes de emitir el acta. Solo se persiste un evento de auditoría.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAnthropicClient,
  MAX_TOKENS_RESUMEN_OBSERVACIONES,
  MODELO_RESUMEN_OBSERVACIONES,
} from "@/lib/ia/anthropic-client";
import {
  SYSTEM_PROMPT_RESUMEN_OBSERVACIONES,
  buildUserMessageResumenObservaciones,
  type VozMiembro,
} from "@/lib/ia/prompt-resumen-observaciones";
import { resumenObservacionesSchema } from "@/lib/ia/schema-resumen-observaciones";
import { resolucionDesdeRecomendacion } from "@/lib/actas/schemas";
import { ETIQUETAS_CATEGORIA, type Categoria } from "@/lib/checklist";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  protocoloId: z.string().uuid(),
});

// Solo quien emite el acta puede generar el borrador de observaciones.
const ROLES_EMISORES = new Set([
  "presidente",
  "comite_secretario",
  "admin_sistema",
]);

function votoLegible(voto_global: string, conflicto: boolean): string {
  if (voto_global === "abstener" || conflicto) return "Abstención";
  if (voto_global === "no_aprobar") return "En contra";
  return "A favor";
}

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad-request", message: "protocoloId requerido (uuid)" },
      { status: 400 },
    );
  }

  // 2. Auth + rol emisor
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", user.email)
    .single();
  if (!usuario) {
    return NextResponse.json({ ok: false, error: "no-profile" }, { status: 403 });
  }

  const { data: rolesRows } = await admin
    .from("usuario_roles")
    .select("rol")
    .eq("usuario_id", usuario.id);
  const roles = (rolesRows ?? []).map((r) => r.rol as string);
  if (!roles.some((r) => ROLES_EMISORES.has(r))) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Solo Presidencia o Secretaría pueden generar el borrador de observaciones.",
      },
      { status: 403 },
    );
  }

  // 3. Protocolo
  const { data: prot } = await admin
    .from("protocolos")
    .select("id, clave, titulo, estado, recomendacion_comite")
    .eq("id", body.protocoloId)
    .single();
  if (!prot) {
    return NextResponse.json(
      { ok: false, error: "protocolo-no-encontrado" },
      { status: 404 },
    );
  }

  // 4. Evaluaciones del comité (cabecera + nombre del miembro)
  const { data: evals } = await admin
    .from("evaluaciones")
    .select(
      "id, miembro_id, voto_global, comentario_global, conflicto_interes, motivo_abstencion, usuarios:miembro_id(nombre, apellido_paterno)",
    )
    .eq("protocolo_id", body.protocoloId);

  if (!evals || evals.length === 0) {
    return NextResponse.json({
      ok: true,
      observaciones: [],
      nota_sintesis:
        "Aún no hay votos del comité registrados para este protocolo; redacta las observaciones manualmente.",
    });
  }

  // 5. Comentarios por bloque (solo los que tienen texto)
  const evalIds = evals.map((e) => e.id);
  const { data: bloquesRows } = await admin
    .from("evaluaciones_bloques")
    .select("evaluacion_id, bloque, resultado, comentario")
    .in("evaluacion_id", evalIds);

  const bloquesPorEval = new Map<
    string,
    { etiqueta: string; resultado: string; comentario: string }[]
  >();
  for (const b of bloquesRows ?? []) {
    if (!b.comentario || b.comentario.trim().length === 0) continue;
    const lista = bloquesPorEval.get(b.evaluacion_id) ?? [];
    const cat = b.bloque as Categoria;
    lista.push({
      etiqueta: ETIQUETAS_CATEGORIA[cat] ?? (b.bloque as string),
      resultado: (b.resultado as string) ?? "—",
      comentario: b.comentario,
    });
    bloquesPorEval.set(b.evaluacion_id, lista);
  }

  // 6. Armar las "voces" del comité
  const voces: VozMiembro[] = evals.map((e) => {
    const u = e.usuarios as unknown as {
      nombre: string;
      apellido_paterno: string;
    } | null;
    return {
      nombre: u ? `${u.nombre} ${u.apellido_paterno}` : "(miembro)",
      voto: votoLegible(e.voto_global as string, e.conflicto_interes),
      comentario_global: e.comentario_global ?? null,
      motivo_abstencion: e.motivo_abstencion ?? null,
      bloques: bloquesPorEval.get(e.id) ?? [],
    };
  });

  // ¿Hay algo que sintetizar?
  const hayContenido = voces.some(
    (v) =>
      (v.comentario_global && v.comentario_global.trim().length > 0) ||
      (v.motivo_abstencion && v.motivo_abstencion.trim().length > 0) ||
      v.bloques.length > 0,
  );
  if (!hayContenido) {
    return NextResponse.json({
      ok: true,
      observaciones: [],
      nota_sintesis:
        "El comité no dejó comentarios escritos al votar; no hay observaciones que sintetizar. Redáctalas manualmente si la resolución lo requiere.",
    });
  }

  const resolucion = resolucionDesdeRecomendacion(prot.recomendacion_comite);

  // 7. Llamar a Haiku (1 sola llamada)
  const inicio = Date.now();
  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: MODELO_RESUMEN_OBSERVACIONES,
      max_tokens: MAX_TOKENS_RESUMEN_OBSERVACIONES,
      system: SYSTEM_PROMPT_RESUMEN_OBSERVACIONES,
      messages: [
        {
          role: "user",
          content: buildUserMessageResumenObservaciones({
            titulo: prot.titulo,
            clave: prot.clave ?? "(sin clave)",
            resolucion,
            voces,
          }),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("La IA no devolvió texto.");
    }
    const rawJson = extractJsonObject(textBlock.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      throw new Error(
        "JSON inválido en la respuesta IA: " +
          (e instanceof Error ? e.message : String(e)),
      );
    }
    const validado = resumenObservacionesSchema.safeParse(parsed);
    if (!validado.success) {
      const issues = validado.error.errors
        .slice(0, 5)
        .map((er) => `${er.path.join(".") || "(root)"}: ${er.message}`)
        .join("; ");
      throw new Error(`El borrador no cumple el formato esperado: ${issues}`);
    }

    const duracionSegundos = Math.round((Date.now() - inicio) / 1000);

    // 8. Evento de auditoría (no se persiste el contenido del borrador)
    await admin.from("protocolo_eventos").insert({
      protocolo_id: body.protocoloId,
      tipo: "resumen_observaciones_generado",
      descripcion: `Borrador IA de observaciones generado (${validado.data.observaciones.length} observaciones) por ${user.email}`,
      datos: {
        modelo: MODELO_RESUMEN_OBSERVACIONES,
        duracion_segundos: duracionSegundos,
        observaciones_generadas: validado.data.observaciones.length,
        tokens_input: response.usage.input_tokens,
        tokens_output: response.usage.output_tokens,
      },
    });

    return NextResponse.json({
      ok: true,
      observaciones: validado.data.observaciones,
      nota_sintesis: validado.data.nota_sintesis ?? null,
      duracion_segundos: duracionSegundos,
    });
  } catch (e) {
    const mensaje =
      e instanceof Error ? e.message : "Error desconocido generando el borrador.";
    await admin.from("protocolo_eventos").insert({
      protocolo_id: body.protocoloId,
      tipo: "resumen_observaciones_error",
      descripcion: `Falló la generación del borrador de observaciones: ${mensaje.slice(0, 300)}`,
    });
    return NextResponse.json(
      { ok: false, error: "ia-error", message: mensaje },
      { status: 500 },
    );
  }
}

/**
 * El modelo a veces envuelve el JSON en markdown o añade preámbulo pese al
 * system prompt. Extrae el primer objeto JSON balanceado.
 */
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return text;
}
