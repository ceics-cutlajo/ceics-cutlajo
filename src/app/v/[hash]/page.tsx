import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { fechaLargaDesdeIsoOFallback } from "@/lib/actas/formatos";

export const metadata: Metadata = {
  title: "Verificación de folio · CEICS CUTLAJO",
  description:
    "Verificación pública de actas oficiales emitidas por el Comité de Ética en Investigación en Ciencias de la Salud, División Salud, CUTlajomulco, Universidad de Guadalajara.",
  robots: { index: false, follow: false },
};

// 16 chars: generarHashFolio en lib/actas/formatos.ts trunca el SHA-256 a 16 hex.
const HASH_REGEX = /^[a-f0-9]{16}$/i;

const UDG_NAVY = "#202945";
const UDG_RED = "#B12028";

type Resolucion = "aprobado" | "aprobado_con_observaciones" | "no_aprobado";

const ETIQUETA_RES: Record<Resolucion, string> = {
  aprobado: "APROBADO",
  aprobado_con_observaciones: "APROBADO CON OBSERVACIONES MENORES",
  no_aprobado: "NO APROBADO",
};

const COLOR_RES: Record<Resolucion, string> = {
  aprobado: "text-ok",
  aprobado_con_observaciones: "text-warn",
  no_aprobado: "text-bad",
};

type ActaPublica = {
  numero_oficio: string;
  fecha_emision: string;
  resolucion: Resolucion;
  vigencia_meses: number;
  fecha_vencimiento: string | null;
  hash_folio: string;
  protocolo: { clave: string } | null;
};

async function obtenerActaPorHash(hash: string): Promise<ActaPublica | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("actas")
    .select(
      "numero_oficio, fecha_emision, resolucion, vigencia_meses, fecha_vencimiento, hash_folio, protocolo:protocolos(clave)",
    )
    .eq("hash_folio", hash)
    .maybeSingle();
  if (!data) return null;
  const protocolo = Array.isArray(data.protocolo) ? data.protocolo[0] : data.protocolo;
  return {
    numero_oficio: data.numero_oficio,
    fecha_emision: data.fecha_emision,
    resolucion: data.resolucion as Resolucion,
    vigencia_meses: data.vigencia_meses,
    fecha_vencimiento: data.fecha_vencimiento,
    hash_folio: data.hash_folio,
    protocolo: protocolo ? { clave: protocolo.clave } : null,
  };
}

export default async function VerificacionFolioPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const hashNormalizado = hash.trim().toLowerCase();
  const acta = HASH_REGEX.test(hashNormalizado)
    ? await obtenerActaPorHash(hashNormalizado)
    : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 sm:px-8">
        <HeaderInstitucional />

        <main className="mt-10 flex-1">
          <TituloPagina />
          <div className="mt-6">
            {acta ? <ActaVerificada acta={acta} /> : <FolioNoEncontrado hash={hash} />}
          </div>
        </main>

        <footer className="mt-12 border-t border-ink-200 pt-6 text-center text-xs text-ink-500">
          <p>
            Plataforma del CEICS ·{" "}
            <Link
              href="https://ceics-cutlajo.com"
              className="font-medium hover:underline"
              style={{ color: UDG_NAVY }}
            >
              ceics-cutlajo.com
            </Link>
          </p>
          <p className="mt-2 max-w-xl mx-auto">
            Esta página confirma la autenticidad de un folio emitido por el CEICS. El contenido
            íntegro del acta solo está disponible para el investigador principal y los miembros
            del comité.
          </p>
        </footer>
      </div>
    </div>
  );
}

function HeaderInstitucional() {
  return (
    <header className="flex items-center gap-5 border-b border-ink-200 pb-6">
      <Image
        src="/udeg-logo-color.png"
        alt="Escudo Universidad de Guadalajara"
        width={1594}
        height={2056}
        className="h-20 w-auto object-contain"
        priority
      />
      <div className="leading-snug">
        <p
          className="font-display text-base font-bold tracking-wide"
          style={{ color: UDG_NAVY }}
        >
          UNIVERSIDAD DE GUADALAJARA
        </p>
        <p className="text-xs italic text-ink-500">
          Red Universitaria e Institución Benemérita de Jalisco
        </p>
        <div className="mt-2 border-t border-ink-150 pt-2">
          <p className="text-sm font-semibold text-ink-800">
            Centro Universitario de Tlajomulco · División Salud
          </p>
          <p className="text-sm text-ink-600">
            Comité de Ética en Investigación en Ciencias de la Salud (CEICS)
          </p>
        </div>
      </div>
    </header>
  );
}

function TituloPagina() {
  return (
    <div className="flex items-stretch gap-3">
      <span aria-hidden className="w-1 rounded-sm" style={{ backgroundColor: UDG_RED }} />
      <div>
        <p className="text-eyebrow text-ink-500">Sistema de verificación de folios</p>
        <h1
          className="font-display text-2xl font-bold leading-tight sm:text-3xl"
          style={{ color: UDG_NAVY }}
        >
          Verificación de acta de dictamen
        </h1>
      </div>
    </div>
  );
}

function ActaVerificada({ acta }: { acta: ActaPublica }) {
  return (
    <section className="rounded-xl border border-ok/40 bg-ok-soft/30 p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-ok" aria-hidden />
        <p className="text-eyebrow text-ok">Folio verificado</p>
      </div>

      <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl" style={{ color: UDG_NAVY }}>
        Oficio{" "}
        <span className="font-mono text-base font-semibold sm:text-lg">{acta.numero_oficio}</span>
      </h2>

      <p className="mt-2 text-sm text-ink-600">
        Este folio fue emitido por el CEICS · CUTlajomulco · UDG y consta en el registro oficial
        del comité.
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Dato label="Fecha de emisión" valor={fechaLargaDesdeIsoOFallback(acta.fecha_emision)} />
        <Dato
          label="Resolución"
          valor={
            <span className={`font-semibold ${COLOR_RES[acta.resolucion]}`}>
              {ETIQUETA_RES[acta.resolucion]}
            </span>
          }
        />
        <Dato label="Vigencia" valor={`${acta.vigencia_meses} meses`} />
        <Dato
          label="Fecha de vencimiento"
          valor={fechaLargaDesdeIsoOFallback(acta.fecha_vencimiento)}
        />
        <Dato
          label="Clave del protocolo"
          valor={<span className="font-mono">{acta.protocolo?.clave ?? "—"}</span>}
        />
        <Dato
          label="Folio digital (SHA-256)"
          valor={<span className="break-all font-mono text-xs">{acta.hash_folio}</span>}
        />
      </dl>
    </section>
  );
}

function FolioNoEncontrado({ hash }: { hash: string }) {
  return (
    <section className="rounded-xl border border-bad/30 bg-bad-soft/40 p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-bad" aria-hidden />
        <p className="text-eyebrow text-bad">Folio no encontrado</p>
      </div>

      <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl" style={{ color: UDG_NAVY }}>
        No se encontró este folio en el padrón del CEICS
      </h2>

      <p className="mt-3 text-sm text-ink-600">
        El folio consultado no corresponde a un acta oficial vigente emitida por el Comité de
        Ética en Investigación en Ciencias de la Salud. Verifica que la liga del código QR sea
        correcta. Si recibiste este folio en un oficio impreso y crees que debería estar
        registrado, contacta al CEICS.
      </p>

      <p className="mt-4 break-all rounded-md bg-ink-100 px-3 py-2 font-mono text-xs text-ink-600">
        {hash || "—"}
      </p>
    </section>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-eyebrow text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink-800">{valor}</dd>
    </div>
  );
}
