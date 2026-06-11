/**
 * PageHeader institucional — estilo barra de título de Transparencia UDG.
 *
 * Bloque sólido de color con texto blanco + franja de acento inferior
 * (ver docs/design.md §5.1). Variantes: "red" (vino, default) para áreas
 * generales y "navy" para presidencia/dictamen. Se aceptan los nombres
 * antiguos "magenta" y "teal" como alias para no romper call sites.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  variant = "red",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Tono de la banda. "magenta" y "teal" son alias legados de red/navy. */
  variant?: "red" | "navy" | "magenta" | "teal";
}) {
  const tone = variant === "teal" ? "navy" : variant === "magenta" ? "red" : variant;
  const bg = tone === "navy" ? "bg-navy-700" : "bg-brand-wine";
  const accent = tone === "navy" ? "bg-navy-500" : "bg-brand-red";

  return (
    <header className="overflow-hidden rounded-md">
      <div className={`${bg} px-6 py-5 sm:px-8 sm:py-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && (
              <p className="text-eyebrow uppercase tracking-widest text-white/80">
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
      </div>
      <div className={`h-1 w-full ${accent}`} />
    </header>
  );
}
