"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarBorradorAction } from "@/lib/protocolos/actions";

/** Botón para borrar un borrador desde la lista del dashboard. */
export function BorrarBorradorBoton({ protocoloId }: { protocoloId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (
          !confirm(
            "¿Eliminar este borrador permanentemente? Se borrarán también los documentos subidos.",
          )
        )
          return;
        startTransition(async () => {
          const res = await eliminarBorradorAction(protocoloId);
          if (res.ok) router.refresh();
          else alert(res.error);
        });
      }}
      disabled={pending}
      className="text-xs font-medium text-ink-400 transition hover:text-bad disabled:opacity-50"
    >
      {pending ? "Eliminando…" : "Borrar"}
    </button>
  );
}
