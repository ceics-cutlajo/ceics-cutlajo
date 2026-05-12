/**
 * POST /api/ia/pre-dictamen
 *
 * Genera un pre-dictamen del comité contrastando el protocolo contra los 100
 * ítems del checklist maestro (agrupados en 11 bloques temáticos). El resultado
 * se escribe en la tabla `pre_informes` y queda disponible para que cada miembro
 * del comité lo valide o discrepe en la pantalla `/comite/protocolo/[id]`.
 *
 * Disparado on-demand desde el cliente: la primera vez que un miembro abre
 * `/comite/protocolo/[id]`, si no hay pre_informe vigente, este handler corre.
 * Idempotente: si ya hay un pre_informe activo, devuelve `skipped: true`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAnthropicClient,
  MAX_TOKENS_PRE_DICTAMEN,
  MODELO_PRE_DICTAMEN,
} from "@/lib/ia/anthropic-client";
import {
  SYSTEM_PROMPT_PRE_DICTAMEN,
  buildUserMessagePreDictamen,
} from "@/lib/ia/prompt-pre-dictamen";
import { preDictamenSchema, CATEGORIAS_BLOQUE } from "@/lib/ia/schema-pre-dictamen";
import {
  agruparPorCategoria,
  filtrarPorAplicabilidad,
  type Categoria,
} from "@/lib/checklist";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  protocoloId: z.string().uuid(),
});

const ROLES_COMITE = new Set([
  "comite_vocal",
  "comite_secretario",
  "presidente",
  "admin_sistema",
]);

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

  // 2. Auth + rol comité
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
  if (!roles.some((r) => ROLES_COMITE.has(r))) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Solo miembros del comité pueden generar el pre-dictamen." },
      { status: 403 },
    );
  }

  // 3. Cargar protocolo + IP + texto_fuente
  const { data: prot } = await admin
    .from("protocolos")
    .select(
      "id, titulo, resumen, area_conocimiento_id, tipo_investigacion_id, clasificacion_riesgo, involucra_humanos, involucra_menores, involucra_datos_geneticos, involucra_medicamento, objetivo_general, objetivos_especificos, criterios_inclusion, criterios_exclusion, metodologia, cronograma, investigador_principal_id, estado",
    )
    .eq("id", body.protocoloId)
    .single();
  if (!prot) {
    return NextResponse.json(
      { ok: false, error: "protocolo-no-encontrado" },
      { status: 404 },
    );
  }
  if (!["en_evaluacion_ia", "en_revision_comite", "listo_dictamen"].includes(prot.estado)) {
    return NextResponse.json(
      {
        ok: false,
        error: "estado-invalido",
        message: `El protocolo debe estar enviado al comité (estado actual: ${prot.estado}).`,
      },
      { status: 422 },
    );
  }

  // 4. ¿Ya existe un pre_informe? → idempotente
  const { data: preInformeExistente } = await admin
    .from("pre_informes")
    .select("id, version")
    .eq("protocolo_id", body.protocoloId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (preInformeExistente) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "pre-informe-ya-existe",
      pre_informe_id: preInformeExistente.id,
    });
  }

  // 5. Cargar texto_fuente desde la extracción IA (si existe)
  const { data: extraccion } = await admin
    .from("extracciones_ia")
    .select("texto_fuente")
    .eq("protocolo_id", body.protocoloId)
    .eq("estado", "completado")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 6. Nombre del IP
  const { data: ipUsuario } = await admin
    .from("usuarios")
    .select("nombre, apellido_paterno, apellido_materno")
    .eq("id", prot.investigador_principal_id)
    .single();
  const ipNombre = ipUsuario
    ? `${ipUsuario.nombre} ${ipUsuario.apellido_paterno}${ipUsuario.apellido_materno ? " " + ipUsuario.apellido_materno : ""}`
    : "(IP desconocido)";

  // 7. Filtrar checklist por aplicabilidad
  const todosAgrupados = agruparPorCategoria();
  const filtradoPorCategoria: Record<Categoria, typeof todosAgrupados[Categoria]> = {
    identificacion: [],
    estructura_cientifica: [],
    metodologia: [],
    riesgo_beneficio: [],
    consentimiento: [],
    poblaciones_vulnerables: [],
    confidencialidad_datos: [],
    productos_salud: [],
    gobernanza_cei: [],
    transparencia_publicacion: [],
    aspectos_economicos: [],
  };
  for (const cat of CATEGORIAS_BLOQUE) {
    filtradoPorCategoria[cat] = filtrarPorAplicabilidad(todosAgrupados[cat], {
      tipo_investigacion: prot.tipo_investigacion_id,
      involucra_humanos: prot.involucra_humanos,
      involucra_menores: prot.involucra_menores,
      involucra_datos_geneticos: prot.involucra_datos_geneticos,
    });
  }

  // 8. Llamar Sonnet
  const inicio = Date.now();
  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: MODELO_PRE_DICTAMEN,
      max_tokens: MAX_TOKENS_PRE_DICTAMEN,
      system: SYSTEM_PROMPT_PRE_DICTAMEN,
      messages: [
        {
          role: "user",
          content: buildUserMessagePreDictamen(
            {
              titulo: prot.titulo,
              resumen: prot.resumen,
              area_conocimiento_id: prot.area_conocimiento_id,
              tipo_investigacion_id: prot.tipo_investigacion_id,
              clasificacion_riesgo: prot.clasificacion_riesgo,
              involucra_humanos: prot.involucra_humanos,
              involucra_menores: prot.involucra_menores,
              involucra_datos_geneticos: prot.involucra_datos_geneticos,
              involucra_medicamento: prot.involucra_medicamento,
              objetivo_general: prot.objetivo_general,
              objetivos_especificos:
                (prot.objetivos_especificos as string[] | null) ?? [],
              criterios_inclusion:
                (prot.criterios_inclusion as string[] | null) ?? [],
              criterios_exclusion:
                (prot.criterios_exclusion as string[] | null) ?? [],
              metodologia: prot.metodologia,
              cronograma:
                (prot.cronograma as { etapa: string; inicio?: string; fin?: string }[] | null) ?? [],
              ip_nombre: ipNombre,
              texto_fuente: extraccion?.texto_fuente ?? null,
            },
            filtradoPorCategoria,
          ),
        },
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
        "La IA no devolvió JSON válido. " + (e instanceof Error ? e.message : String(e)),
      );
    }
    if (typeof parsed === "object" && parsed !== null) {
      (parsed as Record<string, unknown>).tokens_input = response.usage.input_tokens;
      (parsed as Record<string, unknown>).tokens_output = response.usage.output_tokens;
    }
    const validated = preDictamenSchema.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.errors
        .slice(0, 5)
        .map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`)
        .join("; ");
      throw new Error(`JSON no cumple schema: ${issues}`);
    }

    // 9. Calcular agregados de items
    let totalItems = 0;
    let cumple = 0;
    let noCumple = 0;
    let parcial = 0;
    let noAplica = 0;
    let hayNoCumple = false;
    for (const bloque of Object.values(validated.data.bloques)) {
      if (!bloque) continue;
      if (bloque.resultado === "no_cumple") hayNoCumple = true;
      for (const item of bloque.items_evaluados) {
        totalItems++;
        if (item.resultado === "cumple") cumple++;
        else if (item.resultado === "no_cumple") noCumple++;
        else if (item.resultado === "parcial") parcial++;
        else if (item.resultado === "no_aplica") noAplica++;
      }
    }
    const cumpleGlobal = !hayNoCumple && noCumple === 0;

    // 10. Insertar pre_informe
    const duracionSegundos = Math.round((Date.now() - inicio) / 1000);
    const { data: nuevoPreInforme, error: errInsert } = await admin
      .from("pre_informes")
      .insert({
        protocolo_id: body.protocoloId,
        version: 1,
        generado_por: "route-handler-sonnet-4-6",
        modelo_usado: MODELO_PRE_DICTAMEN,
        contenido: validated.data,
        resumen_ejecutivo: validated.data.resumen_ejecutivo,
        cumple_global: cumpleGlobal,
        total_items_evaluados: totalItems,
        items_cumple: cumple,
        items_no_cumple: noCumple,
        items_parcial: parcial,
        items_no_aplica: noAplica,
        observaciones_criticas: validated.data.observaciones_criticas ?? [],
        sugerencias: validated.data.sugerencias ?? [],
        duracion_segundos: duracionSegundos,
      })
      .select("id")
      .single();
    if (errInsert || !nuevoPreInforme) {
      throw new Error(
        "Error al guardar pre_informe: " + (errInsert?.message ?? "desconocido"),
      );
    }

    // 11. Cambiar estado del protocolo a 'en_revision_comite' (si seguía en evaluacion_ia)
    if (prot.estado === "en_evaluacion_ia") {
      await admin
        .from("protocolos")
        .update({ estado: "en_revision_comite" })
        .eq("id", body.protocoloId);
    }

    // 12. Evento
    await admin.from("protocolo_eventos").insert({
      protocolo_id: body.protocoloId,
      tipo: "pre_dictamen_generado",
      descripcion: `Pre-dictamen IA generado (${totalItems} ítems evaluados, cumple_global=${cumpleGlobal})`,
      datos: {
        pre_informe_id: nuevoPreInforme.id,
        modelo: MODELO_PRE_DICTAMEN,
        duracion_segundos: duracionSegundos,
        items_no_cumple: noCumple,
        items_parcial: parcial,
      },
    });

    return NextResponse.json({
      ok: true,
      pre_informe_id: nuevoPreInforme.id,
      duracion_segundos: duracionSegundos,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
    });
  } catch (e) {
    const mensaje =
      e instanceof Error ? e.message : "Error desconocido generando pre-dictamen.";
    // Registrar el error como evento (sin escribir pre_informe parcial)
    await admin.from("protocolo_eventos").insert({
      protocolo_id: body.protocoloId,
      tipo: "pre_dictamen_error",
      descripcion: `Falló la generación del pre-dictamen: ${mensaje.slice(0, 300)}`,
    });
    return NextResponse.json(
      { ok: false, error: "ia-error", message: mensaje },
      { status: 500 },
    );
  }
}

/**
 * Sonnet a veces envuelve el JSON en bloques markdown o añade preámbulo pese
 * al system prompt. Esta función extrae el primer objeto JSON balanceado de
 * la respuesta.
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
