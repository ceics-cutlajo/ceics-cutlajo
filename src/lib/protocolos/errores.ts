/**
 * Traduce errores Zod del wizard a mensajes con contexto del campo
 * y del ítem dentro de un array, ya que el `parsed.error.errors[0].message`
 * crudo dice "String must contain at most N character(s)" sin indicar
 * qué objetivo / criterio falló.
 */
import type { z } from "zod";

const ETIQUETAS_CAMPO_CLINICO: Record<string, string> = {
  objetivo_general: "Objetivo general",
  objetivos_especificos: "Objetivo específico",
  criterios_inclusion: "Criterio de inclusión",
  criterios_exclusion: "Criterio de exclusión",
  metodologia: "Metodología",
  cronograma: "Cronograma",
};

export function formatearErrorZodClinico(error: z.ZodError): string {
  const e = error.errors[0];
  if (!e) return "Datos inválidos";

  const [campoRaw, indice, sub] = e.path;
  const etiqueta = ETIQUETAS_CAMPO_CLINICO[String(campoRaw)] ?? String(campoRaw);

  if (typeof indice === "number" && sub === "etapa") {
    return `${etiqueta} — etapa #${indice + 1}: ${e.message}`;
  }
  if (typeof indice === "number") {
    return `${etiqueta} #${indice + 1}: ${e.message}`;
  }
  return `${etiqueta}: ${e.message}`;
}
