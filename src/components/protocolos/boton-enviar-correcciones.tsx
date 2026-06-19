"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarCorreccionesMenoresAction } from "@/lib/protocolos/actions";

/**
 * Botón del investigador para enviar las correcciones de observaciones MENORES
 * a ratificación de Presidencia (sin nueva votación del comité). Visible solo
 * cuando el protocolo está en estado 'aprobado_con_observaciones'.
 */
export function BotonEnviarCorrecciones({ protocoloId }: { protocoloId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleEnviar() {
    setError(null);
    startTransition(async () => {
      const r = await enviarCorreccionesMenoresAction(protocoloId);
      if (r.ok) {
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="mt-5 space-y-2">
      <button
        type="button"
        onClick={handleEnviar}
        disabled={pending}
        className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar correcciones al CEICS"}
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
