/**
 * Queries de lectura para protocolos. Todas corren server-side.
 *
 * NOTA: Usan admin client (service_role) para evitar el desalineamiento entre
 * `auth.uid()` (de auth.users) y `usuarios.id` (UUID propio generado en la app).
 * El filtrado de seguridad se hace explícitamente comparando el `id` del usuario
 * recuperado por email. Cuando se arregle ese mapeo (sesión futura, ADR-010 pendiente)
 * se puede volver a depender de RLS.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import type { EstadoProtocolo } from "@/types/domain";

export type ProtocoloResumen = {
  id: string;
  clave: string | null;
  titulo: string;
  estado: EstadoProtocolo;
  created_at: string;
  submitted_at: string | null;
  numero_oficio: string | null;
};

export type ProtocoloCompleto = {
  id: string;
  clave: string | null;
  numero_consecutivo: number;
  titulo: string;
  resumen: string | null;
  estado: EstadoProtocolo;
  investigador_principal_id: string;
  area_conocimiento_id: number | null;
  tipo_investigacion_id: string | null;
  clasificacion_riesgo: "sin_riesgo" | "riesgo_minimo" | "riesgo_mayor_minimo" | null;
  involucra_humanos: boolean;
  involucra_menores: boolean;
  involucra_datos_geneticos: boolean;
  involucra_medicamento: boolean;
  // Campos clínicos (pueden venir de IA o capturarse a mano)
  objetivo_general: string | null;
  objetivos_especificos: string[];
  criterios_inclusion: string[];
  criterios_exclusion: string[];
  metodologia: string | null;
  cronograma: { etapa: string; inicio?: string; fin?: string }[];
  // Estado de extracción IA
  esperando_extraccion: boolean;
  extraccion_id: string | null;
  numero_oficio: string | null;
  created_at: string;
  submitted_at: string | null;
  dictaminado_at: string | null;
  fecha_aprobacion: string | null;
  fecha_vencimiento: string | null;
  recomendacion_comite:
    | "aprobar"
    | "aprobar_con_observaciones"
    | "no_aprobar"
    | "sin_decisivos"
    | null;
};

/** Metadata de campos extraídos por IA (confianza por campo, fragmento-fuente). */
export type CampoExtraido = {
  valor: unknown;
  confianza: "alta" | "media" | "baja";
  fuente?: string;
};

export type ResultadoExtraccion = {
  campos: Record<string, CampoExtraido>;
  alertas?: string[];
  tokens_input?: number;
  tokens_output?: number;
};

export type CoInvestigadorRow = {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  adscripcion: string | null;
  email: string | null;
  orden: number;
};

export type DocumentoRow = {
  id: string;
  tipo_documento_id: string;
  nombre_original: string;
  storage_path: string;
  mime_type: string;
  tamano_bytes: number;
  uploaded_at: string;
};

export type EventoRow = {
  id: string;
  tipo: string;
  descripcion: string | null;
  created_at: string;
  datos: Record<string, unknown> | null;
};

/**
 * Lista los protocolos del investigador actual. Si es miembro del comité,
 * lista todos los que han sido enviados (no borradores ajenos).
 */
export async function listarProtocolos(): Promise<ProtocoloResumen[]> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();

  // Obtener el id de la tabla usuarios (no el auth.uid)
  const { data: perfil } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  if (!perfil) return [];

  const esComite = usuario.roles.some((r) =>
    ["presidente", "comite_vocal", "comite_secretario", "admin_sistema"].includes(r),
  );

  let query = admin
    .from("protocolos")
    .select("id, clave, titulo, estado, created_at, submitted_at, numero_oficio")
    .order("created_at", { ascending: false });

  if (esComite) {
    // Comité ve todo lo enviado + sus propios borradores
    query = query.or(
      `investigador_principal_id.eq.${perfil.id},estado.neq.borrador`,
    );
  } else {
    query = query.eq("investigador_principal_id", perfil.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listarProtocolos error:", error);
    return [];
  }
  return (data ?? []) as ProtocoloResumen[];
}

