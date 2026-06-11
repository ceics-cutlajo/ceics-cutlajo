"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Video,
  Phone,
  Pencil,
  Trash2,
  MapPin,
} from "lucide-react";
import {
  crearSesion,
  actualizarSesion,
  eliminarSesion,
  type SesionInput,
} from "@/lib/calendario/actions";
import {
  ETIQUETA_MODALIDAD,
  type Modalidad,
  type SesionComite,
} from "@/lib/calendario/types";
import { fechaLargaEs, horario } from "@/lib/calendario/formato";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Props = {
  sesiones: SesionComite[];
  hoy: string; // YYYY-MM-DD en Jalisco
  esComite: boolean;
  puedeEditar: boolean;
};

function nombreMes(year: number, month: number): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1, 12)));
}

export function CalendarioReuniones({
  sesiones,
  hoy,
  esComite,
  puedeEditar,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Mes inicial: el de la próxima sesión futura, o el mes de hoy.
  const inicial = useMemo(() => {
    const futura = [...sesiones]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .find((s) => s.fecha >= hoy);
    const base = (futura?.fecha ?? hoy).split("-").map(Number);
    return { year: base[0], month: base[1] - 1 };
  }, [sesiones, hoy]);

  const [vista, setVista] = useState(inicial);
  const [seleccionId, setSeleccionId] = useState<string | null>(
    () =>
      [...sesiones]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .find((s) => s.fecha >= hoy)?.id ?? null,
  );
  const [modal, setModal] = useState<
    { modo: "nueva"; fecha: string } | { modo: "editar"; sesion: SesionComite } | null
  >(null);

  const porFecha = useMemo(() => {
    const m = new Map<string, SesionComite[]>();
    for (const s of sesiones) {
      const arr = m.get(s.fecha) ?? [];
      arr.push(s);
      m.set(s.fecha, arr);
    }
    return m;
  }, [sesiones]);

  const seleccion = sesiones.find((s) => s.id === seleccionId) ?? null;

  // Construye la grilla del mes (inicia en domingo).
  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(vista.year, vista.month, 1));
    const offset = primero.getUTCDay(); // 0=Dom
    const dias = new Date(Date.UTC(vista.year, vista.month + 1, 0)).getUTCDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= dias; d++) {
      const iso = `${vista.year}-${String(vista.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push(iso);
    }
    return out;
  }, [vista]);

  function cambiarMes(delta: number) {
    setVista((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  function clicDia(iso: string) {
    const enDia = porFecha.get(iso);
    if (enDia && enDia.length) {
      setSeleccionId(enDia[0].id);
    } else if (puedeEditar) {
      setModal({ modo: "nueva", fecha: iso });
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabecera de navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => cambiarMes(-1)}
            className="rounded-md border border-ink-200 p-1.5 text-ink-600 hover:bg-ink-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => cambiarMes(1)}
            className="rounded-md border border-ink-200 p-1.5 text-ink-600 hover:bg-ink-50"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
          <h2 className="ml-2 text-display-2 capitalize">
            {nombreMes(vista.year, vista.month)}
          </h2>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setModal({ modo: "nueva", fecha: hoy })}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-deep)]"
          >
            <CalendarPlus size={16} />
            Nueva sesión
          </button>
        )}
      </div>

      {/* Grilla */}
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-ink-150 bg-ink-50 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          {DIAS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((iso, idx) => {
            if (!iso)
              return <div key={`b${idx}`} className="min-h-[84px] border-b border-r border-ink-100 bg-ink-50/40" />;
            const enDia = porFecha.get(iso) ?? [];
            const esHoy = iso === hoy;
            const dia = Number(iso.split("-")[2]);
            return (
              <button
                key={iso}
                onClick={() => clicDia(iso)}
                className={`min-h-[84px] border-b border-r border-ink-100 p-1.5 text-left align-top transition-colors ${
                  puedeEditar || enDia.length ? "hover:bg-ink-50" : "cursor-default"
                }`}
              >
                <div
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    esHoy
                      ? "bg-[var(--accent)] font-semibold text-white"
                      : "text-ink-600"
                  }`}
                >
                  {dia}
                </div>
                <div className="space-y-1">
                  {enDia.map((s) => {
                    const pasada = s.fecha < hoy;
                    const activa = s.id === seleccionId;
                    return (
                      <span
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSeleccionId(s.id);
                        }}
                        className={`block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight ${
                          pasada
                            ? "bg-ink-100 text-ink-500"
                            : "bg-[var(--accent)]/12 text-[var(--accent-deep)]"
                        } ${activa ? "ring-1 ring-[var(--accent)]" : ""}`}
                        title={s.titulo}
                      >
                        {s.titulo}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="flex flex-wrap gap-4 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-[var(--accent)]/30" /> Próxima
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-ink-200" /> Previa
        </span>
        {puedeEditar && <span>· Haz clic en un día para programar una sesión.</span>}
      </p>

      {/* Detalle de la sesión seleccionada */}
      {seleccion && (
        <DetalleSesion
          sesion={seleccion}
          esComite={esComite}
          puedeEditar={puedeEditar}
          onEditar={() => setModal({ modo: "editar", sesion: seleccion })}
          onEliminar={() => {
            if (!confirm("¿Eliminar esta sesión del calendario?")) return;
            startTransition(async () => {
              const r = await eliminarSesion(seleccion.id);
              if (r.ok) {
                setSeleccionId(null);
                router.refresh();
              } else {
                alert(r.error);
              }
            });
          }}
          pending={pending}
        />
      )}

      {modal && (
        <ModalSesion
          modo={modal.modo}
          sesion={modal.modo === "editar" ? modal.sesion : null}
          fechaInicial={modal.modo === "nueva" ? modal.fecha : modal.sesion.fecha}
          pending={pending}
          onCerrar={() => setModal(null)}
          onGuardar={(input) => {
            startTransition(async () => {
              const r =
                modal.modo === "editar"
                  ? await actualizarSesion(modal.sesion.id, input)
                  : await crearSesion(input);
              if (r.ok) {
                setModal(null);
                router.refresh();
              } else {
                alert(r.error);
              }
            });
          }}
        />
      )}
    </div>
  );
}

