/**
 * Chevron decorativo CUTLAJO: pico triangular con texturas opcionales.
 * Componente puramente visual (sin estado). Pensado para usarse como acento
 * gráfico en headers, side strips, secciones de tarjetas, etc.
 *
 * Variantes de relleno (`variant`):
 *  - "solid"   — relleno plano del color brand
 *  - "hatched" — líneas oblicuas (45°)
 *  - "hex"     — patrón hexagonal sutil (eco de panales del manual)
 *  - "dot"     — patrón de puntos
 *
 * Colores (`tone`): magenta-deep (#680538) por defecto, magenta, green,
 * green-bright, blue, teal.
 *
 * Direcciones (`direction`): right (default), left, up, down.
 */

type Tone =
  | "magenta-deep"
  | "magenta"
  | "green"
  | "green-bright"
  | "blue"
  | "teal";

type Variant = "solid" | "hatched" | "hex" | "dot";

type Direction = "right" | "left" | "up" | "down";

const TONE_HEX: Record<Tone, string> = {
  "magenta-deep": "#680538",
  magenta: "#ed1e77",
  green: "#006838",
  "green-bright": "#21b572",
  blue: "#38a5c6",
  teal: "#054f56",
};

const ROTATIONS: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

export function Chevron({
  tone = "magenta-deep",
  variant = "solid",
  direction = "right",
  size = 48,
  className = "",
}: {
  tone?: Tone;
  variant?: Variant;
  direction?: Direction;
  size?: number;
  className?: string;
}) {
  const color = TONE_HEX[tone];
  const rotate = ROTATIONS[direction];
  const patternId = `chev-${variant}-${tone}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="presentation"
      aria-hidden="true"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <defs>
        {variant === "hatched" && (
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill={color} />
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          </pattern>
        )}
        {variant === "hex" && (
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="14"
            height="12.124"
          >
            <rect width="14" height="12.124" fill={color} />
            <path
              d="M 7 0 L 14 3.5 L 14 9 L 7 12.5 L 0 9 L 0 3.5 Z"
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
            />
          </pattern>
        )}
        {variant === "dot" && (
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
          >
            <rect width="8" height="8" fill={color} />
            <circle cx="4" cy="4" r="1.2" fill="rgba(255,255,255,0.28)" />
          </pattern>
        )}
      </defs>
      <polygon
        points="0,0 100,50 0,100"
        fill={variant === "solid" ? color : `url(#${patternId})`}
      />
    </svg>
  );
}

/**
 * Banda horizontal de chevrons consecutivos. Útil como separador decorativo
 * o como acento al inicio de secciones.
 */
export function ChevronStrip({
  tone = "magenta-deep",
  variant = "solid",
  count = 6,
  size = 24,
  className = "",
}: {
  tone?: Tone;
  variant?: Variant;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Chevron key={i} tone={tone} variant={variant} size={size} />
      ))}
    </div>
  );
}
