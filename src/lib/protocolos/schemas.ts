/**
 * Schemas Zod para el formulario multi-paso de sometimiento de protocolos.
 *
 * El wizard tiene 4 pasos:
 *   1. Datos básicos del proyecto (título, resumen, área, tipo, flags)
 *   2. Co-investigadores
 *   3. Documentos (los 7 requeridos por el CEICS)
 *   4. Revisión y envío
 *
 * Cada paso tiene su propio schema. El borrador se guarda parcialmente
 * y solo el schema "envio" exige todos los campos completos.
 */
import { z } from "zod";

// ---------------- Paso 1: Datos básicos ----------------

export const datosBasicosSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(20, "El título debe tener al menos 20 caracteres")
    .max(300, "El título no debe exceder 300 caracteres"),
  resumen: z
    .string()
    .trim()
    .min(100, "El resumen debe tener al menos 100 caracteres (≈ 1 párrafo)")
    .max(3000, "El resumen no debe exceder 3000 caracteres"),
  area_conocimiento_id: z.coerce
    .number()
    .int()
    .min(1)
    .max(9, "Selecciona un área de conocimiento válida"),
  tipo_investigacion_id: z.enum([
    "basica",
    "aplicada",
    "tecnologico",
    "innovacion",
    "humanistica",
    "clinica",
  ]),
  clasificacion_riesgo: z.enum(["sin_riesgo", "riesgo_minimo", "riesgo_mayor_minimo"]),
  involucra_humanos: z.boolean(),
  involucra_menores: z.boolean(),
  involucra_datos_geneticos: z.boolean(),
  involucra_medicamento: z.boolean(),
});

export type DatosBasicosInput = z.infer<typeof datosBasicosSchema>;

// ---------------- Paso 2: Detalles clínicos ----------------

export const datosClinicosSchema = z.object({
  objetivo_general: z
    .string()
    .trim()
    .min(30, "El objetivo general debe tener al menos 30 caracteres")
    .max(2000),
  objetivos_especificos: z
    .array(z.string().trim().min(5).max(1500, "Cada objetivo específico no debe exceder 1500 caracteres"))
    .min(1, "Agrega al menos un objetivo específico")
    .max(15),
  criterios_inclusion: z
    .array(z.string().trim().min(3).max(1000, "Cada criterio de inclusión no debe exceder 1000 caracteres"))
    .min(1, "Agrega al menos un criterio de inclusión")
    .max(20),
  criterios_exclusion: z
    .array(z.string().trim().min(3).max(1000, "Cada criterio de exclusión no debe exceder 1000 caracteres"))
    .min(1, "Agrega al menos un criterio de exclusión")
    .max(20),
  metodologia: z
    .string()
    .trim()
    .min(50, "La metodología debe tener al menos 50 caracteres")
    .max(5000),
  cronograma: z
    .array(
      z.object({
        etapa: z.string().trim().min(2).max(200),
        inicio: z.string().optional(),
        fin: z.string().optional(),
      }),
    )
    .max(20),
});

export type DatosClinicosInput = z.infer<typeof datosClinicosSchema>;

// ---------------- Paso 2: Co-investigador ----------------

export const coInvestigadorSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido"),
  apellido_paterno: z.string().trim().min(2, "Apellido paterno requerido"),
  apellido_materno: z.string().trim().optional().or(z.literal("")),
  adscripcion: z
    .string()
    .trim()
    .min(2, "Adscripción institucional requerida")
    .max(200),
  email: z
    .string()
    .trim()
    .email("Correo no válido")
    .optional()
    .or(z.literal("")),
});

export type CoInvestigadorInput = z.infer<typeof coInvestigadorSchema>;

// ---------------- Paso 3: Documento ----------------

