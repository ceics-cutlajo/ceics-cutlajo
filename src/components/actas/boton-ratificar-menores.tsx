"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ratificarCorreccionesMenoresAction } from "@/lib/actas/actions";

/**
 * Botón de Presidencia/Secretaría para ratificar el cumplimiento de
 * observaciones menores y emitir el acta final 'APROBADO' (sin nueva votación
 * del comité). Visible solo cuando el protocolo está en 'correcciones_menores'.
 */
export function BotonRatificarMenores({ protocoloId }: { protocoloId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function handleRatificar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await ratificarCorreccionesMenoresAction(protocoloId);
      if (r.ok) {
        if (r.data?.advertencia) setAviso(r.data.advertencia);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRatificar}
        disabled={pending}
        className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Emitiendo acta…" : "Ratificar y emitir acta de aprobación"}
      </button>
      {aviso && <p className="text-xs text-warn">{aviso}</p>}
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
