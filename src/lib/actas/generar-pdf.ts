/**
 * Generador PDF del Acta CEICS-CUTLAJO usando pdf-lib (sesión 9c).
 *
 * pdf-lib reemplaza a pdfkit (sesión 9b) porque éste último era inestable
 * en Vercel serverless: cargaba archivos .afm al runtime con paths relativos
 * a __dirname (ENOENT cuando se bundlea), y su modelo de cursor mutable con
 * dibujo en `pageAdded` provocaba recursión infinita.
 *
 * pdf-lib es serverless-friendly:
 *   - embebe las Standard14 Fonts en el documento (no carga archivos extra)
 *   - no usa streams: genera Uint8Array en memoria con `await doc.save()`
 *   - coordenadas absolutas, sin flow layout
 *
 * Trade-off: sin layout automático, los saltos de página y el wrapping de
 * texto se hacen con helpers locales (`wrap`, `ensureSpace`, `drawLineas`).
 */
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  PDFImage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";
import * as QRCode from "qrcode";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DatosActa, MiembroActa } from "./types";

// ----- Colores -----
const COLOR_HEADER = rgb(0x3d / 255, 0x40 / 255, 0x41 / 255);
const COLOR_VERDE = rgb(0, 0x68 / 255, 0x38 / 255);
const COLOR_NEGRO = rgb(0, 0, 0);
const COLOR_BLANCO = rgb(1, 1, 1);
const COLOR_GRIS_CLARO = rgb(0xf2 / 255, 0xf2 / 255, 0xf2 / 255);

// ----- Geometría -----
const MM_TO_PT = 72 / 25.4;
const mm = (n: number) => n * MM_TO_PT;
const PAGE_W = 612; // Letter
const PAGE_H = 792;
const MARGIN_L = mm(25.4);
const MARGIN_R = mm(25.4);
const MARGIN_TOP = mm(50); // espacio para header con escudo
const MARGIN_BOTTOM = mm(28); // espacio para footer
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const CONTENT_TOP = PAGE_H - MARGIN_TOP;
const CONTENT_BOTTOM = MARGIN_BOTTOM + 4;

// ----- Sanitización a WinAnsi -----
// pdf-lib + StandardFonts usa codepage WinAnsi; los curly quotes, ellipsis
// y guiones tipográficos no caben — pdf-lib lanza error si aparecen.
// Las angulares «» y los acentos á é í ó ú ñ sí están soportados.
function safe(s: string): string {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/…/g, "...")
    .replace(/–/g, "-")
    .replace(/ /g, " ");
}

