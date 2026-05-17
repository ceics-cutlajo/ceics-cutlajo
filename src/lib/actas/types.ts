/**
 * Tipos del módulo de actas (sesión 9b).
 *
 * `DatosActa` es la estructura que necesitan los generadores DOCX y PDF para
 * renderizar el acta institucional. Refleja en TS el esquema JSON definido
 * en `docs/06_PLANTILLA_ACTA_ESQUEMA.json`.
 */

export type ResolucionActa =
  | "APROBADO"
  | "APROBADO CON OBSERVACIONES MENORES"
  | "CONDICIONADO A MODIFICACIONES MAYORES"
  | "NO APROBADO";

export type VotoActa = "A favor" | "En contra" | "Abstención";

export type CargoActa = "Presidente" | "Secretaria" | "Secretario" | "Vocal";

export type RolFirmante = "presidente" | "comite_secretario";

export type FirmanteActa = {
  titulo: string;
  nombre: string;
  codigo_udg: string;
  rol: RolFirmante;
  /** Cargo corto bajo la firma (Presidente / Secretaria / Secretario). */
  cargo: "Presidente" | "Secretaria" | "Secretario";
  /** Cargo extendido institucional (multiple lineas), para impresión bajo la firma. */
  cargo_lineas: string[];
  /** Si el firmante actuó por delegación (Secretaria firmando ante COI del Presidente). */
  por_delegacion: boolean;
  /** Si por_delegacion, nombre del Presidente titular para nota institucional. */
  presidente_titular_nombre?: string;
};

export type TipoSesionActa = "ordinaria" | "extraordinaria";

export type MiembroActa = {
  cargo: CargoActa;
  nombre: string;
  codigo_udg: string;
  voto: VotoActa;
  motivo_abstencion?: string;
};

export type DatosActa = {
  numero_oficio: string;
  anio_oficio: number;
  consecutivo_oficio: string;
  fecha_emision_iso: string;
  fecha_emision_larga: string;
  ip: {
    titulo: string;
    nombre_completo: string;
    codigo_udg: string;
    adscripcion: string;
    correo?: string;
  };
  protocolo: {
    clave: string;
    titulo: string;
    tipo_investigacion: string;
    clasificacion_riesgo: string;
    area_conocimiento: string;
    fecha_sometimiento: string;
    fecha_sometimiento_larga: string;
  };
  sesion: {
    tipo: TipoSesionActa;
    numero: number;
    fecha_iso: string;
    fecha_larga: string;
  };
  resolucion: {
    estado: ResolucionActa;
    tiene_observaciones: boolean;
    observaciones: string[];
    vigencia_meses: 6 | 12 | 24;
    fecha_vencimiento_larga: string;
  };
  marco_normativo: string[];
  votacion: {
    total_miembros: number;
    presentes: number;
    favor: number;
    contra: number;
    abstencion: number;
    miembros: MiembroActa[];
  };
  presidente: {
    titulo: string;
    nombre: string;
    codigo_udg: string;
  };
  firmante: FirmanteActa;
  folio: {
    hash: string;
    url_verificacion: string;
  };
};
