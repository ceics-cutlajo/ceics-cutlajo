/**
 * Queries para preparar los datos del acta.
 *
 * `obtenerDatosBaseActa(protocoloId)` recopila TODO lo que el formulario
 * "Emitir Dictamen" del Presidente necesita para prerellenar y todo lo que
 * los generadores DOCX/PDF necesitan para renderizar. La función no construye
 * el acta final — eso lo hace `actions.ts` después de aplicar los ajustes
 * del Presidente y de llamar a `siguiente_numero_oficio()`.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { CargoActa, VotoActa } from "./types";

export type MiembroVoto = {
  usuario_id: string;
  cargo: CargoActa;
  nombre_completo: string;
  codigo_udg: string;
  /** null = miembro presente sin voto (p. ej. firmante por delegación, agregado en actions.ts). queries.ts solo devuelve presentes con voto, pero el tipo lo admite por consistencia con MiembroActa. */
  voto: VotoActa | null;
  motivo_abstencion: string | null;
};

export type RecomendacionComiteValor =
  | "aprobar"
  | "aprobar_con_observaciones"
  | "no_aprobar"
  | "sin_decisivos"
  | null;

export type DatosBaseActa = {
  protocolo: {
    id: string;
    clave: string;
    titulo: string;
    estado: string;
    recomendacion_comite: RecomendacionComiteValor;
    investigador_principal_id: string;
    tipo_investigacion_nombre: string;
    area_conocimiento_nombre: string;
    clasificacion_riesgo_etiqueta: string;
    fecha_sometimiento_iso: string;
  };
  ip: {
    titulo: string;
    nombre_completo: string;
    codigo_udg: string;
    adscripcion: string;
    correo: string;
  };
  presidente: {
    id: string;
    titulo: string;
    nombre: string;
    codigo_udg: string;
    email: string;
  };
  secretario: {
    id: string;
    titulo: string;
    nombre: string;
    codigo_udg: string;
    email: string;
  } | null;
  miembros: MiembroVoto[];
  conteoVotos: {
    favor: number;
    contra: number;
    abstencion: number;
    presentes: number;
    totalMiembros: number;
  };
  comentariosComite: string[];
};

const ETIQUETA_RIESGO: Record<string, string> = {
  sin_riesgo: "Sin riesgo",
  riesgo_minimo: "Riesgo mínimo",
  riesgo_mayor_minimo: "Riesgo mayor al mínimo",
};

/** Asume "Dr." / "Dra." por terminación de cualquier nombre de pila. */
function inferirTitulo(nombre: string): string {
  // Heurística case-insensitive sobre todos los tokens de la parte del nombre
  // (no apellidos). Cubre nombres compuestos como "Judith Carolina" o
  // "María José", y datos guardados en mayúsculas ("JUDITH CAROLINA").
  // Limitación conocida: no detecta "Beatriz", "Carmen", etc. — si el padrón
  // crece, agregar columna `genero` o `titulo_preferido` en `usuarios`.
  const tokens = nombre.trim().toLowerCase().split(/\s+/);
  const algunFemenino = tokens.some((t) => t.endsWith("a") || t.endsWith("á"));
  return algunFemenino ? "Dra." : "Dr.";
}

function nombreCompleto(u: {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}): string {
  const am = u.apellido_materno ? ` ${u.apellido_materno}` : "";
  return `${u.nombre} ${u.apellido_paterno}${am}`;
}

function cargoDesdeRol(rol: string): CargoActa {
  if (rol === "presidente") return "Presidente";
  if (rol === "comite_secretario") return "Secretaria";
  return "Vocal";
}

function votoDesdeTipoVoto(
  voto_global: string,
  conflicto_interes: boolean,
): VotoActa {
  if (voto_global === "abstener" || conflicto_interes) return "Abstención";
  if (voto_global === "no_aprobar") return "En contra";
  return "A favor";
}

