/**
 * Extracción de texto plano desde .docx / .pdf.
 *
 * Estos helpers corren SOLO en server (server actions).
 * El texto extraído se usa después como input para la IA del Scheduled Task.
 *
 * Las dependencias `mammoth` y `pdf-parse` se importan dinámicamente para
 * evitar que TypeScript falle si no están instaladas en node_modules local
 * (Vercel las instala en el build a partir de package.json).
 */

export async function extraerTextoDeBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ texto: string; warnings: string[] }> {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    // @ts-expect-error mammoth no tiene types instalados localmente, ok en Vercel
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      texto: limpiarTexto(result.value),
      warnings: (result.messages ?? []).map((m: { message: string }) => m.message),
    };
  }

  if (mimeType === "application/pdf") {
    // @ts-expect-error pdf-parse no tiene types instalados localmente
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const result = await pdfParse(buffer);
    return {
      texto: limpiarTexto((result.text as string) ?? ""),
      warnings: [],
    };
  }

  throw new Error(`Tipo MIME no soportado para extracción: ${mimeType}`);
}

function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
