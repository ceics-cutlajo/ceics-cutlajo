"use client";

import { useState } from "react";
import { crearContrasenaAction } from "@/lib/auth/actions";

export default function CrearContrasenaPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await crearContrasenaAction(formData);
    if (!result.ok) setError(result.error);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Crea tu contraseña</h1>
        <p className="mt-1 text-sm text-ink-500">
          Tu correo está verificado. Define una contraseña para futuros accesos.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <form action={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Nueva contraseña</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="input-field"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-ink-400">
            Mínimo 8 caracteres, con al menos una mayúscula y un número.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Confirmar contraseña</label>
          <input
            name="confirmar"
            type="password"
            required
            minLength={8}
            className="input-field"
            autoComplete="new-password"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Guardando..." : "Establecer contraseña y entrar"}
        </button>
      </form>
    </div>
  );
}
