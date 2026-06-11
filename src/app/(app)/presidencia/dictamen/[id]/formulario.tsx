"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { emitirDictamenAction } from "@/lib/actas/actions";

type Resolucion =
  | "APROBADO"
  | "APROBADO CON OBSERVACIONES MENORES"
  | "CONDICIONADO A MODIFICACIONES MAYORES"
  | "NO APROBADO";

const VIGENCIAS = [6, 12, 24] as const;

export function FormularioDictamen({
  protocoloId,
  resolucionPrerellenada,
  opcionesResolucion,
  claveProtocolo,
  ipNombre,
}: {
  protocoloId: string;
  resolucionPrerellenada: Resolucion;
  opcionesResolucion: readonly Resolucion[];
  claveProtocolo: string;
  ipNombre: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolucion, setResolucion] = useState<Resolucion>(
    resolucionPrerellenada,
  );
  const [vigenciaMeses, setVigenciaMeses] = useState<6 | 12 | 24>(12);
  const [sesionTipo, setSesionTipo] = useState<"ordinaria" | "extraordinaria">(
    "ordinaria",
  );
  const [sesionNumero, setSesionNumero] = useState<number>(1);
  const [observacionesTexto, setObservacionesTexto] = useState<string>("");
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iaPending, setIaPending] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  const [iaNota, setIaNota] = useState<string | null>(null);

  async function handleGenerarBorradorIA() {
    setIaError(null);
    setIaNota(null);
    setIaPending(true);
    try {
      const resp = await fetch("/api/ia/resumen-observaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocoloId }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        setIaError(
          json?.message ?? "No se pudo generar el borrador. Intenta de nuevo.",
        );
        return;
      }
      const generadas: string[] = json.observaciones ?? [];
      if (generadas.length === 0) {
        setIaNota(
          json?.nota_sintesis ??
            "La IA no encontró observaciones que sintetizar a partir de los comentarios del comité.",
        );
        return;
      }
      const nuevo = generadas.join("\n");
      // Preserva lo que el Presidente ya hubiera escrito: añade debajo.
      setObservacionesTexto((prev) =>
        prev.trim().length > 0 ? `${prev.trim()}\n${nuevo}` : nuevo,
      );
      setIaNota(
        json?.nota_sintesis ??
          `Se generaron ${generadas.length} observaciones a partir de los comentarios del comité. Revísalas y edítalas antes de emitir.`,
      );
    } catch {
      setIaError("Error de red al generar el borrador. Intenta de nuevo.");
    } finally {
      setIaPending(false);
    }
  }

  const requiereObservaciones =
    resolucion === "APROBADO CON OBSERVACIONES MENORES" ||
    resolucion === "CONDICIONADO A MODIFICACIONES MAYORES";

  const observaciones = observacionesTexto
    .split("\n")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  const observacionesValidas = !requiereObservaciones || observaciones.length > 0;

  function handleEmitir() {
    setError(null);
    if (!observacionesValidas) {
      setError("Esta resolución requiere al menos una observación que el IP deba atender.");
      return;
    }
    startTransition(async () => {
      const r = await emitirDictamenAction({
        protocoloId,
        resolucion,
        vigenciaMeses,
        sesionTipo,
        sesionNumero,
        observaciones,
      });
      if (r.ok && r.data) {
        const adv = r.data.advertencia
          ? `&advertencia=${encodeURIComponent(r.data.advertencia)}`
          : "";
        router.push(
          `/comite/protocolo/${protocoloId}?emitida=${r.data.numeroOficio}${adv}`,
        );
        router.refresh();
      } else if (!r.ok) {
        setError(r.error);
        setConfirmar(false);
      }
    });
  }

  return (
    <section className="card p-6 space-y-6">
      <header>
        <h2 className="text-display-2">Emitir acta oficial</h2>
        <p className="mt-2 text-sm text-ink-600">
          Ajusta lo que sea necesario antes de emitir el dictamen del protocolo{" "}
          <strong>{claveProtocolo}</strong> para {ipNombre}. Una vez emitida, el
          acta queda registrada con número de oficio único y se envía por correo
          al investigador con DOCX y PDF adjuntos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="text-eyebrow text-ink-500">Resolución</label>
          <div className="mt-2 space-y-2">
            {opcionesResolucion.map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition ${
                  resolucion === opt
                    ? "border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-ink-200 bg-bg-1 hover:border-ink-300"
                }`}
              >
                <input
                  type="radio"
                  name="resolucion"
                  value={opt}
                  checked={resolucion === opt}
                  onChange={() => setResolucion(opt)}
                  className="mt-1"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-eyebrow text-ink-500">
              Vigencia del dictamen
            </label>
            <div className="mt-2 flex gap-2">
              {VIGENCIAS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVigenciaMeses(v)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    vigenciaMeses === v
                      ? "bg-[var(--accent)] text-white"
                      : "bg-bg-2 text-ink-700 hover:bg-bg-3"
                  }`}
                >
                  {v} meses
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-eyebrow text-ink-500">Tipo de sesión</label>
            <div className="mt-2 flex gap-2">
              {(["ordinaria", "extraordinaria"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSesionTipo(s)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    sesionTipo === s
                      ? "bg-[var(--accent)] text-white"
                      : "bg-bg-2 text-ink-700 hover:bg-bg-3"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="sesionNumero"
              className="text-eyebrow text-ink-500"
            >
              Número de sesión del año
            </label>
            <input
              id="sesionNumero"
              type="number"
              min={1}
              max={99}
              value={sesionNumero}
              onChange={(e) =>
                setSesionNumero(Math.max(1, parseInt(e.target.value || "1", 10)))
              }
              className="mt-2 w-24 rounded-md border border-ink-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="observaciones"
          className="text-eyebrow text-ink-500 flex items-center gap-2"
        >
          Observaciones
          {requiereObservaciones && (
            <span className="text-warn text-xs font-medium">
              · obligatorias para esta resolución
            </span>
          )}
        </label>
        <p className="mt-1 text-xs text-ink-500">
          Una observación por línea. Cada una debe tener al menos 10 caracteres.
        </p>

        <div className="mt-3 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-ink-600">
              ✨ La IA puede redactar un borrador sintetizando los comentarios
              que el comité dejó al votar. Tú lo revisas y editas antes de emitir.
            </p>
            <button
              type="button"
              onClick={handleGenerarBorradorIA}
              disabled={iaPending || pending}
              className="btn-secondary shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {iaPending ? "Generando…" : "Generar borrador con IA"}
            </button>
          </div>
          {iaNota && (
            <p className="mt-2 text-xs leading-relaxed text-ink-600">{iaNota}</p>
          )}
          {iaError && (
            <p className="mt-2 text-xs leading-relaxed text-bad">{iaError}</p>
          )}
        </div>

        <textarea
          id="observaciones"
          value={observacionesTexto}
          onChange={(e) => setObservacionesTexto(e.target.value)}
          rows={6}
          placeholder="Ejemplo:&#10;Aclarar el cálculo del tamaño muestral en la sección 5.2.&#10;Agregar criterios de exclusión específicos para pacientes pediátricos."
          className="mt-2 w-full rounded-md border border-ink-200 px-3 py-2 text-sm font-mono"
        />
        {observaciones.length > 0 && (
          <p className="mt-1 text-xs text-ink-500">
            {observaciones.length}{" "}
            {observaciones.length === 1 ? "observación" : "observaciones"}{" "}
            detectada{observaciones.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-bad/30 bg-bad-soft/40 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <footer className="border-t border-ink-200 pt-6">
        {!confirmar ? (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            disabled={!observacionesValidas || pending}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revisar y emitir
          </button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-warn/30 bg-warn-soft/40 p-4 text-sm">
              <p className="font-medium text-ink-900">
                ¿Confirmas la emisión del acta?
              </p>
              <p className="mt-2 leading-relaxed text-ink-700">
                Se asignará un número de oficio único, se generará el DOCX y
                PDF, y se enviará al IP por correo con los archivos adjuntos.
                Esta acción <strong>no se puede deshacer</strong>; el acta queda
                inmutable conforme al Reglamento Interno del CEICS.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-700">
                <li>
                  Resolución: <strong>{resolucion}</strong>
                </li>
                <li>Vigencia: {vigenciaMeses} meses</li>
                <li>
                  Sesión {sesionTipo} N° {sesionNumero}
                </li>
                {observaciones.length > 0 && (
                  <li>Incluye {observaciones.length} observaciones para el IP</li>
                )}
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleEmitir}
                disabled={pending}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Emitiendo…" : "Sí, emitir acta"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                disabled={pending}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </footer>
    </section>
  );
}
