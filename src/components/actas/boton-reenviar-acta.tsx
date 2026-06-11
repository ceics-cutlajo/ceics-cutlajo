"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reenviarActaInvestigadorAction } from "@/lib/actas/actions";

/**
 * Botón de reenvío del acta al investigador cuando el correo original falló
 * (enviada_a_investigador_at en null). Solo se monta para Presidencia/Secretaría.
 */
export function BotonReenviarActa({ actaId }: { actaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function handleReenviar() {
    setError(null);
    startTransition(async () => {
      const r = await reenviarActaInvestigadorAction(actaId);
      if (r.ok) {
        setEnviado(true);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  if (enviado) {
    return (
      <p className="text-xs font-medium text-good">
        ✓ Acta reenviada por correo al investigador.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleReenviar}
        disabled={pending}
        className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Reenviando…" : "Reenviar acta por correo"}
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
