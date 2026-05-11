"use client";

import Link from "next/link";
import { useState } from "react";
import { signupAction } from "@/lib/auth/actions";
import { mensajeDominiosUdg } from "@/lib/auth/dominios-udg";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await signupAction(formData);
    if (!result.ok) setError(result.error);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Crear cuenta</h1>
        <p className="mt-1 text-sm text-ink-500">
          Solo personal académico de la Universidad de Guadalajara
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <form action={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Correo institucional</label>
          <input
            name="email"
            type="email"
            required
            placeholder="nombre@academicos.udg.mx"
            className="input-field"
            autoComplete="email"
          />
          <p className="mt-1 text-xs text-ink-400">{mensajeDominiosUdg}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Nombre(s)</label>
            <input name="nombre" type="text" required className="input-field" autoComplete="given-name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Código UDG</label>
            <input
              name="codigo_udg"
              type="text"
              required
              pattern="\d{7,8}"
              placeholder="2957686"
              className="input-field"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Apellido paterno</label>
            <input
              name="apellido_paterno"
              type="text"
              required
              className="input-field"
              autoComplete="family-name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Apellido materno</label>
            <input name="apellido_materno" type="text" className="input-field" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Centro Universitario</label>
          <input
            name="centro_universitario"
            type="text"
            defaultValue="CUTLAJO"
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">División</label>
            <input
              name="division"
              type="text"
              required
              placeholder="Ej. Salud"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Departamento</label>
            <input
              name="departamento"
              type="text"
              required
              placeholder="Ej. Medicina"
              className="input-field"
            />
          </div>
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Enviando enlace..." : "Crear cuenta y enviar enlace"}
        </button>

        <p className="text-xs text-ink-400">
          Al registrarte aceptas el aviso de privacidad institucional UDG y el uso de tus datos
          conforme a la LGPDPPSO.
        </p>
      </form>

      <div className="text-center text-sm text-ink-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}
