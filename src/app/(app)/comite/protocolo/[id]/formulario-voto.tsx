"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS, ETIQUETAS_CATEGORIA, type Categoria } from "@/lib/checklist";
import type { PreDictamen } from "@/lib/ia/schema-pre-dictamen";
import { derivarVotoGlobal } from "@/lib/evaluaciones/derivar-voto-global";
import type {
  ResultadoCumplimiento,
  TipoVoto,
  BloqueVoto,
} from "@/lib/evaluaciones/types";
import type { EvaluacionConBloques } from "@/lib/evaluaciones/queries";
import {
  registrarEvaluacionAction,
  registrarAbstencionCoiAction,
  forzarCierreAction,
} from "@/lib/evaluaciones/actions";

type Props = {
  protocoloId: string;
  preDictamen: PreDictamen | null;
  conflictoInteres: boolean;
  esPresidente: boolean;
  evaluacionPrevia: EvaluacionConBloques | null;
  progresoVotacion: { emitidos: number; total: number };
};

const ETIQUETA_RESULTADO: Record<ResultadoCumplimiento, string> = {
  cumple: "Cumple",
  parcial: "Cumple parcialmente",
  no_cumple: "No cumple",
  no_aplica: "No aplica",
};

const ETIQUETA_VOTO: Record<TipoVoto, string> = {
  aprobar: "Aprobar",
  aprobar_con_observaciones: "Aprobar con observaciones",
  no_aprobar: "No aprobar",
  abstener: "Abstener",
};

const TONO_VOTO: Record<TipoVoto, string> = {
  aprobar: "bg-good-soft text-good",
  aprobar_con_observaciones: "bg-warn-soft text-warn",
  no_aprobar: "bg-bad-soft text-bad",
  abstener: "bg-ink-100 text-ink-700",
};

const TONO_RESULTADO: Record<ResultadoCumplimiento, string> = {
  cumple: "bg-good-soft text-good",
  parcial: "bg-warn-soft text-warn",
  no_cumple: "bg-bad-soft text-bad",
  no_aplica: "bg-ink-100 text-ink-700",
};

const RESULTADO_DEFAULT: ResultadoCumplimiento = "no_aplica";

export function FormularioVoto(props: Props) {
  if (props.evaluacionPrevia) {
    return (
      <ResumenVotoEmitido
        evaluacion={props.evaluacionPrevia}
        esPresidente={props.esPresidente}
        protocoloId={props.protocoloId}
        progreso={props.progresoVotacion}
      />
    );
  }
  if (props.conflictoInteres) {
    return <FormularioAbstencionCoi protocoloId={props.protocoloId} />;
  }
  if (!props.preDictamen) {
    return (
      <section className="card p-6">
        <h2 className="text-display-2">Emitir voto</h2>
        <p className="mt-3 text-sm text-ink-500">
          Tienes que esperar a que el pre-dictamen IA termine de generarse antes
          de poder votar. La página se refresca sola cuando esté listo.
        </p>
      </section>
    );
  }
  return (
    <FormularioVotoCompleto
      protocoloId={props.protocoloId}
      preDictamen={props.preDictamen}
      esPresidente={props.esPresidente}
      progreso={props.progresoVotacion}
    />
  );
}

// ============================================================
// FormularioVotoCompleto — voto pleno por bloque
// ============================================================

type EstadoBloque = {
  resultadoIA: ResultadoCumplimiento;
  acordado: boolean;
  resultadoMiembro: ResultadoCumplimiento;
  comentario: string;
};