export async function obtenerProtocolo(
  protocoloId: string,
): Promise<{
  protocolo: ProtocoloCompleto;
  coInvestigadores: CoInvestigadorRow[];
  documentos: DocumentoRow[];
  eventos: EventoRow[];
  esPropietario: boolean;
  extraccion: ResultadoExtraccion | null;
} | null> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", usuario.email)
    .single();
  if (!perfil) return null;

  const { data: protocolo, error } = await admin
    .from("protocolos")
    .select("*")
    .eq("id", protocoloId)
    .single();
  if (error || !protocolo) return null;

  const esPropietario = protocolo.investigador_principal_id === perfil.id;
  const esComite = usuario.roles.some((r) =>
    ["presidente", "comite_vocal", "comite_secretario", "admin_sistema"].includes(r),
  );

  // Seguridad: el dueño puede ver siempre; comité solo si no es borrador ajeno
  if (!esPropietario && !esComite) return null;
  if (!esPropietario && protocolo.estado === "borrador") return null;

  const [{ data: coInvs }, { data: docs }, { data: eventos }, extPromise] = await Promise.all([
    admin
      .from("protocolo_co_investigadores")
      .select("id, nombre, apellido_paterno, apellido_materno, adscripcion, email, orden")
      .eq("protocolo_id", protocoloId)
      .order("orden"),
    admin
      .from("protocolo_documentos")
      .select("id, tipo_documento_id, nombre_original, storage_path, mime_type, tamano_bytes, uploaded_at")
      .eq("protocolo_id", protocoloId)
      .order("ronda", { ascending: false })
      .order("uploaded_at", { ascending: false }),
    admin
      .from("protocolo_eventos")
      .select("id, tipo, descripcion, created_at, datos")
      .eq("protocolo_id", protocoloId)
      .order("created_at", { ascending: false })
      .limit(50),
    protocolo.extraccion_id
      ? admin
          .from("extracciones_ia")
          .select("resultado_json")
          .eq("id", protocolo.extraccion_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const extraccionRaw = (extPromise as { data: { resultado_json: ResultadoExtraccion | null } | null }).data;
  const extraccion = extraccionRaw?.resultado_json ?? null;

  // Normalizar campos JSON que pueden venir como null
  const protocoloNorm: ProtocoloCompleto = {
    ...protocolo,
    objetivos_especificos: protocolo.objetivos_especificos ?? [],
    criterios_inclusion: protocolo.criterios_inclusion ?? [],
    criterios_exclusion: protocolo.criterios_exclusion ?? [],
    cronograma: protocolo.cronograma ?? [],
  } as ProtocoloCompleto;

  // Versionado por ronda: mostrar solo la ÚLTIMA versión de cada tipo de
  // documento. `docs` viene ordenado por (ronda desc, uploaded_at desc) desde
  // la query, así que la PRIMERA ocurrencia de cada tipo es la vigente. Las
  // versiones de rondas anteriores se conservan en Storage/BD pero no se listan
  // en el expediente (acarreo de la versión más reciente entre rondas).
  // (La dedupe depende de ese orden de la query — no reordenar antes de aquí.)
  const docsVigentes: NonNullable<typeof docs> = [];
  if (docs) {
    const tiposVistos = new Set<string>();
    for (const d of docs) {
      if (tiposVistos.has(d.tipo_documento_id)) continue;
      tiposVistos.add(d.tipo_documento_id);
      docsVigentes.push(d);
    }
    // Orden de presentación estable por tipo (independiente de la ronda/fecha,
    // para no mezclar visualmente versiones de distintas rondas por timestamp).
    docsVigentes.sort((a, b) => a.tipo_documento_id.localeCompare(b.tipo_documento_id));
  }

  return {
    protocolo: protocoloNorm,
    coInvestigadores: (coInvs ?? []) as CoInvestigadorRow[],
    documentos: docsVigentes as DocumentoRow[],
    eventos: (eventos ?? []) as EventoRow[],
    esPropietario,
    extraccion,
  };
}

/** Métricas agregadas para el Tablero del Presidente. */
export type KpisPresidencia = {
  totalAno: number;
  recibidosMes: number;
  enEvaluacion: number;
  dictaminadosAno: number;
  pendientesMiFirma: number;
};

export async function obtenerKpisPresidencia(): Promise<KpisPresidencia> {
  const admin = createAdminClient();
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  const inicioAno = new Date(ahora.getFullYear(), 0, 1).toISOString();

  const [totalAno, recibidos, enEval, dictaminados, pendientes] = await Promise.all([
    admin
      .from("protocolos")
      .select("id", { count: "exact", head: true })
      .gte("submitted_at", inicioAno),
    admin
      .from("protocolos")
      .select("id", { count: "exact", head: true })
      .gte("submitted_at", inicioMes),
    admin
      .from("protocolos")
      .select("id", { count: "exact", head: true })
      .in("estado", ["en_evaluacion_ia", "en_revision_comite", "observaciones"]),
    admin
      .from("protocolos")
      .select("id", { count: "exact", head: true })
      .in("estado", ["aprobado", "aprobado_con_observaciones", "rechazado"])
      .gte("dictaminado_at", inicioAno),
    admin
      .from("protocolos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "listo_dictamen"),
  ]);

  return {
    totalAno: totalAno.count ?? 0,
    recibidosMes: recibidos.count ?? 0,
    enEvaluacion: enEval.count ?? 0,
    dictaminadosAno: dictaminados.count ?? 0,
    pendientesMiFirma: pendientes.count ?? 0,
  };
}

/** Bandeja del comité: protocolos en estados intermedios, con badge de conflicto de interés. */
export type ProtocoloBandeja = ProtocoloResumen & {
  resumen: string | null;
  ip_nombre: string;
  conflictoInteres: boolean;
};

export async function listarBandejaComite(): Promise<ProtocoloBandeja[]> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();
  const emailUsuario = usuario.email.toLowerCase();

  const { data: prots } = await admin
    .from("protocolos")
    .select(
      "id, clave, titulo, resumen, estado, created_at, submitted_at, numero_oficio, investigador_principal_id",
    )
    .in("estado", [
      "en_evaluacion_ia",
      "en_revision_comite",
      "observaciones",
      "listo_dictamen",
    ])
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (!prots || prots.length === 0) return [];

  const ipIds = Array.from(new Set(prots.map((p) => p.investigador_principal_id)));
  const protocoloIds = prots.map((p) => p.id);

  const [ipsResult, coInvsResult] = await Promise.all([
    admin
      .from("usuarios")
      .select("id, nombre, apellido_paterno, apellido_materno, email")
      .in("id", ipIds),
    admin
      .from("protocolo_co_investigadores")
      .select("protocolo_id, email")
      .in("protocolo_id", protocoloIds),
  ]);

  const ipPorId = new Map<
    string,
    { nombre: string; apellido_paterno: string; apellido_materno: string | null; email: string }
  >();
  (ipsResult.data ?? []).forEach((u) => ipPorId.set(u.id, u));

  const emailsPorProtocolo = new Map<string, Set<string>>();
  (coInvsResult.data ?? []).forEach((c) => {
    if (!c.email) return;
    const set = emailsPorProtocolo.get(c.protocolo_id) ?? new Set<string>();
    set.add(c.email.toLowerCase());
    emailsPorProtocolo.set(c.protocolo_id, set);
  });

  return prots.map((p) => {
    const ipData = ipPorId.get(p.investigador_principal_id);
    const ipEmail = ipData?.email.toLowerCase();
    const emailsCoInv = emailsPorProtocolo.get(p.id) ?? new Set<string>();
    const conflictoInteres = ipEmail === emailUsuario || emailsCoInv.has(emailUsuario);
    return {
      id: p.id,
      clave: p.clave,
      titulo: p.titulo,
      resumen: p.resumen,
      estado: p.estado,
      created_at: p.created_at,
      submitted_at: p.submitted_at,
      numero_oficio: p.numero_oficio,
      ip_nombre: ipData
        ? `${ipData.nombre} ${ipData.apellido_paterno}${
            ipData.apellido_materno ? " " + ipData.apellido_materno : ""
          }`
        : "—",
      conflictoInteres,
    };
  });
}

/** Vista anual completa para el Tablero del Presidente (estados activos + dictaminados). */
export type ProtocoloDelAno = ProtocoloResumen & {
  ip_nombre: string;
  conflictoInteres: boolean;
  fecha_aprobacion: string | null;
  fecha_vencimiento: string | null;
  dictaminado_at: string | null;
};

export async function listarProtocolosAno(): Promise<ProtocoloDelAno[]> {
  const usuario = await obtenerUsuarioActual();
  const admin = createAdminClient();
  const emailUsuario = usuario.email.toLowerCase();

  const inicioAno = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const { data: prots } = await admin
    .from("protocolos")
    .select(
      "id, clave, titulo, estado, created_at, submitted_at, numero_oficio, investigador_principal_id, fecha_aprobacion, fecha_vencimiento, dictaminado_at",
    )
    .gte("submitted_at", inicioAno)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (!prots || prots.length === 0) return [];

  const ipIds = Array.from(new Set(prots.map((p) => p.investigador_principal_id)));
  const protocoloIds = prots.map((p) => p.id);

  const [ipsResult, coInvsResult] = await Promise.all([
    admin
      .from("usuarios")
      .select("id, nombre, apellido_paterno, apellido_materno, email")
      .in("id", ipIds),
    admin
      .from("protocolo_co_investigadores")
      .select("protocolo_id, email")
      .in("protocolo_id", protocoloIds),
  ]);

  const ipPorId = new Map<
    string,
    { nombre: string; apellido_paterno: string; apellido_materno: string | null; email: string }
  >();
  (ipsResult.data ?? []).forEach((u) => ipPorId.set(u.id, u));

  const emailsPorProtocolo = new Map<string, Set<string>>();
  (coInvsResult.data ?? []).forEach((c) => {
    if (!c.email) return;
    const set = emailsPorProtocolo.get(c.protocolo_id) ?? new Set<string>();
    set.add(c.email.toLowerCase());
    emailsPorProtocolo.set(c.protocolo_id, set);
  });

  return prots.map((p) => {
    const ipData = ipPorId.get(p.investigador_principal_id);
    const ipEmail = ipData?.email.toLowerCase();
    const emailsCoInv = emailsPorProtocolo.get(p.id) ?? new Set<string>();
    const conflictoInteres = ipEmail === emailUsuario || emailsCoInv.has(emailUsuario);
    return {
      id: p.id,
      clave: p.clave,
      titulo: p.titulo,
      estado: p.estado,
      created_at: p.created_at,
      submitted_at: p.submitted_at,
      numero_oficio: p.numero_oficio,
      fecha_aprobacion: p.fecha_aprobacion,
      fecha_vencimiento: p.fecha_vencimiento,
      dictaminado_at: p.dictaminado_at,
      ip_nombre: ipData
        ? `${ipData.nombre} ${ipData.apellido_paterno}${
            ipData.apellido_materno ? " " + ipData.apellido_materno : ""
          }`
        : "—",
      conflictoInteres,
    };
  });
}

export type ExtraccionStatus = {
  protocolo_id: string;
  esperando_extraccion: boolean;
  extraccion: {
    id: string;
    estado: "pendiente" | "procesando" | "completado" | "error";
    created_at: string;
    procesando_desde: string | null;
    completed_at: string | null;
    error_mensaje: string | null;
    texto_caracteres: number | null;
    modelo: string | null;
  } | null;
};

/** Estado actual de la extracción IA del protocolo (la más reciente). */
export async function obtenerEstadoExtraccion(
  protocoloId: string,
): Promise<ExtraccionStatus | null> {
  const admin = createAdminClient();
  const { data: prot } = await admin
    .from("protocolos")
    .select("id, esperando_extraccion")
    .eq("id", protocoloId)
    .single();
  if (!prot) return null;

  const { data: ext } = await admin
    .from("extracciones_ia")
    .select(
      "id, estado, created_at, procesando_desde, completed_at, error_mensaje, texto_caracteres, modelo",
    )
    .eq("protocolo_id", protocoloId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let extraccion = ext;
  let esperando = prot.esperando_extraccion;

  // Auto-recuperación de extracciones colgadas. Si la función de IA murió (p.ej.
  // Vercel mató el proceso al alcanzar su límite de 120s), la fila puede quedar
  // atrapada en 'procesando' indefinidamente y el investigador vería un spinner
  // sin fin. La llamada a la IA se aborta a los ~110s y el handler marca 'error';
  // por tanto, una fila que SIGA en 'procesando' pasados 150s implica que la
  // función entera murió. El umbral DEBE superar maxDuration (120s) para no
  // marcar error a una extracción que sigue legítimamente en curso. La marcamos
  // como 'error' (visible, con botón Reintentar) y apagamos la espera para que la
  // pantalla redirija al wizard. Esta query se ejecuta en cada refresco (cada
  // 15s) de la pantalla `procesando`, así que la recuperación es casi inmediata
  // sin depender de crons.
  const STALE_MS = 150_000;
  if (
    ext &&
    ext.estado === "procesando" &&
    ext.procesando_desde &&
    Date.now() - new Date(ext.procesando_desde).getTime() > STALE_MS
  ) {
    const mensaje =
      "El análisis se interrumpió por exceder el tiempo límite. Reintenta el análisis o salta y llena el formulario manualmente.";
    await admin
      .from("extracciones_ia")
      .update({
        estado: "error",
        completed_at: new Date().toISOString(),
        error_mensaje: mensaje,
      })
      .eq("id", ext.id)
      .eq("estado", "procesando"); // idempotente: solo si sigue colgada
    await admin
      .from("protocolos")
      .update({ esperando_extraccion: false })
      .eq("id", protocoloId);
    extraccion = { ...ext, estado: "error" as const, error_mensaje: mensaje };
    esperando = false;
  }

  return {
    protocolo_id: prot.id,
    esperando_extraccion: esperando,
    extraccion,
  };
}

/** URL firmada para descargar un documento desde Storage (válida 60 s). */
export async function urlFirmadaDocumento(storagePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("protocolos")
    .createSignedUrl(storagePath, 60);
  if (error || !data) return null;
  return data.signedUrl;
}
