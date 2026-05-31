/**
 * Helpers de fecha/hora del calendario. Todo se interpreta en hora local de
 * Jalisco (America/Mexico_City, UTC-6 fijo). Para evitar desfases de día, las
 * fechas YYYY-MM-DD se anclan a mediodía UTC antes de formatear.
 */

const TZ = "America/Mexico_City";

/** Fecha de hoy en Jalisco como "YYYY-MM-DD". */
export function hoyEnJalisco(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Suma `n` días a una fecha "YYYY-MM-DD" y devuelve "YYYY-MM-DD". */
export function sumarDiasIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

/** "miércoles 3 de junio de 2026" a partir de "YYYY-MM-DD". */
export function fechaLargaEs(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

/** "9:00" a partir de "09:00:00" / "09:00". */
export function horaCorta(hora: string | null): string {
  if (!hora) return "";
  const [h, min] = hora.split(":");
  return `${Number(h)}:${min ?? "00"}`;
}

/** "9:00 h" o "9:00 – 10:00 h". */
export function horario(inicio: string, fin: string | null): string {
  const a = horaCorta(inicio);
  const b = fin ? horaCorta(fin) : "";
  return b ? `${a} – ${b} h` : `${a} h`;
}
