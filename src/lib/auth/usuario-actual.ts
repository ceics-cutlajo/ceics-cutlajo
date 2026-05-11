/**
 * Helper server-side para obtener el usuario actual con su perfil y roles.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RolSistema } from "@/types/domain";

export type UsuarioActual = {
  authId: string;
  email: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  codigo_udg: string;
  division: string | null;
  departamento: string | null;
  email_verificado: boolean;
  roles: RolSistema[];
  rolPrincipal: RolSistema;
};

export async function obtenerUsuarioActual(): Promise<UsuarioActual> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios")
    .select("*")
    .eq("email", user.email!)
    .single();

  if (!perfil) {
    // Sesión válida pero sin perfil → forzar signup completo
    redirect("/signup");
  }

  const { data: rolesRows } = await admin
    .from("usuario_roles")
    .select("rol")
    .eq("usuario_id", perfil.id);

  const roles = (rolesRows ?? []).map((r) => r.rol) as RolSistema[];
  const rolPrincipal = elegirRolPrincipal(roles);

  return {
    authId: user.id,
    email: perfil.email,
    nombre: perfil.nombre,
    apellido_paterno: perfil.apellido_paterno,
    apellido_materno: perfil.apellido_materno,
    codigo_udg: perfil.codigo_udg,
    division: perfil.division,
    departamento: perfil.departamento,
    email_verificado: perfil.email_verificado,
    roles,
    rolPrincipal,
  };
}

/** Prioridad: presidente > secretario > vocal > admin > investigador */
function elegirRolPrincipal(roles: RolSistema[]): RolSistema {
  const prioridad: RolSistema[] = [
    "presidente",
    "comite_secretario",
    "comite_vocal",
    "admin_sistema",
    "investigador",
  ];
  for (const r of prioridad) if (roles.includes(r)) return r;
  return "investigador";
}

export function inicialesDe(nombre: string, apellido_paterno: string): string {
  return `${nombre[0] ?? ""}${apellido_paterno[0] ?? ""}`.toUpperCase();
}

export function nombreCompletoDe(u: UsuarioActual): string {
  return `${u.nombre} ${u.apellido_paterno}${u.apellido_materno ? " " + u.apellido_materno : ""}`;
}

export function cargoDe(rol: RolSistema): string {
  const map: Record<RolSistema, string> = {
    presidente: "Presidente · CEICS",
    comite_secretario: "Secretaría · CEICS",
    comite_vocal: "Vocal · CEICS",
    admin_sistema: "Administración",
    investigador: "Investigador/a",
  };
  return map[rol];
}
