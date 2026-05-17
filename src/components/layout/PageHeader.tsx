/**
 * PageHeader institucional CUTLAJO.
 *
 * Banda principal burdeos (#680538) + franja magenta (#ed1e77) inferior +
 * acento de chevrons decorativos en la esquina derecha. Reemplaza el patrón
 * antiguo de `<header>` con eyebrow + título suelto, aplicando la identidad
 * visual del manual CUTLAJO de manera consistente a través de la plataforma.
 */
import { ChevronStrip } from "@/components/visual/Chevron";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  variant = "magenta",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /**
   * Tono de la banda. "magenta" (default) usa el burdeos institucional;
   * "teal" usa el teal oscuro CUTLAJO como acento alternativo para áreas
   * de presidencia / dictamen.
   */
  variant?: "magenta" | "teal";
}) {
  const bg = variant === "teal" ? "bg-brand-teal" : "bg-brand-magenta-deep";
  const accent =
    variant === "teal" ? "bg-brand-blue" : "bg-brand-magenta";
  const eyebrowColor =
    variant === "teal" ? "text-brand-blue" : "text-brand-magenta";
  const chevronTone = variant === "teal" ? "blue" : "magenta";

  return (
    <header className="relative overflow-hidden rounded-lg shadow-md">
      <div className={`relative ${bg} px-6 py-6 sm:px-8 sm:py-7`}>
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && (
              <p
                className={`text-eyebrow uppercase tracking-widest ${eyebrowColor}`}
              >
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        {/* Chevrons decorativos en la esquina derecha, sutiles */}
        <div
          className="pointer-events-none absolute -right-2 -top-2 hidden opacity-20 sm:block"
          aria-hidden="true"
        >
          <ChevronStrip tone={chevronTone} variant="hex" count={4} size={36} />
        </div>
      </div>
      <div className={`h-1.5 w-full ${accent}`} />
    </header>
  );
}