function FormularioVotoCompleto({
  protocoloId,
  preDictamen,
  esPresidente,
  progreso,
}: {
  protocoloId: string;
  preDictamen: PreDictamen;
  esPresidente: boolean;
  progreso: { emitidos: number; total: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [comentarioGlobal, setComentarioGlobal] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const [bloques, setBloques] = useState<Record<Categoria, EstadoBloque>>(() => {
    const inicial = {} as Record<Categoria, EstadoBloque>;
    for (const cat of CATEGORIAS) {
      const bloqueIA = preDictamen.bloques[cat];
      const resultadoIA = bloqueIA?.resultado ?? RESULTADO_DEFAULT;
      inicial[cat] = {
        resultadoIA,
        acordado: true,
        resultadoMiembro: resultadoIA,
        comentario: "",
      };
    }
    return inicial;
  });

  const bloquesArray = useMemo(
    () =>
      CATEGORIAS.map((cat) => ({
        bloque: cat,
        acordado_con_ia: bloques[cat].acordado,
        resultado: bloques[cat].acordado
          ? bloques[cat].resultadoIA
          : bloques[cat].resultadoMiembro,
        comentario:
          bloques[cat].comentario.trim().length > 0
            ? bloques[cat].comentario.trim()
            : null,
      })),
    [bloques],
  );

  const votoGlobal = useMemo(() => derivarVotoGlobal(bloquesArray), [bloquesArray]);

  const erroresValidacion = useMemo(() => {
    const errs: string[] = [];
    for (const cat of CATEGORIAS) {
      const b = bloques[cat];
      if (!b.acordado && b.comentario.trim().length < 10) {
        errs.push(
          `${ETIQUETAS_CATEGORIA[cat]}: si discrepas, el comentario debe tener al menos 10 caracteres.`,
        );
      }
    }
    return errs;
  }, [bloques]);

  function handleAcordadoChange(cat: Categoria, acordado: boolean) {
    setBloques((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        acordado,
        resultadoMiembro: acordado ? prev[cat].resultadoIA : prev[cat].resultadoMiembro,
      },
    }));
  }

  function handleResultadoChange(cat: Categoria, resultado: ResultadoCumplimiento) {
    setBloques((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], resultadoMiembro: resultado },
    }));
  }

  function handleComentarioChange(cat: Categoria, comentario: string) {
    setBloques((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], comentario },
    }));
  }

  function emitir() {
    if (erroresValidacion.length > 0) {
      setError(erroresValidacion[0]);
      setConfirmando(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await registrarEvaluacionAction({
        protocoloId,
        comentarioGlobal: comentarioGlobal.trim() || null,
        bloques: bloquesArray,
      });
      if (!res.ok) {
        setError(res.error);
        setConfirmando(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-display-2">Emitir tu voto</h2>
        <span className="text-xs text-ink-500">
          {progreso.emitidos} de {progreso.total} miembros han votado
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-700">
        Por cada uno de los 11 bloques temáticos del checklist: confirma que estás
        de acuerdo con el veredicto de la IA o discrepa indicando tu propio
        veredicto y la razón. Tu voto global se derivará automáticamente del peor
        bloque que evalúes.
      </p>

      <div className="mt-5 rounded-md border border-ink-150 bg-ink-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-eyebrow text-ink-500">Tu voto global (en vivo)</span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TONO_VOTO[votoGlobal]}`}
          >
            {ETIQUETA_VOTO[votoGlobal]}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Regla: si algún bloque es "no cumple" → no aprobar; si alguno es
          "cumple parcialmente" → aprobar con observaciones; si todos cumplen o
          no aplican → aprobar.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {CATEGORIAS.map((cat) => (
          <BloqueVotoCard
            key={cat}
            categoria={cat}
            estado={bloques[cat]}
            iaJustificacion={preDictamen.bloques[cat]?.justificacion ?? null}
            onAcordadoChange={(v) => handleAcordadoChange(cat, v)}
            onResultadoChange={(r) => handleResultadoChange(cat, r)}
            onComentarioChange={(c) => handleComentarioChange(cat, c)}
          />
        ))}
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-ink-800">
          Comentario global (opcional)
        </label>
        <textarea
          value={comentarioGlobal}
          onChange={(e) => setComentarioGlobal(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Observaciones generales que no encajan en un bloque concreto…"
          className="mt-2 block w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-ink-500">
          {comentarioGlobal.length}/2000 caracteres
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {erroresValidacion.length > 0 && (
        <div className="mt-4 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-xs text-warn">
          <strong>Faltan comentarios:</strong>
          <ul className="ml-4 mt-1 list-disc">
            {erroresValidacion.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-150 pt-5">
        <p className="max-w-md text-xs text-ink-500">
          Tu voto será <strong>inmutable</strong> una vez emitido. Revísalo bien
          antes de confirmar.
        </p>
        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={erroresValidacion.length > 0}
            className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Emitir voto
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-700">
              ¿Confirmas emitir como <strong>{ETIQUETA_VOTO[votoGlobal]}</strong>?
            </span>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pending}
              className="rounded-md border border-ink-200 px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={emitir}
              disabled={pending}
              className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Sí, confirmar"}
            </button>
          </div>
        )}
      </div>

      {esPresidente && (
        <BotonForzarCierreFooter protocoloId={protocoloId} progreso={progreso} />
      )}
    </section>
  );
}

// ============================================================
// BloqueVotoCard — un bloque del formulario
// ============================================================

function BloqueVotoCard({
  categoria,
  estado,
  iaJustificacion,
  onAcordadoChange,
  onResultadoChange,
  onComentarioChange,
}: {
  categoria: Categoria;
  estado: EstadoBloque;
  iaJustificacion: string | null;
  onAcordadoChange: (v: boolean) => void;
  onResultadoChange: (r: ResultadoCumplimiento) => void;
  onComentarioChange: (c: string) => void;
}) {
  return (
    <details className="rounded-md border border-ink-200 bg-white" open>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <strong>{ETIQUETAS_CATEGORIA[categoria]}</strong>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${TONO_RESULTADO[estado.resultadoIA]}`}
          >
            IA: {ETIQUETA_RESULTADO[estado.resultadoIA]}
          </span>
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
            estado.acordado
              ? "bg-info-soft text-info"
              : TONO_RESULTADO[estado.resultadoMiembro]
          }`}
        >
          {estado.acordado
            ? "De acuerdo con IA"
            : `Tu voto: ${ETIQUETA_RESULTADO[estado.resultadoMiembro]}`}
        </span>
      </summary>
      <div className="border-t border-ink-150 px-4 py-3 text-sm">
        {iaJustificacion && (
          <p className="mb-3 rounded-md bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-700">
            <span className="font-medium">IA: </span>
            {iaJustificacion}
          </p>
        )}

        <fieldset className="space-y-1">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`acordado-${categoria}`}
              checked={estado.acordado}
              onChange={() => onAcordadoChange(true)}
            />
            <span>Estoy de acuerdo con la evaluación de la IA</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`acordado-${categoria}`}
              checked={!estado.acordado}
              onChange={() => onAcordadoChange(false)}
            />
            <span>Discrepo, mi veredicto es distinto</span>
          </label>
        </fieldset>

        {!estado.acordado && (
          <div className="mt-3 space-y-3 rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-3">
            <div>
              <label className="block text-xs font-medium text-ink-700">
                Mi veredicto:
              </label>
              <select
                value={estado.resultadoMiembro}
                onChange={(e) =>
                  onResultadoChange(e.target.value as ResultadoCumplimiento)
                }
                className="mt-1 block w-full rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm"
              >
                <option value="cumple">Cumple</option>
                <option value="parcial">Cumple parcialmente</option>
                <option value="no_cumple">No cumple</option>
                <option value="no_aplica">No aplica</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700">
                Razón de la discrepancia (mínimo 10 caracteres, obligatorio):
              </label>
              <textarea
                value={estado.comentario}
                onChange={(e) => onComentarioChange(e.target.value)}
                rows={2}
                maxLength={2000}
                className="mt-1 block w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-ink-500">
                {estado.comentario.length}/2000
              </p>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================
// FormularioAbstencionCoi
// ============================================================

function FormularioAbstencionCoi({ protocoloId }: { protocoloId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await registrarAbstencionCoiAction({
        protocoloId,
        motivo: motivo.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card p-6">
      <h2 className="text-display-2">Abstención obligatoria</h2>
      <p className="mt-2 text-sm text-ink-700">
        Como Investigador Principal de este protocolo, debes abstenerte por
        conflicto de interés. No puedes evaluar tu propio trabajo.
      </p>
      <div className="mt-4">
        <label className="block text-sm font-medium text-ink-800">
          Motivo (opcional)
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Si quieres añadir un motivo personalizado; si lo dejas vacío, se registrará el motivo estándar."
          className="mt-1 block w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <div className="mt-4 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}
      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Registrando…" : "Confirmar abstención por COI"}
        </button>
      </div>
    </section>
  );
}

// ============================================================
// ResumenVotoEmitido — vista de "ya votaste"
// ============================================================

function ResumenVotoEmitido({
  evaluacion,
  esPresidente,
  protocoloId,
  progreso,
}: {
  evaluacion: EvaluacionConBloques;
  esPresidente: boolean;
  protocoloId: string;
  progreso: { emitidos: number; total: number };
}) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-display-2">Tu voto registrado</h2>
        <span className="text-xs text-ink-500">
          {progreso.emitidos} de {progreso.total} miembros han votado
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Emitido el{" "}
        {new Date(evaluacion.votado_at).toLocaleString("es-MX", {
          dateStyle: "long",
          timeStyle: "short",
        })}{" "}
        · No editable.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${TONO_VOTO[evaluacion.voto_global]}`}
        >
          {ETIQUETA_VOTO[evaluacion.voto_global]}
        </span>
        {evaluacion.conflicto_interes && (
          <span className="text-xs text-ink-500">
            (Abstención por conflicto de interés)
          </span>
        )}
      </div>

      {evaluacion.conflicto_interes && evaluacion.motivo_abstencion && (
        <p className="mt-3 rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700">
          <span className="font-medium">Motivo: </span>
          {evaluacion.motivo_abstencion}
        </p>
      )}

      {!evaluacion.conflicto_interes && evaluacion.bloques.length > 0 && (
        <>
          <h3 className="text-display-3 mt-6">Tu veredicto por bloque</h3>
          <div className="mt-3 space-y-2">
            {evaluacion.bloques.map((b) => (
              <ResumenBloqueRow key={b.bloque} bloque={b} />
            ))}
          </div>
        </>
      )}

      {evaluacion.comentario_global && (
        <div className="mt-5">
          <div className="text-eyebrow mb-1 text-ink-500">Comentario global</div>
          <p className="rounded-md bg-ink-50 px-3 py-2 text-sm leading-relaxed text-ink-800">
            {evaluacion.comentario_global}
          </p>
        </div>
      )}

      {esPresidente && (
        <BotonForzarCierreFooter protocoloId={protocoloId} progreso={progreso} />
      )}
    </section>
  );
}

