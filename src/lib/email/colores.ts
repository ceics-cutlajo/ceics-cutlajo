/**
 * Paleta institucional para correos HTML (estilos inline, sin Tailwind).
 * Sincronizada con docs/design.md — minimalismo institucional UDG:
 * encabezado vino con texto blanco, paneles con tinte navy, semánticos fríos.
 */
export const EMAIL_COLORES = {
  fondo: "#f4f5f8", // fondo de página (gris frío)
  encabezado: "#90303a", // banda de header (vino; blanco encima 7.9:1)
  eyebrow: "#e3c3c8", // eyebrow sobre vino
  franja: "#701d14", // franja de acento bajo el header / bordes de énfasis
  cta: "#90303a", // botones de acción
  enlace: "#701d14", // links en texto
  texto: "#1b2029",
  textoSuave: "#646c7c",
  panelFondo: "#edf1f8", // paneles informativos (tinte navy)
  panelBorde: "#27334F", // borde de paneles / botón Meet
  bordeSuave: "#dde1e8",
  footerFondo: "#f1f3f6",
  exito: "#1a6b42",
  exitoSoft: "#e7f2ec",
  advertencia: "#8a5c0a",
  advertenciaSoft: "#fbf3dd",
  error: "#a61e12",
  errorSoft: "#fbeae8",
} as const;
