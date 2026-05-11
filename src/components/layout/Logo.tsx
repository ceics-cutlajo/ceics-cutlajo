import Link from "next/link";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const colorTexto = variant === "dark" ? "text-white" : "text-ink-900";
  const colorSub = variant === "dark" ? "text-side-muted" : "text-ink-500";
  return (
    <Link href="/dashboard" className="flex items-center gap-2 no-underline">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] font-display text-base font-bold text-white">
        C
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`font-display text-base font-semibold ${colorTexto}`}>CEICS CUTLAJO</span>
        <span className={`text-[11px] uppercase tracking-wider ${colorSub}`}>
          Ética en Investigación
        </span>
      </div>
    </Link>
  );
}
