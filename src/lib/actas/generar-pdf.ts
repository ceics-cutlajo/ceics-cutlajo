/**
 * Generador PDF del Acta CEICS-CUTLAJO usando `pdfkit`.
 *
 * pdfkit no tiene "headers/footers" automáticos como docx, así que los
 * pintamos manualmente en cada `pageAdded`. El layout reproduce las 9
 * secciones de la plantilla con fuentes estándar Times/Helvetica.
 */
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DatosActa, MiembroActa } from "./types";

const COLOR_HEADER = "#3D4041";
const COLOR_VERDE = "#006838";
const COLOR_NEGRO = "#000000";
const COLOR_GRIS_CLARO = "#F2F2F2";

const MM_TO_PT = 72 / 25.4; // 1 inch = 25.4 mm = 72 pt
const mm = (n: number) => n * MM_TO_PT;

type Doc = InstanceType<typeof PDFDocument>;

function dibujarHeader(doc: Doc, escudoBuffer: Buffer) {
  const pageWidth = doc.page.width;
  // Escudo centrado en la banda superior
  const imgWidth = mm(170);
  const imgHeight = mm(28);
  doc.image(escudoBuffer, (pageWidth - imgWidth) / 2, mm(8), {
    width: imgWidth,
    height: imgHeight,
  });

  doc
    .fillColor(COLOR_HEADER)
    .font("Times-Roman")
    .fontSize(9)
    .text("CENTRO UNIVERSITARIO DE TLAJOMULCO", 0, mm(38), {
      align: "center",
      width: pageWidth,
    })
    .text("DIVISIÓN DE SALUD", { align: "center", width: pageWidth })
    .font("Times-Bold")
    .text(
      "COMITÉ DE ÉTICA EN INVESTIGACIÓN EN CIENCIAS DE LA SALUD (CEICS)",
      { align: "center", width: pageWidth },
    );
}

function dibujarFooter(doc: Doc, paginaActual: number) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const y = pageHeight - mm(20);

  doc
    .fillColor(COLOR_HEADER)
    .font("Times-Roman")
    .fontSize(8)
    .text(
      "Carretera Tlajomulco Santa Fe, KM 3.5 #595. Colonia Lomas de Tejeda",
      0,
      y,
      { align: "center", width: pageWidth },
    )
    .text(
      "CP 45670, Tlajomulco de Zúñiga, Jalisco. Tel. (33) 30 40 99 37 ext. 937",
      { align: "center", width: pageWidth },
    )
    .text("www.cutlajomulco.udg.mx", { align: "center", width: pageWidth })
    .text(`Página ${paginaActual}`, {
      align: "right",
      width: pageWidth - mm(20),
    });
}

function dibujarFondo(doc: Doc, hex: string, h: number) {
  const x = doc.x;
  const y = doc.y;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(x, y - 2, w, h + 4).fill(hex);
  doc.fillColor(COLOR_NEGRO);
}

