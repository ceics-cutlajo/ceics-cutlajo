/**
 * Consultas del Calendario de Reuniones (server-side, service_role).
 *
 * NOTA: `sesiones_comite` es una tabla nueva (migración 021) que aún no está
 * en los tipos generados de Supabase, por eso se castea el cliente. Tras
 * aplicar la migración y correr `npm run db:types`, el cast puede retirarse.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { SesionComite } from "./types";

export async function listarSesiones(): Promise<SesionComite[]> {
  const admin = createAdminClient();
  const { data, error } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (
          c: string,
          o: { ascending: boolean },
        ) => Promise<{ data: SesionComite[] | null; error: unknown }>;
      };
    };
  })
    .from("sesiones_comite")
    .select("*")
    .order("fecha", { ascending: true });

  if (error || !data) return [];
  return data;
}

export async function obtenerSesion(id: string): Promise<SesionComite | null> {
  const admin = createAdminClient();
  const { data, error } = await (admin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{
            data: SesionComite | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .from("sesiones_comite")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
