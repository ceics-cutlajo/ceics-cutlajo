"use client";

import { useEffect, useState, useTransition } from "react";
import {
  crearProtocoloConIAAction,
  crearYEditarProtocoloAction,
} from "@/lib/protocolos/actions";

export function NuevoProtocoloForm() {
  const [path, setPath] = useState<"elegir" | "ia" | "manual">("elegir");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pending, startTransition] = useTransition();

  // Evita que el navegador ABRA el archivo (comportamiento por defecto de Chrome:
  // navegar al PDF) si el usuario lo suelta FUERA de la zona de carga. Mientras
  // la pantalla de subida con IA está activa, cancelamos el drop a nivel de
  // ventana; la zona de carga sí captura el archivo en su propio onDrop.
  useEffect(() => {
    if (path !== "ia") return;
    const prevenir = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevenir);
    window.addEventListener("drop", prevenir);
    return () => {
      window.removeEventListener("dragover", prevenir);
      window.removeEventListener("drop", prevenir);
    };
  }, [path]);

  function seleccionarArchivo(f: File | null | undefined) {
    if (!f) return;
    if (!/\.(pdf|doc|docx)$/i.test(f.name)) {
      setFile(null);
      setError("Formato no permitido. Sube PDF o Word (.doc/.docx).");
      return;
    }
    setFile(f);
    setError(null);
  }

  function dispararIA() {
    if (!file) {
      setError("Selecciona el archivo del protocolo.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("archivo", file);
      const res = await crearProtocoloConIAAction(formData);
      // Si la acción tiene éxito hace redirect, no devuelve. Si falla:
      if (res && !res.ok) setError(res.error);
    });
  }

  function dispararManual() {
    startTransition(async () => {
      await crearYEditarProtocoloAction();
    });
  }

  if (path === "elegir") {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <button
          onClick={() => setPath("ia")}
          className="card group cursor-pointer p-6 text-left transition hover:border-[var(--accent)] hover:shadow-md"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xl">
              ✨
            </div>
            <div>
              <h2 className="text-display-2">Subir mi protocolo en Word/PDF</h2>
              <p className="mt-2 text-sm text-ink-600">
                La IA lee tu documento y pre-llena el formulario con título, objetivos, criterios
                de inclusión, metodología y más. Tú solo revisas y corriges.
              </p>
              <p className="mt-3 text-xs font-medium text-[var(--accent)] group-hover:underline">
                Recomendado — usar IA →
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setPath("manual")}
          className="card group cursor-pointer p-6 text-left transition hover:border-ink-400 hover:shadow-md"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xl">
              📝
            </div>
            <div>
              <h2 className="text-display-2">Llenar desde cero</h2>
              <p className="mt-2 text-sm text-ink-600">
                Aún no tienes el documento listo, o prefieres capturar todo a mano en el wizard
                paso a paso.
              </p>
              <p className="mt-3 text-xs font-medium text-ink-600 group-hover:underline">
                Continuar manual →
              </p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  if (path === "manual") {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xl">
            📝
          </div>
          <div className="flex-1">
            <h2 className="text-display-2">Llenar desde cero</h2>
            <p className="mt-2 text-sm text-ink-600">
              Crearemos un borrador vacío y abriremos el wizard de 4 pasos. Podrás guardar tu
              avance y volver cuando quieras.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-between">
          <button onClick={() => setPath("elegir")} className="btn-secondary">
            ← Cambiar
          </button>
          <button onClick={dispararManual} disabled={pending} className="btn-primary">
            {pending ? "Creando..." : "Crear borrador y comenzar →"}
          </button>
        </div>
      </div>
    );
  }

  // path === "ia"
  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xl">
          ✨
        </div>
        <div className="flex-1">
          <h2 className="text-display-2">Subir mi protocolo</h2>
          <p className="mt-2 text-sm text-ink-600">
            Sube aquí el <strong>documento principal del protocolo</strong> (formato CEICS u otro).
            La IA lo analiza en ~1 minuto y pre-llena el formulario. Los demás documentos del
            paquete (carta, CV, consentimientos, etc.) los añadirás después en el paso 4 del
            wizard.
          </p>
        </div>
      </div>

      <label
        htmlFor="archivo-protocolo"
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          seleccionarArchivo(e.dataTransfer.files?.[0]);
        }}
        className={`mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition ${
          dragActive
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : file
              ? "border-good/40 bg-good-soft/30"
              : "border-ink-300 bg-ink-50 hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
        }`}
      >
        <span className="text-3xl">{file ? "📄" : "⬆️"}</span>
        {file ? (
          <>
            <span className="text-sm font-medium text-ink-900">{file.name}</span>
            <span className="text-xs text-ink-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
            <span className="mt-1 text-xs text-[var(--accent)]">Click para cambiar archivo</span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-ink-700">
              Click para seleccionar o arrastra el archivo aquí
            </span>
            <span className="text-xs text-ink-500">PDF, .doc o .docx — hasta 25 MB</span>
          </>
        )}
        <input
          id="archivo-protocolo"
          type="file"
          hidden
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => seleccionarArchivo(e.target.files?.[0])}
        />
      </label>

      {error && (
        <div className="mt-4 rounded-md border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-md bg-info-soft px-4 py-3 text-xs text-info">
        💡 La IA tarda 30-60 segundos en procesar tu protocolo. Puedes esperar en la pantalla
        siguiente o cerrar y volver — el wizard te aparecerá pre-llenado en tu dashboard cuando
        termine.
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={() => setPath("elegir")} disabled={pending} className="btn-secondary">
          ← Cambiar
        </button>
        <button
          onClick={dispararIA}
          disabled={pending || !file}
          className="btn-primary disabled:opacity-50"
        >
          {pending ? "Subiendo y enviando a IA..." : "Subir y analizar con IA →"}
        </button>
      </div>
    </div>
  );
}