function ResumenBloqueRow({ bloque }: { bloque: BloqueVoto }) {
  return (
    <div className="rounded-md border border-ink-150 bg-white px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <strong>{ETIQUETAS_CATEGORIA[bloque.bloque as Categoria]}</strong>
        <span className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${TONO_RESULTADO[bloque.resultado]}`}
          >
            {ETIQUETA_RESULTADO[bloque.resultado]}
          </span>
          <span className="text-xs text-ink-500">
            {bloque.acordado_con_ia ? "(acuerdo con IA)" : "(discrepancia)"}
          </span>
        </span>
      </div>
      {!bloque.acordado_con_ia && bloque.comentario && (
        <p className="mt-2 rounded-md bg-warn-soft/30 px-3 py-2 text-xs italic text-ink-700">
          {bloque.comentario}
        </p>
      )}
    </div>
  );
}

// ============================================================
// BotonForzarCierreFooter (solo Presidente)
// ============================================================

function BotonForzarCierreFooter({
  protocoloId,
  progreso,
}: {
  protocoloId: string;
  progreso: { emitidos: number; total: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  if (progreso.emitidos === 0) return null;

  function forzar() {
    setError(null);
    startTransition(async () => {
      const res = await forzarCierreAction(protocoloId);
      if (!res.ok) {
        setError(res.error);
        setConfirmando(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-8 border-t border-ink-150 pt-5">
      <div className="text-eyebrow mb-1 text-ink-500">Acciones de Presidencia</div>
      <p className="text-xs text-ink-500">
        Como Presidente, puedes cerrar la votación antes de que voten los{" "}
        {progreso.total} miembros si consideras que la mayoría es clara.
      </p>
      {error && (
        <div className="mt-3 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad">
          {error}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-md border border-warn/40 bg-warn-soft px-4 py-1.5 text-sm font-medium text-warn"
          >
            Forzar cierre de votación
          </button>
        ) : (
          <>
            <span className="text-sm text-ink-700">
              ¿Cerrar con {progreso.emitidos} votos emitidos?
            </span>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pending}
              className="rounded-md border border-ink-200 px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={forzar}
              disabled={pending}
              className="rounded-md bg-warn px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Cerrando…" : "Sí, forzar cierre"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
