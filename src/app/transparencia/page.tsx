/**
 * Tablero público de transparencia de la votación del CEICS.
 *
 * Accesible sin iniciar sesión (ver RUTAS_PUBLICAS en el middleware). Por
 * decisión del comité muestra, por protocolo, quién votó y en qué sentido.
 * Se omite el nombre del investigador y se marca `noindex` (no aparece en
 * buscadores; accesible solo con la liga).
 */
import Link from "next/link";
import type { Metadata } from "next";
import { listarVotacionPublica } from "@/lib/evaluaciones/transparencia";
import { PanelVotacionComite } from "@/components/evaluaciones/panel-votacion-comite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transparencia de la votación · CEICS CUTLAJO",
  description:
    "Votación del Comité de Ética en Investigación en Ciencias de la Salud (CEICS) por protocolo.",
  robots: { index: false, follow: false },
};

export default async function TransparenciaPage() {
  const protocolos = await listarVotacionPublica();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-eyebrow text-ink-500">CEICS · CUTLAJO · UDG</p>
        <h1 className="mt-1 text-display-1">Transparencia de la votación</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          En apego a la transparencia, el Comité de Ética en Investigación en
          Ciencias de la Salud publica, por cada protocolo en revisión, quiénes
          de sus integrantes han votado y en qué sentido. No se publican los
          comentarios individuales ni la identidad del investigador.
        </p>
      </header>

      {protocolos.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          No hay protocolos en revisión por el momento.
        </div>
      ) : (
        <div className="space-y-4">
          {protocolos.map((p) => (
            <section key={p.id} className="card p-6">
              <div className="font-mono text-xs text-ink-500">
                {p.clave ?? "—"}
              </div>
              <h2 className="mt-1 text-sm font-medium text-ink-900">{p.titulo}</h2>
              <PanelVotacionComite
                votos={p.votos}
                className="mt-4 border-t border-ink-150 pt-4"
                titulo="Votación"
              />
            </section>
          ))}
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-ink-400">
        <Link href="/login" className="hover:underline">
          Acceso a la plataforma
        </Link>
      </footer>
    </main>
  );
}