export const TIPOS_DOCUMENTO = [
  "carta_presidente",
  "formato_protocolo",
  "delegacion",
  "cv_ip",
  "bpc",
  "consentimiento",
  "asentimiento",
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const documentoUploadSchema = z.object({
  tipo_documento_id: z.enum(TIPOS_DOCUMENTO),
  nombre_original: z.string().min(1),
  mime_type: z.string().min(1),
  tamano_bytes: z.number().int().positive().max(25 * 1024 * 1024, "Máximo 25 MB por archivo"),
});

export type DocumentoUploadInput = z.infer<typeof documentoUploadSchema>;

// ---------------- Etiquetas para UI ----------------

export const ETIQUETAS_AREA: Record<number, string> = {
  1: "Ciencias Físico-Matemáticas y de la Tierra",
  2: "Biología y Química",
  3: "Medicina y Ciencias de la Salud",
  4: "Conducta y Educación",
  5: "Humanidades",
  6: "Ciencias Sociales",
  7: "Biotecnología y Cs. Agropecuarias",
  8: "Ingenierías y Desarrollo Tecnológico",
  9: "Interdisciplinaria",
};

export const ETIQUETAS_TIPO_INV: Record<DatosBasicosInput["tipo_investigacion_id"], string> = {
  basica: "Ciencia básica y de frontera",
  aplicada: "Ciencia aplicada",
  tecnologico: "Desarrollo tecnológico",
  innovacion: "Innovación",
  humanistica: "Investigación humanística",
  clinica: "Investigación clínica",
};

export const ETIQUETAS_RIESGO: Record<DatosBasicosInput["clasificacion_riesgo"], string> = {
  sin_riesgo: "Investigación sin riesgo",
  riesgo_minimo: "Riesgo mínimo",
  riesgo_mayor_minimo: "Riesgo mayor al mínimo",
};

export const DESCRIPCION_RIESGO: Record<DatosBasicosInput["clasificacion_riesgo"], string> = {
  sin_riesgo:
    "Investigación documental, encuestas, entrevistas, sin intervención biológica, psicológica o social.",
  riesgo_minimo:
    "Procedimientos comunes (pesar, EKG, exámenes de rutina, dosis usuales sin efectos adversos).",
  riesgo_mayor_minimo:
    "Probabilidad de afectar al sujeto: estudios con medicamentos, procedimientos invasivos.",
};

export const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  carta_presidente: "Carta dirigida al Presidente del CEICS",
  formato_protocolo: "Formato de protocolo CEICS",
  delegacion: "Carta de delegación de responsabilidades",
  cv_ip: "CV resumido del Investigador Principal (máx. 5 páginas)",
  bpc: "Constancia de Buenas Prácticas Clínicas",
  consentimiento: "Carta de consentimiento informado",
  asentimiento: "Carta de asentimiento (población pediátrica)",
};

export const DESCRIPCION_DOCUMENTO: Record<TipoDocumento, string> = {
  carta_presidente:
    "Solicitud formal de evaluación. Debe explicar motivos del estudio y solicitar dictamen del CEICS.",
  formato_protocolo:
    "Protocolo completo siguiendo el formato CEICS (28 secciones: introducción, objetivos, metodología, etc.).",
  delegacion:
    "Carta firmada por el IP donde delega las 15 actividades del estudio entre los miembros del equipo.",
  cv_ip: "Currículum vitae resumido del IP, máximo 5 cuartillas, sin documentos probatorios anexos.",
  bpc:
    "Constancia vigente de Buenas Prácticas Clínicas. Obligatorio para investigación clínica con humanos.",
  consentimiento:
    "Modelo del consentimiento informado que firmarán los participantes. Obligatorio si involucra humanos.",
  asentimiento:
    "Asentimiento adaptado a menores de edad. Obligatorio si la población incluye personas <18 años.",
};

/** Devuelve qué documentos son obligatorios según las características del protocolo. */
export function documentosObligatorios(flags: {
  tipo_investigacion_id: string;
  involucra_humanos: boolean;
  involucra_menores: boolean;
}): TipoDocumento[] {
  const obligatorios: TipoDocumento[] = [
    "carta_presidente",
    "formato_protocolo",
    "delegacion",
    "cv_ip",
  ];
  if (flags.tipo_investigacion_id === "clinica") obligatorios.push("bpc");
  if (flags.involucra_humanos) obligatorios.push("consentimiento");
  if (flags.involucra_menores) obligatorios.push("asentimiento");
  return obligatorios;
}
