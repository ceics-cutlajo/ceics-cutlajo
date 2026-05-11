"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ETIQUETAS_AREA,
  ETIQUETAS_TIPO_INV,
  ETIQUETAS_RIESGO,
  DESCRIPCION_RIESGO,
  ETIQUETAS_DOCUMENTO,
  DESCRIPCION_DOCUMENTO,
  TIPOS_DOCUMENTO,
  documentosObligatorios,
  type TipoDocumento,
} from "@/lib/protocolos/schemas";
import {
  guardarDatosBasicosAction,
  agregarCoInvestigadorAction,
  eliminarCoInvestigadorAction,
  subirDocumentoAction,
  eliminarDocumentoAction,
  enviarProtocoloAction,
  eliminarBorradorAction,
} from "@/lib/protocolos/actions";
import type {
  ProtocoloCompleto,
  CoInvestigadorRow,
  DocumentoRow,
} from "@/lib/protocolos/queries";

type Paso = 1 | 2 | 3 | 4;

const PASOS: { num: Paso; titulo: string; descripcion: string }[] = [
  { num: 1, titulo: "Datos del proyecto", descripcion: "Título, área y clasificación" },
  { num: 2, titulo: "Equipo de investigación", descripcion: "Co-investigadores" },
  { num: 3, titulo: "Documentos", descripcion: "Carga los 7 documentos" },
  { num: 4, titulo: "Revisar y enviar", descripcion: "Confirmación final" },
];

type WizardProps = {
  protocolo: ProtocoloCompleto;
  coInvestigadores: CoInvestigadorRow[];
  documentos: DocumentoRow[];
};

export function ProtocoloWizard({ protocolo, coInvestigadores, documentos }: WizardProps) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function refrescar() {
    router.refresh();
  }

  function notificar(tipo: "ok" | "error", texto: string) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow text-ink-500">
            {protocolo.clave ? `Protocolo ${protocolo.clave}` : "Nuevo protocolo"} ·{" "}
            {protocolo.estado === "borrador" ? "Borrador" : "Con observaciones"}
          </p>
          <h1 className="text-display-1 mt-1 line-clamp-2">{protocolo.titulo}</h1>
        </div>
        <BotonEliminarBorrador protocoloId={protocolo.id} />
      </header>

      <Stepper paso={paso} onClick={(p) => setPaso(p)} />

      {mensaje && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            mensaje.tipo === "ok"
              ? "border border-good/20 bg-good-soft text-good"
              : "border border-bad/20 bg-bad-soft text-bad"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="card p-8">
        {paso === 1 && (
          <PasoDatosBasicos
            protocolo={protocolo}
            pending={pending}
            onGuardar={(payload) => {
              startTransition(async () => {
                const res = await guardarDatosBasicosAction(protocolo.id, payload);
                if (res.ok) {
                  notificar("ok", "Datos guardados ✓");
                  refrescar();
                  setPaso(2);
                } else {
                  notificar("error", res.error);
                }
              });
            }}
          />
        )}

        {paso === 2 && (
          <PasoCoInvestigadores
            protocoloId={protocolo.id}
            coInvestigadores={coInvestigadores}
            pending={pending}
            onAgregar={(payload) => {
              startTransition(async () => {
                const res = await agregarCoInvestigadorAction(protocolo.id, payload);
                if (res.ok) {
                  notificar("ok", "Co-investigador agregado");
                  refrescar();
                } else {
                  notificar("error", res.error);
                }
              });
            }}
            onEliminar={(coInvId) => {
              startTransition(async () => {
                const res = await eliminarCoInvestigadorAction(protocolo.id, coInvId);
                if (res.ok) {
                  notificar("ok", "Co-investigador eliminado");
                  refrescar();
                } else {
                  notificar("error", res.error);
                }
              });
            }}
          />
        )}

        {paso === 3 && (
          <PasoDocumentos
            protocolo={protocolo}
            documentos={documentos}
            pending={pending}
            onSubir={(tipo, file) => {
              const formData = new FormData();
              formData.append("tipo_documento_id", tipo);
              formData.append("archivo", file);
              startTransition(async () => {
                const res = await subirDocumentoAction(protocolo.id, formData);
                if (res.ok) {
                  notificar("ok", `Documento "${ETIQUETAS_DOCUMENTO[tipo]}" subido`);
                  refrescar();
                } else {
                  notificar("error", res.error);
                }
              });
            }}
            onEliminar={(documentoId) => {
              startTransition(async () => {
                const res = await eliminarDocumentoAction(protocolo.id, documentoId);
                if (res.ok) {
                  notificar("ok", "Documento eliminado");
                  refrescar();
                } else {
                  notificar("error", res.error);
                }
              });
            }}
          />
        )}

        {paso === 4 && (
          <PasoRevisarEnviar
            protocolo={protocolo}
            coInvestigadores={coInvestigadores}
            documentos={documentos}
            pending={pending}
            onEnviar={() => {
              startTransition(async () => {
                const res = await enviarProtocoloAction(protocolo.id);
                if (res.ok) {
                  router.push(`/protocolo/${protocolo.id}?enviado=1`);
                } else {
                  notificar("error", res.error);
                }
              });
            }}
            onIr={(p) => setPaso(p)}
          />
        )}
      </div>

      <Navegacion paso={paso} onCambiar={setPaso} />
    </div>
  );
}

