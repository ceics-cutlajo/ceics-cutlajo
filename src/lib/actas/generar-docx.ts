/**
 * Generador DOCX del Acta CEICS-CUTLAJO usando la librería `docx` (npm).
 *
 * Construye el documento programáticamente — sin plantilla externa — siguiendo
 * la especificación de `docs/06_PLANTILLA_ACTA.md`: header con escudo UDG,
 * 9 secciones de cuerpo, tabla de votación, tabla de miembros, folio + QR
 * y footer institucional.
 *
 * Para máxima compatibilidad con servidores Vercel serverless usamos solo
 * fuentes estándar (Calibri con fallback Carlito).
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageNumber,
  ShadingType,
  HeightRule,
  convertMillimetersToTwip,
} from "docx";
import * as QRCode from "qrcode";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DatosActa, MiembroActa } from "./types";

const COLOR_HEADER = "3D4041"; // gris institucional
const COLOR_VERDE = "006838"; // verde UDG/CUTLAJO
const COLOR_NEGRO = "000000";
const COLOR_GRIS_CLARO = "F2F2F2";
const FUENTE_CUERPO = "Calibri";

// ----------------------------------------------------------------
// HEADER
// ----------------------------------------------------------------
function buildHeader(escudoBuffer: Buffer): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: escudoBuffer,
            transformation: { width: 540, height: 90 },
            type: "jpg",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100, after: 0 },
        children: [
          new TextRun({
            text: "Centro Universitario de Tlajomulco",
            font: FUENTE_CUERPO,
            size: 18,
            color: COLOR_HEADER,
            smallCaps: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: "División de Salud",
            font: FUENTE_CUERPO,
            size: 18,
            color: COLOR_HEADER,
            smallCaps: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: "Comité de Ética en Investigación en Ciencias de la Salud (CEICS)",
            font: FUENTE_CUERPO,
            size: 18,
            color: COLOR_HEADER,
            smallCaps: true,
            bold: true,
          }),
        ],
      }),
    ],
  });
}

// ----------------------------------------------------------------
// FOOTER
// ----------------------------------------------------------------
function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 0 },
        children: [
          new TextRun({
            text: "Carretera Tlajomulco Santa Fe, KM 3.5 #595. Colonia Lomas de Tejeda",
            font: FUENTE_CUERPO,
            size: 16,
            color: COLOR_HEADER,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "CP 45670, Tlajomulco de Zúñiga, Jalisco. Tel. (33) 30 40 99 37 ext. 937",
            font: FUENTE_CUERPO,
            size: 16,
            color: COLOR_HEADER,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "www.cutlajomulco.udg.mx",
            font: FUENTE_CUERPO,
            size: 16,
            color: COLOR_HEADER,
          }),
          new TextRun({
            text: "          Página ",
            font: FUENTE_CUERPO,
            size: 16,
            color: COLOR_HEADER,
          }),
          new TextRun({ children: [PageNumber.CURRENT], font: FUENTE_CUERPO, size: 16 }),
          new TextRun({
            text: " de ",
            font: FUENTE_CUERPO,
            size: 16,
            color: COLOR_HEADER,
          }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE_CUERPO, size: 16 }),
        ],
      }),
    ],
  });
}

// ----------------------------------------------------------------
// Helpers de párrafos
// ----------------------------------------------------------------
type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function p(opts: {
  text?: string;
  children?: TextRun[];
  align?: AlignmentValue;
  bold?: boolean;
  size?: number;
  before?: number;
  after?: number;
  indent?: number;
  shadingHex?: string;
}): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60, line: 276 },
    indent: opts.indent ? { left: convertMillimetersToTwip(opts.indent) } : undefined,
    shading: opts.shadingHex
      ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shadingHex }
      : undefined,
    children:
      opts.children ??
      [
        new TextRun({
          text: opts.text ?? "",
          font: FUENTE_CUERPO,
          size: opts.size ?? 22,
          bold: opts.bold,
          color: COLOR_NEGRO,
        }),
      ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [
      new TextRun({ text, font: FUENTE_CUERPO, size: 22, color: COLOR_NEGRO }),
    ],
  });
}

function numerado(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "lista-obligaciones", level: 0 },
    spacing: { before: 40, after: 40, line: 276 },
    children: [
      new TextRun({ text, font: FUENTE_CUERPO, size: 22, color: COLOR_NEGRO }),
    ],
  });
}

// ----------------------------------------------------------------
// Secciones
// ----------------------------------------------------------------
function buildOficioYFecha(datos: DatosActa): Paragraph[] {
  return [
    p({
      align: AlignmentType.RIGHT,
      before: 100,
      children: [
        new TextRun({
          text: `Oficio No. ${datos.numero_oficio}`,
          font: FUENTE_CUERPO,
          size: 22,
          bold: true,
          color: COLOR_NEGRO,
        }),
      ],
    }),
    p({
      align: AlignmentType.RIGHT,
      before: 60,
      after: 200,
      text: `Tlajomulco de Zúñiga, Jalisco, a ${datos.fecha_emision_larga}.`,
    }),
  ];
}

function buildDestinatario(datos: DatosActa): Paragraph[] {
  const ip = datos.ip;
  return [
    p({
      align: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `${ip.titulo} ${ip.nombre_completo.toUpperCase()}`,
          font: FUENTE_CUERPO,
          size: 22,
          bold: true,
          color: COLOR_NEGRO,
        }),
      ],
    }),
    p({
      align: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `INVESTIGADOR PRINCIPAL — CÓDIGO ${ip.codigo_udg}`,
          font: FUENTE_CUERPO,
          size: 22,
          bold: true,
          color: COLOR_NEGRO,
        }),
      ],
    }),
    p({
      align: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: ip.adscripcion.toUpperCase(),
          font: FUENTE_CUERPO,
          size: 22,
          bold: true,
          color: COLOR_NEGRO,
        }),
      ],
    }),
    p({
      align: AlignmentType.LEFT,
      after: 200,
      children: [
        new TextRun({
          text: "P R E S E N T E:",
          font: FUENTE_CUERPO,
          size: 22,
          bold: true,
          color: COLOR_NEGRO,
        }),
      ],
    }),
  ];
}

function buildAsunto(datos: DatosActa): Paragraph[] {
  return [
    p({
      align: AlignmentType.LEFT,
      indent: 80,
      after: 200,
      children: [
        new TextRun({
          text: `Asunto: Dictamen del protocolo de investigación con clave ${datos.protocolo.clave}.`,
          font: FUENTE_CUERPO,
          size: 22,
          color: COLOR_NEGRO,
        }),
      ],
    }),
  ];
}

function buildAntecedente(datos: DatosActa): Paragraph[] {
  return [
    p({
      text:
        `Por medio del presente, hago de su conocimiento que el Comité de Ética en Investigación en Ciencias de la Salud (CEICS) del Centro Universitario de Tlajomulco, adscrito a la División de Salud, en sesión ${datos.sesion.tipo} celebrada el ${datos.sesion.fecha_larga}, procedió a la revisión y evaluación ética, metodológica y normativa del protocolo de investigación referido al rubro.`,
      after: 160,
    }),
  ];
}

function buildIdentificacion(datos: DatosActa): Paragraph[] {
  const prot = datos.protocolo;
  const ip = datos.ip;
  const linea = (etq: string, valor: string) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 20, after: 20, line: 276 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: COLOR_GRIS_CLARO },
      children: [
        new TextRun({
          text: etq,
          bold: true,
          font: FUENTE_CUERPO,
          size: 22,
          color: COLOR_NEGRO,
        }),
        new TextRun({
          text: valor,
          font: FUENTE_CUERPO,
          size: 22,
          color: COLOR_NEGRO,
        }),
      ],
    });

  return [
    linea("Título del protocolo: ", `«${prot.titulo}»`),
    linea(
      "Investigador Principal: ",
      `${ip.titulo} ${ip.nombre_completo} (Código UDG ${ip.codigo_udg})`,
    ),
    linea("Adscripción: ", ip.adscripcion),
    linea(
      "Tipo de investigación: ",
      `${prot.tipo_investigacion} (${prot.clasificacion_riesgo})`,
    ),
    linea("Área de conocimiento (SECIHTI): ", prot.area_conocimiento),
    linea("Clave interna del protocolo: ", prot.clave),
    linea("Fecha de sometimiento: ", prot.fecha_sometimiento_larga),
    linea("Fecha de sesión de evaluación: ", datos.sesion.fecha_larga),
  ];
}

function buildMarcoNormativo(datos: DatosActa): Paragraph[] {
  return [
    p({
      before: 200,
      text: "Para la emisión del presente dictamen, este Comité evaluó el protocolo a la luz del siguiente marco normativo nacional e internacional:",
    }),
    ...datos.marco_normativo.map((m) => bullet(m)),
    p({
      before: 120,
      text:
        "Tras la deliberación correspondiente, este Comité considera que el protocolo cumple con los principios bioéticos de autonomía, beneficencia, no maleficencia y justicia, y se apega al marco normativo nacional e internacional vigente en materia de investigación para la salud.",
    }),
  ];
}

function buildResolucion(datos: DatosActa): Paragraph[] {
  const res = datos.resolucion;
  const out: Paragraph[] = [
    p({
      before: 200,
      text: "Por lo anteriormente expuesto, este H. Comité de Ética en Investigación en Ciencias de la Salud emite el siguiente dictamen:",
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 12, color: COLOR_VERDE },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_VERDE },
        left: { style: BorderStyle.SINGLE, size: 12, color: COLOR_VERDE },
        right: { style: BorderStyle.SINGLE, size: 12, color: COLOR_VERDE },
      },
      children: [
        new TextRun({
          text: `PROTOCOLO ${res.estado}`,
          bold: true,
          size: 28,
          font: FUENTE_CUERPO,
          color: COLOR_VERDE,
        }),
      ],
    }),
  ];

  if (res.tiene_observaciones && res.observaciones.length > 0) {
    out.push(
      p({
        before: 200,
        bold: true,
        text: "Observaciones que el Investigador Principal deberá atender:",
      }),
      ...res.observaciones.map((o) => bullet(o)),
    );
  }

  out.push(
    p({
      before: 200,
      children: [
        new TextRun({
          text: "VIGENCIA. ",
          bold: true,
          font: FUENTE_CUERPO,
          size: 22,
          color: COLOR_NEGRO,
        }),
        new TextRun({
          text: `El presente dictamen tiene una vigencia de ${res.vigencia_meses} meses a partir de la fecha de emisión, es decir, hasta el ${res.fecha_vencimiento_larga}. Para su renovación, el Investigador Principal deberá presentar un informe de seguimiento al menos 30 días naturales antes de la fecha de vencimiento.`,
          font: FUENTE_CUERPO,
          size: 22,
          color: COLOR_NEGRO,
        }),
      ],
    }),
    p({
      before: 200,
      bold: true,
      text: "OBLIGACIONES DEL INVESTIGADOR PRINCIPAL:",
    }),
    numerado(
      "Iniciar el estudio únicamente después de contar con todas las autorizaciones administrativas y, cuando aplique, el registro ante COFEPRIS.",
    ),
    numerado("Conducir la investigación en estricto apego al protocolo aprobado."),
    numerado(
      "Notificar al CEICS, en un plazo no mayor a 15 días hábiles, cualquier enmienda al protocolo, cambio en el equipo de investigación o desviación significativa.",
    ),
    numerado(
      "Reportar eventos adversos serios en un plazo no mayor a 24 horas y eventos adversos no serios en el informe periódico.",
    ),
    numerado(
      "Presentar un informe anual de avances dentro de los 30 días previos a la fecha de aniversario de la aprobación.",
    ),
    numerado(
      "Presentar el informe final dentro de los 60 días posteriores a la conclusión del estudio.",
    ),
    numerado(
      "Resguardar los expedientes y datos del estudio por un periodo mínimo de 5 años posteriores a su conclusión.",
    ),
    numerado(
      "Garantizar la confidencialidad de los participantes conforme a la LGPDPPSO y demás normatividad aplicable.",
    ),
  );

  return out;
}

function buildTablaVotacion(datos: DatosActa): Table {
  const v = datos.votacion;
  const fila = (etq: string, val: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [p({ text: etq, before: 20, after: 20 })],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [p({ text: val, before: 20, after: 20, align: AlignmentType.CENTER })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      fila("Miembros presentes (quórum)", `${v.presentes} de ${v.total_miembros}`),
      fila("Votos a favor", String(v.favor)),
      fila("Votos en contra", String(v.contra)),
      fila("Abstenciones (por conflicto de interés)", String(v.abstencion)),
    ],
  });
}

function buildFirma(datos: DatosActa): Paragraph[] {
  const pres = datos.presidente;
  return [
    p({
      before: 300,
      align: AlignmentType.CENTER,
      bold: true,
      text: "A T E N T A M E N T E",
    }),
    p({ align: AlignmentType.CENTER, text: "“Piensa y Trabaja”", before: 20, after: 20 }),
    p({
      align: AlignmentType.CENTER,
      before: 20,
      after: 20,
      text: "“Año del Centenario de la Constitución Política del Estado Libre y Soberano de Jalisco”",
    }),
    p({
      align: AlignmentType.CENTER,
      before: 20,
      after: 240,
      text: `Tlajomulco de Zúñiga, Jalisco, a ${datos.fecha_emision_larga}.`,
    }),
    p({
      align: AlignmentType.CENTER,
      before: 360,
      after: 0,
      text: "_________________________________________",
    }),
    p({
      align: AlignmentType.CENTER,
      bold: true,
      before: 20,
      after: 0,
      text: `${pres.titulo} ${pres.nombre}`,
    }),
    p({
      align: AlignmentType.CENTER,
      text: "Presidente del Comité de Ética en Investigación",
      before: 0,
      after: 0,
    }),
    p({
      align: AlignmentType.CENTER,
      text: "en Ciencias de la Salud (CEICS)",
      before: 0,
      after: 0,
    }),
    p({
      align: AlignmentType.CENTER,
      text: "Centro Universitario de Tlajomulco — Universidad de Guadalajara",
      before: 0,
      after: 0,
    }),
    p({
      align: AlignmentType.CENTER,
      text: `Código UDG: ${pres.codigo_udg}`,
      before: 0,
      after: 200,
    }),
  ];
}

function buildTablaMiembros(datos: DatosActa): Table {
  const header = new TableRow({
    tableHeader: true,
    height: { value: 400, rule: HeightRule.ATLEAST },
    children: [
      "#",
      "Cargo",
      "Nombre",
      "Voto",
    ].map(
      (t) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: COLOR_VERDE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: t,
                  bold: true,
                  color: "FFFFFF",
                  font: FUENTE_CUERPO,
                  size: 22,
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const filas = datos.votacion.miembros.map(
    (m: MiembroActa, i: number) =>
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: String(i + 1), font: FUENTE_CUERPO, size: 22 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: m.cargo, font: FUENTE_CUERPO, size: 22 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: m.nombre, font: FUENTE_CUERPO, size: 22 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: m.voto + (m.voto === "Abstención" ? " *" : ""),
                    font: FUENTE_CUERPO,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...filas],
  });
}

function buildFolio(datos: DatosActa, qrBuffer: Buffer): Paragraph[] {
  return [
    p({
      before: 240,
      text:
        "* Conforme al Reglamento Interno del CEICS, los miembros que declararon conflicto de interés se abstuvieron de deliberar y votar respecto al presente protocolo.",
      size: 18,
    }),
    p({
      before: 240,
      align: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: qrBuffer,
          transformation: { width: 120, height: 120 },
          type: "png",
        }),
      ],
    }),
    p({
      align: AlignmentType.CENTER,
      text: `Folio digital de verificación: ${datos.folio.hash}`,
      size: 18,
    }),
    p({
      align: AlignmentType.CENTER,
      text: datos.folio.url_verificacion,
      size: 18,
    }),
  ];
}

// ----------------------------------------------------------------
// API pública
// ----------------------------------------------------------------
export async function generarActaDocx(datos: DatosActa): Promise<Buffer> {
  const escudoPath = path.join(process.cwd(), "public", "escudo-udg.jpg");
  const escudoBuffer = await fs.readFile(escudoPath);

  const qrDataUrl = await QRCode.toDataURL(datos.folio.url_verificacion, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(qrBase64, "base64");

  const doc = new Document({
    creator: "Plataforma CEICS-CUTLAJO",
    title: `Acta ${datos.numero_oficio}`,
    description: `Acta de aprobación del protocolo ${datos.protocolo.clave}`,
    numbering: {
      config: [
        {
          reference: "lista-obligaciones",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(215.9),
              height: convertMillimetersToTwip(279.4),
            },
            margin: {
              top: convertMillimetersToTwip(45),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25.4),
              right: convertMillimetersToTwip(25.4),
              header: convertMillimetersToTwip(8),
              footer: convertMillimetersToTwip(8),
            },
          },
        },
        headers: { default: buildHeader(escudoBuffer) },
        footers: { default: buildFooter() },
        children: [
          ...buildOficioYFecha(datos),
          ...buildDestinatario(datos),
          ...buildAsunto(datos),
          ...buildAntecedente(datos),
          ...buildIdentificacion(datos),
          ...buildMarcoNormativo(datos),
          ...buildResolucion(datos),
          p({ before: 240, bold: true, text: "RESUMEN DE VOTACIÓN" }),
          buildTablaVotacion(datos),
          ...buildFirma(datos),
          p({
            before: 240,
            bold: true,
            text: "MIEMBROS DEL COMITÉ QUE PARTICIPARON EN LA SESIÓN",
          }),
          buildTablaMiembros(datos),
          ...buildFolio(datos, qrBuffer),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
