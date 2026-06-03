/**
 * Semáforo de urgencia: punto de color por días desde el sometimiento.
 *
 * Componente server-safe (sin "use client"): solo lee fechas y pinta una
 * píldora. No renderiza nada salvo en estados pendientes del comité
 * ('en_evaluacion_ia', 'en_revision_comite', 'listo_dictamen').
 */
import {
  diaDesdeSometimiento,
  nivelSemaforo,
  type NivelSemaforo,
} from "@/lib/protocolos/semaforo";

const ETIQUETA_NIVEL: Record<NivelSemaforo, string> = {
  verde: "en plazo",
  amarillo: "por vencer",
  rojo: "atrasado",
};

const BG_NIVEL: Record<NivelSemaforo, string> = {
  verde: "bg-semaforo-verde",
  amarillo: "bg-semaforo-amarillo",
  rojo: "bg-semaforo-rojo",
};

export function SemaforoSometimiento({
  submittedAt,
  estado,
}: {
  submittedAt: string | null;
  estado: string;
}) {
  const nivel = nivelSemaforo(submittedAt, estado);
  if (!nivel) return null;

  const dia = diaDesdeSometimiento(submittedAt);
  const title = `Día ${dia} · ${ETIQUETA_NIVEL[nivel]}`;

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-block size-2.5 shrink-0 rounded-full ${BG_NIVEL[nivel]}`}
    />
  );
}
