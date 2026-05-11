"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { mensajeDominiosUdg } from "@/lib/auth/dominios-udg";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const errorUrl = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    errorUrl === "enlace_invalido" ? "Tu enlace expiró o ya fue usado. Solicita uno nuevo." : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    if (!result.ok) setError(result.error);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Inicia sesión</h1>
        <p className="mt-1 text-sm text-ink-500">Acceso para investigadores y miembros del CEICS</p>
      </div>

      {error && (
        <div className="rounded-md border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <form action={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-700">
            Correo institucional
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nombre@academicos.udg.mx"
            className="input-field"
            autoComplete="email"
          />
          <p className="mt-1 text-xs text-ink-400">{mensajeDominiosUdg}</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-ink-700">
              Contraseña
            </label>
            <Link href="/recuperar" className="text-xs text-[var(--accent)] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="input-field"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>

      <div className="text-center text-sm text-ink-500">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/signup" className="font-medium text-[var(--accent)] hover:underline">
          Regístrate
        </Link>
      </div>
    </div>
  );
}