// =============================================================
// Componentes del wizard
// =============================================================

function Stepper({ paso, onClick }: { paso: Paso; onClick: (p: Paso) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-3">
      {PASOS.map((p) => {
        const completo = p.num < paso;
        const activo = p.num === paso;
        return (
          <li key={p.num}>
            <button
              onClick={() => onClick(p.num)}
              className={`group w-full rounded-md border px-3 py-3 text-left transition ${
                activo
                  ? "border-[var(--accent)] bg-white shadow-sm"
                  : completo
                    ? "border-good/40 bg-good-soft"
                    : "border-ink-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    activo
                      ? "bg-[var(--accent)] text-white"
                      : completo
                        ? "bg-good text-white"
                        : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {completo ? "✓" : p.num}
                </span>
                <span
                  className={`text-sm font-medium ${
                    activo ? "text-ink-900" : "text-ink-600"
                  }`}
                >
                  {p.titulo}
                </span>
              </div>
              <div className="ml-8 text-xs text-ink-400">{p.descripcion}</div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Navegacion({ paso, onCambiar }: { paso: Paso; onCambiar: (p: Paso) => void }) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onCambiar(Math.max(1, paso - 1) as Paso)}
        disabled={paso === 1}
        className="btn-secondary disabled:opacity-30"
      >
        ← Anterior
      </button>
      <div className="text-xs text-ink-400">Paso {paso} de 4</div>
      <button
        onClick={() => onCambiar(Math.min(4, paso + 1) as Paso)}
        disabled={paso === 4}
        className="btn-secondary disabled:opacity-30"
      >
        Siguiente →
      </button>
    </div>
  );
}

function BotonEliminarBorrador({ protocoloId }: { protocoloId: string }) {
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
          if (res.ok) router.push("/dashboard");
          else alert(res.error);
        });
      }}
      disabled={pending}
      className="text-xs text-ink-400 hover:text-bad disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar borrador"}
    </button>
  );
}

// =============================================================
// Paso 1: Datos básicos
// =============================================================

function PasoDatosBasicos({
  protocolo,
  pending,
  onGuardar,
}: {
  protocolo: ProtocoloCompleto;
  pending: boolean;
  onGuardar: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    titulo: protocolo.titulo === "Protocolo sin título" ? "" : protocolo.titulo,
    resumen: protocolo.resumen ?? "",
    area_conocimiento_id: protocolo.area_conocimiento_id ?? 3,
    tipo_investigacion_id: protocolo.tipo_investigacion_id ?? "clinica",
    clasificacion_riesgo: protocolo.clasificacion_riesgo ?? "riesgo_minimo",
    involucra_humanos: protocolo.involucra_humanos,
    involucra_menores: protocolo.involucra_menores,
    involucra_datos_geneticos: protocolo.involucra_datos_geneticos,
    involucra_medicamento: protocolo.involucra_medicamento,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(form);
      }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-display-2">1. Datos del proyecto</h2>
        <p className="mt-1 text-sm text-ink-500">
          Este título debe coincidir literalmente con el de la carta al Presidente, la carta de
          delegación y el formato de protocolo.
        </p>
      </div>

      <div>
        <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-ink-700">
          Título del protocolo <span className="text-bad">*</span>
        </label>
        <textarea
          id="titulo"
          rows={2}
          required
          minLength={20}
          maxLength={300}
          value={form.titulo}
          onChange={(e) => update("titulo", e.target.value)}
          className="input-field"
          placeholder="Ej: Prevalencia de hipertensión arterial en adultos mayores del Hospital Civil de Oriente"
        />
        <p className="mt-1 text-xs text-ink-400">{form.titulo.length} / 300 caracteres</p>
      </div>

      <div>
        <label htmlFor="resumen" className="mb-1 block text-sm font-medium text-ink-700">
          Resumen ejecutivo <span className="text-bad">*</span>
        </label>
        <textarea
          id="resumen"
          rows={5}
          required
          minLength={100}
          maxLength={3000}
          value={form.resumen}
          onChange={(e) => update("resumen", e.target.value)}
          className="input-field"
          placeholder="Describe brevemente el objetivo, método y resultados esperados (100–3000 caracteres)."
        />
        <p className="mt-1 text-xs text-ink-400">{form.resumen.length} / 3000 caracteres</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="area"
            className="mb-1 block text-sm font-medium text-ink-700"
          >
            Área de conocimiento (SECIHTI) <span className="text-bad">*</span>
          </label>
          <select
            id="area"
            value={form.area_conocimiento_id}
            onChange={(e) => update("area_conocimiento_id", Number(e.target.value))}
            className="input-field"
          >
            {Object.entries(ETIQUETAS_AREA).map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="tipo"
            className="mb-1 block text-sm font-medium text-ink-700"
          >
            Tipo de investigación <span className="text-bad">*</span>
          </label>
          <select
            id="tipo"
            value={form.tipo_investigacion_id}
            onChange={(e) =>
              update(
                "tipo_investigacion_id",
                e.target.value as typeof form.tipo_investigacion_id,
              )
            }
            className="input-field"
          >
            {Object.entries(ETIQUETAS_TIPO_INV).map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink-700">
          Clasificación de riesgo (NOM-012-SSA3 / Art. 17 Reglamento){" "}
          <span className="text-bad">*</span>
        </label>
        <div className="space-y-2">
          {(["sin_riesgo", "riesgo_minimo", "riesgo_mayor_minimo"] as const).map((nivel) => (
            <label
              key={nivel}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                form.clasificacion_riesgo === nivel
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-ink-200"
              }`}
            >
              <input
                type="radio"
                name="riesgo"
                value={nivel}
                checked={form.clasificacion_riesgo === nivel}
                onChange={() => update("clasificacion_riesgo", nivel)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-ink-900">{ETIQUETAS_RIESGO[nivel]}</div>
                <div className="text-xs text-ink-500">{DESCRIPCION_RIESGO[nivel]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-700">
          Características del estudio
        </legend>
        <div className="space-y-2 text-sm">
          <Checkbox
            label="Involucra sujetos humanos"
            checked={form.involucra_humanos}
            onChange={(v) => update("involucra_humanos", v)}
            hint="Activa la obligatoriedad del consentimiento informado."
          />
          <Checkbox
            label="Involucra menores de edad (población pediátrica)"
            checked={form.involucra_menores}
            onChange={(v) => update("involucra_menores", v)}
            hint="Activa la obligatoriedad de la carta de asentimiento."
          />
          <Checkbox
            label="Involucra muestras o datos genéticos"
            checked={form.involucra_datos_geneticos}
            onChange={(v) => update("involucra_datos_geneticos", v)}
          />
          <Checkbox
            label="Involucra administración de medicamento o producto de investigación"
            checked={form.involucra_medicamento}
            onChange={(v) => update("involucra_medicamento", v)}
          />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando..." : "Guardar y continuar →"}
        </button>
      </div>
    </form>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span className="flex-1">
        <span className="text-ink-900">{label}</span>
        {hint && <span className="ml-2 text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

// =============================================================
// Paso 2: Co-investigadores
// =============================================================

function PasoCoInvestigadores({
  protocoloId: _protocoloId,
  coInvestigadores,
  pending,
  onAgregar,
  onEliminar,
}: {
  protocoloId: string;
  coInvestigadores: CoInvestigadorRow[];
  pending: boolean;
  onAgregar: (payload: Record<string, unknown>) => void;
  onEliminar: (coInvId: string) => void;
}) {
  const [form, setForm] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    adscripcion: "",
    email: "",
  });

  function reset() {
    setForm({
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      adscripcion: "",
      email: "",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-2">2. Equipo de investigación</h2>
        <p className="mt-1 text-sm text-ink-500">
          Lista a los co-investigadores que participan en el estudio. El Investigador Principal eres
          tú y no necesitas agregarte aquí. Si trabajas solo/a, puedes saltar este paso.
        </p>
      </div>

      {coInvestigadores.length > 0 && (
        <div className="rounded-md border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Adscripción</th>
                <th className="px-4 py-2">Correo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {coInvestigadores.map((c, idx) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-ink-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-ink-900">
                    {c.nombre} {c.apellido_paterno} {c.apellido_materno ?? ""}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{c.adscripcion ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-700">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEliminar(c.id)}
                      disabled={pending}
                      className="text-xs text-bad hover:underline disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAgregar(form);
          reset();
        }}
        className="card border border-dashed border-ink-300 bg-ink-50 p-5"
      >
        <h3 className="font-medium text-ink-900">Agregar co-investigador</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            required
            minLength={2}
            placeholder="Nombre(s)"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="input-field"
          />
          <input
            required
            minLength={2}
            placeholder="Apellido paterno"
            value={form.apellido_paterno}
            onChange={(e) => setForm({ ...form, apellido_paterno: e.target.value })}
            className="input-field"
          />
          <input
            placeholder="Apellido materno (opcional)"
            value={form.apellido_materno}
            onChange={(e) => setForm({ ...form, apellido_materno: e.target.value })}
            className="input-field"
          />
          <input
            required
            minLength={2}
            placeholder="Adscripción institucional"
            value={form.adscripcion}
            onChange={(e) => setForm({ ...form, adscripcion: e.target.value })}
            className="input-field md:col-span-2"
          />
          <input
            type="email"
            placeholder="Correo (opcional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input-field"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Agregando..." : "Agregar al equipo"}
          </button>
        </div>
      </form>
    </div>
  );
}

// =============================================================
// Paso 3: Documentos
// =============================================================

function PasoDocumentos({
  protocolo,
  documentos,
  pending,
  onSubir,
  onEliminar,
}: {
  protocolo: ProtocoloCompleto;
  documentos: DocumentoRow[];
  pending: boolean;
  onSubir: (tipo: TipoDocumento, file: File) => void;
  onEliminar: (documentoId: string) => void;
}) {
  const subidosPorTipo = new Map(documentos.map((d) => [d.tipo_documento_id, d]));
  const obligatorios = documentosObligatorios({
    tipo_investigacion_id: protocolo.tipo_investigacion_id ?? "clinica",
    involucra_humanos: protocolo.involucra_humanos,
    involucra_menores: protocolo.involucra_menores,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-2">3. Documentos del protocolo</h2>
        <p className="mt-1 text-sm text-ink-500">
          Sube cada documento en formato PDF o Word (máx. 25 MB). Los marcados con asterisco son
          obligatorios según las características que indicaste en el paso 1.
        </p>
      </div>

      <div className="space-y-3">
        {TIPOS_DOCUMENTO.map((tipo) => {
          const subido = subidosPorTipo.get(tipo);
          const esObligatorio = obligatorios.includes(tipo);
          return (
            <DocumentoRow
              key={tipo}
              tipo={tipo}
              subido={subido}
              esObligatorio={esObligatorio}
              pending={pending}
              onSubir={onSubir}
              onEliminar={onEliminar}
            />
          );
        })}
      </div>
    </div>
  );
}

function DocumentoRow({
  tipo,
  subido,
  esObligatorio,
  pending,
  onSubir,
  onEliminar,
}: {
  tipo: TipoDocumento;
  subido: DocumentoRow | undefined;
  esObligatorio: boolean;
  pending: boolean;
  onSubir: (tipo: TipoDocumento, file: File) => void;
  onEliminar: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-md border p-4 transition ${
        subido
          ? "border-good/40 bg-good-soft/30"
          : esObligatorio
            ? "border-ink-300 bg-white"
            : "border-ink-200 bg-ink-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                subido
                  ? "bg-good text-white"
                  : esObligatorio
                    ? "bg-ink-200 text-ink-500"
                    : "bg-ink-100 text-ink-400"
              }`}
            >
              {subido ? "✓" : "·"}
            </span>
            <div className="text-sm font-medium text-ink-900">
              {ETIQUETAS_DOCUMENTO[tipo]}
              {esObligatorio && <span className="ml-1 text-bad">*</span>}
              {!esObligatorio && (
                <span className="ml-2 text-xs font-normal text-ink-400">(no aplica)</span>
              )}
            </div>
          </div>
          <p className="ml-7 mt-1 text-xs text-ink-500">{DESCRIPCION_DOCUMENTO[tipo]}</p>
          {subido && (
            <div className="ml-7 mt-2 flex items-center gap-3 text-xs text-ink-600">
              <span className="font-mono">{subido.nombre_original}</span>
              <span className="text-ink-400">
                {(subido.tamano_bytes / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {subido ? (
            <button
              onClick={() => onEliminar(subido.id)}
              disabled={pending}
              className="text-xs text-bad hover:underline disabled:opacity-50"
            >
              Reemplazar / eliminar
            </button>
          ) : (
            <label className="btn-secondary cursor-pointer text-xs">
              {pending ? "Subiendo..." : "Subir archivo"}
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                disabled={pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onSubir(tipo, file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Paso 4: Revisar y enviar
// =============================================================

function PasoRevisarEnviar({
  protocolo,
  coInvestigadores,
  documentos,
  pending,
  onEnviar,
  onIr,
}: {
  protocolo: ProtocoloCompleto;
  coInvestigadores: CoInvestigadorRow[];
  documentos: DocumentoRow[];
  pending: boolean;
  onEnviar: () => void;
  onIr: (p: Paso) => void;
}) {
  const obligatorios = documentosObligatorios({
    tipo_investigacion_id: protocolo.tipo_investigacion_id ?? "clinica",
    involucra_humanos: protocolo.involucra_humanos,
    involucra_menores: protocolo.involucra_menores,
  });
  const subidos = new Set(documentos.map((d) => d.tipo_documento_id));
  const faltantes = obligatorios.filter((t) => !subidos.has(t));

  const datosCompletos =
    protocolo.titulo &&
    protocolo.titulo !== "Protocolo sin título" &&
    protocolo.resumen &&
    protocolo.resumen.length >= 100 &&
    protocolo.area_conocimiento_id &&
    protocolo.tipo_investigacion_id &&
    protocolo.clasificacion_riesgo;

  const todoListo = datosCompletos && faltantes.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-2">4. Revisar y enviar</h2>
        <p className="mt-1 text-sm text-ink-500">
          Confirma que toda la información es correcta antes de enviar al CEICS. Después del envío,
          el protocolo entrará en evaluación y no podrás editarlo.
        </p>
      </div>

      {/* Resumen de datos */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-700">Datos del proyecto</h3>
          <button
            onClick={() => onIr(1)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Editar
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border border-ink-200 bg-white p-4 text-sm md:grid-cols-2">
          <Dato label="Título" value={protocolo.titulo} />
          <Dato
            label="Área"
            value={
              protocolo.area_conocimiento_id
                ? ETIQUETAS_AREA[protocolo.area_conocimiento_id]
                : "—"
            }
          />
          <Dato
            label="Tipo"
            value={
              protocolo.tipo_investigacion_id
                ? ETIQUETAS_TIPO_INV[
                    protocolo.tipo_investigacion_id as keyof typeof ETIQUETAS_TIPO_INV
                  ]
                : "—"
            }
          />
          <Dato
            label="Riesgo"
            value={
              protocolo.clasificacion_riesgo
                ? ETIQUETAS_RIESGO[protocolo.clasificacion_riesgo]
                : "—"
            }
          />
          <Dato
            label="Humanos / menores / genéticos / medicamento"
            value={`${b(protocolo.involucra_humanos)} / ${b(protocolo.involucra_menores)} / ${b(
              protocolo.involucra_datos_geneticos,
            )} / ${b(protocolo.involucra_medicamento)}`}
          />
        </dl>
      </section>

      {/* Equipo */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-700">
            Equipo ({coInvestigadores.length} co-investigador{coInvestigadores.length === 1 ? "" : "es"})
          </h3>
          <button
            onClick={() => onIr(2)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Editar
          </button>
        </div>
        <div className="rounded-md border border-ink-200 bg-white p-4 text-sm">
          {coInvestigadores.length === 0 ? (
            <p className="text-ink-500">Sin co-investigadores. Tú serás el único responsable.</p>
          ) : (
            <ul className="space-y-1">
              {coInvestigadores.map((c) => (
                <li key={c.id} className="text-ink-700">
                  {c.nombre} {c.apellido_paterno} {c.apellido_materno ?? ""} ·{" "}
                  <span className="text-ink-500">{c.adscripcion}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Documentos */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-700">
            Documentos ({documentos.length} subido{documentos.length === 1 ? "" : "s"})
          </h3>
          <button
            onClick={() => onIr(3)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Editar
          </button>
        </div>
        <ul className="rounded-md border border-ink-200 bg-white p-4 text-sm">
          {obligatorios.map((tipo) => {
            const ok = subidos.has(tipo);
            return (
              <li key={tipo} className="flex items-center gap-2 py-1">
                <span className={ok ? "text-good" : "text-bad"}>{ok ? "✓" : "✗"}</span>
                <span className={ok ? "text-ink-700" : "text-bad"}>
                  {ETIQUETAS_DOCUMENTO[tipo]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Acciones */}
      {!todoListo && (
        <div className="rounded-md border border-warn/20 bg-warn-soft px-4 py-3 text-sm text-warn">
          {!datosCompletos && (
            <div>⚠ Faltan datos en el paso 1. Por favor complétalos antes de enviar.</div>
          )}
          {faltantes.length > 0 && (
            <div>
              ⚠ Faltan documentos obligatorios:{" "}
              {faltantes.map((t) => ETIQUETAS_DOCUMENTO[t]).join(", ")}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link href="/dashboard" className="btn-secondary">
          Guardar y volver al dashboard
        </Link>
        <button
          onClick={() => {
            if (
              confirm(
                "Una vez enviado, el protocolo entra en evaluación del CEICS y no podrás editarlo. ¿Continuar?",
              )
            ) {
              onEnviar();
            }
          }}
          disabled={pending || !todoListo}
          className="btn-primary disabled:opacity-50"
        >
          {pending ? "Enviando..." : "Enviar al CEICS →"}
        </button>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{value || "—"}</dd>
    </div>
  );
}

function b(v: boolean): string {
  return v ? "Sí" : "No";
}
