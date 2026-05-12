/**
 * Queries server-side para evaluaciones del comité.
 *
 * Usa `createAdminClient()` y filtra propiedad en código, igual que el resto
 * del proyecto (ADR-010 pendiente: desalineamiento auth.uid() ↔ usuarios.id).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { Categoria } from "@/lib/checklist";
import type {
  BloqueVoto,
  EvaluacionMiembro,
  ResultadoCumplimiento,
  TipoVoto,
} from "./types";

const ROLES_COMITE_VOTANTES = [
  "presidente",
  "comite_secretario",
  "comite_vocal",
] as const;

export type MiembroComite = {
  id: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  esPresidente: boolean;
};

/**
 * Lista los miembros del comité con derecho a voto.
 * Excluye `admin_sistema` (rol técnico, no clínico).
 */
export async function listarMiembrosElegiblesComite(): Promise<MiembroComite[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuario_roles")
    .select(
      "rol, usuarios:usuario_id(id, email, nombre, apellido_paterno, apellido_materno)",
    )
    .in("rol", ROLES_COMITE_VOTANTES as unknown as string[]);

  if (error || !data) return [];

  const porId = new Map<string, MiembroComite>();
  for (const row of data) {
    const u = row.usuarios as unknown as {
      id: string;
      email: string;
      nombre: string;
      apellido_paterno: string;
      apellido_materno: string | null;
    } | null;
    if (!u) continue;
    const previo = porId.get(u.id);
    const esPresidente = row.rol === "presidente" || previo?.esPresidente === true;
    porId.set(u.id, {
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellidoPaterno: u.apellido_paterno,
      esPresidente,
    });
  }
  return Array.from(porId.values());
}

/** Devuelve el Presidente vigente del comité, o null si no se ha designado. */
export async function obtenerPresidente(): Promise<MiembroComite | null> {
  const miembros = await listarMiembrosElegiblesComite();
  return miembros.find((m) => m.esPresidente) ?? null;
}

export type EvaluacionConBloques = {
  id: string;
  miembro_id: string;
  voto_global: TipoVoto;
  comentario_global: string | null;
  conflicto_interes: boolean;
  motivo_abstencion: string | null;
  votado_at: string;
  bloques: BloqueVoto[];
};

/**
 * Devuelve la evaluación del usuario sobre un protocolo (cabecera + 11 bloques),
 * o null si aún no ha votado.
 */
export async function obtenerEvaluacionUsuario(
  protocoloId: string,
  usuarioId: string,
): Promise<EvaluacionConBloques | null> {
  const admin = createAdminClient();
  const { data: cabecera } = await admin
    .from("evaluaciones")
    .select(
      "id, miembro_id, voto_global, comentario_global, conflicto_interes, motivo_abstencion, votado_at",
    )
    .eq("protocolo_id", protocoloId)
    .eq("miembro_id", usuarioId)
    .maybeSingle();

  if (!cabecera) return null;

  const { data: bloquesRows } = await admin
    .from("evaluaciones_bloques")
    .select("bloque, resultado, acordado_con_ia, comentario")
    .eq("evaluacion_id", cabecera.id);

  const bloques: BloqueVoto[] = (bloquesRows ?? []).map((b) => ({
    bloque: b.bloque as Categoria,
    resultado: b.resultado as ResultadoCumplimiento,
    acordado_con_ia: b.acordado_con_ia,
    comentario: b.comentario,
  }));

  return {
    id: cabecera.id,
    miembro_id: cabecera.miembro_id,
    voto_global: cabecera.voto_global as TipoVoto,
    comentario_global: cabecera.comentario_global,
    conflicto_interes: cabecera.conflicto_interes,
    motivo_abstencion: cabecera.motivo_abstencion,
    votado_at: cabecera.votado_at,
    bloques,
  };
}

/** Lista las cabeceras de evaluación de un protocolo (todas las emitidas). */
export async function listarEvaluacionesProtocolo(
  protocoloId: string,
): Promise<EvaluacionMiembro[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("evaluaciones")
    .select("miembro_id, voto_global, conflicto_interes")
    .eq("protocolo_id", protocoloId);

  return (data ?? []).map((e) => ({
    miembro_id: e.miembro_id,
    voto_global: e.voto_global as TipoVoto,
    conflicto_interes: e.conflicto_interes,
  }));
}