export async function obtenerDatosBaseActa(
  protocoloId: string,
): Promise<DatosBaseActa | null> {
  const admin = createAdminClient();

  // 1. Protocolo + IP + catálogos
  const { data: prot } = await admin
    .from("protocolos")
    .select(
      `
      id, clave, titulo, estado, recomendacion_comite,
      clasificacion_riesgo, submitted_at,
      investigador_principal_id,
      area_conocimiento_id, tipo_investigacion_id
      `,
    )
    .eq("id", protocoloId)
    .single();
  if (!prot) return null;

  const [areaResp, tipoResp, ipResp] = await Promise.all([
    prot.area_conocimiento_id
      ? admin
          .from("areas_conocimiento")
          .select("nombre")
          .eq("id", prot.area_conocimiento_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    prot.tipo_investigacion_id
      ? admin
          .from("tipos_investigacion")
          .select("nombre")
          .eq("id", prot.tipo_investigacion_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("usuarios")
      .select(
        "nombre, apellido_paterno, apellido_materno, codigo_udg, division, departamento, email",
      )
      .eq("id", prot.investigador_principal_id)
      .maybeSingle(),
  ]);

  if (!ipResp.data) return null;
  const ipNombre = nombreCompleto(ipResp.data);
  const adscripcion = [
    ipResp.data.division,
    ipResp.data.departamento,
    "CUTlajomulco — Universidad de Guadalajara",
  ]
    .filter(Boolean)
    .join(" — ");

  // 2. Presidente y Secretario(a) actuales del comité (en paralelo)
  type TitularRow = {
    usuarios: {
      id: string;
      nombre: string;
      apellido_paterno: string;
      apellido_materno: string | null;
      codigo_udg: string;
      email: string;
    } | null;
  };
  const [presResp, secResp] = await Promise.all([
    admin
      .from("usuario_roles")
      .select(
        "usuario_id, usuarios:usuario_id(id, nombre, apellido_paterno, apellido_materno, codigo_udg, email)",
      )
      .eq("rol", "presidente")
      .limit(1)
      .maybeSingle(),
    admin
      .from("usuario_roles")
      .select(
        "usuario_id, usuarios:usuario_id(id, nombre, apellido_paterno, apellido_materno, codigo_udg, email)",
      )
      .eq("rol", "comite_secretario")
      .limit(1)
      .maybeSingle(),
  ]);
  const presRow = presResp.data as TitularRow | null;
  if (!presRow?.usuarios) return null;
  const pres = presRow.usuarios;
  const secRow = secResp.data as TitularRow | null;
  const secUser = secRow?.usuarios ?? null;

  // 3. Lista de miembros del comité + sus votos
  const { data: rolesRows } = await admin
    .from("usuario_roles")
    .select(
      "rol, usuarios:usuario_id(id, nombre, apellido_paterno, apellido_materno, codigo_udg)",
    )
    .in("rol", ["presidente", "comite_secretario", "comite_vocal"]);

  type RolJoin = {
    rol: string;
    usuarios: {
      id: string;
      nombre: string;
      apellido_paterno: string;
      apellido_materno: string | null;
      codigo_udg: string;
    } | null;
  };

  // Aggregamos por usuario_id (un mismo usuario puede tener varios roles)
  const porId = new Map<
    string,
    {
      cargo: CargoActa;
      nombre_completo: string;
      codigo_udg: string;
    }
  >();
  for (const r of (rolesRows ?? []) as unknown as RolJoin[]) {
    if (!r.usuarios) continue;
    const previo = porId.get(r.usuarios.id);
    const cargoActual = cargoDesdeRol(r.rol);
    // El cargo "Presidente" gana sobre "Secretaria/Vocal"; "Secretaria" sobre "Vocal".
    const ranking: Record<CargoActa, number> = {
      Presidente: 3,
      Secretaria: 2,
      Secretario: 2,
      Vocal: 1,
    };
    const cargoFinal =
      previo && ranking[previo.cargo] >= ranking[cargoActual]
        ? previo.cargo
        : cargoActual;
    porId.set(r.usuarios.id, {
      cargo: cargoFinal,
      nombre_completo: nombreCompleto(r.usuarios),
      codigo_udg: r.usuarios.codigo_udg,
    });
  }

  const { data: evals } = await admin
    .from("evaluaciones")
    .select(
      "miembro_id, voto_global, conflicto_interes, comentario_global, motivo_abstencion",
    )
    .eq("protocolo_id", protocoloId);

  const votoPorId = new Map<
    string,
    { voto: VotoActa; motivo: string | null }
  >();
  const comentarios: string[] = [];
  for (const e of evals ?? []) {
    const voto = votoDesdeTipoVoto(e.voto_global as string, e.conflicto_interes);
    votoPorId.set(e.miembro_id, {
      voto,
      motivo: e.motivo_abstencion ?? null,
    });
    if (e.comentario_global && e.comentario_global.trim().length > 0) {
      comentarios.push(e.comentario_global.trim());
    }
  }

  const miembros: MiembroVoto[] = Array.from(porId.entries())
    .map(([id, m]) => {
      const v = votoPorId.get(id);
      return {
        usuario_id: id,
        cargo: m.cargo,
        nombre_completo: m.nombre_completo,
        codigo_udg: m.codigo_udg,
        voto: v?.voto ?? null,
        motivo_abstencion: v?.motivo ?? null,
      };
    })
    .sort((a, b) => {
      const ranking: Record<CargoActa, number> = {
        Presidente: 1,
        Secretaria: 2,
        Secretario: 2,
        Vocal: 3,
      };
      return ranking[a.cargo] - ranking[b.cargo];
    });

  const presentesMiembros = miembros.filter((m) => votoPorId.has(m.usuario_id));
  const conteoVotos = {
    favor: presentesMiembros.filter((m) => m.voto === "A favor").length,
    contra: presentesMiembros.filter((m) => m.voto === "En contra").length,
    abstencion: presentesMiembros.filter((m) => m.voto === "Abstención").length,
    presentes: presentesMiembros.length,
    totalMiembros: miembros.length,
  };

  // Solo incluir los miembros presentes en la lista del acta
  const miembrosPresentes = presentesMiembros;

  return {
    protocolo: {
      id: prot.id,
      clave: prot.clave ?? "(sin clave)",
      titulo: prot.titulo,
      estado: prot.estado as string,
      recomendacion_comite:
        (prot.recomendacion_comite as RecomendacionComiteValor) ?? null,
      investigador_principal_id: prot.investigador_principal_id as string,
      tipo_investigacion_nombre:
        (tipoResp.data?.nombre as string | undefined) ?? "Investigación",
      area_conocimiento_nombre:
        (areaResp.data?.nombre as string | undefined) ?? "Sin clasificar",
      clasificacion_riesgo_etiqueta:
        prot.clasificacion_riesgo
          ? (ETIQUETA_RIESGO[prot.clasificacion_riesgo as string] ?? "Sin clasificar")
          : "Sin clasificar",
      fecha_sometimiento_iso: prot.submitted_at
        ? prot.submitted_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    },
    ip: {
      titulo: inferirTitulo(ipResp.data.nombre),
      nombre_completo: ipNombre,
      codigo_udg: ipResp.data.codigo_udg,
      adscripcion,
      correo: ipResp.data.email,
    },
    presidente: {
      id: pres.id,
      titulo: inferirTitulo(pres.nombre),
      nombre: nombreCompleto(pres),
      codigo_udg: pres.codigo_udg,
      email: pres.email,
    },
    secretario: secUser
      ? {
          id: secUser.id,
          titulo: inferirTitulo(secUser.nombre),
          nombre: nombreCompleto(secUser),
          codigo_udg: secUser.codigo_udg,
          email: secUser.email,
        }
      : null,
    miembros: miembrosPresentes,
    conteoVotos,
    comentariosComite: comentarios,
  };
}

export async function obtenerActaPorProtocolo(protocoloId: string): Promise<
  | {
      id: string;
      numero_oficio: string;
      fecha_emision: string;
      resolucion: string;
      vigencia_meses: number;
      fecha_vencimiento: string | null;
      docx_storage_path: string | null;
      pdf_storage_path: string | null;
      hash_folio: string;
      enviada_a_investigador_at: string | null;
    }
  | null
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("actas")
    .select(
      "id, numero_oficio, fecha_emision, resolucion, vigencia_meses, fecha_vencimiento, docx_storage_path, pdf_storage_path, hash_folio, enviada_a_investigador_at",
    )
    .eq("protocolo_id", protocoloId)
    .maybeSingle();
  return data;
}
