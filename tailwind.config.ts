import type { Config } from "tailwindcss";

/**
 * Configuración Tailwind con tokens de identidad CUTLAJO
 * Basado en docs MEMORIA.md sección 2 + Manual de identidad CUTLAJO
 */
export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Marca CUTLAJO
        brand: {
          magenta: "#ed1e77",
          "magenta-deep": "#680538",
          green: "#006838",
          "green-bright": "#21b572",
          blue: "#38a5c6",
          teal: "#054f56",
        },
        // Neutros cálidos
        ink: {
          0: "#ffffff",
          50: "#fafaf9",
          100: "#f4f4f2",
          150: "#ecebe8",
          200: "#e2e1dd",
          300: "#c9c8c3",
          400: "#9b9a96",
          500: "#6b6a66",
          600: "#4a4946",
          700: "#2e2d2b",
          800: "#1c1b1a",
          900: "#0e0d0c",
        },
        // Semánticos
        accent: {
          DEFAULT: "var(--accent, #ed1e77)",
          deep: "var(--accent-deep, #680538)",
        },
        ok: { DEFAULT: "#006838", soft: "#e7f3ec" },
        warn: { DEFAULT: "#c47600", soft: "#faf0dc" },
        bad: { DEFAULT: "#b3261e", soft: "#fbe9e7" },
        info: { DEFAULT: "#38a5c6", soft: "#e3f3f8" },
        // Semáforo de urgencia por días desde el sometimiento.
        semaforo: { verde: "#88A87C", amarillo: "#CFCFA1", rojo: "#870C0C" },
        // Sidebar (siempre oscuro)
        side: {
          bg: "#0f0e0d",
          fg: "#f4f4f2",
          muted: "#8a8985",
          hover: "#1c1b1a",
          active: "#2a2826",
        },
      },
      fontFamily: {
        // Display: serif slab institucional para titulares y secciones.
        display: ["var(--font-roboto-slab)", "Georgia", "serif"],
        // Body: humanist sans para texto corrido.
        body: ["var(--font-barlow)", "Inter", "system-ui", "sans-serif"],
        // Sans-only (sin caer a serif), para chips/badges/etiquetas pequeñas
        // donde el slab se vería pesado.
        sans: ["var(--font-barlow)", "Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-1": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-2": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        eyebrow: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.08em", fontWeight: "600" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(14,13,12,0.04), 0 0 0 1px rgba(14,13,12,0.04)",
        md: "0 4px 16px rgba(14,13,12,0.06), 0 0 0 1px rgba(14,13,12,0.05)",
        lg: "0 12px 40px rgba(14,13,12,0.10), 0 0 0 1px rgba(14,13,12,0.05)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(10px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
      },
    },
  },
  plugins: [],
} satisfies Config;
