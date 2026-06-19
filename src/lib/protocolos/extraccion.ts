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

/**
 * Resultado de extraer texto plano de un buffer (.docx/.pdf).
 * (Distinto de `ResultadoExtraccion` en `queries.ts`, que modela el JSON que
 * devuelve la IA — aquí es el INPUT crudo, allá el OUTPUT estructurado.)
 */
export type ExtraccionTextoResultado = {
  texto: string;
  warnings: string[];
  /**
   * `true` solo para PDFs cuya capa de texto vino esencialmente vacía
   * (PDF escaneado / solo imágenes). En ese caso `texto` queda vacío y el
   * documento debe leerse por VISIÓN: enviarlo a Claude como bloque `document`
   * (base64) en vez de pasar el texto. Ver `procesar-extraccion/route.ts`.
   * Para DOCX y para PDFs con texto seleccionable es `undefined`.
   */
  requiereOcr?: boolean;
};

// Por debajo de este umbral consideramos que el PDF NO tiene capa de texto
// utilizable (típico de escaneos): pdf-parse devuelve "" o unos pocos caracteres
// de ruido. Lo bastante alto para descartar basura, lo bastante bajo para no
// confundir un PDF real (que tiene cientos/miles de caracteres) con un escaneo.
const MIN_CARACTERES_PDF = 20;

export async function extraerTextoDeBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtraccionTextoResultado> {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    // @ts-ignore — mammoth puede o no tener types resueltos según el entorno
    const mammoth = await import("mammoth");
    // @ts-ignore
    const result = await mammoth.extractRawText({ buffer });
    return {
      texto: limpiarTexto(result.value),
      warnings: (result.messages ?? []).map((m: { message: string }) => m.message),
    };
  }

  if (mimeType === "application/pdf") {
    // @ts-ignore — pdf-parse importa por subpath sin types modernos
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const result = await pdfParse(buffer);
    const texto = limpiarTexto((result.text as string) ?? "");
    // PDF escaneado / sin capa de texto: no hay nada que mandar como texto.
    // Señalamos requiereOcr para que el route lo lea por visión (bloque document).
    if (texto.length < MIN_CARACTERES_PDF) {
      return { texto: "", warnings: [], requiereOcr: true };
    }
    return { texto, warnings: [] };
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
