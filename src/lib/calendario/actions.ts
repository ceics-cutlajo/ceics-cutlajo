"use server";

/**
 * Server actions del Calendario de Reuniones.
 *
 * Solo Presidencia y Secretaría pueden crear/editar/eliminar sesiones. El
 * gateo se hace aquí (service_role + verificación de rol); el resto del
 * comité y los investigadores solo consultan.
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import type { RolSistema } from "@/types/domain";
import type { Modalidad } from "./types";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type SesionInput = {
  titulo: string;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM
  hora_fin: string | null;
  modalidad: Modalidad;
  ubicacion: string | null;
  meet_link: string | null;
  meet_telefono: string | null;
  meet_pin: string | null;
  orden_del_dia: string | null;
};

const MODALIDADES: Modalidad[] = ["virtual", "presencial", "hibrida"];

function puedeProgramar(roles: RolSistema[]): boolean {
  return roles.includes("presidente") || roles.includes("comite_secretario");
}

function validar(input: SesionInput): string | null {
  if (!input.titulo?.trim()) return "El título es obligatorio.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return "Fecha inválida.";
  if (!/^\d{2}:\d{2}$/.test(input.hora_inicio)) return "Hora de inicio inválida.";
  if (input.hora_fin && !/^\d{2}:\d{2}$/.test(input.hora_fin))
    return "Hora de fin inválida.";
  if (!MODALIDADES.includes(input.modalidad)) return "Modalidad inválida.";
  if (input.meet_link && !/^https?:\/\//i.test(input.meet_link))
    return "El enlace de Meet debe ser una URL válida.";
  return null;
}

function limpiar(input: SesionInput) {
  const t = (v: string | null) => {
    const s = (v ?? "").trim();
    return s.length ? s : null;
  };
  return {
    titulo: input.titulo.trim(),
    fecha: input.fecha,
    hora_inicio: input.hora_inicio,
    hora_fin: input.hora_fin || null,
    modalidad: input.modalidad,
    ubicacion: t(input.ubicacion),
    meet_link: t(input.meet_link),
    meet_telefono: t(input.meet_telefono),
    meet_pin: t(input.meet_pin),
    orden_del_dia: t(input.orden_del_dia),
  };
}

// Cliente sin tipos para la tabla nueva (ver nota en queries.ts).
function tabla() {
  return (createAdminClient() as unknown as {
    from: (t: string) => any;
  }).from("sesiones_comite");
}

async function idUsuarioActual(email: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

export async function crearSesion(
  input: SesionInput,
): Promise<ActionResult<{ id: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!puedeProgramar(usuario.roles))
    return { ok: false, error: "No tienes permisos para programar sesiones." };

  const err = validar(input);
  if (err) return { ok: false, error: err };

  const creadorId = await idUsuarioActual(usuario.email);
  const { data, error } = await tabla()
    .insert({ ...limpiar(input), created_by: creadorId })
    .select("id")
    .single();

  if (error) return { ok: false, error: "No se pudo guardar la sesión." };
  revalidatePath("/comite/calendario");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function actualizarSesion(
  id: string,
  input: SesionInput,
): Promise<ActionResult> {
  const usuario = await obtenerUsuarioActual();
  if (!puedeProgramar(usuario.roles))
    return { ok: false, error: "No tienes permisos para editar sesiones." };

  const err = validar(input);
  if (err) return { ok: false, error: err };

  const { error } = await tabla().update(limpiar(input)).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar la sesión." };
  revalidatePath("/comite/calendario");
  return { ok: true };
}

export async function eliminarSesion(id: string): Promise<ActionResult> {
  const usuario = await obtenerUsuarioActual();
  if (!puedeProgramar(usuario.roles))
    return { ok: false, error: "No tienes permisos para eliminar sesiones." };

  const { error } = await tabla().delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar la sesión." };
  revalidatePath("/comite/calendario");
  return { ok: true };
}
