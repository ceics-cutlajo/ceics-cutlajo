/**
 * Carga y agrupa el checklist maestro de 100 ítems.
 *
 * Fuente de verdad: `NORMATIVIDAD/04_CHECKLIST_MAESTRO.json` en la raíz del
 * proyecto (fuera de app/). Este archivo es una copia que viaja con el bundle
 * de Vercel para que las route handlers puedan leerla. Si actualizas el
 * checklist en la fuente, ejecuta también la copia (manual por ahora).
 */
import rawChecklist from "./checklist.json";

export const CATEGORIAS = [
  "identificacion",
  "estructura_cientifica",
  "metodologia",
  "riesgo_beneficio",
  "consentimiento",
  "poblaciones_vulnerables",
  "confidencialidad_datos",
  "productos_salud",
  "gobernanza_cei",
  "transparencia_publicacion",
  "aspectos_economicos",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ETIQUETAS_CATEGORIA: Record<Categoria, string> = {
  identificacion: "Identificación",
  estructura_cientifica: "Estructura científica",
  metodologia: "Metodología",
  riesgo_beneficio: "Riesgo-beneficio",
  consentimiento: "Consentimiento informado",
  poblaciones_vulnerables: "Poblaciones vulnerables",
  confidencialidad_datos: "Confidencialidad y datos",
  productos_salud: "Productos de salud",
  gobernanza_cei: "Gobernanza del CEI",
  transparencia_publicacion: "Transparencia y publicación",
  aspectos_economicos: "Aspectos económicos",
};

export type Severidad = "critica" | "alta" | "media" | "baja";

export type ChecklistItem = {
  id: string;
  categoria: Categoria;
  subcategoria?: string;
  criterio: string;
  evidencia_esperada: string;
  fuentes?: { ref: string; url: string }[];
  severidad: Severidad;
  peso: number;
  aplicabilidad: {
    tipo_investigacion: string[];
    involucra_humanos: boolean | "cualquiera";
    involucra_menores: boolean | "cualquiera";
    involucra_datos_geneticos: boolean | "cualquiera";
  };
  seccion_protocolo: number;
  ai_prompt_hint: string;
};

type RawChecklist = {
  items: ChecklistItem[];
};

const checklist = rawChecklist as unknown as RawChecklist;

/**
 * Ítems del checklist que son responsabilidad del CEI evaluador, NO del
 * investigador. La IA no debe penalizar al protocolo por su ausencia: esa
 * información ni siquiera debería estar en el documento del investigador.
 *
 * El bloque "gobernanza_cei" mantiene los ítems restantes (CHK-087, 089, 090)
 * que sí tocan al investigador (entrega de informes parciales/finales,
 * cumplimiento de procedimientos del CEI durante seguimiento).
 */
export const ITEMS_RESPONSABILIDAD_COMITE = new Set([
  "CHK-080", // Registro CONBIOETICA del CEI
  "CHK-081", // Composición del CEI (≥7 miembros)
  "CHK-082", // Independencia operativa/financiera del CEI
  "CHK-083", // POEs del CEI
  "CHK-084", // COI de miembros del CEI
  "CHK-085", // Quorum/decisiones del CEI
  "CHK-086", // Capacitación anual de miembros del CEI
  "CHK-088", // Notificación de dictámenes del CEI al investigador
]);

export function obtenerTodosLosItems(): ChecklistItem[] {
  return checklist.items;
}

export function agruparPorCategoria(): Record<Categoria, ChecklistItem[]> {
  const grupos: Record<Categoria, ChecklistItem[]> = {
    identificacion: [],
    estructura_cientifica: [],
    metodologia: [],
    riesgo_beneficio: [],
    consentimiento: [],
    poblaciones_vulnerables: [],
    productos_salud: [],
    confidencialidad_datos: [],
    gobernanza_cei: [],
    transparencia_publicacion: [],
    aspectos_economicos: [],
  };
  for (const item of checklist.items) {
    if (CATEGORIAS.includes(item.categoria)) {
      grupos[item.categoria].push(item);
    }
  }
  return grupos;
}

/**
 * Filtra ítems según las características declaradas del protocolo. Reduce
 * el ruido enviado al modelo y evita falsos no-cumple por ítems no aplicables.
 */
export function filtrarPorAplicabilidad(
  items: ChecklistItem[],
  caracteristicas: {
    tipo_investigacion: string | null;
    involucra_humanos: boolean;
    involucra_menores: boolean;
    involucra_datos_geneticos: boolean;
  },
): ChecklistItem[] {
  return items.filter((item) => {
    // Excluir ítems de responsabilidad del CEI — el protocolo del investigador
    // no debe ser penalizado por ausencia de información que el CEI debe proveer.
    if (ITEMS_RESPONSABILIDAD_COMITE.has(item.id)) return false;

    const a = item.aplicabilidad;
    if (
      caracteristicas.tipo_investigacion &&
      Array.isArray(a.tipo_investigacion) &&
      a.tipo_investigacion.length > 0 &&
      !a.tipo_investigacion.includes(caracteristicas.tipo_investigacion)
    ) {
      return false;
    }
    if (
      typeof a.involucra_humanos === "boolean" &&
      a.involucra_humanos !== caracteristicas.involucra_humanos
    ) {
      return false;
    }
    if (
      typeof a.involucra_menores === "boolean" &&
      a.involucra_menores !== caracteristicas.involucra_menores
    ) {
      return false;
    }
    if (
      typeof a.involucra_datos_geneticos === "boolean" &&
      a.involucra_datos_geneticos !== caracteristicas.involucra_datos_geneticos
    ) {
      return false;
    }
    return true;
  });
}
