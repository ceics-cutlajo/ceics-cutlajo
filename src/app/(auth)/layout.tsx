import Image from "next/image";
import { ChevronStrip } from "@/components/visual/Chevron";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-xl bg-white shadow-lg lg:grid-cols-2">
          {/* Panel izquierdo: branding institucional UDG → CUTLAJO → CEICS */}
          <div className="relative hidden flex-col justify-between bg-side-bg p-10 text-white lg:flex">
            {/* Banda magenta superior — eco del manual institucional */}
            <div
              className="absolute inset-x-0 top-0 h-1.5 bg-brand-magenta"
              aria-hidden="true"
            />

            {/* Jerarquía 1: Universidad de Guadalajara */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-white/95 p-1.5 shadow-sm">
                  <Image
                    src="/udeg-logo-color.png"
                    alt="Universidad de Guadalajara"
                    width={84}
                    height={48}
                    priority
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-side-muted">
                    Universidad de
                  </span>
                  <span className="font-display text-base font-bold uppercase tracking-wider text-white">
                    Guadalajara
                  </span>
                </div>
              </div>

              <div className="h-px w-full bg-white/10" aria-hidden="true" />

              {/* Jerarquía 2: CUTLAJO */}
              <div>
                <Image
                  src="/logo-cutlajo.png"
                  alt="Centro Universitario de Tlajomulco"
                  width={220}
                  height={64}
                  priority
                  className="h-14 w-auto object-contain"
                />
                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-side-muted">
                  Centro Universitario de Tlajomulco · División Salud
                </p>
              </div>
            </div>

            {/* Jerarquía 3: CEICS (subordinada institucionalmente) */}
            <div className="space-y-4">
              <ChevronStrip
                tone="magenta"
                variant="hex"
                count={3}
                size={28}
                className="opacity-80"
              />
              <h2 className="font-display text-2xl font-bold leading-tight text-white">
                Comité de Ética
                <br />
                en Investigación
                <br />
                <span className="text-brand-magenta">en Ciencias de la Salud</span>
              </h2>
              <p className="text-sm leading-relaxed text-side-muted">
                Sesiones, dictámenes y seguimiento normativo del CEICS
                conforme a la Ley General de Salud, NOM-012-SSA3-2012 y
                Declaración de Helsinki.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-side-muted">
              <div className="h-1 w-10 rounded-full bg-brand-magenta" />
              <span className="uppercase tracking-widest">
                Acceso institucional protegido
              </span>
            </div>
          </div>

          {/* Panel derecho: formulario */}
          <div className="relative p-8 sm:p-10 lg:p-12">
            {/* Banda magenta superior visible solo en móvil */}
            <div
              className="absolute inset-x-0 top-0 h-1.5 bg-brand-magenta lg:hidden"
              aria-hidden="true"
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