type Fonts = { regular: PDFFont; bold: PDFFont };

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxW: number,
): string[] {
  const limpio = safe(text);
  const lineas: string[] = [];
  // Respetar saltos manuales
  for (const parrafo of limpio.split("\n")) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const p of palabras) {
      const candidato = actual ? `${actual} ${p}` : p;
      if (font.widthOfTextAtSize(candidato, size) > maxW && actual) {
        lineas.push(actual);
        actual = p;
      } else {
        actual = candidato;
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

type State = {
  doc: PDFDocument;
  pages: PDFPage[];
  page: PDFPage;
  cursorY: number;
};

function nuevaPagina(s: State): void {
  const p = s.doc.addPage([PAGE_W, PAGE_H]);
  s.pages.push(p);
  s.page = p;
  s.cursorY = CONTENT_TOP;
}

function ensureSpace(s: State, needed: number): void {
  if (s.cursorY - needed < CONTENT_BOTTOM) nuevaPagina(s);
}

function moveDown(s: State, pt: number): void {
  s.cursorY -= pt;
}

function drawLineas(
  s: State,
  lineas: string[],
  font: PDFFont,
  size: number,
  opts: {
    x?: number;
    width?: number;
    align?: "left" | "center" | "right";
    color?: RGB;
    lineHeight?: number;
  } = {},
): void {
  const lineH = opts.lineHeight ?? size * 1.3;
  const color = opts.color ?? COLOR_NEGRO;
  const baseX = opts.x ?? MARGIN_L;
  const w = opts.width ?? MARGIN_L + CONTENT_W - baseX;
  for (const raw of lineas) {
    const linea = safe(raw);
    ensureSpace(s, lineH);
    const tw = font.widthOfTextAtSize(linea, size);
    let x: number;
    if (opts.align === "center") {
      x = baseX + (w - tw) / 2;
    } else if (opts.align === "right") {
      x = baseX + w - tw;
    } else {
      x = baseX;
    }
    s.cursorY -= size;
    s.page.drawText(linea, { x, y: s.cursorY, size, font, color });
    s.cursorY -= lineH - size;
  }
}

function drawParrafo(
  s: State,
  text: string,
  font: PDFFont,
  size: number,
  opts: {
    align?: "left" | "center" | "right";
    color?: RGB;
    lineHeight?: number;
    width?: number;
    x?: number;
  } = {},
): void {
  const x = opts.x ?? MARGIN_L;
  const w = opts.width ?? MARGIN_L + CONTENT_W - x;
  drawLineas(s, wrap(text, font, size, w), font, size, {
    ...opts,
    x,
    width: w,
  });
}

// Dibuja el header (banner UDG + nombres) en todas las páginas pasadas.
// El banner contiene escudo + "UNIVERSIDAD DE GUADALAJARA" en formato horizontal.
// Las tres líneas institucionales se superponen al banner, alineadas a la
// izquierda con el inicio de "UNIVERSIDAD DE GUADALAJARA" y posicionadas
// justo debajo de ese texto principal — conforme al estándar visual de
// oficios UDG (ver FILOSOFIA DE DISEÑO DE CUTLAJOMULCO/oficios.docx).
function dibujarHeader(page: PDFPage, escudo: PDFImage, fonts: Fonts): void {
  const escudoW = mm(170);
  const escudoH = mm(28);
  const escudoX = (PAGE_W - escudoW) / 2;
  const escudoYtop = PAGE_H - mm(8);
  page.drawImage(escudo, {
    x: escudoX,
    y: escudoYtop - escudoH,
    width: escudoW,
    height: escudoH,
  });
  // El banner es 1366×216 px: escudo ocupa ~14% del ancho, "UNIVERSIDAD DE
  // GUADALAJARA" inicia a ~16% del ancho y ocupa la mitad superior del alto.
  // Posicionamos las 3 líneas en el cuadrante inferior izquierdo del banner,
  // a partir del 16% del ancho desde el inicio del banner.
  const textX = escudoX + escudoW * 0.16;
  const filas: Array<{ t: string; f: PDFFont }> = [
    { t: "CENTRO UNIVERSITARIO DE TLAJOMULCO", f: fonts.regular },
    { t: "DIVISIÓN DE SALUD", f: fonts.regular },
    {
      t: "COMITÉ DE ÉTICA EN INVESTIGACIÓN EN CIENCIAS DE LA SALUD (CEICS)",
      f: fonts.bold,
    },
  ];
  // Comenzamos justo debajo del texto "UNIVERSIDAD DE GUADALAJARA" del
  // banner (~62% del alto desde el top del banner) y bajamos 8pt por línea.
  let y = escudoYtop - escudoH * 0.62;
  for (const { t, f } of filas) {
    const limpio = safe(t);
    page.drawText(limpio, {
      x: textX,
      y,
      font: f,
      size: 7,
      color: COLOR_HEADER,
    });
    y -= 8;
  }
}

function dibujarFooter(
  page: PDFPage,
  num: number,
  total: number,
  font: PDFFont,
): void {
  const lineas = [
    "Carretera Tlajomulco Santa Fe, KM 3.5 #595. Colonia Lomas de Tejeda",
    "CP 45670, Tlajomulco de Zúñiga, Jalisco. Tel. (33) 30 40 99 37 ext. 937",
    "www.cutlajomulco.udg.mx",
  ];
  // Dibujamos de abajo hacia arriba: la última línea (www) más arriba.
  let y = mm(8);
  for (let i = lineas.length - 1; i >= 0; i--) {
    const limpio = safe(lineas[i]);
    const w = font.widthOfTextAtSize(limpio, 8);
    page.drawText(limpio, {
      x: (PAGE_W - w) / 2,
      y,
      font,
      size: 8,
      color: COLOR_HEADER,
    });
    y += 10;
  }
  const pag = `Página ${num} de ${total}`;
  const wp = font.widthOfTextAtSize(pag, 8);
  page.drawText(pag, {
    x: PAGE_W - MARGIN_R - wp,
    y: mm(8),
    font,
    size: 8,
    color: COLOR_HEADER,
  });
}

// ----- Caja de identificación con fondo gris -----
type FilaIdent = { etq: string; val: string };

function dibujarCajaIdent(
  s: State,
  filas: FilaIdent[],
  fonts: Fonts,
  size: number,
): void {
  const padH = 8;
  const lineH = size * 1.35;
  // Pre-cálculo del alto: cada fila ocupa min 1 lineH; si etq+val excede CONTENT_W-12,
  // medimos cuántas líneas de wrap del valor caben.
  const wrapPorFila: string[][] = filas.map(({ etq, val }) => {
    const etqW = fonts.bold.widthOfTextAtSize(safe(etq), size);
    const primeraMaxW = CONTENT_W - 12 - etqW;
    const palabras = safe(val).split(/\s+/);
    const lineas: string[] = [];
    let actual = "";
    let maxActual = primeraMaxW;
    for (const p of palabras) {
      const cand = actual ? `${actual} ${p}` : p;
      if (fonts.regular.widthOfTextAtSize(cand, size) > maxActual && actual) {
        lineas.push(actual);
        actual = p;
        maxActual = CONTENT_W - 12; // siguientes líneas usan ancho completo
      } else {
        actual = cand;
      }
    }
    if (actual) lineas.push(actual);
    if (lineas.length === 0) lineas.push("");
    return lineas;
  });
  const altoCaja =
    wrapPorFila.reduce((acc, ls) => acc + ls.length * lineH, 0) + padH * 2;
  ensureSpace(s, altoCaja + 6);
  // Rectángulo de fondo
  s.page.drawRectangle({
    x: MARGIN_L,
    y: s.cursorY - altoCaja,
    width: CONTENT_W,
    height: altoCaja,
    color: COLOR_GRIS_CLARO,
  });
  // Texto encima
  let y = s.cursorY - padH - size;
  for (let i = 0; i < filas.length; i++) {
    const etq = safe(filas[i].etq);
    const etqW = fonts.bold.widthOfTextAtSize(etq, size);
    const lineas = wrapPorFila[i];
    s.page.drawText(etq, {
      x: MARGIN_L + 6,
      y,
      font: fonts.bold,
      size,
      color: COLOR_NEGRO,
    });
    if (lineas[0]) {
      s.page.drawText(lineas[0], {
        x: MARGIN_L + 6 + etqW,
        y,
        font: fonts.regular,
        size,
        color: COLOR_NEGRO,
      });
    }
    y -= lineH;
    for (let k = 1; k < lineas.length; k++) {
      s.page.drawText(lineas[k], {
        x: MARGIN_L + 6,
        y,
        font: fonts.regular,
        size,
        color: COLOR_NEGRO,
      });
      y -= lineH;
    }
  }
  s.cursorY -= altoCaja;
}

// ----- Cuadro verde con la resolución -----
function dibujarCuadroResolucion(
  s: State,
  texto: string,
  fonts: Fonts,
): void {
  const cuadroH = mm(14);
  const cuadroW = CONTENT_W * 0.7;
  const cuadroX = MARGIN_L + (CONTENT_W - cuadroW) / 2;
  ensureSpace(s, cuadroH + 12);
  s.page.drawRectangle({
    x: cuadroX,
    y: s.cursorY - cuadroH,
    width: cuadroW,
    height: cuadroH,
    borderColor: COLOR_VERDE,
    borderWidth: 1.5,
  });
  const t = safe(`PROTOCOLO ${texto}`);
  const tw = fonts.bold.widthOfTextAtSize(t, 16);
  s.page.drawText(t, {
    x: cuadroX + (cuadroW - tw) / 2,
    y: s.cursorY - cuadroH + (cuadroH - 16) / 2 + 2,
    font: fonts.bold,
    size: 16,
    color: COLOR_VERDE,
  });
  s.cursorY -= cuadroH + 8;
}

// ----- Tabla simple con bordes -----
function dibujarTablaVotacion(
  s: State,
  filas: Array<[string, string]>,
  fonts: Fonts,
): void {
  const rowH = mm(7);
  const col1W = CONTENT_W * 0.7;
  const col2W = CONTENT_W * 0.3;
  const altoTabla = rowH * filas.length;
  ensureSpace(s, altoTabla + 4);
  const yTop = s.cursorY;
  for (let i = 0; i < filas.length; i++) {
    const ry = yTop - (i + 1) * rowH;
    // Bordes
    s.page.drawRectangle({
      x: MARGIN_L,
      y: ry,
      width: col1W,
      height: rowH,
      borderColor: COLOR_HEADER,
      borderWidth: 0.5,
    });
    s.page.drawRectangle({
      x: MARGIN_L + col1W,
      y: ry,
      width: col2W,
      height: rowH,
      borderColor: COLOR_HEADER,
      borderWidth: 0.5,
    });
    const etq = safe(filas[i][0]);
    s.page.drawText(etq, {
      x: MARGIN_L + 6,
      y: ry + (rowH - 10) / 2 + 1,
      font: fonts.regular,
      size: 10,
      color: COLOR_NEGRO,
    });
    const val = safe(filas[i][1]);
    const valW = fonts.regular.widthOfTextAtSize(val, 10);
    s.page.drawText(val, {
      x: MARGIN_L + col1W + (col2W - valW) / 2,
      y: ry + (rowH - 10) / 2 + 1,
      font: fonts.regular,
      size: 10,
      color: COLOR_NEGRO,
    });
  }
  s.cursorY -= altoTabla + 8;
}

function dibujarTablaMiembros(
  s: State,
  miembros: MiembroActa[],
  fonts: Fonts,
): void {
  const rowH = mm(7);
  const cols = [mm(10), mm(28), mm(95), mm(35)];
  // Si la suma de cols excede CONTENT_W, ajustar la 3a columna
  const sumCols = cols.reduce((a, b) => a + b, 0);
  if (sumCols > CONTENT_W) cols[2] = CONTENT_W - cols[0] - cols[1] - cols[3];
  const colsX = [
    MARGIN_L,
    MARGIN_L + cols[0],
    MARGIN_L + cols[0] + cols[1],
    MARGIN_L + cols[0] + cols[1] + cols[2],
  ];
  const tablaW = cols.reduce((a, b) => a + b, 0);
  const headers = ["#", "Cargo", "Nombre", "Voto"];
  const altoTabla = rowH * (miembros.length + 1);
  ensureSpace(s, altoTabla + 4);
  const yTop = s.cursorY;
  // Cabecera verde
  s.page.drawRectangle({
    x: MARGIN_L,
    y: yTop - rowH,
    width: tablaW,
    height: rowH,
    color: COLOR_VERDE,
  });
  for (let c = 0; c < 4; c++) {
    s.page.drawText(safe(headers[c]), {
      x: colsX[c] + 4,
      y: yTop - rowH + (rowH - 10) / 2 + 1,
      font: fonts.bold,
      size: 10,
      color: COLOR_BLANCO,
    });
  }
  // Filas
  for (let i = 0; i < miembros.length; i++) {
    const ry = yTop - (i + 2) * rowH;
    const m = miembros[i];
    const valores = [
      String(i + 1),
      m.cargo,
      m.nombre,
      m.voto + (m.voto === "Abstención" ? " *" : ""),
    ];
    for (let c = 0; c < 4; c++) {
      s.page.drawRectangle({
        x: colsX[c],
        y: ry,
        width: cols[c],
        height: rowH,
        borderColor: COLOR_HEADER,
        borderWidth: 0.4,
      });
      const txt = safe(valores[c]);
      // Recorte si excede el ancho de la celda (último recurso). Usamos ".."
      // en lugar de "…" porque el ellipsis Unicode no está en WinAnsi.
      let mostrado = txt;
      while (
        fonts.regular.widthOfTextAtSize(mostrado, 9) > cols[c] - 8 &&
        mostrado.length > 3
      ) {
        mostrado = mostrado.slice(0, -3) + "..";
      }
      s.page.drawText(mostrado, {
        x: colsX[c] + 4,
        y: ry + (rowH - 9) / 2 + 1,
        font: fonts.regular,
        size: 9,
        color: COLOR_NEGRO,
      });
    }
  }
  s.cursorY -= altoTabla + 8;
}

// ============================================================================
// Función principal
// ============================================================================
export async function generarActaPdf(datos: DatosActa): Promise<Buffer> {
  const escudoPath = path.join(process.cwd(), "public", "escudo-udg.jpg");
  const escudoBuffer = await fs.readFile(escudoPath);

  const qrDataUrl = await QRCode.toDataURL(datos.folio.url_verificacion, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
  const qrPngBytes = Buffer.from(
    qrDataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64",
  );

  const doc = await PDFDocument.create();
  doc.setTitle(`Acta ${datos.numero_oficio}`);
  doc.setAuthor("CEICS-CUTLAJO");
  doc.setSubject(`Acta de aprobación del protocolo ${datos.protocolo.clave}`);
  doc.setCreator("Plataforma CEICS-CUTLAJO");

  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fonts: Fonts = { regular, bold };

  const escudoImg = await doc.embedJpg(escudoBuffer);
  const qrImg = await doc.embedPng(qrPngBytes);

  const firstPage = doc.addPage([PAGE_W, PAGE_H]);
  const s: State = {
    doc,
    pages: [firstPage],
    page: firstPage,
    cursorY: CONTENT_TOP,
  };

  // ----- 1. Oficio + fecha (alineado a la derecha) -----
  drawLineas(s, [`Oficio No. ${datos.numero_oficio}`], bold, 11, {
    align: "right",
  });
  drawLineas(
    s,
    [`Tlajomulco de Zúñiga, Jalisco, a ${datos.fecha_emision_larga}.`],
    regular,
    11,
    { align: "right" },
  );
  moveDown(s, 14);

  // ----- 2. Destinatario -----
  // Usamos drawParrafo (con wrap) porque la adscripción en mayúsculas suele
  // exceder el ancho de columna.
  const ip = datos.ip;
  for (const linea of [
    `${ip.titulo} ${ip.nombre_completo.toUpperCase()}`,
    `INVESTIGADOR PRINCIPAL — CÓDIGO ${ip.codigo_udg}`,
    ip.adscripcion.toUpperCase(),
    "P R E S E N T E:",
  ]) {
    drawParrafo(s, linea, bold, 11);
  }
  moveDown(s, 12);

  // ----- 3. Asunto (con indent) -----
  drawParrafo(
    s,
    `Asunto: Dictamen del protocolo de investigación con clave ${datos.protocolo.clave}.`,
    regular,
    11,
    { x: MARGIN_L + 24 },
  );
  moveDown(s, 10);

  // ----- 4. Antecedente -----
  drawParrafo(
    s,
    `Por medio del presente, hago de su conocimiento que el Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco, adscrito a la División de Salud, en sesión ${datos.sesion.tipo} celebrada el ${datos.sesion.fecha_larga}, procedió a la revisión y evaluación ética, metodológica y normativa del protocolo de investigación referido al rubro.`,
    regular,
    11,
  );
  moveDown(s, 10);

  // ----- 5. Caja de identificación -----
  dibujarCajaIdent(
    s,
    [
      { etq: "Título del protocolo: ", val: `«${datos.protocolo.titulo}»` },
      {
        etq: "Investigador Principal: ",
        val: `${ip.titulo} ${ip.nombre_completo} (Código UDG ${ip.codigo_udg})`,
      },
      { etq: "Adscripción: ", val: ip.adscripcion },
      {
        etq: "Tipo de investigación: ",
        val: `${datos.protocolo.tipo_investigacion} (${datos.protocolo.clasificacion_riesgo})`,
      },
      {
        etq: "Área de conocimiento (SECIHTI): ",
        val: datos.protocolo.area_conocimiento,
      },
      { etq: "Clave interna del protocolo: ", val: datos.protocolo.clave },
      {
        etq: "Fecha de sometimiento: ",
        val: datos.protocolo.fecha_sometimiento_larga,
      },
      { etq: "Fecha de sesión de evaluación: ", val: datos.sesion.fecha_larga },
    ],
    fonts,
    10,
  );
  moveDown(s, 12);

  // ----- 6. Marco normativo -----
  drawParrafo(
    s,
    "Para la emisión del presente dictamen, este Comité evaluó el protocolo a la luz del siguiente marco normativo nacional e internacional:",
    regular,
    11,
  );
  moveDown(s, 4);
  for (const item of datos.marco_normativo) {
    drawParrafo(s, `• ${item}`, regular, 11, {
      x: MARGIN_L + 16,
    });
  }
  moveDown(s, 6);
  drawParrafo(
    s,
    "Tras la deliberación correspondiente, este Comité considera que el protocolo cumple con los principios bioéticos de autonomía, beneficencia, no maleficencia y justicia, y se apega al marco normativo nacional e internacional vigente en materia de investigación para la salud.",
    regular,
    11,
  );
  moveDown(s, 10);

  // ----- 7. Resolución (cuadro verde) -----
  drawParrafo(
    s,
    "Por lo anteriormente expuesto, este H. Comité de Ética en Investigación en Ciencias de la Salud emite el siguiente dictamen:",
    regular,
    11,
  );
  moveDown(s, 6);
  dibujarCuadroResolucion(s, datos.resolucion.estado, fonts);

  // Observaciones (si aplica)
  if (
    datos.resolucion.tiene_observaciones &&
    datos.resolucion.observaciones.length > 0
  ) {
    moveDown(s, 4);
    drawParrafo(
      s,
      "Observaciones que el Investigador Principal deberá atender:",
      bold,
      11,
    );
    for (const o of datos.resolucion.observaciones) {
      drawParrafo(s, `• ${o}`, regular, 11, { x: MARGIN_L + 16 });
    }
  }

  // Vigencia
  moveDown(s, 8);
  drawParrafo(
    s,
    `VIGENCIA. El presente dictamen tiene una vigencia de ${datos.resolucion.vigencia_meses} meses a partir de la fecha de emisión, es decir, hasta el ${datos.resolucion.fecha_vencimiento_larga}. Para su renovación, el Investigador Principal deberá presentar un informe de seguimiento al menos 30 días naturales antes de la fecha de vencimiento.`,
    regular,
    11,
  );

  // Obligaciones
  moveDown(s, 8);
  drawParrafo(s, "OBLIGACIONES DEL INVESTIGADOR PRINCIPAL:", bold, 11);
  const obligaciones = [
    "Iniciar el estudio únicamente después de contar con todas las autorizaciones administrativas y, cuando aplique, el registro ante COFEPRIS.",
    "Conducir la investigación en estricto apego al protocolo aprobado.",
    "Notificar al CEICS, en un plazo no mayor a 15 días hábiles, cualquier enmienda al protocolo, cambio en el equipo de investigación o desviación significativa.",
    "Reportar eventos adversos serios en un plazo no mayor a 24 horas y eventos adversos no serios en el informe periódico.",
    "Presentar un informe anual de avances dentro de los 30 días previos a la fecha de aniversario de la aprobación.",
    "Presentar el informe final dentro de los 60 días posteriores a la conclusión del estudio.",
    "Resguardar los expedientes y datos del estudio por un periodo mínimo de 5 años posteriores a su conclusión.",
    "Garantizar la confidencialidad de los participantes conforme a la LGPDPPSO y demás normatividad aplicable.",
  ];
  for (let i = 0; i < obligaciones.length; i++) {
    drawParrafo(s, `${i + 1}. ${obligaciones[i]}`, regular, 11, {
      x: MARGIN_L + 16,
    });
  }
  moveDown(s, 10);

  // ----- 8. Resumen de votación -----
  drawParrafo(s, "RESUMEN DE VOTACIÓN", bold, 11);
  moveDown(s, 4);
  const v = datos.votacion;
  dibujarTablaVotacion(
    s,
    [
      ["Miembros presentes (quórum)", `${v.presentes} de ${v.total_miembros}`],
      ["Votos a favor", String(v.favor)],
      ["Votos en contra", String(v.contra)],
      ["Abstenciones (por conflicto de interés)", String(v.abstencion)],
    ],
    fonts,
  );

  // ----- 9. Firma del Presidente -----
  moveDown(s, 16);
  drawLineas(s, ["A T E N T A M E N T E"], bold, 11, { align: "center" });
  drawLineas(s, ['"Piensa y Trabaja"'], regular, 11, { align: "center" });
  drawLineas(
    s,
    [
      '"Año del Centenario de la Constitución Política del Estado Libre y Soberano de Jalisco"',
    ],
    regular,
    11,
    { align: "center" },
  );
  drawLineas(
    s,
    [`Tlajomulco de Zúñiga, Jalisco, a ${datos.fecha_emision_larga}.`],
    regular,
    11,
    { align: "center" },
  );
  moveDown(s, 40);
  drawLineas(s, ["_________________________________________"], regular, 11, {
    align: "center",
  });
  const pres = datos.presidente;
  drawLineas(s, [`${pres.titulo} ${pres.nombre}`], bold, 11, {
    align: "center",
  });
  drawLineas(
    s,
    [
      "Presidente del Comité de Ética en Investigación",
      "en Ciencias de la Salud (CEICS)",
      "Centro Universitario de Tlajomulco — Universidad de Guadalajara",
      `Código UDG: ${pres.codigo_udg}`,
    ],
    regular,
    11,
    { align: "center" },
  );

  // ----- 10. Tabla de miembros -----
  // dibujarTablaMiembros llama a ensureSpace internamente, así que si no
  // cabe en la página actual se va a la siguiente sin forzar whitespace.
  moveDown(s, 16);
  drawLineas(
    s,
    ["MIEMBROS DEL COMITÉ QUE PARTICIPARON EN LA SESIÓN"],
    bold,
    11,
  );
  moveDown(s, 4);
  dibujarTablaMiembros(s, datos.votacion.miembros, fonts);
  drawParrafo(
    s,
    "* Conforme al Reglamento Interno del CEICS, los miembros que declararon conflicto de interés se abstuvieron de deliberar y votar respecto al presente protocolo.",
    regular,
    9,
  );

  // ----- 11. Folio + QR (centrado) -----
  moveDown(s, 24);
  const qrSize = mm(35);
  ensureSpace(s, qrSize + 30);
  s.page.drawImage(qrImg, {
    x: (PAGE_W - qrSize) / 2,
    y: s.cursorY - qrSize,
    width: qrSize,
    height: qrSize,
  });
  s.cursorY -= qrSize + 8;
  drawLineas(
    s,
    [`Folio digital de verificación: ${datos.folio.hash}`],
    regular,
    9,
    { align: "center" },
  );
  drawLineas(s, [datos.folio.url_verificacion], regular, 9, { align: "center" });

  // ----- Header + footer en todas las páginas -----
  const total = s.pages.length;
  for (let i = 0; i < total; i++) {
    dibujarHeader(s.pages[i], escudoImg, fonts);
    dibujarFooter(s.pages[i], i + 1, total, regular);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
