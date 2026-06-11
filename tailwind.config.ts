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
        // Rojos UDG Transparencia (ver docs/design.md §2.1)
        brand: {
          red: "#701d14", // ladrillo profundo (dominante, hover de acento)
          wine: "#90303a", // vino — bandas de título blanco-sobre-rojo
          brick: "#9a2c1c", // ladrillo claro (acentos)
          crimson: "#86212b", // active/pressed
          maroon: "#4a2f32", // casi neutro profundo
        },
        // Rampa azul institucional (7 tonos base + derivados 50/800/900)
        navy: {
          50: "#eff2f8",
          100: "#B0BCD8",
          200: "#92A2C9",
          300: "#7388BA",
          400: "#546EAB",
          500: "#455A8C",
          600: "#36476E",
          700: "#27334F",
          800: "#1d2740",
          900: "#141b2e",
        },
        // Neutros fríos — armonizan con navy
        ink: {
          0: "#ffffff",
          50: "#f8f9fb",
          100: "#f1f3f6",
          150: "#e8ebf0",
          200: "#dde1e8",
          300: "#c3c9d4",
          400: "#949cab",
          500: "#646c7c",
          600: "#444c5c",
          700: "#2c3340",
          800: "#1b2029",
          900: "#0e1117",
        },
        // Semánticos
        accent: {
          DEFAULT: "var(--accent, #90303a)",
          deep: "var(--accent-deep, #701d14)",
        },
        ok: { DEFAULT: "#1a6b42", soft: "#e7f2ec" },
        // Alias de ok: muchos componentes usan good-*; mismo valor.
        good: { DEFAULT: "#1a6b42", soft: "#e7f2ec" },
        warn: { DEFAULT: "#8a5c0a", soft: "#fbf3dd" },
        bad: { DEFAULT: "#a61e12", soft: "#fbeae8" },
        info: { DEFAULT: "#455A8C", soft: "#edf1f8" },
        // Semáforo de urgencia por días desde el sometimiento.
        // El amarillo #D9A514 es SOLO para puntos/dots; como texto usar warn.
        semaforo: { verde: "#1a6b42", amarillo: "#D9A514", rojo: "#a61e12" },
        // Sidebar (siempre navy)
        side: {
          bg: "#27334F",
          fg: "#f2f4f9",
          muted: "#92A2C9",
          hover: "#36476E",
          active: "#455A8C",
        },
      },
      fontFamily: {
        // Display: Barlow en pesos fuertes (minimalismo plano; sin serif).
        display: ["var(--font-barlow)", "Inter", "system-ui", "sans-serif"],
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
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        sm: "0 0 0 1px rgba(20,27,46,0.05)",
        md: "0 1px 2px rgba(20,27,46,0.06), 0 0 0 1px rgba(20,27,46,0.05)",
        lg: "0 2px 8px rgba(20,27,46,0.08), 0 0 0 1px rgba(20,27,46,0.05)",
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