export async function generarActaPdf(datos: DatosActa): Promise<Buffer> {
  const escudoPath = path.join(process.cwd(), "public", "escudo-udg.jpg");
  const escudoBuffer = await fs.readFile(escudoPath);

  const qrDataUrl = await QRCode.toDataURL(datos.folio.url_verificacion, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
  const qrBuffer = Buffer.from(
    qrDataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64",
  );

  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: mm(50),
        bottom: mm(28),
        left: mm(25.4),
        right: mm(25.4),
      },
      info: {
        Title: `Acta ${datos.numero_oficio}`,
        Author: "CEICS-CUTLAJO",
        Subject: `Acta de aprobación del protocolo ${datos.protocolo.clave}`,
        Creator: "Plataforma CEICS-CUTLAJO",
      },
    });

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (e) => reject(e));

    let pagina = 1;
    dibujarHeader(doc, escudoBuffer);
    dibujarFooter(doc, pagina);
    doc.on("pageAdded", () => {
      pagina += 1;
      dibujarHeader(doc, escudoBuffer);
      dibujarFooter(doc, pagina);
    });

    // Reseteamos el cursor al área del cuerpo
    doc.fillColor(COLOR_NEGRO);

    // ----- 1. Oficio + fecha -----
    doc
      .font("Times-Bold")
      .fontSize(11)
      .text(`Oficio No. ${datos.numero_oficio}`, { align: "right" });
    doc
      .font("Times-Roman")
      .fontSize(11)
      .text(
        `Tlajomulco de Zúñiga, Jalisco, a ${datos.fecha_emision_larga}.`,
        { align: "right" },
      );
    doc.moveDown(1.2);

    // ----- 2. Destinatario -----
    const ip = datos.ip;
    doc
      .font("Times-Bold")
      .text(`${ip.titulo} ${ip.nombre_completo.toUpperCase()}`)
      .text(`INVESTIGADOR PRINCIPAL — CÓDIGO ${ip.codigo_udg}`)
      .text(ip.adscripcion.toUpperCase())
      .text("P R E S E N T E:");
    doc.moveDown(1);

    // ----- 3. Asunto -----
    doc
      .font("Times-Roman")
      .text(
        `Asunto: Dictamen del protocolo de investigación con clave ${datos.protocolo.clave}.`,
        { indent: 40 },
      );
    doc.moveDown(1);

    // ----- 4. Antecedente -----
    doc.text(
      `Por medio del presente, hago de su conocimiento que el Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco, adscrito a la División de Salud, en sesión ${datos.sesion.tipo} celebrada el ${datos.sesion.fecha_larga}, procedió a la revisión y evaluación ética, metodológica y normativa del protocolo de investigación referido al rubro.`,
      { align: "justify" },
    );
    doc.moveDown(0.8);

    // ----- 5. Identificación (caja gris claro) -----
    const ident: Array<[string, string]> = [
      ["Título del protocolo: ", `«${datos.protocolo.titulo}»`],
      [
        "Investigador Principal: ",
        `${ip.titulo} ${ip.nombre_completo} (Código UDG ${ip.codigo_udg})`,
      ],
      ["Adscripción: ", ip.adscripcion],
      [
        "Tipo de investigación: ",
        `${datos.protocolo.tipo_investigacion} (${datos.protocolo.clasificacion_riesgo})`,
      ],
      ["Área de conocimiento (SECIHTI): ", datos.protocolo.area_conocimiento],
      ["Clave interna del protocolo: ", datos.protocolo.clave],
      ["Fecha de sometimiento: ", datos.protocolo.fecha_sometimiento_larga],
      ["Fecha de sesión de evaluación: ", datos.sesion.fecha_larga],
    ];
    const cajaInicio = doc.y;
    const cajaW =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.rect(doc.page.margins.left, cajaInicio, cajaW, mm(48))
      .fill(COLOR_GRIS_CLARO);
    doc.fillColor(COLOR_NEGRO);
    doc.y = cajaInicio + 6;
    for (const [etq, val] of ident) {
      doc.font("Times-Bold").text(etq, doc.page.margins.left + 6, doc.y, {
        continued: true,
      });
      doc.font("Times-Roman").text(val);
    }
    doc.moveDown(0.8);

    // ----- 6. Marco normativo -----
    doc
      .font("Times-Roman")
      .text(
        "Para la emisión del presente dictamen, este Comité evaluó el protocolo a la luz del siguiente marco normativo nacional e internacional:",
      );
    doc.moveDown(0.4);
    for (const item of datos.marco_normativo) {
      doc.text(`• ${item}`, { indent: 16 });
    }
    doc.moveDown(0.6);
    doc.text(
      "Tras la deliberación correspondiente, este Comité considera que el protocolo cumple con los principios bioéticos de autonomía, beneficencia, no maleficencia y justicia, y se apega al marco normativo nacional e internacional vigente en materia de investigación para la salud.",
      { align: "justify" },
    );
    doc.moveDown(0.8);

    // ----- 7. Resolución -----
    doc.text(
      "Por lo anteriormente expuesto, este H. Comité de Ética en Investigación en Ciencias de la Salud emite el siguiente dictamen:",
      { align: "justify" },
    );
    doc.moveDown(0.5);
    const resY = doc.y;
    const resW = cajaW * 0.7;
    const resX = doc.page.margins.left + (cajaW - resW) / 2;
    doc.rect(resX, resY, resW, mm(14)).lineWidth(1.5).stroke(COLOR_VERDE);
    doc
      .fillColor(COLOR_VERDE)
      .font("Times-Bold")
      .fontSize(16)
      .text(`PROTOCOLO ${datos.resolucion.estado}`, resX, resY + mm(4), {
        width: resW,
        align: "center",
      });
    doc.fillColor(COLOR_NEGRO).font("Times-Roman").fontSize(11);
    doc.y = resY + mm(18);

    if (
      datos.resolucion.tiene_observaciones &&
      datos.resolucion.observaciones.length > 0
    ) {
      doc.moveDown(0.5);
      doc
        .font("Times-Bold")
        .text("Observaciones que el Investigador Principal deberá atender:");
      doc.font("Times-Roman");
      for (const o of datos.resolucion.observaciones) {
        doc.text(`• ${o}`, { indent: 16, align: "justify" });
      }
    }

    doc.moveDown(0.6);
    doc.font("Times-Bold").text("VIGENCIA. ", { continued: true });
    doc
      .font("Times-Roman")
      .text(
        `El presente dictamen tiene una vigencia de ${datos.resolucion.vigencia_meses} meses a partir de la fecha de emisión, es decir, hasta el ${datos.resolucion.fecha_vencimiento_larga}. Para su renovación, el Investigador Principal deberá presentar un informe de seguimiento al menos 30 días naturales antes de la fecha de vencimiento.`,
        { align: "justify" },
      );

    doc.moveDown(0.6);
    doc.font("Times-Bold").text("OBLIGACIONES DEL INVESTIGADOR PRINCIPAL:");
    doc.font("Times-Roman");
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
    obligaciones.forEach((o, i) => {
      doc.text(`${i + 1}. ${o}`, { indent: 16, align: "justify" });
    });

    doc.moveDown(0.8);

    // ----- 8. Resumen votación -----
    doc.font("Times-Bold").text("RESUMEN DE VOTACIÓN");
    doc.font("Times-Roman");
    const v = datos.votacion;
    const filasVot: Array<[string, string]> = [
      ["Miembros presentes (quórum)", `${v.presentes} de ${v.total_miembros}`],
      ["Votos a favor", String(v.favor)],
      ["Votos en contra", String(v.contra)],
      ["Abstenciones (por conflicto de interés)", String(v.abstencion)],
    ];
    const tablaY = doc.y + 4;
    const colA = doc.page.margins.left;
    const colW1 = cajaW * 0.7;
    const colW2 = cajaW * 0.3;
    const rowH = mm(7);
    filasVot.forEach(([etq, val], i) => {
      const ry = tablaY + i * rowH;
      doc.rect(colA, ry, colW1, rowH).lineWidth(0.5).stroke(COLOR_HEADER);
      doc.rect(colA + colW1, ry, colW2, rowH).stroke(COLOR_HEADER);
      doc.text(etq, colA + 6, ry + 5, { width: colW1 - 12 });
      doc.text(val, colA + colW1, ry + 5, {
        width: colW2,
        align: "center",
      });
    });
    doc.y = tablaY + filasVot.length * rowH + 8;

    // ----- 9. Firma del Presidente -----
    doc.moveDown(1.2);
    doc.font("Times-Bold").text("A T E N T A M E N T E", { align: "center" });
    doc.font("Times-Roman");
    doc.text("“Piensa y Trabaja”", { align: "center" });
    doc.text(
      "“Año del Centenario de la Constitución Política del Estado Libre y Soberano de Jalisco”",
      { align: "center" },
    );
    doc.text(
      `Tlajomulco de Zúñiga, Jalisco, a ${datos.fecha_emision_larga}.`,
      { align: "center" },
    );
    doc.moveDown(3);
    doc.text("_________________________________________", { align: "center" });
    const pres = datos.presidente;
    doc.font("Times-Bold").text(`${pres.titulo} ${pres.nombre}`, {
      align: "center",
    });
    doc
      .font("Times-Roman")
      .text("Presidente del Comité de Ética en Investigación", {
        align: "center",
      })
      .text("en Ciencias de la Salud (CEICS)", { align: "center" })
      .text("Centro Universitario de Tlajomulco — Universidad de Guadalajara", {
        align: "center",
      })
      .text(`Código UDG: ${pres.codigo_udg}`, { align: "center" });

    // ----- 10. Tabla de miembros -----
    doc.addPage();
    doc.font("Times-Bold").text("MIEMBROS DEL COMITÉ QUE PARTICIPARON EN LA SESIÓN");
    doc.font("Times-Roman");
    const yMiembros = doc.y + 4;
    const cols = [mm(10), mm(28), mm(95), mm(35)];
    const colsX = [
      doc.page.margins.left,
      doc.page.margins.left + cols[0],
      doc.page.margins.left + cols[0] + cols[1],
      doc.page.margins.left + cols[0] + cols[1] + cols[2],
    ];
    const headersTabla = ["#", "Cargo", "Nombre", "Voto"];
    // Cabecera con fondo verde
    doc.rect(doc.page.margins.left, yMiembros, cajaW, rowH).fill(COLOR_VERDE);
    doc.fillColor("#FFFFFF").font("Times-Bold");
    headersTabla.forEach((h, i) => {
      doc.text(h, colsX[i] + 4, yMiembros + 5, { width: cols[i] - 8 });
    });
    doc.fillColor(COLOR_NEGRO).font("Times-Roman");
    datos.votacion.miembros.forEach((m: MiembroActa, idx: number) => {
      const ry = yMiembros + (idx + 1) * rowH;
      [0, 1, 2, 3].forEach((c) => {
        doc.rect(colsX[c], ry, cols[c], rowH).lineWidth(0.4).stroke(COLOR_HEADER);
      });
      doc.text(String(idx + 1), colsX[0] + 4, ry + 5, { width: cols[0] - 8 });
      doc.text(m.cargo, colsX[1] + 4, ry + 5, { width: cols[1] - 8 });
      doc.text(m.nombre, colsX[2] + 4, ry + 5, { width: cols[2] - 8 });
      doc.text(
        m.voto + (m.voto === "Abstención" ? " *" : ""),
        colsX[3] + 4,
        ry + 5,
        { width: cols[3] - 8 },
      );
    });
    doc.y = yMiembros + (datos.votacion.miembros.length + 1) * rowH + 8;

    doc.fontSize(9).text(
      "* Conforme al Reglamento Interno del CEICS, los miembros que declararon conflicto de interés se abstuvieron de deliberar y votar respecto al presente protocolo.",
      { align: "justify" },
    );

    // ----- 11. Folio + QR -----
    doc.moveDown(1.5);
    doc.fontSize(11);
    const qrSize = mm(35);
    doc.image(qrBuffer, (doc.page.width - qrSize) / 2, doc.y, {
      width: qrSize,
      height: qrSize,
    });
    doc.y += qrSize + 6;
    doc
      .fontSize(9)
      .text(`Folio digital de verificación: ${datos.folio.hash}`, {
        align: "center",
      })
      .text(datos.folio.url_verificacion, { align: "center" });

    doc.end();
  });
}

// Marca para evitar warning de "import no usado": dibujarFondo es util para extensiones futuras
void dibujarFondo;
