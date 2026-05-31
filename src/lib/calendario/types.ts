/**
 * Tipos del Calendario de Reuniones del CEICS.
 *
 * `SesionComite` es la fila completa (campos internos incluidos). Para los
 * investigadores se envía al cliente solo `SesionPublica` (sin enlace de
 * Meet, teléfono, PIN ni orden del día — datos internos del comité).
 */

export type Modalidad = "virtual" | "presencial" | "hibrida";

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  virtual: "Virtual",
  presencial: "Presencial",
  hibrida: "Híbrida",
};

export type SesionComite = {
  id: string;
  titulo: string;
  fecha: string; // YYYY-MM-DD (hora local Jalisco)
  hora_inicio: string; // HH:MM:SS
  hora_fin: string | null;
  modalidad: Modalidad;
  ubicacion: string | null;
  meet_link: string | null;
  meet_telefono: string | null;
  meet_pin: string | null;
  orden_del_dia: string | null;
  created_by: string | null;
  recordatorio_7d_at: string | null;
  recordatorio_1d_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Subconjunto seguro para usuarios sin acceso interno (investigadores). */
export type SesionPublica = Pick<
  SesionComite,
  "id" | "titulo" | "fecha" | "hora_inicio" | "hora_fin" | "modalidad" | "ubicacion"
>;

/** Quita los campos internos antes de enviarlos a un investigador. */
export function aSesionPublica(s: SesionComite): SesionPublica {
  return {
    id: s.id,
    titulo: s.titulo,
    fecha: s.fecha,
    hora_inicio: s.hora_inicio,
    hora_fin: s.hora_fin,
    modalidad: s.modalidad,
    ubicacion: s.ubicacion,
  };
}
