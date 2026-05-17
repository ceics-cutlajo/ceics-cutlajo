import Link from "next/link";
import Image from "next/image";

/**
 * Lockup institucional CEICS · CUTLAJO.
 *
 * Variantes:
 *  - "dark"  (default) — para fondos oscuros del sidebar; usa el logo CUTLAJO
 *    en blanco/negro alto contraste.
 *  - "light" — para fondos claros (login, header de página pública); usa el
 *    logo CUTLAJO a color con los degradados característicos del manual.
 *
 * Por debajo del logo se imprime el ribete "CEICS · Ética en Investigación"
 * que ancla la identidad institucional del comité dentro del CUTLAJO sin
 * duplicar la palabra "CUTLAJO" (que ya está en el logo).
 */
export function Logo({
  variant = "dark",
  size = "default",
}: {
  variant?: "dark" | "light";
  size?: "default" | "lg";
}) {
  const src = variant === "dark" ? "/logo-cutlajo-blanco.png" : "/logo-cutlajo.png";
  const colorSub = variant === "dark" ? "text-side-muted" : "text-ink-500";
  const colorRule = variant === "dark" ? "bg-white/15" : "bg-ink-200";
  const colorEyebrow = variant === "dark" ? "text-white" : "text-brand-magenta-deep";
  const logoW = size === "lg" ? 220 : 160;
  const logoH = size === "lg" ? 64 : 46;

  return (
    <Link href="/dashboard" className="flex flex-col gap-2 no-underline">
      <Image
        src={src}
        alt="Logo CUTLAJO — Centro Universitario de Tlajomulco"
        width={logoW}
        height={logoH}
        priority
        className="h-auto w-auto object-contain"
        style={{ maxHeight: logoH, maxWidth: logoW }}
      />
      <div className="flex items-center gap-2">
        <span className={`h-px w-6 ${colorRule}`} aria-hidden="true" />
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${colorEyebrow}`}
        >
          CEICS
        </span>
        <span className={`text-[10px] ${colorSub}`}>Ética en Investigación</span>
      </div>
    </Link>
  );
}
