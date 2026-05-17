/**
 * Utilidades de formateo del acta: fecha larga en español, folio digital,
 * marco normativo por defecto, slug del consecutivo para el path de Storage.
 */
import { createHash } from "node:crypto";

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** ISO YYYY-MM-DD → "D de mes de AAAA" (minúsculas, sin punto). */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES_ES[m - 1]} de ${y}`;
}

/**
 * Devuelve YYYY-MM-DD del día calendario en zona México (America/Mexico_City).
 *
 * Evita que actas emitidas después de las 18:00 hora México (≈ medianoche UTC)
 * salgan con la fecha del día siguiente en el oficio y en la BD.
 */
export function hoyIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Suma meses a una fecha ISO y devuelve nueva ISO. */
export function sumarMeses(isoBase: string, meses: number): string {
  const [y, m, d] = isoBase.split("-").map((n) => parseInt(n, 10));
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

/** SHA-256 truncado a 16 hex chars sobre los campos clave del acta. */
export function generarHashFolio(input: {
  numero_oficio: string;
  clave_protocolo: string;
  fecha_emision_iso: string;
  nombre_ip: string;
}): string {
  const cadena = `${input.numero_oficio}|${input.clave_protocolo}|${input.fecha_emision_iso}|${input.nombre_ip}`;
  return createHash("sha256").update(cadena).digest("hex").slice(0, 16);
}

/** Marco normativo por defecto del CEICS (ver docs/06_PLANTILLA_ACTA.md §5.3). */
export const MARCO_NORMATIVO_DEFAULT: ReadonlyArray<string> = [
  "Constitución Política de los Estados Unidos Mexicanos, Art. 4°.",
  "Ley General de Salud, Título Quinto (arts. 96–103).",
  "Reglamento de la Ley General de Salud en Materia de Investigación para la Salud (Art. 17).",
  "NOM-012-SSA3-2012, criterios para la ejecución de proyectos de investigación para la salud en seres humanos.",
  "Declaración de Helsinki (versión 2024, AMM).",
  "Pautas CIOMS-OMS 2016.",
  "Reporte Belmont (1979).",
  "Lineamientos CONBIOÉTICA para la operación de los Comités de Ética en Investigación.",
  "Estatuto General de la Universidad de Guadalajara y Código de Ética UDG.",
];

/** Path en Storage para el DOCX o PDF del acta. */
export function pathActa(
  protocoloId: string,
  numeroOficio: string,
  ext: "docx" | "pdf",
): string {
  // numeroOficio: CEICS-CUTLAJO/2026/001 → ceics-cutlajo-2026-001
  const slug = numeroOficio
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `${protocoloId}/acta-${slug}.${ext}`;
}

/** Convierte ISO date a "DD de mes de AAAA" en español. Wrapper amistoso. */
export function fechaLargaDesdeIsoOFallback(iso: string | null | undefined): string {
  if (!iso) return "(sin fecha)";
  return fechaLarga(iso.slice(0, 10));
}
