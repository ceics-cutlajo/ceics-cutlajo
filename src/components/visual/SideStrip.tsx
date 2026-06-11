/**
 * Side strip vertical institucional CUTLAJO.
 *
 * Franja delgada vertical con texto en mayúsculas rotado 90°, eco editorial
 * del manual de identidad CUTLAJO. Pensado para acompañar pantallas
 * "profundas" (vista de protocolo, dictamen presidencial) donde se quiere
 * reforzar la presencia institucional sin recurrir a un PageHeader pesado.
 *
 * Layout: el SideStrip se coloca como `<aside>` sticky al inicio del
 * contenedor que envuelve el contenido principal. Usa `flex` en el padre
 * para que strip + contenido convivan lado a lado.
 */
export function SideStrip({
  label,
  tone = "red",
}: {
  label: string;
  tone?: "red" | "navy" | "ink";
}) {
  const bg =
    tone === "navy"
      ? "bg-navy-700"
      : tone === "ink"
        ? "bg-ink-900"
        : "bg-brand-red";
  const accent =
    tone === "navy"
      ? "bg-navy-500"
      : tone === "ink"
        ? "bg-brand-wine"
        : "bg-brand-wine";

  return (
    <aside
      className={`relative hidden w-10 shrink-0 overflow-hidden rounded-md lg:flex lg:flex-col ${bg}`}
      aria-hidden="true"
    >
      <span className={`block h-1 w-full ${accent}`} />
      <div className="flex flex-1 items-center justify-center py-6">
        <span
          className="font-display text-[11px] font-bold uppercase tracking-[0.32em] text-white"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
      <span className={`block h-1 w-full ${accent}`} />
    </aside>
  );
}
