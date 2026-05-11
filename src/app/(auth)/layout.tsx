import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-xl bg-white shadow-lg lg:grid-cols-2">
          {/* Panel izquierdo: branding */}
          <div className="hidden flex-col justify-between bg-side-bg p-10 text-white lg:flex">
            <Logo variant="dark" />
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-semibold leading-tight">
                Comité de Ética en Investigación
                <br />
                en Ciencias de la Salud
              </h2>
              <p className="text-side-muted">
                División Salud · Centro Universitario de Tlajomulco
                <br />
                Universidad de Guadalajara
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-side-muted">
              <div className="h-1 w-12 rounded-full bg-[var(--accent)]" />
              <span>Acceso institucional protegido</span>
            </div>
          </div>

          {/* Panel derecho: formulario */}
          <div className="p-8 sm:p-10 lg:p-12">{children}</div>
        </div>
      </div>
    </div>
  );
}
