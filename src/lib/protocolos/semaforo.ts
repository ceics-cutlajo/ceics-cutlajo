/**
 * Semáforo de urgencia por días desde el sometimiento.
 *
 * FUENTE ÚNICA DE VERDAD del conteo de días: tanto el semáforo de la UI como
 * el cron de recordatorios deben importar `diaDesdeSometimiento` de aquí para
 * no desfasarse.
 *
 * CONVENCIÓN (idéntica en todo el código):
 * - El día del sometimiento = "día 1".
 *   diaActual = floor((hoy − fechaSometimiento) en días naturales) + 1.
 * - DÍAS NATURALES (calendario, incluye fines de semana).
 * - Zona horaria de Jalisco: `submitted_at` (timestamp UTC) se convierte a su
 *   fecha en Jalisco (YYYY-MM-DD) y se resta contra `hoyEnJalisco()`, anclando
 *   ambas fechas a mediodía UTC para evitar desfases de día por husos horarios.
 * - El reloj se reinicia por ronda: `submitted_at` se sobrescribe en cada
 *   reenvío, así que ya cuenta desde el último envío sin nada especial.
 */
import { hoyEnJalisco } from "@/lib/calendario/formato";

const TZ = "America/Mexico_City";

/** Fecha (YYYY-MM-DD) en Jalisco de un timestamp UTC ISO. */
function fechaJaliscoDe(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoUtc));
}

/** Días naturales (>= 0) entre dos fechas "YYYY-MM-DD": `hasta` − `desde`. */
function diasNaturalesEntre(desde: string, hasta: string): number {
  const [ay, am, ad] = desde.split("-").map(Number);
  const [by, bm, bd] = hasta.split("-").map(Number);
  // Anclado a mediodía UTC: inmune a DST y a desfases de día.
  const a = Date.UTC(ay, am - 1, ad, 12);
  const b = Date.UTC(by, bm - 1, bd, 12);
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Día actual (1-based) desde el sometimiento, en días naturales y hora de
 * Jalisco. El día del envío es el día 1. Devuelve -1 si `submittedAt` es null.
 *
 * La importa también el cron de recordatorios: es la fuente única del conteo.
 */
export function diaDesdeSometimiento(submittedAt: string | null): number {
  if (!submittedAt) return -1;
  const fechaSometimiento = fechaJaliscoDe(submittedAt);
  const hoy = hoyEnJalisco();
  return diasNaturalesEntre(fechaSometimiento, hoy) + 1;
}

export type NivelSemaforo = "verde" | "amarillo" | "rojo";

/**
 * Estados pendientes del comité en los que aplica el semáforo. Se excluyen
 * 'observaciones' (la pelota está en el investigador) y los estados finales.
 */
const ESTADOS_CON_SEMAFORO = new Set([
  "en_evaluacion_ia",
  "en_revision_comite",
  "listo_dictamen",
]);

/**
 * Nivel del semáforo según el día actual, o `null` si el estado no es un
 * estado pendiente del comité (o si no hay fecha de sometimiento).
 * Verde 1–5 · amarillo 6–10 · rojo 11+.
 */
export function nivelSemaforo(
  submittedAt: string | null,
  estado: string,
): NivelSemaforo | null {
  if (!ESTADOS_CON_SEMAFORO.has(estado)) return null;
  const dia = diaDesdeSometimiento(submittedAt);
  if (dia < 1) return null;
  if (dia <= 5) return "verde";
  if (dia <= 10) return "amarillo";
  return "rojo";
}
