import Link from "next/link";
import { Mail } from "lucide-react";

export default async function VerificaCorreoPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "tu correo institucional";

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
        <Mail size={28} />
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-ink-500">
          Te enviamos un enlace de verificación a
          <br />
          <span className="font-medium text-ink-800">{email}</span>
        </p>
      </div>

      <div className="rounded-md bg-info-soft px-4 py-3 text-left text-sm text-info">
        <strong className="block">¿Qué sigue?</strong>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Abre tu bandeja de entrada institucional.</li>
          <li>Click en el botón "Confirmar y crear contraseña".</li>
          <li>Define una contraseña de al menos 8 caracteres.</li>
        </ol>
        <p className="mt-2 text-xs">
          ¿No llegó? Revisa la carpeta de spam. Si nada, vuelve a registrarte en 5 minutos.
        </p>
      </div>

      <div className="text-sm text-ink-500">
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