function DetalleSesion({
  sesion,
  esComite,
  puedeEditar,
  onEditar,
  onEliminar,
  pending,
}: {
  sesion: SesionComite;
  esComite: boolean;
  puedeEditar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  pending: boolean;
}) {
  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-eyebrow text-ink-500 capitalize">
            {fechaLargaEs(sesion.fecha)} · {horario(sesion.hora_inicio, sesion.hora_fin)}
          </div>
          <h3 className="mt-1 text-display-2">{sesion.titulo}</h3>
          <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-600">
            {sesion.modalidad !== "virtual" && <MapPin size={14} />}
            {ETIQUETA_MODALIDAD[sesion.modalidad]}
            {sesion.ubicacion ? ` · ${sesion.ubicacion}` : ""}
          </div>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            <button
              onClick={onEditar}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              <Pencil size={14} /> Editar
            </button>
            <button
              onClick={onEliminar}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-bad/30 px-3 py-1.5 text-sm text-bad hover:bg-bad-soft disabled:opacity-50"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>

      {esComite ? (
        <>
          {sesion.meet_link && (
            <div className="rounded-md bg-info-soft px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={sesion.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-navy-700 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Video size={16} /> Unirse con Google Meet
                </a>
                <a
                  href={sesion.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-info underline"
                >
                  {sesion.meet_link}
                </a>
              </div>
              {sesion.meet_telefono && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-600">
                  <Phone size={13} /> {sesion.meet_telefono}
                  {sesion.meet_pin ? ` · PIN: ${sesion.meet_pin}#` : ""}
                </div>
              )}
            </div>
          )}
          {sesion.orden_del_dia && (
            <div>
              <div className="text-eyebrow mb-2 text-ink-500">Orden del día</div>
              <div className="whitespace-pre-line text-sm leading-relaxed text-ink-700">
                {sesion.orden_del_dia}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-md bg-info-soft px-4 py-3 text-sm text-info">
          👁️ Los datos de conexión y el orden del día están disponibles para los
          miembros del comité.
        </div>
      )}
    </div>
  );
}

function ModalSesion({
  modo,
  sesion,
  fechaInicial,
  pending,
  onCerrar,
  onGuardar,
}: {
  modo: "nueva" | "editar";
  sesion: SesionComite | null;
  fechaInicial: string;
  pending: boolean;
  onCerrar: () => void;
  onGuardar: (input: SesionInput) => void;
}) {
  const [form, setForm] = useState<SesionInput>({
    titulo: sesion?.titulo ?? "",
    fecha: sesion?.fecha ?? fechaInicial,
    hora_inicio: (sesion?.hora_inicio ?? "09:00").slice(0, 5),
    hora_fin: sesion?.hora_fin ? sesion.hora_fin.slice(0, 5) : "",
    modalidad: sesion?.modalidad ?? "virtual",
    ubicacion: sesion?.ubicacion ?? "",
    meet_link: sesion?.meet_link ?? "",
    meet_telefono: sesion?.meet_telefono ?? "",
    meet_pin: sesion?.meet_pin ?? "",
    orden_del_dia: sesion?.orden_del_dia ?? "",
  });

  function set<K extends keyof SesionInput>(k: K, v: SesionInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const label = "block text-xs font-medium text-ink-600 mb-1";
  const input =
    "w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="my-auto w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-display-2">
          {modo === "editar" ? "Editar sesión" : "Programar sesión"}
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className={label}>Título</label>
            <input
              className={input}
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ej. Primera Sesión del CEICS · 2026-28"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Fecha</label>
              <input
                type="date"
                className={input}
                value={form.fecha}
                onChange={(e) => set("fecha", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Inicio</label>
              <input
                type="time"
                className={input}
                value={form.hora_inicio}
                onChange={(e) => set("hora_inicio", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Fin (opcional)</label>
              <input
                type="time"
                className={input}
                value={form.hora_fin ?? ""}
                onChange={(e) => set("hora_fin", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Modalidad</label>
              <select
                className={input}
                value={form.modalidad}
                onChange={(e) => set("modalidad", e.target.value as Modalidad)}
              >
                {(Object.keys(ETIQUETA_MODALIDAD) as Modalidad[]).map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_MODALIDAD[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Sede (si presencial)</label>
              <input
                className={input}
                value={form.ubicacion ?? ""}
                onChange={(e) => set("ubicacion", e.target.value)}
                placeholder="Aula / edificio"
              />
            </div>
          </div>
          <div>
            <label className={label}>Enlace de Google Meet</label>
            <input
              className={input}
              value={form.meet_link ?? ""}
              onChange={(e) => set("meet_link", e.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Teléfono</label>
              <input
                className={input}
                value={form.meet_telefono ?? ""}
                onChange={(e) => set("meet_telefono", e.target.value)}
                placeholder="+52 55 ..."
              />
            </div>
            <div>
              <label className={label}>PIN</label>
              <input
                className={input}
                value={form.meet_pin ?? ""}
                onChange={(e) => set("meet_pin", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={label}>Orden del día</label>
            <textarea
              className={`${input} min-h-[140px]`}
              value={form.orden_del_dia ?? ""}
              onChange={(e) => set("orden_del_dia", e.target.value)}
              placeholder="Convocatoria, fundamento legal y puntos del orden del día…"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCerrar}
            disabled={pending}
            className="rounded-md px-4 py-2 text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onGuardar(form)}
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-deep)] disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
