/**
 * Queries server-side específicas del timeline. Mantenidas separadas para
 * no inflar las queries genéricas del protocolo.
 */
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Versión máxima del pre-informe para un protocolo. Devuelve 0 si no hay.
 * Usada por `derivarTimeline` para distinguir primera revisión (ronda 1)
 * de re-validación tras observaciones (ronda 2+).
 */
export async function obtenerVersionMaxPreInforme(protocoloId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pre_informes")
    .select("version")
    .eq("protocolo_id", protocoloId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.version ?? 0;
}
