/**
 * Directorio de integrantes del CEICS para la sección pública interna "Comité".
 *
 * Fuente: CVs institucionales (SECIHTI / formato propio) de cada miembro,
 * resumidos a una reseña breve. NO incluye datos sensibles (CURP, RFC,
 * domicilio, teléfono): solo identidad académica y líneas de trabajo.
 *
 * Las fotos viven en `public/comite/`. Los miembros sin foto/CV entregado
 * se muestran con avatar de iniciales (campo `foto` en null).
 */

export type RolComite = "presidente" | "secretario" | "vocal";

export type IntegranteComite = {
  nombre: string;
  rolComite: RolComite;
  cargoTitulo: string;
  /** Ruta a la foto en /public, o null para usar avatar de iniciales. */
  foto: string | null;
  resena: string;
  orcid: string | null;
};

export const ETIQUETA_ROL_COMITE: Record<RolComite, string> = {
  presidente: "Presidente",
  secretario: "Secretaria",
  vocal: "Vocal",
};

/** Orden jerárquico: Presidencia → Secretaría → Vocales. */
export const INTEGRANTES_COMITE: IntegranteComite[] = [
  {
    nombre: "Dr. Jaime Briseño Ramírez",
    rolComite: "presidente",
    cargoTitulo: "Profesor e Investigador Titular A · UdeG",
    foto: "/comite/jaime-briseno.jpg",
    resena:
      "Médico especialista en Medicina Interna (Universidad de Guadalajara) e Infectología (Instituto Nacional de Ciencias Médicas y Nutrición “Salvador Zubirán”, UNAM). Profesor e Investigador Titular A en la UdeG y actualmente Director del Hospital Civil de Oriente. Sus líneas de investigación incluyen enfermedades infecciosas emergentes y reemergentes, vigilancia epidemiológica molecular, infecciones nosocomiales, resistencia antimicrobiana y la atención del paciente crítico, con publicaciones en revistas indexadas Q1–Q2.",
    orcid: "0009-0006-1901-392X",
  },
  {
    nombre: "Mtra. Anayeli de Jesús Patiño Laguna",
    rolComite: "secretario",
    cargoTitulo: "Maestra en Farmacología · Docente CUTLAJO, ITESO y UAL",
    foto: "/comite/anayeli-patino.jpg",
    resena:
      "Licenciada en Nutrición y Maestra en Farmacología por la Universidad de Guadalajara, con estudios de Doctorado en Farmacología (créditos terminados) en la misma casa de estudios. Secretaria del CEICS y docente en el Centro Universitario de Tlajomulco, el ITESO y la Universidad América Latina. Su línea de investigación son las enfermedades metabólicas (nutrición y endocrinología); es miembro de la Sociedad Jalisciense de Endocrinología y Nutrición, la Sociedad Mexicana de Endocrinología y Nutrición y la Sociedad de Anestesiología, con publicaciones en revistas como Revista Médica de Chile y Vitamin and Nutrition Research, y participación en congresos de la ADA y la EASD.",
    orcid: "0000-0002-2754-2542",
  },
  {
    nombre: "Dra. Judith Carolina De Arcos Jiménez",
    rolComite: "vocal",
    cargoTitulo: "Profesora Investigadora de tiempo completo · CUTlajomulco, UdeG",
    foto: "/comite/judith-dearcos.png",
    resena:
      "Química Farmacobióloga (UdeG) y Doctora en Ciencias en Biología Molecular en Medicina. Profesora Investigadora de tiempo completo en el Centro Universitario de Tlajomulco y Responsable del Área de Biología Molecular del Laboratorio Estatal de Salud Pública de Jalisco. Investiga en vigilancia epidemiológica molecular, resistencia antimicrobiana mediante secuenciación de genoma completo, inmunopatología y biomarcadores moleculares. Fundadora del laboratorio LADIMMB y del observatorio GeoHealth Oriente, con autorías en revistas Q1–Q2.",
    orcid: "0000-0003-0251-6425",
  },
  {
    nombre: "Dr. Óscar Francisco Fernández Díaz",
    rolComite: "vocal",
    cargoTitulo: "Profesor Asociado B · CUTLAJO, UdeG",
    foto: "/comite/oscar-fernandez.png",
    resena:
      "Médico Cirujano (UdeG) con especialidades en Cirugía General y Cirugía Endocrina (INCMNSZ, UNAM) y subespecialidad en Cirugía Plástica y Reconstructiva. Maestro en Ciencias en Microcirugía Reconstructiva por la Queen Mary University of London, con fellowships del Royal College of Surgeons de Inglaterra. Cirujano plástico certificado enfocado en reconstrucción microquirúrgica, con participación activa en investigación internacional (ICOPLAST).",
    orcid: "0000-0003-4698-5063",
  },
  {
    nombre: "Dra. Ana Cecilia Méndez Magaña",
    rolComite: "vocal",
    cargoTitulo: "Profesora · CUCS, UdeG",
    foto: "/comite/cecilia-mendez.png",
    resena:
      "Médica Cirujana y Partera con Doctorado en Ciencias de la Salud Pública (UdeG). Profesora en el Centro Universitario de Ciencias de la Salud adscrita al Departamento de Salud Pública; imparte en pregrado y posgrado (Epidemiología, Medicina Familiar y Salud Pública). Desarrolla investigación en la UdeG y el IMSS, e integra el Colegio Jalisciense de Salud Pública, la Asociación Médica de Jalisco y la Sociedad Mexicana de Salud Pública, con experiencia previa en comités de ética.",
    orcid: "0000-0002-4682-131X",
  },
  {
    nombre: "Dra. Nancy Evelyn Navarro Ruiz",
    rolComite: "vocal",
    cargoTitulo: "Profesora · CUTlajomulco, UdeG",
    foto: "/comite/nancy-navarro.png",
    resena:
      "Licenciada en Enfermería y Doctora en Ciencias de la Salud Pública (UdeG, CUCS). Profesora en el Centro Universitario de Tlajomulco y candidata al Sistema Nacional de Investigadoras e Investigadores (nivel Candidato, Área III). Co-dirige la Entidad Colaboradora “Centro Mexicano de Salud Basada en Evidencia (JBI)” en el CUTLAJO, con experiencia como Coordinadora de Ensayos Clínicos y vocal de comité de ética e investigación.",
    orcid: "0000-0002-2910-5557",
  },
  {
    nombre: "Dra. Ruth Rodríguez Montaño",
    rolComite: "vocal",
    cargoTitulo: "Profesora de Asignatura B · CUTLAJO, UdeG",
    foto: "/comite/ruth-rodriguez.jpg",
    resena:
      "Cirujana Dentista y Doctora en Ciencias Biomédicas con orientación en Inmunología por la Universidad de Guadalajara, con nivel Candidata del Sistema Nacional de Investigadoras e Investigadores (SNII). Profesora de Asignatura B en el Centro Universitario de Tlajomulco —primera odontóloga docente del campus, donde apoyó la apertura de la Licenciatura en Cirujano Dentista—; imparte Inmunología médica, Histología, Microbiología, Metodología de la Investigación y Estadística, entre otras. Su línea de trabajo es la inmunología de las enfermedades orales y su relación con padecimientos sistémicos; ha dirigido tesis de licenciatura, especialidad y maestría y participado en 33 congresos nacionales e internacionales.",
    orcid: "0000-0002-0712-0334",
  },
  {
    nombre: "Dr. José Manuel Pérez Casillas",
    rolComite: "vocal",
    cargoTitulo: "Profesor de Asignatura · CUTLAJO, UdeG",
    foto: "/comite/jose-perez.jpg",
    resena:
      "Doctor en Ciencias de la Nutrición y Dietética con formación transdisciplinaria: Maestría en Nutrición Humana, Maestría en Actividad Física y Estilo de Vida, especialidad en Rehabilitación Cardiovascular (Universidad de La Plata, Argentina) y Licenciatura en Terapia Física y Rehabilitación, además de la certificación “Exercise is Medicine” del American College of Sports Medicine. Profesor de Asignatura en el Departamento de Vida Saludable y Promoción de la Salud del Centro Universitario de Tlajomulco y coordinador de Radiología en la Unidad de Urgencias Médicas del Valle (Dirección de Salud Pública de Tlajomulco); preside la Asociación Jalisciense de Fisioterapia y Rehabilitación. Sus líneas de investigación son los efectos moleculares del ejercicio, la obesidad y el riesgo cardiometabólico, y el estilo de vida y salud.",
    orcid: "0009-0005-6300-664X",
  },
];

/** Iniciales para el avatar de respaldo cuando no hay foto. */
export function inicialesIntegrante(nombre: string): string {
  // Quita prefijos académicos (Dr., Dra., Mtra., etc.) antes de inicializar.
  const limpio = nombre.replace(/^(Dr\.|Dra\.|Mtra\.|Mtro\.|Lic\.)\s+/i, "");
  const partes = limpio.split(/\s+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes[1]?.[0] ?? "";
  return (primera + segunda).toLocaleUpperCase("es-MX");
}
