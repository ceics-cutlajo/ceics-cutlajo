import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import { obtenerDatosBaseActa } from "@/lib/actas/queries";
import { obtenerActaPorProtocolo } from "@/lib/actas/queries";
import {
  resolucionDesdeRecomendacion,
  RESOLUCIONES_ACTA,
} from "@/lib/actas/schemas";
import { FormularioDictamen } from "./formulario";
import { SideStrip } from "@/components/visual/SideStrip";

export const dynamic = "force-dynamic";

export default async function EmitirDictamenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await obtenerUsuarioActual();
  const esPresidente = usuario.roles.includes("presidente");
  const esSecretario = usuario.roles.includes("comite_secretario");
  if (!esPresidente && !esSecretario) {
    redirect("/dashboard");
  }

  const datos = await obtenerDatosBaseActa(id);
  if (!datos) notFound();

  const yaEmitida = await obtenerActaPorProtocolo(id);
  if (yaEmitida) {
    redirect(`/comite/protocolo/${id}`);
  }

  // Determinar si esta emisión es por delegación a Secretaría.
  const presidenteEsIP =
    datos.presidente.id === datos.protocolo.investigador_principal_id;
  const firmaPorDelegacion = esSecretario && presidenteEsIP;

  // Casos que no permitimos llegar al formulario.
  if (esPresidente && presidenteEsIP && !esSecretario) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-eyebrow text-ink-500">Presidencia · Dictamen</p>
          <h1 className="text-display-1 mt-1">Conflicto de interés</h1>
        </header>
        <div className="card border border-warn/30 bg-warn-soft/40 p-6 text-sm leading-relaxed">
          <p>
            Eres el Investigador Principal del protocolo{" "}
            <strong>{datos.protocolo.clave}</strong>. Como Presidente del CEICS no
            puedes emitir su propia acta. Conforme al Reglamento Interno, la
            emisión corresponde al(la) Secretario(a) del comité.
          </p>
          <p className="mt-3 text-ink-700">
            Cierra sesión e ingresa con la cuenta de Secretaría para emitir este
            dictamen.
          </p>
          <Link
            href={`/comite/protocolo/${id}`}
            className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            ← Volver al protocolo
          </Link>
        </div>
      </div>
    );
  }

  if (esSecretario && !esPresidente && !presidenteEsIP) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-eyebrow text-ink-500">Secretaría · Dictamen</p>
          <h1 className="text-display-1 mt-1">Emisión no autorizada</h1>
        </header>
        <div className="card border border-warn/30 bg-warn-soft/40 p-6 text-sm leading-relaxed">
          <p>
            El Presidente del CEICS no tiene conflicto de interés con el
            protocolo <strong>{datos.protocolo.clave}</strong>. La emisión del
            acta le corresponde a él(ella); la delegación a Secretaría solo
            procede ante COI presidencial.
          </p>
          <Link
            href={`/comite/protocolo/${id}`}
            className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            ← Volver al protocolo
          </Link>
        </div>
      </div>
    );
  }

  if (datos.protocolo.estado !== "listo_dictamen") {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-eyebrow text-ink-500">Presidencia · Dictamen</p>
          <h1 className="text-display-1 mt-1">Protocolo no disponible</h1>
        </header>
        <div className="card border border-warn/30 bg-warn-soft/40 p-6">
          <p className="text-sm leading-relaxed">
            El protocolo <strong>{datos.protocolo.clave}</strong> aún no está
            listo para tu dictamen. Su estado actual es{" "}
            <code className="rounded bg-bg-2 px-1.5 py-0.5 text-xs">
              {datos.protocolo.estado}
            </code>
            . El acta solo puede emitirse cuando el comité haya cerrado la votación.
          </p>
          <Link
            href={`/comite/protocolo/${id}`}
            className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            ← Volver al protocolo
          </Link>
        </div>
      </div>
    );
  }

  const resolucionPrerellenada = resolucionDesdeRecomendacion(
    datos.protocolo.recomendacion_comite,
  );

  return (
    <div className="flex gap-5">
      <SideStrip
        label={firmaPorDelegacion ? "Dictamen · Secretaría" : "Dictamen presidencial"}
        tone="teal"
      />
      <div className="flex-1 space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow text-ink-500">
            {firmaPorDelegacion
              ? "Secretaría · Emitir dictamen (delegación)"
              : "Presidencia · Emitir dictamen"}
          </p>
          <h1 className="font-display text-3xl font-bold mt-1 text-ink-900">Acta de aprobación CEICS</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Protocolo <strong>{datos.protocolo.clave}</strong> · IP{" "}
            {datos.ip.nombre_completo}. El comité cerró la votación con la
            recomendación que verás más abajo.{" "}
            {firmaPorDelegacion
              ? "Como Secretario(a) del CEICS firmas en delegación por COI presidencial; puedes ratificar la recomendación o ajustar resolución, vigencia y observaciones antes de emitir."
              : "Como Presidente puedes ratificarla o ajustar resolución, vigencia y observaciones antes de emitir."}
          </p>
        </div>
        <Link
          href={`/comite/protocolo/${id}`}
          className="btn-secondary text-xs"
        >
          ← Cancelar
        </Link>
      </header>

      {firmaPorDelegacion && (
        <div className="card border border-brand-magenta/30 bg-brand-magenta/5 p-5">
          <p className="text-eyebrow text-brand-magenta-deep">
            Delegación a Secretaría
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-800">
            El Presidente del CEICS (<strong>{datos.presidente.nombre}</strong>)
            figura como Investigador Principal del protocolo{" "}
            <strong>{datos.protocolo.clave}</strong>. Conforme al Reglamento
            Interno del comité, la emisión y firma del acta corresponde al(la)
            Secretario(a). Esa constancia quedará impresa en el acta.
          </p>
        </div>
      )}

      <section className="card p-6">
        <h2 className="text-display-2 mb-4">Resumen del protocolo</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Linea etiqueta="Título" valor={datos.protocolo.titulo} />
          <Linea
            etiqueta="Área (SECIHTI)"
            valor={datos.protocolo.area_conocimiento_nombre}
          />
          <Linea
            etiqueta="Tipo de investigación"
            valor={datos.protocolo.tipo_investigacion_nombre}
          />
          <Linea
            etiqueta="Clasificación de riesgo"
            valor={datos.protocolo.clasificacion_riesgo_etiqueta}
          />
          <Linea
            etiqueta="Investigador Principal"
            valor={`${datos.ip.titulo} ${datos.ip.nombre_completo}`}
          />
          <Linea etiqueta="Código UDG del IP" valor={datos.ip.codigo_udg} />
          <Linea
            etiqueta="Adscripción"
            valor={datos.ip.adscripcion}
            span2
          />
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="text-display-2 mb-4">Recomendación del comité</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label="Presentes" valor={`${datos.conteoVotos.presentes} / ${datos.conteoVotos.totalMiembros}`} />
          <Kpi label="A favor" valor={String(datos.conteoVotos.favor)} />
          <Kpi label="En contra" valor={String(datos.conteoVotos.contra)} />
          <Kpi
            label="Abstenciones"
            valor={String(datos.conteoVotos.abstencion)}
          />
        </div>
        <div className="mt-6">
          <p className="text-eyebrow text-ink-500">Recomendación derivada</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">
            {etiquetaRecomendacion(datos.protocolo.recomendacion_comite)}
          </p>
        </div>
        {datos.comentariosComite.length > 0 && (
          <div className="mt-6">
            <p className="text-eyebrow text-ink-500">
              Comentarios del comité ({datos.comentariosComite.length})
            </p>
            <ul className="mt-2 space-y-2">
              {datos.comentariosComite.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md bg-bg-2 px-3 py-2 text-sm leading-relaxed text-ink-700"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-eyebrow text-ink-500">
                <th className="py-2 pr-4">Cargo</th>
                <th className="py-2 pr-4">Miembro</th>
                <th className="py-2 pr-4">Voto</th>
                <th className="py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {datos.miembros.map((m) => (
                <tr key={m.usuario_id} className="border-b border-ink-100">
                  <td className="py-2 pr-4">{m.cargo}</td>
                  <td className="py-2 pr-4">{m.nombre_completo}</td>
                  <td className="py-2 pr-4">{m.voto}</td>
                  <td className="py-2 text-ink-600">
                    {m.motivo_abstencion ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <FormularioDictamen
        protocoloId={id}
        resolucionPrerellenada={resolucionPrerellenada}
        opcionesResolucion={RESOLUCIONES_ACTA}
        claveProtocolo={datos.protocolo.clave}
        ipNombre={datos.ip.nombre_completo}
      />
      </div>
    </div>
  );
}

function Linea({
  etiqueta,
  valor,
  span2,
}: {
  etiqueta: string;
  valor: string;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <dt className="text-eyebrow text-ink-500">{etiqueta}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink-800">{valor}</dd>
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-bg-2 px-4 py-3">
      <p className="text-eyebrow text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900">{valor}</p>
    </div>
  );
}

function etiquetaRecomendacion(r: string | null): string {
  switch (r) {
    case "aprobar":
      return "Aprobar";
    case "aprobar_con_observaciones":
      return "Aprobar con observaciones";
    case "no_aprobar":
      return "No aprobar (devolver con observaciones)";
    case "sin_decisivos":
      return "Sin votos decisivos";
    default:
      return "(sin recomendación registrada)";
  }
}
