"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  reintentarExtraccionAction,
  saltarExtraccionAction,
} from "@/lib/protocolos/actions";
import type { ExtraccionStatus } from "@/lib/protocolos/queries";

type Props = {
  protocoloId: string;
  estadoInicial: ExtraccionStatus;
};

const FASES = [
  { id: "texto", label: "Texto del documento extraído", duracion: 0 },
  { id: "pendiente", label: "En cola para análisis de IA", duracion: 60 },
  { id: "procesando", label: "Claude analizando el protocolo", duracion: 180 },
  { id: "completado", label: "Campos aplicados al borrador", duracion: 0 },
];

export function Procesando({ protocoloId, estadoInicial }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<ExtraccionStatus>(estadoInicial);
  const [segundos, setSegundos] = useState(0);
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Auto-refresh cada 15 s mediante router.refresh() — el server component recarga
  // y si la extracción completó, hará redirect.
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 15_000);
    return () => clearInterval(interval);
  }, [router]);

  // Contador local de segundos transcurridos
  useEffect(() => {
    const tick = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  // Cuando el server refresca, recibimos nuevo estadoInicial — actualizar
  useEffect(() => {
    setEstado(estadoInicial);
  }, [estadoInicial]);

  // Disparar el procesamiento IA: si la extracción está pendiente, llamar al
  // route handler /api/ia/procesar-extraccion. Idempotente: la atomic UPDATE
  // del servidor garantiza un único ganador aunque varios clientes disparen.
  const dispatchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ext = estado.extraccion;
    if (!ext || ext.estado !== "pendiente") return;
    if (dispatchedRef.current.has(ext.id)) return;
    dispatchedRef.current.add(ext.id);

    fetch("/api/ia/procesar-extraccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraccionId: ext.id }),
    })
      .then(() => {
        // Sea éxito o error, el servidor ya actualizó el estado de la fila.
        // Refrescamos para reflejarlo en pantalla.
        router.refresh();
      })
      .catch((e) => {
        // Error de red antes de tocar el servidor → permitir reintento en el
        // próximo refresh quitando el marcador local.
        dispatchedRef.current.delete(ext.id);
        console.error("Dispatch IA — error de red:", e);
      });
  }, [estado.extraccion, router]);

  const ext = estado.extraccion;
  const faseActual = ext?.estado ?? "pendiente";
  // Escape manual: si lleva mucho en "procesando" (pasado el timeout del SDK de
  // ~110s, antes del auto-rescate de 150s del servidor, por si el refresco
  // fallara), ofrecer reintentar/saltar.
  const mostrarTimeout = faseActual === "procesando" && segundos > 130;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-widest text-[#46728B]">
          Sometimiento · Análisis IA
        </p>
        <h1 className="text-display-1 mt-1 text-ink-900">Analizando tu protocolo</h1>
        <p className="mt-2 text-ink-700">
          La IA está leyendo tu documento y extrayendo los campos del formulario. Puedes esperar en
          esta pantalla o cerrar y volver más tarde — te aparecerá listo en tu dashboard.
        </p>
      </header>

      <div className="card p-8">
        {/* Spinner / animación */}
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-ink-200 border-t-[var(--accent)]" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="text-sm font-medium text-ink-900">
            {faseActual === "pendiente" && "En cola — esperando turno…"}
            {faseActual === "procesando" && "Claude está leyendo tu protocolo…"}
            {faseActual === "completado" && "¡Análisis completado!"}
            {faseActual === "error" && "El análisis falló"}
          </div>
          <div className="mt-1 text-xs text-ink-500">
            Tiempo transcurrido: {formatearTiempo(segundos)}
            {ext?.texto_caracteres && (
              <> · Texto extraído: {ext.texto_caracteres.toLocaleString()} caracteres</>
            )}
          </div>
        </div>

        {/* Timeline de fases */}
        <ol className="mt-8 space-y-3">
          {FASES.map((fase, idx) => {
            const completa = posicionFase(fase.id) < posicionFase(faseActual);
            const activa = fase.id === faseActual;
            const fallida = faseActual === "error" && activa;
            return (
              <li key={fase.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    fallida
                      ? "bg-bad text-white"
                      : completa
                        ? "bg-good text-white"
                        : activa
                          ? "bg-[var(--accent)] text-white"
                          : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {fallida ? "✗" : completa ? "✓" : idx + 1}
                </span>
                <span
                  className={
                    fallida
                      ? "text-bad"
                      : completa
                        ? "text-ink-500 line-through"
                        : activa
                          ? "font-medium text-ink-900"
                          : "text-ink-400"
                  }
                >
                  {fase.label}
                </span>
              </li>
            );
          })}
        </ol>

        {ext?.error_mensaje && (
          <div className="mt-6 rounded-md border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
            <strong>Error:</strong> {ext.error_mensaje}
          </div>
        )}

        {mostrarTimeout && (
          <div className="mt-6 rounded-md border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
            Esto está tardando más de lo normal. Puedes <strong>reintentar</strong>{" "}
            el análisis o <strong>saltar</strong> y llenar el formulario
            manualmente — tu documento y tu borrador no se pierden.
          </div>
        )}

        {mensaje && (
          <div className="mt-6 rounded-md border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
            {mensaje}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-ink-700 hover:text-ink-900 hover:underline"
        >
          ← Volver al dashboard
        </Link>
        <div className="flex gap-3">
          {(faseActual === "error" || mostrarTimeout) && (
            <button
              onClick={() => {
                setMensaje(null);
                startTransition(async () => {
                  const res = await reintentarExtraccionAction(protocoloId);
                  if (res.ok) setMensaje("Re-encolado. La IA volverá a procesar.");
                  else setMensaje("Error: " + res.error);
                });
              }}
              disabled={pending}
              className="btn-secondary"
            >
              {pending ? "Procesando..." : "Reintentar análisis IA"}
            </button>
          )}
          <button
            onClick={() => {
              if (
                !confirm(
                  "Si saltas la IA, abrirás el wizard manual sin pre-llenado. ¿Continuar?",
                )
              )
                return;
              startTransition(async () => {
                await saltarExtraccionAction(protocoloId);
              });
            }}
            disabled={pending}
            className="btn-secondary"
          >
            Saltar y llenar manual →
          </button>
        </div>
      </div>
    </div>
  );
}

function posicionFase(fase: string): number {
  return ["texto", "pendiente", "procesando", "completado"].indexOf(fase);
}

function formatearTiempo(s: number): string {
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min} min ${sec} s`;
}
